package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// --- Asset DTOs ---

type CreateAssetRequest struct {
	AssetTag        string     `json:"asset_tag"`
	AutoGenerateTag bool       `json:"auto_generate_tag"`
	SerialNumber    string     `json:"serial_number"`
	Name            string     `json:"name" binding:"required"`
	Description     string     `json:"description"`
	CategoryID      uint       `json:"category_id" binding:"required"`
	TypeID          uint       `json:"type_id" binding:"required"`
	StatusID        uint       `json:"status_id" binding:"required"`
	ConditionID     *uint      `json:"condition_id"`
	LocationID      *uint      `json:"location_id"`
	VendorID        *uint      `json:"vendor_id"`
	AssignedUserID  *uint      `json:"assigned_user_id"`
	PurchaseDate    *time.Time `json:"purchase_date"`
	PurchaseCost    *float64   `json:"purchase_cost"`
	WarrantyEndDate *time.Time `json:"warranty_end_date"`
	Notes           string     `json:"notes"`
}

type UpdateAssetRequest struct {
	AssetTag        *string    `json:"asset_tag"`
	SerialNumber    *string    `json:"serial_number"`
	Name            *string    `json:"name"`
	Description     *string    `json:"description"`
	CategoryID      *uint      `json:"category_id"`
	TypeID          *uint      `json:"type_id"`
	StatusID        *uint      `json:"status_id"`
	ConditionID     *uint      `json:"condition_id"`
	LocationID      *uint      `json:"location_id"`
	VendorID        *uint      `json:"vendor_id"`
	AssignedUserID  *uint      `json:"assigned_user_id"`
	PurchaseDate    *time.Time `json:"purchase_date"`
	PurchaseCost    *float64   `json:"purchase_cost"`
	WarrantyEndDate *time.Time `json:"warranty_end_date"`
	Notes           *string    `json:"notes"`
	IsActive        *bool      `json:"is_active"`
}

// --- Asset Handlers ---

