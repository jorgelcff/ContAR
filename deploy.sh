#!/usr/bin/env sh
set -eu

ACTION="up"
BUILD="false"
DETACH="true"
REMOVE_VOLUMES="false"

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
    *)
      ACTION="$1"
      shift
      ;;
  esac
done

compose() {
  docker compose "$@"
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
  *)
    echo "Unknown action: $ACTION" >&2
    exit 1
    ;;
esac