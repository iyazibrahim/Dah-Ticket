package services

import (
	"sync"
	"time"

	"dahticket-backend/database"
	"dahticket-backend/models"
)

var (
	settingsMu       sync.RWMutex
	cachedSettings   models.ITAMSettings
	settingsLoadedAt time.Time
	settingsCacheTTL = 30 * time.Second
)

// GetAppSettings returns ITAM/system settings with a short in-memory cache.
func GetAppSettings() (models.ITAMSettings, error) {
	settingsMu.RLock()
	if !settingsLoadedAt.IsZero() && time.Since(settingsLoadedAt) < settingsCacheTTL {
		s := cachedSettings
		settingsMu.RUnlock()
		return s, nil
	}
	settingsMu.RUnlock()

	var settings models.ITAMSettings
	if err := database.DB.First(&settings).Error; err != nil {
		return settings, err
	}

	settingsMu.Lock()
	cachedSettings = settings
	settingsLoadedAt = time.Now()
	settingsMu.Unlock()
	return settings, nil
}

// InvalidateSettingsCache clears cached settings after admin updates.
func InvalidateSettingsCache() {
	settingsMu.Lock()
	settingsLoadedAt = time.Time{}
	settingsMu.Unlock()
	RefreshEmailConfig()
}
