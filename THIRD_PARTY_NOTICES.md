# Third-party notices

## Scope

The web distribution contains Potree 1.8.0 and open-source libraries bundled with or used by Potree. The applicable license and resource notices remain with the corresponding components, including:

- `viewer/vendor/potree/LICENSE`
- `viewer/vendor/potree/resources/LICENSE`
- `viewer/vendor/potree/resources/textures/LICENSE`
- adjacent `LICENSE` or `LICENSE.*` files under `viewer/vendor/libs/`

Those files remain authoritative for the components and resources they cover. This document supplements them and does not replace or modify any third-party license.

The bilingual update changes first-party application code, documentation, and tests only. It does not add, remove, translate, or modify files under `viewer/vendor/`.

## Potree

Potree is distributed under the terms recorded in:

- `viewer/vendor/potree/LICENSE`

A pre-existing project-specific patch is present in `viewer/vendor/potree/potree.js`. It propagates COPC range-streaming failures as Promise errors and prevents failed nodes from remaining in a request loop. Potree's copyright and license notice remain unchanged. The bilingual update does not modify this patch.

The current vendor tree includes upstream resources such as:

- `viewer/vendor/potree/resources/textures/brick_pavement.jpg`
- `viewer/vendor/potree/resources/icons/image_preview.php`

In particular, `brick_pavement.jpg` is included; it is not excluded from the release tree. Its separate resource terms are recorded in `viewer/vendor/potree/resources/textures/LICENSE` and must be considered independently of Potree's software license. GitHub Pages serves the `.php` file as a static asset and does not execute it as server-side PHP.

## Other bundled libraries

Additional bundled libraries retain their own adjacent license files where provided. Principal locations include `viewer/vendor/libs/` and Potree's resource and lazy-library directories. Redistribution must preserve all applicable notices in those directories.

## copc.js

The browser viewer includes a bundled build of [copc.js](https://github.com/connormanning/copc.js) at:

- `viewer/vendor/libs/copc/index.js`

The copc.js license is reproduced here because the current bundled directory does not contain an adjacent standalone copy.

### copc.js MIT license

```text
MIT License

Copyright (c) 2021 Connor Manning

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## copc-converter

The preprocessing workflow in `scripts/build_scan.ps1` downloads and verifies a pinned release of [copc-converter](https://github.com/360-geo/copc-converter) for local LAZ-to-COPC conversion. The converter is preprocessing tooling and is not part of the deployed `viewer/` site.

### copc-converter MIT license

```text
MIT License

Copyright (c) 2026 George Boot

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Project-specific code

Except where a third-party license expressly provides otherwise, this package grants no additional public-use license for the project-specific integration code, user interface, protected Zenodo access layer, preprocessing scripts, tests, documentation, or GitHub Pages workflow.

This statement does not restrict or alter any rights granted by the third-party licenses and notices included with their respective components.
