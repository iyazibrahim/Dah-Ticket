package models

import (
	"time"

	"gorm.io/gorm"
)

// Lookup groups for admin-configurable enumerations.
const (
	LookupTicketCategory    = "ticket_category"
	LookupHoldReason        = "hold_reason"
	LookupResolutionCode    = "resolution_code"
	LookupClosureCode       = "closure_code"
	LookupFindingType       = "finding_type"
	LookupFindingSeverity   = "finding_severity"
	LookupFindingThreshold  = "finding_threshold"
	LookupDeviceType        = "device_type"
)

// SystemLookup stores admin-managed dropdown values per group.
type SystemLookup struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	OrganizationID uint           `gorm:"not null;index;uniqueIndex:idx_org_lookup_key" json:"organization_id"`
	Group          string         `gorm:"type:varchar(50);not null;uniqueIndex:idx_org_lookup_key" json:"group"`
	Key            string         `gorm:"type:varchar(80);not null;uniqueIndex:idx_org_lookup_key" json:"key"`
	Label          string         `gorm:"type:varchar(150);not null" json:"label"`
	SortOrder      int            `gorm:"default:0" json:"sort_order"`
	Metadata       string         `gorm:"type:text" json:"metadata,omitempty"`
	IsActive       bool           `gorm:"default:true" json:"is_active"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}
