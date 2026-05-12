# DahTicket V2

**A modern, full-stack IT helpdesk and asset management system built with Go, React, and PostgreSQL.**

DahTicket V2 is an internal company IT support platform designed for employee technical issue tracking, resolution management, and IT asset inventory. It combines ticket lifecycle management, SLA tracking, role-based access control, and enterprise-grade ITAM (IT Asset Management) in one unified dashboard.

---

## 🎯 Key Features

### Ticket Management
- **Ticket Lifecycle**: Create → Assign → Resolve → Close with full status workflow
- **Priority Levels**: Low, Medium, High, Critical with automatic SLA tracking
- **Smart Filtering**: Search by title, status, priority, assignee, date range
- **Collaborative Comments**: Public (employee visible) and internal (IT staff only) notes
- **File Attachments**: Upload and store ticket-related documents
- **Audit Logging**: Complete history of all ticket mutations with user accountability

### IT Asset Management (ITAM)
- **Asset Inventory**: Track computers, network devices, peripherals with categorized locations
- **Asset Tracking**: Serial numbers, tags, model/manufacturer info, deployment history
- **Bulk Import**: Excel-based asset imports with multi-sheet support and quantity handling
- **QR Code Generation**: Auto-generate and scan QR codes for asset tracking
- **Asset-Ticket Linking**: Link findings and repairs to specific assets
- **PM Reports**: Preventive maintenance tracking with device-type-aware form generation
- **Export Capabilities**: PDF reports, spreadsheet exports with organizational branding

### Role-Based Access Control
- **Employee**: Submit tickets, view own tickets and knowledge base
- **IT Agent**: Manage assigned tickets, update statuses, track SLAs, manage assets
- **Admin**: User management, system configuration, analytics, organization branding
- **RBAC**: Granular route-level and resource-level permission enforcement

### Knowledge Base
- **FAQ Management**: Rich text articles for common issues (admin-curated)
- **Employee Self-Service**: Search and browse knowledge articles
- **Auto-linking**: Suggest related KB articles when creating tickets

### Analytics & Reporting
- **Admin Dashboard**: System metrics (tickets, users, assets, reports)
- **PM Reports**: Device-specific findings aggregation and PDF generation
- **SLA Metrics**: MTTR (Mean Time To Resolution), MTBF (Mean Time Between Failures)
- **Audit Trail**: Complete system activity log for compliance

### Mobile & Desktop Experience
- **Responsive Design**: Fully responsive UI with mobile-optimized cards and navigation
- **Dark/Light Mode**: Context-aware theme support
- **Global Search**: Combined search across tickets and assets with dropdown results
- **Adaptive Forms**: Device-type-aware form generation for finding capture

---

## 🛠 Tech Stack

### Frontend
- **React 18** — UI library with functional components and hooks
- **Vite** — Modern build tool with fast dev server and optimized production builds
- **TypeScript** — Static typing for safer, more maintainable code
- **Tailwind CSS** — Utility-first CSS framework for rapid UI development
- **Lucide React** — Icon library with 1000+ clean SVG icons
- **Axios** — HTTP client with JWT interceptor for API communication
- **React Router v7** — Client-side routing with nested layouts
- **React Quill** — Rich text editor for knowledge base articles
- **html5-qrcode** — QR code scanner integration
- **qrcode.react** — QR code generation

### Backend
- **Go 1.26** — High-performance compiled language
- **Gin Framework** — Fast HTTP web framework with middleware support
- **GORM** — Object-relational mapping with auto-migration
- **PostgreSQL Driver** — pgx driver for optimized database connection
- **golang-jwt** — JWT token generation and validation
- **bcrypt** — Secure password hashing
- **gofpdf** — PDF generation for reports
- **excelize** — Excel file parsing and generation

### Database & Infrastructure
- **PostgreSQL 15** — ACID-compliant relational database
- **Docker & Docker Compose** — Complete containerization for dev/prod consistency
- **pgAdmin** — Web-based PostgreSQL administration (dev only)

---

## 📦 Project Structure

