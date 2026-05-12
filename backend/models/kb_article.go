package models

import (
	"time"

	"gorm.io/gorm"
)

// KBArticle represents a knowledge base article / FAQ entry.
type KBArticle struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Title    string `gorm:"size:255;not null" json:"title"`
	Content  string `gorm:"type:text;not null" json:"content"`
	Category string `gorm:"size:100;not null;index" json:"category"`
	Tags     string `gorm:"size:500" json:"tags"` // Comma-separated tags

	// Publishing
	IsPublished bool `gorm:"default:false" json:"is_published"`
	ViewCount   int  `gorm:"default:0" json:"view_count"`

	// Author (admin or agent who created it)
	AuthorID uint `gorm:"not null;index" json:"author_id"`
	Author   User `gorm:"foreignKey:AuthorID" json:"author,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
