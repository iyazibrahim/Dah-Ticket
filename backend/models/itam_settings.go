package models

import "time"

// ITAMSettings holds per-organization configuration (also known as OrganizationSettings).
type ITAMSettings struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	OrganizationID   uint      `gorm:"not null;uniqueIndex;default:1" json:"organization_id"`
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
	NotifyHQOnSiteTicket bool `gorm:"default:true" json:"notify_hq_on_site_ticket"`
	NotifyTicketAssigned  bool `gorm:"default:true" json:"notify_ticket_assigned"`
	NotifyTicketStatus    bool `gorm:"default:true" json:"notify_ticket_status"`
	NotifyNewComment      bool `gorm:"default:true" json:"notify_new_comment"`
	EmailEnabled          bool `gorm:"default:false" json:"email_enabled"`
	EmailSenderName       string `gorm:"type:varchar(120)" json:"email_sender_name"`
	SMTPHost              string `gorm:"type:varchar(255)" json:"smtp_host"`
	SMTPPort              string `gorm:"type:varchar(10);default:'587'" json:"smtp_port"`
	SMTPUsername          string `gorm:"type:varchar(255)" json:"smtp_username"`
	SMTPPassword          string `gorm:"type:varchar(255)" json:"-"`
	SMTPFromAddr          string `gorm:"type:varchar(255)" json:"smtp_from_addr"`
	SMTPFromName          string `gorm:"type:varchar(120)" json:"smtp_from_name"`
	TelegramEnabled       bool `gorm:"default:false" json:"telegram_enabled"`
	TelegramBotToken      string `gorm:"type:varchar(255)" json:"-"`
	TelegramChatID        string `gorm:"type:varchar(64)" json:"telegram_chat_id"`
	KBMaxUploadMB            int  `gorm:"default:5" json:"kb_max_upload_mb"`
	AllowPublicRegistration  bool `gorm:"default:true" json:"allow_public_registration"`
	TicketAttachmentMaxMB    int  `gorm:"default:10" json:"ticket_attachment_max_mb"`
	PMTicketPriority         string `gorm:"type:varchar(20);default:'medium'" json:"pm_ticket_priority"`
	PMTicketType             string `gorm:"type:varchar(30);default:'problem'" json:"pm_ticket_type"`
	PMTicketCategory         string `gorm:"type:varchar(50);default:'network'" json:"pm_ticket_category"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}
