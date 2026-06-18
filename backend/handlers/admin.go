package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

type AdminCreateUserRequest struct {
	FirstName         string `json:"first_name" binding:"required,min=2,max=100"`
	LastName          string `json:"last_name" binding:"required,min=2,max=100"`
	Email             string `json:"email" binding:"required,email"`
	Password          string `json:"password" binding:"required,min=8"`
	Role              string `json:"role" binding:"required,oneof=employee it_agent manager"`
	IsAdmin           bool   `json:"is_admin"`
	PrimaryLocationID *uint  `json:"primary_location_id"`
}

type AdminUpdateUserRequest struct {
	FirstName         *string `json:"first_name" binding:"omitempty,min=2,max=100"`
	LastName          *string `json:"last_name" binding:"omitempty,min=2,max=100"`
	Email             *string `json:"email" binding:"omitempty,email"`
	Role              *string `json:"role" binding:"omitempty,oneof=employee it_agent manager"`
	IsAdmin           *bool   `json:"is_admin"`
	IsActive          *bool   `json:"is_active"`
	Password          *string `json:"password" binding:"omitempty,min=8"`
	PrimaryLocationID **uint  `json:"primary_location_id"`
}

func countActiveAdmins(excludeID uint) int64 {
	var count int64
	q := database.DB.Model(&models.User{}).Where("is_active = ? AND (is_admin = ? OR is_super_admin = ? OR role = ?)", true, true, true, models.RoleAdmin)
	if excludeID > 0 {
		q = q.Where("id != ?", excludeID)
	}
	q.Count(&count)
	return count
}

func canManageTargetUser(actor, target models.User) bool {
	if target.IsSuperAdmin && actor.ID != target.ID {
		return actor.IsFullAdmin()
	}
	return actor.IsFullAdmin()
}

