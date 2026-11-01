'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

export class CursorBounce {
  constructor() {
    this._enabled = false;
    this._activeBounce = null;
    this._signalIds = [];
    this._timerId = null;
    this._timeoutId = null;
  }

  enable() {
    if (this._enabled) return;
    this._enabled = true;

    // 1. AppState transitions (app starts loading)
    try {
      let appSystem = Shell.AppSystem.get_default();
      if (appSystem) {
        this._connect(appSystem, 'app-state-changed', (sys, app) => {
          if (!this._enabled || !app) return;
          if (app.state === Shell.AppState.STARTING) {
            this.start(app);
          } else if (app.state === Shell.AppState.RUNNING) {
            if (this._activeBounce && this._activeBounce.app === app) {
              this.stop();
            }
          }
        });
      }
    } catch (e) {
      console.log('[KDE Cursor Bounce] AppSystem hook error:', e);
    }

    // 2. Startup sequence notification (FreeDesktop / Wayland launch tokens)
    try {
      let tracker = Shell.WindowTracker.get_default();
      if (tracker) {
        this._connect(tracker, 'startup-sequence-changed', (t, seq) => {
          if (!this._enabled || !seq) return;
          if (!seq.get_completed()) {
            let app = null;
            let iconName = null;
            try {
              if (seq.get_icon_name && seq.get_icon_name()) {
                iconName = seq.get_icon_name();
              }
              let id = seq.get_application_id ? seq.get_application_id() : null;
              let appSys = Shell.AppSystem.get_default();
              if (id && appSys) {
                app = appSys.lookup_app(id) || appSys.lookup_app(id + '.desktop');
              }
              if (!app && seq.get_wmclass && appSys) {
                let wmclass = seq.get_wmclass();
                if (wmclass) {
                  app = appSys.lookup_startup_wmclass(wmclass) ||
                        appSys.lookup_desktop_wmclass(wmclass) ||
                        appSys.lookup_heuristic_basename(wmclass);
                }
              }
              if (!app && seq.get_name && appSys) {
                let name = seq.get_name();
                if (name) {
                  app = appSys.lookup_heuristic_basename(name);
                }
              }
            } catch (err) {}

            // ONLY start if a specific app or valid icon name was resolved
            if (app || (iconName && iconName !== 'application-x-executable')) {
              this.start(app, iconName);
            }
          }
        });
      }
    } catch (e) {
      console.log('[KDE Cursor Bounce] WindowTracker hook error:', e);
    }

    // 3. Window created hook: immediately stop bouncing when a window appears
    try {
      if (global.display) {
        this._connect(global.display, 'window-created', () => {
          if (this._activeBounce) {
            this.stop();
          }
        });
      }
    } catch (e) {
      console.log('[KDE Cursor Bounce] window-created hook error:', e);
    }
  }

  disable() {
    if (!this._enabled) return;
    this._enabled = false;

    this._disconnectAll();
    this._cleanupBounce();
  }

  _connect(obj, signal, callback) {
    if (!obj) return;
    try {
      let id = obj.connect(signal, callback);
      this._signalIds.push({ obj, id });
    } catch (e) {
      console.log('[KDE Cursor Bounce] Signal connect failed for ' + signal + ':', e);
    }
  }

  _disconnectAll() {
    for (let s of this._signalIds) {
      try {
        if (s.obj && s.id) {
          s.obj.disconnect(s.id);
        }
      } catch (e) {}
    }
    this._signalIds = [];
  }

