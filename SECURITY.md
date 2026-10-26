# Security and privacy

The extension reads local kernel interface counters and local NetworkManager D-Bus properties. Core monitoring makes no external requests and sends no traffic values or interface names to any service. It does not require an API key or elevated privileges.

Optional latency monitoring is disabled by default. When enabled, it sends one ICMP echo request to the system's current numeric default gateway every ten seconds. It never invokes a shell and does not accept an arbitrary hostname from preferences. The ping process is bounded by a timeout and stopped during pause/disable.

## Reporting a vulnerability

Please avoid posting exploit details in a public issue. Use the repository's private security reporting feature if available; otherwise contact the maintainers through the verified repository's security contact. No public GitHub repository has been established by this local build, so do not send private reports to an unverified address. Until a repository/contact is published, users should avoid sharing sensitive information in public channels.

Do not include private interface names, local IP addresses, logs containing personal details, credentials, or access tokens in bug reports.
