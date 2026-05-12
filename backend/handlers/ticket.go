package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/models"
	"dahticket-backend/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- Ticket DTOs ---

type CreateTicketRequest struct {
	Title       string `json:"title" binding:"required,min=5,max=255"`
	Description string `json:"description" binding:"required,min=10"`
	Priority    string `json:"priority" binding:"omitempty,oneof=low medium high critical"`
	Type        string `json:"type" binding:"omitempty,oneof=incident service_request problem change"`
	Category    string `json:"category" binding:"omitempty,max=50"`
}

type UpdateTicketRequest struct {
	Title       *string `json:"title" binding:"omitempty,min=5,max=255"`
	Description *string `json:"description" binding:"omitempty,min=10"`
	Status      *string `json:"status" binding:"omitempty,oneof=open in_progress on_hold resolved closed"`
	Priority    *string `json:"priority" binding:"omitempty,oneof=low medium high critical"`
	Type        *string `json:"type" binding:"omitempty,oneof=incident service_request problem change"`
	Category    *string `json:"category" binding:"omitempty,max=50"`
	AssigneeID  *uint   `json:"assignee_id"`
}

type TicketResponse struct {
	ID          uint                  `json:"id"`
	Title       string                `json:"title"`
	Description string                `json:"description"`
	Status      models.TicketStatus   `json:"status"`
	Priority    models.TicketPriority `json:"priority"`
	Type        models.TicketType     `json:"type"`
	Category    string                `json:"category"`
	RequesterID uint                  `json:"requester_id"`
	Requester   *UserResponse         `json:"requester,omitempty"`
	AssigneeID  *uint                 `json:"assignee_id"`
	Assignee    *UserResponse         `json:"assignee,omitempty"`
	DueDate     *time.Time            `json:"due_date,omitempty"`
	ResolvedAt  *time.Time            `json:"resolved_at,omitempty"`
	Comments    []CommentResponse     `json:"comments,omitempty"`
	CreatedAt   time.Time             `json:"created_at"`
	UpdatedAt   time.Time             `json:"updated_at"`
}

type PaginatedTicketsResponse struct {
	Tickets    []TicketResponse `json:"tickets"`
	Total      int64            `json:"total"`
	Page       int              `json:"page"`
	PerPage    int              `json:"per_page"`
	TotalPages int              `json:"total_pages"`
}

// --- Ticket Handlers ---

// CreateTicket creates a new support ticket.
func CreateTicket(c *gin.Context) {
	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)

	priority := models.PriorityLow
	if req.Priority != "" {
		priority = models.TicketPriority(req.Priority)
	}

	ticketType := models.TypeIncident
	if req.Type != "" {
		ticketType = models.TicketType(req.Type)
	}

	category := "hardware"
	if req.Category != "" {
		category = req.Category
	}

	// Auto-set SLA due date based on priority
	dueDate := config.GetSLADueDate(string(priority), time.Now())

	ticket := models.Ticket{
		Title:       req.Title,
		Description: req.Description,
		Status:      models.StatusOpen,
		Priority:    priority,
		Type:        ticketType,
		Category:    category,
		RequesterID: userID,
		DueDate:     &dueDate,
	}

	if err := database.DB.Create(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ticket"})
		return
	}

	// Reload with associations
	database.DB.Preload("Requester").Preload("Assignee").First(&ticket, ticket.ID)

	LogAudit(c, models.AuditActionCreate, "ticket", ticket.ID, "",
		ToJSON(map[string]interface{}{
			"title": ticket.Title, "priority": ticket.Priority, "status": ticket.Status,
		}),
		fmt.Sprintf("Ticket #%d created: %s", ticket.ID, ticket.Title))

	// Send email notification to requester
	services.NotifyTicketCreated(
		ticket.Requester.Email,
		ticket.Requester.FirstName,
		ticket.ID, ticket.Title)

	c.JSON(http.StatusCreated, gin.H{"ticket": toTicketResponse(ticket)})
}

