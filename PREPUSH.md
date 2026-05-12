# ✅ Pre-GitHub Push Checklist

**CRITICAL**: Complete this checklist before pushing code to GitHub to ensure no sensitive data is exposed.

---

## 🔐 Sensitive Files Check

- [ ] No `.env` files in git (only `.env.example` templates)
- [ ] No `.env.local` files in git
- [ ] No `.env.production` files in git
- [ ] No `.key` or `.pem` files in git
- [ ] No database dump files (`*.sql`, `*.db`, `*.sqlite`)
- [ ] No backup files (`*.bak`, `*.backup`)
- [ ] pgAdmin data directory not committed (`pgadmin4/`, `pgAdmin_*`)
- [ ] Docker compose override file not committed (`docker-compose.override.yml`)

### Verify with Git
```bash
# Check staged files for secrets
git diff --cached | grep -iE 'password|secret|key|token|api_key|jwt_secret|db_password|smtp_password'

# List all staged files
git diff --cached --name-only

# Never see these:
git ls-files | grep -E '\.env$|\.env\.local|\.env\.production|\.key$|\.pem$|\.db$|\.sqlite'
```

---

## 📝 Configuration Files Check

### Root Directory
- [ ] `.env.example` present (with example/placeholder values only)
- [ ] `.gitignore` configured to ignore `.env*` files
- [ ] `docker-compose.yml` has NO secrets (only default safe values)
- [ ] No hardcoded passwords in YAML files

### Backend (`backend/`)
- [ ] `.env.example` present with template values
- [ ] `.gitignore` includes `.env` and sensitive patterns
- [ ] No secrets in `main.go` or config files
- [ ] No API keys hardcoded in source code
- [ ] `go.mod` and `go.sum` are committed (safe)
- [ ] `vendor/` excluded from git (go.mod sufficient)

### Frontend (`frontend/`)
- [ ] `.env.example` present with template values  
- [ ] `.gitignore` includes `.env*` files
- [ ] No API keys in `vite.config.ts` or source code
- [ ] No hardcoded backend URLs (use environment variables)
- [ ] `node_modules/` not committed
- [ ] `dist/` and `.vite/` not committed

---

## 🔍 Source Code Scan

```bash
# Search for common secret patterns
git diff --cached | grep -iE '(password|secret|key|token|api_key|JWT_SECRET|DB_PASSWORD|SMTP_PASSWORD|Authorization: Bearer)'

# Search TypeScript/JavaScript files
grep -r "password" frontend/src --include="*.ts" --include="*.tsx" --include="*.js"
grep -r "secret" frontend/src --include="*.ts" --include="*.tsx" --include="*.js"
grep -r "api_key" frontend/src --include="*.ts" --include="*.tsx" --include="*.js"

# Search Go files
grep -r "password" backend --include="*.go" | grep -v "// "
grep -r "secret" backend --include="*.go" | grep -v "// "
grep -r "api_key" backend --include="*.go" | grep -v "// "
```

**If any secrets found**: Remove them and commit `git rm --cached <file>` before pushing!

---

## 📦 Dependency Files Check

### Frontend
- [ ] `package-lock.json` IS committed (recommended for reproducibility)
- [ ] `node_modules/` IS NOT committed
- [ ] `.npmrc` file (if exists) does NOT contain auth tokens

### Backend  
- [ ] `go.mod` IS committed
- [ ] `go.sum` IS committed
- [ ] `vendor/` directory IS NOT committed (go.mod is sufficient)

---

## 🔐 Credentials Check

### Database Credentials
- [ ] No real PostgreSQL password in any file
- [ ] Only placeholder like `your-password-here` in examples
- [ ] `docker-compose.yml` uses safe defaults for dev

### JWT Secrets
- [ ] No `JWT_SECRET=secret` or weak values in code
- [ ] Only templates in `.env.example`
- [ ] No hardcoded JWT secrets in source

### Email/SMTP Credentials
- [ ] No real email addresses/passwords in code
- [ ] SMTP credentials only in `.env` (not committed)
- [ ] Templates only show structure, not real values

### API Keys
- [ ] No external API keys in source code
- [ ] No AWS keys, Azure keys, etc.
- [ ] No third-party service credentials

---

## 🔍 Git History Check

```bash
# Check what's actually being committed
git diff --cached --stat

# See full diff of staged changes
git diff --cached

# List all files to be committed
git diff --cached --name-only

# Ensure no extra files in staging
git status
```

---

## 🧹 Cleanup Before Commit

```bash
# Remove any accidentally staged .env files
git rm --cached .env
git rm --cached backend/.env
git rm --cached frontend/.env.local

# Add exclusions to .gitignore if missing
echo ".env" >> .gitignore
echo "backend/.env" >> .gitignore
echo "frontend/.env.local" >> .gitignore

# Verify files are removed from staging
git status
git diff --cached --name-only
```

---

## ✅ Final Verification

Run this script to verify everything:

```bash
#!/bin/bash

echo "🔐 Security Pre-Push Verification"
echo "=================================="
echo ""

# Check for .env files
echo "1. Checking for .env files..."
if git diff --cached --name-only | grep -E '\.env'; then
    echo "❌ ERROR: .env files staged for commit!"
    exit 1
else
    echo "✅ No .env files"
fi

# Check for key files
echo "2. Checking for .key/.pem files..."
if git diff --cached --name-only | grep -E '\.(key|pem)$'; then
    echo "❌ ERROR: Key/certificate files staged!"
    exit 1
else
    echo "✅ No key/certificate files"
fi

# Check for database files
echo "3. Checking for database files..."
if git diff --cached --name-only | grep -E '\.(db|sqlite|sql)$'; then
    echo "❌ ERROR: Database files staged!"
    exit 1
else
    echo "✅ No database files"
fi

# Check for node_modules
echo "4. Checking for node_modules..."
if git diff --cached --name-only | grep 'node_modules'; then
    echo "❌ ERROR: node_modules staged!"
    exit 1
else
    echo "✅ No node_modules"
fi

# Quick secret pattern check
echo "5. Scanning for secret patterns..."
if git diff --cached | grep -iE '(password|secret|api_key|jwt_secret)\s*=\s*[^"[:space:]]*example'; then
    echo "⚠️  WARNING: Check secret values above"
else
    echo "✅ No obvious secrets detected"
fi

echo ""
echo "✅ All checks passed! Safe to push to GitHub"
```

Save as `scripts/pre-push-check.sh` and run before each push:
```bash
chmod +x scripts/pre-push-check.sh
./scripts/pre-push-check.sh
```

---

## 🚀 Ready to Push!

Once all checks pass:

```bash
# Review one more time
git log --oneline -5
git diff --cached --stat

# Push to GitHub
git push origin your-branch-name

# Or if pushing to main
git push origin main
```

---

## ⚠️ If Secrets Were Already Pushed

**IMMEDIATE ACTIONS:**
1. Stop everything
2. Change ALL passwords/keys
3. Use `git filter-branch` to remove from history
4. Force push the cleaned repository
5. Notify the team
6. See SECURITY.md for detailed remediation

---

## 📞 Questions?

- Check `.gitignore` files (root, backend/, frontend/)
- Review `.env.example` templates
- See SECURITY.md for complete security guide
- Ask your team lead

---

**Do NOT proceed to GitHub until ALL checks are ✅**

**Last Updated**: May 2026
