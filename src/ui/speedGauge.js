import St from 'gi://St';
import {formatSpeed} from '../network/speedCalculator.js';
import {meterFillStyle, meterTrackStyle, MOTION} from './glassMaterial.js';

export function createSpeedGauge({title, arrow, color, motion = null, compact = false}) {
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

    // The groove is recessed, the liquid is lit and springs to its new width.
    const track = new St.Widget({style_class: 'uthy-meter-track', x_expand: true, height: 8});
    track.set_style(meterTrackStyle());
    const fill = new St.Widget({style_class: 'uthy-meter-fill', height: 8});
    fill.set_style(meterFillStyle({accent: color}));
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
    root._uthyMotion = motion;
    root._uthyTitle = title;
    root._uthyLastReading = null;
    return root;
}

export function updateSpeedGauge(gauge, speed, peak, motion = gauge._uthyMotion) {
    const reading = formatSpeed(speed);
    const changed = gauge._uthyLastReading !== null && gauge._uthyLastReading !== reading;
    gauge._uthyLastReading = reading;
    gauge._uthyValueLabel.text = reading;
    gauge._uthyValueLabel.accessible_name = `${gauge._uthyTitle}: ${reading}`;
    if (gauge._uthyPeakLabel)
        gauge._uthyPeakLabel.text = `Peak ${formatSpeed(peak)}`;

    const finiteSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    const finitePeak = Number.isFinite(peak) ? Math.max(0, peak) : 0;
    const width = Math.max(8, Math.round(180 * Math.min(1, finiteSpeed / Math.max(2, finitePeak * 1.15, 10))));
    if (motion)
        motion.animateWidth(gauge._uthyFill, width, MOTION.meter);
    else
        gauge._uthyFill.set_width(width);

    if (changed && motion)
        motion.pulse(gauge._uthyValueLabel);
}
