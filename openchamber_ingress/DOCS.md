# OpenChamber

## About

This add-on proxies the private OpenChamber service at `https://openchamber.jklocal.us` through Home Assistant Supervisor ingress. Home Assistant performs authentication before forwarding a request, including when the Home Assistant app connects remotely through Nabu Casa.

OpenChamber assumes it runs at the root of a website. The add-on injects a small compatibility shim and rewrites HTML asset paths so the application can run under Home Assistant's generated ingress path. WebSocket and server-sent event streams remain unbuffered.

Sign in once with the existing OpenChamber password and select **Trust this device**. This session is separate from the direct LAN site's session because the two pages use different browser origins.

## Security

- The add-on publishes no host port.
- The ingress panel is restricted to Home Assistant administrators.
- Only the Supervisor ingress proxy and the local health check may connect to Nginx.
- The OpenChamber session cookie is scoped to the generated ingress path.
- OpenChamber remains reachable on the trusted local network through its existing Caddy endpoint; this add-on does not make that endpoint public.
- The add-on verifies the TLS certificate presented by the upstream Caddy service.

## Troubleshooting

If the panel does not load:

1. Confirm OpenChamber is available at `https://openchamber.jklocal.us` from the Home Assistant host.
2. Check this add-on's log for an upstream TLS or connection error.
3. Confirm the add-on remains healthy in **Settings > Add-ons > OpenChamber**.
4. Reload the Home Assistant app after restarting the add-on so it receives a fresh ingress session.

The `/healthz` check verifies that the ingress proxy itself is running. It does not report the upstream OpenChamber service as healthy.
