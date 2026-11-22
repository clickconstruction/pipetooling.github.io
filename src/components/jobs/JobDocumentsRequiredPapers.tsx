import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useConfirmDialog, usePromptDialog } from '../../contexts/ConfirmDialogContext'
import { useToastContext } from '../../contexts/ToastContext'
import { jobPapersChanged } from '../../hooks/useJobsClosedToMe'
import { batchOutcomeWords } from '../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  type BookPaperRow,
  type JobPaperPerson,
  type JobPapersRoster,
  type PickablePaper,
  NO_PAPERS_WORDS,
  cellFor,
  cellWords,
  copyLinksLabel,
  lockStageNote,
  noLinkReason,
  owedPapers,
  personRoleLabel,
  pickablePapers,
  requireButton,
  requireFoot,
  requiredToast,
  rosterSummary,
  signingLinksText,
} from '../../lib/jobs/jobPapers'
import { supabaseJobPapersIo, type JobPapersIo } from '../../lib/jobs/jobPapersIo'
import { supabaseJobPaperSettingsIo, type JobPaperSettingsIo, type JobSettingsPaper } from '../../lib/jobs/jobPaperSettingsIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { formatErrorMessage } from '../../utils/errorHandling'
import { EmptyState } from '../EmptyState'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { documentsHeading, documentsQuietButton, documentsTd, documentsTh } from './jobDocumentsStyles'
import { JobPaperSettingsWindow, type JobPaperSettingsTarget } from './JobPaperSettingsWindow'

const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const paperRow: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.2rem 0.6rem', minHeight: 44, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)' }
// A word that is a press takes a finger: 44 px tall, with room either side so two of them do not sit shoulder to shoulder.
const linkPress: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, border: 'none', background: 'transparent', padding: '0 0.5rem', cursor: 'pointer', font: 'inherit', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8125rem', whiteSpace: 'nowrap' }
const bluePress: CSSProperties = { minHeight: 44, padding: '0.5rem 0.85rem', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }
const deadPress: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, border: '1px solid transparent', cursor: 'not-allowed' }
const stateChip: CSSProperties = { display: 'inline-block', fontSize: '0.7rem', fontWeight: 600, padding: '0.05rem 0.5rem', borderRadius: 999, whiteSpace: 'nowrap' }
const note: CSSProperties = { ...muted, padding: '0.45rem 0.6rem', borderLeft: '3px solid var(--text-amber-800)', background: 'var(--bg-amber-tint)', color: 'var(--text-700)', borderRadius: '0 6px 6px 0' }

type Busy = 'save' | `remove:${string}` | `links:${string}` | null

/**
 * Papers before this job opens (step 2 of seven): on the job window's Documents tab the office picks papers from
 * the Contract Book and saves, and everyone signs each one, the office too. The save button names its count and the
 * line under it says how many people it reaches. Below, the roster: each person against each paper, with a press
 * that copies their signing links to text them. Whoever saves owes the papers too: the job's prompt asks them at once
 * (`JobPapersGateModal`). Taking a paper off keeps every signature. Office only: the caller draws it for an office role.
 */