```
DahTicket_V2/
├── backend/                    # Go Gin backend
│   ├── main.go                # Application entrypoint
│   ├── config/                # Configuration management
│   ├── database/              # Database setup, migrations, seeding
│   ├── handlers/              # HTTP request handlers
│   │   ├── auth.go           # Login, register, auth endpoints
│   │   ├── ticket.go         # Ticket CRUD and filtering
│   │   ├── comment.go        # Comment management
│   │   ├── admin.go          # User management endpoints
│   │   ├── asset.go          # Asset CRUD operations
│   │   ├── itam_bulk.go      # Bulk asset import/export
│   │   ├── itam_qr.go        # QR code generation
│   │   ├── kb.go             # Knowledge base management
│   │   └── itam_pm.go        # PM reports and findings
│   ├── middleware/            # Auth, CORS, logging middleware
│   ├── models/                # GORM data models
│   ├── services/              # Business logic (email, notifications)
│   ├── Dockerfile             # Backend Docker image
│   └── go.mod                 # Go module dependencies
│
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── main.tsx           # React entry point
│   │   ├── App.tsx            # Root component and routing
│   │   ├── pages/             # Page components
│   │   │   ├── auth/         # Login, register, profile
│   │   │   ├── dashboard/    # Dashboard and stats
│   │   │   ├── tickets/      # Ticket list, create, detail
│   │   │   ├── itam/         # Asset list, detail, PM reports
│   │   │   ├── admin/        # Admin panel (users, analytics)
│   │   │   └── knowledge/    # Knowledge base
│   │   ├── components/        # Reusable UI components
│   │   ├── contexts/          # React Context (AuthContext)
│   │   ├── layouts/           # Layout components (DashboardLayout)
│   │   ├── services/          # API clients (axios instances)
│   │   ├── types/             # TypeScript type definitions
│   │   └── index.css          # Global styles
│   ├── public/                # Static assets
│   ├── Dockerfile             # Frontend Docker image (nginx)
│   ├── vite.config.ts         # Vite configuration
│   ├── tailwind.config.js     # Tailwind CSS configuration
│   ├── package.json           # NPM dependencies
│   └── tsconfig.json          # TypeScript configuration
│
├── docker-compose.yml         # Multi-container orchestration
├── AGENTS.md                  # AI agent setup guide
├── WORKFLOW_STATE.md          # Project status and features
└── README.md                  # This file
```

---

## 🚀 Getting Started

### Prerequisites
- **Docker & Docker Compose** (recommended for full stack)
- **Node.js 18+** (for frontend-only development)
- **Go 1.26+** (for backend-only development)
- **PostgreSQL 15+** (if running locally without Docker)

### Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/dahticket-v2.git
   cd dahticket-v2
   ```

2. **Start the full stack**
   ```bash
   docker-compose up --build
   ```
   
   Services will be available at:
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8080/api
   - **pgAdmin**: http://localhost:5050 (dev only, login: admin@example.com / admin)

3. **Default Admin Account**
   ```
   Email: admin@dahticket.com
   Password: admin123
   ```
   ⚠️ **Change this password immediately after first login!**

### Frontend Development Only

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:5173` with Vite dev server and API proxy to http://localhost:8080.

### Backend Development Only

```bash
cd backend
go run main.go
```

Backend will start on `http://localhost:8080`. Ensure PostgreSQL is running on localhost:5432.

---

## 🔐 Authentication & Authorization

### JWT Token Flow
1. User logs in with email/password
2. Backend validates credentials and generates JWT token (24-hour default expiration)
3. Token stored in localStorage (`dahticket_token` key)
4. Axios interceptor auto-attaches `Authorization: Bearer <token>` to all API requests
5. 401 Unauthorized responses trigger automatic redirect to login

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|------------|
| **Employee** | Create tickets, view own tickets, view/search knowledge base, add public comments |
| **IT Agent** | Manage assigned tickets, update all fields, manage assets, create PM findings, view analytics |
| **Admin** | Full system access, user management, analytics, system configuration, KB management |

---

## 📡 API Overview

### Authentication Endpoints
```
POST   /api/auth/login          Login with email/password → JWT token
POST   /api/auth/register       Register new employee account
GET    /api/auth/me             Get current user profile and permissions
```

### Ticket Management
```
GET    /api/tickets              List tickets (paginated, filterable by status/priority/assignee)
POST   /api/tickets              Create new ticket
GET    /api/tickets/:id          Get ticket details with comments
PUT    /api/tickets/:id          Update ticket (status, priority, assignee)
DELETE /api/tickets/:id          Delete ticket (soft delete)
GET    /api/tickets/stats        Get dashboard stats (open, in-progress, resolved, etc.)
```

### Comments & Attachments
```
GET    /api/tickets/:id/comments    List ticket comments
POST   /api/tickets/:id/comments    Add comment (public or internal)
PUT    /api/comments/:id            Update comment
DELETE /api/comments/:id            Delete comment
```

