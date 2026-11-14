import St from 'gi://St';
import {createHistoryGraph} from './historyGraph.js';
import {createStatusLine} from './ledIndicator.js';
import {formatSpeed} from '../network/speedCalculator.js';
import {createEngravedBand, createEngravedText} from './engravedText.js';

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
    const value = createEngravedText({text: formatSpeed(speed), role: 'mini-value',
        xExpand: true, ellipsize: 3});
    // The caption is punched into a metal band, so it reads as recessed into
    // the glass rather than printed on top of it.
    const caption = createEngravedBand({text: label, role: 'caption'});
    top.add_child(symbol);
    top.add_child(value.actor);
    cell.add_child(top);
    cell.add_child(caption.actor);
    return {cell, value, caption, motion, lastReading: null};
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
        graph = createHistoryGraph({height: compact ? 30 : 20,
            downloadColor: options.downloadColor, uploadColor: options.uploadColor});
        root.add_child(graph.actor);
        graph.update(data.history);
    }

    // The connection state is carried by the LED colour now, so the line only
    // needs the interface name.
    const status = createStatusLine({motion: options.motion ?? null});
    root.add_child(status.actor);

    const syncCell = (cell, next) => {
        const reading = formatSpeed(next);
        if (cell.lastReading !== null && cell.lastReading !== reading && cell.motion)
            cell.motion.pulse(cell.value.actor, 1.04, 170);
        cell.lastReading = reading;
        cell.value.setText(reading);
    };

    return {
        actor: root,
        update(next) {
            syncCell(download, next.downloadMBps);
            syncCell(upload, next.uploadMBps);
            download.value.setAccessibleName(`Download: ${formatSpeed(next.downloadMBps)}`);
            upload.value.setAccessibleName(`Upload: ${formatSpeed(next.uploadMBps)}`);
            status.update(next);
            if (graph)
                graph.update(next.history);
        },
    };
}
