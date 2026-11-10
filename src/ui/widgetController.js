import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {createMiniWidget} from './miniWidget.js';
import {createExpandedWidget} from './expandedWidget.js';
import {DragController} from './dragController.js';
import {IconFactory} from './iconFactory.js';
import {Motion} from './motion.js';
import {cardSurfaceStyle, toolbarSpecularStyle} from './glassMaterial.js';

const MODE_SIZES = {
    mini: {width: 280, height: 136},
    compact: {width: 340, height: 164},
    expanded: {width: 500, height: 310},
};

function isValidMode(mode) {
    return Object.hasOwn(MODE_SIZES, mode) ? mode : 'mini';
}

export class WidgetController {
    constructor(extension, settings, monitor) {
        this._extension = extension;
        this._settings = settings;
        this._monitor = monitor;
        this._data = {
            state: 'INITIALIZING', interfaceName: null, interfaces: [],
            downloadMBps: null, uploadMBps: null, history: [],
            statistics: {}, pingMs: null, pingMessage: null, paused: false,
        };
        this._mode = isValidMode(settings.displayMode);
        this._minimized = false;
        this._destroyed = false;
        this._focused = false;
        this._expandedControls = null;
        this._modeBeforeMinimize = this._mode;
        this._sizeBeforeMinimize = null;

        this._motion = new Motion(Boolean(settings.get('reduce-motion')));
        this._icons = new IconFactory({extension, motion: this._motion});

        this.actor = new St.BoxLayout({
            vertical: true,
            style_class: 'uthy-glass-card',
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: 'Uthy Speed Glass network monitor',
        });
        this._toolbar = new St.BoxLayout({style_class: 'uthy-toolbar', x_expand: true});
        this._dragHandle = new St.BoxLayout({
            style_class: 'uthy-drag-handle',
            reactive: true,
            can_focus: true,
            x_expand: true,
        });
        this._brandIcon = this._icons.createIcon({iconName: 'droplet-symbolic', iconSize: 14,
            styleClass: 'uthy-brand-icon'});
        this._dragHandle.add_child(this._brandIcon);
        this._brandLabel = new St.Label({text: 'UTHY  /  SPEED GLASS', style_class: 'uthy-brand',
            x_expand: true});
        this._dragHandle.add_child(this._brandLabel);
        this._toolbar.add_child(this._dragHandle);

        this._pin = this._icons.createButton({
            iconName: 'pin-symbolic', accessibleName: 'Pin widget position',
            onClicked: () => this._togglePin(),
        });
        this._toolbar.add_child(this._pin.button);
        this._minimize = this._icons.createButton({
            iconName: 'minimize-symbolic', accessibleName: 'Minimize widget',
            onClicked: () => this.minimize(),
        });
        this._toolbar.add_child(this._minimize.button);
        this._expand = this._icons.createButton({
            iconName: 'expand-symbolic', accessibleName: 'Expand widget',
            onClicked: () => this.expand(),
        });
        this._toolbar.add_child(this._expand.button);
        this._close = this._icons.createButton({
            iconName: 'close-symbolic', accessibleName: 'Hide widget',
            onClicked: () => this.setVisible(false),
        });
        this._toolbar.add_child(this._close.button);
        this.actor.add_child(this._toolbar);

        this._body = new St.BoxLayout({vertical: true, style_class: 'uthy-widget-body', x_expand: true, y_expand: true});
        this.actor.add_child(this._body);
        this._resizeHandle = new St.Widget({
            style_class: 'uthy-resize-handle',
            reactive: true,
            can_focus: true,
            accessible_name: 'Resize widget',
            width: 18,
            height: 18,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
        });
        this.actor.add_child(this._resizeHandle);

        this._dragController = new DragController({
            actor: this.actor,
            dragHandle: this._dragHandle,
            resizeHandle: this._resizeHandle,
            settings,
            isPinned: () => Boolean(this._settings.get('pinned')),
        });
        this._monitorSignalId = Main.layoutManager.connect('monitors-changed', () => this._onMonitorsChanged());
        // St resolves an actor's inline style above the theme stylesheet, so
        // the card's focus ring is swapped in here rather than in CSS.
        this._focusInId = this.actor.connect('key-focus-in', () => this._setFocused(true));
        this._focusOutId = this.actor.connect('key-focus-out', () => this._setFocused(false));

        Main.layoutManager.addChrome(this.actor, {affectsStruts: false, trackFullscreen: false});
        this._applyGeometry(true);
        this._applyAppearance();
        this._renderContent();
        this._syncButtons();
        this.setVisible(Boolean(settings.get('show-widget')));
    }

    update(data) {
        if (this._destroyed)
            return;
        this._data = data;
        this._content?.update(data);
    }

