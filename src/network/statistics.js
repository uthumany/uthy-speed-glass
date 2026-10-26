export class SessionStatistics {
    constructor() {
        this.reset();
    }

    reset() {
        this.samples = 0;
        this.downloadTotalBytes = 0;
        this.uploadTotalBytes = 0;
        this.downloadPeakMBps = 0;
        this.uploadPeakMBps = 0;
        this._downloadSum = 0;
        this._uploadSum = 0;
        this.startedAt = Date.now();
    }

    add(sample) {
        if (!sample?.valid || !Number.isFinite(sample.downloadMBps) ||
            !Number.isFinite(sample.uploadMBps) ||
            !Number.isFinite(sample.rxDelta) || !Number.isFinite(sample.txDelta))
            return false;

        this.samples += 1;
        this.downloadTotalBytes += sample.rxDelta;
        this.uploadTotalBytes += sample.txDelta;
        this._downloadSum += sample.downloadMBps;
        this._uploadSum += sample.uploadMBps;
        this.downloadPeakMBps = Math.max(this.downloadPeakMBps, sample.downloadMBps);
        this.uploadPeakMBps = Math.max(this.uploadPeakMBps, sample.uploadMBps);
        return true;
    }

    snapshot() {
        return {
            samples: this.samples,
            downloadTotalBytes: this.downloadTotalBytes,
            uploadTotalBytes: this.uploadTotalBytes,
            downloadPeakMBps: this.downloadPeakMBps,
            uploadPeakMBps: this.uploadPeakMBps,
            downloadAverageMBps: this.samples ? this._downloadSum / this.samples : 0,
            uploadAverageMBps: this.samples ? this._uploadSum / this.samples : 0,
            startedAt: this.startedAt,
        };
    }
}

export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0)
        return '—';
    if (bytes < 1_000)
        return `${Math.round(bytes)} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let index = -1;
    do {
        value /= 1_000;
        index += 1;
    } while (value >= 1_000 && index < units.length - 1);
    return `${value.toFixed(value < 10 ? 1 : 0)} ${units[index]}`;
}
