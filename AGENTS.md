# Repository Guide

This repository contains a Home Assistant add-on that exposes OpenChamber only through authenticated Supervisor ingress.

## Validation

Run these checks before committing:

```sh
npm ci
npm run lint
npm test
docker build --build-arg BUILD_ARCH=amd64 openchamber_ingress
```

Keep the ingress boundary intact: do not expose a host port, accept traffic from arbitrary container networks, or bypass Home Assistant authentication.
