import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const nginx = await readFile(
  new URL("../openchamber_ingress/rootfs/etc/nginx/nginx.conf", import.meta.url),
  "utf8"
);
const addon = await readFile(
  new URL("../openchamber_ingress/config.yaml", import.meta.url),
  "utf8"
);
const dockerfile = await readFile(
  new URL("../openchamber_ingress/Dockerfile", import.meta.url),
  "utf8"
);
const run = await readFile(
  new URL(
    "../openchamber_ingress/rootfs/etc/s6-overlay/s6-rc.d/openchamber-ingress/run",
    import.meta.url
  ),
  "utf8"
);

test("keeps the proxy behind Supervisor ingress", () => {
  assert.match(addon, /^ingress: true$/m);
  assert.doesNotMatch(addon, /^ports:/m);
  assert.doesNotMatch(addon, /^ingress_port:/m);
  assert.match(dockerfile, /^HEALTHCHECK CMD wget .*\/healthz/m);
  assert.match(nginx, /allow 172\.30\.32\.2;/);
  assert.match(nginx, /deny all;/);
});

test("supports long-lived WebSocket and event streams", () => {
  assert.match(addon, /^ingress_stream: true$/m);
  assert.match(nginx, /proxy_set_header Upgrade \$http_upgrade;/);
  assert.match(nginx, /proxy_buffering off;/);
  assert.match(nginx, /proxy_read_timeout 86400s;/);
});

test("verifies and adapts the upstream OpenChamber endpoint", () => {
  assert.match(nginx, /proxy_ssl_verify on;/);
  assert.match(nginx, /proxy_ssl_verify_depth 4;/);
  assert.match(nginx, /proxy_ssl_name openchamber\.jklocal\.us;/);
  assert.match(nginx, /proxy_set_header Origin \$upstream_origin;/);
  assert.match(nginx, /proxy_cookie_path \/ \/api\/hassio_ingress\//);
  assert.match(nginx, /proxy_set_header X-Forwarded-Proto \$browser_scheme;/);
  assert.match(nginx, /map \$http_x_forwarded_proto \$browser_scheme/);
  assert.doesNotMatch(nginx, /proxy_set_header X-Forwarded-Proto https;/);
  assert.match(nginx, /sub_filter_once off;/);
  assert.match(nginx, /__OPENCHAMBER_INGRESS_PATH__/);
  assert.match(nginx, /_oc_ingress_shim\.js/);
});

test("dials a configurable upstream while keeping TLS pinned", () => {
  assert.match(addon, /^options:\n  upstream_host: "192\.168\.0\.38"$/m);
  assert.match(addon, /^schema:\n  upstream_host: "match\(\^\[A-Za-z0-9.-\]\+\$\)"$/m);
  assert.match(nginx, /proxy_pass https:\/\/__UPSTREAM_HOST__;/);
  assert.doesNotMatch(nginx, /proxy_pass https:\/\/\d+\.\d+\.\d+\.\d+;/);
  assert.match(run, /bashio::config 'upstream_host'/);
  assert.match(run, /\^\[A-Za-z0-9.-\]\+\$/);
  assert.match(run, /bashio::exit\.nok/);
  assert.match(run, /s\|__UPSTREAM_HOST__\|\$\{upstream_host\}\|g/);
  assert.match(run, /^nginx -t$/m);
});
