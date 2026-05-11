FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# The built dist/ is then mounted into the api_server container via Docker volume.
# This stage exists so CI can produce the artifact.
FROM scratch
COPY --from=builder /app/dist /dist
