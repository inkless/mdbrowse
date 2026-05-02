import type { Server } from "node:http";
import chokidar, { type FSWatcher } from "chokidar";
import { type WebSocket, WebSocketServer } from "ws";

const WS_PATH = "/__mdgrip_livereload";

/**
 * Client snippet served inline in every rendered HTML page when live
 * reload is enabled. Connects to the websocket; reloads on `reload`;
 * auto-reconnects on disconnect (helps when the server restarts).
 *
 * Inlined as a string instead of shipping a separate /static/ file so the
 * server can decide per-render whether to inject it (no JS shipped when
 * `--no-reload` is set).
 */
export const CLIENT_SNIPPET = `
<script>
(function () {
  var path = ${JSON.stringify(WS_PATH)};
  function connect() {
    var url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + path;
    var ws = new WebSocket(url);
    ws.onmessage = function (ev) {
      if (ev.data === "reload") location.reload();
    };
    ws.onclose = function () {
      setTimeout(connect, 500);
    };
  }
  connect();
})();
</script>
`;

export interface LiveReloadHandle {
  /** Inject before `</body>` (or anywhere in the page) when reload is on. */
  injectInto(html: string): string;
  /** Stop watcher and websocket server. */
  close(): Promise<void>;
}

/**
 * Wire chokidar + a websocket server onto an existing http.Server. Watches
 * `directory` recursively for `.md`/`.markdown` changes (plus any file the
 * user might be referencing — images, sibling stylesheets) and broadcasts
 * `"reload"` to every connected client. Mirrors `aarol/reload` in go-grip.
 *
 * `attachLiveReload(http, dir)` is called *after* the http server is
 * listening but before the URL is opened in a browser, so the very first
 * page load already has the websocket endpoint available.
 */
export function attachLiveReload(httpServer: Server, directory: string): LiveReloadHandle {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    if (!req.url) return;
    if (!req.url.startsWith(WS_PATH)) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  const watcher: FSWatcher = chokidar.watch(directory, {
    ignored: (path) => /(^|\/)\.(?!$)|node_modules/.test(path),
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
  });

  function broadcast(): void {
    for (const client of wss.clients) {
      if (client.readyState === 1 /* OPEN */) {
        try {
          client.send("reload");
        } catch {
          /* client died; chokidar will keep going */
        }
      }
    }
  }

  watcher.on("change", broadcast);
  watcher.on("add", broadcast);
  watcher.on("unlink", broadcast);

  return {
    injectInto(html: string): string {
      return injectBeforeBodyClose(html, CLIENT_SNIPPET);
    },
    async close(): Promise<void> {
      await watcher.close();
      await new Promise<void>((ok) => {
        for (const client of wss.clients as Set<WebSocket>) {
          try {
            client.terminate();
          } catch {
            /* ignore */
          }
        }
        wss.close(() => ok());
      });
    },
  };
}

function injectBeforeBodyClose(html: string, snippet: string): string {
  const idx = html.lastIndexOf("</body>");
  if (idx === -1) return html + snippet;
  return html.slice(0, idx) + snippet + html.slice(idx);
}
