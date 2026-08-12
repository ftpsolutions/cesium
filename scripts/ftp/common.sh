#!/usr/bin/env bash
#
# Shared bits for ../../build.sh and ../../push.sh. Sourced, never executed.
#
# The one idea worth holding on to: we publish under our OWN scope
# (@ftpsolutions/*), not over the top of the real cesium / @cesium/* names, since
# the registry proxies npmjs and those names are already upstream's. Consumers get
# the fork through a single npm alias:
#
#     "cesium": "npm:@ftpsolutions/cesium@1.144.0-ftp.g6d5d8b1"
#
# The alias key is what lands in node_modules, so every `import ... from "cesium"`
# resolves unchanged, and the umbrella's own aliased dependencies bring our engine
# and widgets with it. See PUBLISHING.md.

say() { printf '\033[36m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[33mwarning:\033[0m %s\n' "$1" >&2; }
die() {
  printf '\033[31merror:\033[0m %s\n' "$1" >&2
  exit 1
}

# Renders a script's header comment as its usage text; no second copy to drift.
ftp_usage() { sed -e '1d' -e '/^set /,$d' -e 's/^# \{0,1\}//' "$1"; }

FTP_REPO="$(cd -P "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FTP_SCRIPTS="$FTP_REPO/scripts/ftp"

NPM_SCOPE="${NPM_SCOPE:-@ftpsolutions}"
NPM_REGISTRY="${NPM_REGISTRY:-https://npm.ftp-kube-prod.ftpsolutions.com.au}"
NPM_REGISTRY="${NPM_REGISTRY%/}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm}"
DRY_RUN="${DRY_RUN:-0}"

# Relative to the repo root, so it means the same thing inside the container.
OUT_DIR_REL="${OUT_DIR_REL:-build_output}"
FTP_OUT="$FTP_REPO/$OUT_DIR_REL"

# Containerise under CI, use your own node locally.
DOCKER="${DOCKER:-$([ "${CI:-}" = "true" ] && echo 1 || echo 0)}"

export NPM_SCOPE NPM_REGISTRY OUT_DIR_REL FTP_OUT FTP_SCRIPTS NODE_IMAGE DRY_RUN DOCKER

# "<dir>|<upstream name>|<published suffix>", read with
#     IFS='|' read -r dir upstream suffix <<<"$entry"
# In dependency order: engine, widgets (needs engine), umbrella (needs both), so
# push.sh publishing in this order never leaves the umbrella pointing at a version
# that isn't there yet.
FTP_PACKAGES=(
  "packages/engine|@cesium/engine|cesium-engine"
  "packages/widgets|@cesium/widgets|cesium-widgets"
  ".|cesium|cesium"
)

ftp_published_name() { printf '%s/%s' "$NPM_SCOPE" "$1"; }

# npm's tarball naming: @scope/name -> scope-name-<version>.tgz
ftp_tarball_name() { printf '%s-%s.tgz' "$(printf '%s' "$1" | sed 's|^@||; s|/|-|g')" "$2"; }

# awk not `sed | head -1`: head closing the pipe early trips pipefail.
ftp_upstream_version() {
  awk -F'"' '/^[[:space:]]*"version"[[:space:]]*:/ { print $4; exit }' "$FTP_REPO/package.json"
}

ftp_commit_sha() {
  printf '%s' "${COMMIT_HASH:-$(git -C "$FTP_REPO" rev-parse HEAD 2>/dev/null || echo '')}"
}

# <upstream>-ftp.g<short sha>. A semver prerelease, so it can never satisfy a caret
# range on the real cesium by accident, and the sha says which commit built it.
# Note it is NOT ordered - npm can't tell which of two fork builds is newer, so
# consumers pin exactly. The "g" is load bearing: an all-digit prerelease
# identifier must not have a leading zero, and ~1 short sha in 300 is exactly that.
# ".dirty" for tracked modifications only; untracked files are normal in CI.
ftp_fork_version() {
  if [ -n "${FORK_VERSION:-}" ]; then
    printf '%s' "$FORK_VERSION"
    return
  fi

  local upstream sha short dirty=""
  upstream="$(ftp_upstream_version)"
  sha="$(ftp_commit_sha)"
  [ -n "$sha" ] || die "couldn't work out the commit - set COMMIT_HASH or FORK_VERSION"

  short="$(printf '%s' "$sha" | cut -c1-7 | tr '[:upper:]' '[:lower:]')"
  case "$short" in
  *[!0-9a-f]*) die "COMMIT_HASH='$sha' doesn't look like a git sha" ;;
  esac
  [ -z "$(git -C "$FTP_REPO" status --porcelain -uno 2>/dev/null)" ] || dirty=".dirty"

  printf '%s-ftp.g%s%s' "$upstream" "$short" "$dirty"
}

ftp_assert_node() {
  command -v node >/dev/null || die "no node on PATH (DOCKER=1 to use $NODE_IMAGE)"
  [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] ||
    die "needs node >= 22, you're on $(node -v) (DOCKER=1 to use $NODE_IMAGE)"
}

# Re-exec the caller inside NODE_IMAGE with the repo bind-mounted. TeamCity agents
# have docker but no guaranteed node 22.
#
# --user keeps what we write owned by the caller rather than root, so HOME has to
# move somewhere writable. GIT_CONFIG_* marks /src safe without writing a
# gitconfig: the uid inside the container doesn't match the bind mount's owner on
# Docker Desktop, and git refuses to read a repo it thinks belongs to someone else.
ftp_reexec_in_docker() {
  local script_name="$1" var
  shift
  command -v docker >/dev/null || die "DOCKER=1 but docker is not on PATH"
  say "re-running $script_name inside $NODE_IMAGE"

  local -a env_args=()
  for var in CI FORK_VERSION COMMIT_HASH BRANCH NPM_SCOPE NPM_REGISTRY NPM_DIST_TAG \
    NPM_TOKEN OUT_DIR_REL DRY_RUN SKIP_INSTALL ALLOW_EXISTING; do
    [ -z "${!var:-}" ] || env_args+=("-e" "$var")
  done

  docker run --rm \
    -v "$FTP_REPO:/src" -w /src -u "$(id -u):$(id -g)" \
    -e HOME=/tmp/ftp-home -e npm_config_cache=/tmp/ftp-home/.npm \
    -e FTP_IN_DOCKER=1 -e DOCKER=0 \
    -e GIT_CONFIG_COUNT=1 -e GIT_CONFIG_KEY_0=safe.directory -e GIT_CONFIG_VALUE_0=/src \
    "${env_args[@]}" "$NODE_IMAGE" \
    bash -c 'mkdir -p "$HOME" && exec "$@"' -- bash "/src/$script_name" "$@"
}
