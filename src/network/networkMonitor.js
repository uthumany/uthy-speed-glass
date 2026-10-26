import GLib from 'gi://GLib';
import {InterfaceManager} from './interfaceManager.js';
import {SpeedCalculator} from './speedCalculator.js';
import {SessionStatistics} from './statistics.js';
import {PingMonitor} from './pingMonitor.js';

const MAX_HISTORY_SAMPLES = 120;
const PING_INTERVAL_MS = 10_000;

export class NetworkMonitor {
    constructor(settingsManager, onUpdate) {
        this._settings = settingsManager;
        this._onUpdate = onUpdate;
        this._interfaces = new InterfaceManager();
        this._calculator = new SpeedCalculator({maxSampleGapSeconds: 30});
        this._statistics = new SessionStatistics();
        this._history = [];
        this._timerId = 0;
        this._paused = false;
        this._destroyed = false;
        this._lastPingAt = 0;
        this._state = 'INITIALIZING';
        this._downloadMBps = null;
        this._uploadMBps = null;
        this._interfaceName = null;
        this._interfacesList = [];
        this._pingMs = null;
        this._pingMessage = null;
        this._ping = new PingMonitor((latency, message) => {
            this._pingMs = latency;
            this._pingMessage = message;
            this._publish();
        });
        this._ping.setEnabled(this._settings.get('ping-enabled'));
    }

    start() {
        if (this._destroyed || this._paused || this._timerId)
            return;
        this._calculator.reset();
        this._tick();
        this._schedule();
    }

    configure() {
        if (this._destroyed)
            return;
        this._calculator.reset();
        this._ping.setEnabled(this._settings.get('ping-enabled'));
        this._pingMs = null;
        this._pingMessage = null;
        this._lastPingAt = 0;
        if (!this._paused) {
            if (this._timerId) {
                GLib.source_remove(this._timerId);
                this._timerId = 0;
            }
            this._tick();
            this._schedule();
        } else {
            this._state = 'PAUSED';
            this._publish();
        }
    }

    pause() {
        if (this._destroyed || this._paused)
            return;
        this._paused = true;
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
        this._calculator.reset();
        this._ping.stop();
        this._state = 'PAUSED';
        this._publish();
    }

    resume() {
        if (this._destroyed || !this._paused)
            return;
        this._paused = false;
        this._calculator.reset();
        this._state = 'INITIALIZING';
        this.start();
    }

    resetStatistics() {
        this._statistics.reset();
        this._history = [];
        this._publish();
    }

    get paused() {
        return this._paused;
    }

    destroy() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        if (this._timerId) {
            GLib.source_remove(this._timerId);
            this._timerId = 0;
        }
        this._ping.stop();
        this._state = 'DISABLED';
        this._history = [];
        this._onUpdate?.(this._snapshot());
        this._onUpdate = null;
    }

    _schedule() {
        if (this._destroyed || this._paused || this._timerId)
            return;
        this._timerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            this._settings.refreshInterval, () => {
                if (this._destroyed || this._paused) {
                    this._timerId = 0;
                    return GLib.SOURCE_REMOVE;
                }
                this._tick();
                return GLib.SOURCE_CONTINUE;
            });
    }

    _tick() {
        if (this._destroyed || this._paused)
            return;
        try {
            const nowMs = Date.now();
            const snapshot = this._interfaces.getSnapshot(nowMs);
            this._interfacesList = snapshot.interfaces;
            const selected = this._settings.interfaceName;
            const name = selected === 'auto' ? snapshot.activeInterface : selected;
            const counters = name ? snapshot.counters.get(name) : null;

            if (!name || !counters) {
                this._calculator.reset();
                this._interfaceName = null;
                this._downloadMBps = null;
                this._uploadMBps = null;
                this._state = 'DISCONNECTED';
            } else {
                this._interfaceName = name;
                const sample = this._calculator.sample({
                    interfaceName: name,
                    rxBytes: counters.rxBytes,
                    txBytes: counters.txBytes,
                    nowUsec: GLib.get_monotonic_time(),
                });
                this._state = sample.status;
                if (sample.valid) {
                    this._downloadMBps = sample.downloadMBps;
                    this._uploadMBps = sample.uploadMBps;
                    this._statistics.add(sample);
                } else {
                    this._downloadMBps = null;
                    this._uploadMBps = null;
                }

                this._history.push({
                    timestamp: nowMs,
                    downloadMBps: sample.valid ? sample.downloadMBps : 0,
                    uploadMBps: sample.valid ? sample.uploadMBps : 0,
                });
                if (this._history.length > MAX_HISTORY_SAMPLES)
                    this._history.splice(0, this._history.length - MAX_HISTORY_SAMPLES);
            }

            if (this._settings.get('ping-enabled') && nowMs - this._lastPingAt >= PING_INTERVAL_MS) {
                this._lastPingAt = nowMs;
                this._ping.tick(snapshot.gateway);
            }
            this._publish();
        } catch (error) {
            this._state = 'ERROR';
            this._downloadMBps = null;
            this._uploadMBps = null;
            console.error(`Uthy Speed Glass sampling error: ${error.message}`);
            this._publish();
        }
    }

    _snapshot() {
        return {
            state: this._state,
            interfaceName: this._interfaceName,
            interfaces: this._interfacesList,
            downloadMBps: this._downloadMBps,
            uploadMBps: this._uploadMBps,
            history: this._history.slice(),
            statistics: this._statistics.snapshot(),
            pingMs: this._pingMs,
            pingMessage: this._pingMessage,
            paused: this._paused,
        };
    }

    _publish() {
        this._onUpdate?.(this._snapshot());
    }
}
