package services

import (
	"fmt"
	"strings"
)

func DispatchTicketCreated(orgID uint, requesterEmail, requesterName string, ticketID uint, ticketTitle string) {
	settings, err := GetAppSettings(orgID)
	if err != nil || !settings.NotifyTicketCreated {
		return
	}

	if settings.EmailEnabled {
		subject := fmt.Sprintf("[DahTicket #%d] Ticket Created: %s", ticketID, ticketTitle)
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
		subject := fmt.Sprintf("[DahTicket #%d] Ticket Assigned to You", ticketID)
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
		subject := fmt.Sprintf("[DahTicket #%d] Status Updated: %s → %s", ticketID, oldStatus, newStatus)
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
		subject := fmt.Sprintf("[DahTicket #%d] New Comment from %s", ticketID, commenterName)
		body := buildEmailTemplate(
			"New Comment",
			fmt.Sprintf("Hi %s,", recipientName),
			fmt.Sprintf("%s added a comment on ticket <strong>#%d</strong>.", commenterName, ticketID),
			fmt.Sprintf("<strong>Title:</strong> %s", ticketTitle),
			"Log in to DahTicket to view the full comment.",
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
