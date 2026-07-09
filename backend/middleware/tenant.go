package middleware

import (
	"net/http"
	"strings"

	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
)

const defaultOrgID uint = 1

// TenantResolver resolves organization from host header or dev override.
func TenantResolver() gin.HandlerFunc {
	return func(c *gin.Context) {
		orgID := defaultOrgID
		host := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Organization-Slug")))
		if host == "" {
			rawHost := c.Request.Host
			if idx := strings.Index(rawHost, ":"); idx > 0 {
				rawHost = rawHost[:idx]
			}
			host = strings.ToLower(strings.TrimSpace(rawHost))
		}

		if host != "" && host != "localhost" && host != "127.0.0.1" && host != "frontend" {
			var domain models.Domain
			if err := database.DB.Where("LOWER(hostname) = ? AND is_active = ?", host, true).
				Preload("Organization").First(&domain).Error; err == nil {
				orgID = domain.OrganizationID
				c.Set("organization", domain.Organization)
			} else {
				var org models.Organization
				if err := database.DB.Where("LOWER(slug) = ? AND is_active = ?", host, true).First(&org).Error; err == nil {
					orgID = org.ID
					c.Set("organization", org)
				}
			}
		}

		if _, ok := c.Get("organization"); !ok {
			var org models.Organization
			if err := database.DB.First(&org, orgID).Error; err == nil {
				c.Set("organization", org)
			}
		}

		c.Set("organizationID", orgID)
		c.Next()
	}
}

// GetOrganizationID returns the resolved organization ID from context.
func GetOrganizationID(c *gin.Context) uint {
	if v, ok := c.Get("organizationID"); ok {
		if id, ok := v.(uint); ok && id > 0 {
			return id
		}
	}
	return defaultOrgID
}

// GetOrganization returns the resolved organization from context.
func GetOrganization(c *gin.Context) (models.Organization, bool) {
	val, ok := c.Get("organization")
	if !ok {
		return models.Organization{}, false
	}
	org, ok := val.(models.Organization)
	return org, ok
}

// RequireOrgAccess ensures the user's organization matches the resolved tenant.
func RequireOrgAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetUser(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}
		if user.IsSuperAdmin {
			c.Next()
			return
		}
		orgID := GetOrganizationID(c)
		if user.OrganizationID != 0 && user.OrganizationID != orgID {
			// HQ users may access child org domains when parent matches
			var resolved models.Organization
			if err := database.DB.First(&resolved, orgID).Error; err == nil {
				if resolved.ParentOrgID != nil && *resolved.ParentOrgID == user.OrganizationID {
					c.Next()
					return
				}
			}
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied for this organization"})
			c.Abort()
			return
		}
		c.Next()
	}
}
