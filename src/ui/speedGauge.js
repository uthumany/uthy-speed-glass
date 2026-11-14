import St from 'gi://St';
import {formatSpeed} from '../network/speedCalculator.js';
import {meterFillStyle, meterTrackStyle, MOTION} from './glassMaterial.js';

export function createSpeedGauge({title, iconName, arrow, color, motion = null, compact = false,
    icons = null}) {
    const root = new St.BoxLayout({vertical: true, style_class: 'uthy-speed-gauge', x_expand: true});
    const heading = new St.BoxLayout({style_class: 'uthy-gauge-heading', x_expand: true});
    const glyph = icons
        ? icons.createIcon({iconName, iconSize: 18, styleClass: 'uthy-gauge-icon'})
        : new St.Label({text: arrow, style_class: 'uthy-gauge-arrow'});
    if (!icons)
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

export function updateSpeedGauge(gauge, speed, peak, motion = gauge._uthyMotion, scale = null) {
    const reading = formatSpeed(speed);
    const changed = gauge._uthyLastReading !== null && gauge._uthyLastReading !== reading;
    gauge._uthyLastReading = reading;
    gauge._uthyValueLabel.text = reading;
    gauge._uthyValueLabel.accessible_name = `${gauge._uthyTitle}: ${reading}`;
    if (gauge._uthyPeakLabel)
        gauge._uthyPeakLabel.text = `Peak ${formatSpeed(peak)}`;

    const finiteSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    // Scale the meter to recent activity. The span used to be at least
    // 10 MB/s, so on any slower link the bar sat near the start of its travel
    // and a working monitor looked idle.
    const finiteScale = Number.isFinite(scale) ? Math.max(0, scale) : 0;
    const span = Math.max(0.1, finiteScale, finiteSpeed) * 1.15;
    const width = Math.max(8, Math.round(180 * Math.min(1, finiteSpeed / span)));
    if (motion)
        motion.animateWidth(gauge._uthyFill, width, MOTION.meter);
    else
        gauge._uthyFill.set_width(width);

    if (changed && motion)
        motion.pulse(gauge._uthyValueLabel);
}
