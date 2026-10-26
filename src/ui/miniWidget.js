import St from 'gi://St';
import {createHistoryGraph} from './historyGraph.js';
import {formatSpeed} from '../network/speedCalculator.js';

function makeCell({label, arrow, color, speed}) {
    const cell = new St.BoxLayout({vertical: true, style_class: 'uthy-mini-cell', x_expand: true});
    const top = new St.BoxLayout({style_class: 'uthy-mini-speed-row'});
    const symbol = new St.Label({text: arrow, style_class: 'uthy-mini-arrow'});
    symbol.set_style(`color: ${color};`);
    const value = new St.Label({text: formatSpeed(speed), style_class: 'uthy-mini-speed', x_expand: true});
    value.clutter_text.ellipsize = 3;
    const caption = new St.Label({text: label, style_class: 'uthy-mini-caption'});
    top.add_child(symbol);
    top.add_child(value);
    cell.add_child(top);
    cell.add_child(caption);
    return {cell, value};
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
    const download = makeCell({label: 'DOWNLOAD', arrow: '↓', color: options.downloadColor, speed: data.downloadMBps});
    const upload = makeCell({label: 'UPLOAD', arrow: '↑', color: options.uploadColor, speed: data.uploadMBps});
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

    return {
        actor: root,
        update(next) {
            download.value.text = formatSpeed(next.downloadMBps);
            upload.value.text = formatSpeed(next.uploadMBps);
            download.value.accessible_name = `Download: ${formatSpeed(next.downloadMBps)}`;
            upload.value.accessible_name = `Upload: ${formatSpeed(next.uploadMBps)}`;
            status.text = connectionText(next);
            if (graph)
                graph.update(next.history);
        },
    };
}