export function JobDocumentsRequiredPapers({
  job,
  io = supabaseJobPapersIo,
  settingsIo = supabaseJobPaperSettingsIo,
  onOverlayOpenChange,
}: {
  job: { id: string }
  io?: JobPapersIo
  /** The reads and writes of a paper built from settings (#389 step 4). */
  settingsIo?: JobPaperSettingsIo
  onOverlayOpenChange?: (open: boolean) => void
}) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const promptDialog = usePromptDialog()
  const [roster, setRoster] = useState<JobPapersRoster | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [loading, setLoading] = useState(false)
  const [book, setBook] = useState<BookPaperRow[] | null>(null)
  const [bookFailure, setBookFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [adding, setAdding] = useState(false)
  const [pending, setPending] = useState<PickablePaper[]>([])
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [held, setHeld] = useState<{ head: string; lines: string[] } | null>(null)
  // Papers built from settings (#389 step 4): what this job set on each, and the window that sets them.
  const [settingsPapers, setSettingsPapers] = useState<JobSettingsPaper[]>([])
  const [settingsTarget, setSettingsTarget] = useState<JobPaperSettingsTarget | null>(null)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const next = await io.readRoster(job.id)
      if (!live.current) return
      setRoster(next)
      setFailure(null)
      // Only a job with papers can hold one built from settings, so a job with none takes no second read.
      const built = next.papers.length > 0 ? await settingsIo.readSettingsPapers(job.id) : []
      if (live.current) setSettingsPapers(built)
    } catch (e) {
      if (live.current) setFailure(recoveryFailureFromError(e, 'Couldn’t read this job’s papers'))
    } finally {
      if (live.current) setLoading(false)
    }
  }, [io, settingsIo, job.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const openSettings = (target: JobPaperSettingsTarget) => {
    setError(null)
    setSettingsTarget(target)
    onOverlayOpenChange?.(true)
  }
  const closeSettings = () => {
    setSettingsTarget(null)
    onOverlayOpenChange?.(false)
  }

  // A paper signed in another tab shows when the office comes back to this one.
  const hasPapers = (roster?.papers.length ?? 0) > 0
  useEffect(() => {
    if (!hasPapers) return
    const onShow = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [hasPapers, reload])

  const loadBook = useCallback(async () => {
    try {
      const rows = await io.readBook()
      if (!live.current) return
      setBook(rows)
      setBookFailure(null)
    } catch (e) {
      if (live.current) setBookFailure(recoveryFailureFromError(e, 'Couldn’t read the Contract Book'))
    }
  }, [io])

  const openPicker = () => {
    setAdding(true)
    setError(null)
    if (book == null) void loadBook()
  }

  const pickable = useMemo(() => (book && roster ? pickablePapers(book, roster.papers, pending.map((p) => p.bookDocumentId)) : []), [book, roster, pending])
  const summary = useMemo(() => (roster && roster.papers.length > 0 ? rosterSummary(roster) : null), [roster])

  const told = () => jobPapersChanged(job.id)

  const save = async () => {
    if (pending.length === 0 || busy) return
    setBusy('save')
    setError(null)
    try {
      const added = await io.requirePapers(job.id, pending.map((p) => p.bookDocumentId))
      if (!live.current) return
      setPending([])
      setAdding(false)
      showToast(requiredToast(added), 'success')
      told()
      await reload()
    } catch (e) {
      if (live.current) setError(formatErrorMessage(e, 'The papers were not saved.'))
    } finally {
      if (live.current) setBusy(null)
    }
  }

  const remove = async (paper: { id: string; paperName: string }) => {
    if (busy) return
    onOverlayOpenChange?.(true)
    const ok = await confirmDialog({
      title: `Take ${paper.paperName} off this job?`,
      message: 'Nobody will be asked to sign it for this job any more. Every signature already on file is kept.',
      confirmLabel: 'Take the paper off',
    })
    onOverlayOpenChange?.(false)
    if (!ok || !live.current) return
    setBusy(`remove:${paper.id}`)
    setError(null)
    try {
      await io.removePaper(paper.id)
      if (!live.current) return
      showToast(`${paper.paperName} is off this job. Its signatures are kept.`, 'success')
      told()
      await reload()
    } catch (e) {
      if (live.current) setError(formatErrorMessage(e, 'The paper was not taken off.'))
    } finally {
      if (live.current) setBusy(null)
    }
  }

  /** One link per paper the person owes, onto the clipboard. A paper that fails is named and the rest still copy. */
  const copyLinks = async (person: JobPaperPerson) => {
    if (busy || !roster || !person.personId) return
    const owed = owedPapers(person, roster.papers)
    if (owed.length === 0) return
    setBusy(`links:${person.key}`)
    setError(null)
    setHeld(null)
    const links: { paperName: string; url: string }[] = []
    const failed: string[] = []
    for (const paper of owed) {
      try {
        links.push({ paperName: paper.paperName, url: await io.signingLink(paper.id, person.personId) })
      } catch (e) {
        failed.push(`${paper.paperName}: ${formatErrorMessage(e, 'the link could not be made.')}`)
      }
    }
    if (!live.current) return
    if (links.length > 0) {
      const body = signingLinksText(links)
      try {
        await navigator.clipboard.writeText(body)
      } catch {
        // The clipboard is closed to the app here: the links show in a window to copy by hand.
        onOverlayOpenChange?.(true)
        await promptDialog({ title: copyLinksLabel(links.length), message: 'The app could not reach the clipboard. Select the text below and copy it.', defaultValue: body, confirmLabel: 'I copied it' })
        onOverlayOpenChange?.(false)
      }
    }
    if (!live.current) return
    const outcome = batchOutcomeWords({ verb: 'copy', past: 'copied', done: links.length, failed: failed.length, noun: ['signing link', 'signing links'] })
    showToast(links.length > 0 && failed.length === 0 ? `${outcome.line} Text ${links.length === 1 ? 'it' : 'them'} to ${person.name}.` : outcome.line, outcome.tone)
    if (outcome.head) setHeld({ head: outcome.head, lines: failed })
    setBusy(null)
    await reload()
  }

  const stage = lockStageNote()
  const button = requireButton(pending.length)
  const papers = roster?.papers ?? []
  const nothingYet = papers.length === 0 && pending.length === 0 && !adding

  return (
    <section aria-labelledby="job-documents-required-papers" data-job-required-papers="" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
        <h3 id="job-documents-required-papers" style={{ ...documentsHeading, flex: 1 }}>
          Papers before this job opens
        </h3>
        {pending.length > 0 ? <span style={muted}>not saved yet</span> : summary ? <span style={muted} data-testid="job-papers-summary">{summary.words}</span> : null}
      </div>

      {failure ? (
        <OfflineRetryPanel failure={failure} onRetry={() => void reload()} surface="job-documents-required-papers" idempotent busy={loading} />
      ) : roster == null ? (
        <p style={muted}>Loading…</p>
      ) : (
        <>
          {stage && !nothingYet ? (
            <p style={note} data-testid="job-papers-stage-note">
              {stage}
            </p>
          ) : null}

          {nothingYet ? (
            <EmptyState compact main={NO_PAPERS_WORDS.main} next={{ label: NO_PAPERS_WORDS.next, onPress: openPicker }} tail={NO_PAPERS_WORDS.tail} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {papers.map((p) => {
                const set = settingsPapers.find((x) => x.requiredPaperId === p.id)
                return (
                <div key={p.id} style={paperRow} data-job-paper="live">
                  <b style={{ color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.875rem' }}>{p.paperName}</b>
                  <span style={muted}>{set ? 'Built from this job’s settings' : p.isForm ? 'A form from the Contract Book' : 'From the Contract Book'}</span>
                  {set ? (
                    <button type="button" style={{ ...linkPress, marginLeft: 'auto' }} disabled={busy != null} onClick={() => openSettings({ kind: 'change', paper: set, paperName: p.paperName })} aria-label={`Settings of ${p.paperName}`}>
                      Settings
                    </button>
                  ) : null}
                  <button type="button" style={{ ...linkPress, marginLeft: set ? 0 : 'auto', color: 'var(--text-muted)', fontWeight: 500 }} disabled={busy != null} onClick={() => void remove(p)} aria-label={`Take ${p.paperName} off`}>
                    {busy === `remove:${p.id}` ? 'Taking off…' : 'Take off'}
                  </button>
                </div>
                )
              })}
              {pending.map((p) => (
                <div key={p.bookDocumentId} style={{ ...paperRow, borderStyle: 'dashed' }} data-job-paper="pending">
                  <b style={{ color: 'var(--text-strong)', fontWeight: 600, fontSize: '0.875rem' }}>{p.paperName}</b>
                  <span style={muted}>{p.from}</span>
                  <button type="button" style={{ ...linkPress, marginLeft: 'auto', color: 'var(--text-muted)', fontWeight: 500 }} disabled={busy != null} onClick={() => setPending((cur) => cur.filter((x) => x.bookDocumentId !== p.bookDocumentId))} aria-label={`Take ${p.paperName} off`}>
                    Take off
                  </button>
                </div>
              ))}

              {adding ? (
                <div data-job-paper-picker="" style={{ border: '1px solid var(--border-strong)', borderRadius: 7, padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'var(--bg-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ ...muted, flex: 1, fontWeight: 600, color: 'var(--text-700)' }}>Pick a paper from the Contract Book</span>
                    <button type="button" style={linkPress} onClick={() => setAdding(false)}>
                      Close the list
                    </button>
                  </div>
                  {bookFailure ? (
                    <OfflineRetryPanel failure={bookFailure} onRetry={() => void loadBook()} surface="job-documents-required-papers-book" idempotent />
                  ) : book == null ? (
                    <p style={muted}>Loading…</p>
                  ) : pickable.length === 0 ? (
                    <EmptyState compact main="Every paper in the Contract Book is already on this job." next={{ label: 'Open the Contract Book', to: '/people?tab=contracts' }} tail="to write a new one." />
                  ) : (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {pickable.map((p) => (
                        <li key={p.bookDocumentId}>
                          <button
                            type="button"
                            disabled={!p.hasWords}
                            onClick={() => (p.built ? openSettings({ kind: 'first', bookDocumentId: p.bookDocumentId, paperName: p.paperName }) : setPending((cur) => [...cur, p]))}
                            style={{ ...paperRow, width: '100%', textAlign: 'left', cursor: p.hasWords ? 'pointer' : 'not-allowed', font: 'inherit', ...(p.hasWords ? {} : { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT }) }}
                          >
                            <b style={{ color: p.hasWords ? 'var(--text-strong)' : DEAD_PRESS_TEXT, fontWeight: 600, fontSize: '0.875rem' }}>{p.paperName}</b>
                            <span style={muted}>{p.from}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div>
                  <button type="button" style={{ ...documentsQuietButton, minHeight: 44 }} onClick={openPicker} disabled={busy != null}>
                    Add a paper
                  </button>
                </div>
              )}

              {pending.length > 0 ? (
                <>
                  <div>
                    <button type="button" style={{ ...bluePress, ...(button.dead || busy != null ? deadPress : {}) }} disabled={button.dead || busy != null} onClick={() => void save()}>
                      {busy === 'save' ? 'Saving…' : button.label}
                    </button>
                  </div>
                  <p style={muted} data-testid="job-papers-foot">
                    {requireFoot(roster.people.length)}
                  </p>
                </>
              ) : null}
            </div>
          )}

          {error ? (
            <p style={{ ...muted, color: 'var(--text-red-700)' }} role="alert">
              {error}
            </p>
          ) : null}
          {settingsTarget ? (
            <JobPaperSettingsWindow
              job={job}
              target={settingsTarget}
              io={settingsIo}
              onClose={closeSettings}
              onDone={() => {
                closeSettings()
                setAdding(false)
                told()
                void reload()
              }}
            />
          ) : null}
          {held ? (
            <div role="alert" style={{ ...muted, color: 'var(--text-red-700)' }}>
              <p style={{ margin: 0 }}>{held.head}</p>
              <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1rem' }}>
                {held.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {papers.length > 0 ? (
            <>
              <style>{`@media (max-width: 600px) {
  [data-job-papers-roster] thead { display: none; }
  [data-job-papers-roster], [data-job-papers-roster] tbody, [data-job-papers-roster] tr, [data-job-papers-roster] td { display: block; }
  [data-job-papers-roster] tr { padding: 0.45rem 0; border-bottom: 1px solid var(--border); }
  [data-job-papers-roster] td { border: 0 !important; padding: 0.1rem 0 !important; }
  [data-job-papers-roster] td[data-label]::before { content: attr(data-label) ": "; color: var(--text-muted); font-size: 0.75rem; }
}`}</style>
              <table data-job-papers-roster="" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={documentsTh}>Person</th>
                    {papers.map((p) => (
                      <th key={p.id} style={{ ...documentsTh, whiteSpace: 'normal' }}>
                        {p.paperName}
                      </th>
                    ))}
                    <th style={documentsTh} aria-label="Signing links" />
                  </tr>
                </thead>
                <tbody>
                  {roster.people.map((person) => {
                    const owed = owedPapers(person, papers)
                    const why = owed.length > 0 ? noLinkReason(person) : null
                    return (
                      <tr key={person.key} data-job-papers-person={person.key}>
                        <td style={documentsTd}>
                          <b style={{ display: 'block', color: 'var(--text-strong)', fontWeight: 600, whiteSpace: 'nowrap' }}>{person.name}</b>
                          <small style={{ color: 'var(--text-muted)' }}>{personRoleLabel(person)}</small>
                        </td>
                        {papers.map((p) => {
                          const words = cellWords(cellFor(person, p.id))
                          return (
                            <td key={p.id} style={documentsTd} data-label={p.paperName}>
                              <span style={{ ...stateChip, ...(words.signed ? { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' } : { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }) }}>{words.label}</span>
                              {words.day ? <span style={{ ...muted, marginLeft: '0.35rem', fontVariantNumeric: 'tabular-nums' }}>{words.day}</span> : null}
                            </td>
                          )
                        })}
                        <td style={{ ...documentsTd, textAlign: 'right' }}>
                          {owed.length === 0 ? null : why ? (
                            <span style={muted}>{why}</span>
                          ) : (
                            <button type="button" style={linkPress} disabled={busy != null} onClick={() => void copyLinks(person)}>
                              {busy === `links:${person.key}` ? 'Copying…' : copyLinksLabel(owed.length)}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          ) : null}
        </>
      )}
    </section>
  )
}

export default JobDocumentsRequiredPapers
