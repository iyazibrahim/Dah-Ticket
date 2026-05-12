package services

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
)

// EmailConfig holds SMTP configuration.
type EmailConfig struct {
	Host     string
	Port     string
	Username string
	Password string
	FromName string
	FromAddr string
	Enabled  bool
}

var emailConfig EmailConfig

// InitEmail loads SMTP configuration from environment variables.
func InitEmail() {
	emailConfig = EmailConfig{
		Host:     os.Getenv("SMTP_HOST"),
		Port:     getEnvDefault("SMTP_PORT", "587"),
		Username: os.Getenv("SMTP_USERNAME"),
		Password: os.Getenv("SMTP_PASSWORD"),
		FromName: getEnvDefault("SMTP_FROM_NAME", "DahTicket IT Support"),
		FromAddr: getEnvDefault("SMTP_FROM_ADDR", "noreply@dahticket.com"),
		Enabled:  os.Getenv("SMTP_HOST") != "",
	}

	if emailConfig.Enabled {
		log.Printf("Email notifications enabled (SMTP: %s:%s)", emailConfig.Host, emailConfig.Port)
	} else {
		log.Println("Email notifications disabled (SMTP_HOST not configured)")
	}
}

// SendEmail sends an email via SMTP. Runs asynchronously — does not block the caller.
func SendEmail(to []string, subject, htmlBody string) {
	if !emailConfig.Enabled {
		log.Printf("[EMAIL SKIPPED] To: %s | Subject: %s", strings.Join(to, ", "), subject)
		return
	}

	go func() {
		auth := smtp.PlainAuth("", emailConfig.Username, emailConfig.Password, emailConfig.Host)

		headers := fmt.Sprintf("From: %s <%s>\r\n", emailConfig.FromName, emailConfig.FromAddr)
		headers += fmt.Sprintf("To: %s\r\n", strings.Join(to, ", "))
		headers += fmt.Sprintf("Subject: %s\r\n", subject)
		headers += "MIME-Version: 1.0\r\n"
		headers += "Content-Type: text/html; charset=\"UTF-8\"\r\n"
		headers += "\r\n"

		msg := []byte(headers + htmlBody)
		addr := fmt.Sprintf("%s:%s", emailConfig.Host, emailConfig.Port)

		if err := smtp.SendMail(addr, auth, emailConfig.FromAddr, to, msg); err != nil {
			log.Printf("[EMAIL ERROR] Failed to send to %s: %v", strings.Join(to, ", "), err)
		} else {
			log.Printf("[EMAIL SENT] To: %s | Subject: %s", strings.Join(to, ", "), subject)
		}
	}()
}

// --- Notification Templates ---

// NotifyTicketCreated sends notification when a new ticket is created.
func NotifyTicketCreated(requesterEmail, requesterName string, ticketID uint, ticketTitle string) {
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

// NotifyTicketAssigned sends notification when a ticket is assigned.
func NotifyTicketAssigned(assigneeEmail, assigneeName string, ticketID uint, ticketTitle string) {
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

// NotifyTicketStatusChanged sends notification when ticket status changes.
func NotifyTicketStatusChanged(recipientEmail, recipientName string, ticketID uint, ticketTitle, oldStatus, newStatus string) {
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

// NotifyNewComment sends notification when a public comment is added.
func NotifyNewComment(recipientEmail, recipientName string, ticketID uint, ticketTitle, commenterName string) {
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

// buildEmailTemplate creates a clean, branded HTML email.
func buildEmailTemplate(heading, greeting, mainText, details, footer string) string {
	footerHTML := ""
	if footer != "" {
		footerHTML = fmt.Sprintf(`<p style="color: #6b7280; font-size: 14px; margin-top: 16px;">%s</p>`, footer)
	}

	detailsHTML := ""
	if details != "" {
		detailsHTML = fmt.Sprintf(`
			<div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; color: #374151;">
				%s
			</div>`, details)
	}

	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, sans-serif; background: #f9fafb;">
	<div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
		<div style="background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
			<div style="background: linear-gradient(135deg, #2563eb, #4f46e5); padding: 24px 32px;">
				<h1 style="color: white; margin: 0; font-size: 18px; font-weight: 600;">🎫 %s</h1>
			</div>
			<div style="padding: 32px;">
				<p style="color: #374151; font-size: 15px; margin: 0 0 12px;">%s</p>
				<p style="color: #374151; font-size: 15px; margin: 0;">%s</p>
				%s
				%s
			</div>
			<div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
				<p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
					DahTicket IT Support · This is an automated notification
				</p>
			</div>
		</div>
	</div>
</body>
</html>`, heading, greeting, mainText, detailsHTML, footerHTML)
}

func getEnvDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
