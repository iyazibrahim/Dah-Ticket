package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"dahticket-backend/config"
	"dahticket-backend/database"
	"dahticket-backend/middleware"
	"dahticket-backend/models"
	"dahticket-backend/services"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createAssetRequestPayload struct {
	Type             string  `json:"type" binding:"required,oneof=loan assignment fulfillment"`
	AssetID          *uint   `json:"asset_id"`
	CategoryID       *uint   `json:"category_id"`
	AssetTypeID      *uint   `json:"asset_type_id"`
	LoanToLocationID *uint   `json:"loan_to_location_id"`
	StartAt          *string `json:"start_at"`
	DueAt            *string `json:"due_at"`
	Reason           string  `json:"reason" binding:"required,min=5"`
	CreateTicket     bool    `json:"create_ticket"`
}

type rejectAssetRequestPayload struct {
	Reason string `json:"reason" binding:"required,min=3"`
}

type fulfillAssetRequestPayload struct {
	AssetID uint `json:"asset_id" binding:"required"`
}

type confirmReturnPayload struct {
	ConditionID *uint  `json:"condition_id"`
	Notes       string `json:"notes"`
}

type updateAssetUserMetaPayload struct {
	PersonalLabel *string `json:"personal_label"`
	LocationHint  *string `json:"location_hint"`
	UserNotes     *string `json:"user_notes"`
}

type reportProblemPayload struct {
	Description string `json:"description" binding:"required,min=10"`
	Title       string `json:"title"`
}

func preloadAssetRequest(db *gorm.DB) *gorm.DB {
	return db.
		Preload("Requester").
		Preload("Asset").
		Preload("Asset.Status").
		Preload("Asset.Location").
		Preload("Asset.Category").
		Preload("Asset.Type").
		Preload("Category").
		Preload("AssetType").
		Preload("HomeLocation").
		Preload("LoanToLocation").
		Preload("Approver").
		Preload("ConditionOnReturn")
}

func findStatusIDByName(orgID uint, name string) (uint, bool) {
	var status models.AssetStatus
	q := database.DB.Where("LOWER(name) = LOWER(?) AND is_active = ?", name, true)
	// statuses are global reference data in this app
	_ = orgID
	if err := q.First(&status).Error; err != nil {
		return 0, false
	}
	return status.ID, true
}

func findConditionIDByName(name string) (uint, bool) {
	var cond models.AssetCondition
	if err := database.DB.Where("LOWER(name) = LOWER(?) AND is_active = ?", name, true).First(&cond).Error; err != nil {
		return 0, false
	}
	return cond.ID, true
}

func parseOptionalTime(s *string) (*time.Time, error) {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, strings.TrimSpace(*s))
	if err != nil {
		// also accept date-only
		t, err = time.Parse("2006-01-02", strings.TrimSpace(*s))
		if err != nil {
			return nil, err
		}
	}
	return &t, nil
}

func syncOverdueStatus(req *models.AssetRequest) {
	if req.DueAt == nil {
		return
	}
	if (req.Status == models.AssetRequestCheckedOut || req.Status == models.AssetRequestReturnRequested) &&
		req.DueAt.Before(time.Now()) && req.Status != models.AssetRequestOverdue {
		if req.Status == models.AssetRequestCheckedOut {
			req.Status = models.AssetRequestOverdue
			database.DB.Model(req).Update("status", models.AssetRequestOverdue)
		}
	}
}

func canActOnLendingRequest(user models.User, req models.AssetRequest) bool {
	if user.HasAdminElevation() || user.IsFullAdmin() {
		return true
	}
	if !user.IsStaffMember() {
		return false
	}
	// Location-scoped staff: must match home (lending) location
	if user.HasLocationScope() {
		if req.HomeLocationID == nil || user.PrimaryLocationID == nil {
			return false
		}
		return *req.HomeLocationID == *user.PrimaryLocationID
	}
	// Unscoped staff (HQ) can act on any
	return true
}

