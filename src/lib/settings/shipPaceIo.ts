/**
 * How fast a change ships (v2.6399): the section's two reads. `load` reads the one `app_settings` row the `ship-pace`
 * cron writes every 15 minutes (`SHIP_PACE_KEY`); the client never calls GitHub. `readNow` is a dev's press on the
 * section: the function reads GitHub at once and writes the row, for the first read after the deploy and for a
 * screenshot. Both are an `io` the render smoke fakes.
 */
import { parseShipPacePicture, SHIP_PACE_KEY, type ShipPacePicture } from '../../../supabase/functions/_shared/shipPace'
import { supabase } from '../supabase'

export type ShipPaceReadNowAnswer =
  | { ok: true; line: string }
  | { ok: false; line: string }

export type ShipPaceIo = {
  /** The row as the cron last wrote it; null before the first read. Throws when the read fails, so the panel says why. */
  load(): Promise<ShipPacePicture | null>
  /** A dev's Read GitHub now: the function's answer in one line, ok or not. */
  readNow(): Promise<ShipPaceReadNowAnswer>
}

type ReadNowBody = {
  success?: boolean
  noToken?: boolean
  github?: number
  line?: string
  error?: string
  prs?: number
  last24h?: { merged?: number }
  ms?: number
}

/** The function's answer as one line for the dev who pressed. */
export function readNowLine(body: ReadNowBody | null | undefined, invokeError?: string | null): ShipPaceReadNowAnswer {
  if (body?.success) {
    const prs = body.prs ?? 0
    const merged = body.last24h?.merged ?? 0
    return { ok: true, line: `Read ${prs.toLocaleString('en-US')} pull requests. ${merged.toLocaleString('en-US')} merged in the last 24 hours.` }
  }
  if (body?.noToken) return { ok: false, line: body.line ?? 'GITHUB_PACE_TOKEN is not set, so GitHub was not read.' }
  if (body?.line) return { ok: false, line: body.line }
  if (body?.error) return { ok: false, line: body.error }
  return { ok: false, line: invokeError || 'The read did not answer.' }
}

export const shipPaceIo: ShipPaceIo = {
  async load() {
    const { data, error } = await supabase.from('app_settings').select('value_text').eq('key', SHIP_PACE_KEY).maybeSingle()
    if (error) throw error
    return parseShipPacePicture((data as { value_text?: string | null } | null)?.value_text)
  },
  async readNow() {
    const { data, error } = await supabase.functions.invoke('ship-pace', { body: { action: 'read' } })
    let body: ReadNowBody | null = (data as ReadNowBody | null) ?? null
    // A non-2xx answer lands in the error's context with the body unread; read it so the refusal has its words.
    const ctx = (error as { context?: unknown } | null)?.context
    if (!body && ctx instanceof Response) body = (await ctx.json().catch(() => null)) as ReadNowBody | null
    return readNowLine(body, error ? (error as { message?: string }).message ?? 'The read failed.' : null)
  },
}
