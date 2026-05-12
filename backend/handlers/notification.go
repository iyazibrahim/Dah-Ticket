package handlers

import (
	"net/http"
	"strconv"

	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

// ListNotifications returns unread notifications for the current user
func ListNotifications(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var notifications []models.Notification
	if err := database.DB.Where("user_id = ?", userID).Order("created_at DESC").Limit(50).Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch notifications"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"notifications": notifications})
}

// MarkNotificationRead marks a specific notification as read
func MarkNotificationRead(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	notifID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	if err := database.DB.Model(&models.Notification{}).Where("id = ? AND user_id = ?", uint(notifID), userID).Update("is_read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notification as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Marked as read"})
}

// MarkAllNotificationsRead marks all notifications as read for the user
func MarkAllNotificationsRead(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	if err := database.DB.Model(&models.Notification{}).Where("user_id = ?", userID).Update("is_read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "All marked as read"})
}

// Helper to create an in-app notification
func CreateInAppNotification(userID uint, title, message, notifType, link string) {
	notif := models.Notification{
		UserID:  userID,
		Title:   title,
		Message: message,
		Type:    notifType,
		Link:    link,
	}
	// Fire and forget
	go func() {
		database.DB.Create(&notif)
	}()
}
