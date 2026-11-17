import os
import re

for root, _, files in os.walk('extension/src'):
    for f in files:
        if f.endswith('.ts') or f.endswith('.tsx'):
            full_path = os.path.join(root, f)
            with open(full_path, 'r', encoding='utf-8') as fh:
                content = fh.read()

            def replace_import(match):
                prefix = match.group(1)
                import_path = match.group(2)
                suffix = match.group(3)
                if not (import_path.endswith('.ts') or import_path.endswith('.tsx') or import_path.endswith('.css')):
                    dir_path = os.path.dirname(full_path)
                    cand_ts = os.path.normpath(os.path.join(dir_path, import_path + '.ts'))
                    cand_tsx = os.path.normpath(os.path.join(dir_path, import_path + '.tsx'))
                    if os.path.exists(cand_ts):
                        return prefix + import_path + '.ts' + suffix
                    elif os.path.exists(cand_tsx):
                        return prefix + import_path + '.tsx' + suffix
                return match.group(0)

            new_content = re.sub(r'(from\s+["\'])(\.[^"\']+)(["\'])', replace_import, content)
            if new_content != content:
                with open(full_path, 'w', encoding='utf-8') as fh:
                    fh.write(new_content)
                print('Updated:', full_path)