### Assets (ITAM)
```
GET    /api/assets                  List assets (paginated, searchable)
POST   /api/assets                  Create asset
GET    /api/assets/:id              Get asset details
PUT    /api/assets/:id              Update asset (tag, serial, location)
DELETE /api/assets/:id              Delete asset (soft delete)
POST   /api/assets/import           Bulk import from Excel file
POST   /api/assets/export           Export assets to Excel
GET    /api/assets/:id/qr          Generate QR code for asset
GET    /api/locations              List asset locations/buildings
```

### PM Reports & Findings
```
GET    /api/pm/findings            List PM findings (filterable by device type)
POST   /api/pm/findings            Create PM finding for asset
PUT    /api/pm/findings/:id        Update finding (status, metrics)
DELETE /api/pm/findings/:id        Delete finding
GET    /api/pm/reports             List PM reports (by month/location)
POST   /api/pm/reports             Build report from selected findings
GET    /api/pm/reports/:id/pdf     Download report as branded PDF
```

### Admin & User Management
```
GET    /api/admin/users            List all users (paginated, filterable by role)
GET    /api/admin/users/:id        Get user details
POST   /api/admin/users            Create new user with role
PUT    /api/admin/users/:id        Update user (role, active status, password reset)
DELETE /api/admin/users/:id        Delete user (soft delete)
GET    /api/admin/analytics        Get system analytics (ticket metrics, user count, etc.)
```

### Knowledge Base
```
GET    /api/kb                     List KB articles (public, searchable)
POST   /api/kb                     Create KB article (admin only)
PUT    /api/kb/:id                 Update article (admin only)
DELETE /api/kb/:id                 Delete article (admin only)
```

---

## ⚙️ Configuration

### Environment Variables

#### Backend (`.env` or via docker-compose)
```env
# Server
PORT=8080

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=dahticket

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRATION_HOURS=24

# SLA Thresholds (in hours)
SLA_LOW_HOURS=48
SLA_MEDIUM_HOURS=24
SLA_HIGH_HOURS=8
SLA_CRITICAL_HOURS=2

# Email (optional - for notifications)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=your-email@company.com
SMTP_PASSWORD=your-app-password
```

#### Frontend (`.env.local`)
```env
VITE_API_URL=http://localhost:8080/api
```

---

## 📋 Database Schema

### Core Models
- **User** — Employee/IT Agent/Admin accounts with roles and activation status
- **Ticket** — Support tickets with status, priority, assignment, SLA tracking
- **Comment** — Public and internal comments/notes on tickets
- **Attachment** — File attachments associated with tickets
- **AuditLog** — Complete activity history with user, action, old/new values, IP, user-agent
- **Asset** — IT equipment tracked with tags, serial numbers, locations
- **Location** — Physical/logical deployment locations
- **AssetTicketLink** — Many-to-many relationship between assets and tickets
- **PMFinding** — Preventive maintenance findings (health checks, issues, repairs)
- **PMReport** — Monthly/quarterly PM report aggregation
- **KBArticle** — Knowledge base FAQ articles with rich text content
- **Notification** — System notifications for ticket updates
- **ITAMSettings** — Organization branding and ITAM configuration

All models use soft deletes (`DeletedAt` field) for data retention and audit compliance.

---

## 🧪 Build & Test

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Development with hot reload
npm run dev

# Production build
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Backend
```bash
cd backend

# Run locally
go run main.go

# Build binary
go build -o dahticket main.go

# Format code
go fmt ./...

# Lint
go vet ./...
```

### Docker
```bash
# Build and start all services
docker-compose up --build

# Start in background
docker-compose up -d --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Remove volumes (reset database)
docker-compose down -v
```

---

## 📱 Key Features in Detail

### Ticket Management
- **Create**: Title, description, category, priority, attachment upload
- **Assign**: Self-assign or assign to IT agents/admins
- **Update**: Change status workflow (Open → In Progress → On Hold → Resolved → Closed)
- **Comments**: Public (visible to ticket creator) or internal (IT staff only)
- **SLA Tracking**: Auto-calculate time-to-resolve with visual warnings
- **Audit Log**: Every change tracked with timestamp, user, old/new values

### Asset Management
- **Inventory**: Register computers, network devices, peripherals, monitors, etc.
- **Bulk Import**: 
  - Upload Excel files with multiple sheets
  - Choose import scope (masterlist only vs. all sheets)
  - Quantity expansion handling for volume items
  - Automatic tag normalization with location-based prefixes
- **QR Codes**: Generate, embed in reports, scan for quick asset lookup
- **Locations**: Organize by building, floor, department, rack position
- **Export**: Generate Excel reports for audits and reconciliation

