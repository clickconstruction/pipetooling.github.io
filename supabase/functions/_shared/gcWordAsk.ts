/**
 * Ask by link (punch list #49, step 7). The assistant used to phone the
 * account man for his read of each GC; the call is a cost. She sends him a
 * link instead — no sign-in — he answers for his GCs from his phone, and his
 * answers wait for her to read and save.
 *
 * The link is a capability with a short life: it shows what his GCs owe and
 * what was last said, and it takes answers. It never writes a mark — marks
 * stay the office's, written under the assistant's own sign-in once she has
 * read the answer.
 *
 * Import-free: the edge function runs it and the client's tests run the same
 * file (src/lib/gcWordAsk.ts re-exports it).
 */

export const WORD_ASK_TEMPERATURES = ['hot', 'warm', 'cool', 'cold'] as const
export type WordAskTemperature = (typeof WORD_ASK_TEMPERATURES)[number]

/** A link lives eight days: asked on Monday, it still opens the Monday after. */
export const WORD_ASK_LIFE_DAYS = 8
export const WORD_ASK_NOTE_MIN = 8
export const WORD_ASK_NOTE_MAX = 600
export const WORD_ASK_MAX_GCS = 60

const NO_CHANGE_PREFIX = 'No change since '

/** A word that only repeated the one before it. */
export function isNoChangeNote(note: string | null | undefined): boolean {
  return (note ?? '').trimStart().startsWith(NO_CHANGE_PREFIX)
}

