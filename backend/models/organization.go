package models

import (
	"time"

	"gorm.io/gorm"
)

const (
	OrgTypeHQ         = "hq"
	OrgTypeBranch     = "branch"
	OrgTypeStandalone = "standalone"
)

// Organization represents a tenant / business unit in the system.
type Organization struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	Name         string         `gorm:"type:varchar(150);not null" json:"name"`
	Slug         string         `gorm:"type:varchar(80);not null;uniqueIndex" json:"slug"`
	Type         string         `gorm:"type:varchar(20);default:'standalone'" json:"type"`
	ParentOrgID  *uint          `gorm:"index" json:"parent_org_id,omitempty"`
	ParentOrg    *Organization  `gorm:"foreignKey:ParentOrgID" json:"parent_org,omitempty"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// Domain maps a hostname to an organization for multi-domain routing.
type Domain struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Hostname       string         `gorm:"type:varchar(255);not null;uniqueIndex" json:"hostname"`
	OrganizationID uint           `gorm:"not null;index" json:"organization_id"`
	Organization   Organization   `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	IsPrimary      bool           `gorm:"default:false" json:"is_primary"`
	IsActive       bool           `gorm:"default:true" json:"is_active"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// IsHQ returns true when this org is the central office type.
func (o Organization) IsHQ() bool {
	return o.Type == OrgTypeHQ
}

// CanSeeChildOrgs returns true for HQ orgs that may view child branch data.
func (o Organization) CanSeeChildOrgs() bool {
	return o.Type == OrgTypeHQ
}