// AdminListUsers returns all users with optional filtering.
func AdminListUsers(c *gin.Context) {
	actor, _ := middleware.GetUser(c)
	if !actor.IsFullAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Full admin access required"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	query := database.DB.Model(&models.User{})

	if role := c.Query("role"); role != "" {
		query = query.Where("role = ?", role)
	}
	if active := c.Query("is_active"); active != "" {
		query = query.Where("is_active = ?", active == "true")
	}
	if search := c.Query("search"); search != "" {
		query = query.Where("first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%")
	}

	var total int64
	query.Count(&total)

	var users []models.User
	offset := (page - 1) * perPage
	query.Order("created_at DESC").Offset(offset).Limit(perPage).Find(&users)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	userResponses := make([]UserResponse, len(users))
	for i, u := range users {
		userResponses[i] = toUserResponse(u)
	}

	c.JSON(http.StatusOK, gin.H{
		"users":       userResponses,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// AdminGetUser returns a single user's details.
func AdminGetUser(c *gin.Context) {
	actor, _ := middleware.GetUser(c)
	if !actor.IsFullAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Full admin access required"})
		return
	}

	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var user models.User
	if err := database.DB.First(&user, uint(userID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": toUserResponse(user)})
}

// AdminCreateUser creates a new user with a specified role.
func AdminCreateUser(c *gin.Context) {
	actor, _ := middleware.GetUser(c)
	if !actor.IsFullAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Full admin access required"})
		return
	}

	var req AdminCreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.IsAdmin && !actor.CanPromoteAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only full admins can grant admin elevation"})
		return
	}

	var existing models.User
	if err := database.DB.Where("email = ?", req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	user := models.User{
		FirstName:         req.FirstName,
		LastName:          req.LastName,
		Email:             req.Email,
		Password:          string(hashedPassword),
		Role:              models.Role(req.Role),
		IsAdmin:           req.IsAdmin,
		IsActive:          true,
		PrimaryLocationID: req.PrimaryLocationID,
	}

	if req.PrimaryLocationID != nil {
		var loc models.Location
		if err := database.DB.First(&loc, *req.PrimaryLocationID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid primary location"})
			return
		}
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	LogAudit(c, models.AuditActionCreate, "user", user.ID, "",
		ToJSON(map[string]interface{}{"email": user.Email, "role": user.Role, "is_admin": user.IsAdmin}),
		fmt.Sprintf("Admin created user: %s (%s)", user.Email, user.Role))

	c.JSON(http.StatusCreated, gin.H{"user": toUserResponse(user)})
}

// AdminUpdateUser updates a user's profile, role, or active status.
func AdminUpdateUser(c *gin.Context) {
	actor, _ := middleware.GetUser(c)
	if !actor.IsFullAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Full admin access required"})
		return
	}

	userID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req AdminUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.First(&user, uint(userID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if !canManageTargetUser(actor, user) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions to modify this user"})
		return
	}

	if req.IsAdmin != nil && *req.IsAdmin && !actor.CanPromoteAdmin() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only full admins can grant admin elevation"})
		return
	}

	if user.IsSuperAdmin {
		if req.IsActive != nil && !*req.IsActive {
			if countActiveAdmins(user.ID) < 1 {
				c.JSON(http.StatusConflict, gin.H{
					"error": "Cannot deactivate Super Admin: at least one other active admin must exist",
				})
				return
			}
		}
	}

	currentAdminID := actor.ID
	if req.IsActive != nil && !*req.IsActive && user.ID == currentAdminID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You cannot deactivate your own account"})
		return
	}

	oldValues := map[string]interface{}{
		"first_name": user.FirstName, "last_name": user.LastName,
		"email": user.Email, "role": user.Role, "is_active": user.IsActive,
		"is_admin": user.IsAdmin, "primary_location_id": user.PrimaryLocationID,
	}

	changes := []string{}

	if req.FirstName != nil {
		changes = append(changes, fmt.Sprintf("name: %s → %s", user.FirstName, *req.FirstName))
		user.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		user.LastName = *req.LastName
	}
	if req.Email != nil && *req.Email != user.Email {
		var existing models.User
		if err := database.DB.Where("email = ? AND id != ?", *req.Email, user.ID).First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already in use"})
			return
		}
		changes = append(changes, fmt.Sprintf("email: %s → %s", user.Email, *req.Email))
		user.Email = *req.Email
	}
	if req.Role != nil && !user.IsSuperAdmin {
		changes = append(changes, fmt.Sprintf("role: %s → %s", user.Role, *req.Role))
		user.Role = models.Role(*req.Role)
	}
	if req.IsAdmin != nil && !user.IsSuperAdmin {
		changes = append(changes, fmt.Sprintf("is_admin: %v → %v", user.IsAdmin, *req.IsAdmin))
		user.IsAdmin = *req.IsAdmin
	}
	if req.IsActive != nil {
		action := "activated"
		if !*req.IsActive {
			action = "deactivated"
		}
		changes = append(changes, action)
		user.IsActive = *req.IsActive
	}
	if req.PrimaryLocationID != nil {
		if *req.PrimaryLocationID == nil {
			user.PrimaryLocationID = nil
			changes = append(changes, "primary location cleared")
		} else {
			var loc models.Location
			if err := database.DB.First(&loc, **req.PrimaryLocationID).Error; err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid primary location"})
				return
			}
			user.PrimaryLocationID = *req.PrimaryLocationID
			changes = append(changes, fmt.Sprintf("primary location set to %s", loc.Name))
		}
	}
	if req.Password != nil {
		hashed, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
			return
		}
		changes = append(changes, "password reset")
		user.Password = string(hashed)
	}

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	newValues := map[string]interface{}{
		"first_name": user.FirstName, "last_name": user.LastName,
		"email": user.Email, "role": user.Role, "is_active": user.IsActive,
		"is_admin": user.IsAdmin, "primary_location_id": user.PrimaryLocationID,
	}

	LogAudit(c, models.AuditActionUpdate, "user", user.ID,
		ToJSON(oldValues), ToJSON(newValues),
		fmt.Sprintf("Admin updated user %s: %s", user.Email, joinChanges(changes)))

	c.JSON(http.StatusOK, gin.H{"user": toUserResponse(user)})
}

// AdminListAgents returns staff members for assignment dropdowns.
func AdminListAgents(c *gin.Context) {
	actor, _ := middleware.GetUser(c)
	if !actor.CanAssignITAgents() {
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		return
	}

	var users []models.User
	database.DB.Where("role IN ? AND is_active = ?", []string{string(models.RoleITAgent), string(models.RoleManager), string(models.RoleAdmin)}, true).
		Order("first_name ASC").Find(&users)

	if actor.IsDelegatedAdmin() && !actor.CanAssignAnyone() {
		filtered := make([]models.User, 0)
		for _, u := range users {
			if u.Role == models.RoleITAgent {
				filtered = append(filtered, u)
			}
		}
		users = filtered
	}

	responses := make([]UserResponse, len(users))
	for i, u := range users {
		responses[i] = toUserResponse(u)
	}

	c.JSON(http.StatusOK, gin.H{"agents": responses})
}
