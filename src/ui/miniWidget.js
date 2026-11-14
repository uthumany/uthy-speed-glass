import St from 'gi://St';
import {createHistoryGraph} from './historyGraph.js';
import {formatSpeed} from '../network/speedCalculator.js';

function makeCell({label, iconName, arrow, color, speed, motion, icons = null}) {
    const cell = new St.BoxLayout({vertical: true, style_class: 'uthy-mini-cell', x_expand: true});
    const top = new St.BoxLayout({style_class: 'uthy-mini-speed-row'});
    // The bundled metric icon when it is installed, otherwise the typographic
    // arrow tinted with the user's accent colour.
    const symbol = icons
        ? icons.createIcon({iconName, iconSize: 16, styleClass: 'uthy-mini-icon'})
        : new St.Label({text: arrow, style_class: 'uthy-mini-arrow'});
    if (!icons)
        symbol.set_style(`color: ${color};`);
    const value = new St.Label({text: formatSpeed(speed), style_class: 'uthy-mini-speed', x_expand: true});
    value.clutter_text.ellipsize = 3;
    const caption = new St.Label({text: label, style_class: 'uthy-mini-caption'});
    top.add_child(symbol);
    top.add_child(value);
    cell.add_child(top);
    cell.add_child(caption);
    return {cell, value, motion, lastReading: null};
}

function connectionText(data) {
    const labels = {
        INITIALIZING: 'Initializing', CONNECTED: 'Connected', DISCONNECTED: 'Disconnected',
        PAUSED: 'Paused', ERROR: 'Monitor error', DISABLED: 'Disabled',
    };
    const base = labels[data.state] ?? 'Initializing';
    return data.interfaceName ? `${base} · ${data.interfaceName}` : base;
}

export function createMiniWidget(data, options, {compact = false} = {}) {
    const root = new St.BoxLayout({vertical: true, style_class: compact ? 'uthy-mini-content uthy-compact-content' : 'uthy-mini-content'});
    const readings = new St.BoxLayout({style_class: 'uthy-mini-readings', x_expand: true});
    const download = makeCell({label: 'DOWNLOAD', arrow: '↓', color: options.downloadColor,
        iconName: 'download', speed: data.downloadMBps, motion: options.motion,
        icons: options.icons ?? null});
    const upload = makeCell({label: 'UPLOAD', arrow: '↑', color: options.uploadColor,
        iconName: 'upload', speed: data.uploadMBps, motion: options.motion,
        icons: options.icons ?? null});
    readings.add_child(download.cell);
    readings.add_child(upload.cell);
    root.add_child(readings);

    let graph = null;
    if (options.showGraphs) {
        graph = createHistoryGraph({height: compact ? 26 : 18,
            downloadColor: options.downloadColor, uploadColor: options.uploadColor});
        root.add_child(graph.actor);
        graph.update(data.history);
    }

    const status = new St.Label({text: connectionText(data), style_class: 'uthy-status-line', x_expand: true});
    status.clutter_text.ellipsize = 3;
    root.add_child(status);

    const syncCell = (cell, next) => {
        const reading = formatSpeed(next);
        if (cell.lastReading !== null && cell.lastReading !== reading && cell.motion)
            cell.motion.pulse(cell.value, 1.04, 170);
        cell.lastReading = reading;
        cell.value.text = reading;
    };

    return {
        actor: root,
        update(next) {
            syncCell(download, next.downloadMBps);
            syncCell(upload, next.uploadMBps);
            download.value.accessible_name = `Download: ${formatSpeed(next.downloadMBps)}`;
            upload.value.accessible_name = `Upload: ${formatSpeed(next.uploadMBps)}`;
            status.text = connectionText(next);
            if (graph)
                graph.update(next.history);
        },
    };
}