// ListAssets returns a paginated, filterable list of assets.
func ListAssets(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	query := database.DB.Model(&models.Asset{}).Where("is_active = ?", true)

	scopedLocationID, ok := EnforceLocationQuery(c)
	if !ok {
		return
	}

	// Filters
	if search := c.Query("search"); search != "" {
		query = query.Where("name ILIKE ? OR asset_tag ILIKE ? OR serial_number ILIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}
	if statusID := c.Query("status_id"); statusID != "" {
		query = query.Where("status_id = ?", statusID)
	}
	if categoryID := c.Query("category_id"); categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}
	if typeID := c.Query("type_id"); typeID != "" {
		query = query.Where("type_id = ?", typeID)
	}
	if locationID := c.Query("location_id"); locationID != "" {
		query = query.Where("location_id = ?", locationID)
	} else if scopedLocationID != "" {
		query = query.Where("location_id = ?", scopedLocationID)
	}
	if assignedUserID := c.Query("assigned_user_id"); assignedUserID != "" {
		if assignedUserID == "unassigned" {
			query = query.Where("assigned_user_id IS NULL")
		} else {
			query = query.Where("assigned_user_id = ?", assignedUserID)
		}
	}
	// Warranty expiry filter: show assets expiring within N days
	if warrantyDays := c.Query("warranty_expiring_days"); warrantyDays != "" {
		if days, err := strconv.Atoi(warrantyDays); err == nil {
			cutoff := time.Now().AddDate(0, 0, days)
			query = query.Where("warranty_end_date IS NOT NULL AND warranty_end_date <= ?", cutoff)
		}
	}
	if operationalBucket := c.Query("operational_bucket"); operationalBucket != "" {
		query = applyOperationalBucketFilter(query, operationalBucket)
	}

	var total int64
	query.Count(&total)

	var assets []models.Asset
	offset := (page - 1) * perPage
	query.
		Preload("Category").
		Preload("Type").
		Preload("Status").
		Preload("Condition").
		Preload("Location").
		Preload("Vendor").
		Preload("AssignedUser").
		Order("created_at DESC").
		Offset(offset).Limit(perPage).
		Find(&assets)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, gin.H{
		"assets":      assets,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// CreateAsset creates a new asset.
func CreateAsset(c *gin.Context) {
	var req CreateAssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)

	if req.LocationID != nil {
		if !EnforceLocationWrite(c, *req.LocationID) {
			return
		}
	} else if user, ok := middleware.GetUser(c); ok && user.HasLocationScope() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "location_id is required for your account scope"})
		return
	}

	tagCandidate := strings.TrimSpace(req.AssetTag)
	var asset models.Asset

	err := database.DB.Transaction(func(tx *gorm.DB) error {
		settings, sErr := getOrCreateITAMSettings(tx)
		if sErr != nil {
			return sErr
		}

		shouldAutoGenerate := req.AutoGenerateTag || (settings.AutoGenerateTag && tagCandidate == "")
		if shouldAutoGenerate {
			tag, tErr := nextAssetTagForLocation(tx, req.LocationID)
			if tErr != nil {
				return tErr
			}
			tagCandidate = tag
		}

		normalizedTag, nErr := normalizeAssetTagInput(tx, req.LocationID, tagCandidate)
		if nErr != nil {
			return nErr
		}
		tagCandidate = normalizedTag

		if tagCandidate == "" {
			return fmt.Errorf("asset tag is required")
		}

		asset = models.Asset{
			AssetTag:        tagCandidate,
			SerialNumber:    req.SerialNumber,
			Name:            req.Name,
			Description:     req.Description,
			CategoryID:      req.CategoryID,
			TypeID:          req.TypeID,
			StatusID:        req.StatusID,
			ConditionID:     req.ConditionID,
			LocationID:      req.LocationID,
			VendorID:        req.VendorID,
			AssignedUserID:  req.AssignedUserID,
			PurchaseDate:    req.PurchaseDate,
			PurchaseCost:    req.PurchaseCost,
			WarrantyEndDate: req.WarrantyEndDate,
			Notes:           req.Notes,
			IsActive:        true,
			CreatedBy:       userID,
			UpdatedBy:       userID,
		}

		return tx.Create(&asset).Error
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Reload with associations
	database.DB.
		Preload("Category").Preload("Type").Preload("Status").
		Preload("Condition").Preload("Location").Preload("Vendor").
		Preload("AssignedUser").
		First(&asset, asset.ID)

	LogAudit(c, models.AuditActionCreate, "asset", asset.ID, "",
		ToJSON(map[string]interface{}{
			"name": asset.Name, "asset_tag": asset.AssetTag,
		}),
		fmt.Sprintf("Asset '%s' (Tag: %s) created", asset.Name, asset.AssetTag))

	c.JSON(http.StatusCreated, gin.H{"asset": asset})
}

// GetAsset returns a single asset with all associations and linked tickets.
func GetAsset(c *gin.Context) {
	assetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}

	var asset models.Asset
	if err := database.DB.
		Preload("Category").Preload("Type").Preload("Status").
		Preload("Condition").Preload("Location").Preload("Vendor").
		Preload("AssignedUser").
		First(&asset, uint(assetID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}

	if !EnforceAssetLocationWrite(c, asset) {
		return
	}

	// Also fetch linked tickets
	var links []models.AssetTicketLink
	database.DB.
		Preload("Ticket").
		Preload("Ticket.Requester").
		Preload("Ticket.Assignee").
		Where("asset_id = ?", asset.ID).
		Find(&links)

	c.JSON(http.StatusOK, gin.H{"asset": asset, "linked_tickets": links})
}

// UpdateAsset partially updates an asset.
func UpdateAsset(c *gin.Context) {
	assetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}

	var req UpdateAssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)

	var asset models.Asset
	if err := database.DB.First(&asset, uint(assetID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}

	if !EnforceAssetLocationWrite(c, asset) {
		return
	}

	oldValues := ToJSON(map[string]interface{}{
		"name": asset.Name, "asset_tag": asset.AssetTag, "status_id": asset.StatusID,
	})

	effectiveLocationID := asset.LocationID
	if req.LocationID != nil {
		effectiveLocationID = req.LocationID
	}

	// Apply updates
	if req.AssetTag != nil {
		normalizedTag, err := normalizeAssetTagInput(database.DB, effectiveLocationID, *req.AssetTag)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		asset.AssetTag = normalizedTag
	}
	if req.SerialNumber != nil {
		asset.SerialNumber = *req.SerialNumber
	}
	if req.Name != nil {
		asset.Name = *req.Name
	}
	if req.Description != nil {
		asset.Description = *req.Description
	}
	if req.CategoryID != nil {
		asset.CategoryID = *req.CategoryID
	}
	if req.TypeID != nil {
		asset.TypeID = *req.TypeID
	}
	if req.StatusID != nil {
		asset.StatusID = *req.StatusID
	}
	if req.ConditionID != nil {
		asset.ConditionID = req.ConditionID
	}
	if req.LocationID != nil {
		if !EnforceLocationWrite(c, *req.LocationID) {
			return
		}
		asset.LocationID = req.LocationID
	}
	if req.VendorID != nil {
		asset.VendorID = req.VendorID
	}
	if req.AssignedUserID != nil {
		if *req.AssignedUserID == 0 {
			asset.AssignedUserID = nil
		} else {
			asset.AssignedUserID = req.AssignedUserID
		}
	}
	if req.PurchaseDate != nil {
		asset.PurchaseDate = req.PurchaseDate
	}
	if req.PurchaseCost != nil {
		asset.PurchaseCost = req.PurchaseCost
	}
	if req.WarrantyEndDate != nil {
		asset.WarrantyEndDate = req.WarrantyEndDate
	}
	if req.Notes != nil {
		asset.Notes = *req.Notes
	}
	if req.IsActive != nil {
		asset.IsActive = *req.IsActive
	}
	asset.UpdatedBy = userID

	if err := database.DB.Save(&asset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update asset"})
		return
	}

	// Reload with associations
	database.DB.
		Preload("Category").Preload("Type").Preload("Status").
		Preload("Condition").Preload("Location").Preload("Vendor").
		Preload("AssignedUser").
		First(&asset, asset.ID)

	LogAudit(c, models.AuditActionUpdate, "asset", asset.ID,
		oldValues,
		ToJSON(map[string]interface{}{"name": asset.Name, "status_id": asset.StatusID}),
		fmt.Sprintf("Asset '%s' updated", asset.Name))

	c.JSON(http.StatusOK, gin.H{"asset": asset})
}

