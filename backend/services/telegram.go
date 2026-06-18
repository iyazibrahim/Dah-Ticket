package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// SendTelegramMessage posts a message to the configured global chat.
func SendTelegramMessage(text string) {
	settings, err := GetAppSettings()
	if err != nil {
		log.Printf("[TELEGRAM SKIPPED] settings load failed: %v", err)
		return
	}
	if !settings.TelegramEnabled {
		log.Printf("[TELEGRAM SKIPPED] disabled")
		return
	}
	token := strings.TrimSpace(settings.TelegramBotToken)
	chatID := strings.TrimSpace(settings.TelegramChatID)
	if token == "" || chatID == "" {
		log.Printf("[TELEGRAM SKIPPED] bot token or chat id not configured")
		return
	}

	go func() {
		payload := map[string]interface{}{
			"chat_id":    chatID,
			"text":       text,
			"parse_mode": "HTML",
		}
		body, _ := json.Marshal(payload)
		url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)

		client := &http.Client{Timeout: 15 * time.Second}
		resp, err := client.Post(url, "application/json", bytes.NewReader(body))
		if err != nil {
			log.Printf("[TELEGRAM ERROR] send failed: %v", err)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 300 {
			b, _ := io.ReadAll(resp.Body)
			log.Printf("[TELEGRAM ERROR] status %d: %s", resp.StatusCode, string(b))
			return
		}
		log.Printf("[TELEGRAM SENT] chat=%s", chatID)
	}()
}

// SendTelegramTest sends a synchronous test message for admin verification.
func SendTelegramTest() error {
	settings, err := GetAppSettings()
	if err != nil {
		return fmt.Errorf("failed to load settings: %w", err)
	}
	if !settings.TelegramEnabled {
		return fmt.Errorf("telegram is disabled in settings")
	}
	token := strings.TrimSpace(settings.TelegramBotToken)
	chatID := strings.TrimSpace(settings.TelegramChatID)
	if token == "" || chatID == "" {
		return fmt.Errorf("telegram bot token and chat id are required")
	}

	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       "DahTicket test notification — Telegram channel is configured.",
		"parse_mode": "HTML",
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram API error %d: %s", resp.StatusCode, string(b))
	}
	return nil
}
