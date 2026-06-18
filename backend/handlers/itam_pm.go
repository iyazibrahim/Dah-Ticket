package handlers

import (
	"fmt"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"gorm.io/gorm"
)

type PMFailureInput struct {
	AssetID     *uint      `json:"asset_id"`
	FailureType string     `json:"failure_type"`
	Description string     `json:"description"`
	StartedAt   time.Time  `json:"started_at"`
	ResolvedAt  *time.Time `json:"resolved_at"`
}

type PMCalibrationInput struct {
	AssetID      *uint     `json:"asset_id"`
	TaskName     string    `json:"task_name"`
	Result       string    `json:"result"`
	Notes        string    `json:"notes"`
	CalibratedAt time.Time `json:"calibrated_at"`
}

type PMChecklistInput struct {
	ItemName    string `json:"item_name"`
	IsCompleted bool   `json:"is_completed"`
	Notes       string `json:"notes"`
}

type PMFindingInput struct {
	LocationID          uint       `json:"location_id" binding:"required"`
	AssetID             *uint      `json:"asset_id" binding:"required"`
	DeviceLabel         string     `json:"device_label"`
	AssetTypeLabel      string     `json:"asset_type_label"`
	FindingType         string     `json:"finding_type" binding:"required"`
	Severity            string     `json:"severity"`
	Status              string     `json:"status"`
	ThresholdState      string     `json:"threshold_state"`
	UtilizationPercent  *float64   `json:"utilization_percent"`
	TemperatureCelsius  *float64   `json:"temperature_celsius"`
	Description         string     `json:"description"`
	Recommendation      string     `json:"recommendation"`
	ReplacementRequired bool       `json:"replacement_required"`
	ObservedAt          time.Time  `json:"observed_at"`
	ResolvedAt          *time.Time `json:"resolved_at"`
}

type CreatePMReportRequest struct {
	LocationID             uint                 `json:"location_id" binding:"required"`
	Month                  string               `json:"month" binding:"required"`
	NetworkAvgUtilization  *float64             `json:"network_avg_utilization"`
	NetworkPeakUtilization *float64             `json:"network_peak_utilization"`
	DowntimeMinutes        *int                 `json:"downtime_minutes"`
	Summary                string               `json:"summary"`
	Failures               []PMFailureInput     `json:"failures"`
	Calibrations           []PMCalibrationInput `json:"calibrations"`
	ChecklistItems         []PMChecklistInput   `json:"checklist_items"`
}

type BuildPMReportRequest struct {
	LocationID             uint     `json:"location_id" binding:"required"`
	Month                  string   `json:"month" binding:"required"`
	Summary                string   `json:"summary"`
	FindingIDs             []uint   `json:"finding_ids" binding:"required"`
	NetworkAvgUtilization  *float64 `json:"network_avg_utilization"`
	NetworkPeakUtilization *float64 `json:"network_peak_utilization"`
	DowntimeMinutes        *int     `json:"downtime_minutes"`
}

type UpdatePMReportRequest struct {
	LocationID             *uint                 `json:"location_id"`
	Month                  *string               `json:"month"`
	NetworkAvgUtilization  *float64              `json:"network_avg_utilization"`
	NetworkPeakUtilization *float64              `json:"network_peak_utilization"`
	DowntimeMinutes        *int                  `json:"downtime_minutes"`
	Summary                *string               `json:"summary"`
	Failures               *[]PMFailureInput     `json:"failures"`
	Calibrations           *[]PMCalibrationInput `json:"calibrations"`
	ChecklistItems         *[]PMChecklistInput   `json:"checklist_items"`
	FindingIDs             *[]uint               `json:"finding_ids"`
}

type UpdatePMFindingRequest struct {
	AssetID             **uint      `json:"asset_id"`
	DeviceLabel         *string     `json:"device_label"`
	AssetTypeLabel      *string     `json:"asset_type_label"`
	FindingType         *string     `json:"finding_type"`
	Severity            *string     `json:"severity"`
	Status              *string     `json:"status"`
	ThresholdState      *string     `json:"threshold_state"`
	UtilizationPercent  **float64   `json:"utilization_percent"`
	TemperatureCelsius  **float64   `json:"temperature_celsius"`
	Description         *string     `json:"description"`
	Recommendation      *string     `json:"recommendation"`
	ReplacementRequired *bool       `json:"replacement_required"`
	ObservedAt          *time.Time  `json:"observed_at"`
	ResolvedAt          **time.Time `json:"resolved_at"`
}

