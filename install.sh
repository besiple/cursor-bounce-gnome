#!/usr/bin/env bash
set -e

# ==============================================================================
#  KDE Cursor Bounce for GNOME Shell - One-Click Installer
# ==============================================================================

BOLD="\033[1m"
GREEN="\033[1;32m"
CYAN="\033[1;36m"
YELLOW="\033[1;33m"
RESET="\033[0m"

UUID="cursor-bounce@besiple"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BOLD}${CYAN}=========================================================="
echo "    🎯 Installing KDE Cursor Bounce for GNOME Shell       "
echo -e "==========================================================${RESET}\n"

# 1. Install Extension Files
echo -e "${BOLD}[1/3] Installing extension files...${RESET}"
mkdir -p "${EXT_DIR}"
cp "${SCRIPT_DIR}/metadata.json" "${EXT_DIR}/"
cp "${SCRIPT_DIR}/extension.js" "${EXT_DIR}/"
cp "${SCRIPT_DIR}/cursorBounce.js" "${EXT_DIR}/"

echo -e "${GREEN}✓ Installed into ${EXT_DIR}${RESET}"

# 2. Configure Cursor Launch Feedback (suppress spinning rainbow beachball)
echo -e "\n${BOLD}[2/3] Configuring cursor launch feedback...${RESET}"
if [ -d "/usr/share/icons/macOS/cursors" ]; then
    mkdir -p "${HOME}/.local/share/icons"
    rm -rf "${HOME}/.local/share/icons/macOS"
    cp -a /usr/share/icons/macOS "${HOME}/.local/share/icons/" 2>/dev/null || true
    rm -f "${HOME}/.local/share/icons/macOS/cursors/left_ptr_watch"
    ln -s left_ptr "${HOME}/.local/share/icons/macOS/cursors/left_ptr_watch" 2>/dev/null || true
    # Reload cursor theme setting if possible
    if command -v gsettings &>/dev/null; then
        CURRENT_THEME=$(gsettings get org.gnome.desktop.interface cursor-theme | tr -d "'")
        if [ "$CURRENT_THEME" = "macOS" ]; then
            gsettings set org.gnome.desktop.interface cursor-theme 'Adwaita'
            sleep 0.1
            gsettings set org.gnome.desktop.interface cursor-theme 'macOS'
        fi
    fi
    echo -e "${GREEN}✓ Clean arrow pointer configured (busy beachball wheel suppressed)${RESET}"
fi

# 3. Enable Extension
echo -e "\n${BOLD}[3/3] Registering & enabling extension...${RESET}"
if command -v gsettings &>/dev/null; then
    python3 -c "
import ast, subprocess
try:
    raw = subprocess.check_output(['gsettings', 'get', 'org.gnome.shell', 'enabled-extensions']).decode().strip()
    exts = ast.literal_eval(raw)
    if '${UUID}' not in exts:
        exts.append('${UUID}')
        subprocess.run(['gsettings', 'set', 'org.gnome.shell', 'enabled-extensions', str(exts)], check=True)
except Exception as e:
    pass
" 2>/dev/null || true
fi

if command -v gnome-extensions &>/dev/null; then
    gnome-extensions enable "${UUID}" 2>/dev/null || true
fi

echo -e "${GREEN}✓ Extension registered in enabled-extensions!${RESET}"

echo -e "\n${BOLD}${GREEN}=========================================================="
echo "         🎉 KDE Cursor Bounce successfully installed!     "
echo -e "==========================================================${RESET}\n"
echo -e "${YELLOW}NOTE: On Wayland sessions, GNOME Shell only indexes new extensions on startup."
echo -e "Please ${BOLD}Log Out and Log In${RESET}${YELLOW} (or restart) to activate the animation.${RESET}\n"
