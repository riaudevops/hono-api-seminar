FROM oven/bun:1

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma Client
# DATABASE_URL placeholder hanya untuk memuaskan prisma.config.ts saat generate;
# URL asli di-inject ke container lewat env runtime (compose/k8s) dan dipakai entrypoint.sh.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    bunx prisma generate

# Copy and prepare entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Use entrypoint script as startup command
CMD ["/entrypoint.sh"]