// SubmitAssetRequest lets any authenticated user submit a loan/assignment/fulfillment request.
func SubmitAssetRequest(c *gin.Context) {
	var payload createAssetRequestPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	orgID := user.OrganizationID
	if orgID == 0 {
		orgID = middleware.GetOrganizationID(c)
	}

	reqType := models.AssetRequestType(payload.Type)
	startAt, err := parseOptionalTime(payload.StartAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_at"})
		return
	}
	dueAt, err := parseOptionalTime(payload.DueAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid due_at"})
		return
	}

	if reqType == models.AssetRequestLoan {
		if dueAt == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "due_at is required for loan requests"})
			return
		}
		if startAt == nil {
			now := time.Now()
			startAt = &now
		}
	}

	var homeLocID *uint
	var assetID *uint

	if reqType == models.AssetRequestFulfillment {
		if payload.AssetTypeID == nil && payload.CategoryID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "category_id or asset_type_id required for fulfillment"})
			return
		}
		if payload.LoanToLocationID != nil {
			homeLocID = payload.LoanToLocationID
		} else if user.PrimaryLocationID != nil {
			homeLocID = user.PrimaryLocationID
		}
	} else {
		if payload.AssetID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "asset_id is required"})
			return
		}
		var a models.Asset
		if err := database.DB.Preload("Status").First(&a, *payload.AssetID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
			return
		}
		if a.OrganizationID != orgID {
			c.JSON(http.StatusForbidden, gin.H{"error": "Asset not in your organization"})
			return
		}
		if !a.IsActive {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Asset is inactive"})
			return
		}
		if a.Status.Name != "" && strings.ToLower(a.Status.Name) != "available" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Asset is not available"})
			return
		}
		// Block if already pending/active request on this asset
		var activeCount int64
		database.DB.Model(&models.AssetRequest{}).
			Where("asset_id = ? AND status IN ?", a.ID, []models.AssetRequestStatus{
				models.AssetRequestPending,
				models.AssetRequestApproved,
				models.AssetRequestCheckedOut,
				models.AssetRequestReturnRequested,
				models.AssetRequestOverdue,
			}).Count(&activeCount)
		if activeCount > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Asset already has an active request"})
			return
		}
		assetID = &a.ID
		homeLocID = a.LocationID
	}

	loanTo := payload.LoanToLocationID
	if loanTo == nil && user.PrimaryLocationID != nil {
		loanTo = user.PrimaryLocationID
	}

	var ticketID *uint
	if payload.CreateTicket && reqType == models.AssetRequestFulfillment {
		title := "Equipment request"
		if payload.AssetTypeID != nil {
			var at models.AssetType
			if database.DB.First(&at, *payload.AssetTypeID).Error == nil {
				title = "Equipment request: " + at.Name
			}
		}
		due := config.GetSLADueDate(string(models.PriorityMedium), time.Now())
		ticket := models.Ticket{
			Title:          title,
			Description:    payload.Reason,
			Status:         models.StatusOpen,
			Priority:       models.PriorityMedium,
			Type:           models.TypeServiceRequest,
			Category:       "hardware",
			RequesterID:    user.ID,
			OrganizationID: orgID,
			LocationID:     loanTo,
			DueDate:        &due,
		}
		if err := database.DB.Create(&ticket).Error; err == nil {
			ticketID = &ticket.ID
			LogAudit(c, models.AuditActionCreate, "ticket", ticket.ID, "", ToJSON(ticket), "Created from asset fulfillment request")
		}
	}

	ar := models.AssetRequest{
		OrganizationID:   orgID,
		Type:             reqType,
		Status:           models.AssetRequestPending,
		RequesterID:      user.ID,
		AssetID:          assetID,
		CategoryID:       payload.CategoryID,
		AssetTypeID:      payload.AssetTypeID,
		HomeLocationID:   homeLocID,
		LoanToLocationID: loanTo,
		StartAt:          startAt,
		DueAt:            dueAt,
		Reason:           payload.Reason,
		TicketID:         ticketID,
	}

	if err := database.DB.Create(&ar).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	preloadAssetRequest(database.DB).First(&ar, ar.ID)
	LogAudit(c, models.AuditActionCreate, "asset_request", ar.ID, "", ToJSON(ar), "Asset request created")

	// Notify lending-site staff or admins
	services.DispatchAssetRequestCreated(orgID, ar)

	c.JSON(http.StatusCreated, gin.H{"request": ar})
}

