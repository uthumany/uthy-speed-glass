import St from 'gi://St';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {SettingsManager} from './src/settings/settingsManager.js';
import {NetworkMonitor} from './src/network/networkMonitor.js';
import {WidgetController} from './src/ui/widgetController.js';

export default class UthySpeedGlassExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._settingsManager = new SettingsManager(this._settings);
        this.loadStylesheet();

        let controller = null;
        this._monitor = new NetworkMonitor(this._settingsManager, data => controller?.update(data));
        this._controller = new WidgetController(this, this._settingsManager, this._monitor);
        controller = this._controller;

        this._createPanelIndicator();
        this._settingsChangedId = this._settings.connect('changed', (_settings, key) => {
            if (['refresh-interval', 'interface', 'ping-enabled'].includes(key))
                this._monitor.configure();
            this._controller.applySettings(key);
            this._syncPanelMenu();
        });
        this._monitor.start();
    }

    disable() {
        if (this._settingsChangedId && this._settings) {
            try {
                this._settings.disconnect(this._settingsChangedId);
            } catch (_error) {
                // The settings object may already be shutting down.
            }
            this._settingsChangedId = 0;
        }

        this._monitor?.destroy();
        this._monitor = null;
        this._controller?.destroy();
        this._controller = null;
        this._indicator?.destroy();
        this._indicator = null;
        this._settingsManager = null;
        this._settings = null;
        this.unloadStylesheet();
    }

    _createPanelIndicator() {
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);
        this._indicator.add_child(new St.Icon({
            icon_name: 'network-transmit-receive-symbolic',
            style_class: 'system-status-icon',
        }));
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._showItem = new PopupMenu.PopupMenuItem('Show widget');
        this._showItem.connect('activate', () => {
            this._controller.setVisible(!this._controller.actor.visible);
            this._syncPanelMenu();
        });
        this._indicator.menu.addMenuItem(this._showItem);

        this._pauseItem = new PopupMenu.PopupMenuItem('Pause monitoring');
        this._pauseItem.connect('activate', () => {
            if (this._monitor.paused)
                this._monitor.resume();
            else
                this._monitor.pause();
            this._syncPanelMenu();
        });
        this._indicator.menu.addMenuItem(this._pauseItem);

        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addAction(_('Reset session statistics'), () => this._monitor.resetStatistics());
        this._indicator.menu.addAction(_('Preferences'), () => this.openPreferences());
        this._syncPanelMenu();
    }

    _syncPanelMenu() {
        if (!this._indicator)
            return;
        const visible = Boolean(this._controller?.actor.visible);
        this._showItem.label.text = visible ? 'Hide widget' : 'Show widget';
        this._pauseItem.label.text = this._monitor?.paused ? 'Resume monitoring' : 'Pause monitoring';
    }
}
