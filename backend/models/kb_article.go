package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	KBApprovalDraft           = "draft"
	KBApprovalPendingApproval = "pending_approval"
	KBApprovalPublished       = "published"
	KBApprovalRejected        = "rejected"
)

// KBArticle represents a knowledge base article / FAQ entry.
type KBArticle struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	Title    string `gorm:"size:255;not null" json:"title"`
	Content  string `gorm:"type:text;not null" json:"content"`
	Category string `gorm:"size:100;not null;index" json:"category"`
	Tags     string `gorm:"size:500" json:"tags"`

	IsPublished    bool   `gorm:"default:false" json:"is_published"`
	ApprovalStatus string `gorm:"type:varchar(30);default:'draft';index" json:"approval_status"`
	ViewCount      int    `gorm:"default:0" json:"view_count"`

	OrganizationID uint `gorm:"not null;index;default:1" json:"organization_id"`

	AuthorID uint `gorm:"not null;index" json:"author_id"`
	Author   User `gorm:"foreignKey:AuthorID" json:"author,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
