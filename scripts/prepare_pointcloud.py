#!/usr/bin/env python3
"""Inspect SiteScape E57/PLY files and create RGB-preserving LAZ files."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import laspy
import numpy as np
import pye57


CHUNK_SIZE = 1_000_000


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def site_scape_ply(path: Path) -> tuple[np.memmap, int]:
    """Memory-map SiteScape's binary XYZRGB PLY representation."""
    with path.open("rb") as stream:
        lines: list[bytes] = []
        while True:
            line = stream.readline()
            if not line:
                raise ValueError("PLY header has no end_header marker")
            lines.append(line)
            if line.strip() == b"end_header":
                offset = stream.tell()
                break

    header = b"".join(lines).decode("ascii")
    required = {
        "format binary_little_endian 1.0",
        "property float x",
        "property float y",
        "property float z",
        "property uchar red",
        "property uchar green",
        "property uchar blue",
    }
    missing = sorted(required.difference(header.splitlines()))
    if missing:
        raise ValueError(f"Unsupported PLY layout; missing {missing}")
    vertex_lines = [line for line in header.splitlines() if line.startswith("element vertex ")]
    if len(vertex_lines) != 1:
        raise ValueError("PLY must contain exactly one vertex declaration")
    count = int(vertex_lines[0].split()[2])
    dtype = np.dtype(
        [("x", "<f4"), ("y", "<f4"), ("z", "<f4"),
         ("red", "u1"), ("green", "u1"), ("blue", "u1")]
    )
    expected = offset + count * dtype.itemsize
    if path.stat().st_size != expected:
        raise ValueError(f"PLY size mismatch: expected {expected}, got {path.stat().st_size}")
    return np.memmap(path, mode="r", dtype=dtype, offset=offset, shape=(count,)), offset


def e57_arrays(path: Path) -> tuple[dict[str, np.ndarray], dict[str, object]]:
    with pye57.E57(str(path)) as e57:
        if e57.scan_count != 1:
            raise ValueError(f"Expected one E57 scan, found {e57.scan_count}")
        header = e57.get_header(0)
        required = {"cartesianX", "cartesianY", "cartesianZ", "colorRed", "colorGreen", "colorBlue"}
        missing = sorted(required.difference(header.point_fields))
        if missing:
            raise ValueError(f"E57 lacks required XYZRGB fields: {missing}")
        data = e57.read_scan_raw(0)
        meta = {
            "points": int(header.point_count),
            "fields": list(header.point_fields),
            "bounds": {
                "x": [float(header.xMinimum), float(header.xMaximum)],
                "y": [float(header.yMinimum), float(header.yMaximum)],
                "z": [float(header.zMinimum), float(header.zMaximum)],
            },
            "pose_present": bool(header.has_pose()),
        }
    return data, meta


def xyzrgb_from_input(path: Path, ply_up: str) -> tuple[dict[str, np.ndarray], dict[str, object]]:
    suffix = path.suffix.lower()
    if suffix == ".e57":
        data, meta = e57_arrays(path)
        arrays = {
            "x": np.asarray(data["cartesianX"]),
            "y": np.asarray(data["cartesianY"]),
            "z": np.asarray(data["cartesianZ"]),
            "red": np.asarray(data["colorRed"]),
            "green": np.asarray(data["colorGreen"]),
            "blue": np.asarray(data["colorBlue"]),
        }
        meta["axis_conversion"] = "none (E57 retained as Z-up)"
        return arrays, meta

    if suffix == ".ply":
        ply, _ = site_scape_ply(path)
        if ply_up == "y":
            arrays = {
                "x": ply["x"], "y": -ply["z"], "z": ply["y"],
                "red": ply["red"], "green": ply["green"], "blue": ply["blue"],
            }
            conversion = "SiteScape Y-up to Z-up: (x, y, z) -> (x, -z, y)"
        else:
            arrays = {name: ply[name] for name in ply.dtype.names}
            conversion = "none (PLY treated as Z-up)"
        return arrays, {"points": len(ply), "axis_conversion": conversion}

    raise ValueError("Input must be .e57 or .ply")


