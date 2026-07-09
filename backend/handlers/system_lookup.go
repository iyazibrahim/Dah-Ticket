package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

type LookupItemResponse struct {
	Key       string                 `json:"key"`
	Label     string                 `json:"label"`
	SortOrder int                    `json:"sort_order"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type CreateLookupRequest struct {
	Key       string                 `json:"key" binding:"required,max=80"`
	Label     string                 `json:"label" binding:"required,max=150"`
	SortOrder int                    `json:"sort_order"`
	Metadata  map[string]interface{} `json:"metadata"`
	IsActive  *bool                  `json:"is_active"`
}

type UpdateLookupRequest struct {
	Label     *string                `json:"label"`
	SortOrder *int                   `json:"sort_order"`
	Metadata  map[string]interface{} `json:"metadata"`
	IsActive  *bool                  `json:"is_active"`
}

func parseLookupMetadata(raw string) map[string]interface{} {
	if raw == "" {
		return nil
	}
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(raw), &m); err != nil {
		return nil
	}
	return m
}

func metadataToJSON(m map[string]interface{}) string {
	if m == nil {
		return ""
	}
	b, err := json.Marshal(m)
	if err != nil {
		return ""
	}
	return string(b)
}

func orgIDFromContext(c *gin.Context) uint {
	user, ok := middleware.GetUser(c)
	if ok && user.OrganizationID > 0 {
		return user.OrganizationID
	}
	return middleware.GetOrganizationID(c)
}

// ListLookups returns active lookup items for a group (authenticated).
func ListLookups(c *gin.Context) {
	group := c.Param("group")
	if group == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Group is required"})
		return
	}
	orgID := orgIDFromContext(c)

	var rows []models.SystemLookup
	database.DB.Where("organization_id = ? AND \"group\" = ? AND is_active = ?", orgID, group, true).
		Order("sort_order ASC, label ASC").
		Find(&rows)

	items := make([]LookupItemResponse, len(rows))
	for i, r := range rows {
		items[i] = LookupItemResponse{
			Key:       r.Key,
			Label:     r.Label,
			SortOrder: r.SortOrder,
			Metadata:  parseLookupMetadata(r.Metadata),
		}
	}
	c.JSON(http.StatusOK, gin.H{"group": group, "items": items})
}

// AdminListLookups returns all lookup items for admin management.
func AdminListLookups(c *gin.Context) {
	group := c.Query("group")
	orgID := orgIDFromContext(c)

	q := database.DB.Where("organization_id = ?", orgID)
	if group != "" {
		q = q.Where("\"group\" = ?", group)
	}
	var rows []models.SystemLookup
	q.Order("\"group\" ASC, sort_order ASC, label ASC").Find(&rows)

	type rowResp struct {
		ID        uint                   `json:"id"`
		Group     string                 `json:"group"`
		Key       string                 `json:"key"`
		Label     string                 `json:"label"`
		SortOrder int                    `json:"sort_order"`
		Metadata  map[string]interface{} `json:"metadata,omitempty"`
		IsActive  bool                   `json:"is_active"`
	}
	out := make([]rowResp, len(rows))
	for i, r := range rows {
		out[i] = rowResp{
			ID: r.ID, Group: r.Group, Key: r.Key, Label: r.Label,
			SortOrder: r.SortOrder, Metadata: parseLookupMetadata(r.Metadata), IsActive: r.IsActive,
		}
	}
	c.JSON(http.StatusOK, gin.H{"lookups": out})
}

// AdminCreateLookup creates a lookup item.
func AdminCreateLookup(c *gin.Context) {
	group := c.Param("group")
	var req CreateLookupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	orgID := orgIDFromContext(c)

	var existing int64
	database.DB.Model(&models.SystemLookup{}).
		Where("organization_id = ? AND \"group\" = ? AND key = ?", orgID, group, req.Key).
		Count(&existing)
	if existing > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Lookup key already exists in this group"})
		return
	}

	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	row := models.SystemLookup{
		OrganizationID: orgID,
		Group:          group,
		Key:            req.Key,
		Label:          req.Label,
		SortOrder:      req.SortOrder,
		Metadata:       metadataToJSON(req.Metadata),
		IsActive:       active,
	}
	if err := database.DB.Create(&row).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create lookup"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"lookup": row})
}

// AdminUpdateLookup updates a lookup item.
func AdminUpdateLookup(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid lookup ID"})
		return
	}
	var req UpdateLookupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	orgID := orgIDFromContext(c)

	var row models.SystemLookup
	if err := database.DB.Where("id = ? AND organization_id = ?", id, orgID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lookup not found"})
		return
	}
	updates := map[string]interface{}{}
	if req.Label != nil {
		updates["label"] = *req.Label
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if req.Metadata != nil {
		updates["metadata"] = metadataToJSON(req.Metadata)
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if len(updates) > 0 {
		database.DB.Model(&row).Updates(updates)
		database.DB.First(&row, row.ID)
	}
	c.JSON(http.StatusOK, gin.H{"lookup": row})
}

// AdminDeleteLookup soft-deletes a lookup item.
func AdminDeleteLookup(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid lookup ID"})
		return
	}
	orgID := orgIDFromContext(c)

	var row models.SystemLookup
	if err := database.DB.Where("id = ? AND organization_id = ?", id, orgID).First(&row).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lookup not found"})
		return
	}
	database.DB.Delete(&row)
	c.JSON(http.StatusOK, gin.H{"message": "Lookup deleted"})
}

// LookupKeyValid checks if a key exists and is active in a lookup group.
func LookupKeyValid(orgID uint, group, key string) bool {
	if key == "" {
		return false
	}
	var count int64
	database.DB.Model(&models.SystemLookup{}).
		Where("organization_id = ? AND \"group\" = ? AND key = ? AND is_active = ?", orgID, group, key, true).
		Count(&count)
	return count > 0
}

// LookupPausesSLA returns whether a hold reason key pauses SLA per metadata.
func LookupPausesSLA(orgID uint, holdKey string) bool {
	var row models.SystemLookup
	if err := database.DB.Where("organization_id = ? AND \"group\" = ? AND key = ? AND is_active = ?",
		orgID, models.LookupHoldReason, holdKey, true).First(&row).Error; err != nil {
		return holdKey == "awaiting_customer" || holdKey == "awaiting_vendor"
	}
	meta := parseLookupMetadata(row.Metadata)
	if v, ok := meta["pauses_sla"].(bool); ok {
		return v
	}
	return false
}
