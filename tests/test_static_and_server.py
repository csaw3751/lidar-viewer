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
VENDOR = VIEWER / "vendor"
VENDOR_TREE_SHA = "9a6e32c2cf6690b8efc8163e8e98f61b8abf3c7f"


def git_blob_oid(path: Path) -> bytes:
    payload = path.read_bytes()
    header = f"blob {len(payload)}\0".encode("ascii")
    return hashlib.sha1(header + payload).digest()


def git_tree_oid(directory: Path) -> bytes:
    children = sorted(
        directory.iterdir(),
        key=lambda path: path.name.encode("utf-8") + (b"/" if path.is_dir() else b""),
    )
    entries = []
    for path in children:
        name = path.name.encode("utf-8")
        if path.is_symlink():
            raise AssertionError(f"Unexpected symbolic link in vendor tree: {path}")
        if path.is_dir():
            mode = b"40000"
            oid = git_tree_oid(path)
        elif path.is_file():
            mode = b"100644"
            oid = git_blob_oid(path)
        else:
            raise AssertionError(f"Unexpected filesystem entry in vendor tree: {path}")
        entries.append(mode + b" " + name + b"\0" + oid)

    payload = b"".join(entries)
    header = f"tree {len(payload)}\0".encode("ascii")
    return hashlib.sha1(header + payload).digest()


