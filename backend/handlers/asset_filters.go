package handlers

import (
	"strings"

	"gorm.io/gorm"
)

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
