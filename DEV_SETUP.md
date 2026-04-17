# Development Setup Guide

## Quick Start

### 1. Infrastructure (Docker)
```bash
npm run dev:infra
```
This starts MySQL, Redis, and MongoDB on standard ports (3306, 6379, 27017).

### 2. Admin Password Setup
Before starting the server, initialize the admin password:

```bash
# With default password 'test'
npm run dev:init-password --workspace=server

# Or with custom password
ADMIN_PASSWORD=mypassword npm run dev:init-password --workspace=server

# Or with token
ADMIN_PASSWORD=mypassword ADMIN_TOKEN=mytoken123 npm run dev:init-password --workspace=server
```

### 3. Backend Server
```bash
npm run dev:server
```
Runs on port 3000 with auto-reload via nodemon.

### 4. Frontend (Vite)
In another terminal:
```bash
npm run dev:client
```
Runs on port 8080 with hot-reload.

### All Together
```bash
# Setup env first
source .env.dev

# Initialize password (one time)
npm run dev:init-password --workspace=server

# Then start all services
npm run dev
```

## Environment Variables

Key variables in `.env.dev`:
- `NODE_ENV` - set to `development` for dev
- `ADMIN_PASSWORD` - initial admin password (used only by `dev:init-password`)
- `ADMIN_TOKEN` - optional API token for admin user
- Database/Redis/Mongo hosts/ports

Edit `.env.dev` to match your local setup if needed.

## How Admin Password Works

The admin password is **one-time only** at database initialization:

1. `npm run dev:init-password` hashes the password with bcrypt
2. Stores the hash in the `users` table in the database
3. The password is never read from environment variables at runtime
4. To change it later, use the UI or the `dev:init-password` script again

## Common Tasks

### Reset Admin Password
```bash
ADMIN_PASSWORD=newpassword npm run dev:init-password --workspace=server
```

### View Database State
```bash
# MySQL
docker exec -it $(docker ps -q -f ancestor=mysql:8.4) \
  mysql -umailtrain -pmailtrain mailtrain -e "SELECT id, email FROM users LIMIT 1;"
```

### Rebuild Database from Scratch
```bash
# Stop services
npm run dev:infra  # Ctrl+C

# Remove volumes
docker volume rm hcfmailer-plus_mysql-data hcfmailer-plus_mongo-data hcfmailer-plus_redis-data

# Start fresh
npm run dev:infra
```

## Troubleshooting

**"Cannot find module '@zone-eu/zone-mta/plugins/core/default-headers'"**
- The plugin symlinks may not have been created. Run:
  ```bash
  cd zone-mta && \
  mkdir -p plugins/core && \
  ls node_modules/@zone-eu/zone-mta/plugins/core/ | while read item; do \
    ln -sf ../../node_modules/@zone-eu/zone-mta/plugins/core/$item plugins/core/$item; \
  done
  ```

**"ECONNREFUSED" errors from server**
- MySQL, Redis, or MongoDB not ready. Wait a few seconds and restart the server:
  ```bash
  npm run dev:server
  ```

**Port already in use**
- Kill the process:
  ```bash
  lsof -ti:3000 | xargs kill -9  # Port 3000
  lsof -ti:8080 | xargs kill -9  # Port 8080
  ```
