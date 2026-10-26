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

export function formatSpeed(value, decimals = 1) {
    if (!Number.isFinite(value) || value < 0)
        return '-- MB/s';
    return `${value.toFixed(decimals)} MB/s`;
}