// ListMyAssetRequests returns requests created by the current user.
func ListMyAssetRequests(c *gin.Context) {
	userID := c.MustGet("userID").(uint)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	query := database.DB.Model(&models.AssetRequest{}).Where("requester_id = ?", userID)
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	query.Count(&total)

	var requests []models.AssetRequest
	preloadAssetRequest(query).
		Order("created_at DESC").
		Offset((page - 1) * perPage).Limit(perPage).
		Find(&requests)

	for i := range requests {
		syncOverdueStatus(&requests[i])
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, gin.H{
		"requests":    requests,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// ListAssetRequests staff queue for approving loans/assignments.
func ListAssetRequests(c *gin.Context) {
	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
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

	orgID := user.OrganizationID
	query := database.DB.Model(&models.AssetRequest{}).Where("organization_id = ?", orgID)

	if user.HasLocationScope() && user.PrimaryLocationID != nil {
		query = query.Where("home_location_id = ?", *user.PrimaryLocationID)
	}

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if reqType := c.Query("type"); reqType != "" {
		query = query.Where("type = ?", reqType)
	}
	if loc := c.Query("location_id"); loc != "" {
		query = query.Where("home_location_id = ? OR loan_to_location_id = ?", loc, loc)
	}
	if c.Query("overdue") == "true" {
		query = query.Where("status IN ? AND due_at < ?", []models.AssetRequestStatus{
			models.AssetRequestCheckedOut, models.AssetRequestReturnRequested, models.AssetRequestOverdue,
		}, time.Now())
	}

	var total int64
	query.Count(&total)

	var requests []models.AssetRequest
	preloadAssetRequest(query).
		Order("created_at DESC").
		Offset((page - 1) * perPage).Limit(perPage).
		Find(&requests)

	for i := range requests {
		syncOverdueStatus(&requests[i])
	}

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, gin.H{
		"requests":    requests,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// GetAssetRequestBadge returns counts for staff nav badges.
func GetAssetRequestBadge(c *gin.Context) {
	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	scoped := func() *gorm.DB {
		q := database.DB.Model(&models.AssetRequest{}).Where("organization_id = ?", user.OrganizationID)
		if user.HasLocationScope() && user.PrimaryLocationID != nil {
			q = q.Where("home_location_id = ?", *user.PrimaryLocationID)
		}
		return q
	}

	var pending, returnRequested, overdue int64
	scoped().Where("status = ?", models.AssetRequestPending).Count(&pending)
	scoped().Where("status = ?", models.AssetRequestReturnRequested).Count(&returnRequested)
	scoped().Where(
		"(status = ?) OR (status IN ? AND due_at < ?)",
		models.AssetRequestOverdue,
		[]models.AssetRequestStatus{models.AssetRequestCheckedOut, models.AssetRequestReturnRequested},
		time.Now(),
	).Count(&overdue)

	c.JSON(http.StatusOK, gin.H{
		"pending":          pending,
		"return_requested": returnRequested,
		"overdue":          overdue,
		"total":            pending + returnRequested + overdue,
	})
}

// GetAssetRequest returns a single request if requester or staff with access.
func GetAssetRequest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var ar models.AssetRequest
	if err := preloadAssetRequest(database.DB).First(&ar, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}

	if ar.RequesterID != user.ID && !canActOnLendingRequest(user, ar) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	syncOverdueStatus(&ar)
	c.JSON(http.StatusOK, gin.H{"request": ar})
}

// CancelAssetRequest lets the requester cancel a pending request.
func CancelAssetRequest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	userID := c.MustGet("userID").(uint)

	var ar models.AssetRequest
	if err := database.DB.First(&ar, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if ar.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the requester can cancel"})
		return
	}
	if ar.Status != models.AssetRequestPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only pending requests can be cancelled"})
		return
	}

	old := ToJSON(ar)
	ar.Status = models.AssetRequestCancelled
	database.DB.Save(&ar)
	LogAudit(c, models.AuditActionUpdate, "asset_request", ar.ID, old, ToJSON(ar), "Request cancelled by requester")
	preloadAssetRequest(database.DB).First(&ar, ar.ID)
	c.JSON(http.StatusOK, gin.H{"request": ar})
}

// ApproveAssetRequest staff approves a pending request.
func ApproveAssetRequest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var ar models.AssetRequest
	if err := preloadAssetRequest(database.DB).First(&ar, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if !canActOnLendingRequest(user, ar) {
		// Escalate path: location-scoped with no PIC at lending site — admins already covered
		if !(user.HasAdminElevation() || user.IsFullAdmin()) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only lending-site staff or admins can approve"})
			return
		}
	}
	if ar.Status != models.AssetRequestPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request is not pending"})
		return
	}
	if ar.Type == models.AssetRequestFulfillment && ar.AssetID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Assign an asset before approving a fulfillment request"})
		return
	}

	old := ToJSON(ar)
	now := user.ID
	ar.ApprovedBy = &now
	ar.Status = models.AssetRequestApproved

	// Assignment type: immediately assign asset
	if ar.Type == models.AssetRequestAssignment && ar.AssetID != nil {
		inUseID, okStatus := findStatusIDByName(ar.OrganizationID, "In Use")
		updates := map[string]interface{}{
			"assigned_user_id": ar.RequesterID,
			"updated_by":       user.ID,
		}
		if okStatus {
			updates["status_id"] = inUseID
		}
		database.DB.Model(&models.Asset{}).Where("id = ?", *ar.AssetID).Updates(updates)
		ar.Status = models.AssetRequestAssigned
	}

	database.DB.Save(&ar)
	LogAudit(c, models.AuditActionUpdate, "asset_request", ar.ID, old, ToJSON(ar), "Request approved")
	preloadAssetRequest(database.DB).First(&ar, ar.ID)
	services.DispatchAssetRequestStatusChanged(ar.OrganizationID, ar, "approved")
	c.JSON(http.StatusOK, gin.H{"request": ar})
}

