// Animated 3D icon controls.
//
// The bundled icons in `icons/` are the supplied skeuomorphic artwork,
// prepared by `scripts/prepare-icons.py`: each one is trimmed to its artwork,
// scaled to a common weight and stripped of the flat plate and border that
// two of the sources carried, so no icon is drawn inside a frame. This factory
// gives each control its spring motion (press squash, release overshoot, hover
// lift) and its pressed material state.
//
// If a bundled asset is missing, the factory falls back to the matching
// symbolic icon from the user's icon theme, so a partial install still
// produces a usable toolbar instead of blank buttons.

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import St from 'gi://St';

import {createEngravedText} from './engravedText.js';

const THEME_FALLBACKS = {
    'brand': 'network-transmit-receive-symbolic',
    'notification': 'preferences-system-notifications-symbolic',
    'pin': 'changes-allow-symbolic',
    'pin-locked': 'changes-prevent-symbolic',
    'minimize': 'window-minimize-symbolic',
    'expand': 'view-more-symbolic',
    'close': 'window-close-symbolic',
    'pause': 'media-playback-pause-symbolic',
    'play': 'media-playback-start-symbolic',
    'refresh': 'view-refresh-symbolic',
    'settings': 'preferences-system-symbolic',
    'download': 'go-down-symbolic',
    'upload': 'go-up-symbolic',
    'share': 'emblem-shared-symbolic',
};

export class IconFactory {
    constructor({extension, motion, iconDirectory = 'icons'}) {
        this._motion = motion;
        this._directory = extension.dir.get_child(iconDirectory);
        this._cache = new Map();
        this._records = new Set();
        this._destroyed = false;
    }

    /** Bundled icon file, or null when the asset is not installed. */
    _fileIcon(iconName) {
        if (this._cache.has(iconName))
            return this._cache.get(iconName);
        let fileIcon = null;
        for (const extension of ['.png', '.svg']) {
            try {
                const file = this._directory.get_child(`${iconName}${extension}`);
                if (file.query_exists(null)) {
                    fileIcon = new Gio.FileIcon({file});
                    break;
                }
            } catch (_error) {
                fileIcon = null;
            }
        }
        this._cache.set(iconName, fileIcon);
        return fileIcon;
    }

    /**
     * Standalone 3D icon, used for the brand mark.
     *
     * St.Icon defaults to symbolic style, which flattens any icon into a
     * monochrome mask and would discard the depth in the bundled artwork. The
     * `uthy-3d-icon` class therefore requests regular style, while the theme
     * fallback keeps symbolic style so it is tinted by the CSS colour instead
     * of rendering in its hard-coded palette.
     */
    createIcon({iconName, iconSize = 16, styleClass = 'uthy-3d-icon'}) {
        const fileIcon = this._fileIcon(iconName);
        if (fileIcon)
            return new St.Icon({gicon: fileIcon, icon_size: iconSize, style_class: styleClass});
        return new St.Icon({
            icon_name: THEME_FALLBACKS[iconName] ?? iconName,
            icon_size: iconSize,
            style_class: 'uthy-theme-icon',
        });
    }

    /**
     * A tactile control: an icon button or, when `label` is given, a labelled
     * control. Both share the same press, release and hover behaviour.
     */
    createButton({iconName = null, label = null, accessibleName, styleClass = 'uthy-icon-button',
        iconSize = 16, onClicked}) {
        const hasLabel = label !== null;
        // Raised controls (the tray buttons) travel towards the pointer and
        // press into their own shadow; the bare toolbar icons only squash, so
        // the 3D artwork never slides around inside the title strip.
        const raised = styleClass === 'uthy-control-button';
        // A labelled control is stamped into its plate: the same engraved pair
        // the rest of the interface uses, so the type never looks flat.
        const engraved = hasLabel ? createEngravedText({text: label, role: 'control'}) : null;
        const child = engraved ? engraved.actor : this.createIcon({iconName, iconSize});
        const button = new St.Button({
            style_class: styleClass,
            can_focus: true,
            reactive: true,
            track_hover: true,
            accessible_name: accessibleName,
            child,
        });
        const record = {
            button,
            icon: hasLabel ? null : child,
            iconName: hasLabel ? null : iconName,
            label: engraved,
            labelText: hasLabel ? label : null,
        };
        this._records.add(record);

        // Press visuals are driven here rather than by St's own pseudo class
        // so the squash, the overshoot and the material state stay in sync.
        record.pressId = button.connect('button-press-event', () => {
            button.add_style_pseudo_class('active');
            if (raised)
                this._motion.pressControl(button);
            else
                this._motion.press(button);
            return Clutter.EVENT_PROPAGATE;
        });
        record.releaseId = button.connect('button-release-event', () => {
            button.remove_style_pseudo_class('active');
            if (raised)
                this._motion.settleControl(button);
            else
                this._motion.release(button);
            return Clutter.EVENT_PROPAGATE;
        });
        record.enterId = button.connect('enter-event', () => {
            if (raised)
                this._motion.raiseControl(button);
            else
                this._motion.lift(button);
            return Clutter.EVENT_PROPAGATE;
        });
        record.leaveId = button.connect('leave-event', () => {
            button.remove_style_pseudo_class('active');
            if (raised)
                this._motion.settleControl(button);
            else
                this._motion.rest(button);
            return Clutter.EVENT_PROPAGATE;
        });
        if (onClicked)
            record.clickId = button.connect('clicked', () => onClicked());
        return record;
    }

    /** Swap the icon of an existing control, for stateful buttons. */
    setIcon(record, iconName) {
        if (!record || record.iconName === iconName)
            return;
        record.iconName = iconName;
        if (!record.icon)
            return;
        const fileIcon = this._fileIcon(iconName);
        if (fileIcon) {
            record.icon.gicon = fileIcon;
            record.icon.style_class = 'uthy-3d-icon';
        } else {
            record.icon.gicon = null;
            record.icon.icon_name = THEME_FALLBACKS[iconName] ?? iconName;
            record.icon.style_class = 'uthy-theme-icon';
        }
    }

    setLabel(record, text) {
        if (record?.label && record.labelText !== text) {
            record.labelText = text;
            record.label.setText(text);
        }
    }

    setAccessibleName(record, name) {
        if (record)
            record.button.accessible_name = name;
    }

    setVisible(record, visible) {
        if (record)
            record.button.visible = Boolean(visible);
    }

    destroy() {
        if (this._destroyed)
            return;
        for (const record of this._records) {
            for (const key of ['pressId', 'releaseId', 'enterId', 'leaveId', 'clickId']) {
                const id = record[key];
                if (!id)
                    continue;
                try {
                    record.button.disconnect(id);
                } catch (_error) {
                    // The button may already be destroyed with its parent.
                }
                record[key] = 0;
            }
        }
        this._records.clear();
        this._cache.clear();
        this._destroyed = true;
    }
}
