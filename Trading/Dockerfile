# ── Stage 1: Build React frontend ──────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts
COPY frontend/ .
RUN npm run build

# ── Stage 2: Python backend + static files ─────────────────────────
FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY app/ app/

# Copy frontend build output to static/
COPY --from=frontend-build /frontend/dist/ static/

ENV PORT=8000
EXPOSE ${PORT}

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
