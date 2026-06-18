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
	SupportEmail     string    `gorm:"type:varchar(255)" json:"support_email"`
	Timezone         string    `gorm:"type:varchar(80);default:'Asia/Kuala_Lumpur'" json:"timezone"`
	NotifyTicketCreated   bool `gorm:"default:true" json:"notify_ticket_created"`
	NotifyTicketAssigned  bool `gorm:"default:true" json:"notify_ticket_assigned"`
	NotifyTicketStatus    bool `gorm:"default:true" json:"notify_ticket_status"`
	NotifyNewComment      bool `gorm:"default:true" json:"notify_new_comment"`
	EmailSenderName       string `gorm:"type:varchar(120)" json:"email_sender_name"`
	KBMaxUploadMB         int    `gorm:"default:5" json:"kb_max_upload_mb"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
