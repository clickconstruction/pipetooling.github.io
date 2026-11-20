/**
 * Before we start (punch list #382, PR 6): Ask them. One ask to one person, across every stage it covers, written
 * from the open bullets (`askText`). The office reads it and changes any word. Nothing goes out by itself.
 *
 * Text it and Email it open Messages' own box right here, filled with the ask and tied to the job (`JobCustomerBox`).
 * Nothing is sent in that press: the box's send window is where a person sends it, and the send is the kept ask.
 * An ask that went out another way is kept by saying how: I texted it, I emailed it, I called. Every ask is kept
 * with its day and how, a row for each bullet it covered.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { ASK_WORDS, askText, countWords, openOnThem, type Site, type Stage } from '../../lib/startChecks/startChecks'
import type { StageLine } from '../../lib/startChecks/startCheckRows'
import type { AskHow, StartChecksIo, StartWho } from '../../lib/startChecks/startChecksIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { JobCustomerBox } from '../jobs/JobCustomerBox'

const muted: CSSProperties = { color: 'var(--text-muted)' }
const plainPress: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '7px 12px', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }
const bluePress: CSSProperties = { ...plainPress, border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }

/** Where Messages' box sends from: the job the message is tied to, and the customer whose thread it opens. */
export type AskMessagesDoor = { jobId: string; jobName: string; customerId: string | null }

export function StartCheckAskPanel({
  stages,
  site,
  today,
  me,
  door,
  press,
  onClose,
  hold,
}: {
  /** The stages the ask covers, each with its line. */
  stages: ReadonlyArray<{ stage: Stage; line: StageLine }>
  site: Site
  today: string
  me: StartWho
  door: AskMessagesDoor
  press: (write: (io: StartChecksIo) => Promise<void>) => Promise<void>
  onClose: () => void
  /** A hold note in place of an ask (PR 7): the words to send, for the one stage that was held. It is kept as a hold note. */
  hold?: { text: string }
}) {
  const { showToast } = useToastContext()
  const asked = useMemo(() => (hold ? [...stages] : stages.filter((s) => openOnThem(s.stage).length > 0)), [stages, hold])
  const [text, setText] = useState(() => hold?.text ?? askText(site, asked.map((s) => s.stage)))
  const [box, setBox] = useState<'text' | 'email' | null>(null)
  const [busy, setBusy] = useState(false)
  const n = asked.reduce((sum, s) => sum + openOnThem(s.stage).length, 0)
  const what = hold ? 'note' : 'ask'

  /** Keep the ask: a row for each open bullet on them, on every stage it covered. A hold note is one row for its stage. */
  const keep = async (how: AskHow) => {
    if (busy) return
    setBusy(true)
    try {
      const rows = hold ? asked.map((s) => ({ jobId: s.line.jobId, fixtureId: s.line.fixtureId, bulletId: null })) : asked.flatMap((s) => openOnThem(s.stage).map((b) => ({ jobId: s.line.jobId, fixtureId: s.line.fixtureId, bulletId: b.id })))
      await press((io) => io.keepAsk({ kind: hold ? 'hold_note' : 'ask', how, to: site.contact, day: today, rows }, me))
      onClose()
    } catch (e) {
      showToast(`The ${what} was not kept. ${formatErrorMessage(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`The ${what} is copied.`, 'success')
    } catch {
      showToast(`The ${what} could not be copied. Select the words and copy them by hand.`, 'error')
    }
  }

  return (
    <div style={{ marginTop: 10, padding: '12px 14px', border: '1px solid #2563eb', borderRadius: 12, background: 'var(--surface)' }} data-start-check-ask={what}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <b style={{ color: 'var(--text-strong)' }}>{hold ? `The note for ${site.contact}` : `Ask ${site.contact} about ${countWords(n, 'thing', 'things')}`}</b>
        <button type="button" className="scWord" onClick={onClose}>
          Close
        </button>
      </div>
      <p style={{ margin: '4px 0 8px', fontSize: '0.8125rem', ...muted }}>{hold ? ASK_WORDS.holdLead : ASK_WORDS.lead(asked.length)}</p>
      <textarea className="scAdd" aria-label={hold ? 'The hold note' : 'The ask'} value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(16, text.split('\n').length + 1)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', lineHeight: 1.45, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
        {door.customerId ? (
          <>
            <button type="button" className="scPress" style={box === 'text' ? plainPress : bluePress} aria-pressed={box === 'text'} onClick={() => setBox(box === 'text' ? null : 'text')}>
              {ASK_WORDS.textIt}
            </button>
            <button type="button" className="scPress" style={plainPress} aria-pressed={box === 'email'} onClick={() => setBox(box === 'email' ? null : 'email')}>
              {ASK_WORDS.emailIt}
            </button>
          </>
        ) : null}
        <button type="button" className="scPress" style={plainPress} onClick={() => void copy()}>
          {ASK_WORDS.copy}
        </button>
      </div>
      {!door.customerId ? <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', ...muted }}>{hold ? ASK_WORDS.holdNoThread : ASK_WORDS.noThread}</p> : null}
      {box && door.customerId ? (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }} data-start-check-ask-box={box}>
          <p style={{ margin: '0 0 6px', fontSize: '0.8125rem', ...muted }}>{hold ? ASK_WORDS.holdBoxLead : ASK_WORDS.boxLead}</p>
          {/* Keyed by the kind and the words, so the box opens on the ask as it reads now. */}
          <JobCustomerBox key={`${box}:${text}`} kind={box} jobId={door.jobId} jobName={door.jobName} customerId={door.customerId} startWords={text} onSent={() => void keep(box)} />
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center', fontSize: '0.8125rem' }}>
        <span style={muted}>{ASK_WORDS.another}</span>
        <button type="button" className="scChip" disabled={busy} onClick={() => void keep('text')}>
          {ASK_WORDS.texted}
        </button>
        <button type="button" className="scChip" disabled={busy} onClick={() => void keep('email')}>
          {ASK_WORDS.emailed}
        </button>
        <button type="button" className="scChip" disabled={busy} onClick={() => void keep('phone')}>
          {ASK_WORDS.called}
        </button>
      </div>
    </div>
  )
}