def summarize(path: Path, arrays: dict[str, np.ndarray], meta: dict[str, object]) -> dict[str, object]:
    n = validate_arrays(arrays)
    result: dict[str, object] = {
        "file": path.name,
        "size_bytes": path.stat().st_size,
        "sha256": sha256(path),
        **meta,
        "points": n,
        "bounds": {},
        "rgb": {},
    }
    for axis in ("x", "y", "z"):
        values = np.asarray(arrays[axis])
        finite = np.isfinite(values)
        result["bounds"][axis] = [float(values.min()), float(values.max())]
        result.setdefault("non_finite_xyz", 0)
        result["non_finite_xyz"] += int(values.size - np.count_nonzero(finite))
    for channel in ("red", "green", "blue"):
        values = np.asarray(arrays[channel])
        result["rgb"][channel] = {
            "min": int(values.min()),
            "max": int(values.max()),
            "mean": float(values.mean()),
            "sum": int(np.sum(values, dtype=np.uint64)),
        }
    return result


def validate_arrays(arrays: dict[str, np.ndarray]) -> int:
    required = ("x", "y", "z", "red", "green", "blue")
    lengths = {field: len(arrays[field]) for field in required}
    if len(set(lengths.values())) != 1:
        raise ValueError(f"XYZRGB array lengths differ: {lengths}")
    n = lengths["x"]
    if n == 0:
        raise ValueError("Point cloud is empty")
    for axis in ("x", "y", "z"):
        if not np.all(np.isfinite(np.asarray(arrays[axis]))):
            raise ValueError(f"Non-finite coordinate found in {axis}")
    for channel in ("red", "green", "blue"):
        values = np.asarray(arrays[channel])
        if values.min() < 0 or values.max() > 255:
            raise ValueError(f"RGB channel {channel} is outside 0..255")
    return n


def make_las_header(mins: np.ndarray, maxs: np.ndarray, scale: float) -> laspy.LasHeader:
    if not np.isfinite(scale) or scale <= 0:
        raise ValueError("LAS scale must be a positive finite number")
    offsets = np.floor(mins)
    if np.any((maxs - offsets) / scale > np.iinfo(np.int32).max):
        raise ValueError("Chosen LAS scale is too fine for the coordinate extent")

    header = laspy.LasHeader(point_format=2, version="1.2")
    header.scales = np.array([scale, scale, scale])
    header.offsets = offsets
    header.system_identifier = "SiteScape XYZRGB"
    header.generating_software = "prepare_pointcloud.py"
    return header


def write_arrays(writer: laspy.LasWriter, header: laspy.LasHeader, arrays: dict[str, np.ndarray]) -> None:
    n = validate_arrays(arrays)
    for start in range(0, n, CHUNK_SIZE):
        stop = min(start + CHUNK_SIZE, n)
        points = laspy.ScaleAwarePointRecord.zeros(stop - start, header=header)
        points.x = np.asarray(arrays["x"][start:stop], dtype=np.float64)
        points.y = np.asarray(arrays["y"][start:stop], dtype=np.float64)
        points.z = np.asarray(arrays["z"][start:stop], dtype=np.float64)
        for target, source in (("red", "red"), ("green", "green"), ("blue", "blue")):
            setattr(points, target, np.asarray(arrays[source][start:stop], dtype=np.uint16) * 257)
        writer.write_points(points)


def write_laz(path: Path, arrays: dict[str, np.ndarray], scale: float) -> None:
    validate_arrays(arrays)
    mins = np.array([np.min(arrays[a]) for a in ("x", "y", "z")], dtype=np.float64)
    maxs = np.array([np.max(arrays[a]) for a in ("x", "y", "z")], dtype=np.float64)
    header = make_las_header(mins, maxs, scale)
    path.parent.mkdir(parents=True, exist_ok=True)

    with laspy.open(path, mode="w", header=header, do_compress=path.suffix.lower() == ".laz") as writer:
        write_arrays(writer, header, arrays)


