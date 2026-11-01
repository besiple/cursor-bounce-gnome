# 🎯 KDE Cursor Bounce for GNOME Shell

KDE Plasma style bouncing application launch feedback animation for GNOME Shell (GNOME 45–51+).

When launching an application from the dock, app grid, runner, or search, a compact (22px) icon of the launched app pops up right next to the cursor arrow tip and bounces up and down with realistic squash & stretch physics until the window opens.

---

## ✨ Features

* **Signature KDE Plasma Bounce**:
  - Realistic squash & stretch physics: compresses to 80% on contact and stretches horizontally to 115% with ground pinning.
  - Parabolic gravity arc flight (11px vertical bounce).
* **Snug Pointer Anchor**:
  - The 22px icon is nestled right against the cursor arrow flank (`+11, +8`).
* **Zero Visual Clutter**:
  - Replaces the distracting spinning rainbow wheel with the standard clean arrow pointer, letting the bouncing app icon take the spotlight.
* **Instant Window Dismissal**:
  - Automatically dissolves away as soon as the application maps its window (`window-created`).
* **Smart Monitor Boundary Clamping**:
  - Flips positions when approaching screen edges so the animation never gets clipped.

---

## 🚀 Quick Install

```bash
git clone https://github.com/besiple/cursor-bounce-gnome.git
cd cursor-bounce-gnome
chmod +x install.sh
./install.sh
```

---

## 🗑️ Uninstall

```bash
./uninstall.sh
```
