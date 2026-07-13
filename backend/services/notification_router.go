package services

import (
	"fmt"
	"strings"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/models"
)

func DispatchTicketCreated(orgID uint, requesterEmail, requesterName string, ticketID uint, ticketTitle string) {
	settings, err := GetAppSettings(orgID)
	if err != nil || !settings.NotifyTicketCreated {
		return
	}

	if settings.EmailEnabled {
		subject := fmt.Sprintf("[%s #%d] Ticket Created: %s", config.ProductName, ticketID, ticketTitle)
		body := buildEmailTemplate(
			"Ticket Created",
			fmt.Sprintf("Hi %s,", requesterName),
			fmt.Sprintf("Your ticket <strong>#%d</strong> has been created successfully.", ticketID),
			fmt.Sprintf("<strong>Title:</strong> %s<br><strong>Status:</strong> Open", ticketTitle),
			"Our IT team will review your ticket shortly.",
		)
		SendEmail([]string{requesterEmail}, subject, body)
	}

	if settings.TelegramEnabled {
		msg := fmt.Sprintf(
			"<b>New Ticket #%d</b>\n%s\nRequester: %s",
			ticketID, escapeTelegram(ticketTitle), escapeTelegram(requesterName),
		)
		SendTelegramMessage(msg)
	}
}

func DispatchTicketAssigned(orgID uint, assigneeEmail, assigneeName string, ticketID uint, ticketTitle string) {
	settings, err := GetAppSettings(orgID)
	if err != nil || !settings.NotifyTicketAssigned {
		return
	}

	if settings.EmailEnabled {
		subject := fmt.Sprintf("[%s #%d] Ticket Assigned to You", config.ProductName, ticketID)
		body := buildEmailTemplate(
			"Ticket Assigned",
			fmt.Sprintf("Hi %s,", assigneeName),
			fmt.Sprintf("Ticket <strong>#%d</strong> has been assigned to you.", ticketID),
			fmt.Sprintf("<strong>Title:</strong> %s", ticketTitle),
			"Please review and begin working on this ticket.",
		)
		SendEmail([]string{assigneeEmail}, subject, body)
	}

	if settings.TelegramEnabled {
		msg := fmt.Sprintf(
			"<b>Ticket Assigned #%d</b>\n%s\nAssignee: %s",
			ticketID, escapeTelegram(ticketTitle), escapeTelegram(assigneeName),
		)
		SendTelegramMessage(msg)
	}
}

func DispatchTicketStatusChanged(orgID uint, recipientEmail, recipientName string, ticketID uint, ticketTitle, oldStatus, newStatus string) {
	settings, err := GetAppSettings(orgID)
	if err != nil || !settings.NotifyTicketStatus {
		return
	}

	if settings.EmailEnabled {
		subject := fmt.Sprintf("[%s #%d] Status Updated: %s → %s", config.ProductName, ticketID, oldStatus, newStatus)
		body := buildEmailTemplate(
			"Ticket Status Updated",
			fmt.Sprintf("Hi %s,", recipientName),
			fmt.Sprintf("The status of ticket <strong>#%d</strong> has been updated.", ticketID),
			fmt.Sprintf("<strong>Title:</strong> %s<br><strong>Status:</strong> %s → %s", ticketTitle, oldStatus, newStatus),
			"",
		)
		SendEmail([]string{recipientEmail}, subject, body)
	}

	if settings.TelegramEnabled {
		msg := fmt.Sprintf(
			"<b>Status Update #%d</b>\n%s\n%s → %s",
			ticketID, escapeTelegram(ticketTitle), escapeTelegram(oldStatus), escapeTelegram(newStatus),
		)
		SendTelegramMessage(msg)
	}
}

func DispatchNewComment(orgID uint, recipientEmail, recipientName string, ticketID uint, ticketTitle, commenterName string) {
	settings, err := GetAppSettings(orgID)
	if err != nil || !settings.NotifyNewComment {
		return
	}

	if settings.EmailEnabled {
		subject := fmt.Sprintf("[%s #%d] New Comment from %s", config.ProductName, ticketID, commenterName)
		body := buildEmailTemplate(
			"New Comment",
			fmt.Sprintf("Hi %s,", recipientName),
			fmt.Sprintf("%s added a comment on ticket <strong>#%d</strong>.", commenterName, ticketID),
			fmt.Sprintf("<strong>Title:</strong> %s", ticketTitle),
			fmt.Sprintf("Log in to %s to view the full comment.", config.ProductName),
		)
		SendEmail([]string{recipientEmail}, subject, body)
	}

	if settings.TelegramEnabled {
		msg := fmt.Sprintf(
			"<b>New Comment #%d</b>\n%s\nBy: %s",
			ticketID, escapeTelegram(ticketTitle), escapeTelegram(commenterName),
		)
		SendTelegramMessage(msg)
	}
}

func escapeTelegram(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}

// DispatchHQSiteTicketCreated notifies Main Office IT when a site ticket is created.
func DispatchHQSiteTicketCreated(orgID uint, ticketID uint, ticketTitle, siteName, requesterName string) {
	settings, err := GetAppSettings(orgID)
	if err != nil || !settings.NotifyTicketCreated || !settings.NotifyHQOnSiteTicket {
		return
	}

	var hqStaff []models.User
	database.DB.Where("organization_id = ? AND is_active = ?", orgID, true).
		Where("role IN ?", []models.Role{models.RoleITAgent, models.RoleManager, models.RoleAdmin}).
		Where("primary_location_id IS NULL").
		Find(&hqStaff)

	if len(hqStaff) == 0 {
		return
	}

	link := fmt.Sprintf("/tickets/%d", ticketID)
	title := fmt.Sprintf("New site ticket #%d", ticketID)
	message := fmt.Sprintf("%s — from %s (by %s)", ticketTitle, siteName, requesterName)

	if settings.EmailEnabled {
		emails := make([]string, 0, len(hqStaff))
		for _, u := range hqStaff {
			if u.Email != "" {
				emails = append(emails, u.Email)
			}
		}
		if len(emails) > 0 {
			subject := fmt.Sprintf("[%s #%d] New ticket from %s", config.ProductName, ticketID, siteName)
			body := buildEmailTemplate(
				"New Site Ticket",
				"Hi team,",
				fmt.Sprintf("A new ticket <strong>#%d</strong> was submitted from <strong>%s</strong>.", ticketID, siteName),
				fmt.Sprintf("<strong>Title:</strong> %s<br><strong>Requester:</strong> %s<br><strong>Status:</strong> Open", ticketTitle, requesterName),
				"Please review and assign from the central queue.",
			)
			SendEmail(emails, subject, body)
		}
	}

	for _, u := range hqStaff {
		CreateInAppNotification(u.ID, title, message, "ticket_created", link)
	}

	if settings.TelegramEnabled {
		msg := fmt.Sprintf(
			"<b>New site ticket #%d</b> from %s\n%s\nRequester: %s",
			ticketID, escapeTelegram(siteName), escapeTelegram(ticketTitle), escapeTelegram(requesterName),
		)
		SendTelegramMessage(msg)
	}
}
