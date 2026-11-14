// The live traffic chart.
//
// The plot sits in a recessed window cut into a brushed-metal frame, under a
// layer of glass: metalPlate.js paints the frame, its two-pixel bevel and the
// cavity, a separate overlay paints the reflection across the top half, and the
// traces are drawn between the two, so the line is behind glass rather than on
// top of it.
//
// Each wave is a glossy tube rather than a hairline: a translucent gradient
// fill below it, a soft glow, a dark underside, the body of the tube, and a
// specular line along its top. A faint grid gives the plot a surface, the
// highest download sample is marked with a halo, and the newest sample carries
// a live head on the right edge so the chart reads as moving even when the two
// traces are close together.
//
// Everything is painted in one repaint per sample, so the chart costs one
// queue_repaint per second at the default refresh interval.

import cairo from 'gi://cairo';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {ACCENT, rgba as cssRgba, darken, hexToRgb, lighten} from './glassMaterial.js';
import {createGlassOverlay, createPaintedArea, paintGlassWindow} from './metalPlate.js';

/** Below this height the grid and the peak marker would only add noise. */
const DETAIL_MIN_HEIGHT = 30;

function channels(hex, alpha) {
    const colour = hexToRgb(hex);
    return [colour.red / 255, colour.green / 255, colour.blue / 255, alpha];
}

function paintGrid(cr, width, height) {
    cr.setLineWidth(1);
    for (const fraction of [0.25, 0.5, 0.75]) {
        const y = Math.round(height * fraction) + 0.5;
        cr.setSourceRGBA(1, 1, 1, 0.028);
        cr.newPath();
        cr.moveTo(0, y);
        cr.lineTo(width, y);
        cr.stroke();
    }
}

/** One stroke of a wave, with an optional vertical offset for the tube edges. */
function strokeWave(cr, points, {width, colour, alpha, offsetY = 0}) {
    cr.newPath();
    cr.setLineWidth(width);
    for (const [index, [x, y]] of points.entries()) {
        if (index === 0)
            cr.moveTo(x, y + offsetY);
        else
            cr.lineTo(x, y + offsetY);
    }
    cr.setSourceRGBA(...channels(colour, alpha));
    cr.stroke();
}

