package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

type CreateKBArticleRequest struct {
	Title    string `json:"title" binding:"required,min=5,max=255"`
	Content  string `json:"content" binding:"required,min=10"`
	Category string `json:"category" binding:"required,min=2,max=100"`
	Tags     string `json:"tags"`
}

type UpdateKBArticleRequest struct {
	Title       *string `json:"title" binding:"omitempty,min=5,max=255"`
	Content     *string `json:"content" binding:"omitempty,min=10"`
	Category    *string `json:"category" binding:"omitempty,min=2,max=100"`
	Tags        *string `json:"tags"`
	IsPublished *bool   `json:"is_published"`
}

type KBArticleResponse struct {
	ID             uint          `json:"id"`
	Title          string        `json:"title"`
	Content        string        `json:"content"`
	Category       string        `json:"category"`
	Tags           []string      `json:"tags"`
	IsPublished    bool          `json:"is_published"`
	ApprovalStatus string        `json:"approval_status"`
	ViewCount      int           `json:"view_count"`
	AuthorID       uint          `json:"author_id"`
	Author         *UserResponse `json:"author,omitempty"`
	CreatedAt      string        `json:"created_at"`
	UpdatedAt      string        `json:"updated_at"`
}

func canViewArticle(actor models.User, article models.KBArticle) bool {
	if article.IsPublished || article.ApprovalStatus == models.KBApprovalPublished {
		return true
	}
	if actor.IsStaffMember() {
		if actor.CanEditAnyWiki() {
			return true
		}
		return article.AuthorID == actor.ID
	}
	return false
}

func canEditArticle(actor models.User, article models.KBArticle) bool {
	if actor.CanEditAnyWiki() {
		return true
	}
	if actor.Role == models.RoleITAgent && article.AuthorID == actor.ID {
		return article.ApprovalStatus == models.KBApprovalDraft || article.ApprovalStatus == models.KBApprovalRejected
	}
	return false
}

func canDeleteArticle(actor models.User, article models.KBArticle) bool {
	if actor.IsFullAdmin() {
		return true
	}
	if article.AuthorID != actor.ID {
		return false
	}
	if actor.HasAdminElevation() || actor.Role == models.RoleManager {
		return true
	}
	if actor.Role == models.RoleITAgent {
		return article.ApprovalStatus == models.KBApprovalDraft || article.ApprovalStatus == models.KBApprovalRejected
	}
	return false
}

