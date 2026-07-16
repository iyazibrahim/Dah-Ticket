package models

import (
	"time"

	"gorm.io/gorm"
)

// Notification event keys for per-user preferences.
const (
	NotifyEventTicketCreated       = "ticket_created"
	NotifyEventTicketStatus        = "ticket_status"
	NotifyEventTicketComment       = "ticket_comment"
	NotifyEventTicketAssigned      = "ticket_assigned"
	NotifyEventAssetRequestUpdate  = "asset_request_update"
	NotifyEventAssetLoanDue        = "asset_loan_due"
	NotifyEventAssetLoanReturned   = "asset_loan_returned"
)

// UserNotificationPreference stores per-user channel toggles for a notification event.
type UserNotificationPreference struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	UserID uint `gorm:"not null;uniqueIndex:idx_user_notify_event" json:"user_id"`
	User   User `gorm:"foreignKey:UserID" json:"-"`

	EventKey     string `gorm:"type:varchar(50);not null;uniqueIndex:idx_user_notify_event" json:"event_key"`
	EmailEnabled bool   `gorm:"default:true" json:"email_enabled"`
	InAppEnabled bool   `gorm:"default:true" json:"in_app_enabled"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// DefaultNotificationEventKeys returns all configurable event keys.
func DefaultNotificationEventKeys() []string {
	return []string{
		NotifyEventTicketCreated,
		NotifyEventTicketStatus,
		NotifyEventTicketComment,
		NotifyEventTicketAssigned,
		NotifyEventAssetRequestUpdate,
		NotifyEventAssetLoanDue,
		NotifyEventAssetLoanReturned,
	}
}
