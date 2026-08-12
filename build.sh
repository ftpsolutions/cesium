#!/usr/bin/env bash
#
# Build this fork into the three npm tarballs ./push.sh sends to FTP Solutions'
# private registry. This is what TeamCity runs.
#
#   ./build.sh                  # build with your own node (>= 22)
#   DOCKER=1 ./build.sh         # build in node:22-bookworm instead (CI does this)
#   ./build.sh --no-install     # keep the node_modules you've already got
#
# Out into build_output/, all at the same version:
#
#   @ftpsolutions/cesium-engine    packages/engine
#   @ftpsolutions/cesium-widgets   packages/widgets
#   @ftpsolutions/cesium           the umbrella
#
# All three, not one: the umbrella is re-exports and almost no code, so alone it
# pairs our front half with upstream's engine.
#
# Version is <upstream>-ftp.g<short sha>; COMMIT_HASH names the commit, FORK_VERSION
# overrides it. See PUBLISHING.md.
#
set -euo pipefail

source "$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/ftp/common.sh"

SKIP_INSTALL="${SKIP_INSTALL:-0}"
FORK_VERSION=""
UPSTREAM_VERSION=""
MANIFESTS=()

restore_manifests() {
  local manifest
  for manifest in "${MANIFESTS[@]}"; do
    [ ! -f "$manifest.ftp_orig" ] || mv -f "$manifest.ftp_orig" "$manifest"
  done
}

# What follows edits the three package.json files in place - back up, restore on exit.
begin_manifest_edits() {
  local entry dir manifest
  for entry in "${FTP_PACKAGES[@]}"; do
    IFS='|' read -r dir _ _ <<<"$entry"
    MANIFESTS+=("$FTP_REPO/$dir/package.json")
  done

  trap restore_manifests EXIT
  for manifest in "${MANIFESTS[@]}"; do
    cp -p "$manifest" "$manifest.ftp_orig"
  done
}

# --ignore-scripts: the root `prepare` ends in `playwright install --with-deps`. The
# build needs nothing from a lifecycle script.
install_dependencies() {
  if [ "$SKIP_INSTALL" = "1" ]; then
    [ -x "$FTP_REPO/node_modules/.bin/gulp" ] || die "--no-install but node_modules isn't installed"
    return
  fi
  say "installing dependencies"
  npm install --ignore-scripts --no-audit --no-fund
}

# build-release, not build: the front-end greps its worker blob out of the MINIFIED
# Build/Cesium/Cesium.js. build-ts gives us the .d.ts files.
build_fork() {
  say "stamping $FORK_VERSION and building - takes a few minutes"
  node "$FTP_SCRIPTS/manifest.js" stamp "$FORK_VERSION" "${MANIFESTS[@]}"
  npm run build-release
  npm run build-ts
}

# Checked on the tree npm pack is about to read. Keep in step with the front-end's
# cesium_fork.sh.
assert_build_artifacts() {
  local rel required=(
    index.cjs
    Source/Cesium.js
    Source/Cesium.d.ts
    Source/Widgets/widgets.css
    Build/Cesium/Cesium.js
    Build/Cesium/index.cjs
    Build/Cesium/Assets
    Build/Cesium/ThirdParty
    Build/Cesium/Widgets
    Build/CesiumUnminified/index.cjs
    packages/engine/index.js
    packages/engine/index.d.ts
    packages/widgets/index.js
    packages/widgets/index.d.ts
  )
  for rel in "${required[@]}"; do
    [ -e "$FTP_REPO/$rel" ] || die "the build didn't produce '$rel'"
  done

  # The pattern the front-end greps for - proof build-release, not build, ran.
  grep -q 'globalThis\.CESIUM_WORKERS=atob("' "$FTP_REPO/Build/Cesium/Cesium.js" ||
    die "no CESIUM_WORKERS blob in Build/Cesium/Cesium.js - it looks unminified"

  # The stamp has to reach the generated code, or a browser reports the wrong build.
  grep -q "CESIUM_VERSION = \"$FORK_VERSION\"" "$FTP_REPO/packages/engine/index.js" ||
    die "packages/engine/index.js wasn't built at $FORK_VERSION"
}

# Rename in the tree, then pack - npm works out the file list and tarball names
# itself. Per-directory rather than --workspace, which would drag in sandcastle.
pack() {
  rm -rf "$FTP_OUT"
  mkdir -p "$FTP_OUT"

  local entry dir suffix
  for entry in "${FTP_PACKAGES[@]}"; do
    IFS='|' read -r dir _ suffix <<<"$entry"
    node "$FTP_SCRIPTS/manifest.js" publish \
      "$FTP_REPO/$dir/package.json" "$(ftp_published_name "$suffix")" \
      "$FORK_VERSION" "$UPSTREAM_VERSION"
    (cd "$FTP_REPO/$dir" && npm pack --pack-destination "$FTP_OUT" >/dev/null)
  done

  printf '%s\n' "$FORK_VERSION" >"$FTP_OUT/version.txt"
}

# Load the bundles the way node would - self-contained, so no node_modules needed;
# proves they aren't truncated. Both NODE_ENVs, since index.cjs picks between them.
verify() {
  local dir node_env
  dir="$(mktemp -d)"
  tar -xzf "$FTP_OUT/$(ftp_tarball_name "$(ftp_published_name cesium)" "$FORK_VERSION")" -C "$dir"

  for node_env in development production; do
    NODE_ENV="$node_env" node -e '
      if (!require(process.argv[1]).Cartesian3) {
        throw new Error("the bundle loaded but has no Cartesian3 on it");
      }
      console.log(`  ${process.env.NODE_ENV}: loads, CESIUM_VERSION=${globalThis.CESIUM_VERSION}`);
    ' "$dir/package/index.cjs" || die "the umbrella tarball fails to load under NODE_ENV=$node_env"
  done

  rm -rf "$dir"
}

main() {
  local arg
  for arg in "$@"; do
    case "$arg" in
    --no-install) SKIP_INSTALL=1 ;;
    -h | --help)
      ftp_usage "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *) die "unknown argument: $arg" ;;
    esac
  done
  export SKIP_INSTALL

  if [ "$DOCKER" = "1" ] && [ "${FTP_IN_DOCKER:-0}" != "1" ]; then
    ftp_reexec_in_docker "build.sh" "$@"
    return
  fi

  ftp_assert_node
  cd "$FTP_REPO"

  UPSTREAM_VERSION="$(ftp_upstream_version)"
  FORK_VERSION="$(ftp_fork_version)"
  FTP_COMMIT="$(ftp_commit_sha)"
  # TeamCity passes BRANCH - agent checkouts are detached, so the fallback is local-only.
  FTP_BRANCH="${BRANCH:-$(git -C "$FTP_REPO" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')}"
  FTP_BRANCH="${FTP_BRANCH#refs/heads/}"
  export FORK_VERSION FTP_COMMIT FTP_BRANCH

  say "$FTP_REPO @ ${FTP_COMMIT:0:7} -> $FORK_VERSION"

  install_dependencies
  begin_manifest_edits
  build_fork
  assert_build_artifacts
  pack
  verify

  say "built $FORK_VERSION"
  ls -la "$FTP_OUT"
  cat <<EOF

Publish with ./push.sh, then point a consumer at it with ONE alias:

    "cesium": "npm:$(ftp_published_name cesium)@$FORK_VERSION"

Not @cesium/engine or @cesium/widgets too - the umbrella pins those and the
installer hoists them; a second declaration that drifts gives you three engines.
EOF
}

main "$@"
