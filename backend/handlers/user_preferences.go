package handlers

import (
	"net/http"

	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

type notificationPrefItem struct {
	EventKey     string `json:"event_key"`
	Label        string `json:"label"`
	Description  string `json:"description"`
	EmailEnabled bool   `json:"email_enabled"`
	InAppEnabled bool   `json:"in_app_enabled"`
}

var notificationPrefMeta = map[string][2]string{
	models.NotifyEventTicketCreated:      {"Ticket created", "Confirmation when you submit a ticket"},
	models.NotifyEventTicketStatus:       {"Ticket status changes", "When your ticket status is updated"},
	models.NotifyEventTicketComment:      {"New comments", "When someone comments on your ticket"},
	models.NotifyEventTicketAssigned:     {"Ticket assigned", "When a ticket is assigned to you (staff)"},
	models.NotifyEventAssetRequestUpdate: {"Asset request updates", "Approvals, rejections, and checkout updates"},
	models.NotifyEventAssetLoanDue:       {"Loan due reminders", "When a borrowed asset is due soon or overdue"},
	models.NotifyEventAssetLoanReturned:  {"Loan returned", "When staff confirms your asset return"},
}

type updateNotificationPrefsPayload struct {
	Preferences []struct {
		EventKey     string `json:"event_key" binding:"required"`
		EmailEnabled *bool  `json:"email_enabled"`
		InAppEnabled *bool  `json:"in_app_enabled"`
	} `json:"preferences" binding:"required"`
}

// GetMyNotificationPreferences returns effective prefs (defaults to enabled).
func GetMyNotificationPreferences(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	var stored []models.UserNotificationPreference
	database.DB.Where("user_id = ?", userID).Find(&stored)
	byKey := map[string]models.UserNotificationPreference{}
	for _, p := range stored {
		byKey[p.EventKey] = p
	}

	items := make([]notificationPrefItem, 0, len(models.DefaultNotificationEventKeys()))
	for _, key := range models.DefaultNotificationEventKeys() {
		meta := notificationPrefMeta[key]
		emailOn, inAppOn := true, true
		if p, ok := byKey[key]; ok {
			emailOn = p.EmailEnabled
			inAppOn = p.InAppEnabled
		}
		items = append(items, notificationPrefItem{
			EventKey:     key,
			Label:        meta[0],
			Description:  meta[1],
			EmailEnabled: emailOn,
			InAppEnabled: inAppOn,
		})
	}

	c.JSON(http.StatusOK, gin.H{"preferences": items})
}

// UpdateMyNotificationPreferences upserts user notification prefs.
func UpdateMyNotificationPreferences(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	var payload updateNotificationPrefsPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	valid := map[string]bool{}
	for _, k := range models.DefaultNotificationEventKeys() {
		valid[k] = true
	}

	for _, item := range payload.Preferences {
		if !valid[item.EventKey] {
			continue
		}
		var pref models.UserNotificationPreference
		err := database.DB.Where("user_id = ? AND event_key = ?", userID, item.EventKey).First(&pref).Error
		if err != nil {
			pref = models.UserNotificationPreference{
				UserID:       userID,
				EventKey:     item.EventKey,
				EmailEnabled: true,
				InAppEnabled: true,
			}
		}
		if item.EmailEnabled != nil {
			pref.EmailEnabled = *item.EmailEnabled
		}
		if item.InAppEnabled != nil {
			pref.InAppEnabled = *item.InAppEnabled
		}
		if pref.ID == 0 {
			database.DB.Create(&pref)
		} else {
			database.DB.Save(&pref)
		}
	}

	GetMyNotificationPreferences(c)
}
