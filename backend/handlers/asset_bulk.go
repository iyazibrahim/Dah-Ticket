package handlers

import (
	"fmt"
	"net/http"

	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

const maxBulkAssetIDs = 500

type BulkAssetActionRequest struct {
	AssetIDs  []uint                `json:"asset_ids"`
	SelectAll bool                  `json:"select_all"`
	Filters   AssetListFilterParams `json:"filters"`
}

type BulkAssignAssetsRequest struct {
	BulkAssetActionRequest
	AssignedUserID *uint `json:"assigned_user_id"`
	Unassign       bool  `json:"unassign"`
}

type BulkAssetActionError struct {
	AssetID uint   `json:"asset_id"`
	Error   string `json:"error"`
}

type BulkAssetActionResponse struct {
	Processed int                    `json:"processed"`
	Failed    int                    `json:"failed"`
	Errors    []BulkAssetActionError `json:"errors"`
}

func resolveBulkAssetIDs(c *gin.Context, req BulkAssetActionRequest) ([]models.Asset, *BulkAssetActionResponse) {
	if req.SelectAll {
		query, ok := buildAssetListQueryWithFilters(c, req.Filters)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied for this location"})
			return nil, nil
		}
		var assets []models.Asset
		if err := query.Find(&assets).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve assets"})
			return nil, nil
		}
		return assets, nil
	}

	if len(req.AssetIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "asset_ids is required when select_all is false"})
		return nil, nil
	}
	if len(req.AssetIDs) > maxBulkAssetIDs {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("asset_ids cannot exceed %d", maxBulkAssetIDs)})
		return nil, nil
	}

	var assets []models.Asset
	if err := database.DB.Where("is_active = ? AND id IN ?", true, req.AssetIDs).Find(&assets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve assets"})
		return nil, nil
	}

	found := make(map[uint]bool, len(assets))
	for _, asset := range assets {
		found[asset.ID] = true
	}

	resp := BulkAssetActionResponse{Errors: []BulkAssetActionError{}}
	for _, id := range req.AssetIDs {
		if !found[id] {
			resp.Failed++
			resp.Errors = append(resp.Errors, BulkAssetActionError{
				AssetID: id,
				Error:   "Asset not found",
			})
		}
	}

	return assets, &resp
}

// BulkDeleteAssets soft-deletes multiple assets by ID or matching filters.
func BulkDeleteAssets(c *gin.Context) {
	var req BulkAssetActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assets, partial := resolveBulkAssetIDs(c, req)
	if assets == nil {
		return
	}

	resp := BulkAssetActionResponse{Errors: []BulkAssetActionError{}}
	if partial != nil {
		resp = *partial
	}

	for _, asset := range assets {
		if !canWriteAssetLocation(c, asset) {
			resp.Failed++
			resp.Errors = append(resp.Errors, BulkAssetActionError{
				AssetID: asset.ID,
				Error:   "Access denied for this location",
			})
			continue
		}

		if err := database.DB.Delete(&asset).Error; err != nil {
			resp.Failed++
			resp.Errors = append(resp.Errors, BulkAssetActionError{
				AssetID: asset.ID,
				Error:   "Failed to delete asset",
			})
			continue
		}

		LogAudit(c, models.AuditActionDelete, "asset", asset.ID,
			ToJSON(map[string]interface{}{"name": asset.Name, "asset_tag": asset.AssetTag}),
			"", fmt.Sprintf("Asset '%s' deleted (bulk)", asset.Name))
		resp.Processed++
	}

	c.JSON(http.StatusOK, resp)
}

// BulkAssignAssets assigns or unassigns multiple assets by ID or matching filters.
func BulkAssignAssets(c *gin.Context) {
	var req BulkAssignAssetsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)

	var assigneeID *uint
	if req.Unassign {
		assigneeID = nil
	} else if req.AssignedUserID != nil && *req.AssignedUserID > 0 {
		var assignee models.User
		if err := database.DB.Where("id = ? AND is_active = ?", *req.AssignedUserID, true).First(&assignee).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Assigned user not found or inactive"})
			return
		}
		assigneeID = req.AssignedUserID
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "assigned_user_id or unassign is required"})
		return
	}

	assets, partial := resolveBulkAssetIDs(c, req.BulkAssetActionRequest)
	if assets == nil {
		return
	}

	resp := BulkAssetActionResponse{Errors: []BulkAssetActionError{}}
	if partial != nil {
		resp = *partial
	}

	for _, asset := range assets {
		if !canWriteAssetLocation(c, asset) {
			resp.Failed++
			resp.Errors = append(resp.Errors, BulkAssetActionError{
				AssetID: asset.ID,
				Error:   "Access denied for this location",
			})
			continue
		}

		oldAssignee := asset.AssignedUserID
		asset.AssignedUserID = assigneeID
		asset.UpdatedBy = userID

		if err := database.DB.Save(&asset).Error; err != nil {
			resp.Failed++
			resp.Errors = append(resp.Errors, BulkAssetActionError{
				AssetID: asset.ID,
				Error:   "Failed to assign asset",
			})
			continue
		}

		LogAudit(c, models.AuditActionUpdate, "asset", asset.ID,
			ToJSON(map[string]interface{}{"assigned_user_id": oldAssignee}),
			ToJSON(map[string]interface{}{"assigned_user_id": assigneeID}),
			fmt.Sprintf("Asset '%s' assignment updated (bulk)", asset.Name))
		resp.Processed++
	}

	c.JSON(http.StatusOK, resp)
}
