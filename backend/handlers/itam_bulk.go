package handlers

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"dahticket-backend/database"
	"dahticket-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

// columnAliases maps each canonical field name to recognised header variants (all lowercase).
// The first alias listed is the canonical/preferred name shown in the template.
var columnAliases = map[string][]string{
	"name":      {"name", "asset_name", "asset name", "item", "item name", "description"},
	"tag":       {"asset_tag", "asset tag", "tag", "tag number", "tag_number", "asset number", "asset_number", "no", "no."},
	"serial":    {"serial_number", "serial number", "serial", "sn", "s/n", "serial_no"},
	"category":  {"category", "cat", "asset_category", "category name"},
	"type":      {"type", "asset_type", "asset type", "sub_type", "subtype", "sub type"},
	"status":    {"status", "asset_status", "asset status"},
	"condition": {"condition", "asset_condition", "state"},
	"location":  {"location", "loc", "site", "branch", "location_name"},
	"vendor":    {"vendor", "supplier", "vendor_name", "manufacturer", "make"},
	"notes":     {"notes", "note", "remarks", "comments", "additional_info", "additional info"},
	"qty":       {"qty", "quantity", "unit", "units", "count"},
}

// buildColMap maps canonical field names to column indices based on the header row.
func buildColMap(headers []string) map[string]int {
	colMap := map[string]int{}
	for i, h := range headers {
		hLower := strings.ToLower(strings.TrimSpace(h))
		for canonical, aliases := range columnAliases {
			if _, alreadyMapped := colMap[canonical]; alreadyMapped {
				continue
			}
			for _, alias := range aliases {
				if hLower == alias {
					colMap[canonical] = i
					break
				}
			}
		}
	}
	return colMap
}

