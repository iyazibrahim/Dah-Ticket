package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/models"
	"dahticket-backend/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ITAMSettingsPublic struct {
	models.ITAMSettings
	HasSMTPPassword      bool `json:"has_smtp_password"`
	HasTelegramBotToken  bool `json:"has_telegram_bot_token"`
}

func toPublicSettings(s models.ITAMSettings) ITAMSettingsPublic {
	hasPwd := strings.TrimSpace(s.SMTPPassword) != ""
	hasToken := strings.TrimSpace(s.TelegramBotToken) != ""
	s.SMTPPassword = ""
	s.TelegramBotToken = ""
	return ITAMSettingsPublic{
		ITAMSettings:        s,
		HasSMTPPassword:     hasPwd,
		HasTelegramBotToken: hasToken,
	}
}

type UpdateITAMSettingsRequest struct {
	AssetTagPrefix   *string `json:"asset_tag_prefix"`
	AutoGenerateTag  *bool   `json:"auto_generate_tag"`
	SLALowHours      *int    `json:"sla_low_hours"`
	SLAMediumHours   *int    `json:"sla_medium_hours"`
	SLAHighHours     *int    `json:"sla_high_hours"`
	SLACriticalHours *int    `json:"sla_critical_hours"`
	OrganizationName *string `json:"organization_name"`
	LogoBase64       *string `json:"logo_base64"`
	SupportEmail     *string `json:"support_email"`
	Timezone         *string `json:"timezone"`
	NotifyTicketCreated  *bool   `json:"notify_ticket_created"`
	NotifyTicketAssigned *bool   `json:"notify_ticket_assigned"`
	NotifyTicketStatus   *bool   `json:"notify_ticket_status"`
	NotifyNewComment     *bool   `json:"notify_new_comment"`
	EmailEnabled         *bool   `json:"email_enabled"`
	EmailSenderName      *string `json:"email_sender_name"`
	SMTPHost             *string `json:"smtp_host"`
	SMTPPort             *string `json:"smtp_port"`
	SMTPUsername         *string `json:"smtp_username"`
	SMTPPassword         *string `json:"smtp_password"`
	ClearSMTPPassword    *bool   `json:"clear_smtp_password"`
	SMTPFromAddr         *string `json:"smtp_from_addr"`
	SMTPFromName         *string `json:"smtp_from_name"`
	TelegramEnabled      *bool   `json:"telegram_enabled"`
	TelegramChatID       *string `json:"telegram_chat_id"`
	TelegramBotToken     *string `json:"telegram_bot_token"`
	ClearTelegramBotToken *bool  `json:"clear_telegram_bot_token"`
	KBMaxUploadMB             *int  `json:"kb_max_upload_mb"`
	AllowPublicRegistration   *bool `json:"allow_public_registration"`
}

type TestEmailRequest struct {
	To string `json:"to" binding:"required,email"`
}

func getOrCreateITAMSettings(tx *gorm.DB) (models.ITAMSettings, error) {
	var settings models.ITAMSettings
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&settings).Error
	if err == nil {
		return settings, nil
	}
	if err != gorm.ErrRecordNotFound {
		return settings, err
	}

	settings = models.ITAMSettings{
		AssetTagPrefix:   "DPA",
		AutoGenerateTag:  true,
		NextSequence:     1,
		SLALowHours:      config.SLATargets["low"],
		SLAMediumHours:   config.SLATargets["medium"],
		SLAHighHours:     config.SLATargets["high"],
		SLACriticalHours: config.SLATargets["critical"],
	}
	if err := tx.Create(&settings).Error; err != nil {
		return settings, err
	}
	return settings, nil
}

func nextAssetTag(tx *gorm.DB) (string, error) {
	return nextAssetTagForLocation(tx, nil)
}

func assetTagPrefixForLocation(tx *gorm.DB, locationID *uint) (string, error) {
	settings, err := getOrCreateITAMSettings(tx)
	if err != nil {
		return "", err
	}

	prefix := sanitizeTagPrefix(settings.AssetTagPrefix)
	if prefix == "" {
		prefix = "DPA"
	}

	if locationID != nil {
		var loc models.Location
		if err := tx.Select("name").First(&loc, *locationID).Error; err == nil {
			locPrefix := sanitizeTagPrefix(loc.Name)
			if locPrefix != "" {
				prefix = locPrefix
			}
		} else if err != gorm.ErrRecordNotFound {
			return "", err
		}
	}

	return prefix, nil
}

