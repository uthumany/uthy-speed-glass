import Clutter from 'gi://Clutter';
import St from 'gi://St';
import {formatSpeed} from '../network/speedCalculator.js';

export function createSpeedGauge({title, arrow, color, reducedMotion = false, compact = false}) {
    const root = new St.BoxLayout({vertical: true, style_class: 'uthy-speed-gauge', x_expand: true});
    const heading = new St.BoxLayout({style_class: 'uthy-gauge-heading', x_expand: true});
    const glyph = new St.Label({text: arrow, style_class: 'uthy-gauge-arrow'});
    glyph.set_style(`color: ${color};`);
    const titleLabel = new St.Label({text: title, style_class: 'uthy-gauge-title', x_expand: true});
    const valueLabel = new St.Label({text: '-- MB/s', style_class: 'uthy-gauge-value'});
    heading.add_child(glyph);
    heading.add_child(titleLabel);
    root.add_child(heading);
    root.add_child(valueLabel);

    const track = new St.Widget({style_class: 'uthy-meter-track', x_expand: true, height: 8});
    const fill = new St.Widget({style_class: 'uthy-meter-fill', height: 8});
    fill.set_style(`background-color: ${color};`);
    track.add_child(fill);
    root.add_child(track);

    if (!compact) {
        const peakLabel = new St.Label({text: 'Peak —', style_class: 'uthy-gauge-peak'});
        root.add_child(peakLabel);
        root._uthyPeakLabel = peakLabel;
    }
    root._uthyValueLabel = valueLabel;
    root._uthyFill = fill;
    root._uthyColor = color;
    root._uthyReducedMotion = reducedMotion;
    root._uthyTitle = title;
    return root;
}

export function updateSpeedGauge(gauge, speed, peak, reducedMotion = gauge._uthyReducedMotion) {
    gauge._uthyValueLabel.text = formatSpeed(speed);
    gauge._uthyValueLabel.accessible_name = `${gauge._uthyTitle}: ${formatSpeed(speed)}`;
    if (gauge._uthyPeakLabel)
        gauge._uthyPeakLabel.text = `Peak ${formatSpeed(peak)}`;

    const finiteSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    const finitePeak = Number.isFinite(peak) ? Math.max(0, peak) : 0;
    const width = Math.max(8, Math.round(180 * Math.min(1, finiteSpeed / Math.max(2, finitePeak * 1.15, 10))));
    gauge._uthyFill.ease({
        width,
        duration: reducedMotion ? 0 : 220,
        mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
    });
}
