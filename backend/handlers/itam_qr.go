package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

func buildAssetQRToken(assetID uint) string {
	payload := fmt.Sprintf("AT1.%d", assetID)
	mac := hmac.New(sha256.New, []byte(config.AppConfig.JWTSecret))
	mac.Write([]byte(payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return payload + "." + sig
}

func verifyAssetQRToken(token string) (uint, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 || parts[0] != "AT1" {
		return 0, false
	}

	id, err := strconv.ParseUint(parts[1], 10, 32)
	if err != nil || id == 0 {
		return 0, false
	}

	payload := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(config.AppConfig.JWTSecret))
	mac.Write([]byte(payload))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return 0, false
	}

	return uint(id), true
}

func GetAssetQRToken(c *gin.Context) {
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

	c.JSON(http.StatusOK, gin.H{
		"asset_id": asset.ID,
		"token":    buildAssetQRToken(asset.ID),
	})
}

type ResolveQRRequest struct {
	Token string `json:"token" binding:"required"`
}

func ResolveAssetQRToken(c *gin.Context) {
	var req ResolveQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assetID, ok := verifyAssetQRToken(strings.TrimSpace(req.Token))
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid asset QR token"})
		return
	}

	var asset models.Asset
	if err := database.DB.
		Preload("Category").Preload("Type").Preload("Status").
		Preload("Location").Preload("AssignedUser").
		First(&asset, assetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"asset":      asset,
		"redirect_to": fmt.Sprintf("/itam/assets/%d", asset.ID),
	})
}
