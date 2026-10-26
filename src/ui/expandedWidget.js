import St from 'gi://St';
import {formatSpeed} from '../network/speedCalculator.js';
import {formatBytes} from '../network/statistics.js';
import {createHistoryGraph} from './historyGraph.js';
import {createSpeedGauge, updateSpeedGauge} from './speedGauge.js';

function valueOrDash(value, suffix = '') {
    return Number.isFinite(value) ? `${value.toFixed(1)}${suffix}` : '—';
}

function createStat(title, initial) {
    const item = new St.BoxLayout({vertical: true, style_class: 'uthy-stat-item', x_expand: true});
    item.add_child(new St.Label({text: title, style_class: 'uthy-stat-title'}));
    const value = new St.Label({text: initial, style_class: 'uthy-stat-value'});
    item.add_child(value);
    return {actor: item, value};
}

export function createExpandedWidget(data, options) {
    const root = new St.BoxLayout({vertical: true, style_class: 'uthy-expanded-content'});
    const gauges = new St.BoxLayout({style_class: 'uthy-gauges-row', x_expand: true});
    const downloadGauge = createSpeedGauge({title: 'DOWNLOAD', arrow: '↓', color: options.downloadColor,
        reducedMotion: options.reduceMotion});
    const uploadGauge = createSpeedGauge({title: 'UPLOAD', arrow: '↑', color: options.uploadColor,
        reducedMotion: options.reduceMotion});
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

    const status = new St.Label({text: '', style_class: 'uthy-expanded-status', x_expand: true});
    root.add_child(status);
    root._uthyGauges = [downloadGauge, uploadGauge];
    root._uthyStats = {rx, tx, downAverage, upAverage};
    root._uthyGraph = graph;
    root._uthyStatus = status;

    return {
        actor: root,
        update(next) {
            const stats = next.statistics ?? {};
            updateSpeedGauge(downloadGauge, next.downloadMBps, stats.downloadPeakMBps, options.reduceMotion);
            updateSpeedGauge(uploadGauge, next.uploadMBps, stats.uploadPeakMBps, options.reduceMotion);
            rx.value.text = formatBytes(stats.downloadTotalBytes);
            tx.value.text = formatBytes(stats.uploadTotalBytes);
            downAverage.value.text = formatSpeed(stats.downloadAverageMBps);
            upAverage.value.text = formatSpeed(stats.uploadAverageMBps);
            if (graph)
                graph.update(next.history);

            const stateLabels = {
                INITIALIZING: 'Waiting for a second counter sample',
                CONNECTED: 'Connected',
                DISCONNECTED: 'No active network interface',
                PAUSED: 'Monitoring paused',
                ERROR: 'Counter read failed; monitoring will retry',
                DISABLED: 'Monitoring stopped',
            };
            let text = stateLabels[next.state] ?? 'Initializing';
            if (next.interfaceName)
                text += ` · ${next.interfaceName}`;
            if (next.pingMs !== null && Number.isFinite(next.pingMs))
                text += ` · Ping ${valueOrDash(next.pingMs, ' ms')}`;
            else if (options.pingEnabled && next.pingMessage)
                text += ` · ${next.pingMessage}`;
            status.text = text;
        },
    };
}
