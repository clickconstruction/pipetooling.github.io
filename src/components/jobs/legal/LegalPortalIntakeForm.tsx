import { useEffect, useState, type CSSProperties } from 'react'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER_GREEN } from '../../../lib/portal/portalTheme'
import { portalSmall } from '../../../lib/legal/legalPortalCards'
import { EMPTY_LEGAL_FIRM_INTAKE, legalIntakeIntro, legalIntakeQuestions, legalIntakeSentWords, shapeLegalFirmIntake, type LegalFirmIntake } from '../../../lib/legal/legalFirmIntake'
import type { LegalPortalIntake, LegalPortalRecipient } from '../../../lib/legal/legalPortalPayload'

/**
 * Start here's step 4 (v2.4821): the firm's answers to five questions, sent to the office. The
 * answers on file fill the boxes; typing is kept on this browser until it sends, so a reload loses
 * nothing. *Answered by* is a person on the firm's own list, or a name typed in. The page's act
 * posts `{ kind: 'intake', answers, by }`.
 */
const DRAFT_KEY = 'legalPortal.intakeDraft'

function readDraft(): LegalFirmIntake | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    return raw ? shapeLegalFirmIntake(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

const btn: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 5, border: `1px solid ${COPPER}`, color: COPPER, background: CARD, cursor: 'pointer', font: 'inherit' }
const input: CSSProperties = { font: 'inherit', fontSize: 13.5, padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 4, background: 'var(--surface)', color: INK, width: '100%' }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, color: COPPER, fontWeight: 600, cursor: 'pointer', font: 'inherit' }

export default function LegalPortalIntakeForm({ short, intake, recipients, recordedById, busy, notice, onSend, onOpenRules, onOpenNotifications }: {
  short: string
  intake: LegalPortalIntake
  recipients: ReadonlyArray<LegalPortalRecipient>
  /** The person picked on this browser for the firm's acts, if any. */
  recordedById: string
  busy: boolean
  notice: string | null
  onSend: (answers: LegalFirmIntake, by: string) => Promise<boolean>
  onOpenRules: () => void
  onOpenNotifications: () => void
}) {
  const [draft, setDraft] = useState<LegalFirmIntake>(() => readDraft() ?? intake.answers ?? EMPTY_LEGAL_FIRM_INTAKE)
  const picked = recipients.find((r) => r.id === recordedById)
  const [by, setBy] = useState(() => picked?.name ?? intake.sentBy ?? '')
  const [sentHere, setSentHere] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* a private window: the draft lasts this visit */
    }
  }, [draft])

  const set = (patch: Partial<LegalFirmIntake>) => {
    setSentHere(false)
    setDraft((d) => ({ ...d, ...patch }))
  }
  const send = async () => {
    const who = by.trim()
    if (!who) return
    if (await onSend(shapeLegalFirmIntake(draft), who)) {
      setSentHere(true)
      try {
        window.localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* nothing to clear */
      }
    }
  }
  const sentWords = legalIntakeSentWords(intake.sentAt, intake.sentBy)
  const lab: CSSProperties = { display: 'grid', gap: 5, fontSize: 13.5, marginTop: 14 }

  return (
    <div data-legal-intake-form>
      <div style={{ fontSize: 13.5, color: MUTED }}>{legalIntakeIntro(short)}</div>
      {legalIntakeQuestions(short).map((q) => {
        if (q.key === 'rulesNote' && draft.rules !== 'changes') return null
        if (q.kind === 'choice') {
          return (
            <div key={q.key} style={lab} data-intake-question={q.key}>
              <b style={{ fontWeight: 600 }}>{q.label}</b>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span role="group" aria-label={q.label} style={{ display: 'inline-flex', border: `1px solid ${HAIR}`, borderRadius: 999, overflow: 'hidden', fontSize: portalSmall(12), fontWeight: 700 }}>
                  {q.choices.map(([value, words]) => {
                    const on = draft[q.key] === value
                    return (
                      <button key={value} type="button" aria-pressed={on} onClick={() => set({ [q.key]: on ? '' : value } as Partial<LegalFirmIntake>)} style={{ font: 'inherit', padding: '4px 12px', border: 'none', cursor: 'pointer', background: on ? COPPER : 'transparent', color: on ? '#fff' : MUTED, fontWeight: 700 }}>
                        {words}
                      </button>
                    )
                  })}
                </span>
                {q.key === 'rules' ? <button type="button" onClick={onOpenRules} style={{ ...link, fontSize: portalSmall(12.5) }}>Read them ›</button> : null}
              </span>
            </div>
          )
        }
        return (
          <label key={q.key} style={lab} data-intake-question={q.key}>
            <b style={{ fontWeight: 600 }}>{q.label}</b>
            {q.kind === 'text' ? (
              <textarea value={draft[q.key]} onChange={(e) => set({ [q.key]: e.target.value } as Partial<LegalFirmIntake>)} placeholder={q.placeholder} rows={3} style={{ ...input, resize: 'vertical' }} />
            ) : (
              <input value={draft[q.key]} onChange={(e) => set({ [q.key]: e.target.value } as Partial<LegalFirmIntake>)} placeholder={q.placeholder} style={input} />
            )}
          </label>
        )
      })}
      <div style={{ ...lab, gap: 3 }}>
        <b style={{ fontWeight: 600 }}>Who at your firm gets the link and the emails?</b>
        <span style={{ color: MUTED, fontSize: 13 }}>
          Add them on <button type="button" onClick={onOpenNotifications} style={link}>Notifications ›</button>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: MUTED, flex: '1 1 240px' }}>
          Answered by
          {recipients.length ? (
            <select value={recipients.some((r) => r.name === by) ? by : ''} onChange={(e) => setBy(e.target.value)} style={{ ...input, width: 'auto', flex: 1 }} aria-label="Answered by">
              <option value="">Pick a person</option>
              {recipients.map((r) => <option key={r.id} value={r.name}>{r.name}{r.role ? ` · ${r.role}` : ''}</option>)}
            </select>
          ) : (
            <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" aria-label="Answered by" style={{ ...input, flex: 1 }} />
          )}
        </label>
        <button type="button" onClick={() => void send()} disabled={busy || !by.trim()} style={{ ...btn, background: COPPER, color: '#fff', opacity: busy || !by.trim() ? 0.6 : 1 }} data-legal-intake-send>
          Send to {short}
        </button>
      </div>
      {sentHere && notice ? <div role="status" style={{ fontSize: 12.5, marginTop: 10, color: INK }}>{notice}</div> : null}
      {sentWords ? (
        <div data-legal-intake-sent style={{ fontSize: 12.5, marginTop: 10, color: MUTED }}>
          <b style={{ color: PAPER_GREEN }}>{sentWords}</b> Change an answer and send again.
        </div>
      ) : <div style={{ fontSize: portalSmall(12), marginTop: 10, color: FAINT }}>Nothing sent yet.</div>}
    </div>
  )
}
