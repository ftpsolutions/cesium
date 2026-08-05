import * as Cesium from "cesium";
import { createPerfKit } from "PerfKit";

// Vivid HSL palette so per-instance recolour churn is visible at a glance.
function hslColor(hue, saturation = 0.85, lightness = 0.55, alpha = 1) {
  const h = ((hue % 1) + 1) % 1;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = lightness - c / 2;
  const [r, g, b] =
    h < 1 / 6
      ? [c, x, 0]
      : h < 2 / 6
        ? [x, c, 0]
        : h < 3 / 6
          ? [0, c, x]
          : h < 4 / 6
            ? [0, x, c]
            : h < 5 / 6
              ? [x, 0, c]
              : [c, 0, x];
  return new Cesium.Color(r + m, g + m, b + m, alpha);
}

// Same kit-driven orbit motion as demo #1, plus colour + rewire churn.
// Rendered with PolylineCollection (one draw per line) — the per-line Material
// updates are the added cost being measured relative to the baseline.
const {
  model,
  addAssetVisual,
  installFrameTimeLogger,
  setAssetVisualPosition,
} = createPerfKit({
  colourChangeIntervalSeconds: 0.5,
  assetColourChangePercentage: 0.05,
  connectionColourChangePercentage: 0.05,
  connectionRewireIntervalSeconds: 1,
  connectionRewireFraction: 0.01,
  assetColourFactory: (random) => hslColor(random()),
  connectionColourFactory: (random) => hslColor(random(), 0.7, 0.5, 0.35),
});

const viewer = new Cesium.Viewer("cesiumContainer");
viewer.clock.shouldAnimate = true;
viewer.scene.debugShowFramesPerSecond = true;

const billboards = viewer.scene.primitives.add(
  new Cesium.BillboardCollection({ modelMatrix: model.localToWorld }),
);
const labels = viewer.scene.primitives.add(
  new Cesium.LabelCollection({ modelMatrix: model.localToWorld }),
);
const polylines = viewer.scene.primitives.add(
  new Cesium.PolylineCollection({ modelMatrix: model.localToWorld }),
);

const assetVisuals = model.assets.map((asset) =>
  addAssetVisual({
    billboards,
    labels,
    position: asset.position,
    assetNumber: asset.index + 1,
  }),
);

const connectionEntries = model.connections.map((connection) => {
  const material = Cesium.Material.fromType("Color", {
    color: connection.color,
  });
  const polyline = polylines.add({
    id: {
      type: "connection",
      startAssetNumber: connection.startAssetIndex + 1,
      endAssetNumber: connection.endAssetIndex + 1,
    },
    positions: [
      model.assets[connection.startAssetIndex].position,
      model.assets[connection.endAssetIndex].position,
    ],
    width: 1.5,
    material,
  });
  return { polyline, material };
});

viewer.camera.flyToBoundingSphere(
  new Cesium.BoundingSphere(model.centreWorld, model.distributionRadius),
  {
    duration: 2,
    offset: new Cesium.HeadingPitchRange(
      0,
      Cesium.Math.toRadians(-75),
      model.distributionRadius * 2.5,
    ),
  },
);

viewer.scene.preRender.addEventListener(() => {
  const elapsedSeconds = Cesium.JulianDate.secondsDifference(
    viewer.clock.currentTime,
    viewer.clock.startTime,
  );
  const changes = model.tick(elapsedSeconds);

  for (const assetIndex of changes.movedAssets) {
    setAssetVisualPosition(
      assetVisuals[assetIndex],
      model.assets[assetIndex].position,
    );
  }
  for (const assetIndex of changes.recolouredAssets) {
    const visual = assetVisuals[assetIndex];
    const color = model.assets[assetIndex].color;
    visual.body.color = color;
    visual.leftCircle.color = color;
    visual.rightCircle.color = color;
  }
  for (const connectionIndex of changes.recolouredConnections) {
    connectionEntries[connectionIndex].material.uniforms.color =
      model.connections[connectionIndex].color;
  }

  const connectionsNeedingPositionUpdate = new Set(changes.rewiredConnections);
  for (const assetIndex of changes.movedAssets) {
    for (const connectionIndex of model.connectionsByAssetIndex[assetIndex]) {
      connectionsNeedingPositionUpdate.add(connectionIndex);
    }
  }
  for (const connectionIndex of connectionsNeedingPositionUpdate) {
    const connection = model.connections[connectionIndex];
    connectionEntries[connectionIndex].polyline.positions = [
      model.assets[connection.startAssetIndex].position,
      model.assets[connection.endAssetIndex].position,
    ];
  }
});

window.viewer = viewer;
window.model = model;

installFrameTimeLogger(viewer, { name: "perf-dynamic-network" });
