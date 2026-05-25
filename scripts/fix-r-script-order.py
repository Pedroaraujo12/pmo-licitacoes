#!/usr/bin/env python3
"""Post-build script: move the _R_ bootstrap chunk to execute last.

In HTTP/2, async scripts load in parallel. If the _R_ chunk (smaller)
finishes before its dependency chunks (larger), module resolution fails
because required modules aren't registered yet.

Fix: place the _R_ script tag last (before inline scripts) and remove
its async attribute, so it executes only after all other async scripts.
"""

import re
import os
import glob

OUT_DIR = 'out'

def fix_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Find all external script tags
    script_pattern = re.compile(r'\s*<script( src="([^"]*)")([^>]*)></script>\n?')

    all_scripts = list(script_pattern.finditer(html))
    if not all_scripts:
        return False

    # Identify the _R_ script (has id="_R_" or is the bootstrap entry)
    r_script = None
    other_scripts = []

    for m in all_scripts:
        tag = m.group(0)
        src = m.group(2)
        attrs = m.group(3)
        is_r = 'id="_R_"' in tag or '14q-' in (src or '')

        if is_r:
            r_script = (m.start(), m.end(), tag, src, attrs)
        else:
            other_scripts.append((m.start(), m.end(), tag, src, attrs))

    if not r_script:
        print(f'  No _R_ script found in {filepath}')
        return False

    # Remove ALL instances of _R_ script from html
    src = r_script[3]
    # Remove both the original async version and any duplicates
    new_html = re.sub(
        rf'\s*<script[^>]*src="[^"]*14q-[^"]*"[^>]*></script>\n?',
        '',
        html
    )

    # Find the insertion point: before the first inline script or before </body>
    inline_pos = new_html.find('<script>(self.__next_f')
    if inline_pos >= 0:
        prefix = new_html[:inline_pos]
        suffix = new_html[inline_pos:]
    else:
        body_close = new_html.find('</body>')
        if body_close >= 0:
            prefix = new_html[:body_close]
            suffix = new_html[body_close:]
        else:
            prefix = new_html
            suffix = ''

    modified_tag = f'<script src="{src}"></script>\n'
    new_html = prefix + modified_tag + suffix

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
