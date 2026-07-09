package models

import (
	"time"

	"gorm.io/gorm"
)

type Role string

const (
	RoleEmployee Role = "employee"
	RoleITAgent  Role = "it_agent"
	RoleManager  Role = "manager"
	RoleAdmin    Role = "admin" // legacy — migrated to manager+is_admin on startup
)

type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	FirstName string         `gorm:"size:100;not null" json:"first_name"`
	LastName  string         `gorm:"size:100;not null" json:"last_name"`
	Email            string `gorm:"size:255;not null;uniqueIndex:idx_org_email" json:"email"`
	OrganizationID   uint   `gorm:"not null;index;default:1;uniqueIndex:idx_org_email" json:"organization_id"`
	Password  string         `gorm:"not null" json:"-"`
	Role      Role           `gorm:"type:varchar(20);default:'employee'" json:"role"`
	IsAdmin   bool           `gorm:"default:false" json:"is_admin"`
	IsSuperAdmin bool        `gorm:"default:false" json:"is_super_admin"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`

	PrimaryLocationID *uint     `gorm:"index" json:"primary_location_id,omitempty"`
	PrimaryLocation   *Location `gorm:"foreignKey:PrimaryLocationID" json:"primary_location,omitempty"`

	CreatedTickets  []Ticket `gorm:"foreignKey:RequesterID" json:"created_tickets,omitempty"`
	AssignedTickets []Ticket `gorm:"foreignKey:AssigneeID" json:"assigned_tickets,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
