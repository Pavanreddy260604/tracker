# Learning OS 📚

A premium, developer-centric **Personal Learning Operating System** for serious software engineering students.

![Dark themed dashboard](https://via.placeholder.com/800x400?text=Premium+Dark+Dashboard)

## Features

- ⚡ **Zero-friction daily logging** - Track hours in under 10 seconds
- 🔥 **Streak tracking** - Current, longest, and at-risk warnings
- 📊 **Visual progress** - Circular progress rings, weekly charts, heatmaps
- 🧠 **Smart insights** - Strongest/weakest topics, consistency metrics
- 🎯 **Goal targets** - DSA (6h), Backend (4h), Project (1h) daily targets
- 🌙 **Premium dark UI** - Inspired by Linear, Vercel, and GitHub

## Tech Stack

### Backend
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT Authentication + bcrypt
- Rate limiting + Helmet security

### Frontend
- React 18 + TypeScript + Vite
- TailwindCSS + Framer Motion
- Recharts + Zustand
- React Hook Form + Zod

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Clone & Install

```bash
cd learning-os

# Backend
cd backend
npm install
cp .env .env.local  # Edit with your MongoDB URI

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

Edit `backend/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/learning-os
JWT_SECRET=your-super-secret-key-minimum-32-characters
PORT=5000
```

### 3. Start Development

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Open http://localhost:5173

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Register user |
| `/api/auth/login` | POST | Login user |
| `/api/daily-logs` | POST | Upsert daily log |
| `/api/dashboard/summary?range=today\|week\|month` | GET | Dashboard data |
| `/api/dashboard/streak` | GET | Streak info |
| `/api/dashboard/insights` | GET | Analytics |

## Project Structure

```
learning-os/
├── backend/
│   └── src/
│       ├── config/       # DB connection
│       ├── middleware/   # Auth, error handling
│       ├── models/       # Mongoose schemas
│       ├── routes/       # API routes
│       └── services/     # Streak, stats, aggregation
└── frontend/
    └── src/
        ├── components/   # UI components
        ├── pages/        # Login, Register, Dashboard
        ├── services/     # API client
        └── stores/       # Zustand state
```

## Design Philosophy

- **Engineering focus mode** - Calm but premium aesthetics
- **Zero friction** - Log progress in seconds
- **Motivation through visibility** - See your progress everywhere
- **Built for years** - Scales to millions of records

## License

MIT
