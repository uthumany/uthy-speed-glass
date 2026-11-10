import {INTERFACE_NAME_PATTERN} from './trafficReader.js';

export const BYTES_PER_DECIMAL_MEGABYTE = 1_000_000;

export class SpeedCalculator {
    constructor({maxSampleGapSeconds = 30} = {}) {
        this.maxSampleGapSeconds = maxSampleGapSeconds;
        this.reset();
    }

    reset() {
        this._baseline = null;
    }

    sample({interfaceName, rxBytes, txBytes, nowUsec}) {
        const validCounters = INTERFACE_NAME_PATTERN.test(interfaceName ?? '') &&
            Number.isSafeInteger(rxBytes) && rxBytes >= 0 &&
            Number.isSafeInteger(txBytes) && txBytes >= 0 &&
            Number.isFinite(nowUsec) && nowUsec >= 0;
        if (!validCounters) {
            this.reset();
            return {valid: false, status: 'DISCONNECTED', interfaceName: null,
                downloadMBps: null, uploadMBps: null};
        }

        const current = {interfaceName, rxBytes, txBytes, nowUsec};
        const previous = this._baseline;
        this._baseline = current;
        if (!previous || previous.interfaceName !== interfaceName)
            return this._baselineResult(interfaceName, 'INITIALIZING');

        const elapsedSeconds = (nowUsec - previous.nowUsec) / 1_000_000;
        const rxDelta = rxBytes - previous.rxBytes;
        const txDelta = txBytes - previous.txBytes;
        if (!(elapsedSeconds > 0) || elapsedSeconds > this.maxSampleGapSeconds ||
            rxDelta < 0 || txDelta < 0) {
            return this._baselineResult(interfaceName, 'INITIALIZING');
        }

        return {
            valid: true,
            status: 'CONNECTED',
            interfaceName,
            elapsedSeconds,
            rxDelta,
            txDelta,
            downloadMBps: rxDelta / elapsedSeconds / BYTES_PER_DECIMAL_MEGABYTE,
            uploadMBps: txDelta / elapsedSeconds / BYTES_PER_DECIMAL_MEGABYTE,
        };
    }

    _baselineResult(interfaceName, status) {
        return {valid: false, status, interfaceName,
            downloadMBps: null, uploadMBps: null};
    }
}

const SPEED_UNITS = [
    {limit: 1_000, divisor: 1, suffix: 'B/s', small: 0, large: 0},
    {limit: 1_000_000, divisor: 1_000, suffix: 'KB/s', small: 1, large: 0},
    {limit: 1_000_000_000, divisor: 1_000_000, suffix: 'MB/s', small: 1, large: 0},
    {limit: Number.POSITIVE_INFINITY, divisor: 1_000_000_000, suffix: 'GB/s', small: 2, large: 2},
];

/**
 * Format a rate for display, choosing the unit from the value.
 *
 * Every rate used to be printed as MB/s with one decimal, so anything below
 * 0.05 MB/s — 50 KB/s, which covers most ordinary browsing — read as
 * `0.0 MB/s` and looked like the monitor was not measuring at all. Rates stay
 * decimal (1 KB/s is 1000 B/s); they are never binary and never bits.
 */
export function formatSpeed(value) {
    if (!Number.isFinite(value) || value < 0)
        return '-- MB/s';
    const bytesPerSecond = value * BYTES_PER_DECIMAL_MEGABYTE;
    const unit = SPEED_UNITS.find(candidate => bytesPerSecond < candidate.limit)
        ?? SPEED_UNITS[SPEED_UNITS.length - 1];
    const scaled = bytesPerSecond / unit.divisor;
    return `${scaled.toFixed(scaled < 100 ? unit.small : unit.large)} ${unit.suffix}`;
}
