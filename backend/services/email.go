package services

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"

	"dahticket-backend/config"
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

// InitEmail loads SMTP configuration from environment variables (bootstrap fallback).
func InitEmail() {
	RefreshEmailConfig()
}

// RefreshEmailConfig reloads email transport from DB settings, falling back to env.
func RefreshEmailConfig() {
	settings, err := GetAppSettings(1)
	if err == nil && settings.EmailEnabled && strings.TrimSpace(settings.SMTPHost) != "" {
		fromName := strings.TrimSpace(settings.SMTPFromName)
		if fromName == "" {
			fromName = strings.TrimSpace(settings.EmailSenderName)
		}
		if fromName == "" {
			fromName = config.ProductSupportName
		}
		fromAddr := strings.TrimSpace(settings.SMTPFromAddr)
		if fromAddr == "" {
			fromAddr = getEnvDefault("SMTP_FROM_ADDR", config.ProductFromEmail)
		}
		port := strings.TrimSpace(settings.SMTPPort)
		if port == "" {
			port = "587"
		}
		emailConfig = EmailConfig{
			Host:     strings.TrimSpace(settings.SMTPHost),
			Port:     port,
			Username: strings.TrimSpace(settings.SMTPUsername),
			Password: settings.SMTPPassword,
			FromName: fromName,
			FromAddr: fromAddr,
			Enabled:  true,
		}
		log.Printf("Email notifications enabled from DB settings (SMTP: %s:%s)", emailConfig.Host, emailConfig.Port)
		return
	}

	emailConfig = EmailConfig{
		Host:     os.Getenv("SMTP_HOST"),
		Port:     getEnvDefault("SMTP_PORT", "587"),
		Username: os.Getenv("SMTP_USERNAME"),
		Password: os.Getenv("SMTP_PASSWORD"),
		FromName: getEnvDefault("SMTP_FROM_NAME", config.ProductSupportName),
		FromAddr: getEnvDefault("SMTP_FROM_ADDR", config.ProductFromEmail),
		Enabled:  os.Getenv("SMTP_HOST") != "",
	}
	if emailConfig.Enabled {
		log.Printf("Email notifications enabled from env (SMTP: %s:%s)", emailConfig.Host, emailConfig.Port)
	} else {
		log.Println("Email notifications disabled (configure in Settings or SMTP_HOST env)")
	}
}

func isEmailChannelEnabled() bool {
	settings, err := GetAppSettings(1)
	if err != nil {
		return emailConfig.Enabled
	}
	if settings.EmailEnabled {
		return emailConfig.Enabled || strings.TrimSpace(settings.SMTPHost) != ""
	}
	return false
}

