import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {INTERFACE_NAME_PATTERN, parseDefaultRoute, parseProcNetDev} from './trafficReader.js';

function readText(path) {
    try {
        const [ok, contents] = GLib.file_get_contents(path);
        return ok ? new TextDecoder().decode(contents) : null;
    } catch (_error) {
        return null;
    }
}

function unpack(proxy, property) {
    try {
        return proxy?.get_cached_property(property)?.deep_unpack() ?? null;
    } catch (_error) {
        return null;
    }
}

export class InterfaceManager {
    constructor() {
        this._nmProxy = null;
        this._nmLastRefresh = 0;
        this._nmActive = [];
        this._nmUnavailable = false;
    }

    readCounters() {
        return parseProcNetDev(readText('/proc/net/dev') ?? '');
    }

    getSnapshot(nowMs = Date.now()) {
        const counters = this.readCounters();
        const route = parseDefaultRoute(readText('/proc/net/route') ?? '');
        const interfaces = [];
        for (const [name, values] of counters) {
            if (name === 'lo' || !INTERFACE_NAME_PATTERN.test(name))
                continue;
            const operstate = readText(`/sys/class/net/${name}/operstate`)?.trim() ?? 'unknown';
            interfaces.push({
                name,
                rxBytes: values.rxBytes,
                txBytes: values.txBytes,
                operstate,
                up: operstate === 'up' || (operstate === 'unknown' && route?.interfaceName === name),
            });
        }

        if (nowMs - this._nmLastRefresh >= 5000)
            this._refreshNetworkManager(nowMs);

        const nmInterface = this._nmActive.find(name => counters.has(name));
        let activeInterface = nmInterface ?? null;
        if (!activeInterface && route && counters.has(route.interfaceName))
            activeInterface = route.interfaceName;
        if (!activeInterface)
            activeInterface = interfaces.find(item => item.up)?.name ?? null;

        return {
            counters,
            interfaces,
            activeInterface,
            gateway: route?.gateway ?? null,
            defaultRouteInterface: route?.interfaceName ?? null,
            networkManagerAvailable: Boolean(this._nmProxy),
        };
    }

    _refreshNetworkManager(nowMs) {
        this._nmLastRefresh = nowMs;
        if (this._nmUnavailable)
            return;

        try {
            if (!this._nmProxy) {
                this._nmProxy = Gio.DBusProxy.new_for_bus_sync(
                    Gio.BusType.SYSTEM,
                    Gio.DBusProxyFlags.NONE,
                    null,
                    'org.freedesktop.NetworkManager',
                    '/org/freedesktop/NetworkManager',
                    'org.freedesktop.NetworkManager',
                    null,
                );
            }

            const activePaths = unpack(this._nmProxy, 'ActiveConnections') ?? [];
            const active = [];
            for (const path of activePaths) {
                try {
                    const connection = Gio.DBusProxy.new_for_bus_sync(
                        Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, null,
                        'org.freedesktop.NetworkManager', path,
                        'org.freedesktop.NetworkManager.Connection.Active', null);
                    if (unpack(connection, 'State') !== 2)
                        continue;
                    for (const devicePath of unpack(connection, 'Devices') ?? []) {
                        const device = Gio.DBusProxy.new_for_bus_sync(
                            Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, null,
                            'org.freedesktop.NetworkManager', devicePath,
                            'org.freedesktop.NetworkManager.Device', null);
                        const state = unpack(device, 'State');
                        const name = unpack(device, 'Interface');
                        if (state === 100 && typeof name === 'string' &&
                            INTERFACE_NAME_PATTERN.test(name))
                            active.push(name);
                    }
                } catch (_error) {
                    // A connection can disappear between enumeration and lookup.
                }
            }
            this._nmActive = [...new Set(active)];
        } catch (_error) {
            this._nmProxy = null;
            this._nmActive = [];
            this._nmUnavailable = true;
        }
    }

    listInterfaces() {
        return this.getSnapshot().interfaces;
    }
}