func normalizeValue(raw string, fallback string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == "" {
		return fallback
	}
	return v
}

func parseMonthRange(month string) (time.Time, time.Time, error) {
	if len(month) != 7 {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid month format")
	}
	start, err := time.Parse("2006-01", month)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	end := start.AddDate(0, 1, 0)
	return start, end, nil
}

func getFindingAssetSnapshot(assetID uint) (models.Asset, string, error) {
	var asset models.Asset
	if err := database.DB.Preload("Type").Preload("Category").First(&asset, assetID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return models.Asset{}, "", fmt.Errorf("asset not found")
		}
		return models.Asset{}, "", err
	}

	assetTypeLabel := strings.TrimSpace(asset.Type.Name)
	if assetTypeLabel == "" {
		assetTypeLabel = strings.TrimSpace(asset.Category.Name)
	}
	if assetTypeLabel == "" {
		assetTypeLabel = "Device"
	}

	return asset, assetTypeLabel, nil
}

func ListPMFindings(c *gin.Context) {
	query := database.DB.Model(&models.PMFinding{})

	if locationID := c.Query("location_id"); locationID != "" {
		query = query.Where("location_id = ?", locationID)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", strings.ToLower(status))
	}
	if severity := c.Query("severity"); severity != "" {
		query = query.Where("severity = ?", strings.ToLower(severity))
	}
	if month := c.Query("month"); month != "" {
		start, end, err := parseMonthRange(month)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "month must be YYYY-MM"})
			return
		}
		query = query.Where("observed_at >= ? AND observed_at < ?", start, end)
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		like := "%" + strings.ToLower(q) + "%"
		query = query.Where("LOWER(finding_type) LIKE ? OR LOWER(description) LIKE ? OR LOWER(device_label) LIKE ? OR LOWER(asset_type_label) LIKE ?", like, like, like, like)
	}

	var findings []models.PMFinding
	if err := query.Preload("Location").Preload("Asset").Preload("Photos").Order("observed_at DESC, created_at DESC").Find(&findings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list PM findings"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"findings": findings})
}

func CreatePMFinding(c *gin.Context) {
	var req PMFindingInput
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.AssetID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "asset_id is required"})
		return
	}

	asset, assetTypeLabel, err := getFindingAssetSnapshot(*req.AssetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if asset.LocationID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "linked asset must have a location"})
		return
	}

	observedAt := req.ObservedAt
	if observedAt.IsZero() {
		observedAt = time.Now()
	}

	userID := c.MustGet("userID").(uint)
	finding := models.PMFinding{
		LocationID:          *asset.LocationID,
		AssetID:             req.AssetID,
		DeviceLabel:         strings.TrimSpace(asset.Name),
		AssetTypeLabel:      assetTypeLabel,
		FindingType:         strings.TrimSpace(req.FindingType),
		Severity:            normalizeValue(req.Severity, "medium"),
		Status:              normalizeValue(req.Status, "open"),
		ThresholdState:      normalizeValue(req.ThresholdState, "normal"),
		UtilizationPercent:  req.UtilizationPercent,
		TemperatureCelsius:  req.TemperatureCelsius,
		Description:         strings.TrimSpace(req.Description),
		Recommendation:      strings.TrimSpace(req.Recommendation),
		ReplacementRequired: req.ReplacementRequired,
		ObservedAt:          observedAt,
		ResolvedAt:          req.ResolvedAt,
		CreatedBy:           userID,
		UpdatedBy:           userID,
	}

	if finding.FindingType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "finding_type is required"})
		return
	}

	if err := database.DB.Create(&finding).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create PM finding"})
		return
	}

	database.DB.Preload("Location").Preload("Asset").First(&finding, finding.ID)
	c.JSON(http.StatusCreated, gin.H{"finding": finding})
}

