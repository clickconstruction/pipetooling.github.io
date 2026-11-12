/**
 * The Case view of a person's HR file (punch list #315, upgrade 2): the open items of a case, each numbered by the
 * file, the closed ones folded under them, and the case's log, newest first. Until now these were prose in the
 * *Agent notes* document, and two sessions on one file took the same item number. Here the database hands out the
 * number, every change to an item writes its own line of the log, and an agent adds through the dev seat's
 * `plan_case` what a dev adds here by hand. Every write goes through `dev_case_write`; the words come from
 * `lib/people/personCase.ts`.
 */
import { useState, type CSSProperties } from 'react'
import { EmptyState } from '../../EmptyState'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { amendmentDayLabel } from '../../../lib/people/personAmendments'
import {
  CASE_LINE_MAX,
  CASE_TITLE_MAX,
  CASE_WHY_MAX,
  caseAddChange,
  caseCloseProblem,
  caseItemCounts,
  caseItemDraftProblem,
  caseItemLabel,
  caseItemNote,
  caseLogNewestFirst,
  caseStandingWords,
  caseWritePayload,
  sortCaseItems,
  type CaseItemChange,
  type PersonCaseItem,
  type PersonCaseLogLine,
} from '../../../lib/people/personCase'
import { writePersonCase } from '../../../lib/people/personCaseIo'

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0.9rem' }
const FIELD: CSSProperties = { padding: '0.35rem 0.55rem', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: '0.82rem', background: 'var(--bg-page)', color: 'var(--text-base)', font: 'inherit', boxSizing: 'border-box' }
const HEAD: CSSProperties = { margin: '0 0 0.45rem', fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-faint)', fontWeight: 700 }
const NUMBER: CSSProperties = { display: 'inline-block', padding: '0.05rem 0.45rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', whiteSpace: 'nowrap' }

const press = (primary: boolean, dead = false): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.76rem',
  fontWeight: 650,
  padding: '0.25rem 0.65rem',
  borderRadius: 6,
  border: primary ? 'none' : '1px solid var(--border)',
  background: primary ? (dead ? DEAD_PRESS_FILL : '#2563eb') : 'transparent',
  color: primary ? (dead ? DEAD_PRESS_TEXT : '#fff') : 'var(--text-link)',
  cursor: dead ? 'default' : 'pointer',
})

function dayOf(iso: string | null): string {
  return iso ? amendmentDayLabel(calendarYmdInAppTzFromIso(iso)) : ''
}

