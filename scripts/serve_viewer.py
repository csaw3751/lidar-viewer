#!/usr/bin/env python3
"""Serve the Potree viewer locally with HTTP byte-range and CORS support."""

from __future__ import annotations

import argparse
import os
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")


class RangeRequestHandler(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Range, Content-Type")
        self.send_header("Access-Control-Expose-Headers", "Accept-Ranges, Content-Length, Content-Range")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def send_head(self):
        # A handler instance may serve more than one HTTP/1.1 request.  Reset
        # the per-request range state before every response, including the
        # directory/index path delegated to SimpleHTTPRequestHandler.
        self._range = None
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return super().send_head()

        try:
            source = open(path, "rb")
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return None

        try:
            size = os.fstat(source.fileno()).st_size
            content_type = self.guess_type(path)
            range_header = self.headers.get("Range")
            if not range_header:
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(size))
                self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
                self.end_headers()
                return source

            match = RANGE_RE.fullmatch(range_header.strip())
            if not match:
                self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                source.close()
                return None

            start_text, end_text = match.groups()
            if not start_text and not end_text:
                self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                source.close()
                return None

            if start_text:
                start = int(start_text)
                end = int(end_text) if end_text else size - 1
            else:
                suffix_length = int(end_text)
                start = max(size - suffix_length, 0)
                end = size - 1

            if start >= size or end < start:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                source.close()
                return None

            end = min(end, size - 1)
            length = end - start + 1
            source.seek(start)
            self.send_response(HTTPStatus.PARTIAL_CONTENT)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(length))
            self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
            self.end_headers()
            self._range = (start, end)
            return source
        except Exception:
            source.close()
            raise

    def copyfile(self, source, outputfile) -> None:
        byte_range = getattr(self, "_range", None)
        if byte_range is None:
            return super().copyfile(source, outputfile)

        start, end = byte_range
        remaining = end - start + 1
        while remaining:
            block = source.read(min(1024 * 1024, remaining))
            if not block:
                break
            outputfile.write(block)
            remaining -= len(block)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--directory",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "viewer",
    )
    args = parser.parse_args()

    directory = args.directory.resolve()
    handler = lambda *a, **kw: RangeRequestHandler(*a, directory=str(directory), **kw)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Viewer: http://{args.host}:{args.port}/index.html", flush=True)
    print(f"Root:   {directory}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
