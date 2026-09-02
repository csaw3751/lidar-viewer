# Third-Party Notices

The web directory contains Potree 1.8.0 and the open-source libraries bundled with Potree. The applicable license texts are stored alongside their components at:

- `viewer/vendor/potree/LICENSE`
- `viewer/vendor/potree/resources/LICENSE`
- `viewer/vendor/potree/resources/textures/LICENSE`
- `viewer/vendor/libs/**/LICENSE*`

`viewer/vendor/potree/potree.js` contains a small patch from the uploaded baseline. The patch propagates COPC Range-streaming failures as Promise rejections and prevents failed nodes from becoming stuck in a request loop. The Potree license notice remains unchanged.

The retained upstream vendor tree also contains example/model assets that this viewer does not require, including the `brick_pavement.jpg` texture, as well as server-oriented files such as `image_preview.php`. None of these assets is referenced by the viewer. GitHub Pages serves PHP files as static content and does not execute them; the files remain present so the vendored distribution is not altered.

No additional public-use license is granted with this package for the custom integration and UI code. This does not affect any rights granted under the included open-source licenses.