func normalizeAssetTagInput(tx *gorm.DB, locationID *uint, input string) (string, error) {
	trimmed := strings.ToUpper(strings.TrimSpace(input))
	if trimmed == "" {
		return "", nil
	}

	isNumericOnly := true
	for _, r := range trimmed {
		if r < '0' || r > '9' {
			isNumericOnly = false
			break
		}
	}

	if !isNumericOnly {
		return trimmed, nil
	}

	prefix, err := assetTagPrefixForLocation(tx, locationID)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s-%s", prefix, trimmed), nil
}

func sanitizeTagPrefix(input string) string {
	raw := strings.ToUpper(strings.TrimSpace(input))
	if raw == "" {
		return ""
	}

	b := strings.Builder{}
	for _, r := range raw {
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func getOrCreateTagSequence(tx *gorm.DB, prefix string, legacyStart uint) (models.ITAMTagSequence, error) {
	var seq models.ITAMTagSequence
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("prefix = ?", prefix).First(&seq).Error
	if err == nil {
		return seq, nil
	}
	if err != gorm.ErrRecordNotFound {
		return seq, err
	}

	next := uint(1)
	if legacyStart > 1 {
		next = legacyStart
	}

	seq = models.ITAMTagSequence{
		Prefix:       prefix,
		NextSequence: next,
	}
	if err := tx.Create(&seq).Error; err != nil {
		return seq, err
	}
	return seq, nil
}

func nextAssetTagForLocation(tx *gorm.DB, locationID *uint) (string, error) {
	prefix, err := assetTagPrefixForLocation(tx, locationID)
	if err != nil {
		return "", err
	}

	settings, err := getOrCreateITAMSettings(tx)
	if err != nil {
		return "", err
	}

	seq, err := getOrCreateTagSequence(tx, prefix, settings.NextSequence)
	if err != nil {
		return "", err
	}

	tag := fmt.Sprintf("%s-%03d", prefix, seq.NextSequence)
	seq.NextSequence++
	if err := tx.Save(&seq).Error; err != nil {
		return "", err
	}
	return tag, nil
}

func GetITAMSettings(c *gin.Context) {
	var settings models.ITAMSettings
	if err := database.DB.First(&settings).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			settings = models.ITAMSettings{
				AssetTagPrefix:   "DPA",
				AutoGenerateTag:  true,
				NextSequence:     1,
				SLALowHours:      config.SLATargets["low"],
				SLAMediumHours:   config.SLATargets["medium"],
				SLAHighHours:     config.SLATargets["high"],
				SLACriticalHours: config.SLATargets["critical"],
			}
			if createErr := database.DB.Create(&settings).Error; createErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize ITAM settings"})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ITAM settings"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"settings": toPublicSettings(settings)})
}

