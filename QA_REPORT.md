# QA Report: SiteScape → LAZ → COPC/Potree

**Test date:** September 1, 2026<br>
**Reference scan:** SPZ Squash<br>
**Test objective:** Determine whether existing SiteScape files can be processed, without rescanning, into a colored, to-scale point cloud for a static Potree web viewer.

## Overall assessment

**Passed for the local data pipeline.** After normalization of the PLY axes, the E57 and PLY files contain exactly the same 11,033,814 XYZRGB points. The E57 file was converted, with its point count and colors unchanged, into a LAZ file, a hierarchical single-file COPC dataset, and a readable classic Potree 2 dataset.

Publishing to GitHub Pages and retrieving a file published on Zenodo are external deployment steps. They must be distinguished from the successful conversion test and must be tested again with the final URL after the actual public Zenodo record has been created.

## 1. Test scope

| Test | Subject | Status |
|---|---|---|
| Source files | File size, hash, point count, fields, and coordinate validity | Passed |
| E57/PLY comparison | Axes, XYZ, and RGB across all points | Passed |
| E57 → LAZ | Point count, bounds, RGB, and LAS metadata | Passed |
| LAZ → COPC | Point count, scale, offsets, XYZRGB checksums, and LOD queries | Passed |
| LAZ → Potree 2 | Metadata, point count, attributes, and output files | Passed |
| Local HTTP server | CORS, `OPTIONS`, and byte-range retrieval of the COPC file | Passed |
| Public Zenodo COPC test | CORS, byte ranges, and progressive partial retrieval from an existing record | Passed |
| Browser viewer | RGB rendering and UI tools in a real browser | Separate final test run |
| Production Zenodo link | Final record, CORS, byte ranges, and browser retrieval | Retest after publication |
| Polycam | GLB textures and paid point-cloud exports | Not covered by the SiteScape files |

The machine-readable primary reports are [qa/e57-ply-comparison.json](qa/e57-ply-comparison.json), [qa/e57-to-laz.json](qa/e57-to-laz.json), and [qa/laz-to-copc.json](qa/laz-to-copc.json).

## 2. Source files

| File | Size | SHA-256 |
|---|---:|---|
| `SPZ Squash.e57` | 166,226,944 bytes | `ad611e9563d9d41404bd49779656896f1b0c4dfc58e5ee1cc8d894c13f74e2df` |
| `SPZ Squash.ply` | 165,507,429 bytes | `f89c35c02e8dc1778dd4a7fbf35c9132267e7f1ae39ca5e4cb7f1b1958aba511` |

Both files contain:

- 11,033,814 points;
- XYZ coordinates as 32-bit floating-point values;
- red, green, and blue as 8-bit values;
- no non-finite XYZ values.

The E57 file contains neither a scan pose nor a CRS/EPSG definition. Its coordinates are therefore local. Z was retained as the vertical axis in the tested E57 dataset.

### E57 coordinate bounds

| Axis | Minimum | Maximum | Range |
|---|---:|---:|---:|
| X | −7.730779648 | −1.717587113 | 6.013192534 |
| Y | −10.272649765 | −4.815305710 | 5.457344055 |
| Z | 1.373824239 | 4.859850407 | 3.486026168 |

### E57 color values

| Channel | Minimum | Maximum | Mean |
|---|---:|---:|---:|
| Red | 0 | 255 | 159.5727 |
| Green | 0 | 255 | 161.5758 |
| Blue | 0 | 255 | 159.6769 |

## 3. E57/PLY equality

The raw PLY file uses SiteScape's Y-up convention. Before comparison, each PLY point was transformed into the same Z-up coordinate system as the E57 file as follows:

```text
(x, y, z)PLY → (x, -z, y)Z-up
```

| Field | Differing points | Maximum absolute difference |
|---|---:|---:|
| X | 0 | 0 |
| Y | 0 | 0 |
| Z | 0 | 0 |
| Red | 0 | 0 |
| Green | 0 | 0 |
| Blue | 0 | 0 |

**Finding:** The files are not different measurements; they are two representations of the same point sequence. E57 is recommended as the archival and conversion master. PLY is an optional interchange copy and is not additionally required for this scan.

## 4. E57 → LAZ

Output file: `source/spz-squash.laz`

