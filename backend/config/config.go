package config

import (
	"log"
	"os"
	"strconv"
	"time"
)

// Config holds application configuration loaded from environment variables.
type Config struct {
	JWTSecret          string
	JWTExpirationHours int
	Port               string
}

// SLA response time targets (in hours) by priority level.
// Configurable via env vars: SLA_LOW_HOURS, SLA_MEDIUM_HOURS, etc.
var SLATargets = map[string]int{
	"low":      72, // 3 days
	"medium":   24, // 1 day
	"high":     8,  // 8 hours
	"critical": 4,  // 4 hours
}

var AppConfig Config

// Load reads environment variables and populates AppConfig.
func Load() {
	AppConfig = Config{
		JWTSecret:          getEnv("JWT_SECRET", "dahticket-super-secret-change-me-in-prod"),
		JWTExpirationHours: getEnvAsInt("JWT_EXPIRATION_HOURS", 24),
		Port:               getEnv("PORT", "8080"),
	}

	// Load SLA overrides from env
	SLATargets["low"] = getEnvAsInt("SLA_LOW_HOURS", SLATargets["low"])
	SLATargets["medium"] = getEnvAsInt("SLA_MEDIUM_HOURS", SLATargets["medium"])
	SLATargets["high"] = getEnvAsInt("SLA_HIGH_HOURS", SLATargets["high"])
	SLATargets["critical"] = getEnvAsInt("SLA_CRITICAL_HOURS", SLATargets["critical"])

	log.Println("Application configuration loaded")
	log.Printf("SLA targets: low=%dh, medium=%dh, high=%dh, critical=%dh",
		SLATargets["low"], SLATargets["medium"], SLATargets["high"], SLATargets["critical"])
}

// GetJWTExpiration returns the JWT token duration.
func GetJWTExpiration() time.Duration {
	return time.Duration(AppConfig.JWTExpirationHours) * time.Hour
}

// GetSLADueDate returns the due date based on priority and creation time.
func GetSLADueDate(priority string, createdAt time.Time) time.Time {
	hours, ok := SLATargets[priority]
	if !ok {
		hours = SLATargets["low"] // Default to low if unknown
	}
	return createdAt.Add(time.Duration(hours) * time.Hour)
}

// SetSLATargets updates SLA targets at runtime.
func SetSLATargets(low, medium, high, critical int) {
	if low > 0 {
		SLATargets["low"] = low
	}
	if medium > 0 {
		SLATargets["medium"] = medium
	}
	if high > 0 {
		SLATargets["high"] = high
	}
	if critical > 0 {
		SLATargets["critical"] = critical
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	strValue := getEnv(key, "")
	if value, err := strconv.Atoi(strValue); err == nil {
		return value
	}
	return fallback
}
