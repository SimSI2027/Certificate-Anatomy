// Optional local companion for the native Windows Certificate Viewer.
// Only active when the local launcher passes a port and session token in the
// URL fragment. The public GitHub Pages build never has one.

export function readCompanionConfig(loc = window.location) {
  const params = new URLSearchParams(loc.hash.replace(/^#/, ''));
  const port = Number(params.get('companion'));
  const token = params.get('token');
  if (!port || port < 1024 || port > 65535 || !token || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  return { port, token };
}

export function createCompanion(config) {
  if (!config) return { available: false, open: async () => false };
  const base = `http://127.0.0.1:${config.port}`;
  return {
    available: true,
    async open(artifact) {
      try {
        const res = await fetch(`${base}/open`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Session-Token': config.token },
          body: JSON.stringify({ artifact }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
