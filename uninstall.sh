#!/usr/bin/env bash
set -e

UUID="cursor-bounce@besiple"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

echo "Uninstalling KDE Cursor Bounce..."

if command -v gnome-extensions &>/dev/null; then
    gnome-extensions disable "${UUID}" 2>/dev/null || true
fi

rm -rf "${EXT_DIR}"
echo "Extension removed."
