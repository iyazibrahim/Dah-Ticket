package middleware

import (
	"net/http"
	"strings"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the JWT payload.
type Claims struct {
	UserID       uint        `json:"user_id"`
	Email        string      `json:"email"`
	Role         models.Role `json:"role"`
	IsAdmin      bool        `json:"is_admin"`
	IsSuperAdmin bool        `json:"is_super_admin"`
	jwt.RegisteredClaims
}

// AuthRequired validates the JWT token and injects user info into the context.
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header must be 'Bearer <token>'"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return []byte(config.AppConfig.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		var user models.User
		if err := database.DB.First(&user, claims.UserID).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

		if !user.IsActive {
			c.JSON(http.StatusForbidden, gin.H{"error": "Account has been deactivated"})
			c.Abort()
			return
		}

		c.Set("userID", user.ID)
		c.Set("userEmail", user.Email)
		c.Set("userRole", user.Role)
		c.Set("user", user)
		c.Next()
	}
}

// GetUser returns the authenticated user from context.
func GetUser(c *gin.Context) (models.User, bool) {
	val, ok := c.Get("user")
	if !ok {
		return models.User{}, false
	}
	user, ok := val.(models.User)
	return user, ok
}

// RoleRequired restricts access to users with specific base roles (legacy helper).
func RoleRequired(roles ...models.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetUser(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}

		for _, allowedRole := range roles {
			if user.Role == allowedRole {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

// StaffRequired allows IT agents, managers, and legacy admins.
func StaffRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetUser(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}
		if !user.IsStaffMember() {
			c.JSON(http.StatusForbidden, gin.H{"error": "Staff access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// FullAdminRequired allows manager+is_admin or super admin.
func FullAdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetUser(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}
		if !user.IsFullAdmin() {
			c.JSON(http.StatusForbidden, gin.H{"error": "Full admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// ManagerOrAdminRequired allows managers (any) or users with admin elevation.
func ManagerOrAdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetUser(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}
		if user.Role != models.RoleManager && !user.HasAdminElevation() && user.Role != models.RoleAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Manager or admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}
