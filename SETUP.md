# 🚀 First-Time Setup Guide

## Prerequisites
- Docker & Docker Compose (recommended)
- OR: Node.js 18+, Go 1.26+, PostgreSQL 15+

---

## Option 1: Docker Compose (Recommended)

### 1. Clone & Navigate
```bash
git clone https://github.com/your-org/dahticket-v2.git
cd dahticket-v2
```

### 2. Setup Environment
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your local values
# At minimum, change:
# - JWT_SECRET (generate: openssl rand -base64 32)
# - DB_PASSWORD (strong password)
nano .env
```

### 3. Start Services
```bash
docker-compose up --build
```

### 4. Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api
- **pgAdmin**: http://localhost:5050 (admin@example.com / admin)

### 5. Login
```
Email: admin@dahticket.com
Password: admin123
```
⚠️ **Change this password immediately!**

---

## Option 2: Local Development (Frontend Only)

### 1. Setup Frontend
```bash
cd frontend
cp .env.example .env.local

# Edit .env.local
nano .env.local

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs on: http://localhost:5173  
API proxy configured to: http://localhost:8080/api

---

## Option 3: Local Development (Backend Only)

### 1. Setup Backend
```bash
cd backend
cp .env.example .env

# Edit .env
nano .env

# Run backend
go run main.go
```

Backend runs on: http://localhost:8080

---

## Common Commands

### Docker
```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down

# Reset database (WARNING: deletes all data)
docker-compose down -v
```

### Frontend
```bash
npm run dev        # Development server with hot reload
npm run build      # Production build
npm run lint       # Check code quality
npm run preview    # Preview production build
```

### Backend
```bash
go run main.go     # Run server
go fmt ./...       # Format code
go vet ./...       # Lint code
go build           # Build binary
```

---

## 🔐 Security Reminders

1. **Never commit `.env` files** — Use `.env.example` templates
2. **Keep `.env.local` private** — Add to .gitignore (already done)
3. **Change default password** — Update admin account immediately
4. **Generate secure JWT_SECRET** — Use `openssl rand -base64 32`
5. **Review SECURITY.md** — Full security guidelines included

---

## ❓ Troubleshooting

### "Cannot connect to database"
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View database logs
docker-compose logs db
```

### "Port 8080 already in use"
```bash
# Find what's using port 8080
lsof -i :8080

# Kill the process or use different port in .env
```

### "CORS errors in browser console"
1. Check `VITE_API_URL` matches backend URL
2. Verify backend is running on expected port
3. Check `frontend/vite.config.ts` proxy configuration

### "Authentication fails"
1. Clear browser localStorage and cookies
2. Verify JWT_SECRET is set correctly in backend
3. Check token expiration settings in .env

---

## 📞 Need Help?

1. Check README.md for feature documentation
2. Review WORKFLOW_STATE.md for project status
3. See SECURITY.md for credential/environment guidance
4. Check AGENTS.md for AI assistant guidelines

---

**Happy coding! 🎉**
