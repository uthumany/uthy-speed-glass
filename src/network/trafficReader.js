export const INTERFACE_NAME_PATTERN = /^[A-Za-z0-9_.:-]{1,15}$/;

/** Parse /proc/net/dev into RX/TX byte counters without making assumptions
 * about the interface type. Loopback is deliberately left for the caller to
 * exclude so it remains available for explicit diagnostics if needed. */
export function parseProcNetDev(text) {
    const result = new Map();
    if (typeof text !== 'string')
        return result;

    for (const line of text.split(/\r?\n/).slice(2)) {
        const colon = line.indexOf(':');
        if (colon < 0)
            continue;

        const name = line.slice(0, colon).trim();
        const values = line.slice(colon + 1).trim().split(/\s+/);
        if (!INTERFACE_NAME_PATTERN.test(name) || values.length < 9)
            continue;

        const rxBytes = Number(values[0]);
        const txBytes = Number(values[8]);
        if (!Number.isSafeInteger(rxBytes) || !Number.isSafeInteger(txBytes) ||
            rxBytes < 0 || txBytes < 0)
            continue;

        result.set(name, {rxBytes, txBytes});
    }
    return result;
}

/** Parse the Linux IPv4 route table and return the active default route. */
export function parseDefaultRoute(text) {
    if (typeof text !== 'string')
        return null;

    for (const line of text.split(/\r?\n/).slice(1)) {
        const fields = line.trim().split(/\s+/);
        if (fields.length < 8 || fields[1] !== '00000000' ||
            !INTERFACE_NAME_PATTERN.test(fields[0]))
            continue;

        const flags = Number.parseInt(fields[3], 16);
        const gatewayWord = fields[2];
        if (!Number.isFinite(flags) || (flags & 1) === 0 ||
            !/^[0-9A-Fa-f]{8}$/.test(gatewayWord))
            continue;

        const octets = gatewayWord.match(/../g).map(part => Number.parseInt(part, 16));
        const gateway = octets.reverse().join('.');
        if (octets.some(octet => octet > 255))
            continue;
        return {interfaceName: fields[0], gateway};
    }
    return null;
}
