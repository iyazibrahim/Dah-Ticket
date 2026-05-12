# Workflow State

## Request
Build a complete internal company IT support/helpdesk ticketing system called "DahTicket V2" using the Go (Gin/Fiber), React (Vite/Tailwind CSS), and PostgreSQL stack with Docker.

## Clarified Scope
### System Type
Internal company IT helpdesk system for employee technical issues. Mobile and desktop responsive design.

### User Roles & Permissions
1. **Employees**: Submit tickets, view/update own tickets, access knowledge base/FAQ
2. **IT Agents**: Manage assigned tickets, update statuses/priorities, add comments, track SLAs
3. **Admins**: Manage users/roles, configure system, view analytics, manage knowledge base
4. **RBAC**: Full role-based access control required

### Authentication
- Local user management (email/password)
- Microsoft Azure AD SSO integration (Planned)
- JWT-based authentication with role enforcement

### Core Features (Must-Have)
- Ticket lifecycle: Creation → Assignment → Status workflow (Open → In Progress → On Hold → Resolved → Closed)
- Priority levels: Low → Medium → High → Critical
- Ticket comments (public for employees, internal for agents)
- File attachments for tickets (local storage)
- Email notifications for ticket updates (SMTP / Microsoft Outlook)
- SLA tracking for resolution times
- Role-specific dashboards
- **Audit logging** for all ticket/user mutations (prevents accountability disputes)

### Technology Stack
- **Frontend**: React (Vite), Tailwind CSS, Lucide React icons. Modern, functional, non-AI slop design.
- **Backend**: Go with Gin framework.
- **Database**: PostgreSQL (using GORM).
- **Containerization**: Full Docker Compose setup (Backend, Frontend, Postgres, pgAdmin).

## Current Status
- ✅ Project Scaffolding Completed
- ✅ Go Backend initialized with Gin
- ✅ React Frontend initialized with Vite and Tailwind CSS
- ✅ Docker Compose orchestration completed
- ✅ Database schema (Users, Tickets, Comments, AuditLog, Attachments) defined using GORM
- ✅ Database auto-migration configured on backend startup
- ✅ **Step 1: Authentication — COMPLETE**
  - Backend: JWT token generation (`golang-jwt/jwt/v5`) with configurable expiration
  - Backend: bcrypt password hashing for secure credential storage
  - Backend: Auth middleware (`middleware/auth.go`) — JWT validation + user-is-active check
  - Backend: Role guard middleware (`RoleRequired()`) for admin/agent-only routes
  - Backend: Login, Register, GetMe API endpoints (`handlers/auth.go`)
  - Backend: AuditLog model (`models/audit_log.go`) — tracks action, entity, old/new values, IP, user-agent
  - Backend: Audit logging on login/register events
  - Backend: Default admin seed on first run (`admin@dahticket.com` / `admin123`)
  - Backend: CORS middleware configured for frontend origins
  - Backend: App config from env vars (`config/config.go`)
  - Frontend: AuthContext (`contexts/AuthContext.tsx`) — login/register/logout + token validation on mount
  - Frontend: Login page — split-screen branding, password toggle, error handling, responsive
  - Frontend: Register page — password strength indicators, confirm password, responsive
  - Frontend: ProtectedRoute wrapper with loading spinner
  - Frontend: DashboardLayout — responsive sidebar, role-based nav, profile dropdown, sign out
  - Frontend: API service (`services/api.ts`) — Axios with JWT interceptor + 401 auto-redirect
  - Frontend: TypeScript types for all entities (`types/index.ts`)
- ✅ **Step 2: Ticket Management Core API — COMPLETE**
  - Backend: Full CRUD for Tickets (Create, List, Get, Update, Delete) — `handlers/ticket.go`
  - Backend: Pagination, filtering (status, priority, assignee, search), sorting
  - Backend: Role-based access (employees see own tickets only)
  - Backend: Permission checks (employees can only edit own open tickets)
  - Backend: Ticket stats endpoint for dashboard (`GET /api/tickets/stats`)
  - Backend: Audit logging on every ticket mutation (create/update/delete/status change/assign)
  - Backend: Old/new value snapshots in audit logs
  - Backend: Shared audit helpers (`handlers/audit.go` — `LogAudit()`, `ToJSON()`)
