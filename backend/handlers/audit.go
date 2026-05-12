package handlers

import (
	"encoding/json"

	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

// LogAudit creates an audit log entry. Exported so all handlers can use it.
// Uses the authenticated user from context if available,
// otherwise uses the provided userID (e.g. for registration).
func LogAudit(c *gin.Context, action models.AuditAction, entityType string, entityID uint, oldValues, newValues, details string) {
	var userID uint

	// Try to get user from context (set by auth middleware)
	if id, exists := c.Get("userID"); exists {
		userID = id.(uint)
	} else {
		userID = entityID // For registration, the entity IS the user
	}

	audit := models.AuditLog{
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		UserID:     userID,
		OldValues:  oldValues,
		NewValues:  newValues,
		Details:    details,
		IPAddress:  c.ClientIP(),
		UserAgent:  c.GetHeader("User-Agent"),
	}

	// Fire and forget — don't block the response for audit logging
	go func() {
		database.DB.Create(&audit)
	}()
}

// ToJSON marshals a value to a JSON string for audit log storage.
func ToJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
