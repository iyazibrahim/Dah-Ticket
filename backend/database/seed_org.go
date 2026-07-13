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

	// Set HQ location type on main office; sites elsewhere
	DB.Model(&models.Location{}).Where("LOWER(name) LIKE ?", "%digital penang%").
		Updates(map[string]interface{}{"location_type": "hq"})
	DB.Model(&models.Location{}).
		Where("LOWER(name) NOT LIKE ?", "%digital penang%").
		Where("location_type IS NULL OR location_type = '' OR location_type = 'site'").
		Updates(map[string]interface{}{"location_type": "site"})
}

func lookupMeta(description string, extra map[string]interface{}) map[string]interface{} {
	m := map[string]interface{}{}
	if description != "" {
		m["description"] = description
	}
	for k, v := range extra {
		m[k] = v
	}
	if len(m) == 0 {
		return nil
	}
	return m
}

func backfillLookupItem(orgID uint, group, key, label string, sort int, meta map[string]interface{}) {
	var row models.SystemLookup
	if err := DB.Where("organization_id = ? AND \"group\" = ? AND key = ?", orgID, group, key).First(&row).Error; err != nil {
		return
	}
	updates := map[string]interface{}{"label": label, "sort_order": sort}
	if meta != nil {
		existing := map[string]interface{}{}
		if row.Metadata != "" {
			_ = json.Unmarshal([]byte(row.Metadata), &existing)
		}
		for k, v := range meta {
			if _, ok := existing[k]; !ok || existing[k] == nil || existing[k] == "" {
				existing[k] = v
			}
		}
		if b, err := json.Marshal(existing); err == nil {
			updates["metadata"] = string(b)
		}
	}
	DB.Model(&row).Updates(updates)
}