func UpdatePMFinding(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid finding ID"})
		return
	}

	var req UpdatePMFindingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)
	var finding models.PMFinding
	if err := database.DB.First(&finding, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PM finding not found"})
		return
	}

	if req.AssetID != nil {
		finding.AssetID = *req.AssetID
	}
	if finding.AssetID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "asset_id is required"})
		return
	}

	asset, assetTypeLabel, err := getFindingAssetSnapshot(*finding.AssetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if asset.LocationID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "linked asset must have a location"})
		return
	}
	finding.LocationID = *asset.LocationID
	finding.DeviceLabel = strings.TrimSpace(asset.Name)
	finding.AssetTypeLabel = assetTypeLabel
	if req.FindingType != nil {
		finding.FindingType = strings.TrimSpace(*req.FindingType)
	}
	if req.Severity != nil {
		finding.Severity = normalizeValue(*req.Severity, "medium")
	}
	if req.Status != nil {
		finding.Status = normalizeValue(*req.Status, "open")
	}
	if req.ThresholdState != nil {
		finding.ThresholdState = normalizeValue(*req.ThresholdState, "normal")
	}
	if req.UtilizationPercent != nil {
		finding.UtilizationPercent = *req.UtilizationPercent
	}
	if req.TemperatureCelsius != nil {
		finding.TemperatureCelsius = *req.TemperatureCelsius
	}
	if req.Description != nil {
		finding.Description = strings.TrimSpace(*req.Description)
	}
	if req.Recommendation != nil {
		finding.Recommendation = strings.TrimSpace(*req.Recommendation)
	}
	if req.ReplacementRequired != nil {
		finding.ReplacementRequired = *req.ReplacementRequired
	}
	if req.ObservedAt != nil {
		finding.ObservedAt = *req.ObservedAt
	}
	if req.ResolvedAt != nil {
		finding.ResolvedAt = *req.ResolvedAt
	}
	oldJSON := ToJSON(finding)
	finding.UpdatedBy = userID

	if err := database.DB.Save(&finding).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update PM finding"})
		return
	}

	database.DB.Preload("Location").Preload("Asset").First(&finding, finding.ID)
	LogAudit(c, models.AuditActionUpdate, "pm_finding", finding.ID, oldJSON, ToJSON(finding), "PM finding updated")
	c.JSON(http.StatusOK, gin.H{"finding": finding})
}

func DeletePMFinding(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid finding ID"})
		return
	}

	var finding models.PMFinding
	if err := database.DB.First(&finding, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PM finding not found"})
		return
	}

	oldJSON := ToJSON(finding)
	if err := database.DB.Delete(&finding).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete PM finding"})
		return
	}

	LogAudit(c, models.AuditActionDelete, "pm_finding", uint(id), oldJSON, "", "PM finding deleted")
	c.JSON(http.StatusOK, gin.H{"message": "PM finding deleted"})
}

func ListPMReports(c *gin.Context) {
	query := database.DB.Model(&models.PMReport{})
	if locationID := c.Query("location_id"); locationID != "" {
		query = query.Where("location_id = ?", locationID)
	}
	if month := c.Query("month"); month != "" {
		query = query.Where("month = ?", month)
	}

	var reports []models.PMReport
	if err := query.Preload("Location").Preload("Findings").Order("month DESC, created_at DESC").Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list PM reports"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"reports": reports})
}

func GetPMReport(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report ID"})
		return
	}

	var report models.PMReport
	if err := database.DB.
		Preload("Location").
		Preload("Failures").
		Preload("Calibrations").
		Preload("ChecklistItems").
		Preload("Findings").
		Preload("Findings.Asset").
		First(&report, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PM report not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"report": report})
}

