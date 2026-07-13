package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"
	"dahticket-backend/services"

	"github.com/gin-gonic/gin"
)

// --- Comment DTOs ---

type CreateCommentRequest struct {
	Content    string `json:"content" binding:"required,min=1"`
	IsInternal bool   `json:"is_internal"`
}

type UpdateCommentRequest struct {
	Content string `json:"content" binding:"required,min=1"`
}

type CommentResponse struct {
	ID         uint          `json:"id"`
	Content    string        `json:"content"`
	IsInternal bool          `json:"is_internal"`
	TicketID   uint          `json:"ticket_id"`
	AuthorID   uint          `json:"author_id"`
	Author     *UserResponse `json:"author,omitempty"`
	CreatedAt  string        `json:"created_at"`
	UpdatedAt  string        `json:"updated_at"`
}

// --- Comment Handlers ---

// AddComment adds a comment to a ticket.
func AddComment(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	var req CreateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)
	actor, _ := middleware.GetUser(c)

	// Verify ticket exists
	var ticket models.Ticket
	if err := database.DB.First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	// Employees can only comment on their own tickets
	if userRole == models.RoleEmployee {
		if ticket.RequesterID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "You can only comment on your own tickets"})
			return
		}
		// Employees cannot create internal comments
		if req.IsInternal {
			c.JSON(http.StatusForbidden, gin.H{"error": "Internal comments are only for IT staff"})
			return
		}
	}

	if actor.IsSiteIntakeStaff() && req.IsInternal {
		c.JSON(http.StatusForbidden, gin.H{"error": "Site staff cannot add internal notes"})
		return
	}

	comment := models.Comment{
		Content:    req.Content,
		IsInternal: req.IsInternal,
		TicketID:   uint(ticketID),
		AuthorID:   userID,
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add comment"})
		return
	}

	// Reload with author
	database.DB.Preload("Author").First(&comment, comment.ID)

	commentType := "public"
	if req.IsInternal {
		commentType = "internal"
	}

	LogAudit(c, models.AuditActionComment, "ticket", ticket.ID, "",
		ToJSON(map[string]interface{}{
			"comment_id": comment.ID, "type": commentType, "content_preview": truncate(comment.Content, 100),
		}),
		fmt.Sprintf("Comment added to Ticket #%d (%s)", ticket.ID, commentType))

	// Send email and in-app notification for public comments
	if !req.IsInternal {
		// Notify the requester if someone else commented
		if comment.AuthorID != ticket.RequesterID {
			var requester models.User
			if database.DB.First(&requester, ticket.RequesterID).Error == nil {
				commenterName := comment.Author.FirstName + " " + comment.Author.LastName
				services.NotifyNewComment(ticket.OrganizationID, requester.Email, requester.FirstName, ticket.ID, ticket.Title, commenterName)
				
				CreateInAppNotification(
					ticket.RequesterID, 
					"New Comment", 
					fmt.Sprintf("%s commented on your ticket #%d", commenterName, ticket.ID), 
					"new_comment", 
					fmt.Sprintf("/tickets/%d", ticket.ID),
				)
			}
		}
	}

	c.JSON(http.StatusCreated, gin.H{"comment": toCommentResponse(comment)})
}

// UpdateComment edits a comment. Only the author can edit their own comments.
func UpdateComment(c *gin.Context) {
	commentID, err := strconv.ParseUint(c.Param("commentId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	var req UpdateCommentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)

	var comment models.Comment
	if err := database.DB.First(&comment, uint(commentID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	if comment.AuthorID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only edit your own comments"})
		return
	}

	oldContent := comment.Content
	comment.Content = req.Content

	if err := database.DB.Save(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update comment"})
		return
	}

	database.DB.Preload("Author").First(&comment, comment.ID)

	LogAudit(c, models.AuditActionUpdate, "comment", comment.ID,
		ToJSON(map[string]string{"content": truncate(oldContent, 100)}),
		ToJSON(map[string]string{"content": truncate(req.Content, 100)}),
		fmt.Sprintf("Comment #%d on Ticket #%d updated", comment.ID, comment.TicketID))

	c.JSON(http.StatusOK, gin.H{"comment": toCommentResponse(comment)})
}

// DeleteComment soft-deletes a comment. Author or admins can delete.
func DeleteComment(c *gin.Context) {
	commentID, err := strconv.ParseUint(c.Param("commentId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid comment ID"})
		return
	}

	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	var comment models.Comment
	if err := database.DB.First(&comment, uint(commentID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}

	if comment.AuthorID != userID && userRole != models.RoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own comments"})
		return
	}

	if err := database.DB.Delete(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}

	LogAudit(c, models.AuditActionDelete, "comment", comment.ID,
		ToJSON(map[string]string{"content": truncate(comment.Content, 100)}),
		"", fmt.Sprintf("Comment #%d on Ticket #%d deleted", comment.ID, comment.TicketID))

	c.JSON(http.StatusOK, gin.H{"message": "Comment deleted successfully"})
}

// --- Helpers ---

func toCommentResponse(c models.Comment) CommentResponse {
	resp := CommentResponse{
		ID:         c.ID,
		Content:    c.Content,
		IsInternal: c.IsInternal,
		TicketID:   c.TicketID,
		AuthorID:   c.AuthorID,
		CreatedAt:  c.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:  c.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
	if c.Author.ID != 0 {
		ur := toUserResponse(c.Author)
		resp.Author = &ur
	}
	return resp
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
