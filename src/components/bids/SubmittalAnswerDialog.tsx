/**
 * Their answer on one submittal row, in a window of its own (Submittals stage 5b, 2026-10-02):
 * who answered, the day, then one line per part the GC sees with its own Approved / Revise /
 * Rejected and its own note. One Save records every line that changed. Opened from the row's
 * Their answer button, and from the row editor.
 *
 * It only writes records: nobody is emailed or contacted, and the window says so. The window is
 * held to the screen's height; the title and the buttons are pinned and the lines scroll.
 */
import { useMemo, useState, type CSSProperties } from 'react'

import { answerLines, answerNeedsReviewer, answerSaveLabel, answerSummary, answerWrites, approveOpenLines, clearLines, initialAnswerDrafts, tapAnswer, type AnswerDrafts, type AnswerWrites } from '../../lib/submittals/answerEntry'
import { ENTERED_ON_MIN, enteredOnProblem } from '../../lib/submittals/enteredDecisions'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'
import { DECISION_LABELS } from '../../lib/submittals/reviewDecisions'
import { initialReviewerPick, NO_REVIEWER_SOURCES, reviewerChoiceFrom, reviewerPickBad, type ReviewerChoice, type ReviewerPick, type ReviewerSources } from '../../lib/submittals/reviewerPick'
import type { ReviewDecision, SubmittalItemRow } from '../../lib/submittals/submittalRevision'
import type { SubmittalPersonRow } from '../../lib/submittals/submittalRoom'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { SubmittalReviewerPicker } from './SubmittalReviewerPicker'

/** What Save hands the tab: who answered (none when answers are only taken back), the day when it is not today, and the lines that changed. */
export type AnswerSave = { person: ReviewerChoice | null; on?: string; writes: AnswerWrites }

const Z = 10060
const DECISIONS: ReviewDecision[] = ['approved', 'revise', 'rejected']
const ON_COLOR: Record<ReviewDecision, string> = { approved: '#1f7a3a', revise: '#b0662f', rejected: '#b42318' }
const TINT: Record<ReviewDecision, string> = { approved: 'var(--bg-green-tint)', revise: 'var(--bg-amber-tint)', rejected: 'var(--bg-red-tint)' }
const fieldLabel: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const inputStyle: CSSProperties = { padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, font: 'inherit', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0 }
const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const quietBtn: CSSProperties = { padding: '0.2rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.75rem', cursor: 'pointer' }