func CreatePMReport(c *gin.Context) {
	var req CreatePMReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Month) != 7 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month must be YYYY-MM"})
		return
	}

	userID := c.MustGet("userID").(uint)
	var report models.PMReport

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		report = models.PMReport{
			LocationID:             req.LocationID,
			Month:                  req.Month,
			NetworkAvgUtilization:  req.NetworkAvgUtilization,
			NetworkPeakUtilization: req.NetworkPeakUtilization,
			DowntimeMinutes:        req.DowntimeMinutes,
			Summary:                req.Summary,
			CreatedBy:              userID,
			UpdatedBy:              userID,
		}
		if err := tx.Create(&report).Error; err != nil {
			return err
		}
		for _, f := range req.Failures {
			row := models.PMFailureLog{ReportID: report.ID, AssetID: f.AssetID, FailureType: f.FailureType, Description: f.Description, StartedAt: f.StartedAt, ResolvedAt: f.ResolvedAt}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
		for _, cal := range req.Calibrations {
			row := models.PMCalibrationRecord{ReportID: report.ID, AssetID: cal.AssetID, TaskName: cal.TaskName, Result: cal.Result, Notes: cal.Notes, CalibratedAt: cal.CalibratedAt}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
		for _, chk := range req.ChecklistItems {
			row := models.PMChecklistItem{ReportID: report.ID, ItemName: chk.ItemName, IsCompleted: chk.IsCompleted, Notes: chk.Notes}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create PM report"})
		return
	}

	database.DB.Preload("Location").Preload("Failures").Preload("Calibrations").Preload("ChecklistItems").Preload("Findings").First(&report, report.ID)
	c.JSON(http.StatusCreated, gin.H{"report": report})
}

func BuildPMReportFromFindings(c *gin.Context) {
	var req BuildPMReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Month) != 7 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "month must be YYYY-MM"})
		return
	}
	if len(req.FindingIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one finding_id is required"})
		return
	}

	userID := c.MustGet("userID").(uint)
	var report models.PMReport

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var findings []models.PMFinding
		if err := tx.Where("id IN ?", req.FindingIDs).Find(&findings).Error; err != nil {
			return err
		}
		if len(findings) != len(req.FindingIDs) {
			return fmt.Errorf("one or more findings not found")
		}
		for _, finding := range findings {
			if finding.LocationID != req.LocationID {
				return fmt.Errorf("all selected findings must belong to the same location")
			}
		}

		report = models.PMReport{
			LocationID:             req.LocationID,
			Month:                  req.Month,
			Summary:                strings.TrimSpace(req.Summary),
			NetworkAvgUtilization:  req.NetworkAvgUtilization,
			NetworkPeakUtilization: req.NetworkPeakUtilization,
			DowntimeMinutes:        req.DowntimeMinutes,
			CreatedBy:              userID,
			UpdatedBy:              userID,
		}
		if err := tx.Create(&report).Error; err != nil {
			return err
		}

		if err := tx.Model(&report).Association("Findings").Append(&findings); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	database.DB.Preload("Location").Preload("Findings").Preload("Findings.Asset").First(&report, report.ID)
	c.JSON(http.StatusCreated, gin.H{"report": report})
}

func UpdatePMReport(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report ID"})
		return
	}

	var req UpdatePMReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)
	var report models.PMReport
	if err := database.DB.First(&report, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PM report not found"})
		return
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if req.LocationID != nil {
			report.LocationID = *req.LocationID
		}
		if req.Month != nil {
			report.Month = *req.Month
		}
		if req.NetworkAvgUtilization != nil {
			report.NetworkAvgUtilization = req.NetworkAvgUtilization
		}
		if req.NetworkPeakUtilization != nil {
			report.NetworkPeakUtilization = req.NetworkPeakUtilization
		}
		if req.DowntimeMinutes != nil {
			report.DowntimeMinutes = req.DowntimeMinutes
		}
		if req.Summary != nil {
			report.Summary = *req.Summary
		}
		report.UpdatedBy = userID
		if err := tx.Save(&report).Error; err != nil {
			return err
		}

		if req.Failures != nil {
			if err := tx.Where("report_id = ?", report.ID).Delete(&models.PMFailureLog{}).Error; err != nil {
				return err
			}
			for _, f := range *req.Failures {
				row := models.PMFailureLog{ReportID: report.ID, AssetID: f.AssetID, FailureType: f.FailureType, Description: f.Description, StartedAt: f.StartedAt, ResolvedAt: f.ResolvedAt}
				if err := tx.Create(&row).Error; err != nil {
					return err
				}
			}
		}
		if req.Calibrations != nil {
			if err := tx.Where("report_id = ?", report.ID).Delete(&models.PMCalibrationRecord{}).Error; err != nil {
				return err
			}
			for _, cal := range *req.Calibrations {
				row := models.PMCalibrationRecord{ReportID: report.ID, AssetID: cal.AssetID, TaskName: cal.TaskName, Result: cal.Result, Notes: cal.Notes, CalibratedAt: cal.CalibratedAt}
				if err := tx.Create(&row).Error; err != nil {
					return err
				}
			}
		}
		if req.ChecklistItems != nil {
			if err := tx.Where("report_id = ?", report.ID).Delete(&models.PMChecklistItem{}).Error; err != nil {
				return err
			}
			for _, chk := range *req.ChecklistItems {
				row := models.PMChecklistItem{ReportID: report.ID, ItemName: chk.ItemName, IsCompleted: chk.IsCompleted, Notes: chk.Notes}
				if err := tx.Create(&row).Error; err != nil {
					return err
				}
			}
		}
		if req.FindingIDs != nil {
			var findings []models.PMFinding
			if len(*req.FindingIDs) > 0 {
				if err := tx.Where("id IN ?", *req.FindingIDs).Find(&findings).Error; err != nil {
					return err
				}
				if len(findings) != len(*req.FindingIDs) {
					return fmt.Errorf("one or more findings not found")
				}
			}
			if err := tx.Model(&report).Association("Findings").Replace(&findings); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update PM report"})
		return
	}

	database.DB.Preload("Location").Preload("Failures").Preload("Calibrations").Preload("ChecklistItems").Preload("Findings").Preload("Findings.Asset").First(&report, report.ID)
	c.JSON(http.StatusOK, gin.H{"report": report})
}

