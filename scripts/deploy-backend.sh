#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ENV="$ROOT_DIR/mangaApp-backend/.env"
BACKEND_ENV_EXAMPLE="$ROOT_DIR/mangaApp-backend/.env.example"

cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. Run scripts/install-docker-ubuntu.sh first." >&2
  exit 1
fi

if [ ! -f "$BACKEND_ENV" ]; then
  cp "$BACKEND_ENV_EXAMPLE" "$BACKEND_ENV"
  echo "Created mangaApp-backend/.env from .env.example. Review it before exposing the server publicly."
fi

docker compose up -d --build
docker compose ps

echo "Waiting for backend health check..."
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:5001/health >/dev/null 2>&1; then
    echo "Backend is healthy:"
    curl -fsS http://127.0.0.1:5001/health
    exit 0
  fi
  sleep 2
done

echo "Backend did not become healthy in time." >&2
docker compose logs --tail=200 backend
exit 1
