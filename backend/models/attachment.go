package models

import (
	"time"
)

// Attachment represents a file attached to a ticket or comment.
type Attachment struct {
	ID       uint   `gorm:"primaryKey" json:"id"`
	FileName string `gorm:"size:255;not null" json:"file_name"`        // Original filename
	FilePath string `gorm:"size:512;not null" json:"-"`                // Server storage path (not exposed)
	FileSize int64  `gorm:"not null" json:"file_size"`                 // Size in bytes
	MimeType string `gorm:"size:100;not null" json:"mime_type"`        // MIME type
	FileURL  string `gorm:"-" json:"file_url"`                         // Computed download URL (not stored)

	// Who uploaded this
	UploaderID uint `gorm:"not null;index" json:"uploader_id"`
	Uploader   User `gorm:"foreignKey:UploaderID" json:"uploader,omitempty"`

	// What it's attached to
	TicketID  *uint `gorm:"index" json:"ticket_id,omitempty"`
	CommentID *uint `gorm:"index" json:"comment_id,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}
