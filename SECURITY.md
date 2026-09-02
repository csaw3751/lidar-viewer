# Security Guidance

## Secret links

Zenodo secret links are bearer credentials: anyone with the complete link receives the associated permission. Therefore:

- create a separate link with an expiration date for each recipient;
- send links only through direct communication;
- immediately delete any accidentally disclosed links in Zenodo;
- never use a personal Zenodo API token;
- never commit a `token`, `record`, or complete viewer link to Git.

The viewer reads `record` and `token` only from the URL fragment. After validation, it removes the fragment using `history.replaceState`. For page reloads and scan changes, access is held exclusively in the current tab's `sessionStorage`; it survives neither the closing of all copies of the tab nor the **Remove access from this tab** command.

`sessionStorage` is partitioned by web origin, not by repository path. Other JavaScript pages on the same `https://USERNAME.github.io` origin could read the entry within the same tab. For particularly sensitive use cases, the viewer should therefore be the only Pages application on that origin or should use a dedicated domain. Short expiration periods and separate Zenodo links for each person remain advisable in either case.

## Technical limitations

A static viewer cannot conceal a secret link from a person who is already authorized. That person can inspect the token and transferred point data in the browser's developer tools. The agreed model prevents public discovery and access without the link, but it does not prevent downloads by authorized users.

A dedicated authentication and streaming service would be required for actual user-specific authentication, download restrictions, or large numbers of concurrent users. Zenodo is a repository, not a high-load CDN.

## Responding to a disclosed link

1. In Zenodo, delete the affected link under **Share → Links → Delete**.
2. Create a new, time-limited link.
3. Send the new viewer link only to its intended recipients.
4. Check the Git history and public communication channels; no token may remain there.

## Third-party components

The viewer includes Potree and its bundled open-source dependencies under their respective licenses. License files remain in `viewer/vendor/`. The older, locally bundled libraries do not load code from CDNs; untrusted HTML and arbitrary data sources are not permitted.