// DeleteAsset soft-deletes an asset.
func DeleteAsset(c *gin.Context) {
	assetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}

	var asset models.Asset
	if err := database.DB.First(&asset, uint(assetID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}

	if err := database.DB.Delete(&asset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete asset"})
		return
	}

	LogAudit(c, models.AuditActionDelete, "asset", asset.ID,
		ToJSON(map[string]interface{}{"name": asset.Name, "asset_tag": asset.AssetTag}),
		"", fmt.Sprintf("Asset '%s' deleted", asset.Name))

	c.JSON(http.StatusOK, gin.H{"message": "Asset deleted"})
}

// GetITAMStats returns summary statistics for the ITAM dashboard.
func GetITAMStats(c *gin.Context) {
	type StatusResult struct {
		StatusID uint   `json:"status_id"`
		Name     string `json:"name"`
		Count    int64  `json:"count"`
	}

	scopedLocationID, ok := EnforceLocationQuery(c)
	if !ok {
		return
	}

	baseQuery := database.DB.Model(&models.Asset{}).Where("is_active = ?", true)
	if scopedLocationID != "" {
		baseQuery = baseQuery.Where("location_id = ?", scopedLocationID)
	}

	var totalAssets int64
	baseQuery.Count(&totalAssets)

	unassignedQuery := database.DB.Model(&models.Asset{}).Where("is_active = ? AND assigned_user_id IS NULL", true)
	if scopedLocationID != "" {
		unassignedQuery = unassignedQuery.Where("location_id = ?", scopedLocationID)
	}
	var unassigned int64
	unassignedQuery.Count(&unassigned)

	// Warranty expiring in next 30 days (kept for API compatibility)
	cutoff := time.Now().AddDate(0, 0, 30)
	warrantyQuery := database.DB.Model(&models.Asset{}).
		Where("is_active = ? AND warranty_end_date IS NOT NULL AND warranty_end_date <= ? AND warranty_end_date >= ?", true, cutoff, time.Now())
	if scopedLocationID != "" {
		warrantyQuery = warrantyQuery.Where("location_id = ?", scopedLocationID)
	}
	var warrantyExpiringSoon int64
	warrantyQuery.Count(&warrantyExpiringSoon)

	warrantyExpiredQuery := database.DB.Model(&models.Asset{}).
		Where("is_active = ? AND warranty_end_date IS NOT NULL AND warranty_end_date < ?", true, time.Now())
	if scopedLocationID != "" {
		warrantyExpiredQuery = warrantyExpiredQuery.Where("location_id = ?", scopedLocationID)
	}
	var warrantyExpired int64
	warrantyExpiredQuery.Count(&warrantyExpired)

	var statusBreakdown []StatusResult
	statusQuery := database.DB.Table("assets").
		Select("assets.status_id, asset_statuses.name, count(*) as count").
		Joins("JOIN asset_statuses ON asset_statuses.id = assets.status_id").
		Where("assets.deleted_at IS NULL AND assets.is_active = ?", true)
	if scopedLocationID != "" {
		statusQuery = statusQuery.Where("assets.location_id = ?", scopedLocationID)
	}
	statusQuery.Group("assets.status_id, asset_statuses.name").Find(&statusBreakdown)

	var inUse, needAttention, outOfService int64
	for _, s := range statusBreakdown {
		name := strings.ToLower(strings.TrimSpace(s.Name))
		switch {
		case name == "in use" || name == "available" || name == "in stock":
			inUse += s.Count
		case name == "in repair" || name == "needs repair" || name == "need attention" || name == "need attention/repair":
			needAttention += s.Count
		case name == "decommissioned" || name == "decommission" || name == "broken" || name == "out of service":
			outOfService += s.Count
		}
	}

	type LocationResult struct {
		LocationID *uint  `json:"location_id"`
		Name       string `json:"name"`
		Count      int64  `json:"count"`
	}
	var byLocation []LocationResult
	locationQuery := database.DB.Table("assets").
		Select("assets.location_id, COALESCE(locations.name, 'Unassigned') as name, count(*) as count").
		Joins("LEFT JOIN locations ON locations.id = assets.location_id").
		Where("assets.deleted_at IS NULL AND assets.is_active = ?", true)
	if scopedLocationID != "" {
		locationQuery = locationQuery.Where("assets.location_id = ?", scopedLocationID)
	}
	locationQuery.Group("assets.location_id, locations.name").
		Order("count DESC").
		Limit(8).
		Find(&byLocation)

	c.JSON(http.StatusOK, gin.H{
		"total_assets":           totalAssets,
		"unassigned":             unassigned,
		"warranty_expiring_soon": warrantyExpiringSoon,
		"warranty_expired":       warrantyExpired,
		"by_status":              statusBreakdown,
		"by_location":            byLocation,
		"operational": gin.H{
			"in_use":          inUse,
			"need_attention":  needAttention,
			"out_of_service":  outOfService,
			"unassigned":      unassigned,
		},
	})
}

