package handlers

import (
	"net/http"
	"strconv"

	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

type CreateOrganizationRequest struct {
	Name        string `json:"name" binding:"required,max=150"`
	Slug        string `json:"slug" binding:"required,max=80"`
	Type        string `json:"type" binding:"omitempty,oneof=hq branch standalone"`
	ParentOrgID *uint  `json:"parent_org_id"`
}

type CreateDomainRequest struct {
	Hostname  string `json:"hostname" binding:"required,max=255"`
	IsPrimary bool   `json:"is_primary"`
}

// ListOrganizations lists organizations visible to the caller.
func ListOrganizations(c *gin.Context) {
	user, _ := middleware.GetUser(c)
	var orgs []models.Organization
	q := database.DB.Where("is_active = ?", true)
	if !user.IsSuperAdmin {
		q = q.Where("id = ? OR parent_org_id = ?", user.OrganizationID, user.OrganizationID)
	}
	q.Order("name ASC").Find(&orgs)
	c.JSON(http.StatusOK, gin.H{"organizations": orgs})
}

// GetOrganization returns a single organization.
func GetOrganization(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}
	var org models.Organization
	if err := database.DB.First(&org, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"organization": org})
}

// CreateOrganization creates a new organization (super admin only).
func CreateOrganization(c *gin.Context) {
	user, _ := middleware.GetUser(c)
	if !user.IsSuperAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Super admin access required"})
		return
	}
	var req CreateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	orgType := req.Type
	if orgType == "" {
		orgType = models.OrgTypeStandalone
	}
	org := models.Organization{
		Name:        req.Name,
		Slug:        req.Slug,
		Type:        orgType,
		ParentOrgID: req.ParentOrgID,
		IsActive:    true,
	}
	if err := database.DB.Create(&org).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Organization slug may already exist"})
		return
	}
	// Create default settings row for new org
	settings := models.ITAMSettings{OrganizationID: org.ID}
	database.DB.Create(&settings)
	c.JSON(http.StatusCreated, gin.H{"organization": org})
}

// ListDomains lists domains for an organization.
func ListDomains(c *gin.Context) {
	orgID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}
	var domains []models.Domain
	database.DB.Where("organization_id = ?", uint(orgID)).Order("is_primary DESC, hostname ASC").Find(&domains)
	c.JSON(http.StatusOK, gin.H{"domains": domains})
}

// CreateDomain adds a domain mapping for an organization (super admin).
func CreateDomain(c *gin.Context) {
	user, _ := middleware.GetUser(c)
	if !user.IsSuperAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Super admin access required"})
		return
	}
	orgID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}
	var req CreateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	domain := models.Domain{
		Hostname:       req.Hostname,
		OrganizationID: uint(orgID),
		IsPrimary:      req.IsPrimary,
		IsActive:       true,
	}
	if err := database.DB.Create(&domain).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Domain may already exist"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"domain": domain})
}

// RouteTicketToCentral routes a ticket to the parent HQ organization.
func RouteTicketToCentral(c *gin.Context) {
	ticketID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ticket ID"})
		return
	}
	user, _ := middleware.GetUser(c)
	if !user.IsStaffMember() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Staff access required"})
		return
	}

	var ticket models.Ticket
	if err := database.DB.First(&ticket, uint(ticketID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Ticket not found"})
		return
	}

	var org models.Organization
	if err := database.DB.First(&org, ticket.OrganizationID).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ticket organization not found"})
		return
	}
	if org.ParentOrgID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This organization has no parent HQ to route to"})
		return
	}

	parentID := *org.ParentOrgID
	ticket.RoutedToOrgID = &parentID
	ticket.IsCentralIntake = true
	if err := database.DB.Save(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to route ticket"})
		return
	}

	LogAudit(c, models.AuditActionUpdate, "ticket", ticket.ID,
		ToJSON(map[string]interface{}{"routed_to_org_id": nil, "is_central_intake": false}),
		ToJSON(map[string]interface{}{"routed_to_org_id": parentID, "is_central_intake": true}),
		"Ticket routed to central office")

	database.DB.Preload("Requester").Preload("Assignee").Preload("Location").First(&ticket, ticket.ID)
	c.JSON(http.StatusOK, gin.H{"ticket": toTicketResponse(ticket)})
}