// RejectAssetRequest staff rejects a pending request.
func RejectAssetRequest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var payload rejectAssetRequestPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var ar models.AssetRequest
	if err := preloadAssetRequest(database.DB).First(&ar, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if !canActOnLendingRequest(user, ar) && !(user.HasAdminElevation() || user.IsFullAdmin()) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if ar.Status != models.AssetRequestPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request is not pending"})
		return
	}

	old := ToJSON(ar)
	ar.Status = models.AssetRequestRejected
	ar.RejectReason = payload.Reason
	uid := user.ID
	ar.ApprovedBy = &uid
	database.DB.Save(&ar)
	LogAudit(c, models.AuditActionUpdate, "asset_request", ar.ID, old, ToJSON(ar), "Request rejected")
	preloadAssetRequest(database.DB).First(&ar, ar.ID)
	services.DispatchAssetRequestStatusChanged(ar.OrganizationID, ar, "rejected")
	c.JSON(http.StatusOK, gin.H{"request": ar})
}

// CheckoutAssetRequest confirms physical handoff for an approved loan.
func CheckoutAssetRequest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var ar models.AssetRequest
	if err := preloadAssetRequest(database.DB).First(&ar, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if !canActOnLendingRequest(user, ar) && !(user.HasAdminElevation() || user.IsFullAdmin()) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if ar.Type != models.AssetRequestLoan && ar.Type != models.AssetRequestFulfillment {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Checkout only applies to loan/fulfillment"})
		return
	}
	if ar.Status != models.AssetRequestApproved {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request must be approved before checkout"})
		return
	}
	if ar.AssetID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No asset on request"})
		return
	}

	old := ToJSON(ar)
	now := time.Now()
	ar.Status = models.AssetRequestCheckedOut
	ar.CheckedOutAt = &now

	onLoanID, okStatus := findStatusIDByName(ar.OrganizationID, "On Loan")
	if !okStatus {
		onLoanID, okStatus = findStatusIDByName(ar.OrganizationID, "In Use")
	}
	updates := map[string]interface{}{
		"assigned_user_id": ar.RequesterID,
		"updated_by":       user.ID,
	}
	if okStatus {
		updates["status_id"] = onLoanID
	}
	database.DB.Model(&models.Asset{}).Where("id = ?", *ar.AssetID).Updates(updates)
	database.DB.Save(&ar)

	LogAudit(c, models.AuditActionUpdate, "asset_request", ar.ID, old, ToJSON(ar), "Asset checked out")
	preloadAssetRequest(database.DB).First(&ar, ar.ID)
	services.DispatchAssetRequestStatusChanged(ar.OrganizationID, ar, "checked_out")
	c.JSON(http.StatusOK, gin.H{"request": ar})
}

