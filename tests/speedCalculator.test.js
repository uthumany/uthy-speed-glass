import test from 'node:test';
import assert from 'node:assert/strict';
import {SpeedCalculator, formatSpeed} from '../src/network/speedCalculator.js';

const counters = (interfaceName, rxBytes, txBytes, nowUsec) =>
    ({interfaceName, rxBytes, txBytes, nowUsec});

test('first reading initializes a baseline rather than displaying a made-up speed', () => {
    const calc = new SpeedCalculator();
    assert.deepEqual(calc.sample(counters('eth0', 1000, 2000, 1_000_000)), {
        valid: false, status: 'INITIALIZING', interfaceName: 'eth0',
        downloadMBps: null, uploadMBps: null,
    });
});

test('calculates decimal MB/s from RX and TX deltas and elapsed time', () => {
    const calc = new SpeedCalculator();
    calc.sample(counters('eth0', 0, 0, 1_000_000));
    const sample = calc.sample(counters('eth0', 2_500_000, 500_000, 2_000_000));
    assert.equal(sample.valid, true);
    assert.equal(sample.downloadMBps, 2.5);
    assert.equal(sample.uploadMBps, 0.5);
    assert.equal(sample.rxDelta, 2_500_000);
});

test('zero traffic is a valid zero-speed sample', () => {
    const calc = new SpeedCalculator();
    calc.sample(counters('wlan0', 22, 45, 5_000_000));
    const sample = calc.sample(counters('wlan0', 22, 45, 6_000_000));
    assert.equal(sample.valid, true);
    assert.equal(sample.downloadMBps, 0);
    assert.equal(sample.uploadMBps, 0);
});

test('interface changes, counter resets, invalid time, and long suspend gaps establish a new baseline', () => {
    const calc = new SpeedCalculator({maxSampleGapSeconds: 10});
    calc.sample(counters('eth0', 100, 100, 1_000_000));
    assert.equal(calc.sample(counters('wlan0', 10, 10, 2_000_000)).status, 'INITIALIZING');
    assert.equal(calc.sample(counters('wlan0', 5, 11, 3_000_000)).status, 'INITIALIZING');
    assert.equal(calc.sample(counters('wlan0', 6, 12, 3_000_000)).status, 'INITIALIZING');
    assert.equal(calc.sample(counters('wlan0', 7, 13, 20_000_000)).status, 'INITIALIZING');
    assert.equal(calc.sample(counters('wlan0', 8, 14, 21_000_000)).valid, true);
});

test('invalid interface/counters clear the baseline and formatting hides unavailable readings', () => {
    const calc = new SpeedCalculator();
    assert.equal(calc.sample(counters('../eth0', 1, 1, 1)).status, 'DISCONNECTED');
    assert.equal(formatSpeed(null), '-- MB/s');
    assert.equal(formatSpeed(1.234), '1.2 MB/s');
});
