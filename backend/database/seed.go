package database

import (
	"log"
	"os"
	"strings"

	"dahticket-backend/config"
	"dahticket-backend/models"

	"golang.org/x/crypto/bcrypt"
)

const (
	defaultAdminEmail    = "admin@digidesks.cc"
	defaultAdminPassword = "admin123"
	legacyAdminEmail     = "admin@dahticket.com"
)

func adminSeedEmail() string {
	if v := strings.TrimSpace(os.Getenv("ADMIN_EMAIL")); v != "" {
		return v
	}
	return defaultAdminEmail
}

func adminSeedPassword() string {
	if v := os.Getenv("ADMIN_PASSWORD"); v != "" {
		return v
	}
	return defaultAdminPassword
}

// envBool reads a truthy/falsy env var, or returns defaultVal when unset/empty.
func envBool(key string, defaultVal bool) bool {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return defaultVal
	}
	switch strings.ToLower(v) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return defaultVal
	}
}

func isSeedAdminEmail(email string) bool {
	e := strings.ToLower(strings.TrimSpace(email))
	return e == strings.ToLower(adminSeedEmail()) || e == strings.ToLower(legacyAdminEmail)
}

// MigrateUserRoles upgrades legacy admin role users to manager+is_admin model.
func MigrateUserRoles() {
	var legacyAdmins []models.User
	DB.Where("role = ?", models.RoleAdmin).Find(&legacyAdmins)
	for _, u := range legacyAdmins {
		updates := map[string]interface{}{
			"role":     models.RoleManager,
			"is_admin": true,
		}
		if isSeedAdminEmail(u.Email) {
			updates["is_super_admin"] = true
		}
		DB.Model(&u).Updates(updates)
		log.Printf("Migrated legacy admin user %s to manager+is_admin", u.Email)
	}

	// Ensure seeded super admin flags on configured / legacy seed accounts
	for _, email := range []string{adminSeedEmail(), legacyAdminEmail} {
		DB.Model(&models.User{}).Where("LOWER(email) = LOWER(?)", email).
			Updates(map[string]interface{}{
				"role":           models.RoleManager,
				"is_admin":       true,
				"is_super_admin": true,
			})
	}

	// Sync KB approval_status from is_published for existing articles
	DB.Exec(`UPDATE kb_articles SET approval_status = 'published' WHERE is_published = true AND (approval_status IS NULL OR approval_status = '' OR approval_status = 'draft')`)
	DB.Exec(`UPDATE kb_articles SET approval_status = 'draft' WHERE is_published = false AND (approval_status IS NULL OR approval_status = '')`)
}

// SeedDefaultAdmin creates the Super Admin user if one does not exist.
// Set ADMIN_FORCE_PASSWORD=true to reset the seed admin password from ADMIN_PASSWORD
// (useful when env was changed after the first boot). Turn it off after logging in.
func SeedDefaultAdmin() {
	MigrateUserRoles()

	email := adminSeedEmail()
	password := adminSeedPassword()

	if envBool("ADMIN_FORCE_PASSWORD", false) {
		if err := forceResetAdminPassword(email, password); err != nil {
			log.Printf("ADMIN_FORCE_PASSWORD failed: %v", err)
		} else {
			log.Printf("ADMIN_FORCE_PASSWORD applied for %s — set ADMIN_FORCE_PASSWORD=false after login", email)
		}
	}

	var count int64
	DB.Model(&models.User{}).Where("is_super_admin = ?", true).Count(&count)
	if count > 0 {
		log.Println("Super Admin already exists, skipping seed.")
		return
	}

	// Promote configured or legacy seed email if the account already exists
	for _, candidate := range []string{email, legacyAdminEmail} {
		var existing models.User
		if err := DB.Where("LOWER(email) = LOWER(?)", candidate).First(&existing).Error; err == nil {
			DB.Model(&existing).Updates(map[string]interface{}{
				"role":           models.RoleManager,
				"is_admin":       true,
				"is_super_admin": true,
			})
			log.Printf("Promoted existing %s to Super Admin.", existing.Email)
			return
		}
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Failed to hash seed password: %v", err)
		return
	}

	admin := models.User{
		FirstName:      "System",
		LastName:       "Admin",
		Email:          email,
		Password:       string(hashedPassword),
		Role:           models.RoleManager,
		IsAdmin:        true,
		IsSuperAdmin:   true,
		IsActive:       true,
		OrganizationID: 1,
	}

	if err := DB.Create(&admin).Error; err != nil {
		log.Printf("Failed to create seed admin: %v", err)
		return
	}

	log.Printf("Super Admin seeded: %s (password from ADMIN_PASSWORD / default)", email)
}

