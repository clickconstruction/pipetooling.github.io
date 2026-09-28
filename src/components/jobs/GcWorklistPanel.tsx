import type { CSSProperties } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { GC_ROUND_THRESHOLD, sendChannelLabel } from '../../lib/jobs/gcStatementRounds'
import { worklistGroupTitle, type GcWorklist, type GcWorklistGroup, type GcWorklistRow } from '../../lib/jobs/gcWorklist'

export type GcWorklistLastWord = { temperature: string | null; at: string | null; by: string; note: string | null }

type Props = {
  worklist: GcWorklist
  /** The signed-in user — their own accounts read "Your accounts". */
  authUserId: string | null
  userNameById: (id: string | null) => string
  /** Office roles act; everyone else reads. */
  canAct: boolean
  busy: boolean
  error: string | null
  /** The newest read on record per GC, for the row's second line. */
  lastWordByGc: ReadonlyMap<string, GcWorklistLastWord>
  /** People who may be a GC's account man. */
  assignableUsers: ReadonlyArray<{ id: string; name: string }>
  assigningGcId: string | null
  onStartAssign: (gcId: string) => void
  onAssign: (gcId: string, userId: string | null) => void
  onCancelAssign: () => void
  onCheck: (row: GcWorklistRow) => void
  onSend: (row: GcWorklistRow) => void
  /** Record a statement that went out another way — a text, their own inbox, in person. */
  onMarkSent: (row: GcWorklistRow) => void
  onWord: (row: GcWorklistRow) => void
  onUndoMark: (row: GcWorklistRow) => void
  onOpenHistory: (row: GcWorklistRow) => void
}