| Property | Result |
|---|---|
| File size | 85,258,517 bytes |
| SHA-256 | `1af76758aba343b3d50e8546a87d26a1446f75ae9538453df44890abb3c595cb` |
| Point count | 11,033,814 |
| LAS version | 1.2 |
| Point format | 2 (XYZ + RGB) |
| Scale | 0.000001 on all three axes |
| Offsets | X = −8, Y = −11, Z = 1 |
| RGB16 | 0 to 65,535 per channel |
| CRS | None defined |

The 8-bit colors were expanded to the full 16-bit range using the exact factor 257. The point count read back after writing matches the source. All coordinate bounds were within the tolerance of 0.5 µm permitted by the 1 µm quantization.

### LAZ bounds read back from the file

| Axis | Minimum | Maximum |
|---|---:|---:|
| X | −7.730780 | −1.717587 |
| Y | −10.272650 | −4.815306 |
| Z | 1.373824 | 4.859850 |

## 5. LAZ → Potree 2

PotreeConverter **2.1.3** was used with the options `--encoding BROTLI -m poisson --attributes rgb`.

The generated `metadata.json` reports:

| Property | Value |
|---|---|
| Potree data format | 2.0 |
| Point count | 11,033,814 |
| Encoding | BROTLI |
| Attributes | `position`, `rgb` |
| Coordinate scale | 0.000001 on all axes |
| Projection | Empty, as appropriate for the local system |

### Output files

| File | Size | SHA-256 |
|---|---:|---|
| `metadata.json` | 1,115 bytes | `6b08d5db334e6ece7804d146899d6ef391452fbbff6323b295b7d0e087bef353` |
| `hierarchy.bin` | 108,614 bytes | `76cfc85137354b13c838f26e570dfce838e1150f21de2fffe841b00c57ad7d08` |
| `octree.bin` | 102,394,259 bytes | `42dc6d17d87f1f14bf8ce7f4e229c7ecd0948106713240843b68845b93b5cf33` |

The outer `boundingBox` in Potree's metadata is intentionally cubic and is therefore larger than the actual point cloud. The bounds of the `position` attribute were used for data validation; they match the LAZ bounds.

### Build note

The Linux source build of the converter used here produced all three final files, but subsequently reported a late filesystem error while removing its temporary chunk directory. The test therefore did not rely solely on the process exit code: the completed files, metadata, attributes, and point count were verified separately. The official PotreeConverter 2.1.3 binary is preferable for normal processing on Windows.

## 6. LAZ → COPC

For the target Zenodo architecture, `source/spz-squash.laz` was converted to `viewer/data/spz-squash.copc.laz` using the portable Linux binary of **360-geo/copc_converter 0.9.15**.

| Property | Result |
|---|---|
| File size | 99,941,088 bytes |
| SHA-256 | `0fde8b572590b40d75cf44249c5b77e58c4f31bc3fb80958a791b9310123eb21` |
| Point count | 11,033,814 |
| LAS version | 1.4 |
| Point format | 7 (including RGB) |
| COPC VLR | Present |
| Scale | 0.000001 on all axes |
| Offsets | X = −8, Y = −11, Z = 1 |
| RGB16 | 0 to 65,535 per channel |
| CRS | None defined |

COPC reorders points spatially, so comparing identical dataset indices would not be meaningful. Instead, the point count, RGB sums, and modular sums and sums of squares of the quantized XYZ values were compared across the complete LAZ and COPC contents. All test values were exactly equal. No points or colors were therefore lost or changed.

The COPC header uses the same scale and offsets. Its enclosing header bounds extend beyond individual minima by no more than one quantization unit of 1 µm; the validated point values themselves are unchanged.

### Spatial COPC queries

`laspy.CopcReader` read the same file hierarchically at three levels of detail:

| Requested resolution | Points returned | Status |
|---:|---:|---|
| 0.5 | 37,695 | Passed |
| 0.01 | 3,971,081 | Passed |
| Full | 11,033,814 | Passed |

This demonstrates that more than the LAS header is readable: the hierarchy, spatial subset queries, and complete data retrieval all work. This is the technical basis for progressive loading in the Potree viewer over HTTP Range requests.

### Local HTTP Range test

The included server `scripts/serve_viewer.py` was tested directly against the generated COPC file:

