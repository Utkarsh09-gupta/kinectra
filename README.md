# 🏏 Kinectra: Advanced Sports Biomechanics Telemetry

Kinectra is a browser-native, real-time computer vision sports biomechanics analysis platform tailored for cricket batting and bowling coaching. By leveraging deep learning pose estimation directly in the browser, Kinectra provides immediate joint angles, technique scores, and AI-driven coaching telemetry without server-side video latency.

---

## 🚀 Core Features

### 1. Dual Analysis Modes
*   **Live Webcam Analysis**: Browser-native real-time skeletal tracking utilizing webcams with natural mirror-image rendering.
*   **Pre-recorded Video Upload**: Drag & Drop uploader supporting MP4/MOV/AVI files up to 100MB. Processes video frames locally to preserve original player dominant-hand orientations (no mirroring).

### 2. Live Biomechanical Telemetry
*   **Joint Angles**: Real-time vector-based calculation of elbow extension, knee flexion, spine tilt, and shoulder alignment.
*   **Audio Coaching Alerts**: Dynamic audio alerts spoken in real-time when technique thresholds break down (e.g., *"Excessive spine tilt"*).
*   **AI Coach Mute Control**: Toggle audio coaching on/off with persistent browser session storage.

### 3. Interactive Progress Tracker
*   **7-Day Performance SVG Chart**: Inline gradient line charts plotting athlete score improvements.
*   **Baseline Variance Analysis**: Comparison tables highlighting angle deviations from professional benchmarks.
*   **Inflection Point Snapshots**: Freeze-frame captures at peak delivery and stance movements paired with joint metric grids.

### 4. Advanced AI Reporting
*   Saves telemetry data and routes snapshots to the **Groq Llama 3 API** to generate comprehensive biomechanical technique reports.

---

## 🛠️ Technology Stack

*   **Monorepo Manager**: `pnpm` Workspaces
*   **Frontend**: React (TypeScript) + Vite + Tailwind CSS + Framer Motion
*   **Pose Engine**: Google MediaPipe Vision Tasks (runs on WebAssembly & WebGPU/WebGL)
*   **Backend API**: Node.js + Express 5
*   **Database & ORM**: PostgreSQL (Neon Serverless) + Drizzle ORM
*   **LLM Integration**: Groq Llama 3 API
*   **API Codegen**: Orval (OpenAPI yaml source of truth)

---

## 📁 Workspace Architecture

```text
├── artifacts/
│   ├── kinectra/             # Vite + React Frontend App
│   │   └── src/
│   │       ├── components/   # UI elements (Branded hexagon logo, Navbar)
│   │       ├── contexts/     # Session context (athlete name, uploaded video url)
│   │       ├── hooks/        # use-kinectra-analysis (MediaPipe skeleton tracking)
│   │       └── pages/        # Home, Auth, Setup, Analysis, Results
│   └── api-server/           # Node.js + Express API Server
│       └── src/
│           ├── routes/       # Auth (JWT log-ins), Session (Groq completions)
│           └── utils/        # JWT utilities, Database connectors
├── lib/
│   ├── db/                   # Drizzle database configurations and schema
│   ├── api-spec/             # OpenAPI spec definitions (YAML source of truth)
│   ├── api-client-react/     # Generated API React query hooks (via Orval)
│   └── api-zod/              # Generated Zod validation schemas (via Orval)
```

---

## ⚙️ Local Development Setup

### 1. Prerequisites
Ensure you have **Node.js v24+** and **pnpm** installed globally:
```bash
npm install -g pnpm
```

### 2. Clone the Repository
```bash
git clone https://github.com/Utkarsh09-gupta/kinectra.git
cd kinectra
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://neondb_owner:...@ep-...aws.neon.tech/neondb?sslmode=require"
GROQ_API_KEY="gsk_..."
```

### 4. Install Dependencies
```bash
pnpm install
```

### 5. Push Database Schemas
Push the schemas directly to your Neon database instance:
```bash
pnpm --filter @workspace/db run push
```

### 6. Run Dev Servers
Launch both the frontend and backend in parallel:
```bash
# Start Backend (Port 8080)
pnpm --filter @workspace/api-server run dev

# Start Frontend (Port 24564)
pnpm --filter @workspace/kinectra run dev
```

---

## 🌐 Production Deployment Summary

*   **Vite Frontend** (Render Static Site / Vercel):
    *   **Build Command**: `pnpm install && pnpm --filter @workspace/kinectra run build`
    *   **Publish Directory**: `artifacts/kinectra/dist/public`
    *   **Environment Variable**: `VITE_API_URL="https://your-backend.onrender.com"`
*   **Express Backend** (Render Web Service):
    *   **Build Command**: `pnpm install && pnpm run typecheck:libs && pnpm --filter @workspace/api-server run build`
    *   **Start Command**: `node --enable-source-maps ./artifacts/api-server/dist/index.mjs`
    *   **Environment Variables**: `DATABASE_URL` and `GROQ_API_KEY`