const pillBase: CSSProperties = {
  font: 'inherit',
  fontSize: '0.6875rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  borderRadius: 9999,
  padding: '0.12rem 0.6rem',
  border: '1px solid var(--border-strong)',
  background: 'transparent',
  color: 'var(--text-muted)',
}
const pillDone: CSSProperties = { ...pillBase, border: '1px solid var(--text-green-600)', background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }
const pillNext: CSSProperties = { ...pillBase, border: '1px solid #2563eb', background: '#2563eb', color: '#ffffff', cursor: 'pointer' }
const pillOpen: CSSProperties = { ...pillBase, cursor: 'pointer', color: 'var(--text-700)' }
const pillWarn: CSSProperties = { ...pillBase, border: '1px solid #f59e0b', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', cursor: 'pointer' }
const linkStyle: CSSProperties = { font: 'inherit', fontSize: '0.7rem', border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer' }

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short' })
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * The week's GCs as one worklist (the panel that replaced Weekly statement
 * rounds): every GC is the office's to work, whoever knows the account. Each
 * step opens the window that already does it — Certify, Draft Message, the
 * mark form. Presentational: the modal owns the data and the writes.
 */
export default function GcWorklistPanel({
  worklist,
  authUserId,
  userNameById,
  canAct,
  busy,
  error,
  lastWordByGc,
  assignableUsers,
  assigningGcId,
  onStartAssign,
  onAssign,
  onCancelAssign,
  onCheck,
  onSend,
  onMarkSent,
  onWord,
  onUndoMark,
  onOpenHistory,
}: Props) {
  if (worklist.groups.length === 0) return null

  const groupTitle = (g: GcWorklistGroup) => worklistGroupTitle(g, userNameById(g.ownerUserId), g.ownerUserId != null && g.ownerUserId === authUserId)

  const checkStep = (r: GcWorklistRow) => {
    if (r.checked === 'done') return <span style={pillDone} title="The bills were checked and signed off this week">✓ Checked</span>
    if (!canAct) return <span style={pillBase}>{r.checked === 'changed' ? 'Changed' : 'Check'}</span>
    if (r.checked === 'changed') {
      return (
        <button type="button" onClick={() => onCheck(r)} style={pillWarn} title={`A bill landed or a payment posted after ${r.gcName} was checked — check it again`}>
          Re-check
        </button>
      )
    }
    return (
      <button type="button" onClick={() => onCheck(r)} style={r.next === 'check' ? pillNext : pillOpen} title={`Check each of ${r.gcName}’s bills and sign off`}>
        Check
      </button>
    )
  }

  const sendStep = (r: GcWorklistRow) => {
    if (r.sent) {
      const how = r.mark?.action === 'sent' ? ` ${shortDay(r.mark.acted_at)} · ${sendChannelLabel(r.mark.channel).toLowerCase()}` : ''
      return (
        <button type="button" onClick={() => onOpenHistory(r)} style={{ ...pillDone, cursor: 'pointer' }} title={`See every statement sent to ${r.gcName}`}>
          ✓ Sent{how}
        </button>
      )
    }
    if (!canAct) return <span style={pillBase}>Send</span>
    if (r.checked !== 'done') {
      return (
        <span style={{ ...pillBase, opacity: 0.6 }} title="Check the bills first — a statement never goes out unchecked">
          Send
        </span>
      )
    }
    return (
      <button type="button" onClick={() => onSend(r)} style={pillNext} title={`Draft ${r.gcName}’s statement — nothing sends until you press Send statement`}>
        Send
      </button>
    )
  }

  const wordStep = (r: GcWorklistRow) => {
    if (r.word) {
      const t = r.mark?.temperature
      return (
        <button type="button" onClick={() => onOpenHistory(r)} style={{ ...pillDone, cursor: 'pointer' }} title={r.mark?.note?.trim() || 'The word is in for this week'}>
          ✓ {t ? `${t}` : 'Word'}
        </button>
      )
    }
    if (!canAct) return <span style={pillBase}>Word</span>
    return (
      <button
        type="button"
        onClick={() => onWord(r)}
        style={r.next === 'word' ? pillNext : pillOpen}
        title={r.overLine ? `Write down where ${r.gcName} stands — their temperature, a sentence, the date they said they’d pay` : `Optional under the line — write down where ${r.gcName} stands`}
      >
        Word
      </button>
    )
  }

  return (
    <div style={{ margin: '0 auto 1rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>This week’s GCs</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>check the bills · send the statement · write down the word</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {worklist.counts.done} of {worklist.counts.gcs} done
        </span>
      </div>
      {worklist.groups.map((g) => (
        <div key={g.key} style={{ marginTop: '0.6rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.4rem',
              flexWrap: 'wrap',
              padding: '0.3rem 0.55rem',
              borderRadius: 6,
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              fontSize: '0.8125rem',
            }}
          >
            <b>{groupTitle(g)}</b>
            <span style={{ color: 'var(--text-muted)' }}>
              · {g.rows.length} GC{g.rows.length === 1 ? '' : 's'} · ${formatCurrency(g.total)}
            </span>
            {g.kind === 'under_line' ? <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· check and send; the word is optional</span> : null}
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: g.open === 0 ? 'var(--text-green-800)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {g.open === 0 ? 'all done ✓' : `${g.open} to do`}
            </span>
          </div>
          {g.rows.map((r) => {
            const last = lastWordByGc.get(r.gcId)
            return (
              <div
                key={r.gcId}
                data-testid="gc-worklist-row"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.4rem 0.15rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}
              >
                <span style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <b>{r.gcName}</b>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ${formatCurrency(r.amount)}
                    {r.oldestAgeDays != null ? ` · oldest ${r.oldestAgeDays}d` : ''}
                    {last?.temperature && last.at ? ` · last word ${last.temperature}, ${shortDate(last.at)}${last.by ? ` · ${last.by.split(/\s+/)[0]}` : ''}` : r.overLine ? ' · no word yet' : ''}
                    {g.kind !== 'under_line' ? (
                      assigningGcId === r.gcId ? (
                        <select
                          autoFocus
                          aria-label={`Account man for ${r.gcName}`}
                          defaultValue={r.ownerUserId ?? ''}
                          onChange={(e) => onAssign(r.gcId, e.target.value || null)}
                          onBlur={onCancelAssign}
                          style={{ marginLeft: '0.4rem', font: 'inherit', fontSize: '0.75rem', padding: '0.1rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'inherit' }}
                        >
                          <option value="">nobody</option>
                          {assignableUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      ) : canAct ? (
                        <>
                          {' · '}
                          <button type="button" onClick={() => onStartAssign(r.gcId)} style={linkStyle} title={`Change who knows the ${r.gcName} account`}>
                            {r.ownerUserId ? 'change account man' : 'pick an account man'}
                          </button>
                        </>
                      ) : null
                    ) : null}
                    {r.mark && canAct ? (
                      <>
                        {' · '}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onUndoMark(r)}
                          style={linkStyle}
                          title={`Clear this week’s mark for ${r.gcName} — the statement and the word both go back to “to do”`}
                        >
                          undo
                        </button>
                      </>
                    ) : null}
                  </span>
                </span>
                {r.skipped ? (
                  <span style={pillBase}>skipped this week</span>
                ) : (
                  <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {checkStep(r)}
                    {sendStep(r)}
                    {wordStep(r)}
                    {canAct && !r.sent && r.checked === 'done' ? (
                      <button type="button" onClick={() => onMarkSent(r)} style={linkStyle} title="It went out another way — a text, your own inbox, in person">
                        or mark sent
                      </button>
                    ) : null}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
      <p style={{ margin: '0.45rem 0 0', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        A statement never goes out unchecked — a group that changes after sign-off asks for a re-check. GCs are grouped by the
        account man who knows them, so one call covers the group. Under ${GC_ROUND_THRESHOLD.toLocaleString('en-US')} the word is optional.
      </p>
      {error ? <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: 'var(--text-red-700)' }}>{error}</p> : null}
    </div>
  )
}
