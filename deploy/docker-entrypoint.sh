#!/bin/sh
# Starts the application as the user that owns the data directory.
#
# PUID and PGID are how an install on a NAS or on CasaOS writes to a bind mount it does not own.
# When the container starts as root, ownership of the data directory is corrected if it is wrong,
# and the process then drops to PUID:PGID. When it does not start as root, nothing is changed.
set -e

DATA_DIR="${IDK_DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
    PUID="${PUID:-1000}"
    PGID="${PGID:-1000}"
    mkdir -p "$DATA_DIR"
    # Only when it is actually wrong: a recursive chown at every start is slow on a large or remote volume.
    if [ "$(stat -c '%u:%g' "$DATA_DIR")" != "${PUID}:${PGID}" ]; then
        echo "idontknot: taking ownership of $DATA_DIR as ${PUID}:${PGID}"
        chown -R "${PUID}:${PGID}" "$DATA_DIR" || \
            echo "idontknot: could not change the owner of $DATA_DIR; continuing anyway" >&2
    fi
    exec su-exec "${PUID}:${PGID}" "$@"
fi

exec "$@"
