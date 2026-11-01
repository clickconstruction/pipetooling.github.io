import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { PhoneSheet } from '../../PhoneSheet'
import { EmptyState } from '../../EmptyState'
import OfflineRetryPanel from '../../OfflineRetryPanel'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../../lib/offlineRecoveryState'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'
import { formatErrorMessage } from '../../../utils/errorHandling'
import { EVIDENCE_FROM_MESSAGES_WORDS as W, conversationOnMatter, evidenceJobsWords, putOutcomeWords, putPlan, type EvidenceConversation, type EvidencePutOutcome } from '../../../lib/legal/evidenceFromMessages'
import type { EvidenceFromMessagesData, EvidenceFromMessagesIo } from '../../../lib/legal/evidenceFromMessagesIo'
import { btn, btnPrimary, MUTED } from './legalDeskShared'

/**
 * **From the job's messages…** (punch list #230 PR 5): the Legal desk's Evidence door to the email on the account's
 * jobs. The window lists every email conversation on the account's jobs, tagged from a person's own mail or read from
 * the boxes, and after them the app's own sends, each with its count, its span, where it came from and the job. The
 * office ticks the ones counsel should read; **Put N on the matter** files one `.eml` per email through the same
 * `addLegalMatterDocument` the upload uses, past any that fails, and says what went, what did not and what was held.
 * A conversation already on the matter reads *on the matter* with no tick. A sheet from the bottom on a phone
 * (`PhoneSheet`). The rules and the words are `lib/legal/evidenceFromMessages.ts`, the reads and the writes
 * `evidenceFromMessagesIo.ts`, handed in as `io` so a smoke can hand in its own.
 */
export type LegalEvidenceFromMessagesWindowProps = {
  accountName: string
  /** The account's job numbers, for the line under the title. */
  jobNumbers: readonly string[]
  io: EvidenceFromMessagesIo
  onClose: () => void
  /** A press put at least one email on the matter: the Evidence list reads again. */
  onPut: () => void
}

type Read = { phase: 'loading' } | { phase: 'failed'; failure: OfflineRecoveryLastError } | { phase: 'ready'; data: EvidenceFromMessagesData }

const sub: CSSProperties = { display: 'block', ...MUTED, fontSize: '0.74rem', fontWeight: 400, marginTop: 1 }
const chip: CSSProperties = { display: 'inline-block', fontSize: '0.66rem', fontWeight: 600, lineHeight: '16px', padding: '0 7px', borderRadius: 999, background: 'var(--bg-muted)', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginTop: 2 }
const TONE: Record<'success' | 'warning' | 'error', string> = { success: 'var(--text-green-700)', warning: 'var(--text-amber-700)', error: 'var(--text-red-700)' }

