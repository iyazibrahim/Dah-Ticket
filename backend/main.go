package main

import (
	"log"
	"os"
	"time"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/handlers"
	"dahticket-backend/middleware"
	"dahticket-backend/models"
	"dahticket-backend/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load application configuration
	config.Load()

	// Initialize Database Connection
	database.Connect()

	// Run Database Migrations
	err := database.DB.AutoMigrate(
		&models.User{},
		&models.Ticket{},
		&models.Comment{},
		&models.AuditLog{},
		&models.Attachment{},
		&models.KBArticle{},
		&models.Notification{},
		&models.AssetCategory{},
		&models.AssetType{},
		&models.AssetStatus{},
		&models.AssetCondition{},
		&models.Location{},
		&models.Vendor{},
		&models.Asset{},
		&models.AssetTicketLink{},
		&models.ITAMSettings{},
		&models.ITAMTagSequence{},
		&models.PMReport{},
		&models.PMFinding{},
		&models.PMReportFinding{},
		&models.PMFailureLog{},
		&models.PMCalibrationRecord{},
		&models.PMChecklistItem{},
	)
	if err != nil {
		log.Fatal("Failed to run database migrations:", err)
	}
	log.Println("Database migrations completed successfully")

	// Seed default admin user
	database.SeedDefaultAdmin()
	database.SeedDefaultUsers()
	database.SeedITAMDefaults()
	database.SyncSLATargetsFromDB()

	// Initialize email notification service
	services.InitEmail()

	// Initialize Gin router
	r := gin.Default()

	// CORS configuration — allow frontend requests
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000", "http://frontend:80"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// --- Public Routes (no auth required) ---
	api := r.Group("/api")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"status":  "success",
				"message": "DahTicket Backend is running",
			})
		})

		// Authentication
		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.Register)
			auth.POST("/login", handlers.Login)
		}
	}

	// --- Protected Routes (auth required) ---
	protected := api.Group("")
	protected.Use(middleware.AuthRequired())
	{
		protected.GET("/auth/me", handlers.GetMe)
		protected.PUT("/auth/me", handlers.UpdateMe)

		// Notifications
		notifications := protected.Group("/notifications")
		{
			notifications.GET("", handlers.ListNotifications)
			notifications.PUT("/:id/read", handlers.MarkNotificationRead)
			notifications.PUT("/read-all", handlers.MarkAllNotificationsRead)
		}

		// Ticket routes
		tickets := protected.Group("/tickets")
		{
			tickets.POST("", handlers.CreateTicket)
			tickets.GET("", handlers.ListTickets)
			tickets.GET("/stats", handlers.GetTicketStats)
			tickets.GET("/personal-stats", handlers.GetPersonalTicketStats)
			tickets.GET("/:id", handlers.GetTicket)
			tickets.GET("/:id/audit", handlers.GetTicketAuditLogs)
			tickets.PUT("/:id", handlers.UpdateTicket)
			tickets.DELETE("/:id", handlers.DeleteTicket)

			// Comment routes (nested under tickets)
			tickets.POST("/:id/comments", handlers.AddComment)
			tickets.PUT("/:id/comments/:commentId", handlers.UpdateComment)
			tickets.DELETE("/:id/comments/:commentId", handlers.DeleteComment)

			// Attachment routes (nested under tickets)
			tickets.POST("/:id/attachments", handlers.UploadAttachment)
			tickets.GET("/:id/attachments", handlers.ListAttachments)
			tickets.GET("/:id/attachments/:attachmentId/download", handlers.DownloadAttachment)
			tickets.DELETE("/:id/attachments/:attachmentId", handlers.DeleteAttachment)
		}

		// Knowledge Base routes (all authenticated users can read)
		kb := protected.Group("/kb")
		{
			kb.GET("", handlers.ListKBArticles)
			kb.GET("/categories", handlers.GetKBCategories)
			kb.GET("/:id", handlers.GetKBArticle)
		}

		// List available agents (for ticket assignment dropdowns)
		protected.GET("/agents", handlers.AdminListAgents)
	}

	// --- Staff-only Routes (agents + admins) ---
	staff := protected.Group("")
	staff.Use(middleware.RoleRequired(models.RoleITAgent, models.RoleAdmin))
	{
		// KB management (create/update/delete)
		staff.POST("/kb", handlers.CreateKBArticle)
		staff.PUT("/kb/:id", handlers.UpdateKBArticle)
		staff.DELETE("/kb/:id", handlers.DeleteKBArticle)

		// ITAM - Asset read (staff-accessible search for dropdowns)
		staff.GET("/itam/assets/search", handlers.SearchAssets)
		staff.GET("/itam/stats", handlers.GetITAMStats)
		staff.POST("/itam/scan/resolve", handlers.ResolveAssetQRToken)

		// ITAM - Asset CRUD (staff only)
		itam := staff.Group("/itam")
		{
			itam.GET("/assets", handlers.ListAssets)
			itam.POST("/assets", handlers.CreateAsset)
			itam.GET("/assets/:id", handlers.GetAsset)
			itam.GET("/assets/:id/qr-token", handlers.GetAssetQRToken)
			itam.PATCH("/assets/:id", handlers.UpdateAsset)
			itam.DELETE("/assets/:id", handlers.DeleteAsset)

			// Preventive maintenance reports
			itam.GET("/pm/reports", handlers.ListPMReports)
			itam.POST("/pm/reports", handlers.CreatePMReport)
			itam.POST("/pm/reports/build", handlers.BuildPMReportFromFindings)
			itam.GET("/pm/reports/:id", handlers.GetPMReport)
			itam.PUT("/pm/reports/:id", handlers.UpdatePMReport)
			itam.GET("/pm/reports/:id/export/pdf", handlers.ExportPMReportPDF)
			itam.GET("/pm/summary", handlers.GetPMSummary)
			itam.POST("/pm/reports/:id/trigger-ticket", handlers.TriggerPMTicket)
			itam.GET("/pm/findings", handlers.ListPMFindings)
			itam.POST("/pm/findings", handlers.CreatePMFinding)
			itam.PUT("/pm/findings/:id", handlers.UpdatePMFinding)
			itam.DELETE("/pm/findings/:id", handlers.DeletePMFinding)
		}

		// ITAM Reference data - read (accessible by staff, write by admin below)
		staff.GET("/itam/categories", handlers.ListAssetCategories)
		staff.GET("/itam/types", handlers.ListAssetTypes)
		staff.GET("/itam/statuses", handlers.ListAssetStatuses)
		staff.GET("/itam/conditions", handlers.ListAssetConditions)
		staff.GET("/itam/locations", handlers.ListLocations)
		staff.GET("/itam/vendors", handlers.ListVendors)

		// Ticket ↔ Asset linking (staff only)
		staff.GET("/tickets/:id/assets", handlers.GetTicketLinkedAssets)
		staff.POST("/tickets/:id/assets", handlers.LinkAssetToTicket)
		staff.DELETE("/tickets/:id/assets/:assetId", handlers.UnlinkAssetFromTicket)
	}

	// ITAM - my assigned assets (all authenticated users)
	protected.GET("/itam/my-assets", handlers.ListMyAssets)

	// --- Admin-only Routes ---
	admin := protected.Group("/admin")
	admin.Use(middleware.RoleRequired(models.RoleAdmin))
	{
		admin.GET("/users", handlers.AdminListUsers)
		admin.GET("/users/:id", handlers.AdminGetUser)
		admin.POST("/users", handlers.AdminCreateUser)
		admin.PUT("/users/:id", handlers.AdminUpdateUser)

		// Analytics endpoints
		analytics := admin.Group("/analytics")
		{
			analytics.GET("/overview", handlers.GetAnalyticsOverview)
			analytics.GET("/status", handlers.GetAnalyticsByStatus)
			analytics.GET("/priority", handlers.GetAnalyticsByPriority)
			analytics.GET("/agents", handlers.GetAnalyticsAgentWorkload)
			analytics.GET("/trend", handlers.GetAnalyticsTrend)
			analytics.GET("/sla", handlers.GetAnalyticsSLA)
		}

		// ITAM Reference data management (admin only for write)
		itamRef := admin.Group("/itam")
		{
			itamRef.POST("/categories", handlers.CreateAssetCategory)
			itamRef.PUT("/categories/:id", handlers.UpdateAssetCategory)
			itamRef.DELETE("/categories/:id", handlers.DeleteAssetCategory)

			itamRef.POST("/types", handlers.CreateAssetType)
			itamRef.PUT("/types/:id", handlers.UpdateAssetType)
			itamRef.DELETE("/types/:id", handlers.DeleteAssetType)

			itamRef.POST("/statuses", handlers.CreateAssetStatus)
			itamRef.PUT("/statuses/:id", handlers.UpdateAssetStatus)
			itamRef.DELETE("/statuses/:id", handlers.DeleteAssetStatus)

			itamRef.POST("/conditions", handlers.CreateAssetCondition)
			itamRef.PUT("/conditions/:id", handlers.UpdateAssetCondition)
			itamRef.DELETE("/conditions/:id", handlers.DeleteAssetCondition)

			itamRef.POST("/locations", handlers.CreateLocation)
			itamRef.PUT("/locations/:id", handlers.UpdateLocation)
			itamRef.DELETE("/locations/:id", handlers.DeleteLocation)

			itamRef.POST("/vendors", handlers.CreateVendor)
			itamRef.PUT("/vendors/:id", handlers.UpdateVendor)
			itamRef.DELETE("/vendors/:id", handlers.DeleteVendor)

			// ITAM settings and bulk operations
			itamRef.GET("/settings", handlers.GetITAMSettings)
			itamRef.PUT("/settings", handlers.UpdateITAMSettings)
			itamRef.GET("/assets/template", handlers.DownloadAssetImportTemplate)
			itamRef.POST("/assets/import/preview", handlers.PreviewImportAssets)
			itamRef.POST("/assets/import/commit", handlers.CommitImportAssets)
			itamRef.POST("/assets/import", handlers.ImportAssetsCSV)
			itamRef.GET("/assets/export", handlers.ExportAssetsCSV)
		}
	}

	// Get port from environment or default to 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting backend server on port %s", port)
	r.Run(":" + port)
}