// RequestAssetReturn lets borrower mark loan ready for return.
func RequestAssetReturn(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	userID := c.MustGet("userID").(uint)

	var ar models.AssetRequest
	if err := preloadAssetRequest(database.DB).First(&ar, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if ar.RequesterID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the borrower can request return"})
		return
	}
	if ar.Status != models.AssetRequestCheckedOut && ar.Status != models.AssetRequestOverdue {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Asset is not currently on loan"})
		return
	}

	old := ToJSON(ar)
	ar.Status = models.AssetRequestReturnRequested
	database.DB.Save(&ar)
	LogAudit(c, models.AuditActionUpdate, "asset_request", ar.ID, old, ToJSON(ar), "Return requested")
	preloadAssetRequest(database.DB).First(&ar, ar.ID)
	services.DispatchAssetRequestStatusChanged(ar.OrganizationID, ar, "return_requested")
	c.JSON(http.StatusOK, gin.H{"request": ar})
}

// ConfirmAssetReturn staff confirms physical return.
func ConfirmAssetReturn(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var payload confirmReturnPayload
	_ = c.ShouldBindJSON(&payload)

	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var ar models.AssetRequest
	if err := preloadAssetRequest(database.DB).First(&ar, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if !canActOnLendingRequest(user, ar) && !(user.HasAdminElevation() || user.IsFullAdmin()) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if ar.Status != models.AssetRequestReturnRequested &&
		ar.Status != models.AssetRequestCheckedOut &&
		ar.Status != models.AssetRequestOverdue {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request is not awaiting return"})
		return
	}
	if ar.AssetID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No asset on request"})
		return
	}

	old := ToJSON(ar)
	now := time.Now()
	ar.Status = models.AssetRequestReturned
	ar.ReturnedAt = &now
	if payload.ConditionID != nil {
		ar.ConditionOnReturnID = payload.ConditionID
	}

	availableID, okStatus := findStatusIDByName(ar.OrganizationID, "Available")
	updates := map[string]interface{}{
		"assigned_user_id": nil,
		"updated_by":       user.ID,
	}
	if okStatus {
		updates["status_id"] = availableID
	}
	if payload.ConditionID != nil {
		updates["condition_id"] = *payload.ConditionID
	}
	database.DB.Model(&models.Asset{}).Where("id = ?", *ar.AssetID).Updates(updates)
	database.DB.Save(&ar)

	LogAudit(c, models.AuditActionUpdate, "asset_request", ar.ID, old, ToJSON(ar), "Return confirmed")
	preloadAssetRequest(database.DB).First(&ar, ar.ID)
	services.DispatchAssetRequestStatusChanged(ar.OrganizationID, ar, "returned")
	c.JSON(http.StatusOK, gin.H{"request": ar})
}

