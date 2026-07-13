package services

import (
	"dahticket-backend/database"
	"dahticket-backend/models"
)

// CreateInAppNotification persists a user notification (fire-and-forget).
func CreateInAppNotification(userID uint, title, message, notifType, link string) {
	notif := models.Notification{
		UserID:  userID,
		Title:   title,
		Message: message,
		Type:    notifType,
		Link:    link,
	}
	go func() {
		database.DB.Create(&notif)
	}()
}
