import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import { useDispatchTaskModal } from '../../contexts/DispatchTaskModalContext'
import { useEstimatorTaskModal } from '../../contexts/EstimatorTaskModalContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { supabaseOfficeInboxIo, useOfficeInboxPapers, type OfficeInboxIo, type PressExtra } from '../../hooks/useOfficeInboxPapers'
import {
  deckRows,
  FILE_PLACE_SUGGESTIONS,
  normalizePaperTitle,
  outcomeWords,
  PHYSICAL_INBOX_SECTION_ID,
  undecidedSummary,
  undecidedWords,
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
 * leaves a line with Undo for the visit. The folds (Waiting for, Someday) and Comes back
 * follow in their own releases.
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
  border: `1px solid ${tone === 'plain' ? 'var(--border-strong)' : tone === 'blue' ? '#3b82f6' : tone === 'sky' ? '#0ea5e9' : '#7c3aed'}`,
  background: tone === 'plain' ? 'var(--surface)' : tone === 'blue' ? '#3b82f6' : tone === 'sky' ? '#0ea5e9' : '#7c3aed',
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
const inputStyle: CSSProperties = { flex: '1 1 14rem', minWidth: 0, font: 'inherit', fontSize: '1rem', padding: '0.45rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }

export function QuickfillPhysicalInboxSection({ io = supabaseOfficeInboxIo, todayYmd }: { io?: OfficeInboxIo; todayYmd?: string }) {
  const { role, user } = useAuth()
  const { showToast } = useToastContext()
  const checklistAddModal = useChecklistAddModal()
  const dispatchTaskModal = useDispatchTaskModal()
  const estimatorTaskModal = useEstimatorTaskModal()
  const today = todayYmd ?? todayYmdInAppTz()
  const { papers, loading, error, reload, add, press, backOnDeck } = useOfficeInboxPapers(io, user?.id ?? null)

  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openForm, setOpenForm] = useState<{ id: string; kind: 'file' | 'ask' } | null>(null)
  const [filePlace, setFilePlace] = useState('')
  const [decided, setDecided] = useState<DecidedLine[]>([])

  const showDispatchEstimator = role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'estimator'
  const showTask = showDispatchEstimator || role === 'primary'

  const rows = useMemo(() => deckRows(papers, today), [papers, today])
  const summary = useMemo(() => undecidedSummary(papers, today), [papers, today])
  // No count while the read is in flight or has failed: an unknown pile is not an empty one.
  useReportQuickfillSectionMetric(PHYSICAL_INBOX_SECTION_ID, loading || error ? null : summary.count, loading)

  async function addPaper() {
    const title = normalizePaperTitle(draft)
    if (!title) {
      showToast('Type the paper first. A two-minute paper is done, not typed.', 'warning')
      return
    }
    setAdding(true)
    try {
      await add(title, today)
      setDraft('')
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

  function askEstimating(paper: InboxPaper) {
    if (!estimatorTaskModal) return
    estimatorTaskModal.openEstimatorModal({ titleSeed: paper.title, onCreated: (id) => void decide(paper, 'request', 'estimating', { estimator_request_id: id }) })
  }

  const toggleForm = (id: string, kind: 'file' | 'ask') => {
    setOpenForm((cur) => (cur && cur.id === id && cur.kind === kind ? null : { id, kind }))
    setFilePlace('')
  }

  const paperCard = (row: DeckRow) => {
    const { paper } = row
    const busy = busyId === paper.id
    const form = openForm && openForm.id === paper.id ? openForm.kind : null
    const fileLabel = `Where was ${paper.title} filed?`
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
          {showTask ? (
            <button type="button" disabled={busy} style={pressStyle(busy, 'blue')} onClick={() => openTask(paper)}>
              Task
            </button>
          ) : null}
          {showDispatchEstimator ? (
            <button type="button" disabled={busy} style={pressStyle(busy)} aria-expanded={form === 'ask'} onClick={() => toggleForm(paper.id, 'ask')}>
              Ask ▾
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
        <button type="button" disabled={adding} style={pressStyle(adding, 'plain')} onClick={() => void addPaper()}>
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error ? (
        <p data-testid="physical-inbox-error" style={{ ...lineStyle, color: 'var(--text-red-700)' }}>
          Could not read the papers · {error}{' '}
          <button type="button" style={pressStyle(false)} onClick={() => void reload()}>
            Retry
          </button>
        </p>
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
    </section>
  )
}
