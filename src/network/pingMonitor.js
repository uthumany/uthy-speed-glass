import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const PING_TIMEOUT_SECONDS = 2;

function validNumericAddress(address) {
    if (typeof address !== 'string' || address.length > 45)
        return false;
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(address))
        return address.split('.').every(part => Number(part) <= 255);
    return /^[0-9A-Fa-f:]+$/.test(address) && address.includes(':');
}

export class PingMonitor {
    constructor(onResult) {
        this._onResult = onResult;
        this._enabled = false;
        this._process = null;
        this._cancellable = null;
        this._timeoutId = 0;
        this._binary = GLib.find_program_in_path('ping');
    }

    setEnabled(enabled) {
        this._enabled = Boolean(enabled);
        if (!this._enabled)
            this.stop();
    }

    tick(gateway) {
        if (!this._enabled || this._process || !this._binary)
            return;
        if (!validNumericAddress(gateway)) {
            this._onResult(null, this._binary ? 'No local gateway' : 'ping unavailable');
            return;
        }

        try {
            this._cancellable = new Gio.Cancellable();
            this._process = Gio.Subprocess.new(
                [this._binary, '-n', '-c', '1', '-W', String(PING_TIMEOUT_SECONDS), '--', gateway],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
            );
            const child = this._process;
            const cancellable = this._cancellable;
            child.communicate_utf8_async(null, cancellable, (process, result) => {
                if (this._process !== child)
                    return;
                let latency = null;
                let message = 'Ping timed out';
                try {
                    const [ok, stdout] = process.communicate_utf8_finish(result);
                    if (ok) {
                        const match = stdout.match(/time[=<]([0-9]+(?:\.[0-9]+)?)\s*ms/i);
                        if (match) {
                            latency = Number(match[1]);
                            message = null;
                        }
                    }
                } catch (_error) {
                    message = 'Ping unavailable';
                }

                this._process = null;
                this._cancellable = null;
                if (this._timeoutId) {
                    GLib.source_remove(this._timeoutId);
                    this._timeoutId = 0;
                }
                if (this._enabled)
                    this._onResult(latency, message);
            });
            this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
                PING_TIMEOUT_SECONDS * 1000 + 500, () => {
                    this._timeoutId = 0;
                    if (this._process === child) {
                        try {
                            cancellable.cancel();
                            child.force_exit();
                        } catch (_error) {
                            // The async completion path owns final cleanup.
                        }
                    }
                    return GLib.SOURCE_REMOVE;
                });
        } catch (_error) {
            this._process = null;
            this._cancellable = null;
            this._onResult(null, 'Ping unavailable');
        }
    }

    stop() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (this._process) {
            try {
                this._cancellable?.cancel();
                this._process.force_exit();
            } catch (_error) {
                // Processes may exit between the state check and force_exit.
            }
        }
        this._process = null;
        this._cancellable = null;
    }
}