- ✅ **Step 3: Role-Specific Dashboards (Frontend) — COMPLETE**
  - Frontend: Dashboard fetches real stats from /tickets/stats API
  - Frontend: Recent tickets from real API data
  - Frontend: Stat cards (Open, In Progress, Resolved, Unassigned)
- ✅ **Step 4: Ticket Details & Commenting — COMPLETE**
  - Backend: Comment CRUD (Add, Update, Delete) with role-based access — `handlers/comment.go`
  - Backend: Internal comments for IT staff only
  - Backend: Audit logging on all comment mutations
  - Frontend: Ticket list page with search, filters, pagination (desktop + mobile)
  - Frontend: Create ticket form page
  - Frontend: Ticket detail page with comment thread
  - Frontend: Status/priority controls for IT staff (sidebar)
  - Frontend: Internal note toggle for agents/admins
- ✅ **Step 5: User & Role Management (Admin Panel) — COMPLETE**
  - Backend: Admin user CRUD endpoints — `handlers/admin.go`
    - `GET /api/admin/users` — list with pagination, role filter, search
    - `GET /api/admin/users/:id` — get single user
    - `POST /api/admin/users` — create user with role assignment
    - `PUT /api/admin/users/:id` — update profile/role/active/password reset
  - Backend: `GET /api/agents` — list active agents/admins for ticket assignment dropdowns
  - Backend: Self-protection (admin cannot deactivate own account)
  - Backend: Audit logging on all admin user mutations
  - Frontend: Admin Users page (`pages/admin/UsersPage.tsx`)
    - User table with avatar, name, email, role, status columns
    - Inline role change dropdown
    - Activate/deactivate toggle
    - Search by name/email
    - Role filter dropdown
    - Create User modal (first name, last name, email, password, role)
    - Success/error toast feedback
  - Frontend: Nav link updated to `/admin/users` (admin-only)
- ✅ **Step 6: File Attachments — COMPLETE**
  - Backend: Attachment model (`models/attachment.go`) — file metadata, uploader, ticket/comment link
  - Backend: Attachment CRUD handlers — `handlers/attachment.go`
    - `POST /api/tickets/:id/attachments` — upload (multipart, 10MB limit)
    - `GET /api/tickets/:id/attachments` — list attachments for ticket
    - `GET /api/tickets/:id/attachments/:attachmentId/download` — download with path traversal protection
    - `DELETE /api/tickets/:id/attachments/:attachmentId` — delete (uploader or admin)
  - Backend: MIME type whitelist (images, PDF, Office docs, text, archives)
  - Backend: Local storage at `./uploads/tickets/{id}/` with unique filenames
  - Backend: Audit logging on upload/delete
  - Backend: Docker volume `backend_uploads` for persistent file storage
  - Frontend: Attachment type added to `types/index.ts`
  - Frontend: `attachmentAPI` added to `services/api.ts` (upload/list/delete/downloadUrl)
- ✅ **Step 7: Email Notifications — COMPLETE**
  - Backend: Email service (`services/email.go`)
    - SMTP integration with configurable env vars (`SMTP_HOST`, `SMTP_PORT`, etc.)
    - Pre-built for Microsoft Outlook (`smtp.office365.com:587`)
    - Async sending (non-blocking, goroutine-based)
    - Graceful skip if SMTP not configured (logs "[EMAIL SKIPPED]")
  - Backend: Branded HTML email templates
    - `NotifyTicketCreated()` — confirmation to requester
    - `NotifyTicketAssigned()` — notification to assignee
    - `NotifyTicketStatusChanged()` — status update to requester
    - `NotifyNewComment()` — new public comment notification to requester
  - Backend: Integrated into ticket and comment handlers
  - Docker: SMTP env vars added to `docker-compose.yml` (commented, ready to fill)
- ✅ **Step 8: SLA Tracking & Due Dates — COMPLETE**
  - Backend: SLA config in `config/config.go` with per-priority targets
    - Low: 72h, Medium: 24h, High: 8h, Critical: 4h (configurable via env vars)
    - `GetSLADueDate()` helper calculates due date from creation time + priority hours
  - Backend: Auto-sets `due_date` on ticket creation based on priority SLA
  - Backend: Recalculates `due_date` when priority changes in UpdateTicket
  - Backend: Overdue detection in analytics (`due_date < now AND not resolved/closed`)