// ListTickets returns paginated, filterable tickets based on user role.
func ListTickets(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	query := database.DB.Model(&models.Ticket{})

	// Role-based filtering: employees only see their own tickets
	if userRole == models.RoleEmployee {
		query = query.Where("requester_id = ?", userID)
	}

	// Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Filter by priority
	if priority := c.Query("priority"); priority != "" {
		query = query.Where("priority = ?", priority)
	}

	// Filter by assignee
	if assigneeID := c.Query("assignee_id"); assigneeID != "" {
		if id, err := strconv.ParseUint(assigneeID, 10, 32); err == nil {
			query = query.Where("assignee_id = ?", uint(id))
		}
	}

	// Filter unassigned
	if c.Query("unassigned") == "true" {
		query = query.Where("assignee_id IS NULL")
	}

	// Search by title
	if search := c.Query("search"); search != "" {
		query = query.Where("title ILIKE ?", "%"+search+"%")
	}

	// Get total count
	var total int64
	query.Count(&total)

	// Fetch with pagination and associations
	var tickets []models.Ticket
	offset := (page - 1) * perPage

	query.Preload("Requester").Preload("Assignee").
		Order("created_at DESC").
		Offset(offset).Limit(perPage).
		Find(&tickets)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	ticketResponses := make([]TicketResponse, len(tickets))
	for i, t := range tickets {
		ticketResponses[i] = toTicketResponse(t)
	}

	c.JSON(http.StatusOK, PaginatedTicketsResponse{
		Tickets:    ticketResponses,
		Total:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: totalPages,
	})
}

// GetTicket returns a single ticket with its comments.
func GetTicket(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	var ticket models.Ticket
	query := database.DB.Preload("Requester").Preload("Assignee").
		Preload("Comments", func(db *gorm.DB) *gorm.DB {
			// Employees cannot see internal comments
			if userRole == models.RoleEmployee {
				return db.Where("is_internal = ?", false).Order("created_at ASC")
			}
			return db.Order("created_at ASC")
		}).
		Preload("Comments.Author")

	if err := query.First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	// Employees can only view their own tickets
	if userRole == models.RoleEmployee && ticket.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only view your own tickets"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ticket": toTicketResponse(ticket)})
}

