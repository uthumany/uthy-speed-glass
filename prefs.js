import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function getInterfaceNames() {
    const names = [];
    let directory = null;
    try {
        directory = GLib.dir_open('/sys/class/net', 0);
        while (true) {
            const name = GLib.dir_read_name(directory);
            if (name === null)
                break;
            if (name !== 'lo' && /^[A-Za-z0-9_.:-]{1,15}$/.test(name))
                names.push(name);
        }
    } catch (_error) {
        // The automatic option remains available if sysfs cannot be read.
    } finally {
        if (directory !== null) {
            try { GLib.dir_close(directory); } catch (_error) { /* already closed */ }
        }
    }
    return names.sort();
}

function addSwitch(group, settings, key, title, subtitle) {
    const row = new Adw.SwitchRow({title, subtitle});
    group.add(row);
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

function addCombo(group, title, subtitle, options, selectedValue, onSelected) {
    const model = Gtk.StringList.new(options.map(option => option.label));
    const selected = Math.max(0, options.findIndex(option => option.value === selectedValue));
    const row = new Adw.ComboRow({title, subtitle, model, selected});
    row.connect('notify::selected', () => {
        const option = options[row.selected];
        if (option)
            onSelected(option.value);
    });
    group.add(row);
    return row;
}

function addSpin(group, title, subtitle, value, lower, upper, onValue) {
    const row = Adw.SpinRow.new_with_range(lower, upper, 1);
    row.title = title;
    row.subtitle = subtitle;
    row.value = value;
    row.connect('notify::value', () => onValue(Math.round(row.value)));
    group.add(row);
    return row;
}

export default class UthySpeedGlassPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.search_enabled = false;
        window.default_width = 650;
        window.default_height = 760;

        const page = new Adw.PreferencesPage({title: 'Uthy Speed Glass', icon_name: 'network-transmit-receive-symbolic'});
        window.add(page);

        const general = new Adw.PreferencesGroup({title: 'Monitoring', description: 'Choose how traffic is sampled and which interface is measured.'});
        page.add(general);
        addCombo(general, 'Refresh interval', 'Sampling frequency for local interface counters.', [
            {label: '500 ms', value: 500}, {label: '1 second', value: 1000}, {label: '2 seconds', value: 2000},
        ], settings.get_int('refresh-interval'), value => settings.set_int('refresh-interval', value));

        const interfaceNames = ['auto', ...getInterfaceNames()];
        const currentInterface = settings.get_string('interface');
        const interfaceOptions = interfaceNames.map(name => ({
            label: name === 'auto' ? 'Automatic (active connection)' : name,
            value: name,
        }));
        const safeInterface = interfaceNames.includes(currentInterface) ? currentInterface : 'auto';
        addCombo(general, 'Network interface', 'Ethernet, Wi-Fi, USB tethering, and visible virtual interfaces.',
            interfaceOptions, safeInterface, value => settings.set_string('interface', value));

        const modeOptions = [
            {label: 'Mini', value: 'mini'}, {label: 'Compact', value: 'compact'}, {label: 'Expanded', value: 'expanded'},
        ];
        const selectedMode = modeOptions.some(option => option.value === settings.get_string('display-mode'))
            ? settings.get_string('display-mode') : 'mini';
        addCombo(general, 'Display mode', 'Select the default floating widget layout.', modeOptions,
            selectedMode, value => settings.set_string('display-mode', value));

        const appearance = new Adw.PreferencesGroup({title: 'Appearance', description: 'Tune the liquid-glass surface, colors, and graph.'});
        page.add(appearance);
        addSpin(appearance, 'Surface opacity', 'Higher values make the glass surface less transparent.',
            settings.get_int('transparency'), 45, 96, value => settings.set_int('transparency', value));
        addSpin(appearance, 'Font size', 'Widget text size in logical pixels.',
            settings.get_int('font-size'), 10, 22, value => settings.set_int('font-size', value));
        addSpin(appearance, 'Corner radius', 'Rounded surface corners in logical pixels.',
            settings.get_int('corner-radius'), 10, 36, value => settings.set_int('corner-radius', value));
        addSpin(appearance, 'Graph height', 'Expanded graph height in logical pixels.',
            settings.get_int('graph-height'), 24, 100, value => settings.set_int('graph-height', value));

        this._addColorRow(appearance, settings, 'download-color', 'Download accent color', '#27C9FF');
        this._addColorRow(appearance, settings, 'upload-color', 'Upload accent color', '#A56BFF');
        addSwitch(appearance, settings, 'show-graphs', 'Show history graphs', 'Draw recent download and upload traffic.');

        const behavior = new Adw.PreferencesGroup({title: 'Behavior', description: 'Control placement, motion, and optional local latency checks.'});
        page.add(behavior);
        addSwitch(behavior, settings, 'remember-position', 'Remember position and size', 'Keep the widget geometry between sessions.');
        addSwitch(behavior, settings, 'reduce-motion', 'Reduce motion', 'Disable animated speed meter transitions.');
        addSwitch(behavior, settings, 'ping-enabled', 'Measure local gateway ping', 'Optional: sends one ICMP echo to your current IPv4 default gateway every 10 seconds. IPv6-only gateway discovery is not supported. No ping target is contacted while this is off.');

    }

    _addColorRow(group, settings, key, title, fallback) {
        const row = new Adw.EntryRow({title});
        const current = settings.get_string(key);
        row.text = COLOR_PATTERN.test(current) ? current : fallback;
        row.connect('changed', () => {
            if (COLOR_PATTERN.test(row.text))
                settings.set_string(key, row.text.toUpperCase());
        });
        group.add(row);
    }
}
