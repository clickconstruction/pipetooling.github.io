import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { physicalInboxNextLine } from '../../lib/quickfill/nextLine'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import { useEstimatorTaskModal } from '../../contexts/EstimatorTaskModalContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { formatErrorMessage } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { supabaseOfficeInboxIo, useOfficeInboxPapers, type OfficeInboxIo, type PressExtra } from '../../hooks/useOfficeInboxPapers'
import { ErrorDoorButton, ErrorDoorCard } from '../help/ErrorDoor'
import { errorFamilyOf } from '../../lib/help/errorGuides'
import { SKY_UNDER_WORDS } from '../../lib/skyUnderWords'
import { OFFLINE_ERROR_MESSAGE, isNetworkFetchErrorMessage } from '../../lib/networkErrorMessage'
import {
  decidedCounts,
  deckRows,
  FILE_PLACE_SUGGESTIONS,
  markAutoNote,
  routineRows,
  normalizeCameOn,
  normalizePaperTitle,
  outcomeWords,
  PHYSICAL_INBOX_DEFAULT_DOOR,
  PHYSICAL_INBOX_SECTION_ID,
  shortDay,
  somedayRows,
  undecidedSummary,
  undecidedWords,
  waitingRows,
  WAITING_DEFAULT_DAYS,
  ymdAddDays,
  type DeckRow,
  type InboxPaper,
  type InboxPaperOutcome,
  type PaperPress,
} from '../../lib/quickfill/physicalInbox'

/**
 * Quickfill → Physical inbox as a clarify deck (punch list #158, v2.5818): the tray on the
 * assistant's desk in GTD's shape. A paper that takes two minutes is done and never typed.
 * Anything else is typed once with the day it came, and leaves the deck on one press:
 * Done · Trash · File it (where) · Task (the header's Task window with the title filled in)
 * · Ask (dispatch or estimating, the request window the same way). The station's count is
 * the undecided paper, oldest first with its age; the wrapper's Mark snapshots it. A press
 * leaves a line with Undo for the visit. Since v2.5821 two more presses and two folds: Waiting
 * for (whom, and a day to check) and Someday park the paper under the deck, out of the count,
 * each with Done and Still here. Since v2.5825 **Comes back** opens the Task window on repeat
 * with the title filled in, so a kind of paper that arrives every month becomes a repeating
 * Checklist task and stops arriving; the tray's routines are listed under the folds with how
 * they repeat, who has them and the next day, each editable in Checklist → Manage. The Mark
 * writes the day in words as its note (`markAutoNote`), so the history reads what was decided.
 * The add line takes the day the paper came (`normalizeCameOn`), today unless it says otherwise.
 */

type DecidedLine = { paper: InboxPaper; outcome: InboxPaperOutcome; detail: string | null }

