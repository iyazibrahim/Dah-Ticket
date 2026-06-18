package handlers

import (
	"net/http"
	"strconv"

	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
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
	if asset.LocationID == nil {
		user, ok := middleware.GetUser(c)
		if ok && user.HasLocationScope() {
			denyLocationScope(c)
			return false
		}
		return true
	}
	return EnforceLocationWrite(c, *asset.LocationID)
}
