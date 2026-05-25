#!/usr/bin/env python3
"""Post-build script: reorder scripts and remove async to fix HTTPS/HTTP/2 race.

Problem: In HTTP/2 (HTTPS), the tiny turbopack runtime (~10KB) can finish
downloading before larger module chunks (~232KB). When this happens, the
runtime's IIFE processes TURBOPACK entries and executes module 94553
(bootstrap). Module 94553 calls getAssetPrefix() which relies on
document.currentScript — but on retry (via setTimeout), document.currentScript
is null, causing a fatal loop that never hydrates React.

Fix: remove async from all external scripts, keeping the turbopack runtime as
the last script, so it executes only after all module factories are registered.
The initial synchronous execution inside the IIFE ensures document.currentScript
is available.
"""

import re
import os
import glob

OUT_DIR = 'out'

def fix_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Remove async="" from ALL external script tags
    html = re.sub(r' async=""', '', html)

    # Find all external script tags (they may still have other attrs)
    script_pattern = re.compile(r'<script src="([^"]*)"([^>]*)></script>')

    all_scripts = list(script_pattern.finditer(html))
    if not all_scripts:
        return False

    # Identify scripts: the runtime (turbopack) and the inline __next_f scripts
    runtime_src = None
    module_scripts = []
    inline_marker = '<script>(self.__next_f'

    for m in all_scripts:
        tag = m.group(0)
        src = m.group(1)
        attrs = m.group(2)
        name = src.split('/')[-1] if src else ''

        is_runtime = 'turbopack-' in name
        if is_runtime:
            runtime_src = src

    if not runtime_src:
        print(f'  No turbopack runtime script found in {filepath}')
        return False

    # Reorder: remove all external scripts, then add module scripts first,
    # then the turbopack runtime last (before inline scripts)
    # Remove all external script tags from the HTML
    new_html = re.sub(r'<script src="[^"]*"([^>]*)></script>\s*', '', html)

    # Rebuild script section: module scripts first, then runtime, then inline
    script_lines = []
    for m in all_scripts:
        src = m.group(1)
        name = src.split('/')[-1]
        is_runtime = 'turbopack-' in name
        if is_runtime:
            continue  # we'll add at the end
        script_lines.append(f'<script src="{src}"></script>')

    # Add runtime last (before inline scripts)
    script_lines.append(f'<script src="{runtime_src}"></script>')

    # Find where to insert the scripts: before the first inline <script> or </body>
    inline_pos = new_html.find(inline_marker)
    if inline_pos < 0:
        inline_pos = new_html.find('</body>')
        marker_len = 0
    else:
        marker_len = 0  # we insert before the inline

    prefix = new_html[:inline_pos]
    suffix = new_html[inline_pos:]

    new_html = prefix + '\n' + '\n'.join(script_lines) + '\n' + suffix

    # Clean up any double newlines
    new_html = new_html.replace('\n\n\n', '\n').replace('\n\n', '\n')

    if new_html != html:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_html)
        return True

    return False


def main():
    html_files = glob.glob(os.path.join(OUT_DIR, '**/*.html'), recursive=True)
    fixed = 0

    for fp in sorted(html_files):
        if fix_html(fp):
            fixed += 1
            print(f'  Fixed: {fp[len(OUT_DIR)+1:]}')

    print(f'\nFixed {fixed} of {len(html_files)} HTML files')


if __name__ == '__main__':
    main()
