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

# 1. Install Extension
echo -e "${BOLD}[1/3] Installing extension files...${RESET}"
mkdir -p "${EXT_DIR}"
cp "${SCRIPT_DIR}/metadata.json" "${EXT_DIR}/"
cp "${SCRIPT_DIR}/extension.js" "${EXT_DIR}/"
cp "${SCRIPT_DIR}/cursorBounce.js" "${EXT_DIR}/"

echo -e "${GREEN}✓ Installed into ${EXT_DIR}${RESET}"

# 2. Configure cursor (remove spinning beachball in favor of clean arrow cursor)
echo -e "\n${BOLD}[2/3] Configuring cursor launch feedback...${RESET}"
if [ -d "/usr/share/icons/macOS/cursors" ]; then
    mkdir -p "${HOME}/.local/share/icons"
    cp -r /usr/share/icons/macOS "${HOME}/.local/share/icons/" 2>/dev/null || true
    ln -sf left_ptr "${HOME}/.local/share/icons/macOS/cursors/left_ptr_watch" 2>/dev/null || true
    echo -e "${GREEN}✓ Clean arrow pointer configured (busy wheel suppressed)${RESET}"
fi

# 3. Enable extension
echo -e "\n${BOLD}[3/3] Enabling extension...${RESET}"
if command -v gnome-extensions &>/dev/null; then
    sleep 0.5
    gnome-extensions enable "${UUID}" 2>/dev/null || true
    echo -e "${GREEN}✓ Extension enabled!${RESET}"
else
    echo -e "${YELLOW}Please restart GNOME Shell or log out and in to load the extension.${RESET}"
fi

echo -e "\n${BOLD}${GREEN}=========================================================="
echo "         🎉 KDE Cursor Bounce successfully installed!     "
echo -e "==========================================================${RESET}\n"
