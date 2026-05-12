package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

// --- KB DTOs ---

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
	ID          uint          `json:"id"`
	Title       string        `json:"title"`
	Content     string        `json:"content"`
	Category    string        `json:"category"`
	Tags        []string      `json:"tags"`
	IsPublished bool          `json:"is_published"`
	ViewCount   int           `json:"view_count"`
	AuthorID    uint          `json:"author_id"`
	Author      *UserResponse `json:"author,omitempty"`
	CreatedAt   string        `json:"created_at"`
	UpdatedAt   string        `json:"updated_at"`
}

// --- KB Handlers ---

// ListKBArticles returns published articles for all users, or all articles for staff.
func ListKBArticles(c *gin.Context) {
	userRole := c.MustGet("userRole").(models.Role)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	query := database.DB.Model(&models.KBArticle{})

	// Employees only see published articles
	if userRole == models.RoleEmployee {
		query = query.Where("is_published = ?", true)
	}

	// Filter by category
	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	// Search by title/content
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

	userRole := c.MustGet("userRole").(models.Role)

	var article models.KBArticle
	if err := database.DB.Preload("Author").First(&article, uint(articleID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	// Employees can only view published articles
	if userRole == models.RoleEmployee && !article.IsPublished {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	// Increment view count
	database.DB.Model(&article).Update("view_count", article.ViewCount+1)
	article.ViewCount++

	c.JSON(http.StatusOK, gin.H{"article": toKBArticleResponse(article)})
}

// CreateKBArticle creates a new KB article. Staff only.
func CreateKBArticle(c *gin.Context) {
	var req CreateKBArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)

	article := models.KBArticle{
		Title:       req.Title,
		Content:     req.Content,
		Category:    req.Category,
		Tags:        req.Tags,
		IsPublished: false, // Draft by default
		AuthorID:    userID,
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

// UpdateKBArticle updates an existing KB article. Staff only.
func UpdateKBArticle(c *gin.Context) {
	articleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid article ID"})
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

	oldValues := map[string]interface{}{
		"title": article.Title, "category": article.Category, "is_published": article.IsPublished,
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
	if req.IsPublished != nil {
		article.IsPublished = *req.IsPublished
	}

	if err := database.DB.Save(&article).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update article"})
		return
	}

	database.DB.Preload("Author").First(&article, article.ID)

	newValues := map[string]interface{}{
		"title": article.Title, "category": article.Category, "is_published": article.IsPublished,
	}

	LogAudit(c, models.AuditActionUpdate, "kb_article", article.ID,
		ToJSON(oldValues), ToJSON(newValues),
		fmt.Sprintf("KB article updated: %s", article.Title))

	c.JSON(http.StatusOK, gin.H{"article": toKBArticleResponse(article)})
}

// DeleteKBArticle soft-deletes a KB article. Staff only.
func DeleteKBArticle(c *gin.Context) {
	articleID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid article ID"})
		return
	}

	var article models.KBArticle
	if err := database.DB.First(&article, uint(articleID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Article not found"})
		return
	}

	database.DB.Delete(&article)

	LogAudit(c, models.AuditActionDelete, "kb_article", article.ID,
		ToJSON(map[string]string{"title": article.Title}),
		"", fmt.Sprintf("KB article deleted: %s", article.Title))

	c.JSON(http.StatusOK, gin.H{"message": "Article deleted"})
}

// GetKBCategories returns a list of unique categories.
func GetKBCategories(c *gin.Context) {
	var categories []string
	database.DB.Model(&models.KBArticle{}).Where("is_published = ?", true).
		Distinct("category").Pluck("category", &categories)

	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

// --- Helpers ---

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

	resp := KBArticleResponse{
		ID:          a.ID,
		Title:       a.Title,
		Content:     a.Content,
		Category:    a.Category,
		Tags:        tags,
		IsPublished: a.IsPublished,
		ViewCount:   a.ViewCount,
		AuthorID:    a.AuthorID,
		CreatedAt:   a.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:   a.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
	if a.Author.ID != 0 {
		ur := toUserResponse(a.Author)
		resp.Author = &ur
	}
	return resp
}
