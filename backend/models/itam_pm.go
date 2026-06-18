package models

import (
	"time"

	"gorm.io/gorm"
)

type PMReport struct {
	ID                     uint     `gorm:"primaryKey" json:"id"`
	LocationID             uint     `gorm:"not null;index" json:"location_id"`
	Location               Location `gorm:"foreignKey:LocationID" json:"location,omitempty"`
	Month                  string   `gorm:"type:varchar(7);not null;index" json:"month"`
	NetworkAvgUtilization  *float64 `json:"network_avg_utilization"`
	NetworkPeakUtilization *float64 `json:"network_peak_utilization"`
	DowntimeMinutes        *int     `json:"downtime_minutes"`
	Summary                string   `gorm:"type:text" json:"summary"`
	TriggeredTicketID      *uint    `json:"triggered_ticket_id"`
	CreatedBy              uint     `json:"created_by"`
	UpdatedBy              uint     `json:"updated_by"`

	Failures       []PMFailureLog        `gorm:"foreignKey:ReportID" json:"failures,omitempty"`
	Calibrations   []PMCalibrationRecord `gorm:"foreignKey:ReportID" json:"calibrations,omitempty"`
	ChecklistItems []PMChecklistItem     `gorm:"foreignKey:ReportID" json:"checklist_items,omitempty"`
	Findings       []PMFinding           `gorm:"many2many:pm_report_findings;" json:"findings,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type PMFinding struct {
	ID                  uint           `gorm:"primaryKey" json:"id"`
	LocationID          uint           `gorm:"not null;index" json:"location_id"`
	Location            Location       `gorm:"foreignKey:LocationID" json:"location,omitempty"`
	AssetID             *uint          `json:"asset_id"`
	Asset               *Asset         `gorm:"foreignKey:AssetID" json:"asset,omitempty"`
	DeviceLabel         string         `gorm:"type:varchar(160)" json:"device_label"`
	AssetTypeLabel      string         `gorm:"type:varchar(120)" json:"asset_type_label"`
	FindingType         string         `gorm:"type:varchar(120);not null" json:"finding_type"`
	Severity            string         `gorm:"type:varchar(20);default:'medium'" json:"severity"`
	Status              string         `gorm:"type:varchar(20);default:'open'" json:"status"`
	ThresholdState      string         `gorm:"type:varchar(20);default:'normal'" json:"threshold_state"`
	UtilizationPercent  *float64       `json:"utilization_percent"`
	TemperatureCelsius  *float64       `json:"temperature_celsius"`
	Description         string         `gorm:"type:text" json:"description"`
	Recommendation      string         `gorm:"type:text" json:"recommendation"`
	ReplacementRequired bool           `gorm:"default:false" json:"replacement_required"`
	ObservedAt          time.Time      `json:"observed_at"`
	ResolvedAt          *time.Time     `json:"resolved_at"`
	CreatedBy           uint           `json:"created_by"`
	UpdatedBy           uint           `json:"updated_by"`
	Photos              []PMFindingPhoto `gorm:"foreignKey:FindingID" json:"photos,omitempty"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
}

type PMReportFinding struct {
	PMReportID  uint      `gorm:"primaryKey;index" json:"pm_report_id"`
	PMFindingID uint      `gorm:"primaryKey;index" json:"pm_finding_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type PMFailureLog struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	ReportID    uint       `gorm:"not null;index" json:"report_id"`
	AssetID     *uint      `json:"asset_id"`
	FailureType string     `gorm:"type:varchar(100);not null" json:"failure_type"`
	Description string     `gorm:"type:text" json:"description"`
	StartedAt   time.Time  `json:"started_at"`
	ResolvedAt  *time.Time `json:"resolved_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type PMCalibrationRecord struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ReportID     uint      `gorm:"not null;index" json:"report_id"`
	AssetID      *uint     `json:"asset_id"`
	TaskName     string    `gorm:"type:varchar(150);not null" json:"task_name"`
	Result       string    `gorm:"type:varchar(50)" json:"result"`
	Notes        string    `gorm:"type:text" json:"notes"`
	CalibratedAt time.Time `json:"calibrated_at"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type PMChecklistItem struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ReportID    uint      `gorm:"not null;index" json:"report_id"`
	ItemName    string    `gorm:"type:varchar(200);not null" json:"item_name"`
	IsCompleted bool      `gorm:"default:false" json:"is_completed"`
	Notes       string    `gorm:"type:text" json:"notes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
