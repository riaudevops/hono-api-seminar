#!/bin/sh
set -e

case "${APP_PROCESS:-server}" in
worker)
	echo "[INFO] Starting the worker! ⚙️"
	exec bun run src/worker.ts
	;;
server | api)
	echo "[INFO] Starting the server! 🚀"
	exec bun run src/index.ts
	;;
*)
	echo "[ERROR] APP_PROCESS must be 'server' or 'worker' (got: ${APP_PROCESS})" >&2
	exit 1
	;;
esac
