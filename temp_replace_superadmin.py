from pathlib import Path

root = Path(r'c:\logins\User\Files\User Files\pony-town-next-gen')
exts = {'.ts', '.js', '.md', '.pug', '.json', '.txt', '.yaml', '.yml'}
changed = []
for path in root.rglob('*'):
    if path.is_file() and path.suffix.lower() in exts:
        text = path.read_text(encoding='utf-8')
        new = text.replace('superadmin', 'owner').replace('Superadmin', 'Owner')
        if new != text:
            path.write_text(new, encoding='utf-8')
            changed.append(str(path.relative_to(root)))
print('updated', len(changed), 'files')
for p in changed:
    print(p)
