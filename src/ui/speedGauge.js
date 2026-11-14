import St from 'gi://St';
import {formatSpeed} from '../network/speedCalculator.js';
import {meterFillStyle, meterTrackStyle, wellStyle, MOTION} from './glassMaterial.js';
import {createEngravedBand, createEngravedText} from './engravedText.js';

export function createSpeedGauge({title, iconName, arrow, color, motion = null, compact = false,
    icons = null}) {
    const root = new St.BoxLayout({vertical: true, style_class: 'uthy-speed-gauge', x_expand: true});
    // The metric card is a well, not a tile: the glass has been pressed in, so
    // the dark press is its shadow and the lit lower lip is its border.
    root.set_style(wellStyle());
    const heading = new St.BoxLayout({style_class: 'uthy-gauge-heading', x_expand: true});
    const glyph = icons
        ? icons.createIcon({iconName, iconSize: 18, styleClass: 'uthy-gauge-icon'})
        : new St.Label({text: arrow, style_class: 'uthy-gauge-arrow'});
    if (!icons)
        glyph.set_style(`color: ${color};`);
    // The caption sits in a punched band and the reading is pressed two pixels
    // into the well, so the card reads as a stamped metal plate.
    const titleLabel = createEngravedBand({text: title, role: 'caption'});
    const valueLabel = createEngravedText({text: '-- MB/s', role: 'value'});
    heading.add_child(glyph);
    heading.add_child(titleLabel.actor);
    heading.add_child(new St.Widget({x_expand: true}));
    root.add_child(heading);
    root.add_child(valueLabel.actor);

    // The groove is recessed, the liquid is lit and springs to its new width.
    const track = new St.Widget({style_class: 'uthy-meter-track', x_expand: true, height: 8});
    track.set_style(meterTrackStyle());
    const fill = new St.Widget({style_class: 'uthy-meter-fill', height: 8});
    fill.set_style(meterFillStyle({accent: color}));
    track.add_child(fill);
    root.add_child(track);

    if (!compact) {
        const peakLabel = createEngravedText({text: 'Peak —', role: 'peak'});
        root.add_child(peakLabel.actor);
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
    gauge._uthyValueLabel.setText(reading);
    gauge._uthyValueLabel.setAccessibleName(`${gauge._uthyTitle}: ${reading}`);
    if (gauge._uthyPeakLabel)
        gauge._uthyPeakLabel.setText(`Peak ${formatSpeed(peak)}`);

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
        motion.pulse(gauge._uthyValueLabel.actor);
}
