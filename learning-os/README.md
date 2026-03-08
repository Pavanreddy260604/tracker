# Learning OS

Learning OS is a monorepo for a personal learning platform with a modern React UI, a TypeScript backend API, and a dedicated script-writer microservice.

## Services

| Service | Default Port | Purpose |
| --- | --- | --- |
| `frontend` | `5173` | Main web app (Vite + React + Tailwind v4) |
| `backend` | `5000` | Core API, auth, learning data, interview features |
| `script-writer-service` | `5003` | AI script writer endpoints |
| `chroma` | `8000` | Vector store used by script-writer flows |

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, Framer Motion
- Backend: Node.js, Express, TypeScript, MongoDB (Mongoose), JWT, Zod
- Script Writer Service: Express + TypeScript, LLM integrations, ChromaDB

## Prerequisites

- Node.js 18+
- npm
- MongoDB (local or Atlas)
- Chroma CLI (if running full script-writer workflow locally)

## Setup

1. Install root tooling:

```bash
npm install
```

2. Install service dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../script-writer-service && npm install
```

3. Create environment files:

- Backend:

```bash
cp backend/.env.example backend/.env
```

- Frontend:

```bash
cp frontend/.env.example frontend/.env
```

- Script writer:

```bash
cp script-writer-service/.env.example script-writer-service/.env
```

## Environment Variables

### `backend/.env`

Required:
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_ISSUER`
- `ENCRYPTION_KEY` (must be exactly 32 characters)

Optional:
- `PORT` (default `5000`)
- `FRONTEND_URL` (default `http://localhost:5173`)

### `frontend/.env`

- `VITE_API_URL=/api`
- `VITE_SCRIPT_SERVICE_URL=http://localhost:5003/api`

### `script-writer-service/.env`

- `PORT=5003`
- `MONGODB_URI=...`
- `JWT_SECRET=...` (must match backend)
- `OLLAMA_URL=...`
- `OLLAMA_MODEL=...`
- `SCRIPT_WRITER_ADMIN_EMAILS=admin1@example.com,admin2@example.com` (required for `/api/script/ai/provider` switching)
- `SCRIPT_WRITER_ADMIN_USER_IDS=...` (optional additional allowlist for provider switching)

## Run Locally

### Full stack (root command)

```bash
npm run dev
```

This starts:
- backend
- frontend
- script-writer-service
- chroma

### Manual (separate terminals)

```bash
cd backend && npm run dev
cd frontend && npm run dev
cd script-writer-service && npm run dev
chroma run --host localhost --port 8000
```

## Build and Test

```bash
cd backend && npm test && npm run build
cd frontend && npm run build
cd script-writer-service && npm run build
```

## Project Structure

```text
learning-os/
  backend/                 # Core API
  frontend/                # Web client
  script-writer-service/   # AI script-writer microservice
  chroma/                  # Chroma-related assets
```