- ✅ **Step 9: Knowledge Base / FAQ — COMPLETE**
  - Backend: KBArticle model (`models/kb_article.go`) — title, content, category, tags, published status, view count
  - Backend: KB CRUD handlers (`handlers/kb.go`)
    - `GET /api/kb` — list (published-only for employees, searchable, by category, paginated)
    - `GET /api/kb/categories` — unique categories list
    - `GET /api/kb/:id` — get article + increment view count
    - `POST /api/kb` — create article (staff only, drafts by default)
    - `PUT /api/kb/:id` — update article (staff only)
    - `DELETE /api/kb/:id` — delete article (staff only)
  - Backend: Staff-only middleware group for KB write operations
  - Backend: Audit logging on all KB mutations
  - Frontend: `pages/knowledge/KnowledgeBasePage.tsx`
    - Article card grid with category badges, view counts, tags
    - Search by title/content/tags
    - Category filter dropdown (populated from API)
    - Article detail modal with full content
    - Create article modal for staff (title, category, content, tags)
    - Draft badge for unpublished articles (staff view)
    - Pagination
  - Frontend: `/knowledge` route wired in App.tsx
- ✅ **Step 10: Admin Analytics Dashboard — COMPLETE**
  - Backend: Analytics handlers (`handlers/analytics.go`)
    - `GET /api/admin/analytics/overview` — total tickets, open, resolved today, overdue, total users, active agents, avg resolution hours
    - `GET /api/admin/analytics/status` — ticket count by status
    - `GET /api/admin/analytics/priority` — ticket count by priority
    - `GET /api/admin/analytics/agents` — per-agent workload (open/resolved/total)
    - `GET /api/admin/analytics/trend` — 30-day daily ticket creation with zero-fill
    - `GET /api/admin/analytics/sla` — SLA compliance: on-time, breached, currently overdue, compliance rate %
  - Frontend: `pages/admin/AnalyticsPage.tsx`
    - 7 overview stat cards (total, open, resolved today, overdue, users, agents, avg resolve time)
    - Status breakdown with percentage bar charts
    - Priority breakdown with percentage bar charts
    - SLA compliance ring gauge (SVG donut) with color coding
    - 30-day CSS bar chart for ticket creation trend with hover tooltips
    - Agent workload visualization with stacked progress bars
  - Frontend: `/admin/analytics` route + sidebar nav (admin-only)
- ✅ **Step 11: ITIL Compliance & UX Polish — COMPLETE**
  - Backend: `GET /api/tickets/:id/audit` endpoint for full ITIL-compliant audit trail.
  - Backend: Handlers added to trigger in-app notifications on ticket assignment, status changes, and new comments.
  - Backend: `PUT /api/auth/me` endpoint for user profile and password updates.
  - Frontend: Interactive bell notification UI in header with 60s auto-polling, unread counts, and "mark all read".
  - Frontend: Ticket details sidebar updated with "History" tab rendering audit logs, agent assignment dropdown, and toggle switch for internal notes.
  - Frontend: Added `ProfilePage.tsx` to handle user self-service updates.
  - Frontend: Knowledge base enhanced with `react-quill` for rich text and image support.
  - Frontend: Tailwind UI colors polished by forcing `darkMode: 'class'` to resolve "greyed out" components.
- ✅ **Step 11.5: Final ITIL Enhancements — COMPLETE**
  - Backend: Added `Type` (Incident, Service Request, Problem, Change) to `Ticket` model.
  - Backend: Added `Category` (Hardware, Software, Network, Access, Other) to `Ticket` model.
  - Backend: Updated Create and Update ticket handlers to support these new fields.
  - Frontend: "Create Ticket" form now includes Type and Category dropdowns.
  - Frontend: Ticket Detail Page updated to display Type and Category badges.
  - Frontend: Staff members can edit Type and Category from the ticket sidebar.
  - Frontend: Added "Assign to Me" quick-action button for unassigned tickets.
  - Frontend: Fixed permissions bug allowing Admin requesters to accept/close their own resolved tickets.

