package models

import (
	"time"

	"gorm.io/gorm"
)

type AssetCategory struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"type:varchar(100);not null;unique" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type AssetType struct {
	ID                   uint           `gorm:"primaryKey" json:"id"`
	CategoryID           uint           `gorm:"not null" json:"category_id"`
	Category             AssetCategory  `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Name                 string         `gorm:"type:varchar(100);not null" json:"name"`
	RequiresSerialNumber bool           `gorm:"default:true" json:"requires_serial_number"`
	IsActive             bool           `gorm:"default:true" json:"is_active"`
	CreatedAt            time.Time      `json:"created_at"`
	UpdatedAt            time.Time      `json:"updated_at"`
	DeletedAt            gorm.DeletedAt `gorm:"index" json:"-"`
}

type AssetStatus struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"type:varchar(50);not null;unique" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type AssetCondition struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"type:varchar(50);not null;unique" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	IsActive    bool           `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type Location struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"type:varchar(100);not null;unique" json:"name"`
	Address   string         `gorm:"type:text" json:"address"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type Vendor struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"type:varchar(100);not null;unique" json:"name"`
	ContactName  string         `gorm:"type:varchar(100)" json:"contact_name"`
	ContactEmail string         `gorm:"type:varchar(100)" json:"contact_email"`
	ContactPhone string         `gorm:"type:varchar(50)" json:"contact_phone"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}
