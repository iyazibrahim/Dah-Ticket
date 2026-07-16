package services

import (
	"fmt"
	"os"
	"strings"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/models"
)

// FrontendBaseURL returns the public app URL for email CTAs.
func FrontendBaseURL() string {
	if v := os.Getenv("FRONTEND_URL"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return "http://localhost:5173"
}

// UserAllowsEmail returns whether the user wants email for an event (default true if no row).
func UserAllowsEmail(userID uint, eventKey string) bool {
	var pref models.UserNotificationPreference
	err := database.DB.Where("user_id = ? AND event_key = ?", userID, eventKey).First(&pref).Error
	if err != nil {
		return true
	}
	return pref.EmailEnabled
}

// UserAllowsInApp returns whether the user wants in-app for an event (default true).
func UserAllowsInApp(userID uint, eventKey string) bool {
	var pref models.UserNotificationPreference
	err := database.DB.Where("user_id = ? AND event_key = ?", userID, eventKey).First(&pref).Error
	if err != nil {
		return true
	}
	return pref.InAppEnabled
}

func findLendingStaff(orgID uint, homeLocationID *uint) []models.User {
	var staff []models.User
	q := database.DB.Where("organization_id = ? AND is_active = ?", orgID, true).
		Where("role IN ?", []models.Role{models.RoleITAgent, models.RoleManager, models.RoleAdmin})

	if homeLocationID != nil {
		q = q.Where("primary_location_id = ?", *homeLocationID)
		q.Find(&staff)
		if len(staff) > 0 {
			return staff
		}
	}

	// Escalate to admins / HQ (no primary location or elevation)
	database.DB.Where("organization_id = ? AND is_active = ?", orgID, true).
		Where("(is_admin = ? OR is_super_admin = ? OR role = ?) AND (primary_location_id IS NULL OR is_admin = ? OR is_super_admin = ?)",
			true, true, models.RoleAdmin, true, true).
		Find(&staff)
	if len(staff) == 0 {
		database.DB.Where("organization_id = ? AND is_active = ? AND (is_admin = ? OR is_super_admin = ?)",
			orgID, true, true, true).Find(&staff)
	}
	return staff
}

// DispatchAssetRequestCreated notifies lending-site staff (or admins if none).
func DispatchAssetRequestCreated(orgID uint, ar models.AssetRequest) {
	staff := findLendingStaff(orgID, ar.HomeLocationID)
	link := "/itam/requests"
	title := fmt.Sprintf("New asset request #%d", ar.ID)
	reqType := string(ar.Type)
	message := fmt.Sprintf("%s request pending approval", reqType)

	for _, u := range staff {
		if UserAllowsInApp(u.ID, models.NotifyEventAssetRequestUpdate) {
			CreateInAppNotification(u.ID, title, message, "asset_request", link)
		}
		if UserAllowsEmail(u.ID, models.NotifyEventAssetRequestUpdate) {
			settings, err := GetAppSettings(orgID)
			if err == nil && settings.EmailEnabled && u.Email != "" {
				subject := fmt.Sprintf("[%s] New asset %s request #%d", config.ProductName, reqType, ar.ID)
				cta := FrontendBaseURL() + link
				body := buildEmailTemplateWithCTA(
					"Asset Request",
					fmt.Sprintf("Hi %s,", u.FirstName),
					fmt.Sprintf("A new <strong>%s</strong> request <strong>#%d</strong> is waiting for review.", reqType, ar.ID),
					fmt.Sprintf("<strong>Reason:</strong> %s", ar.Reason),
					"Review and approve or reject in Asset Requests.",
					"Open requests",
					cta,
				)
				SendEmail([]string{u.Email}, subject, body)
			}
		}
	}
}

// DispatchAssetRequestStatusChanged notifies the requester of status changes.
func DispatchAssetRequestStatusChanged(orgID uint, ar models.AssetRequest, action string) {
	var requester models.User
	if err := database.DB.First(&requester, ar.RequesterID).Error; err != nil {
		return
	}

	eventKey := models.NotifyEventAssetRequestUpdate
	if action == "returned" {
		eventKey = models.NotifyEventAssetLoanReturned
	}

	link := "/my-assets"
	title := fmt.Sprintf("Asset request #%d %s", ar.ID, action)
	message := fmt.Sprintf("Your %s request was %s", ar.Type, action)

	if UserAllowsInApp(requester.ID, eventKey) {
		CreateInAppNotification(requester.ID, title, message, "asset_request", link)
	}

	settings, err := GetAppSettings(orgID)
	if err != nil || !settings.EmailEnabled || requester.Email == "" {
		return
	}
	if !UserAllowsEmail(requester.ID, eventKey) {
		return
	}

	subject := fmt.Sprintf("[%s] Asset request #%d — %s", config.ProductName, ar.ID, action)
	cta := FrontendBaseURL() + link
	detail := fmt.Sprintf("<strong>Type:</strong> %s<br><strong>Status:</strong> %s", ar.Type, ar.Status)
	if ar.RejectReason != "" {
		detail += "<br><strong>Reason:</strong> " + ar.RejectReason
	}
	body := buildEmailTemplateWithCTA(
		"Asset Request Update",
		fmt.Sprintf("Hi %s,", requester.FirstName),
		fmt.Sprintf("Your asset request <strong>#%d</strong> was <strong>%s</strong>.", ar.ID, action),
		detail,
		"",
		"View my assets",
		cta,
	)
	SendEmail([]string{requester.Email}, subject, body)
}
