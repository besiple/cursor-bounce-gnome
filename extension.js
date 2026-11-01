'use strict';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { CursorBounce } from './cursorBounce.js';

export default class CursorBounceExtension extends Extension {
  enable() {
    this._bounce = new CursorBounce();
    this._bounce.enable();
    console.log('[KDE Cursor Bounce] Extension enabled');
  }

  disable() {
    if (this._bounce) {
      this._bounce.disable();
      this._bounce = null;
    }
    console.log('[KDE Cursor Bounce] Extension disabled');
  }
}
