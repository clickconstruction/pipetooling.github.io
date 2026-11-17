/**
 * Tell the dev (punch list #380): a short memory of trouble, so a note can say what went wrong
 * without the person having to describe it.
 *
 * Two things are remembered, a few of each, for a few minutes: the error lines a person was
 * shown, and the calls the server answered with a refusal. Both stay in this tab's memory and
 * go nowhere unless the person sends a note, where the box lists them first.
 *
 * A lost signal is neither (the owner, 2026-11-17). The outbox keeps the press and sends it when
 * the signal is back, so a call that never reached the server is not remembered here, and an
 * error line that only says the signal dropped offers no press (`errorLineOffersNote`).
 */
import { OFFLINE_ERROR_MESSAGE, isNetworkFetchErrorMessage } from '../networkErrorMessage'

export type TroubleError = { words: string; at: number }
export type TroubleRefusal = { what: string; status: number; at: number }
export type RecentTrouble = { errors: TroubleError[]; refused: TroubleRefusal[] }

/** How far back a note looks. */
export const TROUBLE_WINDOW_MS = 5 * 60 * 1000
const KEEP = 8

/** True when an error line says nothing but that the signal dropped. */
export function isLostSignalLine(words: string | null | undefined): boolean {
  if (!words) return false
  return words.includes(OFFLINE_ERROR_MESSAGE) || isNetworkFetchErrorMessage(words)
}

/**
 * Whether an error line carries the Tell the dev press. Never for a lost signal, never while the
 * browser says it is offline, and never with Fix mode off.
 */
export function errorLineOffersNote(args: { words: string; online: boolean; fixMode: boolean }): boolean {
  if (!args.fixMode) return false
  if (!args.online) return false
  if (!args.words.trim()) return false
  return !isLostSignalLine(args.words)
}

/**
 * What a refused call is called on a note: the verb and the name it was sent to, never the query,
 * which holds ids and the values typed into a filter. Null for an address that is not the app's server.
 */
export function refusedCallName(method: string | null | undefined, url: string): string | null {
  let path = ''
  try {
    path = new URL(url, 'https://x.invalid').pathname
  } catch {
    return null
  }
  const verb = (method || 'GET').toUpperCase()
  const m =
    /\/rest\/v1\/rpc\/([A-Za-z0-9_]+)/.exec(path) ??
    /\/rest\/v1\/([A-Za-z0-9_]+)/.exec(path) ??
    /\/functions\/v1\/([A-Za-z0-9_-]+)/.exec(path) ??
    /\/storage\/v1\/object\/(?:public\/|sign\/|authenticated\/)?([A-Za-z0-9_-]+)/.exec(path)
  if (!m) return null
  if (path.includes('/rest/v1/rpc/')) return `${m[1]} (function)`
  if (path.includes('/functions/v1/')) return `${m[1]} (edge function)`
  if (path.includes('/storage/v1/')) return `${verb} ${m[1]} (files)`
  return `${verb} ${m[1]}`
}

export type TroubleMemory = {
  noteErrorLine: (words: string) => void
  noteRefusedCall: (call: { method?: string | null; url: string; status: number }) => void
  recent: (now?: number) => RecentTrouble
  clear: () => void
}

export function makeTroubleMemory(clock: () => number = Date.now): TroubleMemory {
  let errors: TroubleError[] = []
  let refused: TroubleRefusal[] = []
  return {
    noteErrorLine(words) {
      const line = (words ?? '').trim()
      if (!line || isLostSignalLine(line)) return
      // The same line shown twice is one line, at its latest time.
      errors = [{ words: line, at: clock() }, ...errors.filter((e) => e.words !== line)].slice(0, KEEP)
    },
    noteRefusedCall(call) {
      // 401 is a sign-in running out and the app's to mend; below 400 is no refusal at all.
      if (!(call.status >= 400) || call.status === 401) return
      const what = refusedCallName(call.method, call.url)
      if (!what) return
      refused = [{ what, status: call.status, at: clock() }, ...refused].slice(0, KEEP)
    },
    recent(now = clock()) {
      const since = now - TROUBLE_WINDOW_MS
      return { errors: errors.filter((e) => e.at >= since), refused: refused.filter((r) => r.at >= since) }
    },
    clear() {
      errors = []
      refused = []
    },
  }
}

/** The app's one memory. Cleared at sign-out. */
export const troubleMemory = makeTroubleMemory()

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href
  return (input as { url?: string }).url ?? ''
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method
  if (typeof input === 'object' && input !== null && 'method' in input) return (input as { method?: string }).method ?? 'GET'
  return 'GET'
}

/**
 * Wrap a fetch so a refusal is remembered. The answer is handed on untouched, and a call that
 * throws (no signal) is rethrown and never remembered. Remembering can never fail the call.
 */
export function wrapFetchRememberingRefusals(inner: FetchLike, memory: TroubleMemory = troubleMemory): FetchLike {
  return async (input, init) => {
    const res = await inner(input, init)
    if (!res.ok) {
      try {
        memory.noteRefusedCall({ method: requestMethod(input, init), url: requestUrl(input), status: res.status })
      } catch {
        // A memory that fails is a memory that stays quiet.
      }
    }
    return res
  }
}
