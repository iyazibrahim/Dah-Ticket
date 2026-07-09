package handlers

import (
	"errors"
	"net/http"
	"strings"
	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func normalizeName(name string) string {
	return strings.TrimSpace(name)
}

func hasDuplicateName(model interface{}, name string, excludeID uint) (bool, error) {
	query := database.DB.Model(model).Where("LOWER(name) = LOWER(?)", name)
	if excludeID > 0 {
		query = query.Where("id <> ?", excludeID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}

	return count > 0, nil
}

func hasDuplicateTypeNameInCategory(name string, categoryID uint, excludeID uint) (bool, error) {
	query := database.DB.Model(&models.AssetType{}).
		Where("LOWER(name) = LOWER(?) AND category_id = ?", name, categoryID)
	if excludeID > 0 {
		query = query.Where("id <> ?", excludeID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}

	return count > 0, nil
}

func isDuplicateKeyError(err error) bool {
	if err == nil {
		return false
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "duplicate key") || strings.Contains(message, "unique constraint")
}

// --- Asset Categories ---

func ListAssetCategories(c *gin.Context) {
	var categories []models.AssetCategory
	if err := database.DB.Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch categories"})
		return
	}
	c.JSON(http.StatusOK, categories)
}

func CreateAssetCategory(c *gin.Context) {
	var req models.AssetCategory
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category name is required"})
		return
	}

	dup, err := hasDuplicateName(&models.AssetCategory{}, req.Name, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate category name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Category name already exists"})
		return
	}

	if err := database.DB.Create(&req).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Category name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create category"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func UpdateAssetCategory(c *gin.Context) {
	id := c.Param("id")
	var category models.AssetCategory
	if err := database.DB.First(&category, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Category not found"})
		return
	}

	var req models.AssetCategory
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category name is required"})
		return
	}

	dup, err := hasDuplicateName(&models.AssetCategory{}, req.Name, category.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate category name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Category name already exists"})
		return
	}

	category.Name = req.Name
	category.Description = req.Description
	category.IsActive = req.IsActive

	if err := database.DB.Save(&category).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Category name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update category"})
		return
	}
	c.JSON(http.StatusOK, category)
}

func DeleteAssetCategory(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.AssetCategory{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete category"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Category deleted"})
}

// --- Asset Types ---

func ListAssetTypes(c *gin.Context) {
	var types []models.AssetType
	if err := database.DB.Preload("Category").Find(&types).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch types"})
		return
	}
	c.JSON(http.StatusOK, types)
}

func CreateAssetType(c *gin.Context) {
	var req models.AssetType
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type name is required"})
		return
	}
	if req.CategoryID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category is required for asset type"})
		return
	}

	var category models.AssetCategory
	if err := database.DB.First(&category, req.CategoryID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Selected category does not exist"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate category"})
		return
	}

	dup, err := hasDuplicateTypeNameInCategory(req.Name, req.CategoryID, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate type name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Type name already exists in this category"})
		return
	}

	if err := database.DB.Create(&req).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Type name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create type"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func UpdateAssetType(c *gin.Context) {
	id := c.Param("id")
	var astType models.AssetType
	if err := database.DB.First(&astType, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Type not found"})
		return
	}

	var req models.AssetType
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type name is required"})
		return
	}
	if req.CategoryID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Category is required for asset type"})
		return
	}

	var category models.AssetCategory
	if err := database.DB.First(&category, req.CategoryID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Selected category does not exist"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate category"})
		return
	}

	dup, err := hasDuplicateTypeNameInCategory(req.Name, req.CategoryID, astType.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate type name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Type name already exists in this category"})
		return
	}

	astType.Name = req.Name
	astType.CategoryID = req.CategoryID
	astType.RequiresSerialNumber = req.RequiresSerialNumber
	astType.IsActive = req.IsActive

	if err := database.DB.Save(&astType).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Type name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update type"})
		return
	}
	c.JSON(http.StatusOK, astType)
}

func DeleteAssetType(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.AssetType{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete type"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Type deleted"})
}

// --- Asset Statuses ---

func ListAssetStatuses(c *gin.Context) {
	var statuses []models.AssetStatus
	if err := database.DB.Find(&statuses).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch statuses"})
		return
	}
	c.JSON(http.StatusOK, statuses)
}

func CreateAssetStatus(c *gin.Context) {
	var req models.AssetStatus
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status name is required"})
		return
	}

	dup, err := hasDuplicateName(&models.AssetStatus{}, req.Name, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate status name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Status name already exists"})
		return
	}

	if err := database.DB.Create(&req).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Status name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create status"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func UpdateAssetStatus(c *gin.Context) {
	id := c.Param("id")
	var status models.AssetStatus
	if err := database.DB.First(&status, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Status not found"})
		return
	}

	var req models.AssetStatus
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status name is required"})
		return
	}

	dup, err := hasDuplicateName(&models.AssetStatus{}, req.Name, status.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate status name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Status name already exists"})
		return
	}

	status.Name = req.Name
	status.Description = req.Description
	status.IsActive = req.IsActive

	if err := database.DB.Save(&status).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Status name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update status"})
		return
	}
	c.JSON(http.StatusOK, status)
}

