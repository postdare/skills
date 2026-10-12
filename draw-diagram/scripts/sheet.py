#!/usr/bin/env python3
"""Join the current report's diagram screenshots; requires Pillow.

Usage: sheet.py <output-directory> [width=1200]
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('width', nargs='?', type=int, default=1200)
    args = parser.parse_args()
    report = json.loads((args.directory / 'report.json').read_text(encoding='utf-8'))
    viewport = next((item for item in report['viewports'] if item['width'] == args.width), None)
    if viewport is None:
        parser.error('report contains no screenshots for this width')
    keys = [item['key'] for item in viewport['items'] if item['drawn']]
    if not keys:
        parser.error('report contains no rendered diagrams')
    images = []
    for key in keys:
        if not key or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in key):
            parser.error('unsafe frame id in report')
        with Image.open(args.directory / f'{key}-{args.width}.png') as image:
            images.append(image.convert('RGB'))
    cell_w = max(image.width for image in images)
    cell_h = max(image.height for image in images)
    columns, gap = 2, 16
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new('RGB', (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), '#8a9399')
    draw = ImageDraw.Draw(sheet)
    for index, (key, image) in enumerate(zip(keys, images)):
        x = gap + index % columns * (cell_w + gap)
        y = gap + index // columns * (cell_h + gap)
        sheet.paste(image, (x, y))
        draw.rectangle([x, y, x + 12 + 9 * len(key), y + 26], fill='#16181d')
        draw.text((x + 6, y + 7), key, fill='white')
    destination = args.directory / ('sheet.png' if args.width == 1200 else f'sheet-{args.width}.png')
    sheet.save(destination)
    print(destination)


if __name__ == '__main__':
    main()
