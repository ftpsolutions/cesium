# Sandcastle fork

Deploys `custom-sandcastles` branch to `sandcastle.ftp-kube-prod.ftpsolutions.com.au`.
Manifests: `ims-master-servers-ftp-internal/.../applications/sandcastle`.

## Build & push

```bash
PLATFORM=linux/amd64 ./deploy/build-image.sh
docker push registry.ftp-kube-prod.ftpsolutions.com.au/cesium-sandcastle:latest
kubectl -n sandcastle rollout restart deploy/sandcastle # from ftp-kube-prod/argo
```

## Dev loop

```bash
npm install && npx gulp buildRelease && npx gulp buildTs
cd packages/sandcastle && npm run dev-no-embedding
```

Edit → click Run. HMR off.

## Add demo

```bash
cd packages/sandcastle && npm run create-demo my-slug
```

Set `development: false` in its yaml.

## Perf kit

`templates/PerfKit.js` → `import { createPerfKit } from "PerfKit"`.
