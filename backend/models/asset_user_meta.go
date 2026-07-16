package models

import (
	"time"

	"gorm.io/gorm"
)

// AssetUserMeta stores employee-editable personal fields for an assigned asset.
// Does not overwrite staff-owned Asset.Notes / location / status.
type AssetUserMeta struct {
	ID     uint `gorm:"primaryKey" json:"id"`
	UserID uint `gorm:"not null;uniqueIndex:idx_user_asset_meta" json:"user_id"`
	User   User `gorm:"foreignKey:UserID" json:"-"`

	AssetID uint  `gorm:"not null;uniqueIndex:idx_user_asset_meta" json:"asset_id"`
	Asset   Asset `gorm:"foreignKey:AssetID" json:"-"`

	PersonalLabel string `gorm:"type:varchar(100)" json:"personal_label"`
	LocationHint  string `gorm:"type:varchar(200)" json:"location_hint"`
	UserNotes     string `gorm:"type:text" json:"user_notes"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
