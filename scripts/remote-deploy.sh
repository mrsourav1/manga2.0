#!/usr/bin/env bash

set -Eeuo pipefail

ARCHIVE_PATH="${1:?Release archive path is required}"
RELEASE_SHA="${2:?Release SHA is required}"
APP_DIR="${APP_DIR:-/home/ubuntu/manga}"
PROJECT_NAME="manga"
STAGING_DIR="$(mktemp -d "/tmp/mangafy-stage-${RELEASE_SHA:0:12}-XXXXXX")"
BACKUP_DIR="$(mktemp -d "/tmp/mangafy-backup-${RELEASE_SHA:0:12}-XXXXXX")"
SOURCE_SWITCHED=false
DEPLOY_SUCCEEDED=false

cleanup() {
  rm -rf "$STAGING_DIR" "$BACKUP_DIR"
  rm -f "$ARCHIVE_PATH"
}

rollback() {
  local exit_code=$?

  if [ "$SOURCE_SWITCHED" = true ] && [ "$DEPLOY_SUCCEEDED" = false ]; then
    echo "Deployment failed. Restoring the previous backend release."
    rm -rf "$APP_DIR/mangaApp-backend" "$APP_DIR/scripts"
    cp -a "$BACKUP_DIR/mangaApp-backend" "$APP_DIR/mangaApp-backend"
    cp -a "$BACKUP_DIR/scripts" "$APP_DIR/scripts"
    cp "$BACKUP_DIR/docker-compose.yml" "$APP_DIR/docker-compose.yml"

    (
      cd "$APP_DIR"
      docker compose --project-name "$PROJECT_NAME" build backend
      docker compose --project-name "$PROJECT_NAME" up -d --remove-orphans
    ) || true
  fi

  cleanup
  exit "$exit_code"
}

trap rollback ERR
trap cleanup EXIT

if [ ! -f "$APP_DIR/mangaApp-backend/.env" ]; then
  echo "Missing $APP_DIR/mangaApp-backend/.env; refusing to deploy." >&2
  exit 1
fi

tar -xzf "$ARCHIVE_PATH" -C "$STAGING_DIR"

cp "$APP_DIR/mangaApp-backend/.env" "$STAGING_DIR/mangaApp-backend/.env"
cp -a "$APP_DIR/mangaApp-backend" "$BACKUP_DIR/mangaApp-backend"
cp -a "$APP_DIR/scripts" "$BACKUP_DIR/scripts"
cp "$APP_DIR/docker-compose.yml" "$BACKUP_DIR/docker-compose.yml"

(
  cd "$STAGING_DIR"
  docker compose --project-name "$PROJECT_NAME" config --quiet
  docker compose --project-name "$PROJECT_NAME" build backend
)

rm -rf "$APP_DIR/mangaApp-backend" "$APP_DIR/scripts"
cp -a "$STAGING_DIR/mangaApp-backend" "$APP_DIR/mangaApp-backend"
cp -a "$STAGING_DIR/scripts" "$APP_DIR/scripts"
cp "$STAGING_DIR/docker-compose.yml" "$APP_DIR/docker-compose.yml"
SOURCE_SWITCHED=true

(
  cd "$APP_DIR"
  docker compose --project-name "$PROJECT_NAME" up -d --no-build --remove-orphans
)

echo "Waiting for backend health check..."
for _ in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:5001/health >/dev/null; then
    DEPLOY_SUCCEEDED=true
    docker compose --project-name "$PROJECT_NAME" --project-directory "$APP_DIR" ps
    docker image prune --force >/dev/null
    echo "Deployment ${RELEASE_SHA} is healthy."
    exit 0
  fi

  sleep 2
done

echo "Backend did not become healthy after deployment." >&2
docker compose --project-name "$PROJECT_NAME" --project-directory "$APP_DIR" logs --tail=200 backend >&2
false
