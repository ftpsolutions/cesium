# syntax=docker/dockerfile:1

# ---- Build stage ----
# Runs on the host's native arch (BUILDPLATFORM) so esbuild/gulp aren't emulated
# under qemu — even when the final image targets a different arch. Cesium's
# output is arch-independent (JS/CSS/assets), so this is safe.
FROM --platform=$BUILDPLATFORM node:22-bookworm AS builder
WORKDIR /work

# Native build deps for canvas / node-gyp
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ pkg-config \
      libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

# Copy only the manifests first so `npm i` stays layer-cached across source edits.
COPY package.json ./
COPY packages/engine/package.json packages/engine/package.json
COPY packages/widgets/package.json packages/widgets/package.json
COPY packages/sandcastle/package.json packages/sandcastle/package.json

RUN npm i

# Now bring in the rest of the source.
COPY . .

# The Sandcastle App reads its origin from window.location.origin at runtime
# (see Bucket.tsx / bucket-client.ts), so no origin needs to be baked in.
# Skip semantic-search embeddings by default (avoids a large model download).
ARG SANDCASTLE_NO_EMBEDDINGS=1
ENV SANDCASTLE_NO_EMBEDDINGS=${SANDCASTLE_NO_EMBEDDINGS}
ENV PROD=true

RUN npx gulp buildRelease
RUN npx gulp buildTs
RUN npm run build-sandcastle

# ---- Serve stage ----
FROM nginx:1.27-alpine
COPY --from=builder /work/Build/Sandcastle2 /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
