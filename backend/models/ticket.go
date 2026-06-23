package models

import (
	"time"

	"gorm.io/gorm"
)

type TicketStatus string
type TicketPriority string
type TicketType string

const (
	TypeIncident       TicketType = "incident"
	TypeServiceRequest TicketType = "service_request"
	TypeProblem        TicketType = "problem"
	TypeChange         TicketType = "change"
)

const (
	StatusOpen       TicketStatus = "open"
	StatusInProgress TicketStatus = "in_progress"
	StatusOnHold     TicketStatus = "on_hold"
	StatusResolved   TicketStatus = "resolved"
	StatusClosed     TicketStatus = "closed"

	PriorityLow      TicketPriority = "low"
	PriorityMedium   TicketPriority = "medium"
	PriorityHigh     TicketPriority = "high"
	PriorityCritical TicketPriority = "critical"
)

type Ticket struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Title       string         `gorm:"size:255;not null" json:"title"`
	Description string         `gorm:"type:text;not null" json:"description"`
	Status      TicketStatus   `gorm:"type:varchar(20);default:'open'" json:"status"`
	Priority    TicketPriority `gorm:"type:varchar(20);default:'low'" json:"priority"`
	Type        TicketType     `gorm:"type:varchar(30);default:'incident'" json:"type"`
	Category    string         `gorm:"type:varchar(50);default:'hardware'" json:"category"`

	// Foreign Keys
	RequesterID uint  `json:"requester_id"`
	Requester   User  `gorm:"foreignKey:RequesterID" json:"requester"`

	AssigneeID  *uint `json:"assignee_id"` // Pointer because it can be null initially
	Assignee    *User `gorm:"foreignKey:AssigneeID" json:"assignee,omitempty"`

	// Relationships
	Comments    []Comment `gorm:"foreignKey:TicketID" json:"comments,omitempty"`

	// SLA Tracking
	DueDate    *time.Time `json:"due_date,omitempty"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
	ClosedAt   *time.Time `json:"closed_at,omitempty"`

	// On-hold metadata
	HoldReason *HoldReason `gorm:"type:varchar(30)" json:"hold_reason,omitempty"`
	HoldNote   string      `gorm:"type:text" json:"hold_note,omitempty"`

	// Escalation metadata (not a status)
	IsEscalated bool       `gorm:"default:false" json:"is_escalated"`
	EscalatedAt *time.Time `json:"escalated_at,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
