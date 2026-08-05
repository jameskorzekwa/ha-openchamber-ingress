(function installOpenChamberIngressShim() {
  "use strict";

  if (window.__OPENCHAMBER_INGRESS_SHIM__) {
    return;
  }

  var configuredPath = window.__OPENCHAMBER_INGRESS_PATH__ || "";
  var inferredMatch = window.location.pathname.match(/^\/api\/hassio_ingress\/[^/]+/);
  var ingressPath = (configuredPath || (inferredMatch && inferredMatch[0]) || "").replace(/\/$/, "");

  if (!ingressPath) {
    return;
  }

  window.__OPENCHAMBER_INGRESS_SHIM__ = true;

  function rewriteUrl(value, websocket) {
    if (value === null || value === undefined) {
      return value;
    }

    var original = String(value);
    if (!original || original[0] === "#" || /^(?:blob|data|javascript|mailto|tel):/i.test(original)) {
      return value;
    }

    var parsed;
    try {
      parsed = new URL(original, document.baseURI || window.location.href);
    } catch {
      return value;
    }

    if (parsed.host !== window.location.host || !/^(?:https?|wss?):$/.test(parsed.protocol)) {
      return value;
    }

    if (parsed.pathname !== ingressPath && !parsed.pathname.startsWith(ingressPath + "/")) {
      parsed.pathname = ingressPath + "/" + parsed.pathname.replace(/^\//, "");
    }

    if (websocket) {
      parsed.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return parsed.href;
    }

    if (/^[a-z][a-z\d+.-]*:/i.test(original)) {
      return parsed.href;
    }
    if (original.startsWith("//")) {
      return "//" + parsed.host + parsed.pathname + parsed.search + parsed.hash;
    }
    if (original.startsWith("/")) {
      return parsed.pathname + parsed.search + parsed.hash;
    }

    return original;
  }

  function rewriteSrcset(value) {
    if (typeof value !== "string") {
      return value;
    }
    return value.split(",").map(function rewriteCandidate(candidate) {
      var parts = candidate.trim().split(/\s+/, 2);
      parts[0] = rewriteUrl(parts[0], false);
      return parts.join(" ");
    }).join(", ");
  }

  window.__OPENCHAMBER_INGRESS_REWRITE__ = rewriteUrl;

  if (typeof window.fetch === "function") {
    var nativeFetch = window.fetch;
    window.fetch = function ingressFetch(input, init) {
      if (typeof input === "string" || input instanceof URL) {
        input = rewriteUrl(input, false);
      }
      return nativeFetch.call(this, input, init);
    };
  }

  if (typeof window.Request === "function") {
    var NativeRequest = window.Request;
    window.Request = class IngressRequest extends NativeRequest {
      constructor(input, init) {
        if (input instanceof NativeRequest) {
          super(input, init);
        } else {
          super(rewriteUrl(input, false), init);
        }
      }
    };
  }

  if (typeof window.WebSocket === "function") {
    var NativeWebSocket = window.WebSocket;
    window.WebSocket = class IngressWebSocket extends NativeWebSocket {
      constructor(url, protocols) {
        if (protocols === undefined) {
          super(rewriteUrl(url, true));
        } else {
          super(rewriteUrl(url, true), protocols);
        }
      }
    };
  }

  if (typeof window.EventSource === "function") {
    var NativeEventSource = window.EventSource;
    window.EventSource = class IngressEventSource extends NativeEventSource {
      constructor(url, options) {
        super(rewriteUrl(url, false), options);
      }
    };
  }

  ["Worker", "SharedWorker"].forEach(function patchWorker(name) {
    if (typeof window[name] !== "function") {
      return;
    }
    var NativeWorker = window[name];
    window[name] = class IngressWorker extends NativeWorker {
      constructor(url, options) {
        super(rewriteUrl(url, false), options);
      }
    };
  });

  if (typeof window.XMLHttpRequest === "function") {
    var nativeOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function ingressOpen(method, url) {
      var args = Array.prototype.slice.call(arguments);
      args[1] = rewriteUrl(url, false);
      return nativeOpen.apply(this, args);
    };
  }

  if (window.navigator && typeof window.navigator.sendBeacon === "function") {
    var nativeSendBeacon = window.navigator.sendBeacon;
    window.navigator.sendBeacon = function ingressSendBeacon(url, data) {
      return nativeSendBeacon.call(this, rewriteUrl(url, false), data);
    };
  }

  ["pushState", "replaceState"].forEach(function patchHistory(name) {
    if (!window.history || typeof window.history[name] !== "function") {
      return;
    }
    var nativeMethod = window.history[name];
    window.history[name] = function ingressHistory(state, unused, url) {
      if (url !== null && url !== undefined) {
        url = rewriteUrl(url, false);
      }
      return nativeMethod.call(this, state, unused, url);
    };
  });

  if (typeof window.open === "function") {
    var nativeWindowOpen = window.open;
    window.open = function ingressWindowOpen(url) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = rewriteUrl(url, false);
      return nativeWindowOpen.apply(this, args);
    };
  }

  if (window.navigator && window.navigator.serviceWorker && typeof window.navigator.serviceWorker.register === "function") {
    var nativeRegister = window.navigator.serviceWorker.register;
    window.navigator.serviceWorker.register = function ingressRegister(scriptUrl, options) {
      return nativeRegister.call(this, rewriteUrl(scriptUrl, false), options);
    };
  }

  if (typeof window.Element === "function") {
    var nativeSetAttribute = window.Element.prototype.setAttribute;
    var urlAttributes = new Set(["action", "data", "formaction", "href", "poster", "src"]);
    window.Element.prototype.setAttribute = function ingressSetAttribute(name, value) {
      var lowerName = String(name).toLowerCase();
      if (urlAttributes.has(lowerName)) {
        value = rewriteUrl(value, false);
      } else if (lowerName === "srcset") {
        value = rewriteSrcset(value);
      }
      return nativeSetAttribute.call(this, name, value);
    };
  }

  function patchUrlProperty(constructorName, propertyName, srcset) {
    var Constructor = window[constructorName];
    if (typeof Constructor !== "function") {
      return;
    }
    var descriptor = Object.getOwnPropertyDescriptor(Constructor.prototype, propertyName);
    if (!descriptor || !descriptor.configurable || typeof descriptor.set !== "function") {
      return;
    }
    Object.defineProperty(Constructor.prototype, propertyName, {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: function ingressUrlSetter(value) {
        descriptor.set.call(this, srcset ? rewriteSrcset(value) : rewriteUrl(value, false));
      }
    });
  }

  [
    ["HTMLAnchorElement", "href"],
    ["HTMLAreaElement", "href"],
    ["HTMLAudioElement", "src"],
    ["HTMLBaseElement", "href"],
    ["HTMLEmbedElement", "src"],
    ["HTMLFormElement", "action"],
    ["HTMLIFrameElement", "src"],
    ["HTMLImageElement", "src"],
    ["HTMLInputElement", "formAction"],
    ["HTMLInputElement", "src"],
    ["HTMLLinkElement", "href"],
    ["HTMLObjectElement", "data"],
    ["HTMLScriptElement", "src"],
    ["HTMLSourceElement", "src"],
    ["HTMLTrackElement", "src"],
    ["HTMLVideoElement", "poster"],
    ["HTMLVideoElement", "src"]
  ].forEach(function patchProperty(entry) {
    patchUrlProperty(entry[0], entry[1], false);
  });
  patchUrlProperty("HTMLImageElement", "srcset", true);
  patchUrlProperty("HTMLSourceElement", "srcset", true);
}());
