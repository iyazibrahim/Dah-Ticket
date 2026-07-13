# 🔒 Security Guidelines for DigiDesk

## Critical: Never Commit These Files

The following files contain sensitive information and are STRICTLY prohibited from being committed to Git:

### Environment Files
- `.env` - Contains JWT secrets, database passwords, API keys
- `.env.local` - Local development overrides (may contain credentials)
- `.env.production` - Production secrets (database credentials, SMTP passwords)
- `.env.*.local` - Environment-specific local overrides
- Any `.env` variant not ending in `.example`

### Credentials & Keys
- `.key` - Private keys for SSL/TLS
- `.pem` - Certificate files
- `*.p12` - PKCS12 certificate files
- `secrets/` - Directory containing secrets (if used)

### Database & Storage
- `*.db` - SQLite databases with production data
- `*.sqlite` / `*.sqlite3` - SQLite database files
- `pgdata/` - PostgreSQL data directory
- Backup files (`*.bak`, `*.backup`)
- Any local database snapshots

### Build & Dependencies
- `node_modules/` - NPM packages (regenerated via `npm install`)
- `vendor/` - Go vendor directory (use go.mod/go.sum)
- `dist/` - Built artifacts (regenerate on deploy)
- `.vite/` - Vite cache

### IDE & System
- `.vscode/settings.json` - May contain personal settings/paths
- `.idea/` - IntelliJ configuration
- `.DS_Store` - macOS system files
- `Thumbs.db` - Windows system files
- Swap files (`*.swp`, `*.swo`)

---

## ✅ What You SHOULD Commit

### Configuration Templates
- `.env.example` - Template showing required variables (NO real values!)
- `backend/.env.example` - Backend template
- `frontend/.env.example` - Frontend template

### Safe Configuration
- `docker-compose.yml` - Safe to commit (no secrets)
- `vite.config.ts` - Safe to commit
- `tsconfig.json` - Safe to commit
- Application code - Safe to commit

---

## 🛡️ Setup Instructions for New Developers

### Step 1: Clone Repository
```bash
git clone https://github.com/your-org/dahticket-v2.git
cd dahticket-v2
```

### Step 2: Create Environment Files
```bash
# Root level (for docker-compose)
cp .env.example .env

# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local
```

### Step 3: Update Environment Files
Edit the newly created `.env` files with your actual values:
```bash
# Replace placeholder values
# - JWT_SECRET: Use: openssl rand -base64 32
# - DB_PASSWORD: Use a strong password
# - SMTP credentials: Your actual email server details
```

### Step 4: Start Development
```bash
docker-compose up --build
```

---

## 🔐 Secret Management Best Practices

### For Development
1. **Use `.env.example`** — Never use real secrets in examples
2. **Keep `.env` local** — Never share your personal `.env` file
3. **Rotate secrets regularly** — Change passwords periodically
4. **Use strong secrets** — Minimum 32 characters for JWT_SECRET

### For Production
1. **Use Environment Variables** — Set via deployment platform (GitHub Actions, Kubernetes, Docker Secret)
2. **Never hardcode secrets** — Always externalize configuration
3. **Use secrets management tools** — Vault, AWS Secrets Manager, etc.
4. **Rotate secrets** — Change credentials quarterly minimum
5. **Audit access** — Monitor who has access to production secrets
6. **Use separate credentials** — Different credentials for dev/staging/production

### Generating Secure Secrets

```bash
# Generate a 32-character JWT secret
openssl rand -base64 32

# Generate a strong password (22 characters)
openssl rand -base64 16

# Alternative using /dev/urandom
head -c 32 /dev/urandom | base64
```

---

## 🚨 If You Accidentally Commit a Secret

### Immediate Action
1. **Stop deployment** — Don't push to production
2. **Revoke the secret** — Change the password/key immediately
3. **Remove from Git history** — Use `git filter-branch` or BFG Repo-Cleaner
4. **Alert team** — Notify developers about the breach

### Proper Removal
```bash
# Remove file from Git history (BFG Repo-Cleaner)
bfg --delete-files .env

# Or using git filter-branch
git filter-branch --tree-filter 'rm -f .env' HEAD

# Force push to fix remote
git push --force
```

### Prevention
Use a git pre-commit hook to check for secrets:

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
# Prevent committing .env files

if git diff --cached --name-only | grep -E '\.env|\.key|\.pem|secrets'; then
  echo "❌ Error: Cannot commit sensitive files (.env, .key, .pem, secrets)"
  echo "Use .env.example template instead"
  exit 1
fi

exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## 🔍 Checking for Exposed Secrets

### Before Pushing to GitHub
```bash
# Check for common patterns
git diff --cached | grep -iE 'password|secret|key|token|api_key|jwt'

# Use git hooks or pre-commit framework
pre-commit run --all-files
```

### Install Pre-Commit Framework
```bash
pip install pre-commit

# Add to project (.pre-commit-config.yaml)
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
EOF

pre-commit install
```

---

## 📋 Environment Variable Checklist

### Backend (.env)
- [ ] `JWT_SECRET` - 32+ character random string (NOT 'secret' or 'test')
- [ ] `DB_PASSWORD` - Strong password (NOT 'postgres' or 'password')
- [ ] `SMTP_PASSWORD` - Email app-specific password (if using email)
- [ ] `DB_HOST` - Correct database host
- [ ] `SMTP_HOST` - Correct email server

### Frontend (.env.local)
- [ ] `VITE_API_URL` - Correct backend URL for your environment

### Never Set To:
- ❌ `secret`, `password`, `test`, `admin123`
- ❌ Production values in development
- ❌ Default passwords from software
- ❌ Public test keys

---

## 🔐 Additional Security Resources

- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Git Security Best Practices](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)
- [GitHub: Removing Sensitive Data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Detect-Secrets](https://github.com/Yelp/detect-secrets)
- [gitignore.io](https://www.gitignore.io/) - Generate gitignore for your stack

---

## ❓ FAQ

**Q: Can I commit an example .env file?**  
A: Yes! But only `.env.example` with PLACEHOLDER values like `your-password-here`, NOT real secrets.

**Q: What if my JWT_SECRET is weak?**  
A: Users can forge tokens. Always use 32+ random characters: `openssl rand -base64 32`

**Q: Should I commit package-lock.json?**  
A: Yes! This is safe and recommended for npm/Node projects (it's in .gitignore by mistake - should be committed).

**Q: What about docker-compose.override.yml?**  
A: Never commit! It may contain local overrides with secrets. Use `.env` instead.

**Q: Can I use environment variables in Docker Compose?**  
A: Yes! Store in `.env` or use `docker compose --env-file ./path/to/.env` when running.

---

## 📞 Questions or Security Issues?

1. Check this guide first
2. Ask your team lead
3. Report security vulnerabilities privately (DO NOT open public GitHub issues)

---

**Last Updated**: May 2026  
**Status**: Review before first production deployment  
**Maintainer**: Security Team