// UpdateTicket updates a ticket. Agents/admins can update any field;
// employees can only update title/description of their own open tickets.
func UpdateTicket(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	var req UpdateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	var ticket models.Ticket
	if err := database.DB.Preload("Requester").Preload("Assignee").First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	// Snapshot old values for audit
	oldValues := map[string]interface{}{
		"title": ticket.Title, "description": ticket.Description,
		"status": ticket.Status, "priority": ticket.Priority,
		"type": ticket.Type, "category": ticket.Category,
		"assignee_id": ticket.AssigneeID,
	}

	// Permission checks for employees
	if userRole == models.RoleEmployee {
		if ticket.RequesterID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only edit your own tickets"})
			return
		}
		// Employees cannot change priority or assignment
		if req.Priority != nil || req.AssigneeID != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "You cannot change priority or assignment"})
			return
		}
		// Employees can only edit title/description of open tickets, but they can update status anytime
		if ticket.Status != models.StatusOpen && (req.Title != nil || req.Description != nil) {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only edit details of open tickets"})
			return
		}
	}

	// Apply updates
	changes := []string{}

	if req.Title != nil {
		changes = append(changes, fmt.Sprintf("title: '%s' → '%s'", ticket.Title, *req.Title))
		ticket.Title = *req.Title
	}
	if req.Description != nil {
		changes = append(changes, "description updated")
		ticket.Description = *req.Description
	}
	if req.Priority != nil {
		changes = append(changes, fmt.Sprintf("priority: %s → %s", ticket.Priority, *req.Priority))
		ticket.Priority = models.TicketPriority(*req.Priority)
		// Recalculate SLA due date based on new priority
		newDue := config.GetSLADueDate(*req.Priority, ticket.CreatedAt)
		ticket.DueDate = &newDue
	}
	if req.Type != nil {
		changes = append(changes, fmt.Sprintf("type: %s → %s", ticket.Type, *req.Type))
		ticket.Type = models.TicketType(*req.Type)
	}
	if req.Category != nil {
		changes = append(changes, fmt.Sprintf("category: %s → %s", ticket.Category, *req.Category))
		ticket.Category = *req.Category
	}
	if req.Status != nil {
		oldStatus := ticket.Status
		newStatus := models.TicketStatus(*req.Status)
		changes = append(changes, fmt.Sprintf("status: %s → %s", oldStatus, newStatus))
		ticket.Status = newStatus

		// Track resolution time
		if newStatus == models.StatusResolved && oldStatus != models.StatusResolved {
			now := time.Now()
			ticket.ResolvedAt = &now
		} else if newStatus != models.StatusResolved {
			ticket.ResolvedAt = nil
		}
	}
	if req.AssigneeID != nil {
		if *req.AssigneeID == 0 {
			changes = append(changes, "unassigned")
			ticket.AssigneeID = nil
			ticket.Assignee = nil
		} else {
			// Verify assignee exists and is an agent or admin
			var assignee models.User
			if err := database.DB.First(&assignee, *req.AssigneeID).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Assignee not found"})
				return
			}
			if assignee.Role == models.RoleEmployee {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Tickets can only be assigned to IT Agents or Admins"})
				return
			}
			changes = append(changes, fmt.Sprintf("assigned to: %s %s", assignee.FirstName, assignee.LastName))
			ticket.AssigneeID = req.AssigneeID
		}
	}

	if err := database.DB.Save(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ticket"})
		return
	}

	// Reload associations
	database.DB.Preload("Requester").Preload("Assignee").First(&ticket, ticket.ID)

	newValues := map[string]interface{}{
		"title": ticket.Title, "description": ticket.Description,
		"status": ticket.Status, "priority": ticket.Priority,
		"type": ticket.Type, "category": ticket.Category,
		"assignee_id": ticket.AssigneeID,
	}

	// Determine audit action
	action := models.AuditActionUpdate
	if req.Status != nil {
		action = models.AuditActionStatusChange
	}
	if req.AssigneeID != nil {
		action = models.AuditActionAssign
	}

	LogAudit(c, action, "ticket", ticket.ID,
		ToJSON(oldValues), ToJSON(newValues),
		fmt.Sprintf("Ticket #%d updated: %s", ticket.ID, joinChanges(changes)))

	// Send email notifications based on what changed
	if req.Status != nil {
		oldStatus := oldValues["status"].(models.TicketStatus)
		services.NotifyTicketStatusChanged(
			ticket.Requester.Email, ticket.Requester.FirstName,
			ticket.ID, ticket.Title, string(oldStatus), string(ticket.Status))

		CreateInAppNotification(
			ticket.RequesterID,
			"Ticket Status Updated",
			fmt.Sprintf("Your ticket #%d status changed to %s", ticket.ID, ticket.Status),
			"ticket_status",
			fmt.Sprintf("/tickets/%d", ticket.ID),
		)
	}
	if req.AssigneeID != nil && *req.AssigneeID != 0 && ticket.Assignee != nil {
		services.NotifyTicketAssigned(
			ticket.Assignee.Email, ticket.Assignee.FirstName,
			ticket.ID, ticket.Title)

		CreateInAppNotification(
			*req.AssigneeID,
			"Ticket Assigned",
			fmt.Sprintf("You have been assigned to ticket #%d", ticket.ID),
			"ticket_assigned",
			fmt.Sprintf("/tickets/%d", ticket.ID),
		)
	}

	c.JSON(http.StatusOK, gin.H{"ticket": toTicketResponse(ticket)})
}

