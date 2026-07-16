package models

import (
	"time"

	"gorm.io/gorm"
)

type AssetRequestType string

const (
	AssetRequestLoan        AssetRequestType = "loan"
	AssetRequestAssignment  AssetRequestType = "assignment"
	AssetRequestFulfillment AssetRequestType = "fulfillment"
)

type AssetRequestStatus string

const (
	AssetRequestPending         AssetRequestStatus = "pending"
	AssetRequestApproved        AssetRequestStatus = "approved"
	AssetRequestRejected        AssetRequestStatus = "rejected"
	AssetRequestCancelled       AssetRequestStatus = "cancelled"
	AssetRequestCheckedOut      AssetRequestStatus = "checked_out"
	AssetRequestReturnRequested AssetRequestStatus = "return_requested"
	AssetRequestReturned        AssetRequestStatus = "returned"
	AssetRequestOverdue         AssetRequestStatus = "overdue"
	AssetRequestAssigned        AssetRequestStatus = "assigned"
)

// AssetRequest tracks loan, assignment, and fulfillment requests for ITAM assets.
type AssetRequest struct {
	ID             uint `gorm:"primaryKey" json:"id"`
	OrganizationID uint `gorm:"not null;index;default:1" json:"organization_id"`

	Type   AssetRequestType   `gorm:"type:varchar(30);not null;index" json:"type"`
	Status AssetRequestStatus `gorm:"type:varchar(30);not null;index;default:'pending'" json:"status"`

	RequesterID uint `gorm:"not null;index" json:"requester_id"`
	Requester   User `gorm:"foreignKey:RequesterID" json:"requester,omitempty"`

	AssetID *uint  `gorm:"index" json:"asset_id"`
	Asset   *Asset `gorm:"foreignKey:AssetID" json:"asset,omitempty"`

	// For fulfillment requests (no specific asset yet)
	CategoryID *uint          `json:"category_id"`
	Category   *AssetCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	AssetTypeID *uint         `json:"asset_type_id"`
	AssetType   *AssetType    `gorm:"foreignKey:AssetTypeID" json:"asset_type,omitempty"`

	HomeLocationID   *uint     `json:"home_location_id"`
	HomeLocation     *Location `gorm:"foreignKey:HomeLocationID" json:"home_location,omitempty"`
	LoanToLocationID *uint     `json:"loan_to_location_id"`
	LoanToLocation   *Location `gorm:"foreignKey:LoanToLocationID" json:"loan_to_location,omitempty"`

	StartAt *time.Time `json:"start_at"`
	DueAt   *time.Time `json:"due_at"`

	Reason       string `gorm:"type:text" json:"reason"`
	RejectReason string `gorm:"type:text" json:"reject_reason"`

	ApprovedBy *uint `json:"approved_by"`
	Approver   *User `gorm:"foreignKey:ApprovedBy" json:"approver,omitempty"`

	TicketID *uint   `json:"ticket_id"`
	Ticket   *Ticket `gorm:"foreignKey:TicketID" json:"ticket,omitempty"`

	CheckedOutAt *time.Time `json:"checked_out_at"`
	ReturnedAt   *time.Time `json:"returned_at"`

	ConditionOnReturnID *uint           `json:"condition_on_return_id"`
	ConditionOnReturn   *AssetCondition `gorm:"foreignKey:ConditionOnReturnID" json:"condition_on_return,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
