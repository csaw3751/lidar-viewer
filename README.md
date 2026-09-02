# Protected LiDAR Viewer with GitHub Pages and Zenodo

**English** · [Deutsch](README.de.md)

This repository deploys Potree as a static website for viewing restricted COPC point clouds stored on Zenodo. The website contains **no scan data, Zenodo record ID, or access token**. A personal secret link supplies the record ID and bearer token in the URL fragment; the viewer removes that fragment immediately and streams only the required byte ranges from the restricted Zenodo record.

## Language support

The interface is available in English and German. Language selection follows this order:

1. a valid language previously selected with the **EN/DE** control;
2. the browser's preferred languages;
3. English as the fallback.

German (`de` and regional variants such as `de-AT`) selects German. Every other, unsupported, or missing language falls back to English. The selector changes the interface immediately and updates the document language, controls, help text, tooltips, dialogs, status messages, error messages, accessibility labels, number formatting, and Potree interface. The independent legacy Potree language picker is hidden so this synchronized EN/DE control remains authoritative, including for dynamically created advanced panels and scene objects.

The language preference contains no credentials and is stored separately from the tab-scoped Zenodo access data. Changing the language does not reconstruct the secret URL fragment or alter Zenodo authentication, endpoint selection, Range streaming, or COPC loading. Dataset titles, scan labels, sources, and other descriptive values from `viewer-manifest.json` are displayed as supplied because they are dataset content rather than interface text.

First-party source code, comments, tests, `README.md`, `SECURITY.md`, and `THIRD_PARTY_NOTICES.md` use English. The complete German project guide is `README.de.md`; `QA_REPORT.md` remains the dated German evidence record. Upstream files under `viewer/vendor/` retain their original contents.

## Files to upload to Zenodo

The browser viewer requires only:

1. exactly one `viewer-manifest.json`;
2. exactly one web-optimized `*.copc.laz` file per scan.

E57, PLY, ordinary LAZ, GLB, floor plans, and other originals may additionally be archived in Zenodo, but this Potree viewer does not load them. HTML, JavaScript, Potree, and this repository do **not** belong in the Zenodo dataset.

At the time this package was prepared, the SiteScape dataset therefore consisted of five viewer files: one manifest and four COPC files. Add later scans as further COPC files in a new Zenodo version and register them in the manifest.

Example manifest with multiple scans:

```json
{
  "schemaVersion": 1,
  "title": "LiDAR scans",
  "scans": [
    {
      "id": "scan-a",
      "label": "Scan A",
      "source": "SiteScape",
      "type": "pointcloud",
      "format": "copc",
      "file": "scan-a.copc.laz",
      "units": "m"
    },
    {
      "id": "scan-b",
      "label": "Scan B",
      "source": "Polycam",
      "type": "pointcloud",
      "format": "copc",
      "file": "scan-b.copc.laz",
      "units": "m"
    }
  ]
}
```

Filenames must be plain filenames without directories and must end in `.copc.laz`. Optional manifest fields are `points`, `extent`, `attributes`, and `webFormat`.

## Publishing the Zenodo record

Before selecting **Publish**, confirm that every viewer file shows 100% upload completion and has a checksum. Save the draft, open it once through the personal secret link, and test every scan in the selector. Keep visibility at **Files only → Restricted**; this sharing model does not require an embargo.

Publishing makes the record page and metadata public while the files remain restricted. According to Zenodo, an existing link with `Can preview drafts` can access restricted files in the current and future versions. For access only to a published version, create a separate `Can view` link for each person. The viewer automatically tries the draft endpoint first and the published endpoint second.

Treat published files as immutable. Put corrections, additions, and new scans in a new Zenodo version so that earlier versions remain traceable.

## Local testing

From the project root in Windows PowerShell:

```powershell
py -3.12 .\scripts\serve_viewer.py --port 8765
```

Then open the personal viewer link in the browser:

```text
http://127.0.0.1:8765/index.html#record=RECORD_ID&token=SECRET
```

