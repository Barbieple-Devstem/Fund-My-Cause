#!/usr/bin/env python3
"""Check a compiled WASM artifact against a configured size budget."""

import argparse
import os
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate that a generated WASM artifact stays under the configured size budget."
    )
    parser.add_argument(
        "--artifact",
        required=True,
        help="Path to the .wasm artifact to inspect.",
    )
    parser.add_argument(
        "--budget",
        type=int,
        default=262_144,
        help="Maximum allowed size in bytes. Default: 256 KiB.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    artifact = args.artifact

    if not os.path.exists(artifact):
        print(f"ERROR: artifact not found: {artifact}", file=sys.stderr)
        return 2

    size = os.path.getsize(artifact)
    budget = args.budget
    print(f"artifact={artifact}")
    print(f"size_bytes={size}")
    print(f"budget_bytes={budget}")

    if size > budget:
        print(
            f"FAIL: WASM artifact exceeds budget by {size - budget} bytes.",
            file=sys.stderr,
        )
        return 1

    print("PASS: WASM artifact is within the configured size budget.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