func GetPMSummary(c *gin.Context) {
	reportQuery := database.DB.Model(&models.PMReport{})
	findingQuery := database.DB.Model(&models.PMFinding{})

	if locationID := c.Query("location_id"); locationID != "" {
		reportQuery = reportQuery.Where("location_id = ?", locationID)
		findingQuery = findingQuery.Where("location_id = ?", locationID)
	}
	if month := c.Query("month"); month != "" {
		reportQuery = reportQuery.Where("month = ?", month)
		if start, end, err := parseMonthRange(month); err == nil {
			findingQuery = findingQuery.Where("observed_at >= ? AND observed_at < ?", start, end)
		}
	}

	var reports []models.PMReport
	if err := reportQuery.Find(&reports).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch PM summary"})
		return
	}

	var findings []models.PMFinding
	if err := findingQuery.Order("observed_at ASC").Find(&findings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch PM findings"})
		return
	}

	if len(reports) == 0 && len(findings) == 0 {
		c.JSON(http.StatusOK, gin.H{"summary": gin.H{
			"total_reports":       0,
			"total_findings":      0,
			"urgent_issues":       0,
			"pending_follow_ups":  0,
			"mttr_hours":          0,
			"mtbf_hours":          0,
		}})
		return
	}

	totalFindings := len(findings)
	urgentIssues := 0
	pendingFollowUps := 0
	var mttr float64
	resolvedCount := 0
	failureTimes := make([]time.Time, 0, len(findings))
	for _, finding := range findings {
		failureTimes = append(failureTimes, finding.ObservedAt)
		severity := strings.ToLower(strings.TrimSpace(finding.Severity))
		status := strings.ToLower(strings.TrimSpace(finding.Status))
		if severity == "high" || severity == "critical" {
			urgentIssues++
		}
		if status != "resolved" {
			pendingFollowUps++
		}
		if finding.ResolvedAt != nil {
			mttr += finding.ResolvedAt.Sub(finding.ObservedAt).Hours()
			resolvedCount++
		}
	}
	if resolvedCount > 0 {
		mttr = mttr / float64(resolvedCount)
	}

	sort.Slice(failureTimes, func(i, j int) bool { return failureTimes[i].Before(failureTimes[j]) })
	var mtbf float64
	if len(failureTimes) > 1 {
		var totalGap float64
		for i := 1; i < len(failureTimes); i++ {
			totalGap += failureTimes[i].Sub(failureTimes[i-1]).Hours()
		}
		mtbf = totalGap / float64(len(failureTimes)-1)
	}

	c.JSON(http.StatusOK, gin.H{"summary": gin.H{
		"total_reports":      len(reports),
		"total_findings":     totalFindings,
		"urgent_issues":      urgentIssues,
		"pending_follow_ups": pendingFollowUps,
		"mttr_hours":         mttr,
		"mtbf_hours":         mtbf,
	}})
}

