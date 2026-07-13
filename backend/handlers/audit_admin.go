package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

// ExportTicketsCSV exports tickets as CSV for compliance reporting.
func ExportTicketsCSV(c *gin.Context) {
	user, _ := middleware.GetUser(c)
	if !user.IsFullAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Full admin access required"})
		return
	}

	orgID := user.OrganizationID
	if orgID == 0 {
		orgID = middleware.GetOrganizationID(c)
	}

	q := database.DB.Model(&models.Ticket{}).Where("organization_id = ?", orgID)
	applyTicketOrgVisibility(q, user, orgID)

	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	if ticketType := c.Query("type"); ticketType != "" {
		q = q.Where("type = ?", ticketType)
	}
	if category := c.Query("category"); category != "" {
		q = q.Where("category = ?", category)
	}
	if locID := c.Query("location_id"); locID != "" {
		q = q.Where("location_id = ?", locID)
	}

	var tickets []models.Ticket
	q.Preload("Requester").Preload("Assignee").Preload("Location").
		Order("created_at DESC").Limit(10000).Find(&tickets)

	filename := fmt.Sprintf("tickets_export_%s.csv", time.Now().Format("20060102_150405"))
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))

	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{
		"ID", "Title", "Status", "Priority", "Type", "Category", "Location",
		"Requester", "Assignee", "Due Date", "Created At", "Resolved At", "Closed At",
		"Is Escalated",
	})
	for _, t := range tickets {
		locName := ""
		if t.Location != nil {
			locName = t.Location.Name
		}
		reqName := ""
		if t.Requester.ID != 0 {
			reqName = t.Requester.FirstName + " " + t.Requester.LastName
		}
		assigneeName := ""
		if t.Assignee != nil {
			assigneeName = t.Assignee.FirstName + " " + t.Assignee.LastName
		}
		due := ""
		if t.DueDate != nil {
			due = t.DueDate.Format(time.RFC3339)
		}
		resolved := ""
		if t.ResolvedAt != nil {
			resolved = t.ResolvedAt.Format(time.RFC3339)
		}
		closed := ""
		if t.ClosedAt != nil {
			closed = t.ClosedAt.Format(time.RFC3339)
		}
		_ = w.Write([]string{
			strconv.Itoa(int(t.ID)), t.Title, string(t.Status), string(t.Priority),
			string(t.Type), t.Category, locName, reqName, assigneeName,
			due, t.CreatedAt.Format(time.RFC3339), resolved, closed,
			fmt.Sprintf("%v", t.IsEscalated),
		})
	}
	w.Flush()
}

// ListAuditLogs returns system-wide audit logs for admin review.
func ListAuditLogs(c *gin.Context) {
	user, _ := middleware.GetUser(c)
	if !user.IsFullAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Full admin access required"})
		return
	}

	orgID := user.OrganizationID
	if orgID == 0 {
		orgID = middleware.GetOrganizationID(c)
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "50"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 200 {
		perPage = 50
	}

	q := database.DB.Model(&models.AuditLog{}).
		Joins("JOIN users AS audit_users ON audit_users.id = audit_logs.user_id").
		Where("audit_users.organization_id = ?", orgID)

	if entityType := c.Query("entity_type"); entityType != "" {
		q = q.Where("audit_logs.entity_type = ?", entityType)
	}
	if entityID := c.Query("entity_id"); entityID != "" {
		q = q.Where("audit_logs.entity_id = ?", entityID)
	}
	if action := c.Query("action"); action != "" {
		q = q.Where("audit_logs.action = ?", action)
	}
	if userID := c.Query("user_id"); userID != "" {
		q = q.Where("audit_logs.user_id = ?", userID)
	}
	if userSearch := c.Query("user_search"); userSearch != "" {
		q = q.Where(
			"(audit_users.email ILIKE ? OR audit_users.first_name ILIKE ? OR audit_users.last_name ILIKE ?)",
			"%"+userSearch+"%", "%"+userSearch+"%", "%"+userSearch+"%",
		)
	}
	if dateFrom := c.Query("date_from"); dateFrom != "" {
		if t, err := time.Parse("2006-01-02", dateFrom); err == nil {
			q = q.Where("audit_logs.created_at >= ?", t)
		}
	}
	if dateTo := c.Query("date_to"); dateTo != "" {
		if t, err := time.Parse("2006-01-02", dateTo); err == nil {
			q = q.Where("audit_logs.created_at < ?", t.Add(24*time.Hour))
		}
	}
	if search := c.Query("search"); search != "" {
		if id, err := strconv.ParseUint(search, 10, 32); err == nil {
			q = q.Where("(audit_logs.details ILIKE ? OR audit_logs.entity_id = ?)", "%"+search+"%", uint(id))
		} else {
			q = q.Where("audit_logs.details ILIKE ?", "%"+search+"%")
		}
	}

	var total int64
	q.Count(&total)

	var logs []models.AuditLog
	offset := (page - 1) * perPage
	q.Preload("User").Order("created_at DESC").Offset(offset).Limit(perPage).Find(&logs)

	type auditResp struct {
		ID         uint          `json:"id"`
		Action     string        `json:"action"`
		EntityType string        `json:"entity_type"`
		EntityID   uint          `json:"entity_id"`
		UserID     uint          `json:"user_id"`
		User       *UserResponse `json:"user,omitempty"`
		OldValues  string        `json:"old_values,omitempty"`
		NewValues  string        `json:"new_values,omitempty"`
		Details    string        `json:"details,omitempty"`
		IPAddress  string        `json:"ip_address,omitempty"`
		CreatedAt  time.Time     `json:"created_at"`
	}
	out := make([]auditResp, len(logs))
	for i, l := range logs {
		out[i] = auditResp{
			ID: l.ID, Action: string(l.Action), EntityType: l.EntityType,
			EntityID: l.EntityID, UserID: l.UserID,
			OldValues: l.OldValues, NewValues: l.NewValues, Details: l.Details,
			IPAddress: l.IPAddress, CreatedAt: l.CreatedAt,
		}
		if l.User.ID != 0 {
			ur := toUserResponse(l.User)
			out[i].User = &ur
		}
	}

	var availableActions []string
	database.DB.Model(&models.AuditLog{}).
		Joins("JOIN users AS audit_users ON audit_users.id = audit_logs.user_id").
		Where("audit_users.organization_id = ?", orgID).
		Distinct("audit_logs.action").
		Order("audit_logs.action ASC").
		Pluck("audit_logs.action", &availableActions)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}
	if totalPages == 0 {
		totalPages = 1
	}

	c.JSON(http.StatusOK, gin.H{
		"logs":              out,
		"total":             total,
		"page":              page,
		"per_page":          perPage,
		"total_pages":       totalPages,
		"available_actions": availableActions,
	})
}