func forceResetAdminPassword(email, password string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	var user models.User
	if err := DB.Where("LOWER(email) = LOWER(?)", email).First(&user).Error; err != nil {
		// Fall back to any existing super admin (e.g. legacy email)
		if err := DB.Where("is_super_admin = ?", true).Order("id asc").First(&user).Error; err != nil {
			return err
		}
		user.Email = email
	}

	user.Password = string(hashedPassword)
	user.Role = models.RoleManager
	user.IsAdmin = true
	user.IsSuperAdmin = true
	user.IsActive = true
	if user.OrganizationID == 0 {
		user.OrganizationID = 1
	}

	return DB.Save(&user).Error
}

// SeedDefaultUsers creates default employee and IT agent accounts if they do not exist.
func SeedDefaultUsers() {
	if !envBool("SEED_DEMO_USERS", false) {
		log.Println("SEED_DEMO_USERS disabled, skipping demo user seed.")
		return
	}

	type SeedUser struct {
		FirstName string
		LastName  string
		Email     string
		Password  string
		Role      models.Role
	}

	seedUsers := []SeedUser{
		{
			FirstName: "IT",
			LastName:  "Agent",
			Email:     "agent@dahticket.com",
			Password:  "agent123",
			Role:      models.RoleITAgent,
		},
		{
			FirstName: "Test",
			LastName:  "Employee",
			Email:     "user@dahticket.com",
			Password:  "user123",
			Role:      models.RoleEmployee,
		},
	}

	for _, su := range seedUsers {
		var existing models.User
		if err := DB.Where("LOWER(email) = LOWER(?)", su.Email).First(&existing).Error; err == nil {
			continue
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(su.Password), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("Failed to hash seed password for %s: %v", su.Email, err)
			continue
		}

		user := models.User{
			FirstName: su.FirstName,
			LastName:  su.LastName,
			Email:     su.Email,
			Password:  string(hashedPassword),
			Role:      su.Role,
			IsActive:  true,
		}

		if err := DB.Create(&user).Error; err != nil {
			log.Printf("Failed to seed user %s: %v", su.Email, err)
			continue
		}

		log.Printf("Default user seeded: %s / %s", su.Email, su.Password)
	}
}

