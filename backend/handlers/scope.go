package handlers

import (
	"net/http"
	"strconv"

	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func denyLocationScope(c *gin.Context) {
	c.JSON(http.StatusForbidden, gin.H{"error": "Access denied for this location"})
}

// EnforceLocationQuery applies PIC location scope to optional location_id query params.
// Returns the effective location filter and false if the request was denied.
func EnforceLocationQuery(c *gin.Context) (string, bool) {
	queryLoc := c.Query("location_id")
	user, ok := middleware.GetUser(c)
	if !ok || !user.HasLocationScope() {
		return queryLoc, true
	}
	scoped := strconv.FormatUint(uint64(*user.PrimaryLocationID), 10)
	if queryLoc != "" && queryLoc != scoped {
		denyLocationScope(c)
		return "", false
	}
	return scoped, true
}

// EnforceLocationWrite returns false if the user cannot write to the given location.
func EnforceLocationWrite(c *gin.Context, locationID uint) bool {
	user, ok := middleware.GetUser(c)
	if !ok || !user.HasLocationScope() {
		return true
	}
	if user.PrimaryLocationID == nil || *user.PrimaryLocationID != locationID {
		denyLocationScope(c)
		return false
	}
	return true
}

// EnforceAssetLocationWrite returns false if the user cannot access the asset's location.
func EnforceAssetLocationWrite(c *gin.Context, asset models.Asset) bool {
	if !canWriteAssetLocation(c, asset) {
		denyLocationScope(c)
		return false
	}
	return true
}

// canWriteAssetLocation checks location write access without writing an HTTP response.
func canWriteAssetLocation(c *gin.Context, asset models.Asset) bool {
	if asset.LocationID == nil {
		user, ok := middleware.GetUser(c)
		if ok && user.HasLocationScope() {
			return false
		}
		return true
	}
	user, ok := middleware.GetUser(c)
	if !ok || !user.HasLocationScope() {
		return true
	}
	if user.PrimaryLocationID == nil || *user.PrimaryLocationID != *asset.LocationID {
		return false
	}
	return true
}

// EnforceTicketLocationQuery applies PIC location scope to ticket list queries.
func EnforceTicketLocationQuery(c *gin.Context, query *gorm.DB) (*gorm.DB, bool) {
	user, ok := middleware.GetUser(c)
	if !ok || !user.HasLocationScope() {
		if locID := c.Query("location_id"); locID != "" {
			return query.Where("location_id = ?", locID), true
		}
		return query, true
	}
	scoped := strconv.FormatUint(uint64(*user.PrimaryLocationID), 10)
	queryLoc := c.Query("location_id")
	if queryLoc != "" && queryLoc != scoped {
		denyLocationScope(c)
		return query, false
	}
	return query.Where("location_id = ?", *user.PrimaryLocationID), true
}

// applyTicketOrgVisibility restricts tickets by organization and central intake routing.
func applyTicketOrgVisibility(query *gorm.DB, user models.User, orgID uint) *gorm.DB {
	if user.IsSuperAdmin {
		return query
	}
	effectiveOrg := user.OrganizationID
	if effectiveOrg == 0 {
		effectiveOrg = orgID
	}

	var org models.Organization
	if err := database.DB.First(&org, effectiveOrg).Error; err == nil && org.CanSeeChildOrgs() {
		var childIDs []uint
		database.DB.Model(&models.Organization{}).Where("parent_org_id = ?", org.ID).Pluck("id", &childIDs)
		childIDs = append(childIDs, org.ID)
		return query.Where(
			"(organization_id IN ? OR routed_to_org_id = ?)",
			childIDs, org.ID,
		)
	}

	return query.Where(
		"(organization_id = ? OR routed_to_org_id = ?)",
		effectiveOrg, effectiveOrg,
	)
}
