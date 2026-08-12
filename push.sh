#!/usr/bin/env bash
#
# Publish the tarballs ./build.sh left in build_output/ to FTP Solutions' private
# npm registry. This is what TeamCity runs after build.sh.
#
#   NPM_TOKEN=... ./push.sh              # publish
#   DRY_RUN=1 NPM_TOKEN=... ./push.sh    # everything except the upload
#
# NPM_TOKEN only - basic auth can't publish, and npm whoami validates it locally so
# a wrong password looks fine. Get one with
#   npm login --registry=<registry> --auth-type=legacy
#
# ALLOW_EXISTING=1 turns "already published" into a warning; CI sets it, since the
# version is the commit sha and a re-run should be a no-op.
#
set -euo pipefail

source "$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/ftp/common.sh"

NPM_DIST_TAG="${NPM_DIST_TAG:-latest}"
ALLOW_EXISTING="${ALLOW_EXISTING:-0}"

FORK_VERSION=""
WORK=""

cleanup() { [ -z "$WORK" ] || rm -rf "$WORK"; }

# .npmrc goes in a temp dir, never in the repo.
authenticate() {
  [ -n "${NPM_TOKEN:-}" ] || die "NPM_TOKEN is not set - see --help"

  WORK="$(mktemp -d)"
  trap cleanup EXIT
  {
    echo "registry=$NPM_REGISTRY"
    echo "//${NPM_REGISTRY#http*://}/:_authToken=$NPM_TOKEN"
    echo "$NPM_SCOPE:registry=$NPM_REGISTRY"
  } >"$WORK/npmrc"
  chmod 600 "$WORK/npmrc"

  # A token makes whoami a real round trip - fail here, not mid-publish.
  local whoami
  whoami="$(npm whoami --userconfig "$WORK/npmrc" --registry "$NPM_REGISTRY" 2>/dev/null || echo '')"
  [ -n "$whoami" ] || die "the registry rejected NPM_TOKEN - expired, or not for $NPM_REGISTRY?"
  say "$NPM_REGISTRY as $whoami"
}

publish_tarball() {
  local tgz="$1" name output
  name="$(basename "$tgz")"

  if [ "$DRY_RUN" = "1" ]; then
    say "$name (dry run)"
    npm publish "$tgz" --userconfig "$WORK/npmrc" --registry "$NPM_REGISTRY" \
      --tag "$NPM_DIST_TAG" --dry-run >/dev/null
    return
  fi

  say "publishing $name"
  if output="$(npm publish "$tgz" --userconfig "$WORK/npmrc" --registry "$NPM_REGISTRY" --tag "$NPM_DIST_TAG" 2>&1)"; then
    return
  fi
  printf '%s\n' "$output" >&2

  # Here-strings, not pipes: grep -q exits early and pipefail then reports SIGPIPE.
  # Verdaccio says E409/"already present", npmjs says EPUBLISHCONFLICT.
  if [ "$ALLOW_EXISTING" = "1" ] &&
    grep -qiE 'E409|EPUBLISHCONFLICT|already present|cannot publish over' <<<"$output"; then
    warn "$name is already published - carrying on (ALLOW_EXISTING=1)"
    return
  fi
  # The umbrella is ~23MB, ~32MB base64'd; Verdaccio defaults to 10mb and nginx to
  # 1MB. --dry-run never uploads, so nothing catches it earlier.
  if grep -qiE 'E413|too large' <<<"$output"; then
    die "$name was rejected as too large - raise max_body_size on the registry and the body limit on its ingress"
  fi
  die "failed to publish $name"
}

# Umbrella last: its deps are aliases at this exact version.
publish_all() {
  local entry suffix
  for entry in "${FTP_PACKAGES[@]}"; do
    IFS='|' read -r _ _ suffix <<<"$entry"
    publish_tarball "$FTP_OUT/$(ftp_tarball_name "$(ftp_published_name "$suffix")" "$FORK_VERSION")"
  done
}

# One alias, nothing else, and check the engine came with it - the hoisting is why a
# consumer pins one version instead of three.
smoke_test() {
  say "installing it the way a consumer would"
  local dir="$WORK/smoke"
  mkdir -p "$dir"

  # Scope only, npmjs as default - what a consumer writes. The publish npmrc sets
  # "registry=", which sends the umbrella's public deps here too, where they aren't.
  local consumer_npmrc="$WORK/npmrc-consumer"
  {
    echo "$NPM_SCOPE:registry=$NPM_REGISTRY"
    echo "//${NPM_REGISTRY#http*://}/:_authToken=$NPM_TOKEN"
  } >"$consumer_npmrc"
  chmod 600 "$consumer_npmrc"

  # Outside the repo: inside it, npm walks up and installs into the fork. Each step
  # checks itself - `set -e` doesn't apply in a subshell on the left of `||`, so a
  # failed install would otherwise run the checks and blame hoisting.
  (
    cd "$dir"
    npm init -y >/dev/null
    npm install --userconfig "$consumer_npmrc" \
      --no-audit --no-fund --loglevel error \
      "cesium@npm:$(ftp_published_name cesium)@$FORK_VERSION" ||
      die "installing $(ftp_published_name cesium)@$FORK_VERSION failed - see npm's output above"
    [ "$(node -p 'require("@cesium/engine/package.json").name')" = "$(ftp_published_name cesium-engine)" ] ||
      die "@cesium/engine did not resolve to our fork - the umbrella's alias isn't hoisting"
    NODE_ENV=production node -e 'require("cesium")' ||
      die "the published umbrella doesn't load under NODE_ENV=production"
  ) || die "the published packages do not install and load"
}

main() {
  local arg
  for arg in "$@"; do
    case "$arg" in
    -h | --help)
      ftp_usage "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) die "unknown argument: $arg" ;;
    esac
  done

  if [ "$DOCKER" = "1" ] && [ "${FTP_IN_DOCKER:-0}" != "1" ]; then
    ftp_reexec_in_docker "push.sh" "$@"
    return
  fi

  ftp_assert_node

  [ -f "$FTP_OUT/version.txt" ] || die "no $OUT_DIR_REL/version.txt - run ./build.sh first"
  FORK_VERSION="$(cat "$FTP_OUT/version.txt")"

  authenticate
  publish_all

  if [ "$DRY_RUN" = "1" ]; then
    say "dry run finished - nothing was published"
    return
  fi

  smoke_test
  cat <<EOF

Published $FORK_VERSION. ONE line in the consumer's package.json:

    "cesium": "npm:$(ftp_published_name cesium)@$FORK_VERSION"

and in its .npmrc:

    $NPM_SCOPE:registry=$NPM_REGISTRY
EOF
}

main "$@"
