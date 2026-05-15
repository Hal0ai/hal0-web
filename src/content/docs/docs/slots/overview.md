---
title: Slot architecture
description: Lifecycle, single-flight dispatch, and the Provider ABC.
sidebar:
  order: 1
---

> Stub — content task #7 fills this in.

Each inference workload (chat / embed / STT / TTS) runs in its own
slot — a systemd-managed process on a `hal0-slot@.service` template
unit with a known port and lifecycle.