### PM Reports (Preventive Maintenance)
- **Finding Types**: Health checks, performance issues, hardware failures, connectivity, overheating, config issues, replacement needs
- **Device-Type-Aware Forms**: 
  - Network devices (switch, router, AP): utilization %, temperature
  - Endpoints (PC, laptop): temperature only
  - Other: custom descriptions
- **Report Aggregation**: Group findings by month and location
- **PDF Export**: Branded PDFs with organization logo, findings summary, MTTR/MTBF metrics
- **Metrics**: Track MTTR (mean time to resolution) and MTBF (mean time between failures)

### Knowledge Base
- **Management**: Admin-only article creation/editing with WYSIWYG editor
- **Search**: Full-text search across all articles
- **Categories**: Organize by topic/department (coming soon)
- **Self-Service**: Reduce ticket volume by helping employees find solutions

### Analytics
- **Dashboard**: System overview with key metrics
- **Ticket Analytics**: Status distribution, priority breakdown, SLA compliance
- **User Analytics**: Active users, tickets per agent, resolution statistics
- **Asset Analytics**: Inventory counts, asset age distribution, location breakdown

---

## 🚀 Deployment

### Docker Compose (Dev/Small Deployments)
```bash
docker-compose up --build -d
```

### Production Checklist
- [ ] Update `JWT_SECRET` to a cryptographically secure random string (32+ characters)
- [ ] Set PostgreSQL credentials to strong values
- [ ] Configure HTTPS/TLS with reverse proxy (nginx/Caddy)
- [ ] Set up email (SMTP) for notifications
- [ ] Configure automated PostgreSQL backups
- [ ] Update SLA threshold hours based on your SLA agreements
- [ ] Test user registration and admin account creation
- [ ] Load test with expected concurrent users
- [ ] Set up monitoring (Prometheus, Grafana, alerting)
- [ ] Create runbooks for common operations (user resets, backups, etc.)
- [ ] Document disaster recovery procedures

### Environment-Specific Deployments
```bash
# Development
docker-compose -f docker-compose.yml up --build

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

---

## 🐛 Troubleshooting

### Common Issues

**Backend fails to connect to database**
- Ensure PostgreSQL is running: `docker ps | grep postgres`
- Check DB credentials in environment variables
- Verify network connectivity: `docker-compose logs db`

**Frontend shows CORS errors**
- Ensure `VITE_API_URL` points to correct backend URL
- Check backend CORS middleware is enabled in `backend/middleware/auth.go`
- Verify Vite proxy in `frontend/vite.config.ts` if using dev server

**JWT token expired**
- Tokens expire after `JWT_EXPIRATION_HOURS` (default 24)
- User will be automatically redirected to login
- Log in again to get a fresh token

**Assets not importing correctly**
- Check Excel file format (XLSX recommended)
- Verify sheet names match expected patterns (e.g., "Masterlist")
- Review import preview summary for error counts

---

## 📞 Support & Contributing

### Reporting Issues
1. Check [WORKFLOW_STATE.md](WORKFLOW_STATE.md) for known issues and planned features
2. Provide clear reproduction steps and environment details
3. Include relevant error logs, screenshots, or API responses
4. Specify browser/device for frontend issues

### Development Guidelines
- Follow project coding standards (Go, TypeScript, React patterns)
- Use TypeScript strict mode for all new frontend code
- Write clear commit messages: `feat: add PM report PDF export`
- Test on both desktop and mobile viewports
- Update [WORKFLOW_STATE.md](WORKFLOW_STATE.md) after completing features

### Code Style
- **Backend**: Go conventions, explicit error handling, defer for cleanup
- **Frontend**: Functional components, React hooks, Tailwind utilities, no inline styles
- **Naming**: Clear descriptive names; avoid abbreviations (use `userId` not `uid`)
- **Comments**: Explain "why", not "what"; code should be self-documenting

---

## 📄 License

MIT License — See LICENSE file for details

---

## 🎓 Additional Resources

- [AGENTS.md](AGENTS.md) — AI agent setup guide and interaction patterns
- [WORKFLOW_STATE.md](WORKFLOW_STATE.md) — Current project status, completed features, roadmap
- [Go Documentation](https://golang.org/doc/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

---

## 👥 Project Team

- **Product**: [Your Name/Team]
- **Backend**: [Your Name/Team]
- **Frontend**: [Your Name/Team]
- **DevOps/Infrastructure**: [Your Name/Team]

---

**Last Updated**: May 2026  
**Version**: 2.0.0  
**Status**: Active Development  
**Maintained by**: [Your Organization]