- ✅ **Step 12: ITAM Module Core & Integration — COMPLETE**
  - Backend: ITAM Data Models (`Asset`, `AssetCategory`, `AssetType`, `AssetStatus`, `AssetCondition`, `Location`, `Vendor`).
  - Backend: REST APIs for Asset CRUD with pagination, advanced filtering, and search.
  - Backend: REST APIs for Reference Data (Categories, Types, Statuses, Conditions, Locations, Vendors).
  - Backend: `AssetTicketLink` model and many-to-many relationship logic.
  - Backend: Endpoints to link/unlink assets to tickets and retrieve linked assets for a ticket.
  - Frontend: ITAM Dashboard (`ITAMDashboard.tsx`) with inventory stats and warranty monitoring.
  - Frontend: Asset Management UI — List page with search/filter, Detail page with specs/tickets, and Create/Edit Form.
  - Frontend: Ticket Detail integration — "Affected Assets" sidebar panel to search/link/unlink assets (Staff only).
  - Frontend: Sidebar navigation and routing in `App.tsx`.

## Current Status (ITAM)
- ✅ Backend: Core ITAM Models & CRUD — COMPLETE
- ✅ Backend: Asset-Ticket Linking — COMPLETE
- ✅ Frontend: Asset Dashboard & Inventory Management — COMPLETE
- ✅ Frontend: Ticket Integration (Affected Assets Sidebar) — COMPLETE
- ✅ Frontend: ITAM Reference Data Management (Admin Settings) — COMPLETE
- ✅ Frontend: "My Assets" view in Employee Profile — COMPLETE

## Latest Update (May 8, 2026)
- Added frontend ITAM admin settings screen at `/admin/itam/settings` for full reference-data CRUD:
  - Categories, Types, Statuses, Conditions, Locations, Vendors.
  - Includes create/edit/delete flows and active/inactive toggles.
- Added missing frontend ITAM API methods for complete reference-data management.
- Added authenticated backend endpoint `GET /api/itam/my-assets` for user-assigned assets.
- Added "My Assets" section in profile page using the new endpoint.
- Added sidebar navigation entry for admin ITAM settings.
- Added backend validation for ITAM reference records:
  - Name trimming and required-name validation across categories, types, statuses, conditions, locations, and vendors.
  - Category existence validation for asset types.
  - Friendly duplicate-name responses with HTTP 409 conflict messages.
- Added search and pagination controls inside ITAM settings tables:
  - Client-side search by name/details.
  - Page-size selector and Prev/Next paging controls.
  - Empty-state messaging for no matches.

## Latest Update (May 9, 2026)
- Expanded ITAM backend with secure QR scanning flow:
  - Added signed QR token generation endpoint per asset.
  - Added secure token resolve endpoint used by in-app scanner.
  - Tokens are validated server-side before redirecting to asset details.
- Added ITAM admin settings model and APIs for asset tag policy:
  - Prefix configuration (example `DPA`).
  - Default auto-generate toggle.
  - Sequence-backed tag allocation for generated tags.
- Added ITAM default seed data initialization:
  - Auto-creates ITAM settings if missing.
  - Prepopulates baseline categories, statuses, conditions, and types.
- Added ITAM bulk operations:
  - CSV import template download endpoint.
  - Asset CSV export endpoint.
  - CSV bulk import endpoint with per-row validation/error reporting.
- Updated asset creation flow to support both auto-generated and manual asset tags.
- Added frontend ITAM scanner page at `/itam/scanner` with camera scan + manual token fallback.
- Added QR rendering on asset detail pages using secure backend token issuance.
- Updated ITAM settings UI to include asset-tag policy controls (prefix + auto-generate default).
- Enhanced asset list UI with bulk import/export/template actions and quick scanner access.
- Refined ITAM visual system to use theme tokens + blue accents instead of hardcoded violet/slate styling.
- Sidebar refinement:
  - ITAM Settings moved to the last admin navigation item.
  - User footer/profile area reduced for cleaner density.