// ListKBArticles returns published articles for employees, or staff-visible articles for staff.
func ListKBArticles(c *gin.Context) {
	actor, _ := middleware.GetUser(c)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	query := database.DB.Model(&models.KBArticle{})

	if actor.Role == models.RoleEmployee {
		query = query.Where("is_published = ? OR approval_status = ?", true, models.KBApprovalPublished)
	} else if !actor.CanEditAnyWiki() {
		query = query.Where("is_published = ? OR approval_status = ? OR author_id = ?", true, models.KBApprovalPublished, actor.ID)
	}

	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}
	if search := c.Query("search"); search != "" {
		query = query.Where("title ILIKE ? OR content ILIKE ? OR tags ILIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var articles []models.KBArticle
	offset := (page - 1) * perPage
	query.Preload("Author").Order("created_at DESC").Offset(offset).Limit(perPage).Find(&articles)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	responses := make([]KBArticleResponse, len(articles))
	for i, a := range articles {
		responses[i] = toKBArticleResponse(a)
	}

	c.JSON(http.StatusOK, gin.H{
		"articles":    responses,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// GetKBArticle returns a single article and increments view count.
func GetKBArticle(c *gin.Context) {
	articleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid article ID"})
		return
	}

	actor, _ := middleware.GetUser(c)

	var article models.KBArticle
	if err := database.DB.Preload("Author").First(&article, uint(articleID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	if !canViewArticle(actor, article) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	database.DB.Model(&article).Update("view_count", article.ViewCount+1)
	article.ViewCount++

	c.JSON(http.StatusOK, gin.H{"article": toKBArticleResponse(article)})
}

// CreateKBArticle creates a new KB article. Staff only.
func CreateKBArticle(c *gin.Context) {
	actor, _ := middleware.GetUser(c)
	if !actor.IsStaffMember() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff access required"})
		return
	}

	var req CreateKBArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	article := models.KBArticle{
		Title:          req.Title,
		Content:        req.Content,
		Category:       req.Category,
		Tags:           req.Tags,
		IsPublished:    false,
		ApprovalStatus: models.KBApprovalDraft,
		AuthorID:       actor.ID,
	}

	if err := database.DB.Create(&article).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create article"})
		return
	}

	database.DB.Preload("Author").First(&article, article.ID)

	LogAudit(c, models.AuditActionCreate, "kb_article", article.ID, "",
		ToJSON(map[string]interface{}{"title": article.Title, "category": article.Category}),
		fmt.Sprintf("KB article created: %s", article.Title))

	c.JSON(http.StatusCreated, gin.H{"article": toKBArticleResponse(article)})
}

// UpdateKBArticle updates an existing KB article with role-based guards.
func UpdateKBArticle(c *gin.Context) {
	articleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid article ID"})
		return
	}

	actor, _ := middleware.GetUser(c)
	if !actor.IsStaffMember() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff access required"})
		return
	}

	var req UpdateKBArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var article models.KBArticle
	if err := database.DB.First(&article, uint(articleID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	if !canEditArticle(actor, article) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only edit your own draft articles"})
		return
	}

	if req.Category != nil && !actor.CanManageKBCategories() && !actor.CanEditAnyWiki() {
		c.JSON(http.StatusForbidden, gin.H{"error": "You cannot change article category"})
		return
	}

	oldValues := map[string]interface{}{
		"title": article.Title, "category": article.Category, "is_published": article.IsPublished,
		"approval_status": article.ApprovalStatus,
	}

	if req.Title != nil {
		article.Title = *req.Title
	}
	if req.Content != nil {
		article.Content = *req.Content
	}
	if req.Category != nil {
		article.Category = *req.Category
	}
	if req.Tags != nil {
		article.Tags = *req.Tags
	}
	if req.IsPublished != nil && actor.CanPublishWiki() {
		article.IsPublished = *req.IsPublished
		if *req.IsPublished {
			article.ApprovalStatus = models.KBApprovalPublished
		} else {
			article.ApprovalStatus = models.KBApprovalDraft
		}
	}

	if err := database.DB.Save(&article).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update article"})
		return
	}

	database.DB.Preload("Author").First(&article, article.ID)

	newValues := map[string]interface{}{
		"title": article.Title, "category": article.Category, "is_published": article.IsPublished,
		"approval_status": article.ApprovalStatus,
	}

	LogAudit(c, models.AuditActionUpdate, "kb_article", article.ID,
		ToJSON(oldValues), ToJSON(newValues),
		fmt.Sprintf("KB article updated: %s", article.Title))

	c.JSON(http.StatusOK, gin.H{"article": toKBArticleResponse(article)})
}

// SubmitKBArticleForApproval moves a draft to pending approval (IT agents).
func SubmitKBArticleForApproval(c *gin.Context) {
	articleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid article ID"})
		return
	}

	actor, _ := middleware.GetUser(c)
	if actor.Role != models.RoleITAgent || actor.HasAdminElevation() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only non-admin IT agents submit articles for approval"})
		return
	}

	var article models.KBArticle
	if err := database.DB.First(&article, uint(articleID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}
	if article.AuthorID != actor.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only submit your own articles"})
		return
	}

	article.ApprovalStatus = models.KBApprovalPendingApproval
	article.IsPublished = false
	database.DB.Save(&article)
	database.DB.Preload("Author").First(&article, article.ID)

	c.JSON(http.StatusOK, gin.H{"article": toKBArticleResponse(article)})
}