// --- Asset-Ticket Linking ---

type LinkAssetRequest struct {
	AssetID          uint   `json:"asset_id" binding:"required"`
	RelationshipType string `json:"relationship_type" binding:"required,oneof=AFFECTED_ASSET REQUESTED_ASSET"`
}

// ListMyAssets returns assets assigned to the authenticated user.
func ListMyAssets(c *gin.Context) {
	userID := c.MustGet("userID").(uint)

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	query := database.DB.Model(&models.Asset{}).
		Where("is_active = ? AND assigned_user_id = ?", true, userID)

	if search := c.Query("search"); search != "" {
		query = query.Where(
			"name ILIKE ? OR asset_tag ILIKE ? OR serial_number ILIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%",
		)
	}

	var total int64
	query.Count(&total)

	var assets []models.Asset
	offset := (page - 1) * perPage
	query.
		Preload("Category").
		Preload("Type").
		Preload("Status").
		Preload("Condition").
		Preload("Location").
		Preload("Vendor").
		Preload("AssignedUser").
		Order("updated_at DESC").
		Offset(offset).Limit(perPage).
		Find(&assets)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, gin.H{
		"assets":      assets,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// LinkAssetToTicket links an asset to a ticket.
func LinkAssetToTicket(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	var req LinkAssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)

	// Validate ticket exists
	var ticket models.Ticket
	if err := database.DB.First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	// Validate asset exists
	var asset models.Asset
	if err := database.DB.First(&asset, req.AssetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}

	// Prevent duplicate links
	var existing models.AssetTicketLink
	if err := database.DB.Where("asset_id = ? AND ticket_id = ?", req.AssetID, uint(ticketID)).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Asset is already linked to this ticket"})
		return
	}

	link := models.AssetTicketLink{
		AssetID:          req.AssetID,
		TicketID:         uint(ticketID),
		RelationshipType: req.RelationshipType,
		CreatedBy:        userID,
	}

	if err := database.DB.Create(&link).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to link asset"})
		return
	}

	// Reload with associations
	database.DB.Preload("Asset").Preload("Asset.Status").Preload("Asset.Type").First(&link, link.ID)

	LogAudit(c, models.AuditActionUpdate, "ticket", uint(ticketID), "",
		ToJSON(map[string]interface{}{"linked_asset": asset.Name}),
		fmt.Sprintf("Asset '%s' (Tag: %s) linked to Ticket #%d", asset.Name, asset.AssetTag, ticketID))

	c.JSON(http.StatusCreated, gin.H{"link": link})
}

