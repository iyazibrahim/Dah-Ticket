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
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

const (
	maxUploadSize   = 10 << 20 // 10 MB
	uploadDirectory = "./uploads"
)

// Allowed MIME types for upload
var allowedMimeTypes = map[string]bool{
	"image/jpeg":                                                                 true,
	"image/png":                                                                  true,
	"image/gif":                                                                  true,
	"image/webp":                                                                 true,
	"application/pdf":                                                            true,
	"application/msword":                                                         true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":     true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":           true,
	"application/vnd.openxmlformats-officedocument.presentationml.presentation":   true,
	"text/plain":                                                                  true,
	"text/csv":                                                                    true,
	"application/zip":                                                             true,
	"application/x-7z-compressed":                                                 true,
}

// UploadAttachment handles file upload for a ticket.
func UploadAttachment(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	// Verify ticket exists and user has access
	var ticket models.Ticket
	if err := database.DB.First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	if userRole == models.RoleEmployee && ticket.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only upload to your own tickets"})
		return
	}

	// Parse multipart form
	if err := c.Request.ParseMultipartForm(maxUploadSize); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 10MB)"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > maxUploadSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 10MB)"})
		return
	}

	// Validate MIME type
	mimeType := header.Header.Get("Content-Type")
	if !allowedMimeTypes[mimeType] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File type not allowed"})
		return
	}

	// Create upload directory structure: uploads/tickets/{ticket_id}/
	ticketDir := filepath.Join(uploadDirectory, "tickets", fmt.Sprintf("%d", ticketID))
	if err := os.MkdirAll(ticketDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory"})
		return
	}

	// Generate unique filename to prevent collisions
	ext := filepath.Ext(header.Filename)
	safeFilename := fmt.Sprintf("%d_%d%s", time.Now().UnixNano(), userID, ext)
	filePath := filepath.Join(ticketDir, safeFilename)

	// Save file to disk
	if err := c.SaveUploadedFile(header, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Create attachment record
	tID := uint(ticketID)
	attachment := models.Attachment{
		FileName:   header.Filename,
		FilePath:   filePath,
		FileSize:   header.Size,
		MimeType:   mimeType,
		UploaderID: userID,
		TicketID:   &tID,
	}

	if commentIDStr := c.PostForm("comment_id"); commentIDStr != "" {
		if cid, err := strconv.ParseUint(commentIDStr, 10, 32); err == nil {
			var comment models.Comment
			if err := database.DB.Where("id = ? AND ticket_id = ?", uint(cid), uint(ticketID)).First(&comment).Error; err == nil {
				cidUint := uint(cid)
				attachment.CommentID = &cidUint
			}
		}
	}

	if err := database.DB.Create(&attachment).Error; err != nil {
		// Clean up file on DB failure
		os.Remove(filePath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save attachment record"})
		return
	}

	// Set the download URL
	attachment.FileURL = fmt.Sprintf("/api/tickets/%d/attachments/%d/download", ticketID, attachment.ID)

	LogAudit(c, models.AuditActionCreate, "attachment", attachment.ID, "",
		ToJSON(map[string]interface{}{"file_name": attachment.FileName, "file_size": attachment.FileSize, "ticket_id": ticketID}),
		fmt.Sprintf("File uploaded to Ticket #%d: %s", ticketID, attachment.FileName))

	c.JSON(http.StatusCreated, gin.H{"attachment": attachment})
}

// ListAttachments returns all attachments for a ticket.
func ListAttachments(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	// Verify ticket exists and user has access
	var ticket models.Ticket
	if err := database.DB.First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	if userRole == models.RoleEmployee && ticket.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only view your own tickets"})
		return
	}

	var attachments []models.Attachment
	database.DB.Where("ticket_id = ?", uint(ticketID)).Preload("Uploader").Order("created_at ASC").Find(&attachments)

	// Set download URLs
	for i := range attachments {
		attachments[i].FileURL = fmt.Sprintf("/api/tickets/%d/attachments/%d/download", ticketID, attachments[i].ID)
	}

	c.JSON(http.StatusOK, gin.H{"attachments": attachments})
}

// DownloadAttachment serves a file for download.
func DownloadAttachment(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	attachmentID, err := strconv.ParseUint(c.Param("attachmentId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attachment ID"})
		return
	}

	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	// Verify ticket access
	var ticket models.Ticket
	if err := database.DB.First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	if userRole == models.RoleEmployee && ticket.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var attachment models.Attachment
	if err := database.DB.Where("id = ? AND ticket_id = ?", uint(attachmentID), uint(ticketID)).First(&attachment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attachment not found"})
		return
	}

	// Security: prevent path traversal
	cleanPath := filepath.Clean(attachment.FilePath)
	if !strings.HasPrefix(cleanPath, filepath.Clean(uploadDirectory)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", attachment.FileName))
	c.File(attachment.FilePath)
}

// DeleteAttachment removes an attachment. Uploader or admin can delete.
func DeleteAttachment(c *gin.Context) {
	attachmentID, err := strconv.ParseUint(c.Param("attachmentId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attachment ID"})
		return
	}

	userID := c.MustGet("userID").(uint)
	userRole := c.MustGet("userRole").(models.Role)

	var attachment models.Attachment
	if err := database.DB.First(&attachment, uint(attachmentID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attachment not found"})
		return
	}

	if attachment.UploaderID != userID && userRole != models.RoleAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own attachments"})
		return
	}

	// Delete file from disk
	os.Remove(attachment.FilePath)

	// Delete DB record
	database.DB.Delete(&attachment)

	LogAudit(c, models.AuditActionDelete, "attachment", attachment.ID,
		ToJSON(map[string]interface{}{"file_name": attachment.FileName}),
		"", fmt.Sprintf("Attachment deleted: %s", attachment.FileName))

	c.JSON(http.StatusOK, gin.H{"message": "Attachment deleted"})
}