export function PersonCaseView({
  personId,
  canWrite,
  items,
  log,
  heldWhy,
  onChanged,
  showToast,
}: {
  personId: string
  canWrite: boolean
  items: ReadonlyArray<PersonCaseItem>
  log: ReadonlyArray<PersonCaseLogLine>
  heldWhy: string | null
  onChanged: () => void | Promise<void>
  showToast: (message: string, kind: 'success' | 'error') => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', detail: '', owner: '', itemNo: '' })
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  /** The item whose inline form is open, and which form: closing it or handing it over. */
  const [acting, setActing] = useState<{ itemNo: number; what: 'close' | 'hand' } | null>(null)
  const [why, setWhy] = useState('')
  const [closeAs, setCloseAs] = useState<'done' | 'dropped'>('done')
  const [owner, setOwner] = useState('')
  const [line, setLine] = useState('')

  const { open, closed } = sortCaseItems(items)
  const counts = caseItemCounts(items)
  const lines = caseLogNewestFirst(log)
  const draftProblem = caseItemDraftProblem(draft)

  const write = async (input: { items?: CaseItemChange[]; log?: string[] }, done: string): Promise<boolean> => {
    if (busy) return false
    setBusy(true)
    const r = await writePersonCase(caseWritePayload({ personId, items: input.items, log: input.log }))
    setBusy(false)
    if (!r.ok) {
      showToast(`Not written: ${r.why}`, 'error')
      return false
    }
    showToast(done, 'success')
    await onChanged()
    return true
  }

  const addItem = async () => {
    setTried(true)
    if (draftProblem) return
    const ok = await write({ items: [caseAddChange(draft)] }, 'The item is on the case, with its number.')
    if (!ok) return
    setDraft({ title: '', detail: '', owner: '', itemNo: '' })
    setTried(false)
    setAdding(false)
  }

  const closeItem = async (itemNo: number) => {
    if (caseCloseProblem(why)) return
    const ok = await write({ items: [{ item_no: itemNo, close: { why: why.trim(), state: closeAs } }] }, `${caseItemLabel(itemNo)} is ${closeAs}. The log says why.`)
    if (ok) setActing(null)
  }

  const handOver = async (itemNo: number) => {
    const ok = await write({ items: [{ item_no: itemNo, set: { owner: owner.trim() } }] }, owner.trim() ? `${caseItemLabel(itemNo)} is with ${owner.trim()}.` : `${caseItemLabel(itemNo)} is with nobody now.`)
    if (ok) setActing(null)
  }

  const reopen = (itemNo: number) => void write({ items: [{ item_no: itemNo, reopen: true }] }, `${caseItemLabel(itemNo)} is open again.`)

  const addLine = async () => {
    const words = line.trim()
    if (words === '') return
    const ok = await write({ log: [words] }, 'The line is on the log.')
    if (ok) setLine('')
  }

  if (heldWhy) {
    return (
      <p role="alert" style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }} data-testid="case-held">
        The case's items and log could not be read: {heldWhy}
      </p>
    )
  }

  return (
    <div style={{ maxWidth: '88ch' }} data-testid="person-case-view">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.7rem' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {caseStandingWords(counts)}. The file numbers each item, so two people never take the same number.
        </span>
        {canWrite && !adding ? (
          <button type="button" onClick={() => setAdding(true)} style={{ ...press(true), marginLeft: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>
            + Add an item
          </button>
        ) : null}
      </div>

      {canWrite && adding ? (
        <div style={{ ...CARD, marginBottom: '0.9rem', display: 'grid', gap: '0.45rem' }} data-testid="case-add-item">
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={CASE_TITLE_MAX} placeholder="What the item is" aria-label="What the item is" autoFocus style={{ ...FIELD, width: '100%' }} />
          <textarea value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} rows={2} placeholder="Detail, if it needs any" aria-label="Detail" style={{ ...FIELD, width: '100%', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} maxLength={120} placeholder="Who has it" aria-label="Who has it" style={{ ...FIELD, flex: '1 1 12rem', minWidth: 0 }} />
            <input value={draft.itemNo} onChange={(e) => setDraft({ ...draft, itemNo: e.target.value })} inputMode="numeric" placeholder="Its number, if it has one" aria-label="Its number, if it already has one" style={{ ...FIELD, flex: '0 1 13rem', minWidth: 0 }} />
          </div>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-faint)' }}>Leave the number empty and the file gives the next one. Type one only for an item people already call by a number.</p>
          {tried && draftProblem ? (
            <p role="alert" style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-red-600)' }}>
              {draftProblem}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" disabled={busy || draft.title.trim() === ''} onClick={() => void addItem()} style={press(true, busy || draft.title.trim() === '')}>
              Add the item
            </button>
            <button type="button" onClick={() => { setAdding(false); setTried(false) }} style={press(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <section aria-label="Open items">
        <h4 style={HEAD}>Open</h4>
        {open.length === 0 ? (
          <div style={CARD}>
            <EmptyState compact main="Nothing open on this case." {...(canWrite ? { next: { label: '+ Add an item', onPress: () => setAdding(true) }, tail: 'opens one, and the file numbers it.' } : {})} />
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.45rem' }}>
            {open.map((i) => {
              const mine = acting?.itemNo === i.item_no ? acting.what : null
              const closeProblem = caseCloseProblem(why)
              return (
                <li key={i.id} style={CARD} data-case-item={i.item_no}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={NUMBER}>{caseItemLabel(i.item_no)}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>{i.title}</span>
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{caseItemNote(i)}</span>
                  </div>
                  {i.detail ? <div style={{ fontSize: '0.84rem', color: 'var(--text-base)', marginTop: '0.25rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{i.detail}</div> : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                    <span>
                      opened {dayOf(i.opened_at)}
                      {i.author_label ? ` by ${i.author_label}` : ''}
                    </span>
                    {canWrite ? (
                      <>
                        <button type="button" aria-label={`Close ${caseItemLabel(i.item_no)}`} onClick={() => { setActing(mine === 'close' ? null : { itemNo: i.item_no, what: 'close' }); setWhy(''); setCloseAs('done') }} style={press(false)}>
                          Close…
                        </button>
                        <button type="button" aria-label={`Hand ${caseItemLabel(i.item_no)} over`} onClick={() => { setActing(mine === 'hand' ? null : { itemNo: i.item_no, what: 'hand' }); setOwner(i.owner_label) }} style={press(false)}>
                          Hand over…
                        </button>
                      </>
                    ) : null}
                  </div>
                  {mine === 'close' ? (
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.45rem' }}>
                      <select value={closeAs} onChange={(e) => setCloseAs(e.target.value === 'dropped' ? 'dropped' : 'done')} aria-label="How it closes" style={FIELD}>
                        <option value="done">Done</option>
                        <option value="dropped">Dropped</option>
                      </select>
                      <input value={why} onChange={(e) => setWhy(e.target.value)} maxLength={CASE_WHY_MAX} placeholder="Why it closes" aria-label="Why it closes" style={{ ...FIELD, flex: '1 1 16rem', minWidth: 0 }} />
                      <button type="button" disabled={busy || closeProblem !== null} onClick={() => void closeItem(i.item_no)} style={press(true, busy || closeProblem !== null)}>
                        Close {caseItemLabel(i.item_no).toLowerCase()}
                      </button>
                    </div>
                  ) : null}
                  {mine === 'hand' ? (
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.45rem' }}>
                      <input value={owner} onChange={(e) => setOwner(e.target.value)} maxLength={120} placeholder="Who has it now" aria-label="Who has it now" style={{ ...FIELD, flex: '1 1 16rem', minWidth: 0 }} />
                      <button type="button" disabled={busy || owner.trim() === i.owner_label.trim()} onClick={() => void handOver(i.item_no)} style={press(true, busy || owner.trim() === i.owner_label.trim())}>
                        Hand it over
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {closed.length > 0 ? (
        <details style={{ marginTop: '0.9rem' }} data-testid="case-closed">
          <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {closed.length} closed
          </summary>
          <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, display: 'grid', gap: '0.35rem' }}>
            {closed.map((i) => (
              <li key={i.id} style={{ ...CARD, opacity: 0.85 }} data-case-item={i.item_no}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ ...NUMBER, background: 'var(--bg-200)', color: 'var(--text-700)' }}>{caseItemLabel(i.item_no)}</span>
                  <span style={{ fontSize: '0.86rem', color: 'var(--text-base)', overflowWrap: 'anywhere' }}>{i.title}</span>
                  {canWrite ? (
                    <button type="button" aria-label={`Open ${caseItemLabel(i.item_no)} again`} disabled={busy} onClick={() => reopen(i.item_no)} style={{ ...press(false), marginLeft: 'auto' }}>
                      Open again
                    </button>
                  ) : null}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {caseItemNote(i)}
                  {i.closed_at ? ` · ${dayOf(i.closed_at)}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <section aria-label="The log" style={{ marginTop: '1.2rem' }}>
        <h4 style={HEAD}>Log</h4>
        {canWrite ? (
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
            <input value={line} onChange={(e) => setLine(e.target.value)} maxLength={CASE_LINE_MAX} placeholder="What was done, in one line" aria-label="A line for the log" style={{ ...FIELD, flex: '1 1 20rem', minWidth: 0 }} />
            <button type="button" disabled={busy || line.trim() === ''} onClick={() => void addLine()} style={press(true, busy || line.trim() === '')}>
              Add the line
            </button>
          </div>
        ) : null}
        {lines.length === 0 ? (
          <div style={CARD}>
            <EmptyState compact main="Nothing on the log yet." tail="Every change to an item writes a line here." />
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="case-log">
            {lines.map((l) => (
              <li key={l.id} style={{ display: 'grid', gridTemplateColumns: '6.4rem 1fr', gap: '0.6rem', padding: '0.4rem 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', paddingTop: 2 }}>{dayOf(l.logged_at)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-base)', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{l.line}</span>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.1rem' }}>{[l.author_label, l.session_label].filter(Boolean).join(', ')}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