## Latest Update (May 12, 2026 - ITAM Import Preview Foundation)
- Started multi-location ITAM enhancement implementation with import safety workflow.
- Backend ITAM bulk handler upgraded:
  - Added `POST /api/admin/itam/assets/import/preview` endpoint.
  - Added row-level preview classification: `new`, `exact_duplicate`, `possible_duplicate`, `invalid`.
  - Added matched-asset metadata in preview response for operator review.
  - Unified uploaded dataset parsing for both `.csv` and `.xlsx` in bulk workflows.
  - Refactored import validation logic into shared parsing helpers used by preview/import paths.
- Frontend ITAM asset list import flow upgraded:
  - Upload now runs preview first.
  - If no conflicts/invalid rows, import continues automatically.
  - If conflicts exist, modal shows summary and conflict details before any commit.
- Added frontend typing + API client contracts for preview payloads/responses.
- Validation status:
  - Backend `go build ./...` passes.
  - Frontend build passes; repository has pre-existing lint issues outside changed files.

## Latest Update (May 12, 2026 - ITAM Import Resolution Commit)
- Added backend resolved-commit endpoint for previewed uploads:
  - `POST /api/admin/itam/assets/import/commit`
  - Accepts uploaded file + per-row decisions payload.
  - Supported actions: `create_new`, `merge_existing`, `skip`.
- Added backend merge behavior to update selected existing asset from import row mapping.
- Added backend shared helper functions for creating assets from parsed rows (reused by legacy import path).
- Updated frontend ITAM import modal:
  - Per-row action selector for conflict rows.
  - Optional target asset selector when action is `merge_existing`.
  - Replaced legacy blind-continue with `Commit Resolved Import` action.
  - Added post-import summary banner for created/updated/skipped/failed counts.
- Frontend import file picker now supports both `.csv` and `.xlsx`.

## Latest Update (May 12, 2026 - Location-Aware Export + Validation)
- Added location-aware CSV export support in backend endpoint `GET /api/admin/itam/assets/export`:
  - Accepts optional query parameter `location_id`.
  - Returns filtered asset export when location filter is provided.
  - Generates contextual filename for location-specific export where location is resolvable.
- Updated frontend ITAM API client to pass export query params.
- Updated Asset Inventory UI:
  - Added `Location` filter dropdown in filter panel.
  - Asset list requests now include `location_id` filter.
  - Export button now exports selected location when `location_id` is active.
  - Added `Export All Locations` action when scoped export is active.
- End-to-end validation performed using Playwright against running Docker services:
  - Verified login as admin and navigation to ITAM inventory.
  - Verified import preview modal appears for CSV upload with invalid row classification.
  - Verified per-row action controls and commit flow for resolved import.
  - Verified commit summary banner renders counts (created/updated/skipped/failed).
  - Verified export endpoint returns success for both full export and location-scoped export requests.

## Latest Update (May 12, 2026 - Location Prefix Tags + MY Localization)
- Asset tag auto-generation now uses location-based prefix when location is selected:
  - Example: selecting `PDL` generates tags like `PDL-001`.
  - Fallback to ITAM default prefix remains when location is not set.
- ITAM settings prefix sanitization improved:
  - Prefix now accepts letters/numbers and strips invalid characters.
- ITAM default seeding expanded with location records:
  - `PDL`, `PDL1`, `PDL2`, `BDL`, `BMOL`, `OFFICE`.
- ITAM dashboard quick actions updated:
  - Removed `Manage Locations` action from dashboard shortcuts.
- Asset form text cleanup completed:
  - Fixed malformed placeholder strings (status/category/type/condition/location/vendor/description/notes).
- Malaysian localization applied for purchase cost:
  - Form label updated to `Purchase Cost (RM)`.
  - Asset detail now formats cost as MYR (example: `RM 1,234.56`).
- Playwright validation completed against dockerized app:
  - Verified seeded locations appear in New Asset location dropdown.
  - Verified creation of an asset with location `PDL` produces `PDL-001` tag.
  - Verified purchase cost renders in RM on asset detail page.
  - Verified `Manage Locations` is no longer present in ITAM dashboard quick actions.

## Latest Update (May 12, 2026 - ITAM Sequences + Multi-Format Export + PM APIs)
- Completed per-location asset-tag sequence isolation:
  - Added `ITAMTagSequence` model for per-prefix counters.
  - Auto-generated tags now increment independently by prefix (location code), not by a global shared counter.
  - Asset creation path now uses location-prefix sequence lookup with fallback to configured default prefix.