func ExportPMReportPDF(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report ID"})
		return
	}

	var report models.PMReport
	if err := database.DB.Preload("Location").Preload("Findings").Preload("Findings.Asset").First(&report, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PM report not found"})
		return
	}

	// Load settings for org name and logo
	var settings models.ITAMSettings
	database.DB.First(&settings)

	// Human-readable finding type labels
	findingTypeLabel := map[string]string{
		"health_check":        "Health Check",
		"performance_issue":   "Performance Issue",
		"hardware_failure":    "Hardware Failure",
		"connectivity_issue":  "Connectivity Issue",
		"overheating":         "Overheating",
		"configuration_issue": "Configuration Issue",
		"replacement_needed":  "Replacement Needed",
		"other":               "Other",
	}
	getTypeLabel := func(raw string) string {
		if label, ok := findingTypeLabel[strings.ToLower(raw)]; ok {
			return label
		}
		return raw
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetAutoPageBreak(true, 15)
	pdf.AddPage()

	marginL := 15.0
	marginR := 15.0
	pageW, _ := pdf.GetPageSize()
	contentW := pageW - marginL - marginR
	pdf.SetMargins(marginL, 15, marginR)

	// ── Header ──────────────────────────────────────────────────────────
	if settings.OrganizationName != "" {
		pdf.SetFont("Arial", "B", 11)
		pdf.SetTextColor(80, 80, 80)
		pdf.Cell(contentW, 7, settings.OrganizationName)
		pdf.Ln(7)
	}

	pdf.SetFont("Arial", "B", 17)
	pdf.SetTextColor(20, 20, 20)
	pdf.Cell(contentW, 9, "Preventive Maintenance Report")
	pdf.Ln(9)

	// horizontal rule
	pdf.SetDrawColor(180, 180, 180)
	pdf.SetLineWidth(0.4)
	x, y := pdf.GetX(), pdf.GetY()
	pdf.Line(x, y, x+contentW, y)
	pdf.Ln(4)

	// ── Report meta ─────────────────────────────────────────────────────
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(60, 60, 60)
	pdf.Cell(contentW/2, 6, fmt.Sprintf("Location: %s", report.Location.Name))
	pdf.Cell(contentW/2, 6, fmt.Sprintf("Report #%d", report.ID))
	pdf.Ln(6)
	pdf.Cell(contentW/2, 6, fmt.Sprintf("Month: %s", report.Month))
	pdf.Cell(contentW/2, 6, fmt.Sprintf("Generated: %s", time.Now().Format("2006-01-02 15:04")))
	pdf.Ln(8)

	// ── Summary ──────────────────────────────────────────────────────────
	pdf.SetFont("Arial", "B", 11)
	pdf.SetTextColor(20, 20, 20)
	pdf.Cell(contentW, 7, "Summary")
	pdf.Ln(7)
	pdf.SetFont("Arial", "", 10)
	pdf.SetTextColor(50, 50, 50)
	summaryText := strings.TrimSpace(report.Summary)
	if summaryText == "" {
		summaryText = "No summary provided."
	}
	pdf.MultiCell(contentW, 5.5, summaryText, "", "L", false)
	pdf.Ln(5)

	// ── Metrics (only if data present) ───────────────────────────────────
	hasMetrics := report.NetworkAvgUtilization != nil || report.NetworkPeakUtilization != nil || report.DowntimeMinutes != nil
	if hasMetrics {
		pdf.SetFont("Arial", "B", 11)
		pdf.SetTextColor(20, 20, 20)
		pdf.Cell(contentW, 7, "Network Metrics")
		pdf.Ln(7)
		pdf.SetFont("Arial", "", 10)
		pdf.SetTextColor(50, 50, 50)
		if report.NetworkAvgUtilization != nil {
			pdf.Cell(contentW, 5.5, fmt.Sprintf("Average Utilization: %.1f%%", *report.NetworkAvgUtilization))
			pdf.Ln(5.5)
		}
		if report.NetworkPeakUtilization != nil {
			pdf.Cell(contentW, 5.5, fmt.Sprintf("Peak Utilization: %.1f%%", *report.NetworkPeakUtilization))
			pdf.Ln(5.5)
		}
		if report.DowntimeMinutes != nil {
			pdf.Cell(contentW, 5.5, fmt.Sprintf("Total Downtime: %d minutes", *report.DowntimeMinutes))
			pdf.Ln(5.5)
		}
		pdf.Ln(5)
	}

	// ── Findings ──────────────────────────────────────────────────────────
	pdf.SetFont("Arial", "B", 11)
	pdf.SetTextColor(20, 20, 20)
	pdf.Cell(contentW, 7, fmt.Sprintf("Findings (%d)", len(report.Findings)))
	pdf.Ln(8)

	if len(report.Findings) == 0 {
		pdf.SetFont("Arial", "I", 10)
		pdf.SetTextColor(130, 130, 130)
		pdf.Cell(contentW, 6, "No findings linked to this report.")
		pdf.Ln(6)
	} else {
		for i, finding := range report.Findings {
			// alternating background
			blockX := pdf.GetX()
			blockY := pdf.GetY()
			_ = blockX
			_ = blockY
			if i%2 == 0 {
				pdf.SetFillColor(247, 248, 250)
			} else {
				pdf.SetFillColor(255, 255, 255)
			}

			device := strings.TrimSpace(finding.DeviceLabel)
			if device == "" && finding.Asset != nil {
				device = finding.Asset.Name
			}
			if device == "" {
				device = "(No label)"
			}

			typeLabel := getTypeLabel(finding.FindingType)
			severity := strings.Title(finding.Severity)
			status := strings.Title(finding.Status)
			threshold := strings.Title(finding.ThresholdState)

			// Finding header line
			pdf.SetFont("Arial", "B", 10)
			pdf.SetTextColor(20, 20, 20)
			headerLine := fmt.Sprintf("%d. %s  |  %s  |  %s  |  %s", i+1, device, typeLabel, severity, status)
			pdf.MultiCell(contentW, 6, headerLine, "", "L", i%2 == 0)

			// Threshold + replacement
			pdf.SetFont("Arial", "", 9)
			pdf.SetTextColor(100, 100, 100)
			subLine := fmt.Sprintf("   Threshold: %s", threshold)
			if finding.ReplacementRequired {
				subLine += "   [REPLACEMENT REQUIRED]"
			}
			pdf.MultiCell(contentW, 5, subLine, "", "L", i%2 == 0)

			// Description
			if desc := strings.TrimSpace(finding.Description); desc != "" {
				pdf.SetFont("Arial", "B", 9)
				pdf.SetTextColor(60, 60, 60)
				pdf.Cell(contentW, 5, "   Description:")
				pdf.Ln(5)
				pdf.SetFont("Arial", "", 9)
				pdf.SetLeftMargin(marginL + 8)
				pdf.MultiCell(contentW-8, 5, desc, "", "L", i%2 == 0)
				pdf.SetLeftMargin(marginL)
			}

			// Recommendation
			if rec := strings.TrimSpace(finding.Recommendation); rec != "" {
				pdf.SetFont("Arial", "B", 9)
				pdf.SetTextColor(60, 60, 60)
				pdf.Cell(contentW, 5, "   Recommendation:")
				pdf.Ln(5)
				pdf.SetFont("Arial", "", 9)
				pdf.SetLeftMargin(marginL + 8)
				pdf.MultiCell(contentW-8, 5, rec, "", "L", i%2 == 0)
				pdf.SetLeftMargin(marginL)
			}

			// separator
			pdf.SetDrawColor(210, 210, 210)
			pdf.SetLineWidth(0.2)
			sepY := pdf.GetY()
			pdf.Line(marginL, sepY, marginL+contentW, sepY)
			pdf.Ln(3)
		}
	}

	pdf.Ln(5)

	// ── Glossary ──────────────────────────────────────────────────────────
	pdf.SetFont("Arial", "B", 10)
	pdf.SetTextColor(80, 80, 80)
	pdf.Cell(contentW, 6, "Glossary")
	pdf.Ln(6)
	pdf.SetFont("Arial", "", 9)
	pdf.SetTextColor(100, 100, 100)
	pdf.MultiCell(contentW, 5, "MTTR: Mean Time To Repair — average hours to resolve a finding.\nMTBF: Mean Time Between Failures — average hours between observed findings.", "", "L", false)

	fileName := fmt.Sprintf("pm_report_%d_%s.pdf", report.ID, strings.ReplaceAll(report.Month, "-", "_"))
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	if err := pdf.Output(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF"})
		return
	}
}

