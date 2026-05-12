package models

import (
	"time"
)

type AssetTicketLink struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	AssetID          uint      `gorm:"not null;index" json:"asset_id"`
	Asset            Asset     `gorm:"foreignKey:AssetID" json:"asset,omitempty"`
	TicketID         uint      `gorm:"not null;index" json:"ticket_id"`
	Ticket           Ticket    `gorm:"foreignKey:TicketID" json:"ticket,omitempty"`
	RelationshipType string    `gorm:"type:varchar(50);not null" json:"relationship_type"` // e.g., AFFECTED_ASSET, REQUESTED_ASSET
	CreatedAt        time.Time `json:"created_at"`
	CreatedBy        uint      `json:"created_by"`
}