// SeedSystemLookups seeds default lookup values for org 1.
func SeedSystemLookups() {
	orgID := uint(1)
	type seedItem struct {
		group, key, label, description string
		sort                           int
		meta                           map[string]interface{}
	}
	items := []seedItem{
		// Ticket types
		{models.LookupTicketType, "incident", "Incident", "Something is broken or not working right now.", 1, nil},
		{models.LookupTicketType, "service_request", "Service Request", "You need access, equipment, or a standard IT service. Nothing is broken.", 2, nil},
		{models.LookupTicketType, "problem", "Problem", "A recurring issue affecting multiple people. Needs root-cause investigation.", 3, nil},
		{models.LookupTicketType, "change", "Change", "A planned change to systems, software, or configuration.", 4, nil},
		// Ticket categories
		{models.LookupTicketCategory, "hardware", "Hardware", "Computers, printers, monitors, and other physical equipment.", 1, nil},
		{models.LookupTicketCategory, "software", "Software", "Applications, licenses, and software errors.", 2, nil},
		{models.LookupTicketCategory, "network", "Network", "Internet, Wi-Fi, VPN, and connectivity issues.", 3, nil},
		{models.LookupTicketCategory, "access", "Access / Account", "Login, passwords, accounts, and permissions.", 4, nil},
		{models.LookupTicketCategory, "other", "Other", "Anything that does not fit the categories above.", 5, nil},
		// Hold reasons
		{models.LookupHoldReason, "awaiting_customer", "Awaiting Customer", "Waiting for the requester to provide information or test a fix.", 1, map[string]interface{}{"pauses_sla": true}},
		{models.LookupHoldReason, "awaiting_vendor", "Awaiting Vendor", "Waiting for an external vendor or supplier.", 2, map[string]interface{}{"pauses_sla": true}},
		{models.LookupHoldReason, "pending_approval", "Pending Approval", "Waiting for manager or business approval.", 3, nil},
		{models.LookupHoldReason, "blocked", "Blocked", "Work is blocked by another issue or dependency.", 4, nil},
		{models.LookupHoldReason, "other", "Other", "Paused for another reason — add a note to explain.", 5, nil},
		// Resolution codes
		{models.LookupResolutionCode, "fixed", "Fixed", "The issue was repaired and service is restored.", 1, nil},
		{models.LookupResolutionCode, "workaround", "Workaround Applied", "A temporary fix is in place; a permanent fix may follow later.", 2, nil},
		{models.LookupResolutionCode, "user_education", "User Education", "The user was shown how to resolve or avoid the issue.", 3, nil},
		{models.LookupResolutionCode, "duplicate", "Duplicate", "This is the same as another existing ticket.", 4, nil},
		{models.LookupResolutionCode, "cannot_reproduce", "Cannot Reproduce", "The issue could not be reproduced after investigation.", 5, nil},
		{models.LookupResolutionCode, "cancelled", "Cancelled", "The request was withdrawn or is no longer needed.", 6, nil},
		// Closure codes
		{models.LookupClosureCode, "resolved_confirmed", "Resolved — Confirmed", "The requester confirmed the fix — ticket complete.", 1, nil},
		{models.LookupClosureCode, "auto_closed", "Auto Closed", "Closed automatically after a period with no response.", 2, nil},
		{models.LookupClosureCode, "duplicate", "Duplicate", "Closed as a duplicate of another ticket.", 3, nil},
		{models.LookupClosureCode, "cancelled", "Cancelled", "Closed without completing the original request.", 4, nil},
		// Finding types
		{models.LookupFindingType, "health_check", "Health Check", "", 1, nil},
		{models.LookupFindingType, "performance_issue", "Performance Issue", "", 2, nil},
		{models.LookupFindingType, "hardware_failure", "Hardware Failure", "", 3, nil},
		{models.LookupFindingType, "connectivity_issue", "Connectivity Issue", "", 4, nil},
		{models.LookupFindingType, "overheating", "Overheating", "", 5, nil},
		{models.LookupFindingType, "configuration_issue", "Configuration Issue", "", 6, nil},
		{models.LookupFindingType, "replacement_needed", "Replacement Needed", "", 7, nil},
		{models.LookupFindingType, "other", "Other", "", 8, nil},
		// Severity
		{models.LookupFindingSeverity, "low", "Low", "", 1, nil},
		{models.LookupFindingSeverity, "medium", "Medium", "", 2, nil},
		{models.LookupFindingSeverity, "high", "High", "", 3, nil},
		{models.LookupFindingSeverity, "critical", "Critical", "", 4, nil},
		// Threshold
		{models.LookupFindingThreshold, "normal", "Normal", "", 1, nil},
		{models.LookupFindingThreshold, "warning", "Warning", "", 2, nil},
		{models.LookupFindingThreshold, "danger", "Danger", "", 3, nil},
		// Device types
		{models.LookupDeviceType, "switch", "Switch", "", 1, nil},
		{models.LookupDeviceType, "router", "Router", "", 2, nil},
		{models.LookupDeviceType, "access_point", "Access Point", "", 3, nil},
		{models.LookupDeviceType, "pc", "PC / Desktop", "", 4, nil},
		{models.LookupDeviceType, "laptop", "Laptop", "", 5, nil},
		{models.LookupDeviceType, "other", "Other", "", 6, nil},
	}

	for _, item := range items {
		meta := lookupMeta(item.description, item.meta)
		var existing int64
		DB.Model(&models.SystemLookup{}).
			Where("organization_id = ? AND \"group\" = ? AND key = ?", orgID, item.group, item.key).
			Count(&existing)
		if existing > 0 {
			backfillLookupItem(orgID, item.group, item.key, item.label, item.sort, meta)
			continue
		}
		metaJSON := ""
		if meta != nil {
			b, _ := json.Marshal(meta)
			metaJSON = string(b)
		}
		row := models.SystemLookup{
			OrganizationID: orgID,
			Group:          item.group,
			Key:            item.key,
			Label:          item.label,
			SortOrder:      item.sort,
			Metadata:       metaJSON,
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