func TriggerPMTicket(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid report ID"})
		return
	}

	var report models.PMReport
	if err := database.DB.Preload("Location").First(&report, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PM report not found"})
		return
	}
	if report.TriggeredTicketID != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PM ticket already triggered for this report"})
		return
	}

	userID := c.MustGet("userID").(uint)
	dueDate := config.GetSLADueDate(string(models.PriorityMedium), time.Now())

	title := fmt.Sprintf("PM Task - %s - %s", report.Location.Name, report.Month)
	description := fmt.Sprintf("Preventive maintenance report for %s (%s). Summary: %s", report.Location.Name, report.Month, report.Summary)
	if description == "" {
		description = fmt.Sprintf("Preventive maintenance report for %s (%s).", report.Location.Name, report.Month)
	}

	ticket := models.Ticket{
		Title:       title,
		Description: description,
		Status:      models.StatusOpen,
		Priority:    models.PriorityMedium,
		Type:        models.TypeProblem,
		Category:    "network",
		RequesterID: userID,
		DueDate:     &dueDate,
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&ticket).Error; err != nil {
			return err
		}
		report.TriggeredTicketID = &ticket.ID
		report.UpdatedBy = userID
		return tx.Save(&report).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to trigger PM ticket"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ticket": ticket, "report": report})
}