- Completed multi-format ITAM export in one endpoint:
  - `GET /api/admin/itam/assets/export` now supports `format=csv|xlsx|pdf`.
  - Supports both full inventory export and location-scoped export via `location_id`.
  - Added frontend format selector and dynamic export button labeling (`Export CSV`, `Export XLSX`, `Export PDF`).
- Added Preventive Maintenance backend module:
  - New PM models: `PMReport`, `PMFailureLog`, `PMCalibrationRecord`, `PMChecklistItem`.
  - New PM routes:
    - `GET /api/itam/pm/reports`
    - `POST /api/itam/pm/reports`
    - `GET /api/itam/pm/reports/:id`
    - `PUT /api/itam/pm/reports/:id`
    - `GET /api/itam/pm/summary`
    - `POST /api/itam/pm/reports/:id/trigger-ticket`
  - Added frontend API contracts/types for PM endpoints.
- Validation completed after implementation:
  - Backend: `go mod tidy` and `go build ./...` pass.
  - Frontend: `npm run build` pass.
  - Docker stack rebuilt and running (`backend`, `frontend`, `db`, `pgadmin`).
  - Runtime verification:
    - Confirmed independent sequence behavior (`BDL-002` creation did not advance `PDL`, next PDL became `PDL-002`).
    - Confirmed export success for CSV/XLSX/PDF with and without `location_id`, including expected MIME types and non-empty payloads.
    - Confirmed PM flow end-to-end: create report, list/filter, get detail, update nested checklist, summary metrics, and trigger linked ticket.

## Latest Update (May 12, 2026 - PM UI Page + ITAM Dashboard Refresh)
- Added a new frontend PM Reports page at `/itam/pm` for staff/admin:
  - Monthly/location filtering.
  - PM summary cards (total reports, failures, MTTR, MTBF).
  - PM report creation form (location, month, downtime, utilization, summary).
  - PM history table with ticket-trigger action and linked ticket badge.
- Added PM route wiring and sidebar navigation entry:
  - Route: `GET /itam/pm` frontend page.
  - Sidebar item: `PM Reports` (admin + IT agent).
- ITAM dashboard refreshed to include PM visibility:
  - New overview stat card: `PM Reports (This Month)`.
  - Quick Actions updated by replacing `Warranty Alerts` shortcut with `PM Reports` shortcut.
- Validation:
  - Frontend production build passes after PM UI/dashboard updates.

## Latest Update (May 12, 2026 - Settings Tabs + Editable SLA + CRUD Validation)
- Reworked ITAM settings UX into clean tabbed sections:
  - `Configuration` tab for SLA + asset tag policy.
  - `Reference Data` tab for categories/types/statuses/conditions/locations/vendors.
- Removed modal-based reference editor flow and replaced with inline form panel in `Reference Data` tab.
- SLA configuration moved from env-only control to admin-editable persisted settings:
  - Added persisted fields to ITAM settings model: `sla_low_hours`, `sla_medium_hours`, `sla_high_hours`, `sla_critical_hours`.
  - Settings API (`GET/PUT /api/admin/itam/settings`) now reads/writes SLA values.
  - Runtime SLA targets are updated immediately on settings save.
  - Startup sync added to load SLA values from DB into runtime config after seeding.
- Validation completed:
  - Backend build passes (`go build ./...`).
  - Frontend build passes (`npm run build`).
  - Playwright validation run for settings workflows:
    - SLA save API flow passed (update + revert 200).
    - CRUD API checks for all reference datasets passed (create/update/delete all 200/201).
    - UI form checks passed for all reference tabs (field presence verified for each form).

## Latest Update (May 12, 2026 - PM Finding Pool + Single Report Builder)
- Started PM redesign from report-first to finding-first workflow.
- Backend PM model extended:
  - Added `PMFinding` entity for independently persisted findings.
  - Added `PMReportFinding` mapping to support one report containing multiple selected findings.
  - Added `Findings` relation on `PMReport`.