const introStyle: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-slate-600)', margin: '0 0 0.6rem', lineHeight: 1.45 }
const lineStyle: CSSProperties = { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-700)', margin: '0.5rem 0 0.4rem', fontVariantNumeric: 'tabular-nums' }
const cardStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.55rem 0.8rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', minWidth: 0 }
const pressStyle = (busy: boolean, tone: 'plain' | 'blue' | 'sky' | 'violet' = 'plain'): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.78125rem',
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 6,
  border: `1px solid ${tone === 'plain' ? 'var(--border-strong)' : tone === 'blue' ? '#3b82f6' : tone === 'sky' ? SKY_UNDER_WORDS : '#7c3aed'}`,
  background: tone === 'plain' ? 'var(--surface)' : tone === 'blue' ? '#3b82f6' : tone === 'sky' ? SKY_UNDER_WORDS : '#7c3aed',
  color: tone === 'plain' ? 'var(--text-700)' : '#fff',
  cursor: busy ? 'not-allowed' : 'pointer',
  opacity: busy ? 0.6 : 1,
  whiteSpace: 'nowrap',
})
const ageStyle = (state: DeckRow['ageState']): CSSProperties => ({
  fontSize: '0.72rem',
  fontWeight: 600,
  padding: '1px 8px',
  borderRadius: 999,
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
  background: state === 'red' ? 'var(--bg-red-tint)' : state === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-200)',
  color: state === 'red' ? 'var(--text-red-700)' : state === 'amber' ? 'var(--text-amber-800)' : 'var(--text-700)',
})
const foldStyle: CSSProperties = { marginTop: '0.75rem', borderTop: '1px dashed var(--border)', paddingTop: '0.5rem' }
const summaryStyle: CSSProperties = { fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer' }
const foldEmptyStyle: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.35rem 0 0' }
const inputStyle: CSSProperties = { flex: '1 1 14rem', minWidth: 0, font: 'inherit', fontSize: '1rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }

export function QuickfillPhysicalInboxSection({ io = supabaseOfficeInboxIo, todayYmd }: { io?: OfficeInboxIo; todayYmd?: string }) {
  const { role, user } = useAuth()
  const { showToast } = useToastContext()
  const checklistAddModal = useChecklistAddModal()
  const dispatchTaskModal = useDispatchTaskModal()
  const estimatorTaskModal = useEstimatorTaskModal()
  const today = todayYmd ?? todayYmdInAppTz()
  const { papers, routines, loading, error, reload, add, press, backOnDeck } = useOfficeInboxPapers(io, user?.id ?? null, today)

  const [draft, setDraft] = useState('')
  // The door on the read failure (punch list #187 PR 6): What this means opens the family's card under the line.
  const [errorDoorOpen, setErrorDoorOpen] = useState(false)
  // The day the paper came: today unless the paper has sat in the tray since before it was typed.
  const [cameOn, setCameOn] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openForm, setOpenForm] = useState<{ id: string; kind: 'file' | 'ask' | 'wait' } | null>(null)
  const [filePlace, setFilePlace] = useState('')
  const [waitWhom, setWaitWhom] = useState('')
  const [waitUntil, setWaitUntil] = useState('')
  const [decided, setDecided] = useState<DecidedLine[]>([])

  const showDispatchEstimator = role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'estimator'
  const showTask = showDispatchEstimator || role === 'primary'

  const rows = useMemo(() => deckRows(papers, today), [papers, today])
  const summary = useMemo(() => undecidedSummary(papers, today), [papers, today])
  const waiting = useMemo(() => waitingRows(papers, today), [papers, today])
  const someday = useMemo(() => somedayRows(papers), [papers])
  const routineList = useMemo(() => routineRows(papers, routines, today), [papers, routines, today])
  // The words the Mark writes as this station's note: the count, the oldest age and what was decided today.
  const markNote = useMemo(() => (loading || error ? null : markAutoNote(summary, decidedCounts(papers, today, calendarYmdInAppTzFromIso))), [loading, error, summary, papers, today])
  // No count while the read is in flight or has failed: an unknown pile is not an empty one.
  useReportQuickfillSectionMetric(PHYSICAL_INBOX_SECTION_ID, loading || error ? null : summary.count, loading, null, markNote, loading || error ? null : physicalInboxNextLine(rows.map((r) => ({ title: r.paper.title, ageDays: r.ageDays }))))

  async function addPaper() {
    const title = normalizePaperTitle(draft)
    if (!title) {
      showToast('Type the paper first. A two-minute paper is done, not typed.', 'warning')
      return
    }
    setAdding(true)
    try {
      await add(title, normalizeCameOn(cameOn, today))
      setDraft('')
      setCameOn('')
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add the paper'), 'error')
    } finally {
      setAdding(false)
    }
  }

  function onDraftKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void addPaper()
    }
  }

  async function decide(paper: InboxPaper, what: PaperPress, detail: string | null, extra?: PressExtra) {
    if (busyId) return
    setBusyId(paper.id)
    try {
      const next = await press(paper, what, detail, extra)
      setOpenForm(null)
      setFilePlace('')
      setWaitWhom('')
      setWaitUntil('')
      setDecided((prev) => [{ paper: next, outcome: what, detail: next.outcome_detail }, ...prev.filter((d) => d.paper.id !== paper.id)])
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the press'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function undo(line: DecidedLine) {
    if (busyId) return
    setBusyId(line.paper.id)
    try {
      await backOnDeck(line.paper)
      setDecided((prev) => prev.filter((d) => d.paper.id !== line.paper.id))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not undo'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  function openTask(paper: InboxPaper) {
    if (!checklistAddModal) {
      showToast('The Task window is not open on this page.', 'warning')
      return
    }
    checklistAddModal.openAddModal({
      preset: { title: paper.title, links: [] },
      onSaved: (createdItemId) => void decide(paper, 'task', null, { checklist_item_id: createdItemId ?? null }),
    })
  }

  function askDispatch(paper: InboxPaper) {
    if (!dispatchTaskModal) return
    dispatchTaskModal.openDispatchModal({ titleSeed: paper.title, onCreated: (id) => void decide(paper, 'request', 'dispatch', { dispatch_request_id: id }) })
  }

  function openRoutine(paper: InboxPaper) {
    if (!checklistAddModal) {
      showToast('The Task window is not open on this page.', 'warning')
      return
    }
    checklistAddModal.openAddModal({
      preset: { title: paper.title, links: [], when: 'repeat' },
      onSaved: (createdItemId) => void decide(paper, 'routine', null, { checklist_item_id: createdItemId ?? null }),
    })
  }

  function askEstimating(paper: InboxPaper) {
    if (!estimatorTaskModal) return
    estimatorTaskModal.openEstimatorModal({ titleSeed: paper.title, onCreated: (id) => void decide(paper, 'request', 'estimating', { estimator_request_id: id }) })
  }

  const toggleForm = (id: string, kind: 'file' | 'ask' | 'wait') => {
    setOpenForm((cur) => (cur && cur.id === id && cur.kind === kind ? null : { id, kind }))
    setFilePlace('')
    setWaitWhom('')
    setWaitUntil(kind === 'wait' ? ymdAddDays(today, WAITING_DEFAULT_DAYS) : '')
  }

  /** A fold's row leaves the fold: Done closes it, Still here puts it back on the deck. */
  async function foldBack(paper: InboxPaper) {
    if (busyId) return
    setBusyId(paper.id)
    try {
      await backOnDeck(paper)
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not put the paper back'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const paperCard = (row: DeckRow) => {
    const { paper } = row
    const busy = busyId === paper.id
    const form = openForm && openForm.id === paper.id ? openForm.kind : null
    const fileLabel = `Where was ${paper.title} filed?`
    // The default door (PHYSICAL_INBOX_DEFAULT_DOOR) is drawn first and filled; the other is plain.
    const taskButton = showTask ? (
      <button type="button" disabled={busy} data-default-door={PHYSICAL_INBOX_DEFAULT_DOOR === 'task' ? '1' : undefined} style={pressStyle(busy, PHYSICAL_INBOX_DEFAULT_DOOR === 'task' ? 'blue' : 'plain')} onClick={() => openTask(paper)}>
        Task
      </button>
    ) : null
    const askButton = showDispatchEstimator ? (
      <button type="button" disabled={busy} data-default-door={PHYSICAL_INBOX_DEFAULT_DOOR === 'request' ? '1' : undefined} style={pressStyle(busy, PHYSICAL_INBOX_DEFAULT_DOOR === 'request' ? 'blue' : 'plain')} aria-expanded={form === 'ask'} onClick={() => toggleForm(paper.id, 'ask')}>
        Ask ▾
      </button>
    ) : null
    return (
      <div key={paper.id} data-testid="physical-inbox-paper" data-age-state={row.ageState} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, flex: '1 1 14rem', minWidth: 0, overflowWrap: 'anywhere' }}>{paper.title}</span>
          <span style={ageStyle(row.ageState)} title={`Came ${paper.came_on}`}>
            {row.ageWords}
          </span>
          {paper.created_by_name ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{paper.created_by_name}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label={`What happens to ${paper.title}`}>
          <button type="button" disabled={busy} style={pressStyle(busy)} onClick={() => void decide(paper, 'done', null)}>
            Done
          </button>
          <button type="button" disabled={busy} style={pressStyle(busy)} onClick={() => void decide(paper, 'trash', null)}>
            Trash
          </button>
          <button type="button" disabled={busy} style={pressStyle(busy)} aria-expanded={form === 'file'} onClick={() => toggleForm(paper.id, 'file')}>
            File it ▾
          </button>
          {PHYSICAL_INBOX_DEFAULT_DOOR === 'request' ? (
            <>
              {askButton}
              {taskButton}
            </>
          ) : (
            <>
              {taskButton}
              {askButton}
            </>
          )}
          <button type="button" disabled={busy} style={pressStyle(busy)} aria-expanded={form === 'wait'} onClick={() => toggleForm(paper.id, 'wait')}>
            Waiting for ▾
          </button>
          <button type="button" disabled={busy} style={pressStyle(busy)} onClick={() => void decide(paper, 'someday', null)}>
            Someday
          </button>
          {showTask ? (
            <button type="button" disabled={busy} style={pressStyle(busy)} title="This kind of paper comes again and again. Make it a repeating task so it stops landing in the tray." onClick={() => openRoutine(paper)}>
              Comes back
            </button>
          ) : null}
        </div>
        {form === 'file' ? (
          <div data-testid="physical-inbox-file-form" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--bg-page)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '100%' }}>Where?</span>
            {FILE_PLACE_SUGGESTIONS.map((place) => (
              <button key={place} type="button" disabled={busy} style={pressStyle(busy)} onClick={() => void decide(paper, 'filed', place)}>
                {place}
              </button>
            ))}
            <input type="text" aria-label={fileLabel} value={filePlace} onChange={(e) => setFilePlace(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void decide(paper, 'filed', filePlace) } }} placeholder="Somewhere else…" style={{ ...inputStyle, flex: '1 1 10rem', fontSize: '0.875rem', padding: '0.3rem 0.5rem' }} />
            <button type="button" disabled={busy || !filePlace.trim()} style={pressStyle(busy || !filePlace.trim(), 'blue')} onClick={() => void decide(paper, 'filed', filePlace)}>
              Filed
            </button>
          </div>
        ) : null}
        {form === 'wait' ? (
          <div data-testid="physical-inbox-wait-form" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--bg-page)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Whom?</span>
            <input type="text" aria-label={`Whom is ${paper.title} waiting for?`} value={waitWhom} onChange={(e) => setWaitWhom(e.target.value)} placeholder="A name" style={{ ...inputStyle, flex: '1 1 8rem', fontSize: '0.875rem', padding: '0.3rem 0.5rem' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Check on</span>
            <input type="date" aria-label={`When to check on ${paper.title}`} value={waitUntil} min={today} onChange={(e) => setWaitUntil(e.target.value)} style={{ ...inputStyle, flex: '0 1 10rem', fontSize: '0.875rem', padding: '0.3rem 0.5rem' }} />
            <button type="button" disabled={busy || !waitWhom.trim()} style={pressStyle(busy || !waitWhom.trim(), 'blue')} onClick={() => void decide(paper, 'waiting', waitWhom, { follow_up_on: waitUntil || null })}>
              Waiting
            </button>
          </div>
        ) : null}
        {form === 'ask' ? (
          <div data-testid="physical-inbox-ask-form" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--bg-page)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Whom?</span>
            <button type="button" disabled={busy} style={pressStyle(busy, 'sky')} onClick={() => askDispatch(paper)}>
              Ask dispatch
            </button>
            <button type="button" disabled={busy} style={pressStyle(busy, 'violet')} onClick={() => askEstimating(paper)}>
              Ask estimating
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  const decidedLine = (line: DecidedLine) => (
    <div key={`decided:${line.paper.id}`} data-testid="physical-inbox-decided" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0.8rem', border: '1px solid var(--border-green)', borderRadius: 8, background: 'var(--bg-green-tint)', fontSize: '0.85rem', color: 'var(--text-green-800)' }}>
      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
        <b>{outcomeWords(line.outcome, line.detail)}</b> · {line.paper.title}
      </span>
      <button type="button" disabled={busyId === line.paper.id} style={pressStyle(busyId === line.paper.id)} onClick={() => void undo(line)}>
        Undo
      </button>
    </div>
  )

  return (
    <section style={{ borderRadius: 8, padding: '1rem 1.25rem', background: 'var(--bg-page)' }}>
      <p style={introStyle}>A paper that takes two minutes is done, not typed. Type the rest once, with the day it came, and press what happens to it. The count is the paper nobody has decided on.</p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" aria-label="A paper for the deck" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onDraftKey} placeholder="A paper that will take more than two minutes…" maxLength={200} style={inputStyle} disabled={adding} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Came
          <input type="date" aria-label="The day the paper came" value={cameOn || today} max={today} onChange={(e) => setCameOn(e.target.value)} disabled={adding} style={{ ...inputStyle, flex: '0 0 auto', width: '9.5rem', fontSize: '0.875rem', padding: '0.3rem 0.45rem' }} />
        </label>
        <button type="button" disabled={adding} style={pressStyle(adding, 'plain')} onClick={() => void addPaper()}>
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error ? (
        <>
          <p data-testid="physical-inbox-error" style={{ ...lineStyle, color: 'var(--text-red-700)' }}>
            Could not read the papers · {error} · <ErrorDoorButton family={errorFamilyOf({ kind: isNetworkFetchErrorMessage(error) || error === OFFLINE_ERROR_MESSAGE ? 'network' : 'unknown', message: error })} open={errorDoorOpen} onToggle={setErrorDoorOpen} />{' '}
            <button type="button" style={pressStyle(false)} onClick={() => void reload()}>
              Retry
            </button>
          </p>
          {errorDoorOpen ? <ErrorDoorCard family={errorFamilyOf({ kind: isNetworkFetchErrorMessage(error) || error === OFFLINE_ERROR_MESSAGE ? 'network' : 'unknown', message: error })} onClose={() => setErrorDoorOpen(false)} style={{ marginBottom: '0.5rem' }} /> : null}
        </>
      ) : loading ? (
        <p data-testid="physical-inbox-line" style={{ ...lineStyle, color: 'var(--text-muted)' }}>Reading the deck…</p>
      ) : (
        <p data-testid="physical-inbox-line" style={{ ...lineStyle, color: summary.count === 0 ? 'var(--text-green-800)' : 'var(--text-700)' }}>
          {undecidedWords(summary)}
          {summary.count === 0 ? ' · The tray is clear.' : ''}
        </p>
      )}
      {!loading && !error ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {decided.map(decidedLine)}
          {rows.map(paperCard)}
        </div>
      ) : null}
      {!loading && !error ? (
        <details data-testid="physical-inbox-waiting" style={foldStyle} open={waiting.some((w) => w.late)}>
          <summary style={summaryStyle}>Waiting for · {waiting.length}</summary>
          {waiting.length === 0 ? (
            <p style={foldEmptyStyle}>Nothing waits on anyone. A paper you hand to someone sits here with the day to check.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
              {waiting.map((w) => (
                <div key={w.paper.id} data-testid="physical-inbox-waiting-row" data-late={w.late ? '1' : '0'} style={{ ...cardStyle, background: 'var(--bg-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, flex: '1 1 14rem', minWidth: 0, overflowWrap: 'anywhere' }}>{w.paper.title}</span>
                    <span style={{ fontSize: '0.78rem', color: w.late ? 'var(--text-red-700)' : 'var(--text-700)', fontWeight: w.late ? 600 : 500 }}>{w.words}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>since {shortDay(w.paper.came_on)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button type="button" disabled={busyId === w.paper.id} style={pressStyle(busyId === w.paper.id)} onClick={() => void decide(w.paper, 'done', null)}>
                      Done
                    </button>
                    <button type="button" disabled={busyId === w.paper.id} style={pressStyle(busyId === w.paper.id)} onClick={() => void foldBack(w.paper)}>
                      Still here
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </details>
      ) : null}
      {!loading && !error ? (
        <details data-testid="physical-inbox-someday" style={foldStyle}>
          <summary style={summaryStyle}>Someday · {someday.length}</summary>
          {someday.length === 0 ? (
            <p style={foldEmptyStyle}>Nothing parked. A Someday paper is read from here once a month.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
              {someday.map((p) => (
                <div key={p.id} data-testid="physical-inbox-someday-row" style={{ ...cardStyle, background: 'var(--bg-200)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, flex: '1 1 14rem', minWidth: 0, overflowWrap: 'anywhere' }}>{p.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>parked {p.outcome_at ? shortDay(calendarYmdInAppTzFromIso(p.outcome_at)) : ''} · came {shortDay(p.came_on)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button type="button" disabled={busyId === p.id} style={pressStyle(busyId === p.id)} onClick={() => void decide(p, 'done', null)}>
                      Done
                    </button>
                    <button type="button" disabled={busyId === p.id} style={pressStyle(busyId === p.id)} onClick={() => void decide(p, 'trash', null)}>
                      Trash
                    </button>
                    <button type="button" disabled={busyId === p.id} style={pressStyle(busyId === p.id)} onClick={() => void foldBack(p)}>
                      Back on the deck
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </details>
      ) : null}
      {!loading && !error ? (
        <div data-testid="physical-inbox-routines" style={{ marginTop: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>The tray's routines</span>
            {routineList.length > 0 ? (
              <Link to="/checklist?tab=manage" style={{ fontSize: '0.78rem', marginLeft: 'auto' }}>
                Edit in Checklist ›
              </Link>
            ) : null}
          </div>
          {routineList.length === 0 ? (
            <p style={foldEmptyStyle}>None yet. When a kind of paper comes every month, press Comes back on it to make a repeating task.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.25rem' }}>
              {routineList.map((r) => (
                <div key={r.routine.itemId} data-testid="physical-inbox-routine" style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', padding: '0.35rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <span style={{ flex: '1 1 14rem', minWidth: 0, overflowWrap: 'anywhere', color: 'var(--text-700)' }}>{r.routine.title}</span>
                  <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.words}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
