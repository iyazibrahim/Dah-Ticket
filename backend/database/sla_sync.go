package database

import (
	"log"

	"dahticket-backend/config"
	"dahticket-backend/models"
)

// SyncSLATargetsFromDB loads persisted SLA values from ITAM settings into runtime config.
func SyncSLATargetsFromDB() {
	var settings models.ITAMSettings
	if err := DB.First(&settings).Error; err != nil {
		log.Printf("Skipping SLA sync from DB: %v", err)
		return
	}

	config.SetSLATargets(
		settings.SLALowHours,
		settings.SLAMediumHours,
		settings.SLAHighHours,
		settings.SLACriticalHours,
	)

	log.Printf("SLA targets synchronized from DB: low=%dh, medium=%dh, high=%dh, critical=%dh",
		config.SLATargets["low"],
		config.SLATargets["medium"],
		config.SLATargets["high"],
		config.SLATargets["critical"],
	)
}