export default function LegalEvidenceFromMessagesWindow({ accountName, jobNumbers, io, onClose, onPut }: LegalEvidenceFromMessagesWindowProps) {
  const [read, setRead] = useState<Read>({ phase: 'loading' })
  const [reading, setReading] = useState(false)
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<EvidencePutOutcome | null>(null)
  const [pressFailed, setPressFailed] = useState<string | null>(null)

  const load = useCallback(async () => {
    setReading(true)
    try {
      const data = await io.load()
      setRead({ phase: 'ready', data })
    } catch (e) {
      setRead({ phase: 'failed', failure: recoveryFailureFromError(e, W.readFailed) })
    } finally {
      setReading(false)
    }
  }, [io])
  useEffect(() => {
    void load()
  }, [load])

  const data = read.phase === 'ready' ? read.data : null
  const conversations = data?.conversations.filter((c) => c.kind === 'conversation') ?? []
  const sends = data?.conversations.filter((c) => c.kind === 'send') ?? []
  const plan = useMemo(
    () => putPlan((data?.conversations ?? []).filter((c) => ticked.has(c.key)), { onMatter: data?.onMatter ?? new Set(), rawBytes: data?.rawBytes ?? {} }),
    [data, ticked],
  )
  const dead = plan.dead || busy

  const toggle = (key: string) =>
    setTicked((was) => {
      const next = new Set(was)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const press = async () => {
    if (!data || plan.dead || busy) return
    setBusy(true)
    setPressFailed(null)
    try {
      const done = await io.put(plan, data)
      setOutcome(done)
      setTicked(new Set())
      if (done.done.length > 0) onPut()
      await load()
    } catch (e) {
      setPressFailed(formatErrorMessage(e, W.putFailed))
    } finally {
      setBusy(false)
    }
  }

  const row = (c: EvidenceConversation) => {
    const on = conversationOnMatter(c, data?.onMatter ?? new Set())
    const words = (
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{c.headline}</span>
        <span style={sub}>
          {[c.provenance, c.jobWords, !on.all && on.on > 0 ? `${on.on} of ${c.count} already on the matter` : ''].filter(Boolean).join(' · ')}
        </span>
      </span>
    )
    const style: CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: '0.82rem', cursor: on.all ? 'default' : 'pointer' }
    if (on.all) {
      return (
        <div key={c.key} data-evidence-row={c.key} data-on-matter="yes" style={style}>
          <span style={chip}>{W.onMatter}</span>
          {words}
        </div>
      )
    }
    return (
      <label key={c.key} data-evidence-row={c.key} data-on-matter="no" style={style}>
        <input type="checkbox" checked={ticked.has(c.key)} disabled={busy} onChange={() => toggle(c.key)} aria-label={c.headline} style={{ marginTop: 3 }} />
        {words}
      </label>
    )
  }

  const words = outcome ? putOutcomeWords(outcome) : null

  return (
    <PhoneSheet label={W.title} title={W.title} width={640} maxHeight="86vh" dataAttrs={{ 'data-legal-evidence-from-messages': '' }} onClose={onClose}>
      <div style={{ padding: '0.75rem 1rem', overflowY: 'auto', flex: '1 1 auto', minHeight: 0, display: 'grid', gap: 8, alignContent: 'start' }}>
        <div style={{ fontSize: '0.84rem' }}>
          <b>{accountName}</b> <span style={MUTED}>· {evidenceJobsWords(jobNumbers)}</span>
        </div>
        {read.phase === 'loading' ? (
          <p role="status" style={{ ...MUTED, margin: 0, fontSize: '0.82rem' }}>
            {W.loading}
          </p>
        ) : null}
        {read.phase === 'failed' ? <OfflineRetryPanel failure={read.failure} onRetry={load} surface="legal-evidence-from-messages" idempotent busy={reading} /> : null}
        {data && data.conversations.length === 0 ? <EmptyState compact main={W.emptyMain} next={{ label: W.emptyPress, to: '/messages' }} tail={W.emptyTail} /> : null}
        {conversations.length ? <div data-evidence-conversations>{conversations.map(row)}</div> : null}
        {sends.length ? (
          <div data-evidence-sends>
            <div style={{ ...MUTED, fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '6px 0 2px' }}>{W.sends}</div>
            {sends.map(row)}
          </div>
        ) : null}
        {outcome && words ? (
          <div role="status" data-evidence-outcome style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', display: 'grid', gap: 4, fontSize: '0.8rem' }}>
            <b style={{ color: TONE[words.tone] }}>{words.line}</b>
            {words.head ? <span>{words.head}</span> : null}
            {outcome.failed.map((f) => (
              <span key={f.key} data-evidence-failed={f.key}>
                {f.title}: <span style={{ color: 'var(--text-red-700)' }}>{f.reason}</span>
              </span>
            ))}
            {words.heldLine ? <span style={MUTED}>{words.heldLine}</span> : null}
            {outcome.held.map((h) => (
              <span key={h.item.key} data-evidence-held={h.item.key} style={MUTED}>
                {h.title}: {h.words}
              </span>
            ))}
          </div>
        ) : null}
        {pressFailed ? (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.8rem' }}>
            {pressFailed}
          </div>
        ) : null}
      </div>
      <div style={{ flex: 'none', borderTop: '1px solid var(--border)', padding: '0.6rem 1rem', display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" data-evidence-put disabled={dead} onClick={() => void press()} style={{ ...btnPrimary, height: 30, fontSize: '0.8rem', ...(dead ? { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'not-allowed' } : null) }}>
            {busy ? W.putting : plan.button}
          </button>
          <button type="button" data-evidence-close onClick={onClose} style={{ ...btn, height: 30, fontSize: '0.8rem' }}>
            {outcome ? W.close : W.notNow}
          </button>
          {plan.foot ? <span style={{ ...MUTED, fontSize: '0.76rem' }}>{plan.foot}</span> : null}
        </div>
        {plan.held.length ? (
          <div data-evidence-plan-held style={{ display: 'grid', gap: 2, maxHeight: 96, overflowY: 'auto', fontSize: '0.74rem', ...MUTED }}>
            {plan.held.map((h) => (
              <span key={h.item.key}>
                {h.title}: {h.words}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </PhoneSheet>
  )
}
