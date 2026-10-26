import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProcNetDev, parseDefaultRoute} from '../src/network/trafficReader.js';

test('parses RX and TX counters from /proc/net/dev', () => {
    const text = `Inter-| Receive | Transmit\n face |bytes packets errs drop fifo frame compressed multicast|bytes packets errs drop fifo colls carrier compressed\n  eth0: 12345 10 0 0 0 0 0 0 98765 9 0 0 0 0 0 0\n wlan0: 20 1 0 0 0 0 0 0 40 2 0 0 0 0 0 0\n lo: 999 3 0 0 0 0 0 0 999 3 0 0 0 0 0 0\n invalid/name: 50 1 0 0 0 0 0 0 60 1 0 0 0 0 0 0`;
    const parsed = parseProcNetDev(text);
    assert.deepEqual(parsed.get('eth0'), {rxBytes: 12345, txBytes: 98765});
    assert.deepEqual(parsed.get('wlan0'), {rxBytes: 20, txBytes: 40});
    assert.equal(parsed.has('invalid/name'), false);
});

test('parses an active default gateway from the Linux route table', () => {
    const route = `Iface Destination Gateway Flags RefCnt Use Metric Mask\neth0 00000000 0101A8C0 0003 0 0 100 00000000`;
    assert.deepEqual(parseDefaultRoute(route), {interfaceName: 'eth0', gateway: '192.168.1.1'});
});

test('ignores routes without an active default gateway', () => {
    assert.equal(parseDefaultRoute('Iface Destination Gateway Flags RefCnt Use Metric Mask\neth0 00000000 0101A8C0 0000 0 0 100 00000000'), null);
    assert.equal(parseProcNetDev(null).size, 0);
});
