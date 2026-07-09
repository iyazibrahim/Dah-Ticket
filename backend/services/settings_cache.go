package services

import (
	"sync"
	"time"

	"dahticket-backend/database"
	"dahticket-backend/models"
)

var (
	settingsMu    sync.RWMutex
	settingsCache = map[uint]models.ITAMSettings{}
	settingsTTL   = map[uint]time.Time{}
	settingsCacheTTL = 30 * time.Second
)

// GetAppSettings returns organization settings with a short in-memory cache.
func GetAppSettings(orgID uint) (models.ITAMSettings, error) {
	if orgID == 0 {
		orgID = 1
	}

	settingsMu.RLock()
	if loaded, ok := settingsTTL[orgID]; ok && !loaded.IsZero() && time.Since(loaded) < settingsCacheTTL {
		s := settingsCache[orgID]
		settingsMu.RUnlock()
		return s, nil
	}
	settingsMu.RUnlock()

	var settings models.ITAMSettings
	if err := database.DB.Where("organization_id = ?", orgID).First(&settings).Error; err != nil {
		// Fallback to first row for legacy single-tenant data
		if err2 := database.DB.First(&settings).Error; err2 != nil {
			return settings, err
		}
	}

	settingsMu.Lock()
	settingsCache[orgID] = settings
	settingsTTL[orgID] = time.Now()
	settingsMu.Unlock()
	return settings, nil
}

// IsPublicRegistrationAllowed reports whether open self-registration is permitted.
func IsPublicRegistrationAllowed(orgID uint) bool {
	settings, err := GetAppSettings(orgID)
	if err != nil {
		return true
	}
	return settings.AllowPublicRegistration
}

// InvalidateSettingsCache clears cached settings after admin updates.
func InvalidateSettingsCache() {
	settingsMu.Lock()
	settingsCache = map[uint]models.ITAMSettings{}
	settingsTTL = map[uint]time.Time{}
	settingsMu.Unlock()
	RefreshEmailConfig()
}