  /**
   * Start bouncing the launching application icon next to the cursor.
   * @param {Shell.App|null} app 
   * @param {string|null} fallbackIconName 
   * @param {Gio.Icon|null} directGIcon 
   */
  start(app, fallbackIconName = null, directGIcon = null) {
    if (!this._enabled) return;

    // If an active bounce is already playing for a real app, do NOT overwrite it with null/unknown
    if (this._activeBounce && !this._activeBounce.exiting) {
      if (!app && !directGIcon && this._activeBounce.app) {
        return;
      }
      if (app && this._activeBounce.app === app) {
        return;
      }
    }

    // If app is already running with visible windows, do not bounce
    if (app && typeof app.get_n_windows === 'function' && app.get_n_windows() > 0 && app.state === Shell.AppState.RUNNING) {
      return;
    }

    console.log('[KDE Cursor Bounce] Started for:', app ? app.get_name() : (fallbackIconName || 'app'));

    // Clean up existing bounce
    this._cleanupBounce();

    // Create the icon actor at compact 22px
    const ICON_SIZE = 22;
    let icon = null;
    try {
      if (directGIcon) {
        icon = new St.Icon({
          gicon: directGIcon,
          icon_size: ICON_SIZE,
        });
      } else if (app) {
        let gicon = null;
        if (typeof app.get_icon === 'function') {
          gicon = app.get_icon();
        }
        if (!gicon && typeof app.get_app_info === 'function' && app.get_app_info()) {
          gicon = app.get_app_info().get_icon();
        }
        if (gicon) {
          icon = new St.Icon({
            gicon: gicon,
            icon_size: ICON_SIZE,
          });
        } else if (typeof app.create_icon_texture === 'function') {
          icon = app.create_icon_texture(ICON_SIZE);
        }
      }

      if (!icon && fallbackIconName) {
        icon = new St.Icon({
          icon_name: fallbackIconName,
          icon_size: ICON_SIZE,
        });
      }
    } catch (e) {
      console.log('[KDE Cursor Bounce] Failed to create icon:', e);
    }

    if (!icon) {
      icon = new St.Icon({
        icon_name: 'application-x-executable',
        icon_size: ICON_SIZE,
      });
    }

    // Container actor with bottom-center anchor pivot for rubber rebound
    let container = new St.Bin({
      style_class: 'cursor-bounce-container',
      reactive: false,
      can_focus: false,
      style: 'background-color: transparent;',
    });
    container.set_child(icon);

    container.set_pivot_point(0.5, 1.0);
    container.opacity = 0;
    container.set_scale(0.3, 0.3);

    // Initial position snug against cursor
    let [px, py] = global.get_pointer();
    let [baseX, baseY] = this._computeBasePosition(px, py);
    container.set_position(baseX, baseY);

    Main.uiGroup.add_child(container);

    let startTime = GLib.get_monotonic_time();
    let bounceState = {
      app: app,
      actor: container,
      startTime: startTime,
      exiting: false,
      exitStartTime: 0,
      exitStartOpacity: 255,
      exitStartScaleX: 1.0,
      exitStartScaleY: 1.0,
      exitStartDisplacementY: 0,
    };
    this._activeBounce = bounceState;

    // 60fps animation loop
    this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
      return this._onAnimationFrame();
    });

    // Safety timeout: dismiss after 5 seconds if no window mapped
    this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
      this._timeoutId = null;
      this.stop();
      return GLib.SOURCE_REMOVE;
    });
  }

  /**
   * Smoothly finish and dismiss the cursor bounce.
   */
  stop(app = null) {
    if (!this._activeBounce) return;
    if (app && this._activeBounce.app && this._activeBounce.app !== app) return;
    if (this._activeBounce.exiting) return;

    this._activeBounce.exiting = true;
    this._activeBounce.exitStartTime = GLib.get_monotonic_time();
    this._activeBounce.exitStartOpacity = this._activeBounce.actor.opacity;
    this._activeBounce.exitStartScaleX = this._activeBounce.actor.scale_x;
    this._activeBounce.exitStartScaleY = this._activeBounce.actor.scale_y;
  }

  _computeBasePosition(cx, cy) {
    // Tucked close to cursor arrow flank (cx + 11, cy + 8)
    let baseX = cx + 11;
    let baseY = cy + 8;

    let monitor = Main.layoutManager.currentMonitor;
    if (monitor) {
      if (baseX + 26 > monitor.x + monitor.width) {
        baseX = cx - 26 - 4;
      }
      if (baseY + 26 > monitor.y + monitor.height) {
        baseY = cy - 26 - 4;
      }
    }
    return [baseX, baseY];
  }

  _onAnimationFrame() {
    if (!this._activeBounce || !this._activeBounce.actor) {
      return GLib.SOURCE_REMOVE;
    }

    let b = this._activeBounce;
    let now = GLib.get_monotonic_time();
    let elapsedUs = now - b.startTime;
    let elapsedMs = elapsedUs / 1000.0;

    let [px, py] = global.get_pointer();
    let [baseX, baseY] = this._computeBasePosition(px, py);

    // 1. Intro pop-in (first 80ms)
    let introT = Math.min(1.0, elapsedMs / 80.0);

    // 2. Outro ease-out transition (150ms)
    if (b.exiting) {
      let exitElapsedMs = (now - b.exitStartTime) / 1000.0;
      let exitProgress = Math.min(1.0, exitElapsedMs / 150.0);

      let ease = Math.sin((exitProgress * Math.PI) / 2.0);
      let opacity = Math.max(0, Math.round(b.exitStartOpacity * (1.0 - ease)));
      let scale = b.exitStartScaleX * (1.0 + 0.20 * ease);
      let exitY = b.exitStartDisplacementY - 10.0 * ease;

      b.actor.opacity = opacity;
      b.actor.set_scale(scale, scale);
      b.actor.set_position(baseX, baseY + exitY);

      if (exitProgress >= 1.0) {
        this._cleanupBounce();
        return GLib.SOURCE_REMOVE;
      }
      return GLib.SOURCE_CONTINUE;
    }

    // 3. Signature KDE Bounce Physics
    // Compact, bouncy 420ms cycle, 11px bounce height
    const PERIOD = 420.0;
    const BOUNCE_HEIGHT = 11.0;
    let cycleTime = elapsedMs % PERIOD;
    let cycleT = cycleTime / PERIOD; // 0.0 to 1.0

    let dispY = 0.0;
    let scaleX = 1.0;
    let scaleY = 1.0;

    if (cycleT < 0.82) {
      // In air: parabolic projectile under constant gravity
      let flightT = cycleT / 0.82;
      let parabola = 4.0 * flightT * (1.0 - flightT); // peaks at 1.0 when flightT = 0.5
      dispY = -parabola * BOUNCE_HEIGHT;

      // Elastic stretch as it shoots upwards
      if (flightT < 0.28) {
        let stretch = (1.0 - flightT / 0.28);
        scaleY = 1.0 + 0.10 * stretch;
        scaleX = 1.0 - 0.05 * stretch;
      }
    } else {
      // Ground impact / Squash & Rebound (remaining 18% of cycle ~75ms)
      let groundT = (cycleT - 0.82) / 0.18;
      let squash = Math.sin(groundT * Math.PI); // 0 -> 1 -> 0

      dispY = 0.0;
      scaleY = 1.0 - 0.20 * squash; // squashes down to 80% height
      scaleX = 1.0 + 0.15 * squash; // expands to 115% width
    }

    // Apply intro scaling
    if (introT < 1.0) {
      let easeIn = Math.sin((introT * Math.PI) / 2.0);
      b.actor.opacity = Math.round(255 * easeIn);
      scaleX *= (0.3 + 0.7 * easeIn);
      scaleY *= (0.3 + 0.7 * easeIn);
    } else {
      b.actor.opacity = 255;
    }

    b.exitStartDisplacementY = dispY;
    b.actor.set_scale(scaleX, scaleY);
    b.actor.set_position(baseX, baseY + dispY);

    return GLib.SOURCE_CONTINUE;
  }

  _cleanupBounce() {
    if (this._timerId) {
      GLib.source_remove(this._timerId);
      this._timerId = null;
    }
    if (this._timeoutId) {
      GLib.source_remove(this._timeoutId);
      this._timeoutId = null;
    }
    if (this._activeBounce && this._activeBounce.actor) {
      try {
        Main.uiGroup.remove_child(this._activeBounce.actor);
        this._activeBounce.actor.destroy();
      } catch (e) {}
    }
    this._activeBounce = null;
  }
}
