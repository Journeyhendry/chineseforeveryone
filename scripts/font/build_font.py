#!/usr/bin/env python3
"""Bangun font LXGW WenKai (self-host) untuk website Xué Mandarin.

Pemakaian (dari akar repo):
    npm run build:font
atau:
    python3 scripts/font/build_font.py [--package-dir DIR]

Tanpa --package-dir, skrip menjalankan `npm pack lxgw-wenkai-webfont@1.7.0`
ke folder sementara, mencocokkan integrity tarball dengan nilai yang dipatok
di bawah, lalu mengekstraknya. Dengan --package-dir, skrip memakai folder
paket yang sudah diekstrak (tanpa jaringan).

Keluaran (semua deterministik; menjalankan ulang menghasilkan byte yang sama):
  src/assets/fonts/lxgw-wenkai-{regular,bold}-{core,extra}.woff2
  src/assets/fonts/lxgw-wenkai-chars.json
  src/styles/fonts.css
  public/fonts/LXGW-WenKai-OFL.txt

Ketergantungan: Python >= 3.12, lihat scripts/font/requirements.txt.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

from fontTools import merge, subset
from fontTools.ttLib import TTFont

PACKAGE_NAME = 'lxgw-wenkai-webfont'
PACKAGE_VERSION = '1.7.0'
PACKAGE_SPEC = f'{PACKAGE_NAME}@{PACKAGE_VERSION}'
# Dari `npm view lxgw-wenkai-webfont@1.7.0 dist.integrity`.
PACKAGE_INTEGRITY = (
    'sha512-kVJmT4xMAyOLhG6q0w63wJkVU7RP8UMQRGoAWj9tnpzL7sWFFYiEHBdUQyW9myqBQFa5SQfWfa2VLYF4IJBL5g=='
)

REPO = Path(__file__).resolve().parents[2]
SRC_DIR = REPO / 'src'
FONT_DIR = SRC_DIR / 'assets' / 'fonts'
CSS_OUT = SRC_DIR / 'styles' / 'fonts.css'
DATA_DIR = REPO / 'data' / 'hsk1'
LICENSE_OUT = REPO / 'public' / 'fonts' / 'LXGW-WenKai-OFL.txt'

# Tanda baca Mandarin umum yang dipakai di core.
PUNCTUATION = '，。？！、：；“”‘’（）《》…—·～'
HAN_RE = re.compile('[㐀-鿿豈-﫿]')
WEIGHTS = ('regular', 'bold')
SUBSETS = ('core', 'extra')
CHUNK_RE = re.compile(r'-subset-(\d+)\.woff2$')


def han_chars(text: str) -> set[str]:
    return {c for c in text if HAN_RE.fullmatch(c)}


def collect_requested() -> tuple[set[str], set[str]]:
    """Kembalikan (core, extra) sebagai himpunan karakter."""
    words = json.loads((DATA_DIR / 'words.json').read_text(encoding='utf-8'))
    core: set[str] = set(PUNCTUATION)
    for word in words:
        core |= han_chars(word['hanzi'])

    extra: set[str] = set()
    for path in sorted(DATA_DIR.glob('*.json')):
        extra |= han_chars(path.read_text(encoding='utf-8'))
    for path in sorted(SRC_DIR.rglob('*')):
        if not path.is_file():
            continue
        # Folder src/assets berisi keluaran skrip ini sendiri; diabaikan supaya hasilnya stabil.
        if path.relative_to(SRC_DIR).parts[0] == 'assets':
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        extra |= han_chars(text)

    return core, extra - core


def fetch_package(workdir: Path) -> Path:
    """Unduh paket dengan npm, cocokkan integrity, ekstrak. Kembalikan folder paket."""
    subprocess.run(
        ['npm', 'pack', PACKAGE_SPEC, '--pack-destination', str(workdir)],
        cwd=workdir,
        check=True,
        capture_output=True,
    )
    tarballs = sorted(workdir.glob('*.tgz'))
    if len(tarballs) != 1:
        sys.exit(f'npm pack menghasilkan {len(tarballs)} tarball, diharapkan 1')
    data = tarballs[0].read_bytes()
    actual = 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode('ascii')
    if actual != PACKAGE_INTEGRITY:
        sys.exit(f'integrity tarball tidak cocok: {actual}')
    extract_dir = workdir / 'extract'
    extract_dir.mkdir()
    with tarfile.open(tarballs[0]) as archive:
        archive.extractall(extract_dir, filter='data')
    return extract_dir / 'package'


def check_package(pkg: Path) -> str:
    """Pastikan folder paket sesuai versi yang dipatok. Kembalikan versi font (mis. 1.250)."""
    manifest = json.loads((pkg / 'package.json').read_text(encoding='utf-8'))
    if manifest.get('name') != PACKAGE_NAME or manifest.get('version') != PACKAGE_VERSION:
        sys.exit(f'paket bukan {PACKAGE_SPEC}: {manifest.get("name")}@{manifest.get("version")}')
    if not (pkg / 'OFL.txt').is_file():
        sys.exit('OFL.txt tidak ada di paket')
    return (pkg / 'VERSION').read_text(encoding='utf-8').strip().lstrip('v')


def chunk_files(pkg: Path, weight: str) -> list[Path]:
    files = [p for p in (pkg / 'files').glob(f'lxgwwenkai-{weight}-subset-*.woff2')]
    if not files:
        sys.exit(f'tidak ada potongan {weight} di paket')
    return sorted(files, key=lambda p: int(CHUNK_RE.search(p.name).group(1)))


def check_no_reserved_font_name(font: TTFont) -> None:
    for record in font['name'].names:
        if 'reserved font name' in record.toUnicode().lower():
            sys.exit('OFL: font memuat Reserved Font Name; berhenti (lihat laporan)')


def merge_chunks(paths: list[Path]) -> tuple[bytes, TTFont]:
    """Gabungkan potongan (satu bobot) dan kembalikan (byte sfnt, font pertama untuk timestamp)."""
    merged = merge.Merger().merge([str(p) for p in paths])
    buf = io.BytesIO()
    merged.save(buf)
    return buf.getvalue(), TTFont(str(paths[0]), recalcTimestamp=False)


def subset_font(sfnt: bytes, unicodes: set[str], head_source: TTFont) -> bytes:
    font = TTFont(io.BytesIO(sfnt), recalcTimestamp=False)
    options = subset.Options()
    options.name_IDs = ['*']
    options.name_languages = ['*']
    options.name_legacy = True
    options.drop_tables += ['vhea', 'vmtx']
    options.flavor = 'woff2'
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=[ord(c) for c in unicodes])
    sub.subset(font)
    # Timestamp dari potongan sumber, supaya keluaran tidak berubah antar-jalan.
    font['head'].created = head_source['head'].created
    font['head'].modified = head_source['head'].modified
    font.flavor = 'woff2'
    out = io.BytesIO()
    font.save(out)
    return out.getvalue()


def cmap_of(data: bytes) -> set[int]:
    return set(TTFont(io.BytesIO(data), recalcTimestamp=False).getBestCmap().keys())


def unicode_range(codepoints: list[int]) -> str:
    ranges: list[str] = []
    start = prev = codepoints[0]
    for cp in codepoints[1:] + [None]:
        if cp is not None and cp == prev + 1:
            prev = cp
            continue
        ranges.append(f'U+{start:X}' if start == prev else f'U+{start:X}-{prev:X}')
        if cp is not None:
            start = prev = cp
    return ', '.join(ranges)


def write_css(faces: list[tuple[str, int, str, str]]) -> None:
    """faces: (nama file, bobot, subset, unicode-range)."""
    blocks = []
    for filename, weight, _subset, urange in faces:
        blocks.append(
            '@font-face {\n'
            "  font-family: 'LXGW WenKai';\n"
            '  font-style: normal;\n'
            f'  font-weight: {weight};\n'
            '  font-display: swap;\n'
            f"  src: url('../assets/fonts/{filename}') format('woff2');\n"
            f'  unicode-range: {urange};\n'
            '}\n'
        )
    header = (
        '/* Dibuat otomatis oleh scripts/font/build_font.py (npm run build:font).\n'
        '   Jangan diedit manual. Font: LXGW WenKai, lisensi SIL OFL 1.1 '
        '(public/fonts/LXGW-WenKai-OFL.txt). */\n'
    )
    CSS_OUT.write_text(header + '\n'.join(blocks), encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--package-dir', type=Path, help='folder paket lxgw-wenkai-webfont yang sudah diekstrak')
    args = parser.parse_args()

    core_req, extra_req = collect_requested()
    requested = core_req | extra_req

    with tempfile.TemporaryDirectory(prefix='lxgw-wenkai-') as tmp:
        if args.package_dir:
            pkg = args.package_dir.resolve()
        else:
            pkg = fetch_package(Path(tmp))
        font_version_str = check_package(pkg)


        # Pilih potongan yang memuat huruf yang dibutuhkan (dari kedua subset).
        chunks: dict[str, list[Path]] = {}
        supported: dict[str, set[int]] = {}
        wanted = {ord(c) for c in requested}
        for weight in WEIGHTS:
            chosen: list[Path] = []
            covered: set[int] = set()
            for path in chunk_files(pkg, weight):
                chunk_cmap = set(TTFont(str(path), recalcTimestamp=False).getBestCmap().keys())
                covered |= chunk_cmap
                if chunk_cmap & wanted:
                    chosen.append(path)
            chunks[weight] = chosen
            supported[weight] = covered

        # Hanya huruf yang ada di KEDUA bobot yang dipakai.
        cover = supported['regular'] & supported['bold']
        core = sorted((c for c in core_req if ord(c) in cover), key=ord)
        extra = sorted((c for c in extra_req if ord(c) in cover), key=ord)
        missing = sorted((c for c in requested if ord(c) not in cover), key=ord)

        FONT_DIR.mkdir(parents=True, exist_ok=True)
        LICENSE_OUT.parent.mkdir(parents=True, exist_ok=True)
        LICENSE_OUT.write_bytes((pkg / 'OFL.txt').read_bytes())

        faces: list[tuple[str, int, str, str]] = []
        for weight in WEIGHTS:
            sfnt, head_source = merge_chunks(chunks[weight])
            check_no_reserved_font_name(TTFont(io.BytesIO(sfnt), recalcTimestamp=False))
            for subset_name, chars in (('core', core), ('extra', extra)):
                data = subset_font(sfnt, set(chars), head_source)
                filename = f'lxgw-wenkai-{weight}-{subset_name}.woff2'
                (FONT_DIR / filename).write_bytes(data)
                out_cmap = sorted(cmap_of(data))
                weight_num = 400 if weight == 'regular' else 700
                faces.append((filename, weight_num, subset_name, unicode_range(out_cmap)))

    write_css(faces)
    chars_json = {
        'source': PACKAGE_SPEC,
        'fontVersion': font_version_str,
        'core': ''.join(core),
        'extra': ''.join(extra),
        'missing': missing,
    }
    (FONT_DIR / 'lxgw-wenkai-chars.json').write_text(
        json.dumps(chars_json, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
    )
    print(f'core {len(core)} huruf, extra {len(extra)} huruf, missing {len(missing)}: {"".join(missing)}')


if __name__ == '__main__':
    main()
