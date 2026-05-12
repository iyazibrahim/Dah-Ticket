package models

import (
	"time"

	"gorm.io/gorm"
)

type Comment struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Content   string `gorm:"type:text;not null" json:"content"`
	IsInternal bool  `gorm:"default:false" json:"is_internal"` // True if only visible to IT Agents/Admins

	// Foreign Keys
	TicketID uint   `json:"ticket_id"`
	AuthorID uint   `json:"author_id"`
	Author   User   `gorm:"foreignKey:AuthorID" json:"author"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