    applySettings(changedKey = null) {
        if (this._destroyed)
            return;
        if (changedKey === 'display-mode') {
            this._mode = isValidMode(this._settings.displayMode);
            this._minimized = false;
            this._modeBeforeMinimize = this._mode;
            this._sizeBeforeMinimize = null;
            const size = MODE_SIZES[this._mode];
            this._settings.setInt('widget-width', size.width);
            this._settings.setInt('widget-height', size.height);
            this._applyGeometry(false);
            this._renderContent();
        } else if (changedKey === 'show-widget') {
            this.setVisible(Boolean(this._settings.get('show-widget')));
        } else if (changedKey === 'pinned') {
            this._syncButtons();
        } else if (changedKey === 'reduce-motion') {
            this._motion.setReducedMotion(Boolean(this._settings.get('reduce-motion')));
            this._renderContent();
            this._syncBrandMotion();
        } else if (changedKey === 'remember-position') {
            this._applyGeometry(true);
        } else if (['widget-x', 'widget-y', 'widget-width', 'widget-height'].includes(changedKey)) {
            this._applyGeometry(true);
        } else if (changedKey) {
            this._applyAppearance();
            this._renderContent();
        }
    }

    setVisible(visible) {
        if (this._destroyed)
            return;
        const show = Boolean(visible);
        this._settings.settings.set_boolean('show-widget', show);
        this.actor.visible = show;
        if (show)
            this.actor.show();
        else
            this.actor.hide();
        this._syncBrandMotion();
    }

    expand() {
        if (this._minimized && this._modeBeforeMinimize === 'expanded' && this._sizeBeforeMinimize) {
            const [width, height] = this._sizeBeforeMinimize;
            this._minimized = false;
            this._sizeBeforeMinimize = null;
            this.actor.set_size(width, height);
            this._dragController.clampToMonitor();
            this._renderContent();
            this._syncButtons();
            return;
        }
        this._minimized = false;
        this._mode = 'expanded';
        this._modeBeforeMinimize = 'expanded';
        this._sizeBeforeMinimize = null;
        if (this._settings.displayMode !== 'expanded')
            this._settings.setString('display-mode', 'expanded');
        else
            this._applyGeometry(false);
        this._applyGeometry(false);
        this._renderContent();
        this._syncButtons();
    }

    minimize() {
        if (this._minimized)
            return;
        this._modeBeforeMinimize = this._mode;
        this._sizeBeforeMinimize = this.actor.get_size();
        this._minimized = true;
        this._applyGeometry(false, true);
        this._renderContent();
        this._syncButtons();
    }

    toggleExpanded() {
        if (this._minimized || this._mode !== 'expanded')
            this.expand();
        else {
            this._mode = 'compact';
            this._settings.setString('display-mode', 'compact');
            this._applyGeometry(false);
            this._renderContent();
            this._syncButtons();
        }
    }

