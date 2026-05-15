---
title: API overview
description: OpenAI-compatible endpoints exposed by the dispatcher.
sidebar:
  order: 1
---

> Stub — content task #7 fills this in.

hal0 exposes an OpenAI-compatible API at `http://127.0.0.1:8080/v1`.
Routes implemented in v1:

- `POST /v1/chat/completions`
- `POST /v1/embeddings`
- `POST /v1/rerankings`
- `POST /v1/audio/transcriptions`
- `POST /v1/audio/speech`
- `GET  /v1/models`
