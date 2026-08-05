import * as Cesium from "cesium";
import { createPerfKit } from "PerfKit";

// Kit-driven orbit motion, no colour churn, no rewires. Rendered with
// PolylineCollection (one draw per line). Baseline for cost of per-frame
// position updates on the individual-polyline path.
const {
  model,
  addAssetVisual,
  installFrameTimeLogger,
  setAssetVisualPosition,
} = createPerfKit({
  assetColourChangePercentage: 0,
  connectionColourChangePercentage: 0,
  connectionRewireFraction: 0,
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

const connectionPolylines = model.connections.map((connection) =>
  polylines.add({
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
    material: Cesium.Material.fromType("Color", {
      color: Cesium.Color.GREEN.withAlpha(0.25),
    }),
  }),
);

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

  const connectionsNeedingPositionUpdate = new Set();
  for (const assetIndex of changes.movedAssets) {
    for (const connectionIndex of model.connectionsByAssetIndex[assetIndex]) {
      connectionsNeedingPositionUpdate.add(connectionIndex);
    }
  }
  for (const connectionIndex of connectionsNeedingPositionUpdate) {
    const connection = model.connections[connectionIndex];
    connectionPolylines[connectionIndex].positions = [
      model.assets[connection.startAssetIndex].position,
      model.assets[connection.endAssetIndex].position,
    ];
  }
});

window.viewer = viewer;
window.model = model;

installFrameTimeLogger(viewer);