// FulfillAssetRequest attaches a concrete asset to a fulfillment request.
func FulfillAssetRequest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}
	var payload fulfillAssetRequestPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var ar models.AssetRequest
	if err := preloadAssetRequest(database.DB).First(&ar, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Request not found"})
		return
	}
	if ar.Type != models.AssetRequestFulfillment {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only fulfillment requests can be fulfilled"})
		return
	}
	if ar.Status != models.AssetRequestPending {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Request must be pending"})
		return
	}

	var asset models.Asset
	if err := database.DB.Preload("Status").First(&asset, payload.AssetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}
	if !canActOnLendingRequest(user, models.AssetRequest{HomeLocationID: asset.LocationID}) &&
		!(user.HasAdminElevation() || user.IsFullAdmin()) {
		// Allow if staff can write that asset location
		if !canWriteAssetLocation(c, asset) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied for this asset location"})
			return
		}
	}

	old := ToJSON(ar)
	ar.AssetID = &asset.ID
	ar.HomeLocationID = asset.LocationID
	// Convert to loan if dates present, else assignment-like loan
	if ar.DueAt != nil {
		ar.Type = models.AssetRequestLoan
	}
	database.DB.Save(&ar)
	LogAudit(c, models.AuditActionUpdate, "asset_request", ar.ID, old, ToJSON(ar), "Asset attached to fulfillment")
	preloadAssetRequest(database.DB).First(&ar, ar.ID)
	c.JSON(http.StatusOK, gin.H{"request": ar})
}

// ListAvailableCatalog lists Available assets for browsing/requesting (all authenticated users).
func ListAvailableCatalog(c *gin.Context) {
	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	orgID := user.OrganizationID

	availableID, okStatus := findStatusIDByName(orgID, "Available")
	if !okStatus {
		c.JSON(http.StatusOK, gin.H{"assets": []models.Asset{}, "total": 0, "page": 1, "per_page": 20, "total_pages": 0})
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

	query := database.DB.Model(&models.Asset{}).
		Where("organization_id = ? AND is_active = ? AND status_id = ?", orgID, true, availableID)

	if loc := c.Query("location_id"); loc != "" {
		query = query.Where("location_id = ?", loc)
	}
	if cat := c.Query("category_id"); cat != "" {
		query = query.Where("category_id = ?", cat)
	}
	if typ := c.Query("type_id"); typ != "" {
		query = query.Where("type_id = ?", typ)
	}
	if search := c.Query("search"); search != "" {
		query = query.Where(
			"name ILIKE ? OR asset_tag ILIKE ? OR serial_number ILIKE ?",
			"%"+search+"%", "%"+search+"%", "%"+search+"%",
		)
	}

	var total int64
	query.Count(&total)

	var assets []models.Asset
	query.Preload("Category").Preload("Type").Preload("Status").Preload("Condition").Preload("Location").
		Order("name ASC").
		Offset((page - 1) * perPage).Limit(perPage).
		Find(&assets)

	totalPages := int(total) / perPage
	if int(total)%perPage > 0 {
		totalPages++
	}

	c.JSON(http.StatusOK, gin.H{
		"assets":      assets,
		"total":       total,
		"page":        page,
		"per_page":    perPage,
		"total_pages": totalPages,
	})
}

// UpdateMyAssetMeta updates personal label/hint/notes for an assigned asset.
func UpdateMyAssetMeta(c *gin.Context) {
	assetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	userID := c.MustGet("userID").(uint)

	var payload updateAssetUserMetaPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var asset models.Asset
	if err := database.DB.First(&asset, uint(assetID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}
	if asset.AssignedUserID == nil || *asset.AssignedUserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Asset is not assigned to you"})
		return
	}

	var meta models.AssetUserMeta
	err = database.DB.Where("user_id = ? AND asset_id = ?", userID, asset.ID).First(&meta).Error
	if err == gorm.ErrRecordNotFound {
		meta = models.AssetUserMeta{UserID: userID, AssetID: asset.ID}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load meta"})
		return
	}

	if payload.PersonalLabel != nil {
		meta.PersonalLabel = *payload.PersonalLabel
	}
	if payload.LocationHint != nil {
		meta.LocationHint = *payload.LocationHint
	}
	if payload.UserNotes != nil {
		meta.UserNotes = *payload.UserNotes
	}

	if meta.ID == 0 {
		database.DB.Create(&meta)
	} else {
		database.DB.Save(&meta)
	}

	c.JSON(http.StatusOK, gin.H{"meta": meta})
}

// GetMyAssetMeta returns personal meta for an assigned asset.
func GetMyAssetMeta(c *gin.Context) {
	assetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	userID := c.MustGet("userID").(uint)

	var meta models.AssetUserMeta
	if err := database.DB.Where("user_id = ? AND asset_id = ?", userID, uint(assetID)).First(&meta).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"meta": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"meta": meta})
}

