/**
 * A WebSocket that answers Supabase Realtime's handshake and then stays quiet (punch list #194).
 * A sealed frame's channels join, their postgres_changes bindings are echoed back as the server
 * echoes them, heartbeats are answered, and no change ever arrives, so a page's live parts settle
 * as subscribed instead of retrying with console errors. Speaks the client's 2.0.0 JSON arrays,
 * `[join_ref, ref, topic, event, payload]`.
 */
type Handler = ((ev: { data: unknown }) => void) | null

export class QuietSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3
  readyState = 0
  binaryType = 'arraybuffer'
  bufferedAmount = 0
  extensions = ''
  protocol = ''
  onopen: ((ev: unknown) => void) | null = null
  onclose: ((ev: { code: number; reason: string; wasClean: boolean }) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null
  onmessage: Handler = null
  private listeners = new Map<string, Set<(ev: unknown) => void>>()

  constructor(public readonly url: string) {
    setTimeout(() => {
      if (this.readyState !== 0) return
      this.readyState = 1
      this.emit('open', {})
    }, 0)
  }

  addEventListener(type: string, fn: (ev: unknown) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(fn)
  }

  removeEventListener(type: string, fn: (ev: unknown) => void) {
    this.listeners.get(type)?.delete(fn)
  }

  private emit(type: 'open' | 'message' | 'close', ev: unknown) {
    const prop = type === 'open' ? this.onopen : type === 'message' ? this.onmessage : this.onclose
    if (prop) (prop as (e: unknown) => void).call(this, ev)
    for (const fn of this.listeners.get(type) ?? []) fn(ev)
  }

  send(data: unknown) {
    if (this.readyState !== 1 || typeof data !== 'string') return
    let msg: unknown
    try {
      msg = JSON.parse(data)
    } catch {
      return
    }
    const reply = quietReply(msg)
    if (reply) setTimeout(() => this.readyState === 1 && this.emit('message', { data: JSON.stringify(reply) }), 0)
  }

  close(code = 1000, reason = '') {
    if (this.readyState === 3) return
    this.readyState = 3
    setTimeout(() => this.emit('close', { code, reason, wasClean: true }), 0)
  }
}

/** The server's reply to one client message, or null when the server sends none. Pure. */
export function quietReply(msg: unknown): unknown[] | null {
  if (!Array.isArray(msg) || msg.length < 5) return null
  const [joinRef, ref, topic, event, payload] = msg as [unknown, unknown, unknown, unknown, unknown]
  if (event === 'phx_join') {
    const bindings = ((payload as { config?: { postgres_changes?: Record<string, unknown>[] } } | null)?.config?.postgres_changes ?? []).map((b, i) => ({ ...b, id: i + 1 }))
    return [joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: bindings } }]
  }
  if (event === 'heartbeat' || event === 'phx_leave') return [joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} }]
  return null
}
