#!/usr/bin/env python3
"""Build, check and screenshot a diagram document in one command.

Usage: render.py <document.json> --out <dir> [--widths 1200,390] [--check-only]

Builds a self-contained preview, verifies it over file:// with headless Chrome,
and joins screenshots into a review sheet when the document has two or more
frames. Default evidence is the 1200px desktop viewport; add 390 only when the
target display scenario includes phones. --check-only runs the geometry and
semantic checks without capturing screenshots, for fast fix iterations.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).parent))
from build import build  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='JSON document containing title and frames')
    parser.add_argument('--out', type=Path, required=True, help='output directory')
    parser.add_argument('--widths', default='1200',
                        help='comma-separated viewport widths (default 1200; add 390 for mobile)')
    parser.add_argument('--check-only', action='store_true',
                        help='run checks and write report.json without screenshots')
    args = parser.parse_args()

    widths = args.widths.split(',')
    try:
        frames = len(json.loads(args.input.read_text(encoding='utf-8'))['frames'])
        preview = build(args.input, args.out)
    except (OSError, ValueError, TypeError, KeyError) as error:
        parser.exit(1, str(error) + '\n')

    command = ['node', str(SKILL / 'scripts/shoot.mjs'), preview.resolve().as_uri(),
               str(args.out), '--widths=' + ','.join(widths)]
    if args.check_only:
        command.append('--check-only')
    result = subprocess.run(command)
    if result.returncode:
        sys.exit(result.returncode)

    if not args.check_only and frames >= 2:
        for width in widths:
            result = subprocess.run([sys.executable, str(SKILL / 'scripts/sheet.py'), str(args.out), width])
            if result.returncode:
                sys.exit(result.returncode)


if __name__ == '__main__':
    main()
