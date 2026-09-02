/*
 * This file intentionally contains neither a Zenodo record ID nor an access
 * token. Both values are accepted only from the personal URL fragment.
 */
window.LIDAR_VIEWER_CONFIG = Object.freeze({
  manifestFile: "viewer-manifest.json",
  loadTimeoutMs: 180_000,
  defaultQuality: "auto",
  qualityProfiles: Object.freeze({
    auto: Object.freeze({
      desktopPointBudget: 3_500_000,
      compactPointBudget: 1_200_000,
      minNodeSize: 20,
      pointSize: 0.85,
      shape: "CIRCLE",
    }),
    high: Object.freeze({
      desktopPointBudget: 5_500_000,
      compactPointBudget: 2_000_000,
      minNodeSize: 10,
      pointSize: 0.72,
      shape: "CIRCLE",
    }),
    maximum: Object.freeze({
      desktopPointBudget: 9_000_000,
      compactPointBudget: 3_500_000,
      minNodeSize: 5,
      pointSize: 0.62,
      shape: "CIRCLE",
    }),
  }),
});
