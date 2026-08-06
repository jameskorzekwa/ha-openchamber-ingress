import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const shimSource = await readFile(
  new URL("../openchamber_ingress/rootfs/www/_oc_ingress_shim.js", import.meta.url),
  "utf8"
);

function createBrowser({ route = "/", storedRoute = null, session = "session-id" } = {}) {
  const calls = {};
  const location = new URL(`https://home.jklocal.us/api/hassio_ingress/${session}${route}`);
  const storage = new Map();
  if (storedRoute !== null) {
    storage.set("openchamber.ingress.lastRoute", storedRoute);
  }

  class Request {
    constructor(input) {
      this.url = input instanceof Request ? input.url : new URL(String(input), document.baseURI).href;
    }
  }
  class WebSocket {
    constructor(url) {
      calls.websocket = url;
    }
  }
  class EventSource {
    constructor(url) {
      calls.eventSource = url;
    }
  }
  class Worker {
    constructor(url) {
      calls.worker = url;
    }
  }
  class XMLHttpRequest {
    open(method, url) {
      calls.xhr = [method, url];
    }
  }
  class Element {
    setAttribute(name, value) {
      calls.attribute = [name, value];
    }
  }

  const document = {
    baseURI: location.href
  };
  const applyHistoryUrl = (url) => {
    if (url !== null && url !== undefined) {
      location.href = new URL(String(url), location.href).href;
    }
  };
  const history = {
    state: null,
    pushState(_state, _unused, url) {
      calls.history = url;
      applyHistoryUrl(url);
    },
    replaceState(_state, _unused, url) {
      calls.replaceHistory = url;
      applyHistoryUrl(url);
    }
  };
  const localStorage = {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    }
  };
  const navigator = {
    sendBeacon(url) {
      calls.beacon = url;
      return true;
    },
    serviceWorker: {
      register(url) {
        calls.serviceWorker = url;
      }
    }
  };

  const window = {
    __OPENCHAMBER_INGRESS_PATH__: `/api/hassio_ingress/${session}`,
    location,
    document,
    history,
    navigator,
    localStorage,
    Request,
    WebSocket,
    EventSource,
    Worker,
    SharedWorker: Worker,
    XMLHttpRequest,
    Element,
    URL,
    Set,
    fetch(input) {
      calls.fetch = input;
    },
    open(url) {
      calls.open = url;
    },
    addEventListener() {}
  };
  window.window = window;

  const context = vm.createContext({
    window,
    document,
    history,
    navigator,
    URL,
    Set,
    Object,
    Array,
    String
  });
  vm.runInContext(shimSource, context);
  return { calls, storage, window };
}

test("rewrites root-relative HTTP APIs exactly once", () => {
  const { window } = createBrowser();
  const rewrite = window.__OPENCHAMBER_INGRESS_REWRITE__;

  assert.equal(rewrite("/api/session"), "/api/hassio_ingress/session-id/api/session");
  assert.equal(
    rewrite("/api/hassio_ingress/session-id/api/session"),
    "/api/hassio_ingress/session-id/api/session"
  );
  assert.equal(rewrite("https://example.com/api/session"), "https://example.com/api/session");
  assert.equal(rewrite("#messages"), "#messages");
});

test("patches streaming and request APIs", () => {
  const { calls, window } = createBrowser();

  window.fetch("/api/session");
  new window.WebSocket("/api/ws");
  new window.EventSource("/api/events");
  const xhr = new window.XMLHttpRequest();
  xhr.open("POST", "/api/session");
  window.navigator.sendBeacon("/api/metrics");

  assert.equal(calls.fetch, "/api/hassio_ingress/session-id/api/session");
  assert.equal(calls.websocket, "wss://home.jklocal.us/api/hassio_ingress/session-id/api/ws");
  assert.equal(calls.eventSource, "/api/hassio_ingress/session-id/api/events");
  assert.deepEqual(calls.xhr, ["POST", "/api/hassio_ingress/session-id/api/session"]);
  assert.equal(calls.beacon, "/api/hassio_ingress/session-id/api/metrics");
});

test("patches navigation, workers, service workers, and DOM attributes", () => {
  const { calls, storage, window } = createBrowser();

  window.history.pushState({}, "", "/session/one");
  new window.Worker("/assets/worker.js");
  window.navigator.serviceWorker.register("/service-worker.js");
  const element = new window.Element();
  element.setAttribute("src", "/assets/image.png");
  window.open("/session/two");

  assert.equal(calls.history, "/api/hassio_ingress/session-id/session/one");
  assert.equal(storage.get("openchamber.ingress.lastRoute"), "/session/one");
  assert.equal(calls.worker, "/api/hassio_ingress/session-id/assets/worker.js");
  assert.equal(calls.serviceWorker, "/api/hassio_ingress/session-id/service-worker.js");
  assert.deepEqual(calls.attribute, ["src", "/api/hassio_ingress/session-id/assets/image.png"]);
  assert.equal(calls.open, "/api/hassio_ingress/session-id/session/two");
});

test("restores the last route under a new ingress session", () => {
  const { calls, window } = createBrowser({
    session: "new-session-id",
    storedRoute: "/?session=ses_123&view=messages"
  });

  assert.equal(
    calls.replaceHistory,
    "/api/hassio_ingress/new-session-id/?session=ses_123&view=messages"
  );
  assert.equal(window.location.search, "?session=ses_123&view=messages");
});

test("does not restore an ingress path saved by an older session", () => {
  const { calls } = createBrowser({
    session: "new-session-id",
    storedRoute: "/api/hassio_ingress/old-session-id/?session=ses_123"
  });

  assert.equal(calls.replaceHistory, undefined);
});
