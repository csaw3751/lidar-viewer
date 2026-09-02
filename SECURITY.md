# Security

## Secret links and access model

Zenodo secret links are bearer credentials: anyone who has the complete link receives the permissions associated with it. Therefore:

- create a separate link for each recipient and set an expiration date where possible;
- send links only through direct, appropriate channels;
- delete accidentally disclosed links in Zenodo immediately;
- never use a personal Zenodo API token with this viewer;
- never commit `token`, `record`, or a complete personal viewer URL to Git;
- never include a complete personal viewer URL in a public issue, README, screenshot, or log.

The public GitHub Pages site contains only the static viewer shell. It contains no scan data, Zenodo record ID, or access token.

## Credential lifecycle

The personal viewer URL supplies `record`, `token`, and optionally `scan` in the URL fragment. The fragment is not sent to GitHub Pages as part of the HTTP request.

`viewer/zenodo-access.js` runs before the bundled third-party libraries. It reads the fragment and removes it from the address bar immediately with `history.replaceState`. Extracted values are accepted only after their expected syntax has been validated.

For page reloads and scan changes, validated access data is stored only in `sessionStorage` for the current tab session. It is deliberately not written to:

- `localStorage`;
- the runtime configuration;
- the document DOM;
- console output.

A duplicated or related browser tab can receive a copy of the original tab's session storage. The access data is discarded after all such tab copies have been closed or when the user selects **Remove access from this tab** in English or **Zugang aus diesem Tab entfernen** in German. That command clears the active access state and reloads the viewer without the fragment.

Display preferences such as language or rendering quality are non-secret and remain separate from the Zenodo credential. Browser-language detection, the English fallback, and the DE/EN selector only choose locally bundled interface text. They do not change the accepted origins, URL-fragment format, validation rules, or network requests, and they do not contact an external translation service. The first-party adapter for unmarked legacy Potree UI translates only allow-listed text nodes, attributes and messages; it preserves semantic option values, unknown attributes, and user or dataset labels, and it introduces no HTML-injection sink.

## Origin isolation

`sessionStorage` is separated by web origin, not by repository path. Other JavaScript applications served from the same origin, for example another site under the same `https://USERNAME.github.io` origin, could read the viewer's session-storage entry in the same tab context.

For particularly sensitive datasets, use a dedicated domain or an origin that serves only this viewer. Short expiration periods and separate Zenodo links for individual recipients remain advisable regardless of the hosting origin.

## Network and data-source restrictions

The viewer accepts only the fixed Zenodo origin and the expected Zenodo record-file API paths. Arbitrary `?data=` sources and user-provided remote origins are not supported.

Network requests:

- omit ambient browser credentials;
- use a `no-referrer` policy;
- reject opaque or unexpected redirects;
- reject responses whose final origin is not `https://zenodo.org`;
- resolve the draft endpoint first and the published endpoint second.

Manifest scan IDs and filenames are validated. Point-cloud filenames must be simple filenames ending in `.copc.laz`; directory separators, traversal sequences, control characters, duplicate scan IDs, and unsupported data types or formats are rejected.

## COPC range-streaming safeguards

COPC data is loaded through explicit byte-range requests. The viewer:

- accepts only HTTP `206 Partial Content` responses;
- rejects a full-file HTTP `200` response before buffering its body;
- verifies the visible `Content-Length` against the requested byte count;
- validates `Content-Range` and the total file size whenever Zenodo exposes that header through CORS;
- rejects incomplete, contradictory, or unexpected byte ranges;
- deduplicates concurrent requests for the same range;
- keeps only a bounded in-memory range cache;
- spaces request starts by approximately 1.5 seconds, corresponding to about 40 starts per minute;
- performs bounded retries for HTTP `429` responses and respects `Retry-After` where available;
- clears access after authorization failures.

These controls preserve progressive COPC loading and reduce the risk of accidentally buffering an entire point-cloud file.

## Browser controls

The page applies a Content Security Policy that restricts scripts, styles, images, workers, and network connections to the sources required by the local viewer and Zenodo. The policy retains the inline-style and evaluation allowances required by the bundled Potree version. It also disables plugins and forms through `object-src 'none'` and `form-action 'none'`.

`no-referrer` limits unintended URL disclosure, while `noindex`, `nofollow`, `noarchive`, and `nosnippet` reduce accidental discoverability. These measures are defense in depth and do not replace careful handling of the secret link.

All viewer libraries are bundled locally; no executable code is loaded from a CDN. Untrusted HTML and arbitrary data sources are not accepted.

## Technical limitations

A static viewer cannot hide a bearer credential from a person who is already authorized to use it. An authorized recipient can inspect the token, Zenodo requests, and transferred point data with browser developer tools and can download or reconstruct the data.

This access model helps prevent public discovery and access without the link. It does not provide:

- person-bound authentication;
- digital rights management;
- prevention of downloads by authorized recipients;
- a server-side audit trail for individual viewer actions;
- protection after a recipient has copied the data.

A dedicated authentication and streaming service is required for person-bound accounts, centrally enforced access policies, download controls, or large numbers of simultaneous users. Zenodo is a research repository, not a high-load streaming CDN.

## Responding to a disclosed link

1. In Zenodo, delete the affected link under **Share → Links → Delete**.
2. Create a new, preferably time-limited link.
3. Send the new personal viewer link only to the intended recipients.
4. Check the Git history and public communication channels for the old token.
5. If a token entered the Git history, treat it as disclosed even after removing it from the latest revision.

## Third-party components

The viewer contains Potree and bundled open-source dependencies under their respective licenses. Existing license files remain under `viewer/vendor/`.

A pre-existing local patch in `viewer/vendor/potree/potree.js` propagates COPC range-streaming failures as Promise errors and prevents failed nodes from remaining in a request loop. The bilingual update does not alter this patch or any other file under `viewer/vendor/`.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and license information.
