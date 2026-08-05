#!/usr/bin/env bash
set -euo pipefail

# Defaults — override via env before invoking.
IMAGE_REGISTRY="${IMAGE_REGISTRY:-registry.ftp-kube-prod.ftpsolutions.com.au}"
IMAGE_NAME="${IMAGE_NAME:-cesium-sandcastle}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
PLATFORM="${PLATFORM:-linux/amd64}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FULL_IMAGE="${IMAGE_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
LATEST_IMAGE="${IMAGE_REGISTRY}/${IMAGE_NAME}:latest"

echo "Building ${FULL_IMAGE}"
echo "  PLATFORM=${PLATFORM}"
echo "  (SANDCASTLE_ORIGIN is set at container start, not build time)"

# To hard-bake a specific origin into the image instead of substituting at
# runtime, pass --build-arg SANDCASTLE_ORIGIN=https://... as an extra arg.
docker buildx build \
  --platform "${PLATFORM}" \
  --file "${REPO_ROOT}/deploy/Dockerfile" \
  --tag "${FULL_IMAGE}" \
  --tag "${LATEST_IMAGE}" \
  --load \
  "$@" \
  "${REPO_ROOT}"

echo
echo "Built and tagged:"
echo "  ${FULL_IMAGE}"
echo "  ${LATEST_IMAGE}"
echo
echo "To push:"
echo "  docker push ${FULL_IMAGE}"
echo "  docker push ${LATEST_IMAGE}"
