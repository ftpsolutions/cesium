# Publishing this fork to FTP Solutions' npm registry

This fork is consumed by `wireless-manager-front-end` as three npm packages off
our private registry, rather than as a submodule or a vendored copy.

```text
./build.sh   builds the fork and writes three tarballs to build_output/
./push.sh    publishes them to https://npm.ftp-kube-prod.ftpsolutions.com.au
```

TeamCity runs both, on every commit to `main`, from the **Cesium Fork** project
(DSL in `ims-mono/.teamcity/projects/cesium_fork/`).

## What gets published

| Published as                   | Is really               | From               |
| ------------------------------ | ----------------------- | ------------------ |
| `@ftpsolutions/cesium`         | `cesium` (the umbrella) | repo root          |
| `@ftpsolutions/cesium-engine`  | `@cesium/engine`        | `packages/engine`  |
| `@ftpsolutions/cesium-widgets` | `@cesium/widgets`       | `packages/widgets` |

All three, every time, at the same version.

Publishing the umbrella alone doesn't work: `Source/Cesium.js` is mostly
`export * from "@cesium/engine"`, so an umbrella from this fork paired with
upstream's engine gets you upstream's engine and none of our changes. This is the
same trap the front-end's `bun run cesium:link` exists to avoid locally.

### Why our own scope

The registry is a Verdaccio that proxies npmjs, so it already serves the real
`cesium` and `@cesium/*`. Publishing over those names would mean our versions and
upstream's share a package document, where a mistaken `latest` becomes everyone's
problem. Under `@ftpsolutions/*` there's nothing to collide with.

Consumers get the fork through an npm alias, so **no import ever changes**, and
it is **one line** - three packages published, one declared:

```jsonc
// package.json
"dependencies": {
  "cesium": "npm:@ftpsolutions/cesium@1.144.0-ftp.g6d5d8b1"
}
```

```ini
# .npmrc
@ftpsolutions:registry=https://npm.ftp-kube-prod.ftpsolutions.com.au
```

The alias _key_ is what lands in `node_modules`, so `node_modules/cesium` is our
fork and every `import { Viewer } from "cesium"` resolves exactly as it did
before. `build.sh` rewrites the umbrella's own dependencies into the same kind of
alias, pinned to the exact same version, so the installer places our engine and
widgets at `node_modules/@cesium/engine` and `node_modules/@cesium/widgets`
without anyone asking for them. Both npm and bun do this, verified against a real
Verdaccio.

> **Do not also declare `@cesium/engine` or `@cesium/widgets`.** It looks
> harmless - it's redundant when the versions agree - but it creates a second
> place to bump. Let one drift and you get **three** copies of the engine: the
> stale one you declared hoisted to the root, plus a correct one nested under
> `cesium/` and another under `@cesium/widgets/`. The two nested copies are what
> actually get bundled, as _separate module instances_, so `instanceof` starts
> failing across the boundary and there are two of every Cesium global. Worse,
> the front-end's `strip-pragma-loader` rule keys on the literal path
> `node_modules/@cesium` (`rspack.config.js:301`) and so only ever sees the stale
> root copy - the bundled ones keep their debug pragmas. Nothing errors; it just
> goes quietly wrong.
>
> The local `bun run cesium:link` path lands in the same place by a different
> route: it also links only the umbrella, but because a symlinked
> `node_modules/cesium` is resolved to its realpath, so the re-exports resolve
> against _this_ checkout's own workspace links rather than through any alias.
> That makes those links load bearing - a copied directory at
> `node_modules/@cesium/engine` here silently shadows `packages/engine`, which is
> why the front-end's script repairs them before linking.

### Versions

`<upstream version>-ftp.g<short sha>`, e.g. `1.144.0-ftp.g6d5d8b1`, so you can
read the commit straight off the version. A locally built one from a dirty tree
gets `.dirty` on the end.

Two consequences worth knowing:

- **It isn't ordered.** npm can't tell you which of two fork builds is newer, so
  consumers pin the exact version rather than a range. That's the trade for
  legibility.
- The `g` prefix is load bearing. A semver prerelease identifier that's all digits
  must not have a leading zero, and roughly one short sha in 300 is all digits
  starting with one; without the `g` those builds would be rejected at publish
  time.

The version is stamped into the workspaces _before_ the build, which is what puts
it into the generated `packages/engine/index.js` as `globalThis.CESIUM_VERSION` -
so a browser can tell you which build it's running. `build.sh` restores the
manifests on the way out; a build never leaves the checkout modified.

## Building locally

```bash
./build.sh                  # needs node >= 22
DOCKER=1 ./build.sh         # or build in node:22-bookworm instead
./build.sh --no-install     # keep the node_modules you've already got
./build.sh --no-build       # just repack what's in Build/ (same version only)
```

Under CI (`CI=true`) both scripts containerise themselves, so the agent needs
docker and nothing else.

`build.sh` runs `npm run build-release` and `npm run build-ts` - not plain
`build` - because the front-end's rspack config extracts the worker blob from the
_minified_ `Build/Cesium/Cesium.js`, and `bun run tsc` needs the `.d.ts` files. It
then checks the tarballs contain everything the front-end reaches for, and loads
the umbrella's bundles under both `NODE_ENV`s before calling it a day.

## Publishing

```bash
NPM_TOKEN=... ./push.sh
DRY_RUN=1 NPM_TOKEN=... ./push.sh   # everything except the publish
```

Auth is `NPM_TOKEN`, and only `NPM_TOKEN`. Get one with
`npm login --registry=https://npm.ftp-kube-prod.ftpsolutions.com.au --auth-type=legacy`
and copy the `_authToken` line out of `~/.npmrc`. Verdaccio's tokens are opaque
and don't expire.

There is deliberately no username/password path. Measured against Verdaccio:

- basic auth (`_auth`, or `username` + `_password`) **cannot publish** at all, and
  `npm whoami` decodes it locally rather than asking the server - so it reports a
  _wrong_ password as valid;
- a username and password can't be exchanged for a token either. That endpoint
  returns a token only for a user it has just **created**; for one that already
  exists it 409s. A password path would therefore work exactly once, on the run
  that silently registered the account.

After publishing, `push.sh` installs the umbrella from the registry into a scratch
project - one alias, exactly what a consumer writes - and checks that
`@cesium/engine` came with it and that `require("cesium")` works. That hoisting is
the whole reason a consumer pins one version instead of three.

Because the version is the commit sha, re-running a build for a commit that's
already published would hit a version conflict; CI sets `ALLOW_EXISTING=1` so a
re-run is a no-op rather than a red build.

## Consuming a new build in the front-end

Nothing updates automatically - the front-end pins an exact version. To move it
on, change the one `cesium` alias in `wireless-manager-front-end/package.json` to
the new version and run `bun install`. That's the whole update; engine and widgets
follow from the umbrella.

### Why not a single package

The obvious simplification is to publish one package with `@cesium/engine` and
`@cesium/widgets` bundled inside it via `bundleDependencies`. It doesn't work:
**bun ignores `bundleDependencies`.** It discards the tarball's nested
`node_modules`, goes to the registry for the bundled dependency, and the install
fails outright. npm honours it; bun 1.3.14 does not, and the front-end installs
with bun. Since the consumer only writes one line either way, there's nothing to
gain by trying.

The front-end's `bun run cesium:link` is still the right tool for iterating on the
fork itself: it links a working copy straight into the front-end's `node_modules`,
no publish involved.
