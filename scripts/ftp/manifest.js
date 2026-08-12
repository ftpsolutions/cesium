// package.json surgery for ../../build.sh, so the bash stays orchestration.
//
//   stamp   <version> <manifest...>
//       Version only. Runs BEFORE the build, so scripts/build.js bakes it into
//       packages/engine/index.js as globalThis.CESIUM_VERSION. Not the name: gulp
//       resolves the workspaces by their real @cesium/* names.
//
//   publish <manifest> <published-name> <version> <upstream-version>
//       The rename, after the build and before npm pack. Needs NPM_SCOPE and
//       NPM_REGISTRY; reads FTP_COMMIT / FTP_BRANCH for provenance.

import { readFileSync, writeFileSync } from "node:fs";

const WORKSPACES = ["@cesium/engine", "@cesium/widgets"];
const [command, ...args] = process.argv.slice(2);

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const write = (path, m) =>
  writeFileSync(path, `${JSON.stringify(m, null, 2)}\n`);

// The alias key stays the upstream name, so the package still lands at
// node_modules/@cesium/engine and every `from "@cesium/engine"` keeps resolving.
// Only where it is fetched from changes.
const alias = (name, version) =>
  `npm:${process.env.NPM_SCOPE}/${name.replace("@cesium/", "cesium-")}@${version}`;

const setWorkspaceRanges = (manifest, value) => {
  for (const field of ["dependencies", "peerDependencies"]) {
    for (const name of WORKSPACES) {
      if (manifest[field]?.[name]) {
        manifest[field][name] = value(name);
      }
    }
  }
};

if (command === "stamp") {
  const [version, ...manifests] = args;
  for (const path of manifests) {
    const manifest = read(path);
    manifest.version = version;
    setWorkspaceRanges(manifest, () => version);
    write(path, manifest);
  }
} else if (command === "publish") {
  const [path, publishedName, version, upstreamVersion] = args;
  const manifest = read(path);
  const upstreamName = manifest.name;

  manifest.name = publishedName;
  manifest.version = version;
  setWorkspaceRanges(manifest, (name) => alias(name, version));

  // publishConfig so nothing here can reach npmjs. devDependencies and scripts
  // because a consumer never uses them - and dropping scripts is also what stops
  // npm pack running this repo's `prepare`, which ends in `playwright install`.
  // workspaces because a package manager walking node_modules/cesium/package.json
  // would otherwise think it found a workspace root. overrides because it is only
  // honoured in the root project and half of what it pins we just deleted.
  manifest.publishConfig = { registry: process.env.NPM_REGISTRY };
  delete manifest.devDependencies;
  delete manifest.scripts;
  delete manifest.workspaces;
  delete manifest.overrides;

  manifest.ftpFork = {
    upstreamName,
    upstreamVersion,
    commit: process.env.FTP_COMMIT || null,
    branch: process.env.FTP_BRANCH || null,
  };

  write(path, manifest);
  console.log(`  ${upstreamName} -> ${manifest.name}@${manifest.version}`);
} else {
  throw new Error("manifest.js: expected 'stamp' or 'publish'");
}
