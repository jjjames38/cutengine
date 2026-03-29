# RenderForge

[![Build](https://img.shields.io/github/actions/workflow/status/jjjames38/renderforge/ci.yml?branch=main)](https://github.com/jjjames38/renderforge/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-green.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

Self-hosted, **Shotstack API v1-compatible** video render engine. Hybrid Puppeteer + FFmpeg pipeline delivers CSS-quality animations (smooth 60fps Ken Burns, easing, transitions) with FFmpeg encoding power — no per-render fees.

Built for high-volume automated video production.

## Why RenderForge?

| | Shotstack | RenderForge |
|---|-----------|-------------|
| Deployment | Cloud only | Self-hosted + Cloud |
| Cost | Per-render pricing | Free (self-hosted) |
| Open Source | No | Yes (MIT) |
| Render Quality | Custom engine | CSS animation (60fps smooth easing) |
| AI Native | Limited | Seedream / Seedance integration |
| API Compat | -- | Full Shotstack v1 drop-in |

## Features

- **4 APIs** — Edit, Serve, Ingest, Create (full Shotstack v1 surface)
- **14 asset types** — Video, Image, Text, RichText, Audio, Shape, SVG, HTML, Title, Luma, Caption, AI Text-to-Image, AI Image-to-Video
- **Effects** — Ken Burns (6 types + Fast/Slow variants), 20+ transitions, 8 filters, Tween animations, ChromaKey, Transform, Speed control
- **Output** — mp4, gif, jpg, png, bmp, mp3
- **Resolutions** — preview, mobile, sd, hd, 1080, 4k
- **Aspect ratios** — 16:9, 9:16, 1:1, 4:5, 4:3
- **Templates** — CRUD with merge fields for dynamic content
- **Extended API** — Batch render, preview mode, queue status
- **Auth** — x-api-key (Shotstack compatible) + JWT
- **Observability** — Prometheus metrics + structured logging
- **Webhooks** — Callbacks on render complete/fail
- **Scaling** — BullMQ job queue with horizontal worker scaling

## Tech Stack

TypeScript, Fastify, BullMQ + Redis, Puppeteer + Chromium, FFmpeg, Sharp, Drizzle ORM, SQLite / PostgreSQL

## Quick Start

```bash
git clone https://github.com/jjjames38/renderforge.git
cd renderforge

pnpm install

# Start infrastructure (Redis + Chromium)
docker compose -f docker/docker-compose.dev.yml up -d

# Run dev server
pnpm dev

# Run tests
pnpm test
```

### Production (Docker)

```bash
docker compose -f docker/docker-compose.yml up -d
```

## Usage

### Submit a render

```bash
curl -X POST http://localhost:3000/edit/v1/render \
  -H "Content-Type: application/json" \
  -d '{
    "timeline": {
      "tracks": [{
        "clips": [{
          "asset": { "type": "image", "src": "https://example.com/photo.jpg" },
          "start": 0,
          "length": 5,
          "effect": "zoomIn",
          "filter": "boost"
        }]
      }]
    },
    "output": { "format": "mp4", "resolution": "hd" }
  }'
```

### Check render status

```bash
curl http://localhost:3000/edit/v1/render/{id}
```

## API Reference

### Edit API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/edit/v1/render` | Submit render job |
| GET | `/edit/v1/render/:id` | Get render status |
| POST | `/edit/v1/template` | Create template |
| GET | `/edit/v1/template` | List templates |
| GET | `/edit/v1/template/:id` | Get template |
| PUT | `/edit/v1/template/:id` | Update template |
| DELETE | `/edit/v1/template/:id` | Delete template |
| POST | `/edit/v1/template/:id/render` | Render from template |
| GET | `/edit/v1/inspect` | Inspect timeline |

### Serve API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/serve/v1/assets/:id` | Get asset |
| DELETE | `/serve/v1/assets/:id` | Delete asset |
| GET | `/serve/v1/assets/render/:id` | Get render output |
| POST | `/serve/v1/assets/transfer` | Transfer asset to destination |

### Ingest API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ingest/v1/sources` | Create source |
| GET | `/ingest/v1/sources` | List sources |
| GET | `/ingest/v1/sources/:id` | Get source |
| DELETE | `/ingest/v1/sources/:id` | Delete source |
| POST | `/ingest/v1/upload` | Upload file |

### Create API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create/v1/generate` | Generate AI asset |
| GET | `/create/v1/generate/:id` | Get generation status |

### Extended API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/x/v1/render/batch` | Batch render |
| POST | `/x/v1/render/preview` | Preview render |
| GET | `/x/v1/queue/status` | Queue status |
| GET | `/metrics` | Prometheus metrics |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `CHROMIUM_WS` | -- | Chromium WebSocket endpoint |
| `STORAGE_DRIVER` | `local` | Storage backend (`local`, `s3`) |
| `STORAGE_PATH` | `./data` | Local storage path |
| `DB_DRIVER` | `sqlite` | Database driver (`sqlite`, `pg`) |
| `SQLITE_PATH` | `./data/db.sqlite` | SQLite file path |
| `DATABASE_URL` | -- | PostgreSQL connection URL |
| `AUTH_ENABLED` | `false` | Enable authentication |
| `API_KEYS` | -- | Comma-separated API keys |
| `JWT_SECRET` | -- | JWT signing secret |

## Scaling

Scale workers horizontally with Docker Compose:

```bash
docker compose up --scale renderforge=4 --scale chromium=4
```

Each worker picks jobs from the shared BullMQ queue backed by Redis.

## Project Structure

```
src/
  api/
    edit/         # Render + template endpoints
    serve/        # Asset serving + transfer
    ingest/       # Source management + upload
    create/       # AI generation endpoints
    extended/     # Batch, preview, queue status
    metrics.ts    # Prometheus metrics
    middleware/   # Auth, validation, error handling
  render/
    assets/       # 14 asset type handlers
    builder/      # Timeline → HTML scene builder
    capture/      # Puppeteer frame capture
    effects/      # Ken Burns, transitions, filters, tween
    encoder/      # FFmpeg encoding pipeline
    parser/       # Shotstack JSON → internal IR
    pipeline.ts   # Orchestrator
  config/         # Environment + defaults
  db/             # Drizzle ORM schema + migrations
  queue/          # BullMQ job definitions + workers
  template/       # Template engine + merge fields
  server.ts       # Fastify bootstrap
  index.ts        # Entry point
tests/            # Vitest test suites
docker/           # Dockerfile + Compose configs
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you would like to change.

```bash
# Development workflow
pnpm install
docker compose -f docker/docker-compose.dev.yml up -d
pnpm dev          # Start with hot reload
pnpm test:watch   # Run tests in watch mode
```

## License

[MIT](LICENSE)
