# ADR-0007: Containerize the app; target an always-on DigitalOcean droplet

- Status: Accepted
- Date: 2026-09-19
- Deciders: Jian

## Context

ADR-0002 already settled that Telegram uses long-polling, so this process
never needs a public HTTPS endpoint — it only needs to stay running. Jian
wants the eventual home for that process to be an always-on DigitalOcean
droplet rather than his own machine, which supersedes the earlier default in
PLAN.md (Q14: "no containers required for v1").

## Decision

Package the app as a Docker image (multi-stage build: `npm ci` + `tsc` in a
build stage, a slim runtime stage running as a non-root user) and run it via
Docker Compose on the target droplet. The shared LibSQL database file
(ADR-0006) lives on a bind-mounted host directory (`./data`), not inside the
container, so `docker compose up` recreating the container never loses
workflow snapshots or audit history. Secrets are passed as environment
variables via an `.env` file read by Compose, never baked into the image.

CI gets a `docker-build` job that builds the image on every push/PR — this
validates the image builds, it does not push or deploy anywhere yet. Actual
deployment automation (e.g., a GitHub Actions job that SSHes into the
droplet, or watchtower-style polling) is deferred until the droplet exists;
for now, "deploy" means the droplet operator runs `git pull && docker compose
up -d --build` by hand.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Bare Node process managed by systemd/pm2 on the droplet | Works, but loses the reproducible-build guarantee (droplet's Node/OS drift from what CI tested) and makes moving to a different host later a manual re-provisioning job instead of a `docker run`. |
| PaaS (Railway, Fly.io, Render) instead of a droplet | Jian specifically wants a droplet; a PaaS would also complicate the long-polling process model less but isn't what was asked for. |
| Alpine-based runtime image | Smaller image, but `@libsql/client`'s native bindings are more reliably prebuilt for glibc; a `slim` (Debian) base trades some image size for avoiding a musl-compatibility failure mode on day one. |

## Consequences

- The Dockerfile and Compose file become the source of truth for "how this
  actually runs," not just local `npm` scripts — both need to stay correct
  as the app grows, and CI's `docker-build` job is what catches drift.
- The `./data` bind mount is a single point of backup responsibility: losing
  that directory on the droplet loses the seen-items ledger, draft history,
  and audit log. Not automated yet — noted as an open risk.
- Full deploy automation (build → push to a registry → pull on the droplet)
  is explicitly not built yet; the droplet doesn't exist yet either. This is
  the next deployment-side decision once a droplet is provisioned.