    destroy() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        this._motion.stopIdle(this._brandIcon);
        this._icons.destroy();
        this._motion.destroy();
        this._dragController.destroy();
        for (const id of [this._focusInId, this._focusOutId]) {
            if (!id)
                continue;
            try {
                this.actor.disconnect(id);
            } catch (_error) {
                // The actor may already be unmanaged during teardown.
            }
        }
        this._focusInId = 0;
        this._focusOutId = 0;
        if (this._monitorSignalId) {
            try {
                Main.layoutManager.disconnect(this._monitorSignalId);
            } catch (_error) {
                // Main layout manager may already be shutting down.
            }
            this._monitorSignalId = 0;
        }
        this.actor.destroy();
        this._content = null;
        this._expandedControls = null;
        this._settings = null;
        this._monitor = null;
        this._extension = null;
    }

    _renderContent() {
        for (const child of this._body.get_children()) {
            this._body.remove_child(child);
            child.destroy();
        }
        this._expandedControls = null;
        const options = this._appearanceOptions();
        if (this._minimized || this._mode !== 'expanded') {
            this._content = createMiniWidget(this._data, options, {compact: !this._minimized && this._mode === 'compact'});
            this._body.add_child(this._content.actor);
        } else {
            this._content = createExpandedWidget(this._data, options);
            this._body.add_child(this._content.actor);
            this._expandedControls = this._createExpandedControls();
            this._body.add_child(this._expandedControls.actor);
        }
        this._content.update(this._data);
        this._resizeHandle.visible = !this._minimized;
        this._syncButtons();
    }

    _createExpandedControls() {
        const row = new St.BoxLayout({style_class: 'uthy-controls-row', x_expand: true});
        const paused = Boolean(this._data.paused);
        const pause = this._icons.createButton({
            iconName: paused ? 'play-symbolic' : 'pause-symbolic',
            accessibleName: paused ? 'Resume monitoring' : 'Pause monitoring',
            onClicked: () => {
                if (this._monitor.paused)
                    this._monitor.resume();
                else
                    this._monitor.pause();
            },
        });
        const iface = this._icons.createButton({
            label: this._interfaceButtonLabel(),
            styleClass: 'uthy-control-button',
            accessibleName: 'Select network interface',
            onClicked: () => this._cycleInterface(),
        });
        const reset = this._icons.createButton({
            iconName: 'refresh-symbolic', accessibleName: 'Reset session statistics',
            onClicked: () => this._monitor.resetStatistics(),
        });
        const prefs = this._icons.createButton({
            iconName: 'settings-symbolic', accessibleName: 'Open preferences',
            onClicked: () => this._extension.openPreferences(),
        });
        row.add_child(pause.button);
        row.add_child(iface.button);
        row.add_child(reset.button);
        row.add_child(prefs.button);
        row._uthyPause = pause;
        row._uthyInterface = iface;
        return {actor: row, sync: () => this._syncExpandedControls()};
    }

    _syncExpandedControls() {
        if (!this._expandedControls)
            return;
        const row = this._expandedControls.actor;
        const paused = Boolean(this._data.paused);
        this._icons.setIcon(row._uthyPause, paused ? 'play-symbolic' : 'pause-symbolic');
        this._icons.setAccessibleName(row._uthyPause, paused ? 'Resume monitoring' : 'Pause monitoring');
        this._icons.setLabel(row._uthyInterface, this._interfaceButtonLabel());
    }

    _interfaceButtonLabel() {
        const selected = this._settings.interfaceName;
        const active = this._data.interfaceName;
        return selected === 'auto' ? `Auto${active ? ` · ${active}` : ''}` : selected;
    }

    _cycleInterface() {
        const names = ['auto', ...this._data.interfaces.map(item => item.name)];
        const current = this._settings.interfaceName;
        const next = names[(Math.max(0, names.indexOf(current)) + 1) % names.length];
        this._settings.setString('interface', next);
    }

    _togglePin() {
        const next = !this._settings.get('pinned');
        this._settings.settings.set_boolean('pinned', next);
        this._syncButtons();
    }

    _syncButtons() {
        const pinned = Boolean(this._settings.get('pinned'));
        this._icons.setIcon(this._pin, pinned ? 'pin-locked-symbolic' : 'pin-symbolic');
        this._icons.setAccessibleName(this._pin, pinned ? 'Unpin widget position' : 'Pin widget position');
        this._icons.setVisible(this._minimize, !this._minimized && this._mode !== 'mini');
        this._icons.setVisible(this._expand, this._minimized || this._mode !== 'expanded');
        this._icons.setAccessibleName(this._close, 'Hide widget');
        this._syncExpandedControls();
    }

    /** Idle breathing runs only while the card is actually on screen. */
    _syncBrandMotion() {
        if (this._destroyed)
            return;
        if (this.actor.visible && !this._motion.reducedMotion)
            this._motion.breathe(this._brandIcon);
        else
            this._motion.stopIdle(this._brandIcon);
    }

    _appearanceOptions() {
        return {
            downloadColor: this._settings.downloadColor,
            uploadColor: this._settings.uploadColor,
            showGraphs: Boolean(this._settings.get('show-graphs')),
            reduceMotion: this._motion.reducedMotion,
            motion: this._motion,
            graphHeight: this._settings.get('graph-height'),
            pingEnabled: Boolean(this._settings.get('ping-enabled')),
        };
    }

    _applyAppearance() {
        if (!this.actor)
            return;
        const alpha = Math.max(0.45, Math.min(0.96, this._settings.get('transparency') / 100));
        const radius = this._settings.get('corner-radius');
        const fontSize = this._settings.get('font-size');
        this.actor.set_style(cardSurfaceStyle({radius, fontSize, alpha, focused: this._focused}));
        this._toolbar.set_style(toolbarSpecularStyle({radius}));
    }

    _setFocused(focused) {
        if (this._destroyed || this._focused === focused)
            return;
        this._focused = focused;
        this._applyAppearance();
    }

    _applyGeometry(initial, forcePreset = false) {
        if (!this.actor)
            return;
        const mode = this._minimized ? 'mini' : this._mode;
        const minimum = MODE_SIZES[mode] ?? MODE_SIZES.mini;
        let width = forcePreset ? minimum.width : Math.max(minimum.width, this._settings.get('widget-width'));
        let height = forcePreset ? minimum.height : Math.max(minimum.height, this._settings.get('widget-height'));
        const monitors = Main.layoutManager.monitors ?? [];
        const monitor = monitors.find(item => item.x <= this._settings.get('widget-x') &&
            this._settings.get('widget-x') < item.x + item.width) ?? Main.layoutManager.primaryMonitor ?? monitors[0];
        if (monitor) {
            width = Math.min(width, monitor.width);
            height = Math.min(height, monitor.height);
        }
        this.actor.set_size(width, height);

        let x = this._settings.get('widget-x');
        let y = this._settings.get('widget-y');
        if (!this._settings.get('remember-position') && initial && monitor) {
            x = monitor.x + Math.round((monitor.width - width) / 2);
            y = monitor.y + 92;
        }
        if (initial && monitor && x === 24 && y === 120) {
            x += monitor.x;
            y += monitor.y;
        }
        this.actor.set_position(x, y);
        this._dragController?.clampToMonitor();
    }

    _onMonitorsChanged() {
        if (this._destroyed)
            return;
        this._applyGeometry(false);
        this._dragController.clampToMonitor();
    }
}