func TestEmailSettings(c *gin.Context) {
	var req TestEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	services.InvalidateSettingsCache()
	body := services.BuildTestEmailBody()
	if err := services.SendEmailSync(req.To, "DahTicket Test Email", body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Test email sent"})
}

func TestTelegramSettings(c *gin.Context) {
	services.InvalidateSettingsCache()
	if err := services.SendTelegramTest(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Test Telegram message sent"})
}

func UpdateITAMSettings(c *gin.Context) {
	var req UpdateITAMSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var settings models.ITAMSettings
	if err := database.DB.First(&settings).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			settings = models.ITAMSettings{
				AssetTagPrefix:   "DPA",
				AutoGenerateTag:  true,
				NextSequence:     1,
				SLALowHours:      config.SLATargets["low"],
				SLAMediumHours:   config.SLATargets["medium"],
				SLAHighHours:     config.SLATargets["high"],
				SLACriticalHours: config.SLATargets["critical"],
			}
			if createErr := database.DB.Create(&settings).Error; createErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to initialize ITAM settings"})
				return
			}
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch ITAM settings"})
			return
		}
	}

	if req.AssetTagPrefix != nil {
		prefix := sanitizeTagPrefix(*req.AssetTagPrefix)
		if prefix == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Asset tag prefix must include letters or numbers"})
			return
		}
		settings.AssetTagPrefix = prefix
	}
	if req.AutoGenerateTag != nil {
		settings.AutoGenerateTag = *req.AutoGenerateTag
	}
	if req.SLALowHours != nil {
		if *req.SLALowHours <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sla_low_hours must be greater than 0"})
			return
		}
		settings.SLALowHours = *req.SLALowHours
	}
	if req.SLAMediumHours != nil {
		if *req.SLAMediumHours <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sla_medium_hours must be greater than 0"})
			return
		}
		settings.SLAMediumHours = *req.SLAMediumHours
	}
	if req.SLAHighHours != nil {
		if *req.SLAHighHours <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sla_high_hours must be greater than 0"})
			return
		}
		settings.SLAHighHours = *req.SLAHighHours
	}
	if req.SLACriticalHours != nil {
		if *req.SLACriticalHours <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sla_critical_hours must be greater than 0"})
			return
		}
		settings.SLACriticalHours = *req.SLACriticalHours
	}

	if req.OrganizationName != nil {
		settings.OrganizationName = strings.TrimSpace(*req.OrganizationName)
	}
	if req.LogoBase64 != nil {
		settings.LogoBase64 = strings.TrimSpace(*req.LogoBase64)
	}
	if req.SupportEmail != nil {
		settings.SupportEmail = strings.TrimSpace(*req.SupportEmail)
	}
	if req.Timezone != nil {
		settings.Timezone = strings.TrimSpace(*req.Timezone)
	}
	if req.NotifyTicketCreated != nil {
		settings.NotifyTicketCreated = *req.NotifyTicketCreated
	}
	if req.NotifyTicketAssigned != nil {
		settings.NotifyTicketAssigned = *req.NotifyTicketAssigned
	}
	if req.NotifyTicketStatus != nil {
		settings.NotifyTicketStatus = *req.NotifyTicketStatus
	}
	if req.NotifyNewComment != nil {
		settings.NotifyNewComment = *req.NotifyNewComment
	}
	if req.EmailSenderName != nil {
		settings.EmailSenderName = strings.TrimSpace(*req.EmailSenderName)
	}
	if req.EmailEnabled != nil {
		settings.EmailEnabled = *req.EmailEnabled
	}
	if req.SMTPHost != nil {
		settings.SMTPHost = strings.TrimSpace(*req.SMTPHost)
	}
	if req.SMTPPort != nil {
		settings.SMTPPort = strings.TrimSpace(*req.SMTPPort)
	}
	if req.SMTPUsername != nil {
		settings.SMTPUsername = strings.TrimSpace(*req.SMTPUsername)
	}
	if req.ClearSMTPPassword != nil && *req.ClearSMTPPassword {
		settings.SMTPPassword = ""
	}
	if req.SMTPPassword != nil && strings.TrimSpace(*req.SMTPPassword) != "" {
		settings.SMTPPassword = strings.TrimSpace(*req.SMTPPassword)
	}
	if req.SMTPFromAddr != nil {
		settings.SMTPFromAddr = strings.TrimSpace(*req.SMTPFromAddr)
	}
	if req.SMTPFromName != nil {
		settings.SMTPFromName = strings.TrimSpace(*req.SMTPFromName)
	}
	if req.TelegramEnabled != nil {
		settings.TelegramEnabled = *req.TelegramEnabled
	}
	if req.TelegramChatID != nil {
		settings.TelegramChatID = strings.TrimSpace(*req.TelegramChatID)
	}
	if req.ClearTelegramBotToken != nil && *req.ClearTelegramBotToken {
		settings.TelegramBotToken = ""
	}
	if req.TelegramBotToken != nil && strings.TrimSpace(*req.TelegramBotToken) != "" {
		settings.TelegramBotToken = strings.TrimSpace(*req.TelegramBotToken)
	}
	if req.KBMaxUploadMB != nil && *req.KBMaxUploadMB > 0 {
		settings.KBMaxUploadMB = *req.KBMaxUploadMB
	}
	if req.AllowPublicRegistration != nil {
		settings.AllowPublicRegistration = *req.AllowPublicRegistration
	}

	if err := database.DB.Save(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update ITAM settings"})
		return
	}

	config.SetSLATargets(
		settings.SLALowHours,
		settings.SLAMediumHours,
		settings.SLAHighHours,
		settings.SLACriticalHours,
	)

	services.InvalidateSettingsCache()

	c.JSON(http.StatusOK, gin.H{"settings": toPublicSettings(settings)})
}