func DeleteAssetStatus(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.AssetStatus{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete status"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status deleted"})
}

// --- Asset Conditions ---

func ListAssetConditions(c *gin.Context) {
	var conditions []models.AssetCondition
	if err := database.DB.Find(&conditions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch conditions"})
		return
	}
	c.JSON(http.StatusOK, conditions)
}

func CreateAssetCondition(c *gin.Context) {
	var req models.AssetCondition
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Condition name is required"})
		return
	}

	dup, err := hasDuplicateName(&models.AssetCondition{}, req.Name, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate condition name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Condition name already exists"})
		return
	}

	if err := database.DB.Create(&req).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Condition name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create condition"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func UpdateAssetCondition(c *gin.Context) {
	id := c.Param("id")
	var condition models.AssetCondition
	if err := database.DB.First(&condition, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Condition not found"})
		return
	}

	var req models.AssetCondition
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Condition name is required"})
		return
	}

	dup, err := hasDuplicateName(&models.AssetCondition{}, req.Name, condition.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate condition name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Condition name already exists"})
		return
	}

	condition.Name = req.Name
	condition.Description = req.Description
	condition.IsActive = req.IsActive

	if err := database.DB.Save(&condition).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Condition name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update condition"})
		return
	}
	c.JSON(http.StatusOK, condition)
}

func DeleteAssetCondition(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.AssetCondition{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete condition"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Condition deleted"})
}

// --- Locations ---

func ListLocations(c *gin.Context) {
	scopedLocationID, ok := EnforceLocationQuery(c)
	if !ok {
		return
	}

	query := database.DB.Model(&models.Location{})
	if scopedLocationID != "" {
		query = query.Where("id = ?", scopedLocationID)
	}

	var locations []models.Location
	if err := query.Find(&locations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch locations"})
		return
	}
	c.JSON(http.StatusOK, locations)
}

func CreateLocation(c *gin.Context) {
	var req models.Location
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Location name is required"})
		return
	}
	if req.LocationType == "" {
		req.LocationType = "site"
	}
	user, _ := middleware.GetUser(c)
	req.OrganizationID = user.OrganizationID
	if req.OrganizationID == 0 {
		req.OrganizationID = middleware.GetOrganizationID(c)
	}

	dup, err := hasDuplicateName(&models.Location{}, req.Name, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate location name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Location name already exists"})
		return
	}

	if err := database.DB.Create(&req).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Location name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create location"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func UpdateLocation(c *gin.Context) {
	id := c.Param("id")
	var location models.Location
	if err := database.DB.First(&location, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Location not found"})
		return
	}

	var req models.Location
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Location name is required"})
		return
	}

	dup, err := hasDuplicateName(&models.Location{}, req.Name, location.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate location name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Location name already exists"})
		return
	}

	location.Name = req.Name
	location.Address = req.Address
	location.IsActive = req.IsActive
	location.LocationType = req.LocationType
	if req.LocationType != "" {
		location.LocationType = req.LocationType
	}
	location.ParentID = req.ParentID

	if err := database.DB.Save(&location).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Location name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update location"})
		return
	}
	c.JSON(http.StatusOK, location)
}

func DeleteLocation(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.Location{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete location"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Location deleted"})
}

// --- Vendors ---

func ListVendors(c *gin.Context) {
	var vendors []models.Vendor
	if err := database.DB.Find(&vendors).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch vendors"})
		return
	}
	c.JSON(http.StatusOK, vendors)
}

func CreateVendor(c *gin.Context) {
	var req models.Vendor
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vendor name is required"})
		return
	}

	dup, err := hasDuplicateName(&models.Vendor{}, req.Name, 0)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate vendor name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Vendor name already exists"})
		return
	}

	if err := database.DB.Create(&req).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Vendor name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create vendor"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

func UpdateVendor(c *gin.Context) {
	id := c.Param("id")
	var vendor models.Vendor
	if err := database.DB.First(&vendor, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Vendor not found"})
		return
	}

	var req models.Vendor
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = normalizeName(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Vendor name is required"})
		return
	}

	dup, err := hasDuplicateName(&models.Vendor{}, req.Name, vendor.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate vendor name"})
		return
	}
	if dup {
		c.JSON(http.StatusConflict, gin.H{"error": "Vendor name already exists"})
		return
	}

	vendor.Name = req.Name
	vendor.ContactName = req.ContactName
	vendor.ContactEmail = req.ContactEmail
	vendor.ContactPhone = req.ContactPhone
	vendor.IsActive = req.IsActive

	if err := database.DB.Save(&vendor).Error; err != nil {
		if isDuplicateKeyError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Vendor name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update vendor"})
		return
	}
	c.JSON(http.StatusOK, vendor)
}

func DeleteVendor(c *gin.Context) {
	id := c.Param("id")
	if err := database.DB.Delete(&models.Vendor{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete vendor"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Vendor deleted"})
}