// SendEmail sends an email via SMTP. Runs asynchronously — does not block the caller.
func SendEmail(to []string, subject, htmlBody string) {
	if !isEmailChannelEnabled() {
		log.Printf("[EMAIL SKIPPED] To: %s | Subject: %s", strings.Join(to, ", "), subject)
		return
	}
	if len(to) == 0 || strings.TrimSpace(to[0]) == "" {
		log.Printf("[EMAIL SKIPPED] no recipient | Subject: %s", subject)
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

// SendEmailSync sends email synchronously (for admin test).
func SendEmailSync(to, subject, htmlBody string) error {
	if !isEmailChannelEnabled() {
		return fmt.Errorf("email channel is not enabled or configured")
	}
	auth := smtp.PlainAuth("", emailConfig.Username, emailConfig.Password, emailConfig.Host)
	headers := fmt.Sprintf("From: %s <%s>\r\n", emailConfig.FromName, emailConfig.FromAddr)
	headers += fmt.Sprintf("To: %s\r\n", to)
	headers += fmt.Sprintf("Subject: %s\r\n", subject)
	headers += "MIME-Version: 1.0\r\n"
	headers += "Content-Type: text/html; charset=\"UTF-8\"\r\n"
	headers += "\r\n"
	msg := []byte(headers + htmlBody)
	addr := fmt.Sprintf("%s:%s", emailConfig.Host, emailConfig.Port)
	return smtp.SendMail(addr, auth, emailConfig.FromAddr, []string{to}, msg)
}

// --- Notification Templates ---

// NotifyTicketCreated sends notification when a new ticket is created.
func NotifyTicketCreated(orgID uint, requesterEmail, requesterName string, ticketID uint, ticketTitle string) {
	DispatchTicketCreated(orgID, requesterEmail, requesterName, ticketID, ticketTitle)
}

// NotifyTicketAssigned sends notification when a ticket is assigned.
func NotifyTicketAssigned(orgID uint, assigneeEmail, assigneeName string, ticketID uint, ticketTitle string) {
	DispatchTicketAssigned(orgID, assigneeEmail, assigneeName, ticketID, ticketTitle)
}

// NotifyTicketStatusChanged sends notification when ticket status changes.
func NotifyTicketStatusChanged(orgID uint, recipientEmail, recipientName string, ticketID uint, ticketTitle, oldStatus, newStatus string) {
	DispatchTicketStatusChanged(orgID, recipientEmail, recipientName, ticketID, ticketTitle, oldStatus, newStatus)
}

// NotifyNewComment sends notification when a public comment is added.
func NotifyNewComment(orgID uint, recipientEmail, recipientName string, ticketID uint, ticketTitle, commenterName string) {
	DispatchNewComment(orgID, recipientEmail, recipientName, ticketID, ticketTitle, commenterName)
}

// NotifyHQSiteTicketCreated alerts Main Office IT about a new site ticket.
func NotifyHQSiteTicketCreated(orgID uint, ticketID uint, ticketTitle, siteName, requesterName string) {
	DispatchHQSiteTicketCreated(orgID, ticketID, ticketTitle, siteName, requesterName)
}

// buildEmailTemplate creates a clean, branded HTML email.
func buildEmailTemplate(heading, greeting, mainText, details, footer string) string {
	return buildEmailTemplateWithCTA(heading, greeting, mainText, details, footer, "", "")
}

// buildEmailTemplateWithCTA creates branded HTML with an optional primary CTA button.
func buildEmailTemplateWithCTA(heading, greeting, mainText, details, footer, ctaLabel, ctaURL string) string {
	product := config.ProductName
	accent := "#0f766e" // teal aligned with practical IT tools (not purple gradient)

	footerHTML := ""
	if footer != "" {
		footerHTML = fmt.Sprintf(`<p style="color:#64748b;font-size:14px;line-height:1.5;margin:20px 0 0;">%s</p>`, footer)
	}

	detailsHTML := ""
	if details != "" {
		detailsHTML = fmt.Sprintf(`
			<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="margin:20px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
				<tr><td style="padding:16px 18px;font-size:14px;line-height:1.6;color:#334155;">%s</td></tr>
			</table>`, details)
	}

	ctaHTML := ""
	if ctaLabel != "" && ctaURL != "" {
		ctaHTML = fmt.Sprintf(`
			<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;">
				<tr>
					<td style="border-radius:8px;background:%s;">
						<a href="%s" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">%s</a>
					</td>
				</tr>
			</table>
			<p style="margin:0;font-size:12px;color:#94a3b8;">Or open: <a href="%s" style="color:%s;">%s</a></p>`,
			accent, ctaURL, ctaLabel, ctaURL, accent, ctaURL)
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>%s</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Georgia,'Times New Roman',serif;">
	<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px;">
		<tr><td align="center">
			<table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
				<tr>
					<td style="padding:22px 28px;background:#0f172a;border-bottom:3px solid %s;">
						<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">%s</p>
						<h1 style="margin:6px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:20px;font-weight:650;color:#f8fafc;line-height:1.3;">%s</h1>
					</td>
				</tr>
				<tr>
					<td style="padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
						<p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.5;">%s</p>
						<p style="margin:0;font-size:15px;color:#334155;line-height:1.55;">%s</p>
						%s
						%s
						%s
					</td>
				</tr>
				<tr>
					<td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
						<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#94a3b8;text-align:center;">
							%s · Automated notification — please do not reply
						</p>
					</td>
				</tr>
			</table>
		</td></tr>
	</table>
</body>
</html>`, heading, accent, product, heading, greeting, mainText, detailsHTML, ctaHTML, footerHTML, config.ProductSupportName)
}

// BuildPlainTextEmail creates a plain-text alternative body.
func BuildPlainTextEmail(heading, greeting, mainText, details, ctaURL string) string {
	var b strings.Builder
	b.WriteString(heading)
	b.WriteString("\n\n")
	b.WriteString(greeting)
	b.WriteString("\n\n")
	b.WriteString(stripHTMLApprox(mainText))
	b.WriteString("\n\n")
	if details != "" {
		b.WriteString(stripHTMLApprox(details))
		b.WriteString("\n\n")
	}
	if ctaURL != "" {
		b.WriteString("Open: ")
		b.WriteString(ctaURL)
		b.WriteString("\n")
	}
	b.WriteString("\n— ")
	b.WriteString(config.ProductSupportName)
	return b.String()
}

func stripHTMLApprox(s string) string {
	replacer := strings.NewReplacer(
		"<br>", "\n", "<br/>", "\n", "<br />", "\n",
		"<strong>", "", "</strong>", "",
		"&nbsp;", " ",
	)
	return replacer.Replace(s)
}

func getEnvDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// BuildTestEmailBody returns HTML for admin test sends.
func BuildTestEmailBody() string {
	return buildEmailTemplate(
		"Test Email",
		"Hi Admin,",
		fmt.Sprintf("This is a test message from %s notification settings.", config.ProductName),
		"<strong>Status:</strong> SMTP configuration is working.",
		"You can safely ignore this email.",
	)
}
