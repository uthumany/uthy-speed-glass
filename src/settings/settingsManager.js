import {INTERFACE_NAME_PATTERN} from '../network/trafficReader.js';

const VALID_REFRESH_INTERVALS = [500, 1000, 2000];
const VALID_MODES = ['mini', 'compact', 'expanded'];
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class SettingsManager {
    constructor(settings) {
        this.settings = settings;
    }

    get refreshInterval() {
        const value = this.settings.get_int('refresh-interval');
        return VALID_REFRESH_INTERVALS.includes(value) ? value : 1000;
    }

    get interfaceName() {
        const value = this.settings.get_string('interface');
        return value === 'auto' || INTERFACE_NAME_PATTERN.test(value) ? value : 'auto';
    }

    get displayMode() {
        const value = this.settings.get_string('display-mode');
        return VALID_MODES.includes(value) ? value : 'mini';
    }

    get downloadColor() {
        return this._readColor('download-color', '#27C9FF');
    }

    get uploadColor() {
        return this._readColor('upload-color', '#A56BFF');
    }

    get(key) {
        return this.settings.get_value(key).deep_unpack();
    }

    setInt(key, value) {
        const ranges = {
            'refresh-interval': [500, 2000], 'widget-x': [-10000, 10000],
            'widget-y': [-10000, 10000], 'widget-width': [240, 1000],
            'widget-height': [70, 700], 'transparency': [45, 96],
            'font-size': [10, 22], 'corner-radius': [10, 36],
            'graph-height': [24, 100],
        };
        const range = ranges[key];
        if (!range || !Number.isFinite(value))
            return false;
        return this.settings.set_int(key, Math.max(range[0], Math.min(range[1], Math.round(value))));
    }

    setString(key, value) {
        if (key === 'interface' && value !== 'auto' && !INTERFACE_NAME_PATTERN.test(value))
            return false;
        if (key === 'display-mode' && !VALID_MODES.includes(value))
            return false;
        if ((key === 'download-color' || key === 'upload-color') && !COLOR_PATTERN.test(value))
            return false;
        return this.settings.set_string(key, value);
    }

    _readColor(key, fallback) {
        const value = this.settings.get_string(key);
        return COLOR_PATTERN.test(value) ? value : fallback;
    }
}
