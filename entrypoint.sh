#!/bin/sh

# IF YOU WANT TO RESET THE DATABASE and APPLY New Migrations
# echo "[INFO] Running Prisma migrations reset! 🔥"
# bunx prisma migrate reset --force

echo "[INFO] Running Prisma migrations! 🔥"

bunx prisma migrate deploy

echo "[INFO] Seeding the database! 🌱"
bunx prisma db seed

echo "[INFO] Starting the server! 🚀"
bun start