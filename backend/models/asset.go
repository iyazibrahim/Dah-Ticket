package models

import (
	"time"

	"gorm.io/gorm"
)

type Asset struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	AssetTag       string         `gorm:"type:varchar(50);uniqueIndex" json:"asset_tag"`
	SerialNumber   string         `gorm:"type:varchar(100)" json:"serial_number"`
	Name           string         `gorm:"type:varchar(200);not null" json:"name"`
	Description    string         `gorm:"type:text" json:"description"`

	CategoryID     uint           `gorm:"not null" json:"category_id"`
	Category       AssetCategory  `gorm:"foreignKey:CategoryID" json:"category,omitempty"`

	TypeID         uint           `gorm:"not null" json:"type_id"`
	Type           AssetType      `gorm:"foreignKey:TypeID" json:"type,omitempty"`

	StatusID       uint           `gorm:"not null" json:"status_id"`
	Status         AssetStatus    `gorm:"foreignKey:StatusID" json:"status,omitempty"`

	ConditionID    *uint          `json:"condition_id"`
	Condition      AssetCondition `gorm:"foreignKey:ConditionID" json:"condition,omitempty"`

	LocationID     *uint          `json:"location_id"`
	Location       Location       `gorm:"foreignKey:LocationID" json:"location,omitempty"`

	VendorID       *uint          `json:"vendor_id"`
	Vendor         Vendor         `gorm:"foreignKey:VendorID" json:"vendor,omitempty"`

	AssignedUserID *uint          `json:"assigned_user_id"`
	AssignedUser   User           `gorm:"foreignKey:AssignedUserID" json:"assigned_user,omitempty"`

	PurchaseDate     *time.Time     `json:"purchase_date"`
	PurchaseCost     *float64       `json:"purchase_cost"`
	WarrantyEndDate  *time.Time     `json:"warranty_end_date"`
	
	Notes            string         `gorm:"type:text" json:"notes"`
	IsActive         bool           `gorm:"default:true" json:"is_active"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	CreatedBy uint           `json:"created_by"`
	UpdatedBy uint           `json:"updated_by"`
}