// ApproveKBArticle publishes a pending article (manager or admin tiers).
func ApproveKBArticle(c *gin.Context) {
	articleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid article ID"})
		return
	}

	actor, _ := middleware.GetUser(c)
	if !actor.CanPublishWiki() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions to approve articles"})
		return
	}

	var article models.KBArticle
	if err := database.DB.First(&article, uint(articleID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	article.ApprovalStatus = models.KBApprovalPublished
	article.IsPublished = true
	database.DB.Save(&article)
	database.DB.Preload("Author").First(&article, article.ID)

	LogAudit(c, models.AuditActionUpdate, "kb_article", article.ID, "", "",
		fmt.Sprintf("KB article approved: %s", article.Title))

	c.JSON(http.StatusOK, gin.H{"article": toKBArticleResponse(article)})
}

// RejectKBArticle sends a pending article back to draft.
func RejectKBArticle(c *gin.Context) {
	articleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid article ID"})
		return
	}

	actor, _ := middleware.GetUser(c)
	if !actor.CanPublishWiki() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions to reject articles"})
		return
	}

	var article models.KBArticle
	if err := database.DB.First(&article, uint(articleID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	article.ApprovalStatus = models.KBApprovalRejected
	article.IsPublished = false
	database.DB.Save(&article)
	database.DB.Preload("Author").First(&article, article.ID)

	c.JSON(http.StatusOK, gin.H{"article": toKBArticleResponse(article)})
}

// DeleteKBArticle soft-deletes a KB article with role guards.
func DeleteKBArticle(c *gin.Context) {
	articleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid article ID"})
		return
	}

	actor, _ := middleware.GetUser(c)

	var article models.KBArticle
	if err := database.DB.First(&article, uint(articleID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	if !canDeleteArticle(actor, article) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions to delete this article"})
		return
	}

	database.DB.Delete(&article)

	LogAudit(c, models.AuditActionDelete, "kb_article", article.ID,
		ToJSON(map[string]string{"title": article.Title}),
		"", fmt.Sprintf("KB article deleted: %s", article.Title))

	c.JSON(http.StatusOK, gin.H{"message": "Article deleted"})
}

// UploadKBImage handles image uploads for wiki editor content.
func UploadKBImage(c *gin.Context) {
	actor, _ := middleware.GetUser(c)
	if !actor.IsStaffMember() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff access required"})
		return
	}

	file, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Image file is required"})
		return
	}

	if file.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Image must be under 5MB"})
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowed[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only image files are allowed"})
		return
	}

	dir := filepath.Join("uploads", "kb")
	os.MkdirAll(dir, 0755)
	filename := fmt.Sprintf("%d_%d%s", actor.ID, time.Now().UnixNano(), ext)
	dest := filepath.Join(dir, filename)
	if err := c.SaveUploadedFile(file, dest); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save image"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"url": "/api/kb/uploads/" + filename})
}

// ServeKBUpload serves uploaded KB images.
func ServeKBUpload(c *gin.Context) {
	filename := filepath.Base(c.Param("filename"))
	path := filepath.Join("uploads", "kb", filename)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	c.File(path)
}

// GetKBCategories returns categories visible to the caller.
func GetKBCategories(c *gin.Context) {
	actor, _ := middleware.GetUser(c)
	var categories []string

	q := database.DB.Model(&models.KBArticle{})
	if actor.Role == models.RoleEmployee {
		q = q.Where("is_published = ?", true)
	} else if !actor.CanEditAnyWiki() {
		q = q.Where("is_published = ? OR author_id = ?", true, actor.ID)
	}
	q.Distinct("category").Pluck("category", &categories)

	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

func toKBArticleResponse(a models.KBArticle) KBArticleResponse {
	tags := []string{}
	if a.Tags != "" {
		for _, t := range strings.Split(a.Tags, ",") {
			trimmed := strings.TrimSpace(t)
			if trimmed != "" {
				tags = append(tags, trimmed)
			}
		}
	}

	status := a.ApprovalStatus
	if status == "" {
		if a.IsPublished {
			status = models.KBApprovalPublished
		} else {
			status = models.KBApprovalDraft
		}
	}

	resp := KBArticleResponse{
		ID:             a.ID,
		Title:          a.Title,
		Content:        a.Content,
		Category:       a.Category,
		Tags:           tags,
		IsPublished:    a.IsPublished,
		ApprovalStatus: status,
		ViewCount:      a.ViewCount,
		AuthorID:       a.AuthorID,
		CreatedAt:      a.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:      a.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
	if a.Author.ID != 0 {
		ur := toUserResponse(a.Author)
		resp.Author = &ur
	}
	return resp
}
