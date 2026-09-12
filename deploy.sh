#!/usr/bin/env sh
set -eu

ACTION="up"
BUILD="false"
DETACH="true"
REMOVE_VOLUMES="false"
PROD="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    -Action)
      ACTION="${2:-up}"
      shift 2
      ;;
    -Build)
      BUILD="true"
      shift
      ;;
    -Detach)
      DETACH="true"
      shift
      ;;
    -NoDetach)
      DETACH="false"
      shift
      ;;
    -RemoveVolumes)
      REMOVE_VOLUMES="true"
      shift
      ;;
    -Prod)
      PROD="true"
      shift
      ;;
    *)
      ACTION="$1"
      shift
      ;;
  esac
done

compose() {
  if [ "$PROD" = "true" ]; then
    docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"
  else
    docker compose "$@"
  fi
}

case "$ACTION" in
  up)
    set -- up
    if [ "$BUILD" = "true" ]; then
      set -- "$@" --build
    fi
    if [ "$DETACH" = "true" ]; then
      set -- "$@" -d
    fi
    compose "$@"
    ;;
  down)
    set -- down
    if [ "$REMOVE_VOLUMES" = "true" ]; then
      set -- "$@" -v
    fi
    compose "$@"
    ;;
  restart)
    compose down
    set -- up
    if [ "$BUILD" = "true" ]; then
      set -- "$@" --build
    fi
    if [ "$DETACH" = "true" ]; then
      set -- "$@" -d
    fi
    compose "$@"
    ;;
  status)
    compose ps
    ;;
  logs)
    compose logs -f
    ;;
  # VPS redeploy: pull latest main, rebuild what changed, recreate, prune old
  # images. Requires backend/.env and .env (DOMAIN=..., see .env.example) to
  # already exist on the server. Implies -Prod (Caddy + closed-off ports).
  deploy)
    PROD="true"
    if [ ! -f backend/.env ]; then
      echo "backend/.env missing — copy backend/.env.example, fill in real secrets, and re-run." >&2
      exit 1
    fi
    if [ ! -f .env ]; then
      echo ".env missing — copy .env.example and set at least DOMAIN, then re-run." >&2
      exit 1
    fi
    git pull --ff-only
    compose build
    compose up -d --remove-orphans
    docker image prune -f
    ;;
  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac
