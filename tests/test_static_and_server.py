from __future__ import annotations

import hashlib
import http.client
import importlib.util
import re
import threading
import unittest
from functools import partial
from pathlib import Path
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[1]
VIEWER = ROOT / "viewer"
EXPECTED_VENDOR_DIGEST = "fff2b80c7ffe13daeb7919974aef7bf14550d0e8afaa27615a82748fcdd5d10c"


class StaticSecurityTests(unittest.TestCase):
    def test_release_contains_no_scan_payload(self) -> None:
        forbidden = {".laz", ".e57", ".ply", ".glb"}
        payloads = [
            path for path in (VIEWER / "data").rglob("*")
            if path.suffix.lower() in forbidden
        ]
        self.assertEqual(payloads, [])

    def test_shell_has_privacy_controls_and_no_fixed_record(self) -> None:
        html = (VIEWER / "index.html").read_text(encoding="utf-8")
        config = (VIEWER / "config.js").read_text(encoding="utf-8")
        app = (VIEWER / "app.js").read_text(encoding="utf-8")
        i18n = (VIEWER / "i18n.js").read_text(encoding="utf-8")
        custom_files = [
            ROOT / "README.md",
            ROOT / "README.de.md",
            ROOT / "QA_REPORT.md",
            ROOT / "SECURITY.md",
            ROOT / "THIRD_PARTY_NOTICES.md",
            ROOT / ".github" / "workflows" / "deploy-pages.yml",
            ROOT / "scripts" / "build_scan.ps1",
            ROOT / "scripts" / "prepare_pointcloud.py",
            ROOT / "scripts" / "serve_viewer.py",
            ROOT / "tests" / "test_i18n.mjs",
            ROOT / "tests" / "test_zenodo_access.mjs",
            ROOT / "tests" / "test_static_and_server.py",
            VIEWER / "index.html",
            VIEWER / "config.js",
            VIEWER / "zenodo-access.js",
            VIEWER / "i18n.js",
            VIEWER / "app.js",
            VIEWER / "styles.css",
            VIEWER / "data" / "README.md",
        ]
        all_custom = "\n".join(path.read_text(encoding="utf-8") for path in custom_files)

        self.assertIn('name="referrer" content="no-referrer"', html)
        self.assertIn("Content-Security-Policy", html)
        self.assertIn("noindex, nofollow", html)
        scripts = re.findall(r'<script\s+[^>]*src="([^"]+)"', html)
        self.assertEqual(scripts[:2], ["zenodo-access.js", "i18n.js"])
        self.assertIn("object-src 'none'", html)
        self.assertIn("base-uri 'none'", html)
        self.assertIn("form-action 'none'", html)
        forbidden_record = "222" + "36919"
        self.assertNotIn(forbidden_record, all_custom)
        self.assertNotRegex(all_custom, r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")
        self.assertNotIn("queryDataUrl", app)
        self.assertNotIn("?data=", app)
        self.assertNotIn("dataUrl:", config)
        self.assertNotIn("sessionStorage", i18n)
        self.assertNotIn("localStorage", (VIEWER / "zenodo-access.js").read_text(encoding="utf-8"))
        self.assertNotEqual(
            "lidar-viewer.language.v1",
            "lidar-viewer.zenodo-access.v1",
        )

    def test_vendor_tree_is_byte_identical_to_the_uploaded_baseline(self) -> None:
        vendor = VIEWER / "vendor"
        digest = hashlib.sha256()
        files = sorted(
            (path for path in vendor.rglob("*") if path.is_file()),
            key=lambda path: path.relative_to(vendor).parts,
        )
        self.assertEqual(len(files), 414)
        for path in files:
            digest.update(path.relative_to(vendor).as_posix().encode("utf-8"))
            digest.update(b"\0")
            digest.update(hashlib.sha256(path.read_bytes()).digest())
        self.assertEqual(digest.hexdigest(), EXPECTED_VENDOR_DIGEST)

    def test_potree_patch_propagates_copc_failures(self) -> None:
        potree = (VIEWER / "vendor" / "potree" / "potree.js").read_text(encoding="utf-8")
        self.assertIn("await geometry.root.load();", potree)
        self.assertIn("}).catch(reject);", potree)
        self.assertIn("this.loaded || this.loading || this.failed", potree)
        self.assertIn("potree_pointcloud_error", potree)

    def test_render_quality_profiles_are_available_and_separate_from_access(self) -> None:
        html = (VIEWER / "index.html").read_text(encoding="utf-8")
        config = (VIEWER / "config.js").read_text(encoding="utf-8")
        app = (VIEWER / "app.js").read_text(encoding="utf-8")
        access = (VIEWER / "zenodo-access.js").read_text(encoding="utf-8")

        self.assertIn('id="quality-selector"', html)
        for mode, label in (("auto", "Auto"), ("high", "High"), ("maximum", "Maximum")):
            self.assertRegex(
                html,
                rf'<option value="{mode}" data-lidar-i18n="quality\.{mode}">{label}</option>',
            )

        self.assertIn("desktopPointBudget: 9_000_000", config)
        self.assertIn("compactPointBudget: 3_500_000", config)
        self.assertIn("state.viewer.setPointBudget(pointBudget)", app)
        self.assertIn("state.viewer.setMinNodeSize(profile.minNodeSize)", app)
        self.assertIn("Potree.PointShape[profile.shape]", app)
        self.assertIn('QUALITY_STORAGE_KEY = "lidar-viewer.render-quality.v1"', app)
        self.assertNotIn("localStorage", access)

    def test_localised_labels_do_not_change_exported_object_names(self) -> None:
        app = (VIEWER / "app.js").read_text(encoding="utf-8")

        self.assertIn("object.name = englishText(key)", app)
        self.assertNotIn("object.name = t(key)", app)
        self.assertIn('name: englishText("measurement.distance")', app)
        self.assertIn('name: englishText("measurement.profile")', app)
        self.assertIn('name: englishText("measurement.clipBox")', app)
        self.assertIn("if (object.name !== englishText(key))", app)
        for event in (
            "measurement_removed",
            "profile_removed",
            "volume_removed",
            "polygon_clip_volume_removed",
        ):
            self.assertIn(f'addEventListener("{event}"', app)

    def test_profile_completion_listener_is_cleaned_up(self) -> None:
        app = (VIEWER / "app.js").read_text(encoding="utf-8")

        self.assertIn("activeInsertionCleanup", app)
        self.assertIn(
            'viewer.renderer.domElement.removeEventListener("mouseup", openFinishedProfile)',
            app,
        )

    def test_static_shell_is_english_and_uses_isolated_translation_attributes(self) -> None:
        html = (VIEWER / "index.html").read_text(encoding="utf-8")
        css = (VIEWER / "styles.css").read_text(encoding="utf-8")

        self.assertIn('<html lang="en">', html)
        self.assertIn("<title>Protected LiDAR Viewer</title>", html)
        self.assertIn("How to use the viewer", html)
        self.assertIn('data-language="de"', html)
        self.assertIn('data-language="en"', html)
        self.assertNotRegex(html, r"\sdata-i18n(?:=|\s)")
        self.assertIn("data-lidar-i18n", html)
        self.assertIn("#potree_languages", css)
        self.assertIn("display: none !important", css)


class LocalServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        spec = importlib.util.spec_from_file_location("serve_viewer", ROOT / "scripts" / "serve_viewer.py")
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        spec.loader.exec_module(module)
        cls.module = module

    def test_directory_index_and_byte_range(self) -> None:
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "index.html").write_text("viewer-ok", encoding="utf-8")
            (root / "sample.bin").write_bytes(b"0123456789")
            handler = partial(self.module.RangeRequestHandler, directory=str(root))
            server = self.module.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
                connection.request("GET", "/")
                response = connection.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(response.read(), b"viewer-ok")
                connection.close()

                connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
                connection.request("GET", "/sample.bin", headers={"Range": "bytes=2-5"})
                response = connection.getresponse()
                self.assertEqual(response.status, 206)
                self.assertEqual(response.getheader("Content-Range"), "bytes 2-5/10")
                self.assertEqual(response.read(), b"2345")
                connection.close()
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