// UnlinkAssetFromTicket removes an asset-ticket link.
func UnlinkAssetFromTicket(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}
	assetID, err := strconv.ParseUint(c.Param("assetId"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}

	var link models.AssetTicketLink
	if err := database.DB.Where("ticket_id = ? AND asset_id = ?", uint(ticketID), uint(assetID)).First(&link).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Link not found"})
		return
	}

	if err := database.DB.Delete(&link).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlink asset"})
		return
	}

	LogAudit(c, models.AuditActionUpdate, "ticket", uint(ticketID), "",
		"", fmt.Sprintf("Asset #%d unlinked from Ticket #%d", assetID, ticketID))

	c.JSON(http.StatusOK, gin.H{"message": "Asset unlinked from ticket"})
}

// GetTicketLinkedAssets returns all assets linked to a ticket.
func GetTicketLinkedAssets(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}

	var links []models.AssetTicketLink
	database.DB.
		Preload("Asset").
		Preload("Asset.Status").
		Preload("Asset.Type").
		Preload("Asset.Category").
		Preload("Asset.Location").
		Preload("Asset.AssignedUser").
		Where("ticket_id = ?", uint(ticketID)).
		Find(&links)

	c.JSON(http.StatusOK, gin.H{"linked_assets": links})
}

// SearchAssets is a lightweight endpoint for asset search in ticket linking dropdowns.
func SearchAssets(c *gin.Context) {
	search := c.Query("q")
	if search == "" {
		c.JSON(http.StatusOK, gin.H{"assets": []models.Asset{}})
		return
	}

	scopedLocationID, ok := EnforceLocationQuery(c)
	if !ok {
		return
	}

	query := database.DB.
		Preload("Status").Preload("Type").Preload("Category").Preload("Location").
		Where("is_active = ? AND (name ILIKE ? OR asset_tag ILIKE ? OR serial_number ILIKE ?)",
			true, "%"+search+"%", "%"+search+"%", "%"+search+"%")

	if scopedLocationID != "" {
		query = query.Where("location_id = ?", scopedLocationID)
	}
	if locationFilter := c.Query("location_id"); locationFilter != "" && scopedLocationID == "" {
		query = query.Where("location_id = ?", locationFilter)
	}

	var assets []models.Asset
	query.Limit(10).Find(&assets)

	c.JSON(http.StatusOK, gin.H{"assets": assets})
}