// ReportAssetProblem creates a ticket linked to the asset and marks it damaged/in repair.
func ReportAssetProblem(c *gin.Context) {
	assetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}
	var payload reportProblemPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, ok := middleware.GetUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var asset models.Asset
	if err := database.DB.Preload("Status").First(&asset, uint(assetID)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}
	if asset.AssignedUserID == nil || *asset.AssignedUserID != user.ID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Asset is not assigned to you"})
		return
	}

	orgID := user.OrganizationID
	title := payload.Title
	if strings.TrimSpace(title) == "" {
		title = "Asset problem: " + asset.Name + " (" + asset.AssetTag + ")"
	}
	due := config.GetSLADueDate(string(models.PriorityHigh), time.Now())
	ticket := models.Ticket{
		Title:          title,
		Description:    payload.Description,
		Status:         models.StatusOpen,
		Priority:       models.PriorityHigh,
		Type:           models.TypeIncident,
		Category:       "hardware",
		RequesterID:    user.ID,
		OrganizationID: orgID,
		LocationID:     asset.LocationID,
		DueDate:        &due,
	}
	if err := database.DB.Create(&ticket).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create ticket"})
		return
	}

	link := models.AssetTicketLink{
		AssetID:          asset.ID,
		TicketID:         ticket.ID,
		RelationshipType: "AFFECTED_ASSET",
		CreatedBy:        user.ID,
	}
	database.DB.Create(&link)

	// Soft-update condition/status
	if damagedID, ok := findConditionIDByName("Damaged"); ok {
		database.DB.Model(&asset).Update("condition_id", damagedID)
	}
	if repairID, ok := findStatusIDByName(orgID, "In Repair"); ok {
		database.DB.Model(&asset).Update("status_id", repairID)
	}

	LogAudit(c, models.AuditActionCreate, "ticket", ticket.ID, "", ToJSON(ticket), "Created from asset problem report")
	services.NotifyTicketCreated(orgID, user.Email, user.FirstName, ticket.ID, ticket.Title)

	c.JSON(http.StatusCreated, gin.H{
		"ticket": ticket,
		"link":   link,
		"message": "Problem reported. A support ticket was created.",
	})
}

// ListPublicLocations returns active locations for employee catalog filters.
func ListPublicLocations(c *gin.Context) {
	var locations []models.Location
	database.DB.Where("is_active = ?", true).Order("name ASC").Find(&locations)
	c.JSON(http.StatusOK, gin.H{"locations": locations})
}

// ListPublicCategories returns active categories.
func ListPublicCategories(c *gin.Context) {
	var cats []models.AssetCategory
	database.DB.Where("is_active = ?", true).Order("name ASC").Find(&cats)
	c.JSON(http.StatusOK, gin.H{"categories": cats})
}

// ListPublicTypes returns active asset types.
func ListPublicTypes(c *gin.Context) {
	query := database.DB.Where("is_active = ?", true)
	if cat := c.Query("category_id"); cat != "" {
		query = query.Where("category_id = ?", cat)
	}
	var types []models.AssetType
	query.Order("name ASC").Find(&types)
	c.JSON(http.StatusOK, gin.H{"types": types})
}
