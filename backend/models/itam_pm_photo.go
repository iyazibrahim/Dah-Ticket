package models

import (
	"time"

	"gorm.io/gorm"
)

type PMFindingPhoto struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	FindingID uint           `gorm:"not null;index" json:"finding_id"`
	FilePath  string         `gorm:"type:varchar(500);not null" json:"file_path"`
	Caption   string         `gorm:"type:varchar(255)" json:"caption"`
	SortOrder int            `gorm:"default:0" json:"sort_order"`
	CreatedBy uint           `json:"created_by"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
