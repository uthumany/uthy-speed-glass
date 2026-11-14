import Clutter from 'gi://Clutter';
import St from 'gi://St';
import {formatSpeed} from '../network/speedCalculator.js';
import {formatBytes} from '../network/statistics.js';
import {createHistoryGraph} from './historyGraph.js';
import {createStatusLine} from './ledIndicator.js';
import {createSpeedGauge, updateSpeedGauge} from './speedGauge.js';
import {createEngravedBand, createEngravedText} from './engravedText.js';
import {createSlotPlate} from './metalPlate.js';

/**
 * A statistic in its own small machined slot: the same frame, bevel and cavity
 * as the metric panels, scaled down, with a letterpressed label and a debossed
 * value inside it.
 */
function createStat(title, initial) {
    const item = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        style_class: 'uthy-stat-item',
        x_expand: true,
    });
    item.add_child(createSlotPlate({
        styleClass: 'uthy-stat-slot',
        options: {inset: 2, bevel: 1, depth: 3, glint: 0.45},
    }));
    const content = new St.BoxLayout({vertical: true, style_class: 'uthy-stat-content', x_expand: true});
    content.add_child(createEngravedBand({text: title, role: 'stat-title'}).actor);
    const value = createEngravedText({text: initial, role: 'stat-value', xExpand: true});
    content.add_child(value.actor);
    item.add_child(content);
    return {actor: item, value};
}

export function createExpandedWidget(data, options) {
    const root = new St.BoxLayout({vertical: true, style_class: 'uthy-expanded-content'});
    const gauges = new St.BoxLayout({style_class: 'uthy-gauges-row', x_expand: true});
    const downloadGauge = createSpeedGauge({title: 'DOWNLOAD', iconName: 'download', arrow: '↓',
        color: options.downloadColor, motion: options.motion, icons: options.icons ?? null});
    const uploadGauge = createSpeedGauge({title: 'UPLOAD', iconName: 'upload', arrow: '↑',
        color: options.uploadColor, motion: options.motion, icons: options.icons ?? null});
    gauges.add_child(downloadGauge);
    gauges.add_child(uploadGauge);
    root.add_child(gauges);

    let graph = null;
    if (options.showGraphs) {
        graph = createHistoryGraph({height: options.graphHeight,
            downloadColor: options.downloadColor, uploadColor: options.uploadColor});
        root.add_child(graph.actor);
    }

    const statsRow = new St.BoxLayout({style_class: 'uthy-statistics-row', x_expand: true});
    const rx = createStat('SESSION RX', '—');
    const tx = createStat('SESSION TX', '—');
    const downAverage = createStat('AVG ↓', '—');
    const upAverage = createStat('AVG ↑', '—');
    for (const stat of [rx, tx, downAverage, upAverage])
        statsRow.add_child(stat.actor);
    root.add_child(statsRow);

    const statusLine = createStatusLine({
        motion: options.motion ?? null,
        styleClass: 'uthy-expanded-status',
        ping: Boolean(options.pingEnabled),
    });
    root.add_child(statusLine.actor);
    root._uthyGauges = [downloadGauge, uploadGauge];
    root._uthyStats = {rx, tx, downAverage, upAverage};
    root._uthyGraph = graph;
    root._uthyStatus = statusLine.actor;

    return {
        actor: root,
        update(next) {
            const stats = next.statistics ?? {};
            // The meter follows the last 30 samples (about 30 s at the default
            // interval) so a burst does not pin the scale for the rest of the
            // session; the session peak is still what the Peak label reports.
            const recent = Array.isArray(next.history) ? next.history.slice(-30) : [];
            const recentDownload = recent.reduce((max, item) => Math.max(max, item.downloadMBps ?? 0), 0);
            const recentUpload = recent.reduce((max, item) => Math.max(max, item.uploadMBps ?? 0), 0);
            updateSpeedGauge(downloadGauge, next.downloadMBps, stats.downloadPeakMBps,
                options.motion, recentDownload);
            updateSpeedGauge(uploadGauge, next.uploadMBps, stats.uploadPeakMBps,
                options.motion, recentUpload);
            rx.value.setText(formatBytes(stats.downloadTotalBytes));
            tx.value.setText(formatBytes(stats.uploadTotalBytes));
            downAverage.value.setText(formatSpeed(stats.downloadAverageMBps));
            upAverage.value.setText(formatSpeed(stats.uploadAverageMBps));
            if (graph)
                graph.update(next.history);
            statusLine.update(next);
        },
    };
}
