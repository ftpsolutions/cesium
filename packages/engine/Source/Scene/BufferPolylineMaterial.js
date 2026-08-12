// @ts-check

import Color from "../Core/Color.js";
import Frozen from "../Core/Frozen.js";
import BufferPrimitiveMaterial from "./BufferPrimitiveMaterial.js";

/** @import BufferPolyline from "./BufferPolyline.js"; */

/**
 * @typedef {object} BufferPolylineMaterialOptions
 * @property {Color} [color=Color.WHITE] Color of fill.
 * @property {Color} [outlineColor=Color.WHITE] Color of outline.
 * @property {number} [outlineWidth=0.0] Width of outline, 0-255px.
 * @property {number} [width=1.0] Width of line, 0-255px.
 * @property {Color} [gapColor=Color.TRANSPARENT] Color drawn in the gaps between dashes.
 * @property {number} [dashRepeat=1] Number of dash-pattern cycles along the whole line, 0-255. The pattern is anchored to the line geometry (not the screen), so bands stay put as the camera pans and scale with the line as it zooms.
 * @property {number} [dashOffset=0.0] Phase offset as a fraction of one cycle, 0-1. Shifts where the pattern starts relative to the origin of the line.
 * @property {number} [dashPattern=65535] 16-bit on/off bitmask sampled within each cycle. 65535 (0xFFFF) is fully solid.
 */

/**
 * Material description for a {@link BufferPolyline}.
 *
 * <p>BufferPolylineMaterial objects are {@link Packable|packable}, stored
 * when calling {@link BufferPolyline#setMaterial}. Subsequent changes to the
 * material will not affect the polyline until setMaterial() is called again.</p>
 *
 * @experimental This feature is not final and is subject to change without Cesium's standard deprecation policy.
 * @extends BufferPrimitiveMaterial
 */
class BufferPolylineMaterial extends BufferPrimitiveMaterial {
  /** @ignore */
  static Layout = {
    ...BufferPrimitiveMaterial.Layout,
    WIDTH_U8: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH,
    GAP_COLOR_U32: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH + 4,
    DASH_REPEAT_U8: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH + 8,
    DASH_OFFSET_U8: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH + 9,
    DASH_PATTERN_U16: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH + 10,
    __BYTE_LENGTH: BufferPrimitiveMaterial.Layout.__BYTE_LENGTH + 12,
  };

  /**
   * @type {BufferPolylineMaterial}
   * @ignore
   */
  static DEFAULT_MATERIAL = Object.freeze(new BufferPolylineMaterial());

  /**
   * @param {BufferPolylineMaterialOptions} [options]
   */
  constructor(options = Frozen.EMPTY_OBJECT) {
    super(options);

    /**
     * Width of polyline, 0–255px.
     * @type {number}
     */
    this.width = options.width ?? 1;

    /**
     * Color drawn in the gaps between dashes. Defaults to transparent, which
     * discards, so gaps read as empty space.
     * @type {Color}
     */
    this.gapColor = Color.clone(options.gapColor ?? Color.TRANSPARENT);

    /**
     * Number of dash-pattern cycles along the whole line, 0–255. The pattern is
     * anchored to the line geometry, so bands stay put as the camera pans and
     * scale with the line as it zooms (rather than crawling in screen space).
     * @type {number}
     */
    this.dashRepeat = options.dashRepeat ?? 1;

    /**
     * Phase offset as a fraction of one cycle, 0–1. Shifts where the pattern
     * starts relative to the origin of the line (e.g. 0.25 lands a solid slot
     * on the origin instead of a gap).
     * @type {number}
     */
    this.dashOffset = options.dashOffset ?? 0;

    /**
     * 16-bit on/off bitmask sampled within each cycle — each bit is one of 16
     * slots, 1 draws {@link BufferPolylineMaterial#color}, 0 draws
     * {@link BufferPolylineMaterial#gapColor}. 65535 (0xFFFF) is fully solid.
     * @type {number}
     */
    this.dashPattern = options.dashPattern ?? 65535;
  }

  /**
   * @param {BufferPolylineMaterial} material
   * @param {DataView} view
   * @param {number} byteOffset
   * @override
   */
  static pack(material, view, byteOffset) {
    super.pack(material, view, byteOffset);
    view.setUint8(this.Layout.WIDTH_U8 + byteOffset, material.width);
    view.setUint32(
      this.Layout.GAP_COLOR_U32 + byteOffset,
      material.gapColor.toRgba(),
      true,
    );
    view.setUint8(this.Layout.DASH_REPEAT_U8 + byteOffset, material.dashRepeat);
    // Offset is a [0,1) fraction stored in 256ths so 0.25 round-trips exactly.
    view.setUint8(
      this.Layout.DASH_OFFSET_U8 + byteOffset,
      Math.round(material.dashOffset * 256),
    );
    view.setUint16(
      this.Layout.DASH_PATTERN_U16 + byteOffset,
      material.dashPattern,
      true,
    );
  }

  /**
   * @param {DataView} view
   * @param {number} byteOffset
   * @param {BufferPolylineMaterial} result
   * @returns {BufferPolylineMaterial}
   * @override
   */
  static unpack(view, byteOffset, result) {
    super.unpack(view, byteOffset, result);
    result.width = view.getUint8(this.Layout.WIDTH_U8 + byteOffset);
    Color.fromRgba(
      view.getUint32(this.Layout.GAP_COLOR_U32 + byteOffset, true),
      result.gapColor,
    );
    result.dashRepeat = view.getUint8(this.Layout.DASH_REPEAT_U8 + byteOffset);
    result.dashOffset =
      view.getUint8(this.Layout.DASH_OFFSET_U8 + byteOffset) / 256;
    result.dashPattern = view.getUint16(
      this.Layout.DASH_PATTERN_U16 + byteOffset,
      true,
    );
    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  // DEBUG

  /**
   * Returns a JSON-serializable object representing the material. This encoding
   * is not memory-efficient, and should generally be used for debugging and
   * testing.
   *
   * @returns {Object} JSON-serializable object.
   */
  toJSON() {
    return {
      ...super.toJSON(),
      width: this.width,
      gapColor: this.gapColor.toCssHexString(),
      dashRepeat: this.dashRepeat,
      dashOffset: this.dashOffset,
      dashPattern: this.dashPattern,
    };
  }
}

export default BufferPolylineMaterial;
