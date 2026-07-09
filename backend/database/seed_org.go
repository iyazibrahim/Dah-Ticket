package database

import (
	"encoding/json"
	"log"

	"dahticket-backend/config"
	"dahticket-backend/models"
)

// SeedDefaultOrganization creates the default HQ organization and domain.
func SeedDefaultOrganization() {
	var count int64
	DB.Model(&models.Organization{}).Count(&count)
	if count > 0 {
		backfillOrganizationIDs()
		return
	}

	org := models.Organization{
		ID:       1,
		Name:     "Digital Penang",
		Slug:     "digital-penang",
		Type:     models.OrgTypeHQ,
		IsActive: true,
	}
	if err := DB.Create(&org).Error; err != nil {
		log.Printf("Failed seeding default organization: %v", err)
		return
	}
	log.Println("Seeded default organization: Digital Penang (HQ)")

	domain := models.Domain{
		Hostname:       "localhost",
		OrganizationID: org.ID,
		IsPrimary:      true,
		IsActive:       true,
	}
	DB.Create(&domain)

	backfillOrganizationIDs()
}

func backfillOrganizationIDs() {
	DB.Exec(`UPDATE users SET organization_id = 1 WHERE organization_id IS NULL OR organization_id = 0`)
	DB.Exec(`UPDATE tickets SET organization_id = 1 WHERE organization_id IS NULL OR organization_id = 0`)
	DB.Exec(`UPDATE assets SET organization_id = 1 WHERE organization_id IS NULL OR organization_id = 0`)
	DB.Exec(`UPDATE kb_articles SET organization_id = 1 WHERE organization_id IS NULL OR organization_id = 0`)
	DB.Exec(`UPDATE locations SET organization_id = 1 WHERE organization_id IS NULL OR organization_id = 0`)
	DB.Exec(`UPDATE itam_settings SET organization_id = 1 WHERE organization_id IS NULL OR organization_id = 0`)

	// Set HQ location type on main office if present
	DB.Model(&models.Location{}).Where("LOWER(name) LIKE ?", "%digital penang%").
		Updates(map[string]interface{}{"location_type": "hq"})
}

// SeedSystemLookups seeds default lookup values for org 1.
func SeedSystemLookups() {
	orgID := uint(1)
	type seedItem struct {
		group, key, label string
		sort              int
		meta              map[string]interface{}
	}
	items := []seedItem{
		// Ticket categories
		{models.LookupTicketCategory, "hardware", "Hardware", 1, nil},
		{models.LookupTicketCategory, "software", "Software", 2, nil},
		{models.LookupTicketCategory, "network", "Network", 3, nil},
		{models.LookupTicketCategory, "access", "Access / Account", 4, nil},
		{models.LookupTicketCategory, "other", "Other", 5, nil},
		// Hold reasons
		{models.LookupHoldReason, "awaiting_customer", "Awaiting Customer", 1, map[string]interface{}{"pauses_sla": true}},
		{models.LookupHoldReason, "awaiting_vendor", "Awaiting Vendor", 2, map[string]interface{}{"pauses_sla": true}},
		{models.LookupHoldReason, "pending_approval", "Pending Approval", 3, nil},
		{models.LookupHoldReason, "blocked", "Blocked", 4, nil},
		{models.LookupHoldReason, "other", "Other", 5, nil},
		// Resolution codes
		{models.LookupResolutionCode, "fixed", "Fixed", 1, nil},
		{models.LookupResolutionCode, "workaround", "Workaround Applied", 2, nil},
		{models.LookupResolutionCode, "user_education", "User Education", 3, nil},
		{models.LookupResolutionCode, "duplicate", "Duplicate", 4, nil},
		{models.LookupResolutionCode, "cannot_reproduce", "Cannot Reproduce", 5, nil},
		{models.LookupResolutionCode, "cancelled", "Cancelled", 6, nil},
		// Closure codes
		{models.LookupClosureCode, "resolved_confirmed", "Resolved — Confirmed", 1, nil},
		{models.LookupClosureCode, "auto_closed", "Auto Closed", 2, nil},
		{models.LookupClosureCode, "duplicate", "Duplicate", 3, nil},
		{models.LookupClosureCode, "cancelled", "Cancelled", 4, nil},
		// Finding types
		{models.LookupFindingType, "health_check", "Health Check", 1, nil},
		{models.LookupFindingType, "performance_issue", "Performance Issue", 2, nil},
		{models.LookupFindingType, "hardware_failure", "Hardware Failure", 3, nil},
		{models.LookupFindingType, "connectivity_issue", "Connectivity Issue", 4, nil},
		{models.LookupFindingType, "overheating", "Overheating", 5, nil},
		{models.LookupFindingType, "configuration_issue", "Configuration Issue", 6, nil},
		{models.LookupFindingType, "replacement_needed", "Replacement Needed", 7, nil},
		{models.LookupFindingType, "other", "Other", 8, nil},
		// Severity
		{models.LookupFindingSeverity, "low", "Low", 1, nil},
		{models.LookupFindingSeverity, "medium", "Medium", 2, nil},
		{models.LookupFindingSeverity, "high", "High", 3, nil},
		{models.LookupFindingSeverity, "critical", "Critical", 4, nil},
		// Threshold
		{models.LookupFindingThreshold, "normal", "Normal", 1, nil},
		{models.LookupFindingThreshold, "warning", "Warning", 2, nil},
		{models.LookupFindingThreshold, "danger", "Danger", 3, nil},
		// Device types
		{models.LookupDeviceType, "switch", "Switch", 1, nil},
		{models.LookupDeviceType, "router", "Router", 2, nil},
		{models.LookupDeviceType, "access_point", "Access Point", 3, nil},
		{models.LookupDeviceType, "pc", "PC / Desktop", 4, nil},
		{models.LookupDeviceType, "laptop", "Laptop", 5, nil},
		{models.LookupDeviceType, "other", "Other", 6, nil},
	}

	for _, item := range items {
		var existing int64
		DB.Model(&models.SystemLookup{}).
			Where("organization_id = ? AND \"group\" = ? AND key = ?", orgID, item.group, item.key).
			Count(&existing)
		if existing > 0 {
			continue
		}
		meta := ""
		if item.meta != nil {
			b, _ := json.Marshal(item.meta)
			meta = string(b)
		}
		row := models.SystemLookup{
			OrganizationID: orgID,
			Group:          item.group,
			Key:            item.key,
			Label:          item.label,
			SortOrder:      item.sort,
			Metadata:       meta,
			IsActive:       true,
		}
		if err := DB.Create(&row).Error; err != nil {
			log.Printf("Failed seeding lookup %s/%s: %v", item.group, item.key, err)
		}
	}

	// Ensure settings row exists for org 1
	var settings models.ITAMSettings
	if err := DB.Where("organization_id = ?", orgID).First(&settings).Error; err != nil {
		settings = models.ITAMSettings{
			OrganizationID:      orgID,
			AssetTagPrefix:      "DPA",
			AutoGenerateTag:     true,
			NextSequence:        1,
			SLALowHours:         config.SLATargets["low"],
			SLAMediumHours:      config.SLATargets["medium"],
			SLAHighHours:        config.SLATargets["high"],
			SLACriticalHours:    config.SLATargets["critical"],
			OrganizationName:    "Digital Penang",
			Timezone:            "Asia/Kuala_Lumpur",
			KBMaxUploadMB:       5,
			TicketAttachmentMaxMB: 10,
			PMTicketPriority:    "medium",
			PMTicketType:        "problem",
			PMTicketCategory:    "network",
		}
		DB.Create(&settings)
	}
}