/** The sentence a "no change" writes: what it repeats, and from when — so the record still reads on its own. */
export function noChangeNote(last: { note: string; at: string }): string {
  const day = new Date(last.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${NO_CHANGE_PREFIX}${day}: “${last.note.trim()}”`
}

export type WordAskLink = { revoked_at: string | null; expires_at: string }

/** Why a link will not open, or null when it will. */
export function wordAskLinkProblem(link: WordAskLink | null | undefined, nowMs: number): 'missing' | 'revoked' | 'expired' | null {
  if (!link) return 'missing'
  if (link.revoked_at) return 'revoked'
  const expires = new Date(link.expires_at).getTime()
  if (Number.isNaN(expires) || expires <= nowMs) return 'expired'
  return null
}

export function wordAskLinkMessage(problem: 'missing' | 'revoked' | 'expired'): string {
  if (problem === 'expired') return 'This link has run out. Ask the office to send you a new one.'
  return 'This link is no longer active. Ask the office to send you a new one.'
}

/** One GC on the page he opens: what it owes, what was last said, and what he has answered so far. */
export type WordAskGc = {
  gcId: string
  gcName: string
  amount: number
  oldestAgeDays: number | null
  over90: number
  lastWord: { temperature: string | null; note: string; by: string; at: string } | null
  promise: { payBy: string; late: boolean; daysLate: number } | null
  /** "No change" may be given: there is a read to repeat, and the last word was not itself a repeat. */
  noChangeAllowed: boolean
  answer: { temperature: string | null; note: string; payBy: string | null; noChange: boolean; status: string } | null
}

/** The office week's item, as get_statement_week_for_office() returns it — only the fields this kernel reads. */
export type WordAskWeekItem = {
  gc_id: string
  gc_name: string
  amount: number
  oldest_age_days: number | null
  over_90: number
  last_word: { note: string; by: string; at: string; temperature: string | null } | null
  last_temperature: { temperature: string; by: string; at: string } | null
  expected_pay_by: string | null
  promise_late: boolean
  days_late: number
}

export type WordAskAnswerRow = { gc_customer_id: string; temperature: string | null; note: string | null; expected_pay_by: string | null; no_change: boolean; status: string }

/**
 * The GCs the link shows: the ones the ask names that still owe over the
 * line, in the week's order (a broken promise first). A GC that was paid down
 * since the ask simply drops off.
 */
export function wordAskPageGcs(items: readonly WordAskWeekItem[], gcIds: readonly string[], answers: readonly WordAskAnswerRow[]): WordAskGc[] {
  const asked = new Set(gcIds)
  const answerByGc = new Map(answers.map((a) => [a.gc_customer_id, a]))
  return items
    .filter((i) => asked.has(i.gc_id))
    .map((i) => {
      const temperature = i.last_word?.temperature ?? i.last_temperature?.temperature ?? null
      const lastWord = i.last_word ? { temperature, note: i.last_word.note, by: i.last_word.by, at: i.last_word.at } : null
      const a = answerByGc.get(i.gc_id)
      return {
        gcId: i.gc_id,
        gcName: i.gc_name,
        amount: Number(i.amount || 0),
        oldestAgeDays: i.oldest_age_days,
        over90: Number(i.over_90 || 0),
        lastWord,
        promise: i.expected_pay_by ? { payBy: i.expected_pay_by, late: i.promise_late === true, daysLate: Number(i.days_late || 0) } : null,
        noChangeAllowed: lastWord != null && lastWord.temperature != null && !isNoChangeNote(lastWord.note),
        answer: a ? { temperature: a.temperature, note: a.note ?? '', payBy: a.expected_pay_by, noChange: a.no_change === true, status: a.status } : null,
      }
    })
}

export type WordAskAnswerInput = { gcId?: unknown; temperature?: unknown; note?: unknown; payBy?: unknown; noChange?: unknown }

export type WordAskAnswer = { gcId: string; temperature: WordAskTemperature | null; note: string; payBy: string | null; noChange: boolean }

const YMD = /^\d{4}-\d{2}-\d{2}$/

/**
 * What he sent, checked against what he was asked. A row he left blank is
 * skipped; a row he started needs a read and a sentence — the bar the office
 * holds itself to — or "no change" where that is allowed. Anything about a GC
 * the link does not name is refused outright.
 */
export function validateWordAskAnswers(
  input: unknown,
  page: readonly Pick<WordAskGc, 'gcId' | 'gcName' | 'noChangeAllowed'>[],
): { ok: true; answers: WordAskAnswer[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'Nothing to save.' }
  if (input.length > WORD_ASK_MAX_GCS) return { ok: false, error: 'Too many answers.' }
  const byId = new Map(page.map((g) => [g.gcId, g]))
  const seen = new Set<string>()
  const answers: WordAskAnswer[] = []
  for (const raw of input as WordAskAnswerInput[]) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Bad answer.' }
    const gcId = typeof raw.gcId === 'string' ? raw.gcId : ''
    const gc = byId.get(gcId)
    if (!gc) return { ok: false, error: 'That GC is not on this link.' }
    if (seen.has(gcId)) return { ok: false, error: `${gc.gcName} is answered twice.` }
    seen.add(gcId)
    const noChange = raw.noChange === true
    const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, WORD_ASK_NOTE_MAX) : ''
    const payByRaw = typeof raw.payBy === 'string' ? raw.payBy.trim() : ''
    if (payByRaw && !YMD.test(payByRaw)) return { ok: false, error: `${gc.gcName}: the pay date is not a date.` }
    const payBy = payByRaw || null
    const temperature = (WORD_ASK_TEMPERATURES as readonly string[]).includes(String(raw.temperature)) ? (raw.temperature as WordAskTemperature) : null
    if (!noChange && !temperature && !note && !payBy) continue
    if (noChange) {
      if (!gc.noChangeAllowed) return { ok: false, error: `${gc.gcName}: the last word was already “no change” — say where they stand this time.` }
      answers.push({ gcId, temperature: null, note: '', payBy, noChange: true })
      continue
    }
    if (!temperature) return { ok: false, error: `${gc.gcName}: pick their temperature.` }
    if (note.length < WORD_ASK_NOTE_MIN) return { ok: false, error: `${gc.gcName}: a sentence, not a word.` }
    answers.push({ gcId, temperature, note, payBy, noChange: false })
  }
  if (answers.length === 0) return { ok: false, error: 'Nothing to save — answer at least one GC.' }
  return { ok: true, answers }
}

const firstName = (name: string | null | undefined): string => (name ?? '').trim().split(/\s+/)[0] || 'there'
const usdRound = (n: number): string => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function wordAskUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/ask?t=${encodeURIComponent(token)}`
}

/** What she texts him when she copies the link: short, and says what it is. */
export function wordAskTextMessage(input: { ownerName: string | null; askedByName: string; gcCount: number; url: string }): string {
  return `${firstName(input.ownerName)} — where do your ${input.gcCount === 1 ? 'GC' : `${input.gcCount} GCs`} stand on paying? Two minutes, no sign-in: ${input.url} — ${firstName(input.askedByName)}`
}

export type WordAskEmailInput = { ownerName: string | null; askedByName: string; gcs: readonly Pick<WordAskGc, 'gcName' | 'amount' | 'promise'>[]; url: string; expiresLabel: string }

export function wordAskEmail(input: WordAskEmailInput): { subject: string; text: string; html: string } {
  const n = input.gcs.length
  const total = input.gcs.reduce((t, g) => t + g.amount, 0)
  const who = firstName(input.ownerName)
  const asker = firstName(input.askedByName)
  const subject = `${who}, where do your ${n === 1 ? 'GC' : `${n} GCs`} stand? — ${usdRound(total)} owed`
  const late = input.gcs.filter((g) => g.promise?.late)
  const lines = input.gcs.map((g) => `  ${g.gcName} — ${usdRound(g.amount)}${g.promise?.late ? ` · promised ${g.promise.payBy}, ${g.promise.daysLate} day${g.promise.daysLate === 1 ? '' : 's'} late` : ''}`)
  const text = [
    `${who},`,
    '',
    `${asker} is writing down where each of your GCs stands this week. For each one: their temperature, a sentence, and the date they said they'd pay.`,
    '',
    ...lines,
    '',
    `Answer here — two minutes, no sign-in: ${input.url}`,
    '',
    `The link works until ${input.expiresLabel}. ${asker} reads your answers before anything is saved.`,
  ].join('\n')
  const rows = input.gcs
    .map(
      (g) =>
        `<tr><td style="padding:6px 0;border-top:1px solid #e2e8f0;font-size:14px;color:#0f172a;">${esc(g.gcName)}${g.promise?.late ? `<div style="font-size:12px;font-weight:700;color:#b91c1c;">promised ${esc(g.promise.payBy)} — ${g.promise.daysLate} day${g.promise.daysLate === 1 ? '' : 's'} late</div>` : ''}</td><td style="padding:6px 0;border-top:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#0f172a;text-align:right;white-space:nowrap;vertical-align:top;">${esc(usdRound(g.amount))}</td></tr>`,
    )
    .join('')
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;">
  <div style="max-width:560px;margin:0 auto;padding:20px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;">
      <h1 style="margin:0 0 6px;font-size:20px;color:#0f172a;">${esc(who)}, where do your ${n === 1 ? 'GC' : `${n} GCs`} stand?</h1>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#334155;">${esc(asker)} is writing down where each of your GCs stands this week. For each one: their temperature, a sentence, and the date they said they&rsquo;d pay.</p>
      ${late.length > 0 ? `<p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#b91c1c;">${late.length} of them broke a promise — start there.</p>` : ''}
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${rows}</table>
      <a href="${esc(input.url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:10px 18px;border-radius:6px;">Answer for your GCs &#8594;</a>
      <p style="margin:12px 0 0;font-size:12px;color:#64748b;line-height:1.5;">Two minutes, no sign-in. The link works until ${esc(input.expiresLabel)}. ${esc(asker)} reads your answers before anything is saved.</p>
    </div>
  </div>
</body></html>`
  return { subject, text, html }
}