export function createHistoryGraph({height = 46, downloadColor = ACCENT, uploadColor = '#6E96BC'} = {}) {
    // A short window - the mini layout gives it 22 pixels - cannot afford the
    // full frame, so the inset, the bevel and the plot padding all shrink with
    // it, or the frame would leave no plot at all.
    const tight = height < 32;
    const windowOptions = tight ? {inset: 2, bevel: 1, depth: 3, glint: 0.45} : {};
    const holder = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
        style_class: 'uthy-graph-window',
        x_expand: true,
        height,
    });
    const frame = createPaintedArea({
        styleClass: 'uthy-graph-frame',
        paint: (cr, width, height) => paintGlassWindow(cr, width, height, windowOptions),
    });
    // The plot is inset by a padded row, because a BinLayout neither applies
    // padding nor positions a child that does not expand.
    const plotRow = new St.BoxLayout({
        style_class: tight ? 'uthy-graph-plot uthy-graph-plot-tight' : 'uthy-graph-plot',
        x_expand: true,
    });
    const area = new St.DrawingArea({
        style_class: 'uthy-history-graph',
        x_expand: true,
        y_expand: true,
        can_focus: false,
        reactive: false,
    });
    plotRow.add_child(area);
    const glass = createGlassOverlay({styleClass: 'uthy-graph-glass', inset: tight ? 2 : 3});

    holder.add_child(frame);
    holder.add_child(plotRow);
    holder.add_child(glass);

    let samples = [];

    area.connect('repaint', widget => {
        const cr = widget.get_context();
        if (!cr)
            return;
        const width = widget.get_width();
        const graphHeight = widget.get_height();
        if (width <= 1 || graphHeight <= 1) {
            cr.$dispose?.();
            return;
        }

        try {
            cr.setOperator(0); // CLEAR
            cr.paint();
            cr.setOperator(2); // OVER
            cr.setLineCap(1); // ROUND
            cr.setLineJoin(1);

            if (graphHeight >= DETAIL_MIN_HEIGHT)
                paintGrid(cr, width, graphHeight);

            if (!samples.length) {
                // Nothing measured yet: the grid alone holds the space, which
                // reads as an empty instrument rather than a broken line.
                return;
            }

            // A 0.1 MB/s floor flattened every trace on a slow or idle link,
            // which reads as "no traffic"; 0.01 MB/s still keeps noise small.
            const maxValue = Math.max(0.01, ...samples.flatMap(item => [
                item.downloadMBps ?? 0, item.uploadMBps ?? 0,
            ]));
            const baseline = graphHeight - 2;
            const usable = Math.max(1, graphHeight - 6);
            const stepX = samples.length === 1 ? 0 : width / (samples.length - 1);
            const pointFor = (sample, key, index) => {
                const value = Math.max(0, sample[key] ?? 0);
                return [index * stepX, baseline - (value / maxValue) * usable];
            };

            const traces = [
                {key: 'downloadMBps', colour: downloadColor, fill: 0.32},
                {key: 'uploadMBps', colour: uploadColor, fill: 0.24},
            ];

            for (const trace of traces) {
                const points = samples.map((sample, index) => pointFor(sample, trace.key, index));

                // Gradient fill: opaque where it meets the tube, gone by the
                // baseline, so the two waves overlap without muddying.
                const top = Math.min(...points.map(point => point[1]));
                const gradient = new cairo.LinearGradient(0, top, 0, baseline);
                gradient.addColorStopRGBA(0, ...channels(trace.colour, trace.fill));
                gradient.addColorStopRGBA(0.55, ...channels(trace.colour, trace.fill * 0.34));
                gradient.addColorStopRGBA(1, ...channels(trace.colour, 0.02));
                cr.newPath();
                cr.moveTo(points[0][0], baseline);
                for (const [x, y] of points)
                    cr.lineTo(x, y);
                cr.lineTo(points[points.length - 1][0], baseline);
                cr.closePath();
                cr.setSource(gradient);
                cr.fill();

                // The tube, in four passes: the glow it throws, its dark
                // underside, its body, and the specular along its top.
                strokeWave(cr, points, {width: 5, colour: trace.colour, alpha: 0.14});
                strokeWave(cr, points, {width: 3, colour: darken(hexToRgb(trace.colour), 0.55),
                    alpha: 0.9, offsetY: 1.1});
                strokeWave(cr, points, {width: 3, colour: trace.colour, alpha: 1});
                strokeWave(cr, points, {width: 1, colour: lighten(hexToRgb(trace.colour), 0.78),
                    alpha: 0.6, offsetY: -1.1});
            }

            const downloadPoints = samples.map((sample, index) => pointFor(sample, 'downloadMBps', index));

            // The peak: the tallest download sample, marked with a halo and a
            // leader line so a burst is visible at a glance.
            if (graphHeight >= DETAIL_MIN_HEIGHT && downloadPoints.length > 2) {
                let peakIndex = 0;
                for (const [index, point] of downloadPoints.entries()) {
                    if (point[1] < downloadPoints[peakIndex][1])
                        peakIndex = index;
                }
                const [peakX, peakY] = downloadPoints[peakIndex];
                const halo = new cairo.RadialGradient(peakX, peakY, 0, peakX, peakY, 7);
                halo.addColorStopRGBA(0, ...channels(downloadColor, 0.42));
                halo.addColorStopRGBA(1, ...channels(downloadColor, 0));
                cr.setSource(halo);
                cr.rectangle(peakX - 7, peakY - 7, 14, 14);
                cr.fill();

                cr.setLineWidth(1);
                cr.setSourceRGBA(...channels(downloadColor, 0.18));
                cr.newPath();
                cr.moveTo(peakX, peakY);
                cr.lineTo(peakX, baseline);
                cr.stroke();

                cr.setSourceRGBA(...channels(lighten(hexToRgb(downloadColor), 0.55), 1));
                cr.newPath();
                cr.arc(peakX, peakY, 2.2, 0, Math.PI * 2);
                cr.fill();
            }

            // The live head: the newest sample, so the chart always shows
            // where "now" is.
            const [headX, headY] = downloadPoints[downloadPoints.length - 1];
            const headGlow = new cairo.RadialGradient(headX, headY, 0, headX, headY, 6);
            headGlow.addColorStopRGBA(0, ...channels(downloadColor, 0.55));
            headGlow.addColorStopRGBA(1, ...channels(downloadColor, 0));
            cr.setSource(headGlow);
            cr.rectangle(headX - 6, headY - 6, 12, 12);
            cr.fill();
            cr.setSourceRGBA(1, 1, 1, 0.85);
            cr.newPath();
            cr.arc(headX, headY, 1.6, 0, Math.PI * 2);
            cr.fill();
        } finally {
            cr.$dispose?.();
        }
    });

    return {
        actor: holder,
        /** Exposed so the stylesheet check can assert the accent in tests. */
        accentCss: cssRgba(hexToRgb(ACCENT), 1),
        update(history) {
            samples = Array.isArray(history) ? history.slice(-120) : [];
            area.queue_repaint();
        },
    };
}
