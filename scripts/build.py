#!/usr/bin/env python3
"""Build the shared website and its offline copy without external dependencies."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib
import json
import re
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'site'
OUTPUT = ROOT / 'dist'
ARCHIVE = 'ШАД-комплект-v4.1.zip'


def build():
    config = json.loads((ROOT / 'site-config.json').read_text())
    base = config['base_url'].rstrip('/')
    assert urlsplit(base).scheme == 'https', 'The public URL must use HTTPS'
    kit = json.loads((ROOT / 'content/kit.json').read_text())
    assert len(kit['routes']) == 32 and len(kit['materials']) == 8
    materials = {m['id'] for m in kit['materials']}
    for route in kit['routes']:
        assert route['first'] in materials and route['second'] in materials
    for material in kit['materials']:
        for group in ('G1', 'G2', 'G3', 'G4'):
            assert len(material['researchProbesByGroup'][group]) == 6

    digest = hashlib.sha256()
    inputs = sorted(p for p in SOURCE.rglob('*') if p.is_file())
    inputs += [ROOT / 'content/kit.json', ROOT / 'site-config.json', Path(__file__)]
    for path in inputs:
        digest.update(str(path.relative_to(ROOT)).encode())
        digest.update(path.read_bytes())
    version = digest.hexdigest()[:16]

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    shutil.copytree(SOURCE, OUTPUT)
    kit['publicUrl'] = base + '/student/'
    (OUTPUT / 'assets/data.js').write_text('window.KIT=' + json.dumps(kit, ensure_ascii=False, separators=(',', ':')) + ';\n')

    for path in OUTPUT.rglob('*'):
        if not path.is_file() or path.suffix not in ('.html', '.js', '.txt'):
            continue
        text = path.read_text()
        text = text.replace('../' + ARCHIVE, 'downloads/' + ARCHIVE)
        if path.suffix == '.html':
            if 'student' in path.relative_to(OUTPUT).parts:
                depth = len(path.relative_to(OUTPUT).parts) - 1
                shared = '../' * depth + 'assets/'
                local = '../assets/' if path.parent.name == 'materials' else 'assets/'
                text = re.sub(r'<link rel="stylesheet" href="[^"]*style.css">',
                              '<link rel="stylesheet" href="' + shared + 'style.css">'
                              '<link rel="stylesheet" href="' + shared + 'theme.css">'
                              '<link rel="stylesheet" href="' + local + 'style.css">', text)
                text = text.replace('<meta charset="utf-8">', '<meta charset="utf-8">'
                                    '<script src="' + local + 'shell.js"></script>'
                                    '<script src="' + shared + 'theme.js"></script>')
                text = re.sub(r'<body(?: class="([^"]*)")?>',
                              lambda m: '<body class="student-page ' + (m[1] or '') + '">'
                              '<a class="skip" href="#student-main">К материалу</a>'
                              '<header class="site-header"><div class="header-inner">'
                              '</div></header>', text)
                text = text.replace('<main ', '<main id="student-main" ')
                if path.parent.name == 'materials':
                    text = text.replace('<main id="student-main" class="narrow">',
                                        '<main id="student-main" class="narrow">'
                                        '<h1 class="material-title">Материал ' + path.stem.upper() + '</h1>')
            # Each deployment has fresh CSS/JS URLs, including participant pages.
            text = re.sub(r'((?:src|href)="[^"?]+\.(?:css|js))(?:\?[^"\s]*)?"',
                          lambda m: m[1] + '?v=' + version + '"', text)
            if path.parent == OUTPUT:
                text = text.replace('<head>', '<head><meta name="shad-version" content="' + version + '"><meta name="robots" content="noindex,nofollow">')
                text = text.replace('<meta charset="utf-8">', '<meta charset="utf-8"><script src="assets/theme.js?v=' + version + '"></script>')
                text = text.replace('</head>', '<link rel="stylesheet" href="assets/updates.css?v=' + version + '"><link rel="stylesheet" href="assets/theme.css?v=' + version + '"></head>')
                text = text.replace('</body>', '<script defer src="assets/updates.js?v=' + version + '"></script></body>')
        path.write_text(text)

    (OUTPUT / 'version.json').write_text(json.dumps({'version': version, 'label': kit['researchRevision']}, ensure_ascii=False) + '\n')
    (OUTPUT / '.nojekyll').touch()
    # These pages are accessible by URL; noindex is a search preference, not access control.
    (OUTPUT / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    files = sorted(p for p in OUTPUT.rglob('*') if p.is_file())
    (OUTPUT / 'downloads').mkdir()
    with zipfile.ZipFile(OUTPUT / 'downloads' / ARCHIVE, 'w') as archive:
        for path in files:
            data = path.read_bytes()
            if path.suffix in ('.html', '.js'):
                data = data.decode().replace('downloads/' + ARCHIVE, '../' + ARCHIVE).encode()
            compressed = path.suffix not in ('.mp4', '.jpg', '.jpeg', '.png', '.woff2')
            archive.writestr('Локальный комплект/' + str(path.relative_to(OUTPUT)), data,
                             compress_type=zipfile.ZIP_DEFLATED if compressed else zipfile.ZIP_STORED)
    verify_links()
    with zipfile.ZipFile(OUTPUT / 'downloads' / ARCHIVE) as archive:
        assert archive.testzip() is None
    print(json.dumps({'version': version, 'url': base + '/', 'files': len(files), 'archive': ARCHIVE}, ensure_ascii=False))


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.links.extend(value for key, value in attrs if key in ('href', 'src', 'data-src') and value)


def verify_links():
    for path in OUTPUT.rglob('*.html'):
        parser = Links()
        parser.feed(path.read_text())
        for link in parser.links:
            url = urlsplit(link)
            if not url.scheme and not url.netloc and url.path:
                target = path.parent / unquote(url.path)
                assert target.exists(), f'Missing local link in {path}: {link}'


if __name__ == '__main__':
    build()
