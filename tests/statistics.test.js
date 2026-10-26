import test from 'node:test';
import assert from 'node:assert/strict';
import {SessionStatistics, formatBytes} from '../src/network/statistics.js';

test('session statistics track totals, averages, and peaks', () => {
    const stats = new SessionStatistics();
    stats.add({valid: true, rxDelta: 1_000_000, txDelta: 500_000, downloadMBps: 1, uploadMBps: 0.5});
    stats.add({valid: true, rxDelta: 3_000_000, txDelta: 1_500_000, downloadMBps: 3, uploadMBps: 1.5});
    assert.deepEqual(stats.snapshot(), {
        samples: 2,
        downloadTotalBytes: 4_000_000,
        uploadTotalBytes: 2_000_000,
        downloadPeakMBps: 3,
        uploadPeakMBps: 1.5,
        downloadAverageMBps: 2,
        uploadAverageMBps: 1,
        startedAt: stats.startedAt,
    });
});

test('non-measurements do not affect session totals', () => {
    const stats = new SessionStatistics();
    assert.equal(stats.add({valid: false, downloadMBps: null, uploadMBps: null}), false);
    assert.equal(stats.snapshot().samples, 0);
});

test('formats totals using decimal SI units', () => {
    assert.equal(formatBytes(999), '999 B');
    assert.equal(formatBytes(1_000), '1.0 KB');
    assert.equal(formatBytes(2_400_000), '2.4 MB');
});
