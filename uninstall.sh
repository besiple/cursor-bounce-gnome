#!/usr/bin/env bash
set -e

UUID="cursor-bounce@besiple"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

echo "Uninstalling KDE Cursor Bounce..."

if command -v gnome-extensions &>/dev/null; then
    gnome-extensions disable "${UUID}" 2>/dev/null || true
fi

if command -v gsettings &>/dev/null; then
    python3 -c "
import ast, subprocess
try:
    raw = subprocess.check_output(['gsettings', 'get', 'org.gnome.shell', 'enabled-extensions']).decode().strip()
    exts = ast.literal_eval(raw)
    if '${UUID}' in exts:
        exts.remove('${UUID}')
        subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'enabled-extensions', str(exts)], check=True)
except Exception as e:
    pass
" 2>/dev/null || true
fi

rm -rf "${EXT_DIR}"
echo "Extension removed."
