package handlers

import (
	"net/http"
	"time"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// --- Request / Response DTOs ---

type RegisterRequest struct {
	FirstName string `json:"first_name" binding:"required,min=2,max=100"`
	LastName  string `json:"last_name" binding:"required,min=2,max=100"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type UpdateMeRequest struct {
	FirstName   *string `json:"first_name" binding:"omitempty,min=2,max=100"`
	LastName    *string `json:"last_name" binding:"omitempty,min=2,max=100"`
	OldPassword *string `json:"old_password"`
	NewPassword *string `json:"new_password" binding:"omitempty,min=8"`
}

type AuthResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

type UserResponse struct {
	ID        uint        `json:"id"`
	FirstName string      `json:"first_name"`
	LastName  string      `json:"last_name"`
	Email     string      `json:"email"`
	Role      models.Role `json:"role"`
	IsActive  bool        `json:"is_active"`
	CreatedAt time.Time   `json:"created_at"`
}

// --- Handlers ---

// Register creates a new user account with the "employee" role.
func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existingUser models.User
	if err := database.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	user := models.User{
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  string(hashedPassword),
		Role:      models.RoleEmployee,
		IsActive:  true,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	token, err := generateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	LogAudit(c, models.AuditActionRegister, "user", user.ID, "", "", "User registered: "+user.Email)

	c.JSON(http.StatusCreated, AuthResponse{
		Token: token,
		User:  toUserResponse(user),
	})
}

// Login authenticates a user and returns a JWT token.
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "Account has been deactivated. Contact your administrator."})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := generateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	LogAudit(c, models.AuditActionLogin, "user", user.ID, "", "", "User logged in: "+user.Email)

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User:  toUserResponse(user),
	})
}

// GetMe returns the currently authenticated user's profile.
func GetMe(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Not authenticated"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": toUserResponse(user.(models.User)),
	})
}

// UpdateMe updates the authenticated user's profile and/or password.
func UpdateMe(c *gin.Context) {
	var req UpdateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("userID").(uint)

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if req.FirstName != nil {
		user.FirstName = *req.FirstName
	}
	if req.LastName != nil {
		user.LastName = *req.LastName
	}

	// Handle password change if requested
	if req.NewPassword != nil && *req.NewPassword != "" {
		if req.OldPassword == nil || *req.OldPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Old password is required to change password"})
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(*req.OldPassword)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect old password"})
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
			return
		}
		user.Password = string(hashedPassword)
	}

	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	LogAudit(c, models.AuditActionUpdate, "user", user.ID, "", "", "User updated their profile")

	c.JSON(http.StatusOK, gin.H{"user": toUserResponse(user)})
}

// --- Helpers ---

func generateToken(user models.User) (string, error) {
	claims := middleware.Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(config.GetJWTExpiration())),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "dahticket",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

func toUserResponse(user models.User) UserResponse {
	return UserResponse{
		ID:        user.ID,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Email:     user.Email,
		Role:      user.Role,
		IsActive:  user.IsActive,
		CreatedAt: user.CreatedAt,
	}
}
