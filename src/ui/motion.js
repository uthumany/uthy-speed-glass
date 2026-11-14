// Motion helper for the UthyPing widget.
//
// The spring vocabulary is the liquid part of the reference material model:
// press compresses the surface, release overshoots back to rest, hover lifts
// it, and idle breathing keeps the brand mark alive. Every animation touches
// only transform and opacity, so nothing triggers a layout pass, and every
// transition is owned by this class so it can be removed on teardown.
//
// When the user enables Reduce motion, all durations collapse to zero and
// idle loops are stopped, matching the documented accessibility behaviour.

import Clutter from 'gi://Clutter';
import {MOTION} from './glassMaterial.js';

const PRESS_SCALE = 0.94;
const LIFT_SCALE = 1.06;

export class Motion {
    constructor(reducedMotion = false) {
        this._reducedMotion = Boolean(reducedMotion);
        this._idleActors = new Set();
        this._destroyed = false;
    }

    get reducedMotion() {
        return this._reducedMotion;
    }

    setReducedMotion(value) {
        const next = Boolean(value);
        if (next === this._reducedMotion)
            return;
        this._reducedMotion = next;
        if (next) {
            for (const actor of [...this._idleActors])
                this.stopIdle(actor);
        }
    }

    /** Pointer entered a control: lift it towards the light. */
    lift(actor, scale = LIFT_SCALE) {
        this._scale(actor, scale, MOTION.hover, Clutter.AnimationMode.EASE_OUT_CUBIC);
    }

    /** Pointer left a control: settle back to rest. */
    rest(actor) {
        this._scale(actor, 1, MOTION.hover, Clutter.AnimationMode.EASE_OUT_CUBIC);
    }

    /** Button pressed: squash the surface. */
    press(actor) {
        this._scale(actor, PRESS_SCALE, MOTION.press, Clutter.AnimationMode.EASE_OUT_CUBIC);
    }

    /** Button released: stretch back with a spring overshoot. */
    release(actor) {
        this._scale(actor, 1, MOTION.release, Clutter.AnimationMode.EASE_OUT_BACK);
    }

    /**
     * A single tick that draws the eye to a fresh reading. The overshoot is
     * applied instantly and eased back, so a new sample costs one short
     * transform animation and nothing else.
     */
    pulse(actor, scale = 1.03, duration = 180) {
        if (this._destroyed || !actor || this._reducedMotion)
            return;
        actor.set_scale(scale, scale);
        actor.ease({
            scale_x: 1,
            scale_y: 1,
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_BACK,
        });
    }

    /**
     * Idle breathing for the brand mark. Implemented with looping property
     * transitions rather than a JS timer, so the loop costs nothing while the
     * shell is idle and can be stopped instantly.
     */
    breathe(actor, {minOpacity = 214, maxOpacity = 255, maxScale = 1.04} = {}) {
        if (this._destroyed || !actor || this._reducedMotion)
            return;
        this.stopIdle(actor);

        const transitions = [
            ['uthy-idle-opacity', 'opacity', minOpacity, maxOpacity],
            ['uthy-idle-scale-x', 'scale-x', 1, maxScale],
            ['uthy-idle-scale-y', 'scale-y', 1, maxScale],
        ];
        for (const [name, propertyName, from, to] of transitions) {
            const transition = new Clutter.PropertyTransition({
                property_name: propertyName,
                duration: MOTION.breathe,
                repeat_count: -1,
                auto_reverse: true,
                progress_mode: Clutter.AnimationMode.EASE_IN_OUT_CUBIC,
            });
            transition.set_from(from);
            transition.set_to(to);
            actor.add_transition(name, transition);
        }
        this._idleActors.add(actor);
    }

    stopIdle(actor) {
        if (!actor)
            return;
        this._idleActors.delete(actor);
        for (const name of ['uthy-idle-opacity', 'uthy-idle-scale-x', 'uthy-idle-scale-y']) {
            try {
                actor.remove_transition(name);
            } catch (_error) {
                // The actor may already be destroyed during teardown.
            }
        }
    }

    /**
     * Spring a meter fill to a new width. Only the fill actor is resized, so
     * the surrounding layout is untouched.
     */
    animateWidth(actor, width, duration = MOTION.meter, mode = Clutter.AnimationMode.EASE_OUT_CUBIC) {
        if (this._destroyed || !actor)
            return;
        if (this._reducedMotion) {
            actor.remove_all_transitions();
            actor.set_width(width);
            return;
        }
        actor.ease({width, duration, mode});
    }

    destroy() {
        if (this._destroyed)
            return;
        for (const actor of [...this._idleActors])
            this.stopIdle(actor);
        this._destroyed = true;
    }

    _scale(actor, scale, duration, mode) {
        if (this._destroyed || !actor)
            return;
        if (this._reducedMotion) {
            actor.set_scale(1, 1);
            return;
        }
        actor.ease({
            scale_x: scale,
            scale_y: scale,
            duration,
            mode,
        });
    }
}