| Request | Result |
|---|---|
| `GET` with `Range: bytes=0-999` | `206 Partial Content` |
| `Content-Range` | `bytes 0-999/99941088` |
| Transferred length | 1,000 bytes |
| CORS | `Access-Control-Allow-Origin: *` |
| Range advertisement | `Accept-Ranges: bytes` |
| `OPTIONS` | `204 No Content`; permits `GET, HEAD, OPTIONS` and the `Range` header |

The reproducible local start command is `py scripts\serve_viewer.py`; the page is then available at `http://127.0.0.1:8000/`.

## 7. Zenodo HTTP test

On September 1, 2026, an existing published COPC dataset on Zenodo was tested as an external browser source. The endpoint suitable for the viewer is:

```text
https://zenodo.org/api/records/RECORD_ID/files/DATEINAME.copc.laz/content
```

In the live test, it returned:

- `Access-Control-Allow-Origin: *` for cross-origin browser access;
- support for the `Range` header in the preflight response;
- `206 Partial Content` and a correct `Content-Range` for byte-range requests;
- successfully read COPC header, hierarchy, root-point, and RGB ranges.

The ordinary visible download path `/records/RECORD_ID/files/DATEINAME` supported byte ranges but did not provide the CORS authorization required by GitHub Pages. It is suitable as a download link, not as the viewer's data URL.

**Scope:** This test confirms the technical suitability of the Zenodo API endpoint. The project's own record does not yet exist; its final version-specific URL must be tested again after publication and entered permanently in the viewer. Zenodo is a research data repository, not an unlimited streaming CDN, so browser caching and a reasonable point budget remain important.

## 8. Viewer functions and technical limitations

The Potree viewer can perform the following operations with this data type:

| Function | Technical status | Technical limitation |
|---|---|---|
| RGB display | `rgb` is present in the Potree dataset | Point colors are not a photographic mesh texture |
| Point coordinates | Standard Potree measurement tool | Local coordinate system without EPSG |
| Distance, height, angle, area | Standard Potree measurement tools | Accuracy depends on the scan and point selection |
| Profile/cross-section | Profile tool with width; CSV/LAS export | No automatic CAD section drawing |
| Clipping | Box/volume clipping | Visual selection only; no permanent data modification |

The test files contain no intensity, classification, normals, timestamps, or georeferencing. Corresponding filters or analyses are therefore not possible with this scan. The available XYZRGB data are nevertheless sufficient for orientation, manual measurements, profiles, and sections.

## 9. Publication risks

| Risk | Assessment | Mitigation |
|---|---|---|
| Git file-size limit | `octree.bin` is only just below 100 MiB; other scans may exceed it | Store scan data on Zenodo and only viewer code on GitHub Pages |
| Git LFS | Unsuitable as a data source for GitHub Pages | Do not use it for browser data |
| Zenodo persistence | Drafts are not the final citable state | Use only the published, version-specific record |
| Zenodo CORS/Range | Required for partial loading | Test the actual `/api/records/.../content` endpoint after publication |
| Zenodo load limits | The repository is not an unlimited streaming CDN | Use caching, limit the point budget, and avoid unnecessary reloads |
| Privacy/rights | Technical rooms may reveal sensitive details | Obtain publication clearance and redact content if necessary |

## 10. Scope distinction from Polycam

The successful test substantially reduces the risk before starting a Polycam trial: data validation, LAZ generation, Potree conversion, and the analysis workflow have already been demonstrated with a real scan of a similar scale.

Only the following Polycam-specific matters remain unresolved:

1. Which source/export formats the selected plan actually enables on the activation date.
2. Whether Polycam E57/LAZ/PLY exports contain colors, scale, and axes as expected.
3. How the phototextured GLB mesh view should be offered alongside the Potree point cloud.

The GLB should be archived regardless, because it contains the illustrative photographic texture. A colored point-cloud export is additionally useful for analysis. One Polycam test export is initially sufficient for QA; all required formats can then be exported during the trial period.

## 11. Release criterion for the complete collection

Another scan is considered ready for release when all of the following conditions are met:

- The source file and SHA-256 hash are documented;
- the point count is identical before and after conversion;
- XYZ contains no NaN or Inf values;
- the vertical axis and scale have been verified;
- RGB is present in the target and visually plausible;
- Potree/COPC loads over HTTP;
- measurement, profile, and clipping tools work in a current browser;
- the public Zenodo link uses the final, version-specific record;
- publication rights and privacy requirements have been resolved.