- Backend PM APIs enhanced:
  - Added finding endpoints:
    - `GET /api/itam/pm/findings`
    - `POST /api/itam/pm/findings`
    - `PUT /api/itam/pm/findings/:id`
  - Added bundled report assembly endpoint:
    - `POST /api/itam/pm/reports/build` (build one report from selected finding IDs)
  - Added PM report PDF export endpoint:
    - `GET /api/itam/pm/reports/:id/export/pdf`
  - PM report list/detail now preload linked findings.
  - PM summary now includes `total_findings` and computes MTTR/MTBF from finding timeline.
- Frontend PM page redesigned into a single-page field workflow (`/itam/pm`):
  - Capture Finding section (including broken asset marker, severity, threshold, recommendation).
  - Finding Pool section (current + saved findings) with multi-select.
  - Report Builder section to generate one report from multiple findings.
  - Generate Output section with PDF download and ticket trigger actions.
  - Added in-page MTTR/MTBF definitions.
- Frontend typings/API client updated for PM findings, report builder payload, and PDF export.
- Validation completed for this implementation slice:
  - Backend build pass (`go build ./...`).
  - Frontend build pass (`npm run build`).
  - Docker rebuilt for backend/frontend.
  - Runtime API validation (via Playwright context):
    - finding create: `201`
    - report build from selected finding IDs: `201`
    - linked findings persisted on report: verified (`linkedFindings: 1`)
    - PDF export: `200`, `application/pdf`, non-empty payload.

## Latest Update (May 8, 2026 - UX + Personalization)
- Ticket creation enhancements:
  - Users can now upload multiple issue images during ticket creation.
  - Clipboard image paste in the description area is captured and added to ticket attachments.
  - Images are automatically uploaded to the ticket right after successful creation.
- Ticket list quick actions for IT staff/admin:
  - Added quick "Mine" assignment action.
  - Added quick "Accept" action (moves open/on-hold tickets to in-progress).
  - Admins can quickly assign tickets to any agent/admin from the list row.
- Personalized dashboard improvements:
  - Admin/agent dashboard now includes personal monthly performance widgets and mini trend bars.
  - Employee dashboard includes current ticket summary and current assigned assets preview.
  - Overall analytics remains available via dedicated analytics page.
- ITAM dashboard and settings UX:
  - Added prominent "Scan Asset QR" button in ITAM header for easier mobile access.
  - Introduced cleaner settings presentation with consolidated `/admin/settings` route.
  - Asset Tag Rules moved into a collapsible section to reduce visual clutter.
  - Added SLA explanation panel in settings (calculation logic + env var keys used for configuration).
- Seeding updates:
  - Added default IT agent account seed (`agent@dahticket.com` / `agent123`).
  - Added default employee account seed (`user@dahticket.com` / `user123`).
- Deployment reliability fix:
  - Added nginx SPA history fallback so direct deep links (e.g., `/tickets/6`, `/itam/scanner`) no longer return 404 in Docker deployment.

## Latest Update (May 8, 2026 - Ticket UX Follow-up)
- Dashboard monthly performance refined:
  - Replaced weekly mini report with month-only personal metrics.
  - Added donut visualization for resolved vs accepted/submitted tickets in the active calendar month.
  - Monthly values are served by backend endpoint `GET /api/tickets/personal-stats` and auto-reset on month boundary.
- Ticket list quick actions simplified:
  - Removed `Mine` action as requested.
  - Kept only `Accept` and `Assign...` actions for staff.
- Ticket attachment visibility fixed:
  - Ticket detail now renders an "Issue Images & Files" section.
  - Uploaded image attachments are previewed inline with authenticated blob loading.
  - Non-image files are shown with download actions.

## Latest Update (May 12, 2026 - PM Findings Edit/Delete + PDF Redesign + Org Branding)
- PM findings workflow improvements:
  - Added staff-side PM finding deletion endpoint: `DELETE /api/itam/pm/findings/:id`.
  - Added frontend finding row actions for edit and delete.
  - Added modal edit mode with pre-filled values and update action.
  - Added delete confirmation flow and loading/disabled state handling.
- PM finding type quality improvements:
  - Replaced free-text finding type input with curated dropdown options.
  - Fixed tile quick-add behavior to prefill only device label, not finding type.
  - Added human-readable finding type badges and fallback label handling.
  - Improved missing device label rendering with explicit `(No label)` display.
