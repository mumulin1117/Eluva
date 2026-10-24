"""Copy supplied local fixture PNGs verbatim; never modify the originals."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct

parser = argparse.ArgumentParser()
parser.add_argument('--female-dir', required=True, type=Path)
parser.add_argument('--male-dir', required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
destination = root / 'public/images/demo-users'
destination.mkdir(parents=True, exist_ok=True)
rows = []
for gender, source in [('female', args.female_dir), ('male', args.male_dir)]:
    for path in sorted(source.rglob('*.png')):
        if path.parent == source:
            number = int(re.fullmatch(r'Rectangle (\d+)@2x', path.stem).group(1))
            target = f'{gender}-{number:02}-avatar.png'
            role = 'avatar'
        else:
            number = int(path.parent.name.removeprefix('动态'))
            photo = int(re.sub(r'\s', '', path.stem).removeprefix('动态').removesuffix('@2x')[len(str(number)):])
            target = f'post-{number:02}-{photo:02}.png'
            role = 'post'
        data = path.read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n', path
        width, height = struct.unpack('>II', data[16:24])
        output = destination / target
        if output.exists() and output.read_bytes() != data:
            raise RuntimeError(f'Refusing to overwrite a different existing fixture: {output}')
        shutil.copyfile(path, output)
        rows.append({'source': f'{source.name}/{path.relative_to(source)}', 'file': str(output.relative_to(root)),
                     'role': role, 'gender': gender, 'number': number, 'width': width, 'height': height,
                     'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
assert len([r for r in rows if r['role'] == 'avatar']) == 20
assert len([r for r in rows if r['role'] == 'post']) == 19
(root / 'docs/evidence/demo-data-2026-10-19/assets.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
print('Copied 20 avatars and 19 post images, byte-for-byte.')
