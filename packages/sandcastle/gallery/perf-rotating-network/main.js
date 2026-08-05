import * as Cesium from "cesium";

function createPerfKit(options = {}) {
  const {
    assetCount = 500,
    connectionCount = 5000,
    centre = { longitude: 129.928981, latitude: -20.529684, height: 100 },
    distributionRadius = 100_000,
    seed = 12345,
    showLabels = true,
    movingFraction = 0.7,
    movementRadius = 1_500,
    movementSpeed = 0.1,
    colourChangeIntervalSeconds = 0.5,
    assetColourChangePercentage = 0.5,
    connectionColourChangePercentage = 0.1,
    connectionRewireIntervalSeconds = 1,
    connectionRewireFraction = 0.1,
  } = options;

  function createRandomGenerator(seed) {
    let value = seed >>> 0;
    return function random() {
      value += 0x6d2b79f5;
      let r = value;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createDistributedPositions(count, radius) {
    const positions = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < count; index += 1) {
      const normalizedRadius = Math.sqrt((index + 0.5) / count);
      const distance = normalizedRadius * radius;
      const angle = index * goldenAngle;
      positions.push(
        new Cesium.Cartesian3(
          Math.cos(angle) * distance,
          Math.sin(angle) * distance,
          (index % 5) * 2,
        ),
      );
    }
    return positions;
  }

  function getRandomColor(random, alpha = 1) {
    return new Cesium.Color(
      0.35 + random() * 0.65,
      0.35 + random() * 0.65,
      0.35 + random() * 0.65,
      alpha,
    );
  }
  function svgDataUri(svg) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const ASSET_BODY_IMAGE = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" fill="none" preserveAspectRatio="xMidYMid meet">
    <path d="M 50 92 C 26.9 84 8 68 8 45 A 42 42 0 1 1 92 45 C 92 68 73.1 84 50 92 Z" fill="#5a5a5b" />
    <circle cx="50" cy="45" r="35.7" fill="#fff" />
<svg xmlns="http://www.w3.org/2000/svg" fill='#58595b' stroke='#58595b' width="60" height="60" y="16" x="20" viewBox="0 0 512 512">
    <g>
        <path d="M169.923 351.325c20.494 0 38.256-16.396 38.256-38.257 0-20.494-16.395-38.256-38.256-38.256s-38.257 16.396-38.257 38.256c0 20.495 16.396 36.89 38.257 38.257zm0-112.037c40.989 0 72.414 32.791 72.414 73.78 0 40.99-32.791 72.415-73.78 72.415-39.623 0-72.415-32.792-72.415-73.78 0-39.624 32.792-72.415 73.78-72.415zM507.4 254.634L506.034 256l-28.693 53.286s-1.366 1.366-1.366 2.732c-1.366-28.692-13.663-50.553-35.524-66.948-19.128-13.663-39.623-19.129-62.85-16.396-49.187 5.465-84.71 51.92-75.147 102.473h-47.82c4.099-30.059-4.1-56.019-24.594-77.88 5.465 1.367 10.93 2.733 15.03 4.1 12.296 4.098 24.593 6.83 36.89 10.93 1.366 0 2.732 0 2.732-1.367 23.228-34.157 46.455-69.681 68.316-103.839 1.366-1.366 2.732-2.732 4.099-2.732h91.542c1.366 0 2.732 0 4.099 1.366 9.564 13.663 19.128 25.96 27.326 39.623 1.366 1.366 1.366 1.366 2.732 1.366h20.495c4.099 17.762 4.099 34.158 4.099 51.92z" />
        <path d="M475.975 126.201v23.227H346.176c-2.733 0-2.733 1.367-4.099 2.733-21.86 34.157-42.355 69.681-64.216 103.839 0 0-1.366 1.366-1.366 2.733-4.1-1.367-9.565-2.733-13.663-4.1C178.12 224.576 92.043 197.25 5.966 168.558H4.6l1.366-1.367c8.198-13.663 16.396-25.96 23.227-39.623v-1.366h446.782zM153.527 228.674c-9.564 2.733-17.762 5.465-25.96 9.564-8.197 4.099-15.029 10.93-21.86 17.762-9.565-17.762-19.129-35.524-30.06-54.652 25.96 9.564 51.92 17.762 77.88 27.326zm236.598 123.928c20.494 0 38.256-16.396 38.256-38.257 0-20.494-16.396-38.256-38.256-38.256-21.861 0-38.257 16.395-38.257 38.256 0 20.495 16.396 36.89 38.257 38.257zm0-112.037c40.989 0 72.414 32.791 72.414 73.78 0 40.99-32.792 72.414-73.78 72.414-39.624 0-72.415-32.79-72.415-73.78 0-39.623 32.791-72.414 73.78-72.414z" />
    </g>
    </svg>
</svg>
`);
  const LEFT_CIRCLE_IMAGE = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
  <circle cx="12" cy="12" r="9" fill="#34a853" stroke="white" stroke-width="3"/>
</svg>
`);
  const RIGHT_CIRCLE_IMAGE = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">
  <circle cx="12" cy="12" r="9" fill="#fbbc04" stroke="white" stroke-width="3"/>
</svg>
`);

  function addAssetVisual({
    billboards,
    labels,
    position,
    assetNumber,
    images = {},
  }) {
    const bodyImage = images.body ?? ASSET_BODY_IMAGE;
    const leftImage = images.left ?? LEFT_CIRCLE_IMAGE;
    const rightImage = images.right ?? RIGHT_CIRCLE_IMAGE;
    const labelDefaults = {
      font: "12px sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500_000),
      disableDepthTestDistance: 100_000,
    };
    const body = billboards.add({
      id: { type: "asset", assetNumber },
      position,
      image: bodyImage,
      width: 36,
      height: 42,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      disableDepthTestDistance: 100_000,
    });
    const mainLabel = showLabels
      ? labels.add({
          ...labelDefaults,
          position,
          text: `Asset ${assetNumber}`,
          pixelOffset: new Cesium.Cartesian2(0, -52),
          font: "13px sans-serif",
        })
      : undefined;
    const leftCircle = billboards.add({
      id: { type: "asset-circle", side: "left", assetNumber },
      position,
      image: leftImage,
      width: 16,
      height: 16,
      pixelOffset: new Cesium.Cartesian2(-23, -18),
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      disableDepthTestDistance: 100_000,
    });
    const leftLabel = showLabels
      ? labels.add({
          ...labelDefaults,
          position,
          text: "A",
          pixelOffset: new Cesium.Cartesian2(-23, 3),
          font: "10px sans-serif",
        })
      : undefined;
    const rightCircle = billboards.add({
      id: { type: "asset-circle", side: "right", assetNumber },
      position,
      image: rightImage,
      width: 16,
      height: 16,
      pixelOffset: new Cesium.Cartesian2(23, -18),
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      disableDepthTestDistance: 100_000,
    });
    const rightLabel = showLabels
      ? labels.add({
          ...labelDefaults,
          position,
          text: "B",
          pixelOffset: new Cesium.Cartesian2(23, 3),
          font: "10px sans-serif",
        })
      : undefined;
    return { body, mainLabel, leftCircle, leftLabel, rightCircle, rightLabel };
  }
  function setAssetVisualPosition(visual, position) {
    visual.body.position = position;
    if (visual.mainLabel) {
      visual.mainLabel.position = position;
    }
    visual.leftCircle.position = position;
    if (visual.leftLabel) {
      visual.leftLabel.position = position;
    }
    visual.rightCircle.position = position;
    if (visual.rightLabel) {
      visual.rightLabel.position = position;
    }
  }

  function installFrameTimeLogger(viewer, options = {}) {
    const opts =
      typeof options === "number" ? { intervalMs: options } : options;
    const {
      intervalMs = 5000,
      hud = true,
      hudParent = viewer.container,
      maxSamples = 200_000,
      autoLog = true,
      name = "sandcastle",
    } = opts;
    const startedAt = new Date().toISOString();
    const percentile = (sorted, p) => {
      const i = Math.ceil(p * sorted.length) - 1;
      return Math.round(sorted[Math.max(0, i)] * 100) / 100;
    };
    const rowFromSamples = (samples) => {
      const sorted = [...samples].sort((a, b) => a - b);
      return {
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
        samples: samples.length,
      };
    };
    const cpuSamples = [];
    const cpuTimestampsMs = [];
    const gpuSamples = [];
    const gpuTimestampsMs = [];
    let disjointEventTotal = 0;
    let latestCpuP95 = null;
    let latestGpuP95 = null;
    const pushSample = (value, timeMs, values, timestamps) => {
      values.push(value);
      timestamps.push(timeMs);
      if (values.length > maxSamples) {
        const drop = values.length - maxSamples;
        values.splice(0, drop);
        timestamps.splice(0, drop);
      }
    };
    const gl = viewer.scene.canvas.getContext("webgl2");
    const ext = gl && gl.getExtension("EXT_disjoint_timer_query_webgl2");
    let gpuTimer = null;
    if (ext) {
      const pool = [];
      const pending = [];
      let active = null;
      let activeStartMs = 0;
      let batchDisjoint = 0;
      gpuTimer = {
        beginFrame() {
          if (active !== null) {
            return;
          }
          const q = pool.pop() ?? gl.createQuery();
          if (!q) {
            return;
          }
          gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
          active = q;
          activeStartMs = performance.now();
        },
        endFrame() {
          if (active === null) {
            return;
          }
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          pending.push({ query: active, timeMs: activeStartMs });
          active = null;
        },
        drain() {
          while (pending.length > 0) {
            const head = pending[0];
            if (!gl.getQueryParameter(head.query, gl.QUERY_RESULT_AVAILABLE)) {
              break;
            }
            pending.shift();
            const ms =
              gl.getQueryParameter(head.query, gl.QUERY_RESULT) / 1_000_000;
            pushSample(ms, head.timeMs, gpuSamples, gpuTimestampsMs);
            pool.push(head.query);
          }
          if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
            batchDisjoint++;
            for (const p of pending) {
              pool.push(p.query);
            }
            pending.length = 0;
          }
          const disjointEvents = batchDisjoint;
          batchDisjoint = 0;
          return disjointEvents;
        },
      };
    } else if (autoLog) {
      console.log(
        "[frame] GPU timer unavailable (need Chromium desktop + WebGL2)",
      );
    }
    let frameStartTime = null;
    const onPreUpdate = () => {
      frameStartTime = performance.now();
    };
    const onPreRender = () => gpuTimer?.beginFrame();
    const onPostRender = () => {
      gpuTimer?.endFrame();
      if (frameStartTime === null) {
        return;
      }
      pushSample(
        performance.now() - frameStartTime,
        frameStartTime,
        cpuSamples,
        cpuTimestampsMs,
      );
      frameStartTime = null;
    };
    viewer.scene.preUpdate.addEventListener(onPreUpdate);
    viewer.scene.preRender.addEventListener(onPreRender);
    viewer.scene.postRender.addEventListener(onPostRender);
    let hudEls = null;
    function mountHud(parent) {
      if (hudEls) {
        return;
      }
      const container = parent ?? hudParent;
      if (!container || !container.appendChild) {
        return;
      }
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;bottom:40px;right:10px;z-index:1000;" +
        "padding:8px 10px;background:rgba(0,0,0,0.72);color:#fff;" +
        "font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;" +
        "border-radius:6px;min-width:180px;pointer-events:auto;" +
        "box-shadow:0 2px 8px rgba(0,0,0,0.4);";
      el.innerHTML =
        `<div style="opacity:.7;margin-bottom:4px;">frame times (last ${Math.round(
          intervalMs / 1000,
        )}s)</div>` +
        `<div>CPU p95: <b data-hud="cpu">—</b> ms</div>` +
        `<div>GPU p95: <b data-hud="gpu">—</b> ms</div>` +
        `<div style="opacity:.7;margin-top:4px;">frames: <span data-hud="frames">0</span></div>` +
        `<button data-hud="download" style="margin-top:8px;width:100%;padding:4px 8px;font:inherit;cursor:pointer;">⬇ Download logs</button>`;
      container.appendChild(el);
      const q = (s) => el.querySelector(s);
      hudEls = {
        root: el,
        cpu: q('[data-hud="cpu"]'),
        gpu: q('[data-hud="gpu"]'),
        frames: q('[data-hud="frames"]'),
        download: q('[data-hud="download"]'),
      };
      hudEls.download.addEventListener("click", () => downloadLogs());
    }
    function unmountHud() {
      if (!hudEls) {
        return;
      }
      hudEls.root.remove();
      hudEls = null;
    }
    function updateHud() {
      if (!hudEls) {
        return;
      }
      hudEls.cpu.textContent =
        latestCpuP95 !== null ? latestCpuP95.toFixed(2) : "—";
      hudEls.gpu.textContent =
        latestGpuP95 !== null ? latestGpuP95.toFixed(2) : "—";
      hudEls.frames.textContent = String(cpuSamples.length);
    }
    const timerId = setInterval(() => {
      if (gpuTimer) {
        const disjointEvents = gpuTimer.drain();
        disjointEventTotal += disjointEvents;
        if (disjointEvents > 0 && autoLog) {
          console.log(`[frame] gpu disjoint events: ${disjointEvents}`);
        }
      }
      const cutoff = performance.now() - intervalMs;
      const takeWindow = (values, timestamps) => {
        const window = [];
        for (let i = timestamps.length - 1; i >= 0; i -= 1) {
          if (timestamps[i] < cutoff) {
            break;
          }
          window.push(values[i]);
        }
        return window;
      };
      const cpuWindow = takeWindow(cpuSamples, cpuTimestampsMs);
      const gpuWindow = takeWindow(gpuSamples, gpuTimestampsMs);
      const rows = {};
      if (cpuWindow.length > 0) {
        const r = rowFromSamples(cpuWindow);
        latestCpuP95 = r.p95;
        rows.cpu_ms = r;
      }
      if (gpuWindow.length > 0) {
        const r = rowFromSamples(gpuWindow);
        latestGpuP95 = r.p95;
        rows.gpu_ms = r;
      }
      if (autoLog && Object.keys(rows).length > 0) {
        console.table(rows);
      }
      updateHud();
    }, intervalMs);
    async function downloadLogs() {
      const payload = {
        name,
        startedAt,
        finishedAt: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        intervalMs,
        disjointEvents: disjointEventTotal,
        cpu: {
          samplesMs: cpuSamples.slice(),
          timestampsMs: cpuTimestampsMs.slice(),
        },
        gpu: {
          samplesMs: gpuSamples.slice(),
          timestampsMs: gpuTimestampsMs.slice(),
        },
      };
      const json = JSON.stringify(payload);
      const gzipSupported = typeof CompressionStream === "function";
      let blob;
      if (gzipSupported) {
        const stream = new Blob([json])
          .stream()
          .pipeThrough(new CompressionStream("gzip"));
        blob = await new Response(stream).blob();
      } else {
        blob = new Blob([json], { type: "application/json" });
      }
      const stamp = startedAt.replace(/[:.]/g, "-");
      const safeName = String(name).replace(/[^a-zA-Z0-9_-]+/g, "_");
      const filename = gzipSupported
        ? `${safeName}-${stamp}.json.gz`
        : `${safeName}-${stamp}.json`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    function stop() {
      clearInterval(timerId);
      viewer.scene.preUpdate.removeEventListener(onPreUpdate);
      viewer.scene.preRender.removeEventListener(onPreRender);
      viewer.scene.postRender.removeEventListener(onPostRender);
      unmountHud();
    }
    if (hud) {
      mountHud();
    }
    return {
      stop,
      downloadLogs,
      mountHud,
      unmountHud,
      getLatest: () => ({
        cpuP95: latestCpuP95,
        gpuP95: latestGpuP95,
        frames: cpuSamples.length,
      }),
    };
  }

  const random = createRandomGenerator(seed);
  const centreWorld = Cesium.Cartesian3.fromDegrees(
    centre.longitude,
    centre.latitude,
    centre.height,
  );
  const localToWorld = Cesium.Transforms.eastNorthUpToFixedFrame(centreWorld);

  const basePositions = createDistributedPositions(
    assetCount,
    distributionRadius,
  );
  const assets = basePositions.map((basePosition, index) => ({
    index,
    basePosition,
    position: Cesium.Cartesian3.clone(basePosition),
    color: getRandomColor(random),
    _phase: random() * Cesium.Math.TWO_PI,
    _speed: 0.6 + random() * 0.8,
    _radius: 300 + random() * movementRadius,
  }));

  const connections = [];
  const connectionsByAssetIndex = Array.from({ length: assetCount }, () => []);
  const connectionKeys = new Set();
  const targetConnectionCount = Math.min(
    connectionCount,
    Math.floor((assetCount * (assetCount - 1)) / 2),
  );
  function pickPair() {
    const a = Math.floor(random() * assetCount);
    const b = Math.floor(random() * assetCount);
    if (a === b) {
      return null;
    }
    return [Math.min(a, b), Math.max(a, b)];
  }
  while (connections.length < targetConnectionCount) {
    const pair = pickPair();
    if (!pair) {
      continue;
    }
    const [startIndex, endIndex] = pair;
    const key = `${startIndex}:${endIndex}`;
    if (connectionKeys.has(key)) {
      continue;
    }
    connectionKeys.add(key);
    const connection = {
      index: connections.length,
      startAssetIndex: startIndex,
      endAssetIndex: endIndex,
      color: getRandomColor(random, 0.35),
      _key: key,
    };
    connections.push(connection);
    connectionsByAssetIndex[startIndex].push(connection.index);
    connectionsByAssetIndex[endIndex].push(connection.index);
  }

  const movingAssetIndexes = new Set();
  const movingCount = Math.round(assetCount * movingFraction);
  while (movingAssetIndexes.size < movingCount) {
    movingAssetIndexes.add(Math.floor(random() * assetCount));
  }

  let lastColourElapsed = null;
  let lastRewireElapsed = null;
  const scratchPosition = new Cesium.Cartesian3();

  function tick(elapsedSeconds) {
    const movedAssets = new Set();
    const recolouredAssets = new Set();
    const recolouredConnections = new Set();
    const rewiredConnections = new Set();

    for (const assetIndex of movingAssetIndexes) {
      const asset = assets[assetIndex];
      const angle =
        asset._phase + elapsedSeconds * movementSpeed * asset._speed;
      scratchPosition.x =
        asset.basePosition.x + Math.cos(angle) * asset._radius;
      scratchPosition.y =
        asset.basePosition.y + Math.sin(angle * 0.73) * asset._radius * 0.65;
      scratchPosition.z =
        asset.basePosition.z + 15 + Math.sin(angle * 1.4) * 15;
      if (
        asset.position.x !== scratchPosition.x ||
        asset.position.y !== scratchPosition.y ||
        asset.position.z !== scratchPosition.z
      ) {
        Cesium.Cartesian3.clone(scratchPosition, asset.position);
        movedAssets.add(assetIndex);
      }
    }

    if (lastColourElapsed === null) {
      lastColourElapsed = elapsedSeconds;
    }
    if (elapsedSeconds - lastColourElapsed >= colourChangeIntervalSeconds) {
      lastColourElapsed = elapsedSeconds;
      const assetChurn = Math.ceil(assetCount * assetColourChangePercentage);
      for (let i = 0; i < assetChurn; i += 1) {
        const idx = Math.floor(random() * assetCount);
        assets[idx].color = getRandomColor(random);
        recolouredAssets.add(idx);
      }
      const lineChurn = Math.ceil(
        connections.length * connectionColourChangePercentage,
      );
      for (let i = 0; i < lineChurn; i += 1) {
        const idx = Math.floor(random() * connections.length);
        connections[idx].color = getRandomColor(random, 0.35);
        recolouredConnections.add(idx);
      }
    }

    if (lastRewireElapsed === null) {
      lastRewireElapsed = elapsedSeconds;
    }
    if (elapsedSeconds - lastRewireElapsed >= connectionRewireIntervalSeconds) {
      lastRewireElapsed = elapsedSeconds;
      const rewireCount = Math.ceil(
        connections.length * connectionRewireFraction,
      );
      for (let i = 0; i < rewireCount; i += 1) {
        const connection =
          connections[Math.floor(random() * connections.length)];
        let pair = null;
        let newKey = null;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          const candidate = pickPair();
          if (!candidate) {
            continue;
          }
          const key = `${candidate[0]}:${candidate[1]}`;
          if (connectionKeys.has(key)) {
            continue;
          }
          pair = candidate;
          newKey = key;
          break;
        }
        if (!pair) {
          continue;
        }
        const removeFrom = (arr) => {
          const at = arr.indexOf(connection.index);
          if (at !== -1) {
            arr.splice(at, 1);
          }
        };
        removeFrom(connectionsByAssetIndex[connection.startAssetIndex]);
        removeFrom(connectionsByAssetIndex[connection.endAssetIndex]);
        connectionKeys.delete(connection._key);
        connectionKeys.add(newKey);
        connection._key = newKey;
        connection.startAssetIndex = pair[0];
        connection.endAssetIndex = pair[1];
        connectionsByAssetIndex[pair[0]].push(connection.index);
        connectionsByAssetIndex[pair[1]].push(connection.index);
        rewiredConnections.add(connection.index);
      }
    }

    return {
      movedAssets,
      recolouredAssets,
      recolouredConnections,
      rewiredConnections,
    };
  }

  const model = {
    centreWorld,
    localToWorld,
    distributionRadius,
    movementRadius,
    assets,
    connections,
    movingAssetIndexes,
    connectionsByAssetIndex,
    tick,
  };

  return {
    model,
    showLabels,
    createRandomGenerator,
    createDistributedPositions,
    addAssetVisual,
    setAssetVisualPosition,
    installFrameTimeLogger,
    getRandomColor,
    svgDataUri,
    ASSET_BODY_IMAGE,
    LEFT_CIRCLE_IMAGE,
    RIGHT_CIRCLE_IMAGE,
  };
}

const {
  addAssetVisual,
  createDistributedPositions,
  createRandomGenerator,
  installFrameTimeLogger,
  setAssetVisualPosition,
} = createPerfKit();

const viewer = new Cesium.Viewer("cesiumContainer");

const ASSET_COUNT = 516;
const CONNECTION_COUNT = 4762;
const DISTRIBUTION_RADIUS_METERS = 100_0000;

const centreLongitude = 129.928981;
const centreLatitude = -20.529684;
const centreHeight = 100;

// How fast the whole pattern spins around the centre.
// One full rotation every 120 seconds of clock/timeline time.
const ANGULAR_SPEED_RADIANS_PER_SECOND = (2 * Math.PI) / 120;

const localToWorld = Cesium.Transforms.eastNorthUpToFixedFrame(
  Cesium.Cartesian3.fromDegrees(centreLongitude, centreLatitude, centreHeight),
);

const billboards = viewer.scene.primitives.add(
  new Cesium.BillboardCollection({ modelMatrix: localToWorld }),
);
const labels = viewer.scene.primitives.add(
  new Cesium.LabelCollection({ modelMatrix: localToWorld }),
);
const polylines = viewer.scene.primitives.add(
  new Cesium.PolylineCollection({ modelMatrix: localToWorld }),
);

const basePositions = createDistributedPositions(
  ASSET_COUNT,
  DISTRIBUTION_RADIUS_METERS,
);
const currentPositions = basePositions.map((p) => Cesium.Cartesian3.clone(p));

const assetRecords = [];
for (let index = 0; index < ASSET_COUNT; index += 1) {
  const visual = addAssetVisual({
    billboards,
    labels,
    position: currentPositions[index],
    assetNumber: index + 1,
  });
  assetRecords.push({
    ...visual,
    basePosition: basePositions[index],
    currentPosition: currentPositions[index],
  });
}

const random = createRandomGenerator(12345);
const existingConnections = new Set();
const connectionRecords = [];

while (existingConnections.size < CONNECTION_COUNT) {
  const firstIndex = Math.floor(random() * ASSET_COUNT);
  const secondIndex = Math.floor(random() * ASSET_COUNT);
  if (firstIndex === secondIndex) {
    continue;
  }

  const startIndex = Math.min(firstIndex, secondIndex);
  const endIndex = Math.max(firstIndex, secondIndex);
  const key = `${startIndex}:${endIndex}`;
  if (existingConnections.has(key)) {
    continue;
  }
  existingConnections.add(key);

  const polyline = polylines.add({
    id: {
      type: "connection",
      startAssetNumber: startIndex + 1,
      endAssetNumber: endIndex + 1,
    },
    positions: [currentPositions[startIndex], currentPositions[endIndex]],
    width: 1.5,
    material: Cesium.Material.fromType("Color", {
      color: Cesium.Color.GREEN.withAlpha(0.25),
    }),
  });

  connectionRecords.push({ polyline, startIndex, endIndex });
}

const centreWorldPosition = Cesium.Cartesian3.fromDegrees(
  centreLongitude,
  centreLatitude,
  centreHeight,
);
const boundingSphere = new Cesium.BoundingSphere(
  centreWorldPosition,
  DISTRIBUTION_RADIUS_METERS,
);
viewer.scene.debugShowFramesPerSecond = true;
viewer.camera.flyToBoundingSphere(boundingSphere, {
  duration: 2,
  offset: new Cesium.HeadingPitchRange(
    0,
    Cesium.Math.toRadians(-75),
    DISTRIBUTION_RADIUS_METERS * 2.5,
  ),
});

// --- Rotation driven by the Cesium clock -------------------------------
const rotationMatrixScratch = new Cesium.Matrix3();
const rotatedPositionScratch = new Cesium.Cartesian3();
let lastUpdatedTime;

viewer.scene.preRender.addEventListener(() => {
  const clock = viewer.clock;
  if (
    lastUpdatedTime !== undefined &&
    Cesium.JulianDate.equals(clock.currentTime, lastUpdatedTime)
  ) {
    return;
  }
  lastUpdatedTime = Cesium.JulianDate.clone(clock.currentTime, lastUpdatedTime);

  const elapsedSeconds = Cesium.JulianDate.secondsDifference(
    clock.currentTime,
    clock.startTime,
  );
  const rotationAngle = elapsedSeconds * ANGULAR_SPEED_RADIANS_PER_SECOND;
  Cesium.Matrix3.fromRotationZ(rotationAngle, rotationMatrixScratch);

  for (let index = 0; index < ASSET_COUNT; index += 1) {
    const record = assetRecords[index];
    Cesium.Matrix3.multiplyByVector(
      rotationMatrixScratch,
      record.basePosition,
      rotatedPositionScratch,
    );
    Cesium.Cartesian3.clone(rotatedPositionScratch, record.currentPosition);
    setAssetVisualPosition(record, record.currentPosition);
  }

  for (let index = 0; index < connectionRecords.length; index += 1) {
    const { polyline, startIndex, endIndex } = connectionRecords[index];
    polyline.positions = [
      currentPositions[startIndex],
      currentPositions[endIndex],
    ];
  }
});

window.viewer = viewer;

installFrameTimeLogger(viewer, { name: "perf-rotating-network" });
