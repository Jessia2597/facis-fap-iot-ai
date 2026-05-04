# Local development with Docker Compose

This directory contains a Docker Compose configuration for **local development only**.

## TDR notice

The FACIS Technical Development Requirements (TDR §9.1.1) forbid Docker Compose
in deliverables. The compose file in this directory is **not part of any FACIS
deliverable** and exists only to support fast iteration on a developer's
machine. Production runs on Kubernetes via the Helm chart at
`services/ai-insight-service/helm/`; ORCE-native deployment of the
ai-insight-service flows lives at `services/ai-insight-service/orce/`.

## Usage

From this directory:

```bash
docker compose up --build      # start ai-insight + redis
docker compose down            # stop
docker compose logs -f         # tail logs
```

Or from the service root:

```bash
docker compose -f dev/docker-compose.yml up --build
```

The `build: ..` directive points at the parent service directory so the
`Dockerfile` and `src/` are picked up as the build context.

## What this is NOT

- Not a deployment artefact.
- Not part of CI.
- Not referenced in any production runbook (production paths use kubectl/Helm).
- Not a substitute for testing against a real ORCE pod before review.
