# Security Policy

## Supported versions

This project is maintained on the `main` branch. Security fixes are applied
there; there are no long-term support branches.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's
[Security Advisories](../../security/advisories/new) so the issue can be fixed
before it is disclosed.

Please include:

- what the vulnerability is and where it lives (file, route or endpoint),
- how to reproduce it,
- the impact you believe it has,
- any suggested fix.

You can expect an initial response within a few days.

## Scope

In scope:

- Authentication and session handling (`src/lib/session.ts`, `src/lib/admin-auth.ts`)
- The API request guard (`src/lib/route-helpers.ts`)
- Row-Level Security policies (`supabase/`)
- Rate limiting and abuse controls (`src/lib/rate-limit.ts`)
- PII encryption (`src/lib/field-crypto.ts`)
- Any path that could leak a server-only secret to the client bundle

Out of scope:

- Vulnerabilities that require a misconfigured deployment (for example a weak
  `ADMIN_PASSWORD`, or `SUPABASE_SERVICE_ROLE_KEY` exposed by the operator)
- Issues in third-party services (Supabase, your SMS/payment provider) — report
  those to the vendor
- Findings that only apply when documented setup steps in `README.md` were
  skipped

## Deploying this project securely

Before running this software in production, work through the
"Before you deploy" checklist in [README.md](../README.md) and read
[docs/SECURITY.md](../docs/SECURITY.md), which documents the threat model and
the known hardening backlog.