// GetTicketAuditLogs returns the audit history of a ticket.
func GetTicketAuditLogs(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	// Make sure user has access to this ticket
	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	var ticket models.Ticket
	if err := database.DB.First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	if userRole == models.RoleEmployee && ticket.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only view logs for your own tickets"})
		return
	}

	// Find audit logs where entity_type='ticket' and entity_id=ticketID
	// OR entity_type='comment' and entity_id IN (comments of this ticket)
	// (Note: finding comment logs could be complex if we just query entity_id.
	// Since we log comment creations against the ticket in AddComment (see comment.go), we can just fetch ticket logs!)
	var logs []models.AuditLog
	database.DB.Preload("User").
		Where("entity_type = ? AND entity_id = ?", "ticket", uint(ticketID)).
		Order("created_at DESC").
		Find(&logs)

	// Let's also grab comment updates/deletes if any, by getting comment IDs
	var commentIDs []uint
	database.DB.Model(&models.Comment{}).Where("ticket_id = ?", ticketID).Pluck("id", &commentIDs)

	if len(commentIDs) > 0 {
		var commentLogs []models.AuditLog
		database.DB.Preload("User").
			Where("entity_type = ? AND entity_id IN ?", "comment", commentIDs).
			Find(&commentLogs)
		logs = append(logs, commentLogs...)
	}

	// Sort logs combined
	// Because we fetched them separately, we should really just sort them in the frontend or here.
	// For simplicity, we'll return them, frontend can sort them by created_at.

	// Map to response format
	type AuditLogResponse struct {
		ID        uint               `json:"id"`
		Action    models.AuditAction `json:"action"`
		Entity    string             `json:"entity"`
		UserID    uint               `json:"user_id"`
		UserName  string             `json:"user_name"`
		OldValues string             `json:"old_values,omitempty"`
		NewValues string             `json:"new_values,omitempty"`
		Details   string             `json:"details"`
		CreatedAt time.Time          `json:"created_at"`
	}

	responses := make([]AuditLogResponse, len(logs))
	for i, l := range logs {
		userName := "System"
		if l.User.ID != 0 {
			userName = l.User.FirstName + " " + l.User.LastName
		}
		responses[i] = AuditLogResponse{
			ID:        l.ID,
			Action:    l.Action,
			Entity:    l.EntityType,
			UserID:    l.UserID,
			UserName:  userName,
			OldValues: l.OldValues,
			NewValues: l.NewValues,
			Details:   l.Details,
			CreatedAt: l.CreatedAt,
		}
	}

	c.JSON(http.StatusOK, gin.H{"logs": responses})
}

// DeleteTicket soft-deletes a ticket. Employees can delete their own open tickets.
// Agents/Admins can delete any ticket.
func DeleteTicket(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	var ticket models.Ticket
	if err := database.DB.First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	// Permission check
	if userRole == models.RoleEmployee {
		if ticket.RequesterID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own tickets"})
			return
		}
		if ticket.Status != models.StatusOpen {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete open tickets"})
			return
		}
	}

	// Soft delete
	if err := database.DB.Delete(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete ticket"})
		return
	}

	LogAudit(c, models.AuditActionDelete, "ticket", ticket.ID,
		ToJSON(map[string]interface{}{"title": ticket.Title, "status": ticket.Status}),
		"", fmt.Sprintf("Ticket #%d deleted: %s", ticket.ID, ticket.Title))

	c.JSON(http.StatusOK, gin.H{"message": "Ticket deleted successfully"})
}