// SeedITAMDefaults initializes ITAM settings and starter reference data.
func SeedITAMDefaults() {
	var settingsCount int64
	DB.Model(&models.ITAMSettings{}).Count(&settingsCount)
	if settingsCount == 0 {
		settings := models.ITAMSettings{
			AssetTagPrefix:   "DPA",
			AutoGenerateTag:  true,
			NextSequence:     1,
			SLALowHours:      config.SLATargets["low"],
			SLAMediumHours:   config.SLATargets["medium"],
			SLAHighHours:     config.SLATargets["high"],
			SLACriticalHours: config.SLATargets["critical"],
		}
		if err := DB.Create(&settings).Error; err != nil {
			log.Printf("Failed seeding ITAM settings: %v", err)
		}
	}

	seedCategories := []models.AssetCategory{
		{Name: "Laptop", Description: "Company laptops", IsActive: true},
		{Name: "Desktop", Description: "Workstation desktops", IsActive: true},
		{Name: "Mobile", Description: "Phones and tablets", IsActive: true},
		{Name: "Network", Description: "Networking devices", IsActive: true},
		{Name: "Peripheral", Description: "Accessories and peripherals", IsActive: true},
	}

	for _, c := range seedCategories {
		var existing models.AssetCategory
		if err := DB.Where("LOWER(name) = LOWER(?)", c.Name).First(&existing).Error; err != nil {
			if err := DB.Create(&c).Error; err != nil {
				log.Printf("Failed seeding category %s: %v", c.Name, err)
			}
		}
	}

	seedStatuses := []models.AssetStatus{
		{Name: "In Use", Description: "Assigned and in active use", IsActive: true},
		{Name: "Available", Description: "Ready for assignment", IsActive: true},
		{Name: "On Loan", Description: "Temporarily checked out to a borrower", IsActive: true},
		{Name: "In Repair", Description: "Under maintenance", IsActive: true},
		{Name: "Decommissioned", Description: "Retired from service", IsActive: true},
	}

	for _, s := range seedStatuses {
		var existing models.AssetStatus
		if err := DB.Where("LOWER(name) = LOWER(?)", s.Name).First(&existing).Error; err != nil {
			if err := DB.Create(&s).Error; err != nil {
				log.Printf("Failed seeding status %s: %v", s.Name, err)
			}
		}
	}

	seedConditions := []models.AssetCondition{
		{Name: "New", Description: "Brand new condition", IsActive: true},
		{Name: "Good", Description: "Good working condition", IsActive: true},
		{Name: "Fair", Description: "Usable with wear", IsActive: true},
		{Name: "Damaged", Description: "Needs repair", IsActive: true},
	}

	for _, c := range seedConditions {
		var existing models.AssetCondition
		if err := DB.Where("LOWER(name) = LOWER(?)", c.Name).First(&existing).Error; err != nil {
			if err := DB.Create(&c).Error; err != nil {
				log.Printf("Failed seeding condition %s: %v", c.Name, err)
			}
		}
	}

	if envBool("SEED_LOCATIONS", true) {
		type locationSeed struct {
			Name    string
			Address string
			Aliases []string
		}

		seedLocations := []locationSeed{
			{Name: "PDL 1", Address: "Penang Digital Library 1", Aliases: []string{"PDL1"}},
			{Name: "PDL 2", Address: "Penang Digital Library 2", Aliases: []string{"PDL2"}},
			{Name: "BDL", Address: "Butterworth Digital Library", Aliases: []string{}},
			{Name: "BMDL", Address: "Batu Maung Digital Library", Aliases: []string{"BMOL", "Batu Maung Online Library"}},
			{Name: "Digital Penang", Address: "Main Office", Aliases: []string{"OFFICE", "DIGITAL PENANG - MAIN OFFICE"}},
		}

		for _, s := range seedLocations {
			var existing models.Location
			nameCandidates := append([]string{s.Name}, s.Aliases...)
			found := false
			for _, candidate := range nameCandidates {
				if strings.TrimSpace(candidate) == "" {
					continue
				}
				if err := DB.Where("LOWER(name) = LOWER(?)", candidate).First(&existing).Error; err == nil {
					found = true
					break
				}
			}

			if !found && strings.TrimSpace(s.Address) != "" {
				if err := DB.Where("LOWER(address) = LOWER(?)", s.Address).First(&existing).Error; err == nil {
					found = true
				}
			}

			if found {
				existing.Name = s.Name
				existing.Address = s.Address
				existing.IsActive = true
				if s.Name == "Digital Penang" {
					existing.LocationType = "hq"
				} else {
					existing.LocationType = "site"
				}
				if err := DB.Save(&existing).Error; err != nil {
					log.Printf("Failed updating location %s: %v", s.Name, err)
				}
				continue
			}

			locType := "site"
			if s.Name == "Digital Penang" {
				locType = "hq"
			}
			newLocation := models.Location{Name: s.Name, Address: s.Address, LocationType: locType, IsActive: true}
			if err := DB.Create(&newLocation).Error; err != nil {
				log.Printf("Failed seeding location %s: %v", s.Name, err)
			}
		}

		legacyNames := []string{"PDL", "BMOL", "OFFICE"}
		for _, legacyName := range legacyNames {
			if err := DB.Model(&models.Location{}).
				Where("LOWER(name) = LOWER(?)", legacyName).
				Updates(map[string]any{"is_active": false}).Error; err != nil {
				log.Printf("Failed deactivating legacy location %s: %v", legacyName, err)
			}
		}
	} else {
		log.Println("SEED_LOCATIONS disabled, skipping location seed.")
	}

	var categories []models.AssetCategory
	if err := DB.Find(&categories).Error; err != nil {
		log.Printf("Failed loading categories for type seed: %v", err)
		return
	}

	defaultTypesByCategory := map[string][]models.AssetType{
		"laptop": {
			{Name: "Business Laptop", RequiresSerialNumber: true, IsActive: true},
			{Name: "Engineering Laptop", RequiresSerialNumber: true, IsActive: true},
		},
		"desktop": {
			{Name: "Office Desktop", RequiresSerialNumber: true, IsActive: true},
		},
		"mobile": {
			{Name: "Tablet", RequiresSerialNumber: true, IsActive: true},
			{Name: "Smartphone", RequiresSerialNumber: true, IsActive: true},
		},
		"network": {
			{Name: "Network Device", RequiresSerialNumber: false, IsActive: true},
		},
		"peripheral": {
			{Name: "Accessory", RequiresSerialNumber: false, IsActive: true},
		},
	}

	for _, category := range categories {
		catKey := strings.ToLower(strings.TrimSpace(category.Name))
		seedTypes, ok := defaultTypesByCategory[catKey]
		if !ok {
			seedTypes = []models.AssetType{{Name: "General Asset", RequiresSerialNumber: false, IsActive: true}}
		}

		for _, t := range seedTypes {
			t.CategoryID = category.ID
			var existing models.AssetType
			if err := DB.Where("LOWER(name) = LOWER(?) AND category_id = ?", t.Name, t.CategoryID).First(&existing).Error; err != nil {
				if err := DB.Create(&t).Error; err != nil {
					log.Printf("Failed seeding type %s for category %s: %v", t.Name, category.Name, err)
				}
			}
		}
	}
}