// getColVal returns the trimmed cell value for a canonical field, or "" if not mapped / out of range.
func getColVal(row []string, colMap map[string]int, key string) string {
	idx, ok := colMap[key]
	if !ok || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

func compactLookupKey(input string) string {
	raw := strings.ToLower(strings.TrimSpace(input))
	replacer := strings.NewReplacer(" ", "", "-", "", "_", "", ".", "")
	return replacer.Replace(raw)
}

func trimRow(row []string) []string {
	trimmed := make([]string, len(row))
	for i, col := range row {
		trimmed[i] = strings.TrimSpace(col)
	}
	return trimmed
}

func isRowEmpty(row []string) bool {
	for _, col := range row {
		if strings.TrimSpace(col) != "" {
			return false
		}
	}
	return true
}

func detectHeaderRow(rows [][]string) (int, map[string]int) {
	limit := len(rows)
	if limit > 25 {
		limit = 25
	}

	for i := 0; i < limit; i++ {
		candidate := trimRow(rows[i])
		if isRowEmpty(candidate) {
			continue
		}

		colMap := buildColMap(candidate)
		_, hasName := colMap["name"]
		_, hasTag := colMap["tag"]
		if (hasName || hasTag) && len(colMap) >= 2 {
			return i, colMap
		}
	}

	return -1, nil
}

func normalizeRecordsWithHeaderMap(rows [][]string, headerIdx int, colMap map[string]int) [][]string {
	canonicalHeader := []string{"name", "asset_tag", "serial_number", "category", "type", "status", "condition", "location", "vendor", "notes", "quantity"}
	out := make([][]string, 0, len(rows)-headerIdx)
	out = append(out, canonicalHeader)

	for i := headerIdx + 1; i < len(rows); i++ {
		row := trimRow(rows[i])
		if isRowEmpty(row) {
			continue
		}

		normalizedRow := []string{
			getColVal(row, colMap, "name"),
			getColVal(row, colMap, "tag"),
			getColVal(row, colMap, "serial"),
			getColVal(row, colMap, "category"),
			getColVal(row, colMap, "type"),
			getColVal(row, colMap, "status"),
			getColVal(row, colMap, "condition"),
			getColVal(row, colMap, "location"),
			getColVal(row, colMap, "vendor"),
			getColVal(row, colMap, "notes"),
			getColVal(row, colMap, "qty"),
		}

		if isRowEmpty(normalizedRow) {
			continue
		}

		out = append(out, normalizedRow)
	}

	return out
}

type assetImportReferenceMaps struct {
	categoryByName  map[string]uint
	categoryByID    map[uint]string
	typeByName      map[string]models.AssetType
	defaultTypeByCategory map[uint]models.AssetType
	anyDefaultType  *models.AssetType
	statusByName    map[string]uint
	statusByID      map[uint]string
	defaultStatusID uint
	defaultCategoryID uint
	conditionByName map[string]uint
	locationByName  map[string]uint
	vendorByName    map[string]uint
}

type assetImportParsedRow struct {
	line          int
	quantity      int
	name          string
	assetTag      string
	serial        string
	categoryRaw   string
	typeRaw       string
	statusRaw     string
	conditionRaw  string
	locationRaw   string
	vendorRaw     string
	notes         string
	categoryKey   string
	typeKey       string
	statusKey     string
	conditionKey  string
	locationKey   string
	vendorKey     string
	categoryID    uint
	typeID        uint
	statusID      uint
	conditionID   *uint
	locationID    *uint
	vendorID      *uint
	validationErr []string
}

type importPreviewAssetMatch struct {
	ID        uint   `json:"id"`
	Name      string `json:"name"`
	AssetTag  string `json:"asset_tag"`
	Serial    string `json:"serial_number"`
	Location  string `json:"location"`
	Category  string `json:"category"`
	Status    string `json:"status"`
	IsActive  bool   `json:"is_active"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type importPreviewRow struct {
	Line             int                       `json:"line"`
	Name             string                    `json:"name"`
	AssetTag         string                    `json:"asset_tag"`
	SerialNumber     string                    `json:"serial_number"`
	Category         string                    `json:"category"`
	Type             string                    `json:"type"`
	Status           string                    `json:"status"`
	Condition        string                    `json:"condition"`
	Location         string                    `json:"location"`
	Vendor           string                    `json:"vendor"`
	Notes            string                    `json:"notes"`
	ConflictStatus   string                    `json:"conflict_status"`
	ValidationErrors []string                  `json:"validation_errors"`
	MatchedAssets    []importPreviewAssetMatch `json:"matched_assets"`
}

type importResolveDecision struct {
	Line          int    `json:"line"`
	Action        string `json:"action"`
	TargetAssetID *uint  `json:"target_asset_id"`
}

type assetImportOptions struct {
	SheetScope      string
	QuantityMode    string
	TargetSheetName string
}

type importSheetSummary struct {
	Name      string `json:"name"`
	RawRows   int    `json:"raw_rows"`
	UsedRows  int    `json:"used_rows"`
	Matched   bool   `json:"matched"`
	HasHeader bool   `json:"has_header"`
}

type assetImportParseMetadata struct {
	SourceType        string              `json:"source_type"`
	TotalSheets       int                 `json:"total_sheets"`
	ProcessedSheets   int                 `json:"processed_sheets"`
	MatchedSheetNames []string            `json:"matched_sheet_names"`
	SheetSummaries    []importSheetSummary `json:"sheet_summaries"`
	RawRowCount       int                 `json:"raw_row_count"`
	EffectiveRowCount int                 `json:"effective_row_count"`
}

func resolveAssetImportOptions(c *gin.Context) assetImportOptions {
	options := assetImportOptions{
		SheetScope:      "masterlist_only",
		QuantityMode:    "single_asset_per_row",
		TargetSheetName: "masterlist",
	}

	if sheetScope := strings.ToLower(strings.TrimSpace(c.PostForm("sheet_scope"))); sheetScope == "all_sheets" {
		options.SheetScope = sheetScope
	}
	if quantityMode := strings.ToLower(strings.TrimSpace(c.PostForm("quantity_mode"))); quantityMode == "expand_quantity" {
		options.QuantityMode = quantityMode
	}
	if targetSheet := strings.TrimSpace(c.PostForm("target_sheet_name")); targetSheet != "" {
		options.TargetSheetName = targetSheet
	}

	return options
}

func normalizeSheetLookupKey(input string) string {
	raw := strings.ToLower(strings.TrimSpace(input))
	replacer := strings.NewReplacer(" ", "", "-", "", "_", "", ".", "")
	return replacer.Replace(raw)
}

func shouldImportSheet(sheetName string, options assetImportOptions) bool {
	if options.SheetScope == "all_sheets" {
		return true
	}

	target := normalizeSheetLookupKey(options.TargetSheetName)
	if target == "" {
		target = "masterlist"
	}
	return normalizeSheetLookupKey(sheetName) == target
}

func parsedUnitCount(parsed assetImportParsedRow, quantityMode string) int {
	if quantityMode == "expand_quantity" && parsed.quantity > 1 {
		return parsed.quantity
	}
	return 1
}

func createAssetFromParsed(tx *gorm.DB, parsed assetImportParsedRow, userID uint) error {
	assetTag := parsed.assetTag
	if assetTag == "" {
		settings, err := getOrCreateITAMSettings(tx)
		if err != nil {
			return err
		}
		if settings.AutoGenerateTag {
			tag, tagErr := nextAssetTagForLocation(tx, parsed.locationID)
			if tagErr != nil {
				return tagErr
			}
			assetTag = tag
		}
	}

	normalizedTag, err := normalizeAssetTagInput(tx, parsed.locationID, assetTag)
	if err != nil {
		return err
	}
	assetTag = normalizedTag
	if assetTag == "" {
		return fmt.Errorf("asset_tag is required")
	}

	asset := models.Asset{
		AssetTag:     assetTag,
		SerialNumber: parsed.serial,
		Name:         parsed.name,
		CategoryID:   parsed.categoryID,
		TypeID:       parsed.typeID,
		StatusID:     parsed.statusID,
		ConditionID:  parsed.conditionID,
		LocationID:   parsed.locationID,
		VendorID:     parsed.vendorID,
		Notes:        parsed.notes,
		IsActive:     true,
		CreatedBy:    userID,
		UpdatedBy:    userID,
	}

	return tx.Create(&asset).Error
}

func applyMergeToExistingAsset(tx *gorm.DB, parsed assetImportParsedRow, targetAssetID uint, userID uint) error {
	var asset models.Asset
	if err := tx.First(&asset, targetAssetID).Error; err != nil {
		return fmt.Errorf("target asset %d not found", targetAssetID)
	}

	if parsed.assetTag != "" {
		normalizedTag, err := normalizeAssetTagInput(tx, parsed.locationID, parsed.assetTag)
		if err != nil {
			return err
		}
		asset.AssetTag = normalizedTag
	}
	asset.SerialNumber = parsed.serial
	asset.Name = parsed.name
	asset.CategoryID = parsed.categoryID
	asset.TypeID = parsed.typeID
	asset.StatusID = parsed.statusID
	asset.ConditionID = parsed.conditionID
	asset.LocationID = parsed.locationID
	asset.VendorID = parsed.vendorID
	asset.Notes = parsed.notes
	asset.IsActive = true
	asset.UpdatedBy = userID

	return tx.Save(&asset).Error
}

func loadAssetImportReferenceMaps() assetImportReferenceMaps {
	var categories []models.AssetCategory
	var types []models.AssetType
	var statuses []models.AssetStatus
	var conditions []models.AssetCondition
	var locations []models.Location
	var vendors []models.Vendor

	database.DB.Find(&categories)
	database.DB.Find(&types)
	database.DB.Find(&statuses)
	database.DB.Find(&conditions)
	database.DB.Find(&locations)
	database.DB.Find(&vendors)

	refs := assetImportReferenceMaps{
		categoryByName:  map[string]uint{},
		categoryByID:    map[uint]string{},
		typeByName:      map[string]models.AssetType{},
		defaultTypeByCategory: map[uint]models.AssetType{},
		statusByName:    map[string]uint{},
		statusByID:      map[uint]string{},
		conditionByName: map[string]uint{},
		locationByName:  map[string]uint{},
		vendorByName:    map[string]uint{},
	}

	for _, v := range categories {
		key := strings.ToLower(strings.TrimSpace(v.Name))
		refs.categoryByName[key] = v.ID
		refs.categoryByID[v.ID] = v.Name
		if refs.defaultCategoryID == 0 {
			refs.defaultCategoryID = v.ID
		}
	}
	for _, v := range types {
		key := strings.ToLower(strings.TrimSpace(v.Name))
		refs.typeByName[key] = v
		if refs.anyDefaultType == nil {
			copied := v
			refs.anyDefaultType = &copied
		}
		if _, exists := refs.defaultTypeByCategory[v.CategoryID]; !exists {
			refs.defaultTypeByCategory[v.CategoryID] = v
		}
	}
	for _, v := range statuses {
		key := strings.ToLower(strings.TrimSpace(v.Name))
		refs.statusByName[key] = v.ID
		refs.statusByID[v.ID] = v.Name
		if key == "available" {
			refs.defaultStatusID = v.ID
		}
		if refs.defaultStatusID == 0 {
			refs.defaultStatusID = v.ID
		}
	}
	for _, v := range conditions {
		refs.conditionByName[strings.ToLower(strings.TrimSpace(v.Name))] = v.ID
	}
	for _, v := range locations {
		nameKey := strings.ToLower(strings.TrimSpace(v.Name))
		refs.locationByName[nameKey] = v.ID
		compactKey := compactLookupKey(v.Name)
		if compactKey != "" {
			refs.locationByName[compactKey] = v.ID
		}

		if addrKey := strings.ToLower(strings.TrimSpace(v.Address)); addrKey != "" {
			refs.locationByName[addrKey] = v.ID
			if compactAddr := compactLookupKey(v.Address); compactAddr != "" {
				refs.locationByName[compactAddr] = v.ID
			}
		}

		if idx := strings.Index(v.Name, "-"); idx > 0 {
			prefix := strings.TrimSpace(v.Name[:idx])
			if prefix != "" {
				refs.locationByName[strings.ToLower(prefix)] = v.ID
				refs.locationByName[compactLookupKey(prefix)] = v.ID
			}
		}
	}
	for _, v := range vendors {
		refs.vendorByName[strings.ToLower(strings.TrimSpace(v.Name))] = v.ID
	}

	if _, ok := refs.defaultTypeByCategory[refs.defaultCategoryID]; !ok {
		for categoryID := range refs.defaultTypeByCategory {
			refs.defaultCategoryID = categoryID
			break
		}
	}

	return refs
}

func parseUploadedAssetRecords(c *gin.Context) ([][]string, assetImportOptions, assetImportParseMetadata, error) {
	options := resolveAssetImportOptions(c)
	metadata := assetImportParseMetadata{}

	file, err := c.FormFile("file")
	if err != nil {
		return nil, options, metadata, fmt.Errorf("CSV or XLSX file is required (form field: file)")
	}

	src, err := file.Open()
	if err != nil {
		return nil, options, metadata, fmt.Errorf("failed to open uploaded file")
	}
	defer src.Close()

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == ".xlsx" {
		metadata.SourceType = "xlsx"
		xf, xErr := excelize.OpenReader(src)
		if xErr != nil {
			return nil, options, metadata, fmt.Errorf("invalid XLSX format")
		}
		defer func() { _ = xf.Close() }()

		sheets := xf.GetSheetList()
		metadata.TotalSheets = len(sheets)
		if len(sheets) == 0 {
			return nil, options, metadata, fmt.Errorf("XLSX file has no sheets")
		}

		allNormalized := [][]string{{"name", "asset_tag", "serial_number", "category", "type", "status", "condition", "location", "vendor", "notes", "quantity"}}
		for _, sheetName := range sheets {
			matched := shouldImportSheet(sheetName, options)
			rows, rowErr := xf.GetRows(sheetName)
			summary := importSheetSummary{Name: sheetName, Matched: matched}
			if rowErr != nil || len(rows) == 0 {
				metadata.SheetSummaries = append(metadata.SheetSummaries, summary)
				continue
			}
			summary.RawRows = len(rows)

			headerIdx, colMap := detectHeaderRow(rows)
			summary.HasHeader = headerIdx >= 0 && colMap != nil
			if headerIdx < 0 || colMap == nil {
				metadata.SheetSummaries = append(metadata.SheetSummaries, summary)
				continue
			}
			if !matched {
				metadata.SheetSummaries = append(metadata.SheetSummaries, summary)
				continue
			}

			normalized := normalizeRecordsWithHeaderMap(rows, headerIdx, colMap)
			summary.UsedRows = max(len(normalized)-1, 0)
			metadata.SheetSummaries = append(metadata.SheetSummaries, summary)
			if len(normalized) <= 1 {
				continue
			}

			metadata.ProcessedSheets++
			metadata.MatchedSheetNames = append(metadata.MatchedSheetNames, sheetName)
			allNormalized = append(allNormalized, normalized[1:]...)
		}

		metadata.RawRowCount = len(allNormalized) - 1
		if options.SheetScope == "masterlist_only" && metadata.ProcessedSheets == 0 {
			return nil, options, metadata, fmt.Errorf("no sheet matched '%s'; rename the target sheet or use all_sheets", options.TargetSheetName)
		}
		if len(allNormalized) < 2 {
			return nil, options, metadata, fmt.Errorf("no importable rows found across workbook sheets; expected headers like name/item/description and optional qty/location/category")
		}

		return allNormalized, options, metadata, nil
	}
	metadata.SourceType = "csv"
	metadata.TotalSheets = 1

	reader := csv.NewReader(src)
	records, readErr := reader.ReadAll()
	if readErr != nil || len(records) == 0 {
		return nil, options, metadata, fmt.Errorf("invalid CSV format or empty dataset")
	}

	headerIdx, colMap := detectHeaderRow(records)
	if headerIdx < 0 || colMap == nil {
		return nil, options, metadata, fmt.Errorf("could not detect import headers in CSV; expected headers like name/item/description")
	}

	normalized := normalizeRecordsWithHeaderMap(records, headerIdx, colMap)
	metadata.ProcessedSheets = 1
	metadata.MatchedSheetNames = []string{"CSV"}
	metadata.SheetSummaries = []importSheetSummary{{
		Name:      "CSV",
		RawRows:   len(records),
		UsedRows:  max(len(normalized)-1, 0),
		Matched:   true,
		HasHeader: true,
	}}
	metadata.RawRowCount = len(normalized) - 1
	if len(normalized) < 2 {
		return nil, options, metadata, fmt.Errorf("CSV contains no importable rows")
	}

	return normalized, options, metadata, nil
}

func parseAssetImportRow(line int, row []string, refs assetImportReferenceMaps, colMap map[string]int) assetImportParsedRow {
	out := assetImportParsedRow{line: line}
	out.quantity = 1

	if qtyRaw := getColVal(row, colMap, "qty"); qtyRaw != "" {
		qtyVal, parseErr := strconv.ParseFloat(qtyRaw, 64)
		if parseErr != nil || qtyVal < 1 {
			out.validationErr = append(out.validationErr, fmt.Sprintf("invalid quantity '%s'", qtyRaw))
		} else {
			out.quantity = int(qtyVal)
		}
	}

	out.name = getColVal(row, colMap, "name")
	out.assetTag = getColVal(row, colMap, "tag")
	out.serial = getColVal(row, colMap, "serial")
	out.categoryRaw = getColVal(row, colMap, "category")
	out.typeRaw = getColVal(row, colMap, "type")
	out.statusRaw = getColVal(row, colMap, "status")
	out.conditionRaw = getColVal(row, colMap, "condition")
	out.locationRaw = getColVal(row, colMap, "location")
	out.vendorRaw = getColVal(row, colMap, "vendor")
	out.notes = getColVal(row, colMap, "notes")

	out.categoryKey = strings.ToLower(out.categoryRaw)
	out.typeKey = strings.ToLower(out.typeRaw)
	out.statusKey = strings.ToLower(out.statusRaw)
	out.conditionKey = strings.ToLower(out.conditionRaw)
	out.locationKey = strings.ToLower(out.locationRaw)
	out.vendorKey = strings.ToLower(out.vendorRaw)

	if out.name == "" {
		out.validationErr = append(out.validationErr, "name is required")
	}

	categoryAlias := map[string]string{
		"equipment": "network",
		"accessory": "peripheral",
		"service":   "peripheral",
	}
	if alias, ok := categoryAlias[out.categoryKey]; ok {
		out.categoryKey = alias
	}

	if out.categoryKey != "" {
		if categoryID, ok := refs.categoryByName[out.categoryKey]; ok {
			out.categoryID = categoryID
		}
	}
	if out.categoryID == 0 {
		out.categoryID = refs.defaultCategoryID
		if out.categoryRaw == "" {
			out.categoryRaw = refs.categoryByID[out.categoryID]
		}
	}

	if out.typeKey != "" {
		if typeVal, ok := refs.typeByName[out.typeKey]; ok {
			if out.categoryID == 0 || typeVal.CategoryID == out.categoryID {
				out.typeID = typeVal.ID
				out.categoryID = typeVal.CategoryID
			}
		}
	}
	if out.typeID == 0 {
		if fallbackType, ok := refs.defaultTypeByCategory[out.categoryID]; ok {
			out.typeID = fallbackType.ID
			if out.typeRaw == "" {
				out.typeRaw = fallbackType.Name
			}
		} else if refs.anyDefaultType != nil {
			out.typeID = refs.anyDefaultType.ID
			if out.typeRaw == "" {
				out.typeRaw = refs.anyDefaultType.Name
			}
		} else {
			out.validationErr = append(out.validationErr, "no default asset type available for resolved category")
		}
	}

	if out.statusKey != "" {
		if statusID, ok := refs.statusByName[out.statusKey]; ok {
			out.statusID = statusID
		}
	}
	if out.statusID == 0 {
		out.statusID = refs.defaultStatusID
		if out.statusRaw == "" {
			out.statusRaw = refs.statusByID[out.statusID]
		}
	}

	if out.categoryID == 0 {
		out.validationErr = append(out.validationErr, "unable to resolve category")
	}
	if out.statusID == 0 {
		out.validationErr = append(out.validationErr, "unable to resolve status")
	}

	if out.conditionKey != "" {
		if v, exists := refs.conditionByName[out.conditionKey]; exists {
			out.conditionID = &v
		}
	}
	if out.locationKey != "" {
		if v, exists := refs.locationByName[out.locationKey]; exists {
			out.locationID = &v
		} else if v, exists := refs.locationByName[compactLookupKey(out.locationRaw)]; exists {
			out.locationID = &v
		} else {
			out.validationErr = append(out.validationErr, fmt.Sprintf("unknown location '%s'", out.locationRaw))
		}
	}
	if out.vendorKey != "" {
		if v, exists := refs.vendorByName[out.vendorKey]; exists {
			out.vendorID = &v
		}
	}

	return out
}

func parsedForUnit(parsed assetImportParsedRow, unitIndex int) assetImportParsedRow {
	if unitIndex == 0 {
		return parsed
	}

	clone := parsed
	if parsed.quantity > 1 {
		clone.assetTag = ""
		clone.serial = ""
	}
	return clone
}

func normalizeKey(input string) string {
	return strings.ToLower(strings.TrimSpace(input))
}

func buildAssetImportConflictLookup() (map[string][]models.Asset, map[string][]models.Asset, map[string][]models.Asset, error) {
	var assets []models.Asset
	err := database.DB.
		Preload("Category").
		Preload("Status").
		Preload("Location").
		Find(&assets).Error
	if err != nil {
		return nil, nil, nil, err
	}

	byTag := map[string][]models.Asset{}
	bySerial := map[string][]models.Asset{}
	byCombo := map[string][]models.Asset{}

	for _, a := range assets {
		tagKey := normalizeKey(a.AssetTag)
		serialKey := normalizeKey(a.SerialNumber)
		if tagKey != "" {
			byTag[tagKey] = append(byTag[tagKey], a)
		}
		if serialKey != "" {
			bySerial[serialKey] = append(bySerial[serialKey], a)
		}
		if tagKey != "" && serialKey != "" {
			byCombo[tagKey+"||"+serialKey] = append(byCombo[tagKey+"||"+serialKey], a)
		}
	}

	return byTag, bySerial, byCombo, nil
}

func uniqueMatchedAssets(items []models.Asset) []importPreviewAssetMatch {
	seen := map[uint]bool{}
	out := make([]importPreviewAssetMatch, 0, len(items))
	for _, a := range items {
		if seen[a.ID] {
			continue
		}
		seen[a.ID] = true
		out = append(out, importPreviewAssetMatch{
			ID:        a.ID,
			Name:      a.Name,
			AssetTag:  a.AssetTag,
			Serial:    a.SerialNumber,
			Location:  a.Location.Name,
			Category:  a.Category.Name,
			Status:    a.Status.Name,
			IsActive:  a.IsActive,
			CreatedAt: a.CreatedAt.Format(time.RFC3339),
			UpdatedAt: a.UpdatedAt.Format(time.RFC3339),
		})
	}
	return out
}

func classifyPreviewConflict(parsed assetImportParsedRow, byTag map[string][]models.Asset, bySerial map[string][]models.Asset, byCombo map[string][]models.Asset) (string, []importPreviewAssetMatch) {
	if len(parsed.validationErr) > 0 {
		return "invalid", nil
	}

	tagKey := normalizeKey(parsed.assetTag)
	serialKey := normalizeKey(parsed.serial)

	if tagKey != "" && serialKey != "" {
		if exact := byCombo[tagKey+"||"+serialKey]; len(exact) > 0 {
			return "exact_duplicate", uniqueMatchedAssets(exact)
		}
	}

	possible := []models.Asset{}
	if tagKey != "" {
		possible = append(possible, byTag[tagKey]...)
	}
	if serialKey != "" {
		possible = append(possible, bySerial[serialKey]...)
	}
	if len(possible) > 0 {
		return "possible_duplicate", uniqueMatchedAssets(possible)
	}

	return "new", nil
}

func PreviewImportAssets(c *gin.Context) {
	records, options, metadata, err := parseUploadedAssetRecords(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	refs := loadAssetImportReferenceMaps()
	byTag, bySerial, byCombo, lookupErr := buildAssetImportConflictLookup()
	if lookupErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build conflict lookup"})
		return
	}

	colMap := buildColMap(records[0])
	previewRows := make([]importPreviewRow, 0, len(records)-1)
	newCount := 0
	exactDupCount := 0
	possibleDupCount := 0
	invalidCount := 0
	effectiveNewCount := 0
	effectiveExactDupCount := 0
	effectivePossibleDupCount := 0
	effectiveInvalidCount := 0

	for i, row := range records[1:] {
		line := i + 2
		parsed := parseAssetImportRow(line, row, refs, colMap)
		status, matched := classifyPreviewConflict(parsed, byTag, bySerial, byCombo)
		unitCount := parsedUnitCount(parsed, options.QuantityMode)

		switch status {
		case "new":
			newCount++
			effectiveNewCount += unitCount
		case "exact_duplicate":
			exactDupCount++
			effectiveExactDupCount += unitCount
		case "possible_duplicate":
			possibleDupCount++
			effectivePossibleDupCount += unitCount
		default:
			invalidCount++
			effectiveInvalidCount += unitCount
		}
		metadata.EffectiveRowCount += unitCount

		previewRows = append(previewRows, importPreviewRow{
			Line:             line,
			Name:             parsed.name,
			AssetTag:         parsed.assetTag,
			SerialNumber:     parsed.serial,
			Category:         parsed.categoryRaw,
			Type:             parsed.typeRaw,
			Status:           parsed.statusRaw,
			Condition:        parsed.conditionRaw,
			Location:         parsed.locationRaw,
			Vendor:           parsed.vendorRaw,
			Notes:            parsed.notes,
			ConflictStatus:   status,
			ValidationErrors: parsed.validationErr,
			MatchedAssets:    matched,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"options": gin.H{
			"sheet_scope":       options.SheetScope,
			"quantity_mode":     options.QuantityMode,
			"target_sheet_name": options.TargetSheetName,
		},
		"metadata": metadata,
		"summary": gin.H{
			"total_rows":                 len(previewRows),
			"effective_total_rows":       metadata.EffectiveRowCount,
			"new_rows":                   newCount,
			"effective_new_rows":         effectiveNewCount,
			"exact_duplicates":           exactDupCount,
			"effective_exact_duplicates": effectiveExactDupCount,
			"possible_duplicates":        possibleDupCount,
			"effective_possible_duplicates": effectivePossibleDupCount,
			"invalid_rows":               invalidCount,
			"effective_invalid_rows":     effectiveInvalidCount,
		},
		"rows": previewRows,
	})
}

func CommitImportAssets(c *gin.Context) {
	records, options, _, err := parseUploadedAssetRecords(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	decisionsRaw := c.PostForm("decisions")
	if strings.TrimSpace(decisionsRaw) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "decisions field is required"})
		return
	}

	var decisions []importResolveDecision
	if err := json.Unmarshal([]byte(decisionsRaw), &decisions); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid decisions JSON"})
		return
	}

	decisionByLine := map[int]importResolveDecision{}
	for _, d := range decisions {
		if d.Line <= 1 {
			continue
		}
		decisionByLine[d.Line] = d
	}

	refs := loadAssetImportReferenceMaps()
	byTag, bySerial, byCombo, lookupErr := buildAssetImportConflictLookup()
	if lookupErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build conflict lookup"})
		return
	}

	colMap := buildColMap(records[0])
	userID := c.MustGet("userID").(uint)
	created := 0
	updated := 0
	skipped := 0
	failed := 0
	errorsOut := []string{}

	for i, row := range records[1:] {
		line := i + 2
		parsed := parseAssetImportRow(line, row, refs, colMap)
		conflictStatus, _ := classifyPreviewConflict(parsed, byTag, bySerial, byCombo)

		decision, hasDecision := decisionByLine[line]
		action := ""
		if hasDecision {
			action = strings.ToLower(strings.TrimSpace(decision.Action))
		}

		if action == "" {
			switch conflictStatus {
			case "new":
				action = "create_new"
			default:
				action = "skip"
			}
		}

		switch action {
		case "skip":
			skipped++
			continue
		case "create_new":
			if len(parsed.validationErr) > 0 {
				failed++
				errorsOut = append(errorsOut, fmt.Sprintf("line %d: cannot create invalid row: %s", line, strings.Join(parsed.validationErr, "; ")))
				continue
			}
			err := database.DB.Transaction(func(tx *gorm.DB) error {
				for unit := 0; unit < parsedUnitCount(parsed, options.QuantityMode); unit++ {
					if err := createAssetFromParsed(tx, parsedForUnit(parsed, unit), userID); err != nil {
						return err
					}
				}
				return nil
			})
			if err != nil {
				failed++
				errorsOut = append(errorsOut, fmt.Sprintf("line %d: %s", line, err.Error()))
				continue
			}
			created += parsedUnitCount(parsed, options.QuantityMode)
		case "merge_existing":
			if len(parsed.validationErr) > 0 {
				failed++
				errorsOut = append(errorsOut, fmt.Sprintf("line %d: cannot merge invalid row: %s", line, strings.Join(parsed.validationErr, "; ")))
				continue
			}
			if decision.TargetAssetID == nil || *decision.TargetAssetID == 0 {
				failed++
				errorsOut = append(errorsOut, fmt.Sprintf("line %d: merge_existing requires target_asset_id", line))
				continue
			}
			err := database.DB.Transaction(func(tx *gorm.DB) error {
				return applyMergeToExistingAsset(tx, parsed, *decision.TargetAssetID, userID)
			})
			if err != nil {
				failed++
				errorsOut = append(errorsOut, fmt.Sprintf("line %d: %s", line, err.Error()))
				continue
			}
			updated++
		default:
			failed++
			errorsOut = append(errorsOut, fmt.Sprintf("line %d: unsupported action '%s'", line, action))
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"options": gin.H{
			"sheet_scope":       options.SheetScope,
			"quantity_mode":     options.QuantityMode,
			"target_sheet_name": options.TargetSheetName,
		},
		"created": created,
		"updated": updated,
		"skipped": skipped,
		"failed":  failed,
		"errors":  errorsOut,
	})
}

func DownloadAssetImportTemplate(c *gin.Context) {
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", `attachment; filename="itam_asset_import_template.csv"`)

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	_ = writer.Write([]string{
		"name", "asset_tag", "serial_number", "category", "type", "status", "condition", "location", "vendor", "notes",
		// Accepted column name aliases (any of these will also work):
		// name       → item, description, asset name
		// asset_tag  → tag, no, no.
		// serial_number → serial, sn, s/n
		// location   → loc, site, branch
		// vendor     → supplier, manufacturer
	})
	_ = writer.Write([]string{
		"Dell Latitude 5540", "", "SN-5540-001", "Laptop", "Business Laptop", "In Use", "Good", "HQ Floor 2", "Dell", "Assigned for onboarding",
	})
}

func ExportAssetsCSV(c *gin.Context) {
	locationID := strings.TrimSpace(c.Query("location_id"))
	format := strings.ToLower(strings.TrimSpace(c.DefaultQuery("format", "csv")))

	query := database.DB.
		Preload("Category").Preload("Type").Preload("Status").
		Preload("Condition").Preload("Location").Preload("Vendor").
		Where("is_active = ?", true)

	fileBaseName := "itam_assets_export"
	if locationID != "" {
		query = query.Where("location_id = ?", locationID)
		var location models.Location
		if err := database.DB.First(&location, locationID).Error; err == nil {
			name := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(location.Name), " ", "_"))
			if name != "" {
				fileBaseName = fmt.Sprintf("itam_assets_%s", name)
			}
		}
	}

	var assets []models.Asset
	if err := query.
		Order("created_at DESC").
		Find(&assets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to export assets"})
		return
	}

	headers := []string{"id", "asset_tag", "name", "serial_number", "category", "type", "status", "condition", "location", "vendor", "assigned_user_id", "notes"}
	rows := make([][]string, 0, len(assets))
	for _, a := range assets {
		assigned := ""
		if a.AssignedUserID != nil {
			assigned = strconv.Itoa(int(*a.AssignedUserID))
		}
		rows = append(rows, []string{
			strconv.Itoa(int(a.ID)),
			a.AssetTag,
			a.Name,
			a.SerialNumber,
			a.Category.Name,
			a.Type.Name,
			a.Status.Name,
			a.Condition.Name,
			a.Location.Name,
			a.Vendor.Name,
			assigned,
			a.Notes,
		})
	}

	switch format {
	case "xlsx":
		xf := excelize.NewFile()
		sheet := xf.GetSheetName(0)
		for i, h := range headers {
			cell, _ := excelize.CoordinatesToCellName(i+1, 1)
			_ = xf.SetCellValue(sheet, cell, h)
		}
		for r, row := range rows {
			for cidx, val := range row {
				cell, _ := excelize.CoordinatesToCellName(cidx+1, r+2)
				_ = xf.SetCellValue(sheet, cell, val)
			}
		}

		buf, err := xf.WriteToBuffer()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate XLSX export"})
			return
		}

		c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.xlsx\"", fileBaseName))
		c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf.Bytes())
		return
	case "pdf":
		pdf := gofpdf.New("L", "mm", "A4", "")
		pdf.AddPage()
		pdf.SetFont("Arial", "B", 14)
		pdf.CellFormat(0, 10, "ITAM Inventory Export", "", 1, "L", false, 0, "")
		pdf.SetFont("Arial", "", 10)
		pdf.CellFormat(0, 8, fmt.Sprintf("Generated: %s", time.Now().Format("2006-01-02 15:04")), "", 1, "L", false, 0, "")
		pdf.CellFormat(0, 8, fmt.Sprintf("Rows: %d", len(rows)), "", 1, "L", false, 0, "")
		pdf.Ln(2)

		colWidths := []float64{12, 30, 44, 30, 24, 28, 24, 22, 24, 24, 18, 58}
		pdf.SetFont("Arial", "B", 8)
		for i, h := range headers {
			pdf.CellFormat(colWidths[i], 7, h, "1", 0, "L", false, 0, "")
		}
		pdf.Ln(-1)

		pdf.SetFont("Arial", "", 8)
		for _, row := range rows {
			for i, val := range row {
				pdf.CellFormat(colWidths[i], 6, val, "1", 0, "L", false, 0, "")
			}
			pdf.Ln(-1)
		}

		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PDF export"})
			return
		}

		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.pdf\"", fileBaseName))
		c.Data(http.StatusOK, "application/pdf", buf.Bytes())
		return
	default:
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.csv\"", fileBaseName))

		writer := csv.NewWriter(c.Writer)
		defer writer.Flush()

		_ = writer.Write(headers)
		for _, row := range rows {
			_ = writer.Write(row)
		}
	}
}

func ImportAssetsCSV(c *gin.Context) {
	records, options, _, err := parseUploadedAssetRecords(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	colMap := buildColMap(records[0])
	userID := c.MustGet("userID").(uint)
	refs := loadAssetImportReferenceMaps()

	created := 0
	failed := 0
	errorsOut := []string{}

	for i, row := range records[1:] {
		line := i + 2
		parsed := parseAssetImportRow(line, row, refs, colMap)
		if len(parsed.validationErr) > 0 {
			failed++
			errorsOut = append(errorsOut, fmt.Sprintf("line %d: %s", line, strings.Join(parsed.validationErr, "; ")))
			continue
		}

		err := database.DB.Transaction(func(tx *gorm.DB) error {
			for unit := 0; unit < parsedUnitCount(parsed, options.QuantityMode); unit++ {
				if err := createAssetFromParsed(tx, parsedForUnit(parsed, unit), userID); err != nil {
					return err
				}
			}
			return nil
		})

		if err != nil {
			failed++
			errorsOut = append(errorsOut, fmt.Sprintf("line %d: %s", line, err.Error()))
			continue
		}
		created += parsedUnitCount(parsed, options.QuantityMode)
	}

	c.JSON(http.StatusOK, gin.H{
		"options": gin.H{
			"sheet_scope":       options.SheetScope,
			"quantity_mode":     options.QuantityMode,
			"target_sheet_name": options.TargetSheetName,
		},
		"created": created,
		"failed":  failed,
		"errors":  errorsOut,
	})
}
