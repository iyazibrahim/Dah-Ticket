package services

import (
	"fmt"
	"log"
	"time"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/models"
)

// StartLoanDueReminderScanner runs a periodic scan for due-soon and overdue loans.
func StartLoanDueReminderScanner(interval time.Duration) {
	if interval < time.Minute {
		interval = 15 * time.Minute
	}
	go func() {
		// Initial delay so DB is ready
		time.Sleep(20 * time.Second)
		ScanAssetLoanDueReminders()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			ScanAssetLoanDueReminders()
		}
	}()
	log.Printf("Loan due reminder scanner started (every %s)", interval)
}

// ScanAssetLoanDueReminders sends due-soon / overdue notifications once per stage.
func ScanAssetLoanDueReminders() {
	now := time.Now()
	warnHours := config.LoanDueWarningHours()
	warnBefore := now.Add(time.Duration(warnHours) * time.Hour)

	var loans []models.AssetRequest
	err := database.DB.Preload("Asset").Preload("Requester").
		Where("type = ? AND due_at IS NOT NULL", models.AssetRequestLoan).
		Where("status IN ?", []models.AssetRequestStatus{
			models.AssetRequestCheckedOut,
			models.AssetRequestReturnRequested,
			models.AssetRequestOverdue,
		}).
		Find(&loans).Error
	if err != nil {
		log.Printf("[LOAN DUE] scan failed: %v", err)
		return
	}

	for i := range loans {
		ar := &loans[i]
		if ar.DueAt == nil {
			continue
		}
		due := *ar.DueAt

		// Promote to overdue status when past due
		if !now.Before(due) && ar.Status != models.AssetRequestOverdue {
			_ = database.DB.Model(ar).Update("status", models.AssetRequestOverdue).Error
			ar.Status = models.AssetRequestOverdue
		}

		if !now.Before(due) {
			if ar.OverdueNotifiedAt == nil {
				dispatchLoanDueReminder(ar, true)
				t := now
				_ = database.DB.Model(ar).Update("overdue_notified_at", t).Error
			}
			continue
		}

		// Due soon window
		if !due.After(warnBefore) && ar.DueSoonNotifiedAt == nil {
			dispatchLoanDueReminder(ar, false)
			t := now
			_ = database.DB.Model(ar).Update("due_soon_notified_at", t).Error
		}
	}
}

func dispatchLoanDueReminder(ar *models.AssetRequest, overdue bool) {
	orgID := ar.OrganizationID
	if orgID == 0 {
		orgID = 1
	}
	settings, err := GetAppSettings(orgID)
	if err != nil {
		return
	}

	assetLabel := "asset"
	if ar.Asset != nil && ar.Asset.Name != "" {
		assetLabel = ar.Asset.Name
	} else if ar.Asset != nil && ar.Asset.AssetTag != "" {
		assetLabel = ar.Asset.AssetTag
	}

	dueStr := ar.DueAt.Format("02 Jan 2006 15:04")
	link := "/my-assets"
	eventKey := models.NotifyEventAssetLoanDue

	var emailType, heading, mainText string
	if overdue {
		emailType = "Loan Overdue"
		heading = "Loan Overdue"
		mainText = fmt.Sprintf("Your loan of <strong>%s</strong> (request <strong>#%d</strong>) is overdue.", assetLabel, ar.ID)
	} else {
		emailType = "Loan Due Soon"
		heading = "Loan Due Soon"
		mainText = fmt.Sprintf("Your loan of <strong>%s</strong> (request <strong>#%d</strong>) is due soon.", assetLabel, ar.ID)
	}
	details := fmt.Sprintf("<strong>Due:</strong> %s<br><strong>Status:</strong> %s", dueStr, ar.Status)

	// Borrower
	requester := ar.Requester
	if requester.ID == 0 {
		_ = database.DB.First(&requester, ar.RequesterID).Error
	}
	if requester.ID != 0 {
		title := heading
		message := fmt.Sprintf("%s — due %s", assetLabel, dueStr)
		if UserAllowsInApp(requester.ID, eventKey) {
			CreateInAppNotification(requester.ID, title, message, "asset_loan_due", link)
		}
		if settings.EmailEnabled && UserAllowsEmail(requester.ID, eventKey) && requester.Email != "" {
			subject := fmt.Sprintf("[%s] %s — request #%d", config.ProductName, heading, ar.ID)
			sendTemplatedEmail(
				[]string{requester.Email}, subject,
				emailType, heading,
				fmt.Sprintf("Hi %s,", requester.FirstName),
				mainText, details,
				"Please return the asset or request an extension from IT.",
				"View my assets", FrontendBaseURL()+link,
			)
		}
	}

	// Overdue: also notify lending-site staff
	if overdue {
		staffLink := "/itam/requests"
		staff := findLendingStaff(orgID, ar.HomeLocationID)
		staffMsg := fmt.Sprintf("Loan #%d (%s) is overdue — due %s", ar.ID, assetLabel, dueStr)
		for _, u := range staff {
			if u.ID == requester.ID {
				continue
			}
			if UserAllowsInApp(u.ID, eventKey) {
				CreateInAppNotification(u.ID, "Loan Overdue", staffMsg, "asset_loan_due", staffLink)
			}
			if settings.EmailEnabled && UserAllowsEmail(u.ID, eventKey) && u.Email != "" {
				subject := fmt.Sprintf("[%s] Loan Overdue — request #%d", config.ProductName, ar.ID)
				sendTemplatedEmail(
					[]string{u.Email}, subject,
					"Loan Overdue", "Loan Overdue",
					fmt.Sprintf("Hi %s,", u.FirstName),
					fmt.Sprintf("Loan request <strong>#%d</strong> for <strong>%s</strong> is overdue.", ar.ID, assetLabel),
					fmt.Sprintf("<strong>Borrower:</strong> %s %s<br><strong>Due:</strong> %s", requester.FirstName, requester.LastName, dueStr),
					"Follow up with the borrower from Asset Requests.",
					"Open requests", FrontendBaseURL()+staffLink,
				)
			}
		}
	}
}
