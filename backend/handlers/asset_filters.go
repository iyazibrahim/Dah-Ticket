package handlers

import (
	"strconv"
	"strings"
	"time"

	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AssetListFilterParams mirrors list query filters for bulk select-all operations.
type AssetListFilterParams struct {
	Search               string `json:"search"`
	StatusID             string `json:"status_id"`
	CategoryID           string `json:"category_id"`
	TypeID               string `json:"type_id"`
	LocationID           string `json:"location_id"`
	AssignedUserID       string `json:"assigned_user_id"`
	WarrantyExpiringDays string `json:"warranty_expiring_days"`
	OperationalBucket    string `json:"operational_bucket"`
}

func assetListFiltersFromQuery(c *gin.Context) AssetListFilterParams {
	return AssetListFilterParams{
		Search:               c.Query("search"),
		StatusID:             c.Query("status_id"),
		CategoryID:           c.Query("category_id"),
		TypeID:               c.Query("type_id"),
		LocationID:           c.Query("location_id"),
		AssignedUserID:       c.Query("assigned_user_id"),
		WarrantyExpiringDays: c.Query("warranty_expiring_days"),
		OperationalBucket:    c.Query("operational_bucket"),
	}
}

func resolveScopedLocation(c *gin.Context, requestedLocationID string) (string, bool) {
	user, ok := middleware.GetUser(c)
	if !ok || !user.HasLocationScope() {
		return requestedLocationID, true
	}
	scoped := strconv.FormatUint(uint64(*user.PrimaryLocationID), 10)
	if requestedLocationID != "" && requestedLocationID != scoped {
		return "", false
	}
	return scoped, true
}

func applyAssetListFilters(query *gorm.DB, filters AssetListFilterParams, scopedLocationID string) *gorm.DB {
	if filters.Search != "" {
		query = query.Where("name ILIKE ? OR asset_tag ILIKE ? OR serial_number ILIKE ?",
			"%"+filters.Search+"%", "%"+filters.Search+"%", "%"+filters.Search+"%")
	}
	if filters.StatusID != "" {
		query = query.Where("status_id = ?", filters.StatusID)
	}
	if filters.CategoryID != "" {
		query = query.Where("category_id = ?", filters.CategoryID)
	}
	if filters.TypeID != "" {
		query = query.Where("type_id = ?", filters.TypeID)
	}
	if filters.LocationID != "" {
		query = query.Where("location_id = ?", filters.LocationID)
	} else if scopedLocationID != "" {
		query = query.Where("location_id = ?", scopedLocationID)
	}
	if filters.AssignedUserID != "" {
		if filters.AssignedUserID == "unassigned" {
			query = query.Where("assigned_user_id IS NULL")
		} else {
			query = query.Where("assigned_user_id = ?", filters.AssignedUserID)
		}
	}
	if filters.WarrantyExpiringDays != "" {
		if days, err := strconv.Atoi(filters.WarrantyExpiringDays); err == nil {
			cutoff := time.Now().AddDate(0, 0, days)
			query = query.Where("warranty_end_date IS NOT NULL AND warranty_end_date <= ?", cutoff)
		}
	}
	if filters.OperationalBucket != "" {
		query = applyOperationalBucketFilter(query, filters.OperationalBucket)
	}
	return query
}

// buildAssetListQueryFromContext builds a filtered asset query from HTTP query params.
func buildAssetListQueryFromContext(c *gin.Context) (*gorm.DB, bool) {
	filters := assetListFiltersFromQuery(c)
	scopedLocationID, ok := resolveScopedLocation(c, filters.LocationID)
	if !ok {
		denyLocationScope(c)
		return nil, false
	}
	query := database.DB.Model(&models.Asset{}).Where("is_active = ?", true)
	query = applyAssetListFilters(query, filters, scopedLocationID)
	return query, true
}

// buildAssetListQueryWithFilters builds a filtered asset query from explicit filter params.
func buildAssetListQueryWithFilters(c *gin.Context, filters AssetListFilterParams) (*gorm.DB, bool) {
	scopedLocationID, ok := resolveScopedLocation(c, filters.LocationID)
	if !ok {
		return nil, false
	}
	query := database.DB.Model(&models.Asset{}).Where("is_active = ?", true)
	query = applyAssetListFilters(query, filters, scopedLocationID)
	return query, true
}

func operationalBucketStatusNames(bucket string) []string {
	switch bucket {
	case "in_use":
		return []string{"in use", "available", "in stock"}
	case "need_attention":
		return []string{"in repair", "needs repair", "need attention", "need attention/repair"}
	case "out_of_service":
		return []string{"decommissioned", "decommission", "broken", "out of service"}
	default:
		return nil
	}
}

func applyOperationalBucketFilter(query *gorm.DB, bucket string) *gorm.DB {
	bucket = strings.ToLower(strings.TrimSpace(bucket))
	switch bucket {
	case "unassigned":
		return query.Where("assigned_user_id IS NULL")
	case "in_use", "need_attention", "out_of_service":
		names := operationalBucketStatusNames(bucket)
		if len(names) == 0 {
			return query
		}
		return query.Joins("JOIN asset_statuses ON asset_statuses.id = assets.status_id").
			Where("LOWER(TRIM(asset_statuses.name)) IN ?", names)
	default:
		return query
	}
}
