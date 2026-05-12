package models

import "time"

type Notification struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"index;not null" json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"-"`
	Title     string    `gorm:"not null" json:"title"`
	Message   string    `gorm:"not null" json:"message"`
	Type      string    `gorm:"not null" json:"type"` // e.g. "ticket_assigned", "ticket_status", "new_comment"
	IsRead    bool      `gorm:"default:false" json:"is_read"`
	Link      string    `json:"link"` // Optional frontend link to redirect to (e.g. "/tickets/1")
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