`RECORD_ID` and `SECRET` come from the secret link created by Zenodo. The viewer immediately removes the fragment from the address bar and keeps access only in the current tab session (`sessionStorage`). Access is discarded after all copies of that tab are closed or when **Remove access from this tab** is selected. See [SECURITY.md](SECURITY.md) for the same-origin limitation.

The link works with an unpublished draft (`Can preview drafts`) and after restricted publication. The viewer resolves the suitable Zenodo endpoint automatically.

## Preparing additional SiteScape scans

The supplied PowerShell script uses the system-wide Python 3.12 installation. It installs missing pinned packages for the current Windows user and does not create a virtual environment.

For one scan:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
& .\scripts\build_scan.ps1 `
  -InputFile "C:\Scans\SPZ Squash.e57" `
  -Name "Sports Center - Squash" `
  -Slug "spz-squash"
```

A geometrically verified split E57 capture can be written to one COPC file without thinning:

```powershell
& .\scripts\build_scan.ps1 `
  -InputFile @("C:\Scans\Ventilation 1.e57", "C:\Scans\Ventilation 2.e57") `
  -Name "Sports Center - Ventilation" `
  -Slug "spz-ventilation" `
  -AssumeCommonCoordinates
```

`-AssumeCommonCoordinates` explicitly confirms that pose, bounds, and overlap were checked beforehand. The script performs no automatic registration or ICP alignment.

## Display quality

The **Auto / High / Maximum** selection takes effect immediately and changes neither the COPC file nor its measurements. It changes only the amount of detail displayed at once:

| Level | Desktop | Compact devices | Intended use |
|---|---:|---:|---|
| Auto | up to 3.5 million points | up to 1.2 million points | balanced default |
| High | up to 5.5 million points | up to 2.0 million points | detailed normal inspection |
| Maximum | up to 9.0 million points | up to 3.5 million points | finest view on capable hardware |

All levels use adaptive round points and increasingly fine Potree LOD thresholds. Higher levels require more Zenodo requests, GPU performance, and memory. Quality and language preferences use separate keys in `localStorage`; Zenodo access remains separate and tab-local in `sessionStorage`.

## Deploying to GitHub Pages

1. Copy this directory into a dedicated GitHub repository.
2. On GitHub, select **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Wait for **Deploy protected LiDAR viewer** to finish under **Actions**.
4. Open the displayed Pages address, normally:

```text
https://USERNAME.github.io/REPOSITORY/
```

The supplied workflow publishes only `viewer/`. Tests, scripts, and root documentation are not deployed as the website.

The GitHub Pages shell is intentionally public because it contains no scan data or credentials. GitHub notes that a Pages site may be public even when its repository is private. GitHub Free normally supports Pages for public repositories; private repositories require an appropriate plan. The scan files remain restricted in Zenodo independently of the repository's visibility.

## Creating a personal viewer link

A Zenodo secret link contains the required values:

```text
https://zenodo.org/records/RECORD_ID?preview=1&token=SECRET
```

Turn it into the recipient's viewer link:

```text
https://USERNAME.github.io/REPOSITORY/#record=RECORD_ID&token=SECRET
```

Optionally preselect one scan:

```text
https://USERNAME.github.io/REPOSITORY/#record=RECORD_ID&token=SECRET&scan=SCAN_ID
```

Never copy a complete personal link into Git, GitLab, a public README, an issue, or a screenshot. Create a separate, preferably expiring Zenodo link for each recipient. Each link can be revoked in Zenodo at any time.

## Security model

- The URL fragment is not sent to GitHub Pages and is removed from the address bar immediately.
- Zenodo origins and API paths are fixed; arbitrary `?data=` sources are disabled.
- The token is never written to configuration, the DOM, console output, or `localStorage`.
- Access credentials remain only in the current tab session in `sessionStorage`.
- COPC requests accept only exact HTTP `206 Partial Content` byte ranges. A complete `200 OK` response is rejected before parsing.
- Repeated ranges are deduplicated in memory. Request starts are limited to about 40 per minute, below Zenodo's documented guest limit of 60 per minute.
- CSP, `no-referrer`, and `noindex` reduce unintended disclosure and indexing.
- Language selection uses separate non-sensitive state and cannot change the access session, request URLs, or streaming behavior.