// UploadPMFindingPhoto uploads one or more photos for a PM finding.
func UploadPMFindingPhoto(c *gin.Context) {
	findingID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid finding ID"})
		return
	}

	var finding models.PMFinding
	if err := database.DB.First(&finding, uint(findingID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Finding not found"})
		return
	}

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid multipart form"})
		return
	}

	files := form.File["photos"]
	if len(files) == 0 {
		file, ferr := c.FormFile("photo")
		if ferr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "At least one photo is required"})
			return
		}
		files = []*multipart.FileHeader{file}
	}

	userID := c.MustGet("userID").(uint)
	dir := filepath.Join("uploads", "pm", fmt.Sprintf("%d", finding.ID))
	os.MkdirAll(dir, 0755)

	var saved []models.PMFindingPhoto
	for i, file := range files {
		if file.Size > 10*1024*1024 {
			continue
		}
		ext := strings.ToLower(filepath.Ext(file.Filename))
		allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
		if !allowed[ext] {
			continue
		}
		filename := fmt.Sprintf("%d_%d%s", time.Now().UnixNano(), i, ext)
		dest := filepath.Join(dir, filename)
		if err := c.SaveUploadedFile(file, dest); err != nil {
			continue
		}
		photo := models.PMFindingPhoto{
			FindingID: finding.ID,
			FilePath:  dest,
			SortOrder: i,
			CreatedBy: userID,
		}
		database.DB.Create(&photo)
		saved = append(saved, photo)
	}

	c.JSON(http.StatusCreated, gin.H{"photos": saved})
}

// ListPMFindingPhotos returns photos for a finding.
func ListPMFindingPhotos(c *gin.Context) {
	findingID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid finding ID"})
		return
	}

	var photos []models.PMFindingPhoto
	database.DB.Where("finding_id = ?", findingID).Order("sort_order ASC, created_at ASC").Find(&photos)
	c.JSON(http.StatusOK, gin.H{"photos": photos})
}

// ServePMFindingPhoto serves a PM finding photo file.
func ServePMFindingPhoto(c *gin.Context) {
	photoID, err := strconv.ParseUint(c.Param("photoId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid photo ID"})
		return
	}

	var photo models.PMFindingPhoto
	if err := database.DB.First(&photo, uint(photoID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Photo not found"})
		return
	}
	c.File(photo.FilePath)
}

// DeletePMFindingPhoto removes a photo from a finding.
func DeletePMFindingPhoto(c *gin.Context) {
	photoID, err := strconv.ParseUint(c.Param("photoId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid photo ID"})
		return
	}

	var photo models.PMFindingPhoto
	if err := database.DB.First(&photo, uint(photoID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Photo not found"})
		return
	}

	os.Remove(photo.FilePath)
	database.DB.Delete(&photo)
	c.JSON(http.StatusOK, gin.H{"message": "Photo deleted"})
}
