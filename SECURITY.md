# Security Policy

## Supported Versions

The following versions of **EpoClaim** currently receive security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

We take the security of EpoClaim seriously. If you discover a vulnerability or security flaw, please report it responsibly:

1. **Do not create a public GitHub issue.**
2. Send an email to the project maintainers at: `souvikbwn12@gmail.com`
3. Please include:
   - A detailed description of the vulnerability.
   - Steps to reproduce or a proof of concept (PoC).
   - Potential impact on the system, API, or data integrity.
   - Any recommended remediation steps.

---

## Security Practices in EpoClaim

EpoClaim implements several layers of security defense:

1. **Untrusted Evidence Sanitization**: All evidence text retrieved from the web or submitted via context documents is treated as untrusted and scrubbed of prompt-injection payloads before verification.
2. **Payload Size Guardrails**: Maximum payload limits (2MB default) are strictly enforced at the API boundary to prevent resource exhaustion and denial-of-service (DoS).
3. **No Secret Leakage**: API tokens, keys, and credentials are never emitted in API responses, logs, or reports.
4. **Offline Isolation**: Core verification logic operates in a clean-room offline mode by default, preventing unintended external egress.
