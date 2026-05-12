package handlers

import (
	"net/http"
	"time"

	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

// --- Analytics DTOs ---

type OverviewStats struct {
	TotalTickets   int64 `json:"total_tickets"`
	OpenTickets    int64 `json:"open_tickets"`
	ResolvedToday  int64 `json:"resolved_today"`
	OverdueTickets int64 `json:"overdue_tickets"`
	TotalUsers     int64 `json:"total_users"`
	ActiveAgents   int64 `json:"active_agents"`
	AvgResolutionH int64 `json:"avg_resolution_hours"`
}

type StatusBreakdown struct {
	Status string `json:"status"`
	Count  int64  `json:"count"`
}

type PriorityBreakdown struct {
	Priority string `json:"priority"`
	Count    int64  `json:"count"`
}

type AgentWorkload struct {
	AgentID   uint   `json:"agent_id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Open      int64  `json:"open"`
	Resolved  int64  `json:"resolved"`
	Total     int64  `json:"total"`
}

type DailyTrend struct {
	Date    string `json:"date"`
	Created int64  `json:"created"`
}

// --- Analytics Handlers ---

// GetAnalyticsOverview returns high-level dashboard stats. Admin only.
func GetAnalyticsOverview(c *gin.Context) {
	var stats OverviewStats

	database.DB.Model(&models.Ticket{}).Count(&stats.TotalTickets)

	database.DB.Model(&models.Ticket{}).
		Where("status IN ?", []string{"open", "in_progress", "on_hold"}).
		Count(&stats.OpenTickets)

	todayStart := time.Now().Truncate(24 * time.Hour)
	database.DB.Model(&models.Ticket{}).
		Where("status = ? AND resolved_at >= ?", "resolved", todayStart).
		Count(&stats.ResolvedToday)

	database.DB.Model(&models.Ticket{}).
		Where("due_date < ? AND status NOT IN ?", time.Now(), []string{"resolved", "closed"}).
		Count(&stats.OverdueTickets)

	database.DB.Model(&models.User{}).Where("is_active = ?", true).Count(&stats.TotalUsers)

	database.DB.Model(&models.User{}).
		Where("role IN ? AND is_active = ?", []string{"it_agent", "admin"}, true).
		Count(&stats.ActiveAgents)

	// Average resolution time (hours) for resolved tickets
	type AvgResult struct{ Avg float64 }
	var avgRes AvgResult
	database.DB.Model(&models.Ticket{}).
		Select("AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg").
		Where("resolved_at IS NOT NULL").
		Scan(&avgRes)
	stats.AvgResolutionH = int64(avgRes.Avg)

	c.JSON(http.StatusOK, gin.H{"overview": stats})
}

// GetAnalyticsByStatus returns ticket count breakdown by status. Admin only.
func GetAnalyticsByStatus(c *gin.Context) {
	var results []StatusBreakdown
	database.DB.Model(&models.Ticket{}).
		Select("status, COUNT(*) as count").
		Group("status").
		Order("count DESC").
		Find(&results)

	c.JSON(http.StatusOK, gin.H{"status_breakdown": results})
}

// GetAnalyticsByPriority returns ticket count breakdown by priority. Admin only.
func GetAnalyticsByPriority(c *gin.Context) {
	var results []PriorityBreakdown
	database.DB.Model(&models.Ticket{}).
		Select("priority, COUNT(*) as count").
		Group("priority").
		Order("count DESC").
		Find(&results)

	c.JSON(http.StatusOK, gin.H{"priority_breakdown": results})
}

// GetAnalyticsAgentWorkload returns ticket stats per agent. Admin only.
func GetAnalyticsAgentWorkload(c *gin.Context) {
	// Get all agents with their ticket counts
	var agents []models.User
	database.DB.Where("role IN ? AND is_active = ?", []string{"it_agent", "admin"}, true).
		Order("first_name ASC").Find(&agents)

	workloads := make([]AgentWorkload, 0, len(agents))

	for _, agent := range agents {
		var open, resolved, total int64

		database.DB.Model(&models.Ticket{}).
			Where("assignee_id = ? AND status IN ?", agent.ID, []string{"open", "in_progress", "on_hold"}).
			Count(&open)

		database.DB.Model(&models.Ticket{}).
			Where("assignee_id = ? AND status IN ?", agent.ID, []string{"resolved", "closed"}).
			Count(&resolved)

		database.DB.Model(&models.Ticket{}).
			Where("assignee_id = ?", agent.ID).
			Count(&total)

		workloads = append(workloads, AgentWorkload{
			AgentID:   agent.ID,
			FirstName: agent.FirstName,
			LastName:  agent.LastName,
			Open:      open,
			Resolved:  resolved,
			Total:     total,
		})
	}

	c.JSON(http.StatusOK, gin.H{"agent_workloads": workloads})
}

// GetAnalyticsTrend returns daily ticket creation counts for the last 30 days. Admin only.
func GetAnalyticsTrend(c *gin.Context) {
	days := 30

	type RawTrend struct {
		Date  time.Time
		Count int64
	}

	var results []RawTrend
	database.DB.Model(&models.Ticket{}).
		Select("DATE(created_at) as date, COUNT(*) as count").
		Where("created_at >= ?", time.Now().AddDate(0, 0, -days)).
		Group("DATE(created_at)").
		Order("date ASC").
		Find(&results)

	// Fill in missing dates with zero
	trendMap := make(map[string]int64)
	for _, r := range results {
		trendMap[r.Date.Format("2006-01-02")] = r.Count
	}

	trends := make([]DailyTrend, 0, days)
	for i := days - 1; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		count := trendMap[date] // 0 if not found
		trends = append(trends, DailyTrend{Date: date, Created: count})
	}

	c.JSON(http.StatusOK, gin.H{"trend": trends})
}

// GetAnalyticsSLA returns SLA compliance stats. Admin only.
func GetAnalyticsSLA(c *gin.Context) {
	var total, onTime, overdue, breached int64

	// All resolved/closed tickets with a due date
	database.DB.Model(&models.Ticket{}).
		Where("resolved_at IS NOT NULL AND due_date IS NOT NULL").
		Count(&total)

	// Resolved before due date
	database.DB.Model(&models.Ticket{}).
		Where("resolved_at IS NOT NULL AND due_date IS NOT NULL AND resolved_at <= due_date").
		Count(&onTime)

	// Currently overdue (not yet resolved)
	database.DB.Model(&models.Ticket{}).
		Where("due_date < ? AND status NOT IN ?", time.Now(), []string{"resolved", "closed"}).
		Count(&overdue)

	// Resolved but after due date (breached SLA)
	database.DB.Model(&models.Ticket{}).
		Where("resolved_at IS NOT NULL AND due_date IS NOT NULL AND resolved_at > due_date").
		Count(&breached)

	complianceRate := float64(0)
	if total > 0 {
		complianceRate = float64(onTime) / float64(total) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"sla": map[string]interface{}{
			"total_resolved":  total,
			"on_time":         onTime,
			"breached":        breached,
			"currently_overdue": overdue,
			"compliance_rate":  complianceRate,
		},
	})
}