// GetTicketStats returns summary counts for the dashboard.
func GetTicketStats(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	type StatResult struct {
		Status string
		Count  int64
	}

	query := database.DB.Model(&models.Ticket{})
	if userRole == models.RoleEmployee {
		query = query.Where("requester_id = ?", userID)
	}

	var results []StatResult
	query.Select("LOWER(status) as status, count(*) as count").Group("LOWER(status)").Find(&results)

	stats := map[string]int64{
		"open": 0, "in_progress": 0, "on_hold": 0, "resolved": 0, "closed": 0,
	}
	var total int64
	for _, r := range results {
		stats[r.Status] = r.Count
		total += r.Count
	}
	stats["total"] = total

	// Unassigned count
	unassignedQuery := database.DB.Model(&models.Ticket{}).Where("assignee_id IS NULL AND LOWER(status) NOT IN ?", []string{"resolved", "closed"})
	if userRole == models.RoleEmployee {
		unassignedQuery = unassignedQuery.Where("requester_id = ?", userID)
	}
	var unassigned int64
	unassignedQuery.Count(&unassigned)
	stats["unassigned"] = unassigned

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

// GetPersonalTicketStats returns current-month personal stats for dashboard personalization.
func GetPersonalTicketStats(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	nextMonthStart := monthStart.AddDate(0, 1, 0)

	type PersonalStats struct {
		Month              int   `json:"month"`
		Year               int   `json:"year"`
		AcceptedThisMonth  int64 `json:"accepted_this_month"`
		ResolvedThisMonth  int64 `json:"resolved_this_month"`
		CurrentlyAssigned  int64 `json:"currently_assigned"`
		RequestedThisMonth int64 `json:"requested_this_month"`
		ClosedThisMonth    int64 `json:"closed_this_month"`
	}

	stats := PersonalStats{
		Month: int(now.Month()),
		Year:  now.Year(),
	}

	if userRole == models.RoleAdmin || userRole == models.RoleITAgent {
		// "Accepted" is modeled as assignment actions performed by the current staff member this month.
		database.DB.Model(&models.AuditLog{}).
			Where("user_id = ? AND entity_type = ? AND action = ? AND created_at >= ? AND created_at < ?", userID, "ticket", models.AuditActionAssign, monthStart, nextMonthStart).
			Count(&stats.AcceptedThisMonth)

		database.DB.Model(&models.Ticket{}).
			Where("assignee_id = ?", userID).
			Where("(resolved_at IS NOT NULL AND resolved_at >= ? AND resolved_at < ?) OR (LOWER(status) IN ? AND updated_at >= ? AND updated_at < ?)", monthStart, nextMonthStart, []string{"resolved", "closed"}, monthStart, nextMonthStart).
			Distinct("id").
			Count(&stats.ResolvedThisMonth)

		database.DB.Model(&models.Ticket{}).
			Where("assignee_id = ? AND LOWER(status) IN ?", userID, []string{"open", "in_progress", "on_hold"}).
			Count(&stats.CurrentlyAssigned)
	} else {
		database.DB.Model(&models.Ticket{}).
			Where("requester_id = ? AND created_at >= ? AND created_at < ?", userID, monthStart, nextMonthStart).
			Count(&stats.RequestedThisMonth)

		database.DB.Model(&models.Ticket{}).
			Where("requester_id = ?", userID).
			Where("(resolved_at IS NOT NULL AND resolved_at >= ? AND resolved_at < ?) OR (LOWER(status) IN ? AND updated_at >= ? AND updated_at < ?)", monthStart, nextMonthStart, []string{"resolved", "closed"}, monthStart, nextMonthStart).
			Distinct("id").
			Count(&stats.ClosedThisMonth)
	}

	c.JSON(http.StatusOK, gin.H{"stats": stats})
}

// --- Helpers ---

func toTicketResponse(t models.Ticket) TicketResponse {
	resp := TicketResponse{
		ID:          t.ID,
		Title:       t.Title,
		Description: t.Description,
		Status:      t.Status,
		Priority:    t.Priority,
		Type:        t.Type,
		Category:    t.Category,
		RequesterID: t.RequesterID,
		AssigneeID:  t.AssigneeID,
		DueDate:     t.DueDate,
		ResolvedAt:  t.ResolvedAt,
		CreatedAt:   t.CreatedAt,
		UpdatedAt:   t.UpdatedAt,
	}

	if t.Requester.ID != 0 {
		ur := toUserResponse(t.Requester)
		resp.Requester = &ur
	}
	if t.Assignee != nil && t.Assignee.ID != 0 {
		ur := toUserResponse(*t.Assignee)
		resp.Assignee = &ur
	}

	if len(t.Comments) > 0 {
		resp.Comments = make([]CommentResponse, len(t.Comments))
		for i, c := range t.Comments {
			resp.Comments[i] = toCommentResponse(c)
		}
	}

	return resp
}

func joinChanges(changes []string) string {
	if len(changes) == 0 {
		return "no changes"
	}
	result := changes[0]
	for _, ch := range changes[1:] {
		result += ", " + ch
	}
	return result
}
