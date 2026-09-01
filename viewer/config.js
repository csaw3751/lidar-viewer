/*
 * Diese Datei enthält bewusst weder Zenodo-Record-ID noch Zugangstoken.
 * Beides wird ausschließlich aus dem persönlichen URL-Fragment übernommen.
 */
window.LIDAR_VIEWER_CONFIG = Object.freeze({
  name: "Geschützter LiDAR-Viewer",
  manifestFile: "viewer-manifest.json",
  loadTimeoutMs: 180_000,
  defaultQuality: "auto",
  qualityProfiles: Object.freeze({
    auto: Object.freeze({
      label: "Auto",
      desktopPointBudget: 3_500_000,
      compactPointBudget: 1_200_000,
      minNodeSize: 20,
      pointSize: 0.85,
      shape: "CIRCLE",
    }),
    high: Object.freeze({
      label: "Hoch",
      desktopPointBudget: 5_500_000,
      compactPointBudget: 2_000_000,
      minNodeSize: 10,
      pointSize: 0.72,
      shape: "CIRCLE",
    }),
    maximum: Object.freeze({
      label: "Maximum",
      desktopPointBudget: 9_000_000,
      compactPointBudget: 3_500_000,
      minNodeSize: 5,
      pointSize: 0.62,
      shape: "CIRCLE",
    }),
  }),
});