export function SubmittalAnswerDialog({ item, parts = [], people = [], sources = NO_REVIEWER_SOURCES, revLabel, busy = false, onSave, onClose }: {
  item: SubmittalItemRow
  /** the row's parts; the ones the GC sees each get a line */
  parts?: ReadonlyArray<SubmittalPartRow>
  people?: ReadonlyArray<SubmittalPersonRow>
  /** the bid's GC and its contacts on file */
  sources?: ReviewerSources
  /** "Rev 1" */
  revLabel: string
  busy?: boolean
  onSave: (save: AnswerSave) => void
  onClose: () => void
}) {
  const lines = useMemo(() => answerLines(item, parts), [item, parts])
  const [drafts, setDrafts] = useState<AnswerDrafts>(() => initialAnswerDrafts(lines))
  const [pick, setPick] = useState<ReviewerPick>(() => initialReviewerPick(people, sources))
  const today = todayYmdInAppTz()
  const [on, setOn] = useState(today)
  const writes = answerWrites(lines, drafts)
  const summary = answerSummary(lines, drafts)
  const needsWho = answerNeedsReviewer(writes)
  const pickBad = needsWho && reviewerPickBad(pick)
  const onProblem = needsWho ? enteredOnProblem(on, today) : null
  const bad = writes.changed === 0 || pickBad || onProblem != null
  const tag = item.tag.trim() || 'Accessory'
  const byParts = lines.some((l) => l.partId != null)
  const setNote = (key: string, note: string) => setDrafts((cur) => ({ ...cur, [key]: { decision: cur[key]?.decision ?? null, note } }))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: Z, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))' }} role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={`Their answer on ${tag}`} style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 720, width: '100%', maxHeight: '100%', minHeight: 0, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', padding: '1.1rem 1.25rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>{tag} · what did they say?</h3>
          <p style={{ margin: '0.25rem 0 0', ...smallMuted }} data-testid="answer-scope">
            {revLabel} · {byParts ? `${lines.length} part${lines.length === 1 ? '' : 's'} the GC sees` : 'one product'}
          </p>
        </div>

        {/* The lines scroll; the title above and the buttons below hold still. */}
        <div data-testid="answer-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', margin: '0 -1.25rem', padding: '0.15rem 1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <span style={fieldLabel}>Who answered</span>
            <SubmittalReviewerPicker people={people} value={pick} onChange={setPick} sources={sources} />
            {pickBad ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)' }} data-testid="answer-who-problem">{pick.name.trim() ? 'That email does not read as an email. Fix it or leave it out.' : 'Type their name, so the record says who answered.'}</span> : null}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignSelf: 'flex-start' }}>
            <span style={fieldLabel}>The day they answered</span>
            <input type="date" aria-label="The day they answered" title="It dates each answer and the procurement log's Released." value={on} min={ENTERED_ON_MIN} max={today} onChange={(e) => setOn(e.target.value)} style={{ ...inputStyle, borderColor: onProblem ? '#dc2626' : 'var(--border-strong)' }} />
          </label>
          {onProblem ? <span style={{ ...smallMuted, color: 'var(--text-amber-700)' }}>{onProblem}</span> : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={fieldLabel}>{byParts ? 'Each part' : 'Their answer'}</span>
              {lines.length > 1 ? (
                <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
                  <button type="button" onClick={() => setDrafts((cur) => approveOpenLines(lines, cur))} style={quietBtn} title="Every part with no answer picked reads Approved. A part that has one keeps it." data-testid="answer-all-approved">All approved</button>
                  <button type="button" onClick={() => setDrafts((cur) => clearLines(lines, cur))} style={quietBtn} title="Empties every answer the office entered. An answer they gave on the room stays." data-testid="answer-clear-all">Clear all</button>
                </span>
              ) : null}
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {lines.map((l, i) => {
                const d = drafts[l.key] ?? { decision: l.current, note: l.currentNote }
                const showNote = d.decision === 'revise' || d.decision === 'rejected' || d.note.trim() !== ''
                return (
                  <div key={l.key} data-testid="answer-line" data-answer={d.decision ?? ''} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem', alignItems: 'center', padding: '0.5rem 0.6rem', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: d.decision ? TINT[d.decision] : 'var(--surface)' }}>
                    <div style={{ flex: '1 1 14rem', minWidth: 0, fontSize: '0.8125rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{l.head}</span>
                      {l.words ? <span style={{ ...smallMuted, display: 'block', overflowWrap: 'anywhere' }}>{l.words}</span> : null}
                      {l.current ? (
                        <span style={{ ...smallMuted, display: 'block' }}>
                          now {DECISION_LABELS[l.current]}{l.currentBy ? ` · ${l.currentBy}` : ''}{l.canClear ? '' : ' · their own call, it can be changed but not emptied'}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }} role="group" aria-label={`Their answer on ${l.head}`}>
                      {DECISIONS.map((k) => {
                        const isOn = d.decision === k
                        return (
                          <button key={k} type="button" aria-pressed={isOn} onClick={() => setDrafts((cur) => tapAnswer(l, cur, k))} style={{ padding: '0.35rem 0.7rem', border: 'none', font: 'inherit', fontSize: '0.8125rem', fontWeight: isOn ? 700 : 500, cursor: 'pointer', background: isOn ? ON_COLOR[k] : 'var(--surface)', color: isOn ? 'white' : 'var(--text-muted)' }}>
                            {DECISION_LABELS[k]}
                          </button>
                        )
                      })}
                    </div>
                    {showNote ? (
                      <input type="text" aria-label={`Their note on ${l.head}`} placeholder={d.decision === 'approved' ? 'their note, if any' : 'what they need instead'} value={d.note} maxLength={500} onChange={(e) => setNote(l.key, e.target.value)} style={{ ...inputStyle, flex: '1 1 100%' }} />
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', flexShrink: 0 }}>
          <span style={{ ...smallMuted, minWidth: 0 }} data-testid="answer-summary">
            {summary.words ? <b style={{ color: 'var(--text-strong)' }}>{summary.words}</b> : 'No answer picked yet.'}
            {summary.words ? (summary.open > 0 ? ` · ${summary.open} still open` : byParts ? ' · every part answered' : '') : byParts ? ' Tap an answer on a part.' : ' Tap their answer.'}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.45rem 0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
              Cancel
            </button>
            <button
              type="button"
              disabled={bad || busy}
              data-testid="answer-save"
              onClick={() => onSave({ person: needsWho ? reviewerChoiceFrom(pick, sources) : null, ...(needsWho && on && on !== today ? { on } : {}), writes })}
              style={{ padding: '0.45rem 0.9rem', background: bad || busy ? 'var(--bg-200)' : '#16a34a', color: bad || busy ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: bad || busy ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
            >
              {answerSaveLabel(writes)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
