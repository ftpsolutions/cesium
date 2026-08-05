import * as Cesium from "cesium";
import { createPerfKit } from "PerfKit";

// Connections drawn as GroundPolylinePrimitive — draped on the terrain
// surface via the polyline-shadow-volume path. Geometry is immutable, so
// mutations mean rebuilding the whole primitive asynchronously and
// swapping it in once ready.
const {
  model,
  addAssetVisual,
  installFrameTimeLogger,
  setAssetVisualPosition,
} = createPerfKit({
  // Same motion + churn params as Perf 2 / Perf 3 so the only variable
  // across the trio is the polyline rendering path.
  colourChangeIntervalSeconds: 0.5,
  assetColourChangePercentage: 0.05,
  connectionColourChangePercentage: 0.05,
  connectionRewireIntervalSeconds: 1,
  connectionRewireFraction: 0.01,
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

const assetVisuals = model.assets.map((asset) =>
  addAssetVisual({
    billboards,
    labels,
    position: asset.position,
    assetNumber: asset.index + 1,
  }),
);

// GroundPolylineGeometry needs world-space endpoints (no modelMatrix hook),
// so lift each asset's local position through the model.localToWorld matrix.
function toWorldPosition(local) {
  return Cesium.Matrix4.multiplyByPoint(
    model.localToWorld,
    local,
    new Cesium.Cartesian3(),
  );
}

class ConnectionGeometryManager {
  constructor() {
    this.primitive = undefined;
    this.nextPrimitive = this.createPrimitive();
    viewer.scene.groundPrimitives.add(this.nextPrimitive);
  }

  createPrimitive() {
    const geometryInstances = model.connections.map(
      (connection) =>
        new Cesium.GeometryInstance({
          id: {
            type: "connection",
            startAssetNumber: connection.startAssetIndex + 1,
            endAssetNumber: connection.endAssetIndex + 1,
          },
          geometry: new Cesium.GroundPolylineGeometry({
            positions: [
              toWorldPosition(
                model.assets[connection.startAssetIndex].position,
              ),
              toWorldPosition(model.assets[connection.endAssetIndex].position),
            ],
            width: 1.5,
          }),
          attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
              connection.color,
            ),
          },
        }),
    );
    return new Cesium.GroundPolylinePrimitive({
      geometryInstances,
      show: false,
      appearance: new Cesium.PolylineColorAppearance(),
      asynchronous: true,
      releaseGeometryInstances: true,
    });
  }

  update() {
    if (!this.nextPrimitive.ready) {
      return;
    }
    if (this.primitive) {
      viewer.scene.groundPrimitives.remove(this.primitive);
    }
    this.nextPrimitive.show = true;
    this.primitive = this.nextPrimitive;
    this.nextPrimitive = this.createPrimitive();
    viewer.scene.groundPrimitives.add(this.nextPrimitive);
  }
}

const connectionGeometryManager = new ConnectionGeometryManager();

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

  // Any change to connection positions or colours requires rebuilding the
  // whole primitive (immutable geometry).
  if (
    changes.movedAssets.size > 0 ||
    changes.recolouredConnections.size > 0 ||
    changes.rewiredConnections.size > 0
  ) {
    connectionGeometryManager.update();
  }
});

window.viewer = viewer;
window.model = model;

installFrameTimeLogger(viewer);
