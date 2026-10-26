import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class DragController {
    constructor({actor, dragHandle, resizeHandle, settings, isPinned}) {
        this._actor = actor;
        this._dragHandle = dragHandle;
        this._resizeHandle = resizeHandle;
        this._settings = settings;
        this._isPinned = isPinned;
        this._active = null;
        this._stageSignalIds = [];
        this._pressDragId = dragHandle.connect('button-press-event', (_a, event) => this._begin(event, 'move'));
        this._pressResizeId = resizeHandle.connect('button-press-event', (_a, event) => this._begin(event, 'resize'));
    }

    destroy() {
        this._finish(false);
        if (this._pressDragId)
            this._dragHandle.disconnect(this._pressDragId);
        if (this._pressResizeId)
            this._resizeHandle.disconnect(this._pressResizeId);
        this._pressDragId = 0;
        this._pressResizeId = 0;
    }

    clampToMonitor() {
        const monitor = this._getMonitor();
        if (!monitor)
            return;
        const [x, y] = this._actor.get_position();
        const [width, height] = this._actor.get_size();
        this._actor.set_position(
            Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - width)),
            Math.max(monitor.y, Math.min(y, monitor.y + monitor.height - height)),
        );
    }

    _begin(event, mode) {
        if (event.get_button() !== 1 || (mode === 'move' && this._isPinned()))
            return Clutter.EVENT_PROPAGATE;
        const [pointerX, pointerY] = event.get_coords();
        const [x, y] = this._actor.get_position();
        const [width, height] = this._actor.get_size();
        this._active = {mode, pointerX, pointerY, x, y, width, height};
        this._stageSignalIds = [
            global.stage.connect('motion-event', (_stage, motion) => this._motion(motion)),
            global.stage.connect('button-release-event', (_stage, release) => this._release(release)),
        ];
        return Clutter.EVENT_STOP;
    }

    _motion(event) {
        if (!this._active)
            return Clutter.EVENT_PROPAGATE;
        const [pointerX, pointerY] = event.get_coords();
        const dx = pointerX - this._active.pointerX;
        const dy = pointerY - this._active.pointerY;
        if (this._active.mode === 'move') {
            this._actor.set_position(this._active.x + dx, this._active.y + dy);
            this.clampToMonitor();
        } else {
            const monitor = this._getMonitor();
            const maxWidth = monitor ? monitor.x + monitor.width - this._active.x : 900;
            const maxHeight = monitor ? monitor.y + monitor.height - this._active.y : 600;
            const width = Math.max(240, Math.min(maxWidth, this._active.width + dx));
            const height = Math.max(70, Math.min(maxHeight, this._active.height + dy));
            this._actor.set_size(width, height);
        }
        return Clutter.EVENT_STOP;
    }

    _release(event) {
        if (!this._active || event.get_button() !== 1)
            return Clutter.EVENT_PROPAGATE;
        this._finish(true);
        return Clutter.EVENT_STOP;
    }

    _finish(save) {
        for (const id of this._stageSignalIds) {
            try {
                global.stage.disconnect(id);
            } catch (_error) {
                // The stage may be shutting down.
            }
        }
        this._stageSignalIds = [];
        if (save && this._active) {
            const [x, y] = this._actor.get_position();
            const [width, height] = this._actor.get_size();
            this._settings.setInt('widget-x', Math.round(x));
            this._settings.setInt('widget-y', Math.round(y));
            this._settings.setInt('widget-width', Math.round(width));
            this._settings.setInt('widget-height', Math.round(height));
        }
        this._active = null;
    }

    _getMonitor() {
        try {
            return Main.layoutManager.findMonitorForActor(this._actor) ?? Main.layoutManager.primaryMonitor;
        } catch (_error) {
            return Main.layoutManager.monitors?.[0] ?? null;
        }
    }
}