class StaticSecurityTests(unittest.TestCase):
    def test_release_contains_no_scan_payload(self) -> None:
        forbidden = {".laz", ".e57", ".ply", ".glb"}
        payloads = [
            path for path in (VIEWER / "data").rglob("*")
            if path.suffix.lower() in forbidden
        ]
        self.assertEqual(payloads, [])

    def test_shell_preserves_privacy_controls_and_secret_first_script_order(self) -> None:
        html = (VIEWER / "index.html").read_text(encoding="utf-8")
        config = (VIEWER / "config.js").read_text(encoding="utf-8")
        app = (VIEWER / "app.js").read_text(encoding="utf-8")
        access = (VIEWER / "zenodo-access.js").read_text(encoding="utf-8")
        i18n = (VIEWER / "i18n.js").read_text(encoding="utf-8")

        custom_suffixes = {
            ".css", ".html", ".js", ".json", ".md", ".mjs", ".ps1",
            ".py", ".txt", ".yaml", ".yml",
        }
        custom_files = [
            path for path in ROOT.rglob("*")
            if path.is_file()
            and VENDOR not in path.parents
            and ".git" not in path.parts
            and path.suffix.lower() in custom_suffixes
        ]
        all_custom = "\n".join(path.read_text(encoding="utf-8") for path in custom_files)

        self.assertIn('name="referrer" content="no-referrer"', html)
        self.assertIn("Content-Security-Policy", html)
        self.assertIn("connect-src 'self' https://zenodo.org", html)
        self.assertIn("object-src 'none'", html)
        self.assertIn("base-uri 'none'", html)
        self.assertIn("form-action 'none'", html)
        self.assertIn("noindex, nofollow", html)

        scripts = re.findall(r'<script\b[^>]*\bsrc="([^"]+)"', html, flags=re.IGNORECASE)
        self.assertGreater(len(scripts), 1)
        self.assertEqual(scripts[0], "zenodo-access.js")
        vendor_indexes = [index for index, source in enumerate(scripts) if source.startswith("vendor/")]
        self.assertTrue(vendor_indexes)
        self.assertLess(scripts.index("zenodo-access.js"), min(vendor_indexes))
        self.assertLess(scripts.index("i18n.js"), scripts.index("app.js"))

        forbidden_record = "222" + "36919"
        self.assertNotIn(forbidden_record, all_custom)
        self.assertNotRegex(
            all_custom,
            r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",
        )
        self.assertNotIn("queryDataUrl", app)
        self.assertNotIn("?data=", app)
        self.assertNotIn("dataUrl:", config)
        self.assertNotIn("localStorage", access)
        self.assertIn('STORAGE_KEY = "lidar-viewer.language.v1"', i18n)
        self.assertNotIn("lidar-viewer.zenodo-access.v1", i18n)

    def test_static_fallback_is_english_and_complete_translation_bindings_exist(self) -> None:
        html = (VIEWER / "index.html").read_text(encoding="utf-8")
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        german_readme = (ROOT / "README.de.md").read_text(encoding="utf-8")

        self.assertRegex(html, r'<html\s+lang="en">')
        for english_fallback in (
            "Protected LiDAR Viewer",
            "LiDAR point cloud",
            "Quality",
            "High",
            "Analysis tools",
            "Viewer is loading",
            "How to use the viewer",
            "Dataset",
            "Remove analyses?",
        ):
            self.assertIn(english_fallback, html)

        for german_fallback in (
            "Geschützter LiDAR-Viewer",
            "Punktwolke wird vorbereitet",
            "Bedienungshilfe",
            "Auswertungen entfernen?",
        ):
            self.assertNotIn(german_fallback, html)

        text_bindings = re.findall(r'\bdata-lidar-i18n="([^"]+)"', html)
        title_bindings = re.findall(r'\bdata-lidar-i18n-title="([^"]+)"', html)
        aria_bindings = re.findall(r'\bdata-lidar-i18n-aria-label="([^"]+)"', html)
        content_bindings = re.findall(r'\bdata-lidar-i18n-content="([^"]+)"', html)
        self.assertGreaterEqual(len(set(text_bindings)), 45)
        self.assertGreaterEqual(len(set(title_bindings)), 10)
        self.assertGreaterEqual(len(set(aria_bindings)), 10)
        self.assertGreaterEqual(len(set(content_bindings)), 1)
        self.assertNotIn("", text_bindings + title_bindings + aria_bindings + content_bindings)
        self.assertNotRegex(html, r"\bdata-i18n(?:=|-)")
        self.assertGreaterEqual(html.count('inert aria-hidden="true"'), 3)
        self.assertEqual(len(re.findall(r'\bdata-language-selector\b', html)), 2)
        self.assertIn('<option value="en">EN</option>', html)
        self.assertIn('<option value="de">DE</option>', html)

        self.assertTrue(readme.strip())
        self.assertTrue(german_readme.strip())
        self.assertIn("README.de.md", readme)

    def test_vendor_tree_is_byte_for_byte_unchanged(self) -> None:
        self.assertTrue(VENDOR.is_dir())
        self.assertEqual(git_tree_oid(VENDOR).hex(), VENDOR_TREE_SHA)

    def test_potree_patch_propagates_copc_failures(self) -> None:
        potree = (VENDOR / "potree" / "potree.js").read_text(encoding="utf-8")
        self.assertIn("await geometry.root.load();", potree)
        self.assertIn("}).catch(reject);", potree)
        self.assertIn("this.loaded || this.loading || this.failed", potree)
        self.assertIn("potree_pointcloud_error", potree)

    def test_render_quality_profiles_are_available_and_separate_from_access(self) -> None:
        html = (VIEWER / "index.html").read_text(encoding="utf-8")
        config = (VIEWER / "config.js").read_text(encoding="utf-8")
        app = (VIEWER / "app.js").read_text(encoding="utf-8")
        styles = (VIEWER / "styles.css").read_text(encoding="utf-8")
        access = (VIEWER / "zenodo-access.js").read_text(encoding="utf-8")

        self.assertIn('id="quality-selector"', html)
        for mode, label in (("auto", "Auto"), ("high", "High"), ("maximum", "Maximum")):
            self.assertRegex(
                html,
                rf'<option\b[^>]*\bvalue="{mode}"[^>]*>{label}</option>',
            )

        self.assertIn("desktopPointBudget: 9_000_000", config)
        self.assertIn("compactPointBudget: 3_500_000", config)
        self.assertIn("state.viewer.setPointBudget(pointBudget)", app)
        self.assertIn("state.viewer.setMinNodeSize(profile.minNodeSize)", app)
        self.assertIn("Potree.PointShape[profile.shape]", app)
        self.assertIn('QUALITY_STORAGE_KEY = "lidar-viewer.render-quality.v1"', app)
        self.assertIn("window.LidarI18n", app)
        self.assertIn("viewer.setLanguage(i18n.language)", app)
        self.assertIn("new Intl.NumberFormat(currentLocale()", app)
        self.assertIn('potreeI18n.addResources("de", "translation", supplement)', app)
        self.assertIn("tree.rename_node(node, t(translationKey))", app)
        self.assertIn('"camera_animation_added"', app)
        self.assertIn('"oriented_images_added"', app)
        self.assertIn('"360_images_added"', app)
        self.assertIn("setLoadingOverlayVisible(false)", app)
        self.assertIn('toggleAttribute("inert"', app)
        self.assertIn("@media (max-width: 390px)", styles)
        self.assertIn("@media (max-width: 340px)", styles)
        self.assertNotIn("localStorage", access)


class LocalServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        spec = importlib.util.spec_from_file_location(
            "serve_viewer",
            ROOT / "scripts" / "serve_viewer.py",
        )
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
                connection = http.client.HTTPConnection(
                    "127.0.0.1",
                    server.server_port,
                    timeout=5,
                )
                connection.request("GET", "/")
                response = connection.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(response.read(), b"viewer-ok")
                connection.close()

                connection = http.client.HTTPConnection(
                    "127.0.0.1",
                    server.server_port,
                    timeout=5,
                )
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
