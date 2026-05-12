package models

import (
	"time"
)

// AuditAction defines the type of action being logged.
type AuditAction string

const (
	AuditActionCreate       AuditAction = "create"
	AuditActionUpdate       AuditAction = "update"
	AuditActionDelete       AuditAction = "delete"
	AuditActionStatusChange AuditAction = "status_change"
	AuditActionAssign       AuditAction = "assign"
	AuditActionComment      AuditAction = "comment"
	AuditActionLogin        AuditAction = "login"
	AuditActionRegister     AuditAction = "register"
)

// AuditLog tracks all changes to tickets and important user actions.
// This prevents users from lying about actions they performed.
type AuditLog struct {
	ID        uint        `gorm:"primaryKey" json:"id"`
	Action    AuditAction `gorm:"type:varchar(30);not null;index" json:"action"`
	EntityType string     `gorm:"type:varchar(30);not null;index" json:"entity_type"` // "ticket", "comment", "user"
	EntityID  uint        `gorm:"not null;index" json:"entity_id"`

	// Who performed this action
	UserID    uint   `gorm:"not null;index" json:"user_id"`
	User      User   `gorm:"foreignKey:UserID" json:"user"`

	// What changed — JSON snapshot of old and new values
	OldValues string `gorm:"type:text" json:"old_values,omitempty"`
	NewValues string `gorm:"type:text" json:"new_values,omitempty"`
	Details   string `gorm:"type:text" json:"details,omitempty"` // Human-readable summary

	// Request metadata for forensics
	IPAddress string `gorm:"size:45" json:"ip_address,omitempty"`
	UserAgent string `gorm:"size:512" json:"user_agent,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}
