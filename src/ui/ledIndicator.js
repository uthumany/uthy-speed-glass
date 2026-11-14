// The connection LED: a small dome of glass over a lit core.
//
// The status line used to spell the connection state out in words. The design
// replaces that with a single 3D dot beside the interface name: a coloured
// core, a bevelled rim, an inner shadow along its lower edge and a specular
// highlight in the upper left, all drawn on one DrawingArea. The state colour
// carries the meaning - emerald when traffic is being counted, amber while
// initialising or paused, red when the interface is down or unreadable, grey
// when monitoring is off - and the accessible name carries it for anyone who
// cannot see the colour.

import cairo from 'gi://cairo';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {darken, ledColor, lighten, rgba} from './glassMaterial.js';

export const LED_STATES = {
    CONNECTED: 'Connected',
    INITIALIZING: 'Waiting for the first sample',
    PAUSED: 'Monitoring paused',
    DISCONNECTED: 'No active network interface',
    ERROR: 'Counter read failed',
    DISABLED: 'Monitoring stopped',
};

export function createLedIndicator({size = 13, motion = null} = {}) {
    const area = new St.DrawingArea({
        style_class: 'uthy-led',
        width: size,
        height: size,
        can_focus: false,
        reactive: false,
        y_align: Clutter.ActorAlign.CENTER,
    });
    let state = 'INITIALIZING';

    area.connect('repaint', widget => {
        const cr = widget.get_context();
        if (!cr)
            return;
        const width = widget.get_width();
        const height = widget.get_height();
        if (width <= 2 || height <= 2) {
            cr.$dispose?.();
            return;
        }
        try {
            cr.setOperator(0); // CLEAR
            cr.paint();
            cr.setOperator(2); // OVER

            const colour = ledColor(state);
            const centreX = width / 2;
            const centreY = height / 2;
            const bodyRadius = Math.max(2, width / 2 - 2.5);

            // Outer bloom: the light escaping the dome.
            const bloom = new cairo.RadialGradient(centreX, centreY, bodyRadius * 0.4,
                centreX, centreY, width / 2);
            bloom.addColorStopRGBA(0, colour.red / 255, colour.green / 255, colour.blue / 255, 0.42);
            bloom.addColorStopRGBA(1, colour.red / 255, colour.green / 255, colour.blue / 255, 0);
            cr.setSource(bloom);
            cr.rectangle(0, 0, width, height);
            cr.fill();

            // The dome: lit from the upper left, dark at the lower right.
            const dome = new cairo.RadialGradient(centreX - bodyRadius * 0.35,
                centreY - bodyRadius * 0.4, bodyRadius * 0.15,
                centreX, centreY, bodyRadius * 1.15);
            const lit = lighten(colour, 0.62);
            const deep = darken(colour, 0.46);
            dome.addColorStopRGBA(0, lit.red / 255, lit.green / 255, lit.blue / 255, 1);
            dome.addColorStopRGBA(0.55, colour.red / 255, colour.green / 255, colour.blue / 255, 1);
            dome.addColorStopRGBA(1, deep.red / 255, deep.green / 255, deep.blue / 255, 1);
            cr.setSource(dome);
            cr.newPath();
            cr.arc(centreX, centreY, bodyRadius, 0, Math.PI * 2);
            cr.fill();

            // Inner shadow along the lower edge, so the dome reads as solid.
            cr.setLineWidth(1.6);
            cr.setSourceRGBA(0, 0, 0, 0.34);
            cr.newPath();
            cr.arc(centreX, centreY, bodyRadius - 0.8, Math.PI * 0.12, Math.PI * 0.88);
            cr.stroke();

            // Specular highlight in the upper left.
            cr.setSourceRGBA(1, 1, 1, 0.72);
            cr.newPath();
            cr.save();
            cr.translate(centreX - bodyRadius * 0.34, centreY - bodyRadius * 0.40);
            cr.scale(1, 0.72);
            cr.arc(0, 0, Math.max(0.9, bodyRadius * 0.26), 0, Math.PI * 2);
            cr.restore();
            cr.fill();

            // A dark contact ring separates the dome from the glass behind it.
            cr.setLineWidth(1);
            cr.setSourceRGBA(0, 0, 0, 0.55);
            cr.newPath();
            cr.arc(centreX, centreY, bodyRadius + 0.4, 0, Math.PI * 2);
            cr.stroke();
        } finally {
            cr.$dispose?.();
        }
    });

    return {
        actor: area,
        /** Set the connection state; the accessible name follows it. */
        setState(next) {
            const value = LED_STATES[next] ? next : 'INITIALIZING';
            if (value === state)
                return;
            state = value;
            area.accessible_name = `Connection status: ${LED_STATES[value]}`;
            area.queue_repaint();
            motion?.pulse(area, 1.18, 200);
        },
    };
}

/** Exported for tests: the colour a state resolves to, as a CSS string. */
export function ledColorCss(state) {
    return rgba(ledColor(state), 1);
}

/** The short label shown beside the LED when no interface is being counted. */
function fallbackLabel(state) {
    switch (state) {
        case 'CONNECTED': return 'no interface';
        case 'PAUSED': return 'paused';
        case 'ERROR': return 'read failed';
        case 'DISABLED': return 'stopped';
        default: return 'initialising';
    }
}

/**
 * The connection line: one glowing LED and the interface name.
 *
 * The state is no longer spelled out - the LED colour carries it and the
 * accessible name repeats it in words for anyone who cannot see the colour.
 */
export function createStatusLine({motion = null, styleClass = 'uthy-status-line', ping = false} = {}) {
    const row = new St.BoxLayout({style_class: styleClass, x_expand: true});
    const led = createLedIndicator({motion});
    const label = new St.Label({text: 'initialising', style_class: 'uthy-status-text', x_expand: true});
    label.clutter_text.ellipsize = 3;
    row.add_child(led.actor);
    row.add_child(label);

    return {
        actor: row,
        update(data) {
            const state = LED_STATES[data.state] ? data.state : 'INITIALIZING';
            led.setState(state);
            let text = data.interfaceName ?? fallbackLabel(state);
            if (ping && Number.isFinite(data.pingMs))
                text += ` · ping ${data.pingMs.toFixed(0)} ms`;
            else if (ping && data.pingMessage)
                text += ` · ${data.pingMessage}`;
            label.text = text;
            const description = `${LED_STATES[state]}${data.interfaceName ? ` on ${data.interfaceName}` : ''}`;
            row.accessible_name = description;
            label.accessible_name = description;
        },
    };
}