def write_laz_set(
    path: Path,
    inputs: list[Path],
    scale: float,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    """Concatenate pose-free E57 files using one shared LAS scale and offset."""
    if len(inputs) < 2:
        raise ValueError("A multipart conversion requires at least two inputs")
    resolved = [item.resolve() for item in inputs]
    if len({str(item).casefold() for item in resolved}) != len(resolved):
        raise ValueError("The same input file was supplied more than once")
    if any(item.suffix.lower() != ".e57" for item in resolved):
        raise ValueError("Multipart conversion currently accepts E57 files only")

    reports: list[dict[str, object]] = []
    global_mins = np.full(3, np.inf, dtype=np.float64)
    global_maxs = np.full(3, -np.inf, dtype=np.float64)
    for input_path in resolved:
        arrays, meta = xyzrgb_from_input(input_path, "z")
        if meta.get("pose_present"):
            raise ValueError(
                f"{input_path.name} contains an E57 pose. "
                "This conservative multipart path accepts pose-free files only."
            )
        report = summarize(input_path, arrays, meta)
        reports.append(report)
        mins = np.array([report["bounds"][axis][0] for axis in ("x", "y", "z")])
        maxs = np.array([report["bounds"][axis][1] for axis in ("x", "y", "z")])
        global_mins = np.minimum(global_mins, mins)
        global_maxs = np.maximum(global_maxs, maxs)
        del arrays

    header = make_las_header(global_mins, global_maxs, scale)
    path.parent.mkdir(parents=True, exist_ok=True)
    with laspy.open(path, mode="w", header=header, do_compress=path.suffix.lower() == ".laz") as writer:
        for input_path, expected in zip(resolved, reports):
            arrays, meta = xyzrgb_from_input(input_path, "z")
            if meta.get("pose_present"):
                raise RuntimeError(f"E57 pose changed while reading {input_path.name}")
            if validate_arrays(arrays) != expected["points"]:
                raise RuntimeError(f"Point count changed while reading {input_path.name}")
            write_arrays(writer, header, arrays)
            del arrays

    output = inspect_laz(path)
    expected_points = sum(int(report["points"]) for report in reports)
    if output["points"] != expected_points:
        raise RuntimeError(
            f"Multipart point count mismatch: expected {expected_points}, got {output['points']}"
        )
    tolerance = scale / 2 + 1e-12
    for axis_index, axis in enumerate(("x", "y", "z")):
        output_bounds = [output["bounds"]["min"][axis_index], output["bounds"]["max"][axis_index]]
        expected_bounds = [float(global_mins[axis_index]), float(global_maxs[axis_index])]
        if max(abs(a - b) for a, b in zip(expected_bounds, output_bounds)) > tolerance:
            raise RuntimeError(f"Multipart round-trip bound mismatch on {axis}")
    expected_rgb16_sum = [
        sum(int(report["rgb"][channel]["sum"]) for report in reports) * 257
        for channel in ("red", "green", "blue")
    ]
    if output["sum_rgb16"] != expected_rgb16_sum:
        raise RuntimeError("Multipart RGB checksum mismatch")
    return reports, output


def inspect_laz(path: Path) -> dict[str, object]:
    with laspy.open(path) as reader:
        header = reader.header
        rgb_min = np.array([65535, 65535, 65535], dtype=np.uint16)
        rgb_max = np.zeros(3, dtype=np.uint16)
        rgb_sum = np.zeros(3, dtype=object)
        for points in reader.chunk_iterator(CHUNK_SIZE):
            rgb = np.column_stack((points.red, points.green, points.blue))
            rgb_min = np.minimum(rgb_min, rgb.min(axis=0))
            rgb_max = np.maximum(rgb_max, rgb.max(axis=0))
            for index, values in enumerate((points.red, points.green, points.blue)):
                rgb_sum[index] += int(np.sum(values, dtype=np.uint64))
        return {
            "file": path.name,
            "size_bytes": path.stat().st_size,
            "sha256": sha256(path),
            "points": int(header.point_count),
            "point_format": int(header.point_format.id),
            "las_version": str(header.version),
            "scales": header.scales.tolist(),
            "offsets": header.offsets.tolist(),
            "bounds": {"min": header.mins.tolist(), "max": header.maxs.tolist()},
            "rgb16_min": rgb_min.astype(int).tolist(),
            "rgb16_max": rgb_max.astype(int).tolist(),
            "sum_rgb16": [int(value) for value in rgb_sum],
            "crs": str(header.parse_crs()) if header.parse_crs() else None,
        }


def aggregate_las(path: Path) -> dict[str, object]:
    """Compute order-independent checksums for a LAS/LAZ or COPC file."""
    with laspy.open(path) as reader:
        header = reader.header
        result: dict[str, object] = {
            "file": path.name,
            "size_bytes": path.stat().st_size,
            "sha256": sha256(path),
            "points": int(header.point_count),
            "las_version": str(header.version),
            "point_format": int(header.point_format.id),
            "scales": header.scales.tolist(),
            "offsets": header.offsets.tolist(),
            "bounds": {"min": header.mins.tolist(), "max": header.maxs.tolist()},
            "sum_raw_xyz": [0, 0, 0],
            "sumsq_raw_xyz_mod_2_64": [0, 0, 0],
            "sum_rgb16": [0, 0, 0],
        }
        modulus = 1 << 64
        for points in reader.chunk_iterator(CHUNK_SIZE):
            for index, values in enumerate((points.X, points.Y, points.Z)):
                signed = np.asarray(values, dtype=np.int64)
                unsigned = signed.astype(np.uint64)
                result["sum_raw_xyz"][index] += int(np.sum(signed, dtype=np.int64))
                square_sum = int(np.sum(unsigned * unsigned, dtype=np.uint64))
                result["sumsq_raw_xyz_mod_2_64"][index] = (
                    result["sumsq_raw_xyz_mod_2_64"][index] + square_sum
                ) % modulus
            for index, values in enumerate((points.red, points.green, points.blue)):
                result["sum_rgb16"][index] += int(np.sum(values, dtype=np.uint64))
        return result


def command_inspect(args: argparse.Namespace) -> None:
    arrays, meta = xyzrgb_from_input(args.input, args.ply_up)
    report = summarize(args.input, arrays, meta)
    print(json.dumps(report, indent=2, ensure_ascii=False))


def command_convert(args: argparse.Namespace) -> None:
    arrays, meta = xyzrgb_from_input(args.input, args.ply_up)
    source_report = summarize(args.input, arrays, meta)
    write_laz(args.output, arrays, args.scale)
    output_report = inspect_laz(args.output)
    tolerance = args.scale / 2 + 1e-12
    for i, axis in enumerate(("x", "y", "z")):
        source_bounds = source_report["bounds"][axis]
        output_bounds = [output_report["bounds"]["min"][i], output_report["bounds"]["max"][i]]
        if max(abs(a - b) for a, b in zip(source_bounds, output_bounds)) > tolerance:
            raise RuntimeError(f"Round-trip bound mismatch on {axis}")
    if source_report["points"] != output_report["points"]:
        raise RuntimeError("Round-trip point count mismatch")
    report = {"source": source_report, "output": output_report, "status": "validated"}
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


def command_convert_set(args: argparse.Namespace) -> None:
    if not args.assume_common_coordinates:
        raise ValueError(
            "Multipart E57 files have no portable proof of a shared coordinate frame. "
            "Inspect their headers first and pass --assume-common-coordinates deliberately."
        )
    sources, output = write_laz_set(args.output, args.input, args.scale)
    report = {
        "sources": sources,
        "merge": {
            "mode": "direct concatenation; no registration, resampling, or deduplication",
            "assumption": "all input E57 coordinates share one coordinate frame",
            "input_order": [item.name for item in args.input],
            "expected_points": sum(int(item["points"]) for item in sources),
        },
        "output": output,
        "serialization_status": "validated",
        "registration_status": "pending visual seam check",
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


def command_compare(args: argparse.Namespace) -> None:
    e57_arrays_, e57_meta = xyzrgb_from_input(args.e57, "z")
    ply_arrays, ply_meta = xyzrgb_from_input(args.ply, "y")
    if len(e57_arrays_["x"]) != len(ply_arrays["x"]):
        raise RuntimeError("E57 and PLY point counts differ")
    comparison: dict[str, object] = {}
    for field in ("x", "y", "z", "red", "green", "blue"):
        mismatches = 0
        maximum_difference = 0.0
        for start in range(0, len(e57_arrays_[field]), CHUNK_SIZE):
            stop = min(start + CHUNK_SIZE, len(e57_arrays_[field]))
            left = np.asarray(e57_arrays_[field][start:stop], dtype=np.float64)
            right = np.asarray(ply_arrays[field][start:stop], dtype=np.float64)
            delta = np.abs(left - right)
            mismatches += int(np.count_nonzero(delta))
            maximum_difference = max(maximum_difference, float(delta.max(initial=0)))
        comparison[field] = {
            "mismatching_points": mismatches,
            "maximum_absolute_difference": maximum_difference,
        }
    report = {
        "e57": {"file": args.e57.name, "points": len(e57_arrays_["x"]), **e57_meta},
        "ply": {"file": args.ply.name, "points": len(ply_arrays["x"]), **ply_meta},
        "comparison_after_axis_normalization": comparison,
        "identical_xyzrgb": all(item["mismatching_points"] == 0 for item in comparison.values()),
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


def command_validate_copc(args: argparse.Namespace) -> None:
    source = aggregate_las(args.source)
    copc = aggregate_las(args.copc)
    exact_fields = (
        "points",
        "scales",
        "offsets",
        "sum_raw_xyz",
        "sumsq_raw_xyz_mod_2_64",
        "sum_rgb16",
    )
    matching = {field: source[field] == copc[field] for field in exact_fields}
    bound_deltas = [
        abs(source["bounds"][side][axis] - copc["bounds"][side][axis])
        for side in ("min", "max")
        for axis in range(3)
    ]
    matching["bounds_within_one_scale_unit"] = max(bound_deltas) <= max(source["scales"]) + 1e-12

    from laspy.copc import CopcReader

    with CopcReader.open(str(args.copc)) as reader:
        lod_queries = {}
        for resolution in args.resolution:
            points = reader.query(resolution=resolution)
            lod_queries[str(resolution)] = {
                "points": len(points),
                "rgb16_min": [int(points.red.min()), int(points.green.min()), int(points.blue.min())],
                "rgb16_max": [int(points.red.max()), int(points.green.max()), int(points.blue.max())],
            }

    report = {
        "source": source,
        "copc": copc,
        "matching": matching,
        "maximum_header_bound_delta": max(bound_deltas),
        "lod_queries": lod_queries,
        "status": "validated" if all(matching.values()) else "mismatch",
    }
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if not all(matching.values()):
        raise RuntimeError("COPC validation failed")


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    sub = result.add_subparsers(dest="command", required=True)
    inspect = sub.add_parser("inspect", help="Inspect an E57 or SiteScape PLY")
    inspect.add_argument("input", type=Path)
    inspect.add_argument("--ply-up", choices=("y", "z"), default="y")
    inspect.set_defaults(func=command_inspect)
    convert = sub.add_parser("convert", help="Convert an E57 or SiteScape PLY to LAS/LAZ")
    convert.add_argument("input", type=Path)
    convert.add_argument("output", type=Path)
    convert.add_argument("--ply-up", choices=("y", "z"), default="y")
    convert.add_argument("--scale", type=float, default=1e-6)
    convert.add_argument("--report", type=Path)
    convert.set_defaults(func=command_convert)
    convert_set = sub.add_parser(
        "convert-set",
        help="Concatenate pose-free E57 parts into one LAS/LAZ without changing points",
    )
    convert_set.add_argument("output", type=Path)
    convert_set.add_argument("input", type=Path, nargs="+")
    convert_set.add_argument("--scale", type=float, default=1e-6)
    convert_set.add_argument("--report", type=Path)
    convert_set.add_argument("--assume-common-coordinates", action="store_true")
    convert_set.set_defaults(func=command_convert_set)
    compare = sub.add_parser("compare", help="Compare matching SiteScape E57 and PLY files")
    compare.add_argument("e57", type=Path)
    compare.add_argument("ply", type=Path)
    compare.add_argument("--report", type=Path)
    compare.set_defaults(func=command_compare)
    validate_copc = sub.add_parser(
        "validate-copc",
        help="Compare a source LAZ with a converted COPC and exercise LOD queries",
    )
    validate_copc.add_argument("source", type=Path)
    validate_copc.add_argument("copc", type=Path)
    validate_copc.add_argument("--resolution", type=float, action="append", default=[0.5, 0.01])
    validate_copc.add_argument("--report", type=Path)
    validate_copc.set_defaults(func=command_validate_copc)
    return result


if __name__ == "__main__":
    arguments = parser().parse_args()
    arguments.func(arguments)
