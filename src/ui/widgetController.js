import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {createMiniWidget} from './miniWidget.js';
import {createExpandedWidget} from './expandedWidget.js';
import {DragController} from './dragController.js';

const MODE_SIZES = {
    mini: {width: 280, height: 136},
    compact: {width: 340, height: 164},
    expanded: {width: 500, height: 310},
};

function makeButton(iconName, label, onClicked) {
    const icon = new St.Icon({icon_name: iconName, style_class: 'uthy-toolbar-icon', icon_size: 14});
    const button = new St.Button({
        style_class: 'uthy-icon-button',
        can_focus: true,
        reactive: true,
        track_hover: true,
        accessible_name: label,
        child: icon,
    });
    button.connect('clicked', onClicked);
    return {button, icon};
}

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
        this._expandedControls = null;
        this._modeBeforeMinimize = this._mode;
        this._sizeBeforeMinimize = null;

        this.actor = new St.BoxLayout({
            vertical: true,
            style_class: 'uthy-glass-card',
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: 'Uthy Speed Glass network monitor',
        });
        this._toolbar = new St.BoxLayout({style_class: 'uthy-toolbar', x_expand: true});
        this._dragHandle = new St.Widget({
            style_class: 'uthy-drag-handle',
            reactive: true,
            can_focus: true,
            x_expand: true,
        });
        this._dragHandle.add_child(new St.Label({text: 'UTHY  /  SPEED GLASS', style_class: 'uthy-brand'}));
        this._toolbar.add_child(this._dragHandle);

        this._pin = makeButton('changes-allow-symbolic', 'Pin widget position', () => this._togglePin());
        this._toolbar.add_child(this._pin.button);
        this._minimize = makeButton('window-minimize-symbolic', 'Minimize widget', () => this.minimize());
        this._toolbar.add_child(this._minimize.button);
        this._expand = makeButton('view-more-symbolic', 'Expand widget', () => this.expand());
        this._toolbar.add_child(this._expand.button);
        this._close = makeButton('window-close-symbolic', 'Hide widget', () => this.setVisible(false));
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
        this._dragController.destroy();
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
        const pause = makeButton(this._data.paused ? 'media-playback-start-symbolic' : 'media-playback-pause-symbolic',
            this._data.paused ? 'Resume monitoring' : 'Pause monitoring', () => {
                if (this._monitor.paused)
                    this._monitor.resume();
                else
                    this._monitor.pause();
            });
        const iface = new St.Button({
            style_class: 'uthy-control-button', can_focus: true, reactive: true,
            accessible_name: 'Select network interface',
            label: this._interfaceButtonLabel(),
        });
        iface.connect('clicked', () => this._cycleInterface());
        const reset = makeButton('view-refresh-symbolic', 'Reset session statistics', () => this._monitor.resetStatistics());
        const prefs = makeButton('preferences-system-symbolic', 'Open preferences', () => this._extension.openPreferences());
        row.add_child(pause.button);
        row.add_child(iface);
        row.add_child(reset.button);
        row.add_child(prefs.button);
        row._uthyPauseIcon = pause.icon;
        row._uthyPauseButton = pause.button;
        row._uthyInterfaceButton = iface;
        return {actor: row, sync: () => this._syncExpandedControls()};
    }

    _syncExpandedControls() {
        if (!this._expandedControls)
            return;
        const row = this._expandedControls.actor;
        row._uthyPauseIcon.icon_name = this._data.paused ? 'media-playback-start-symbolic' : 'media-playback-pause-symbolic';
        row._uthyPauseButton.accessible_name = this._data.paused ? 'Resume monitoring' : 'Pause monitoring';
        row._uthyInterfaceButton.label = this._interfaceButtonLabel();
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
        this._pin.icon.icon_name = pinned ? 'changes-prevent-symbolic' : 'changes-allow-symbolic';
        this._pin.button.accessible_name = pinned ? 'Unpin widget position' : 'Pin widget position';
        this._minimize.button.visible = !this._minimized && this._mode !== 'mini';
        this._expand.button.visible = this._minimized || this._mode !== 'expanded';
        this._expand.icon.icon_name = this._minimized ? 'view-more-symbolic' : 'view-more-symbolic';
        this._close.button.accessible_name = 'Hide widget';
        this._syncExpandedControls();
    }

    _appearanceOptions() {
        return {
            downloadColor: this._settings.downloadColor,
            uploadColor: this._settings.uploadColor,
            showGraphs: Boolean(this._settings.get('show-graphs')),
            reduceMotion: Boolean(this._settings.get('reduce-motion')),
            graphHeight: this._settings.get('graph-height'),
            pingEnabled: Boolean(this._settings.get('ping-enabled')),
        };
    }

    _applyAppearance() {
        if (!this.actor)
            return;
        const transparency = Math.max(0.45, Math.min(0.96, this._settings.get('transparency') / 100));
        const radius = this._settings.get('corner-radius');
        const fontSize = this._settings.get('font-size');
        this.actor.set_style(`background-color: rgba(18, 28, 46, ${transparency.toFixed(2)}); border-radius: ${radius}px; font-size: ${fontSize}px;`);
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