- Audit logging coverage:
  - Added audit entry on PM finding update with old/new snapshots.
  - Added audit entry on PM finding delete with old snapshot.
- PM PDF export redesign:
  - Reworked PDF output to block-per-finding layout with automatic word wrapping.
  - Added structured sections: report header, summary, optional metrics, findings, glossary.
  - Added cleaner spacing, separators, and readability-focused formatting.
  - Added finding type label mapping for report clarity.
- ITAM settings organization branding:
  - Extended ITAM settings model with `organization_name` and `logo_base64`.
  - Added update/get support for new branding fields.
  - Added Organization and Branding controls in ITAM settings UI (name + logo upload/preview/remove).
  - PDF export now reads settings and renders organization branding data in the report header.
- Validation and deployment:
  - Fixed JSX closure regression in ITAM settings page after branding UI insertion.
  - Frontend production build passed.
  - Docker compose build and container restart completed for backend/frontend services.

## Latest Update (May 12, 2026 - ITAM Import Scope Controls + Pagination + Tag Normalization)
- Import counting and workbook scope improvements:
  - Added import options for workbook scope and quantity handling across preview, commit, and direct import endpoints.
  - New default behavior is `masterlist_only` sheet scope with target sheet name `masterlist`.
  - Added optional `all_sheets` scope for workbooks that intentionally span multiple import sheets.
  - Added quantity mode options:
    - `single_asset_per_row` (default, prevents quantity-based row inflation)
    - `expand_quantity` (preserves prior multi-unit expansion behavior when explicitly requested)
  - Preview responses now include import options, metadata, per-sheet summaries, raw row counts, and effective asset counts.
  - Import now fails fast in masterlist-only mode when the requested sheet cannot be found instead of silently reading all sheets.
- Asset list UX improvements:
  - Replaced next/prev-only pagination with numbered paging plus first/last controls.
  - Added page-size selector (`15`, `25`, `50`, `100`) persisted in query params.
  - Added mobile-friendly asset card layout while preserving desktop table view on medium+ screens.
  - Added import defaults UI on the asset inventory page so operators can choose workbook scope and quantity behavior before upload.
  - Import preview modal now shows effective asset totals and per-sheet usage summaries.
- Asset tag consistency improvements:
  - Added shared backend normalization for manual/imported numeric-only tags so values like `183` become location-prefixed tags such as `BMDL-183`.
  - Applied normalization in asset create, asset update, bulk import create, and merge flows.
  - Added frontend ITAM display fallback for legacy numeric-only tags in list/detail screens.
  - Added form guidance explaining that numeric-only manual tags are auto-prefixed on save.
- Validation:
  - Backend build passes (`go build ./...`).
  - Frontend production build passes (`npm run build`).
  - VS Code diagnostics report no errors across all touched files.
  - Docker services rebuilt and running with latest changes (`docker compose up -d --build backend frontend`).

## Project Completion Summary
All 12 planned steps have been significantly completed. The system includes:
- **Authentication**: JWT, bcrypt, RBAC, audit logging
- **Ticket Management**: Full CRUD, pagination, filtering, role-based access
- **Comments**: Public + internal notes, audit logged
- **Admin Panel**: User management (CRUD, role assignment, activate/deactivate)
- **File Attachments**: Upload/download/delete with MIME whitelist, 10MB limit, path traversal protection
- **Email Notifications**: SMTP (Outlook-ready), async, branded HTML templates
- **SLA Tracking**: Auto due dates, priority-based targets, overdue detection
- **Knowledge Base**: Article CRUD, categories, search, view counts, draft/publish flow, rich text formatting (`react-quill`).
- **Analytics**: Overview stats, status/priority breakdowns, SLA compliance, trends, agent workload
- **Refinements**: Full in-app notification system (with bell popover), Audit Logs (History tab on tickets), and Profile Page management.
- **ITAM (IT Asset Management)**: Lifecycle tracking, warranty monitoring, and deep integration with the ticketing system.

## Development & Access
- **Default Admin Credentials**:
  - Email: `admin@dahticket.com`
  - Password: `admin123`
- **Frontend URL**: `http://localhost:5173`
- **Backend URL**: `http://localhost:8080/api`
- **pgAdmin URL**: `http://localhost:5050` (admin@dahticket.com / admin123)

