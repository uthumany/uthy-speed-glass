import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {createMiniWidget} from './miniWidget.js';
import {createExpandedWidget} from './expandedWidget.js';
import {DragController} from './dragController.js';
import {createGlassBackdrop} from './glassBackdrop.js';
import {IconFactory} from './iconFactory.js';
import {Motion} from './motion.js';
import {cardSurfaceStyle, floatingTrayStyle} from './glassMaterial.js';

const MODE_SIZES = {
    mini: {width: 280, height: 136},
    compact: {width: 340, height: 164},
    expanded: {width: 500, height: 310},
};

/** How far the control tray hangs below the slab's bottom edge. */
const TRAY_OVERHANG = 10;

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
        this._tray = null;
        this._modeBeforeMinimize = this._mode;
        this._sizeBeforeMinimize = null;

        this._motion = new Motion(Boolean(settings.get('reduce-motion')));
        this._icons = new IconFactory({extension, motion: this._motion});

        // The card is a stack, not a column: a backdrop, the content column,
        // the resize grip and - in expanded mode - the floating control tray.
        // The z-order is the design's depth order, from the slab's inner
        // surface up to the tray that hovers above everything else.
        this.actor = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            style_class: 'uthy-glass-card',
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: 'UthyPing network monitor',
        });
        this._backdrop = createGlassBackdrop();
        this.actor.add_child(this._backdrop);
        this._stack = new St.BoxLayout({
            vertical: true,
            style_class: 'uthy-card-stack',
            x_expand: true,
            y_expand: true,
        });
        this.actor.add_child(this._stack);
        this._toolbar = new St.BoxLayout({style_class: 'uthy-toolbar', x_expand: true});
        this._dragHandle = new St.BoxLayout({
            style_class: 'uthy-drag-handle',
            reactive: true,
            can_focus: true,
            x_expand: true,
        });
        // The title strip is itself the recess: the drag handle carries the
        // sunken material, so the name reads as pressed into the card.
        this._brandIcon = this._icons.createIcon({iconName: 'brand', iconSize: 16,
            styleClass: 'uthy-brand-icon'});
        this._dragHandle.add_child(this._brandIcon);
        this._brandLabel = new St.Label({text: 'UthyPing', style_class: 'uthy-brand',
            x_expand: true});
        this._dragHandle.add_child(this._brandLabel);
        this._toolbar.add_child(this._dragHandle);

        this._pin = this._icons.createButton({
            iconName: 'pin', accessibleName: 'Pin widget position',
            onClicked: () => this._togglePin(),
        });
        this._toolbar.add_child(this._pin.button);
        this._minimize = this._icons.createButton({
            iconName: 'minimize', accessibleName: 'Minimize widget',
            onClicked: () => this._setMinimized(true),
        });
        this._toolbar.add_child(this._minimize.button);
        this._expand = this._icons.createButton({
            iconName: 'expand', accessibleName: 'Expand widget',
            onClicked: () => this._setMinimized(false),
        });
        this._toolbar.add_child(this._expand.button);
        this._close = this._icons.createButton({
            iconName: 'close', accessibleName: 'Hide widget',
            onClicked: () => this.setVisible(false),
        });
        this._toolbar.add_child(this._close.button);
        this._stack.add_child(this._toolbar);

        this._body = new St.BoxLayout({vertical: true, style_class: 'uthy-widget-body', x_expand: true, y_expand: true});
        this._stack.add_child(this._body);
        this._resizeHandle = new St.Widget({
            style_class: 'uthy-resize-handle',
            reactive: true,
            can_focus: true,
            accessible_name: 'Resize widget',
            width: 18,
            height: 18,
        });
        // BinLayout fills an expanding child and centres one that does not
        // expand, so an anchored layer is built the other way round: the layer
        // itself fills the card, and a spacer column inside it pushes the
        // anchored actor down to the bottom edge. Both layers are transparent
        // to input, so only the controls inside them react.
        const grip = this._createBottomLayer();
        this._gripLayer = grip.layer;
        this._resizeHandle.x_align = Clutter.ActorAlign.END;
        grip.column.add_child(this._resizeHandle);
        const tray = this._createBottomLayer();
        this._trayLayer = tray.layer;
        this._trayColumn = tray.column;
        this.actor.add_child(this._gripLayer);
        this.actor.add_child(this._trayLayer);

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
        // A chrome actor never receives key focus on its own: Tab on the
        // desktop does not reach it and a press does not grab focus, so the
        // ring above would be unreachable. Hand focus over when the widget is
        // pressed, which also lets Tab walk the controls from there, and let
        // Escape release it again.
        this._pressId = this.actor.connect('button-press-event', () => {
            this.actor.grab_key_focus();
            return Clutter.EVENT_PROPAGATE;
        });
        this._keyId = this.actor.connect('key-press-event', (_actor, event) => {
            const symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Escape) {
                global.stage.set_key_focus(null);
                return Clutter.EVENT_STOP;
            }
            const backwards = symbol === Clutter.KEY_ISO_Left_Tab
                || symbol === Clutter.KEY_Up || symbol === Clutter.KEY_Left
                || Boolean(event.get_state() & Clutter.ModifierType.SHIFT_MASK);
            if (symbol === Clutter.KEY_Tab || symbol === Clutter.KEY_ISO_Left_Tab
                || symbol === Clutter.KEY_Up || symbol === Clutter.KEY_Down
                || symbol === Clutter.KEY_Left || symbol === Clutter.KEY_Right)
                return this._cycleFocus(backwards ? -1 : 1);
            return Clutter.EVENT_PROPAGATE;
        });

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
        for (const id of [this._focusInId, this._focusOutId, this._pressId, this._keyId]) {
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
        this._pressId = 0;
        this._keyId = 0;
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
        if (this._tray) {
            this._trayColumn.remove_child(this._tray.actor);
            this._tray.actor.destroy();
            this._tray = null;
        }
        this._stack.remove_style_class_name('uthy-stack-tray');
        this._expandedControls = null;
        const options = this._appearanceOptions();
        if (this._minimized || this._mode !== 'expanded') {
            this._content = createMiniWidget(this._data, options, {compact: !this._minimized && this._mode === 'compact'});
            this._body.add_child(this._content.actor);
        } else {
            this._content = createExpandedWidget(this._data, options);
            this._body.add_child(this._content.actor);
            // The controls leave the column and become a separate layer that
            // hovers above the slab's bottom edge, so the tray reserves its
            // own strip inside the column instead of sitting in it.
            this._stack.add_style_class_name('uthy-stack-tray');
            this._tray = this._createExpandedControls();
            this._trayColumn.add_child(this._tray.actor);
            this._expandedControls = this._tray;
        }
        this._content.update(this._data);
        this._resizeHandle.visible = !this._minimized;
        this._syncButtons();
    }

    /**
     * A full-size layer whose children are pinned to the bottom edge. BinLayout
     * fills the column because the column expands, and the spacer inside the
     * column pushes whatever follows it down, which is the only anchoring St
     * gives us for free. The caller sets each child's horizontal alignment.
     */
    _createBottomLayer() {
        const layer = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
            reactive: false,
        });
        const column = new St.BoxLayout({vertical: true, x_expand: true, y_expand: true});
        column.add_child(new St.Widget({y_expand: true}));
        layer.add_child(column);
        return {layer, column};
    }

    _createExpandedControls() {
        const row = new St.BoxLayout({
            style_class: 'uthy-controls-row uthy-floating-tray',
            translation_y: TRAY_OVERHANG,
        });
        row.x_align = Clutter.ActorAlign.CENTER;
        row.set_style(floatingTrayStyle());
        const paused = Boolean(this._data.paused);
        const pause = this._icons.createButton({
            iconName: paused ? 'play' : 'pause',
            styleClass: 'uthy-control-button',
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
            iconName: 'refresh', styleClass: 'uthy-control-button',
            accessibleName: 'Reset session statistics',
            onClicked: () => this._monitor.resetStatistics(),
        });
        const prefs = this._icons.createButton({
            iconName: 'settings', styleClass: 'uthy-control-button',
            accessibleName: 'Open preferences',
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
        this._icons.setIcon(row._uthyPause, paused ? 'play' : 'pause');
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
        this._icons.setIcon(this._pin, pinned ? 'pin-locked' : 'pin');
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

    /** Bundled icon, for the panel indicator the extension owns. */
    createIcon(options) {
        return this._icons.createIcon(options);
    }

    _appearanceOptions() {
        return {
            downloadColor: this._settings.downloadColor,
            uploadColor: this._settings.uploadColor,
            showGraphs: Boolean(this._settings.get('show-graphs')),
            reduceMotion: this._motion.reducedMotion,
            motion: this._motion,
            graphHeight: this._settings.get('graph-height'),
            // The metric marks are the bundled download and upload icons;
            // without the factory the widgets fall back to text arrows.
            icons: this._icons,
            pingEnabled: Boolean(this._settings.get('ping-enabled')),
        };
    }

    _applyAppearance() {
        if (!this.actor)
            return;
        const alpha = Math.max(0.45, Math.min(0.96, this._settings.get('transparency') / 100));
        const fontSize = this._settings.get('font-size');
        // Corners are square by definition now, so the surface carries no
        // radius at all. The title strip's sheen is painted by the backdrop
        // rather than by a second surface with its own shadow.
        this.actor.set_style(cardSurfaceStyle({fontSize, alpha, focused: this._focused}));
    }

    /**
     * Move keyboard focus to the next or previous control.
     *
     * St does not traverse into the children of a chrome actor on Tab, so the
     * widget walks its own buttons: every St.Button in the tree is a stop, the
     * cycle wraps, and the focused button keeps the theme's `:focus` ring.
     * Enter and Space then activate it, because St.Button handles those keys
     * itself.
     */
    _cycleFocus(direction) {
        const stops = [];
        const collect = actor => {
            if (actor instanceof St.Button && actor.visible && actor.mapped)
                stops.push(actor);
            for (const child of actor.get_children())
                collect(child);
        };
        collect(this.actor);
        if (!stops.length)
            return Clutter.EVENT_PROPAGATE;

        const current = global.stage.get_key_focus();
        const index = stops.indexOf(current);
        const next = index < 0
            ? (direction > 0 ? 0 : stops.length - 1)
            : (index + direction + stops.length) % stops.length;
        stops[next].grab_key_focus();
        return Clutter.EVENT_STOP;
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
