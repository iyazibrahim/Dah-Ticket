package models

import "time"

type ITAMSettings struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	AssetTagPrefix   string    `gorm:"type:varchar(20);default:'DPA'" json:"asset_tag_prefix"`
	AutoGenerateTag  bool      `gorm:"default:true" json:"auto_generate_tag"`
	NextSequence     uint      `gorm:"default:1" json:"next_sequence"`
	SLALowHours      int       `gorm:"default:72" json:"sla_low_hours"`
	SLAMediumHours   int       `gorm:"default:24" json:"sla_medium_hours"`
	SLAHighHours     int       `gorm:"default:8" json:"sla_high_hours"`
	SLACriticalHours int       `gorm:"default:4" json:"sla_critical_hours"`
	OrganizationName string    `gorm:"type:varchar(150)" json:"organization_name"`
	LogoBase64       string    `gorm:"type:text" json:"logo_base64"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