A secret link is not DRM. Anyone who receives it can load the data and can in principle recover the token and transferred point data with browser developer tools. People without a valid token cannot access the restricted files.

For the same-origin `sessionStorage` caveat, incident response, and technical limitations, read [SECURITY.md](SECURITY.md).

## Running the tests

Only Node.js and Python are required:

```powershell
node --check .\viewer\zenodo-access.js
node --check .\viewer\i18n.js
node --check .\viewer\app.js
node --test .\tests\test_zenodo_access.mjs
node --test .\tests\test_i18n.mjs
py -3.12 -m unittest -v tests.test_static_and_server
```

The existing tests cover fragment scrubbing, draft and published endpoints, multi-scan selection, manifest validation, traversal protection, exact byte ranges, request deduplication, rejection of complete `200` responses, quality levels, prohibited scan files in the web directory, and the local Range server.

The localization and safety tests additionally cover dictionary-key parity, complete markup-key coverage, English static fallback, `de-AT` detection, unsupported-language fallback to English, saved-choice precedence, invalid saved values, live translation of text and attributes, Potree language synchronization, dynamic legacy Potree panels, messages and tool-created object names, preservation of semantic option values and user or dataset labels, locale-aware number formatting, separation of language preference from access credentials, CSP and security-critical script order, and an unchanged `viewer/vendor/` tree.

## Repository layout

```text
.
├── .github/workflows/deploy-pages.yml
├── QA_REPORT.md
├── README.md
├── README.de.md
├── SECURITY.md
├── THIRD_PARTY_NOTICES.md
├── qa/
├── scripts/
│   ├── build_scan.ps1
│   ├── prepare_pointcloud.py
│   ├── requirements.txt
│   └── serve_viewer.py
├── tests/
│   ├── test_i18n.mjs
│   ├── test_static_and_server.py
│   └── test_zenodo_access.mjs
└── viewer/
    ├── .nojekyll
    ├── index.html
    ├── config.js
    ├── zenodo-access.js
    ├── i18n.js
    ├── app.js
    ├── styles.css
    ├── data/README.md
    └── vendor/
```

## Quality assurance and references

[QA_REPORT.md](QA_REPORT.md) is the dated 1 September 2026 conversion and streaming QA report. It documents the verified SiteScape → LAZ → COPC/Potree pipeline and the test conditions at that time; it is not a statement about the current deployment status of a production Zenodo record.

- [Zenodo: Link sharing](https://help.zenodo.org/docs/share/link-sharing/)
- [Zenodo: About records](https://help.zenodo.org/docs/deposit/about-records/)
- [Zenodo: Manage versions](https://help.zenodo.org/docs/deposit/manage-versions/)
- [Zenodo REST API and rate limits](https://developers.zenodo.org/)
- [GitHub: Publishing with a custom GitHub Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Potree](https://github.com/potree/potree)

## Open-source components and acknowledgments

This viewer builds on:

- [Potree 1.8.0](https://github.com/potree/potree), a WebGL viewer for large point clouds by Markus Schütz and contributors — BSD-2-Clause;
- [copc.js](https://github.com/connormanning/copc.js), a COPC parsing and streaming library by Connor Manning — MIT;
- [copc-converter 0.9.15](https://github.com/360-geo/copc-converter), used during preprocessing to convert LAS/LAZ files to COPC — MIT.

The scan-preparation pipeline also uses the pinned Python packages listed in [`scripts/requirements.txt`](scripts/requirements.txt): laspy, lazrs, NumPy, pye57, and pyquaternion.

The project-specific interface, protected Zenodo access layer, multipart-scan processing, and GitHub Pages workflow were developed for this master's thesis project. No file under `viewer/vendor/` is changed by the bilingual update.

Complete copyright and license notices for bundled components are provided in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and in the license files distributed with those components. The absence of a separate project license means that no additional public reuse license is granted for first-party integration and UI code.
