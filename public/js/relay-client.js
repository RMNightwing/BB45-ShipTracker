// Browser-side relay client: connects to the local AIS relay, routes ship and
// status messages to callbacks, and auto-reconnects with backoff. Runtime glue
// (uses the WebSocket global), so it isn't unit-tested; the store + relay it
// talks to are. Returns a handle with close().
export function connectRelay(url, { onShip, onStatus, onSocket } = {}) {
  let ws, attempt = 0, closed = false
  const open = () => {
    ws = new WebSocket(url)
    ws.onopen = () => { attempt = 0; onSocket && onSocket(true) }
    ws.onmessage = (e) => {
      let m
      try { m = JSON.parse(e.data) } catch { return }
      if (m.type === 'ship') onShip && onShip(m)
      else if (m.type === 'status') onStatus && onStatus(!!m.connected)
    }
    ws.onclose = () => {
      onSocket && onSocket(false)
      if (closed) return
      setTimeout(open, Math.min(1000 * 2 ** attempt++, 15000)) // 1s..15s backoff
    }
    ws.onerror = () => { try { ws.close() } catch {} }
  }
  open()
  return { close() { closed = true; try { ws && ws.close() } catch {} } }
}
