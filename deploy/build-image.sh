#!/usr/bin/env bash
set -euo pipefail

IMAGE_REGISTRY="${IMAGE_REGISTRY:-registry.ftp-kube-prod.ftpsolutions.com.au}"
IMAGE_NAME="${IMAGE_NAME:-cesium-sandcastle}"
PLATFORM="${PLATFORM:-linux/amd64}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${IMAGE_REGISTRY}/${IMAGE_NAME}:latest"

echo "Building ${IMAGE} for ${PLATFORM}"

docker buildx build \
  --platform "${PLATFORM}" \
  --file "${REPO_ROOT}/deploy/Dockerfile" \
  --tag "${IMAGE}" \
  --load \
  "$@" \
  "${REPO_ROOT}"

echo
echo "Push: docker push ${IMAGE}"
echo "Roll: kubectl -n sandcastle rollout restart deploy/sandcastle"
