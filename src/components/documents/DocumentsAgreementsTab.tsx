import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog, usePromptDialog } from '../../contexts/ConfirmDialogContext'
import {
  AGREEMENTS_EMPTY_PAGE,
  AGREEMENTS_PAGE,
  AGREEMENT_GROUP_COLORS,
  AGREEMENT_KIND_CHIPS,
  AGREEMENT_STATE_CHIPS,
  AGREEMENT_STATE_COLORS,
  agreementCountWords,
  agreementDayWords,
  agreementDoor,
  agreementFindWords,
  agreementJobTail,
  agreementJobTitle,
  agreementMonthGroups,
  agreementName,
  agreementStateChip,
  agreementTag,
  agreementsEmptyWords,
  agreementsNarrowed,
  waitingChipLabel,
  type AgreementRow,
  type KindPick,
  type StateAsk,
  type StatePick,
} from '../../lib/documents/agreementsLedger'
import { countAgreementsWaiting, readAgreements } from '../../lib/documents/agreementsLedgerIo'
import {
  COPY_SIGNING_LINK_LABEL,
  SEND_AGAIN_LABEL,
  agreementCanBeSentAgain,
  agreementOpensContractWindow,
  copySigningLinkConfirm,
  signingLinkByHandPrompt,
  signingLinkCopiedWords,
} from '../../lib/documents/agreementsActs'
import { readPersonPaperSendFacts, sendPersonPaperForSignature, type PersonPaperSendFacts } from '../../lib/contracts/personPaperSendIo'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { emptyWordsWithPress } from '../../lib/emptyWords'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { loadJobContractRows } from '../../lib/jobs/jobLienPaperIo'
import { openHtmlWindowWhenReady } from '../../lib/jobsDocuments/printWindow'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { JobWithDetails } from '../../types/jobWithDetails'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { AgreementsSendPaper } from './AgreementsSendPaper'
import { EmptyState } from '../EmptyState'
import JobContractModal from '../jobs/JobContractModal'
import { buildJobContractRecordHtml } from '../jobs/JobContractRecordModal'
import { documentsLinkButton, documentsQuietButton } from '../jobs/jobDocumentsStyles'

/**
 * Documents → Agreements (punch list #376): every agreement the app makes, sends, signs or stores, one list, newest
 * first. A job's contract, a warranty, a GC's own paper, a signed paper the office filed, a staff, sub or partner
 * agreement and a sub work order each keep their own window; this tab lists them side by side, a line each: its kind,
 * its name, who it is with and the job, where it stands in that kind's own words, and its day. A chip picks a kind or a
 * state, the box finds by customer, job number, person or paper, and a press opens the window that kind already has.
 * A staff, sub or partner paper that waits on a signature acts where it sits: Send again and Copy the signing link, both
 * through the sender People → Contracts uses (`lib/documents/agreementsActs.ts`), and the list reads again after.
 * **Send a paper**, beside the box, sends a Contract Book paper to a person (`AgreementsSendPaper.tsx`).
 * The read is the `agreements_on_file` view, where each table's own row security decides what the reader sees; a read
 * that fails says so with Retry and never reads as an empty ledger. The rules are `lib/documents/agreementsLedger.ts`.
 *
 * With `embedSearch` (the Search tab) the box is the page's own: the tab draws no box and no chips, asks for the words
 * it is handed across every kind and every state, so a voided paper is found too, and stays quiet until there are two
 * letters.
 */

const WorkOrderAssemblerModal = lazy(() => import('../jobs/WorkOrderAssemblerModal').then((m) => ({ default: m.WorkOrderAssemblerModal })))
const PersonContractSignedRecordModal = lazy(() => import('../contracts/PersonContractSignedRecordModal').then((m) => ({ default: m.PersonContractSignedRecordModal })))
const ContractSendWindow = lazy(() => import('../contracts/ContractSendWindow').then((m) => ({ default: m.ContractSendWindow })))

const band: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  margin: '0.5rem 0 0',
  padding: '0.4rem 0.6rem',
  borderRadius: 6,
  background: 'var(--bg-subtle)',
  borderLeft: '3px solid var(--text-blue-700)',
  color: 'var(--text-strong)',
  fontSize: '0.875rem',
  fontWeight: 800,
}
const bandCount: CSSProperties = { marginLeft: '0.5rem', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }
const line: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.25rem 0.9rem',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '0.55rem 0.6rem',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface)',
}
const lineLeft: CSSProperties = { minWidth: 0, flex: '1 1 20rem' }
const lineRight: CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }
const tag: CSSProperties = { display: 'inline-block', verticalAlign: 'text-bottom', marginRight: '0.45rem', padding: '0.08rem 0.45rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }
const subLine: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.1rem', overflowWrap: 'anywhere' }
const jobLink: CSSProperties = { fontWeight: 600, color: 'var(--text-green-700)', textDecoration: 'none' }
const stateChip: CSSProperties = { padding: '0.08rem 0.5rem', borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }
const day: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }
const quiet: CSSProperties = { margin: 0, color: 'var(--text-muted)', fontSize: '0.8125rem' }
const doorLink: CSSProperties = { color: 'var(--text-link)', fontWeight: 600 }
const nameText: CSSProperties = { fontWeight: 600, color: 'var(--text-strong)' }
const actBusy: CSSProperties = { ...documentsQuietButton, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, cursor: 'wait' }

function pickChipStyle(pressed: boolean): CSSProperties {
  const base: CSSProperties = { ...documentsQuietButton, borderRadius: 999, fontWeight: pressed ? 700 : 500 }
  return pressed ? { ...base, background: 'var(--bg-blue-tint)', border: '1px solid #3b82f6', color: 'var(--text-blue-700)' } : base
}

export function DocumentsAgreementsTab({ embedSearch, onClearEmbedSearch }: { embedSearch?: string; onClearEmbedSearch?: () => void } = {}) {
  const embedded = embedSearch !== undefined
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const promptDialog = usePromptDialog()
  const [kind, setKind] = useState<KindPick>('all')
  const [state, setState] = useState<StatePick>('live')
  const [typed, setTyped] = useState('')
  const [asked, setAsked] = useState('')
  const [limit, setLimit] = useState(AGREEMENTS_PAGE)
  const [rows, setRows] = useState<AgreementRow[] | null>(null)
  const [more, setMore] = useState(false)
  const [waiting, setWaiting] = useState<number | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tries, setTries] = useState(0)
  const [contractWindow, setContractWindow] = useState<{ job: JobWithDetails; recordId: string } | null>(null)
  const [signedDocId, setSignedDocId] = useState<string | null>(null)
  const [workOrder, setWorkOrder] = useState<{ job: JobWithDetails; commitmentId: string } | null>(null)
  /** Send again: the waiting paper whose Send window is open, with what the window needs to know about it. */
  const [sendAgain, setSendAgain] = useState<{ documentId: string; facts: PersonPaperSendFacts } | null>(null)
  /** The one act in flight, `<act>:<line id>`, so a second press waits for the first. */
  const [busyAct, setBusyAct] = useState<string | null>(null)

  // What was typed is asked for once the typing rests, so each key is not a read. The Search tab hands its own words.
  const words = embedded ? (embedSearch ?? '') : typed
  useEffect(() => {
    const t = window.setTimeout(() => setAsked(words), 300)
    return () => window.clearTimeout(t)
  }, [words])

  const findWords = useMemo(() => agreementFindWords(asked), [asked])
  // Under the Search tab nothing is asked until there are two letters to ask for.
  const quietEmbed = embedded && findWords.length === 0
  // The Search tab has no chips: it asks across every kind and every state.
  const kindAsk: KindPick = embedded ? 'all' : kind
  const stateAsk: StateAsk = embedded ? 'any' : state

  useEffect(() => {
    if (quietEmbed) {
      setRows(null)
      setFailure(null)
      return
    }
    let cancelled = false
    setReading(true)
    void readAgreements({ kind: kindAsk, state: stateAsk, typed: asked, limit })
      .then((read) => {
        if (cancelled) return
        setRows(read.rows)
        setMore(read.more)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setFailure(recoveryFailureFromError(e, 'The agreements did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kindAsk, stateAsk, asked, limit, tries, quietEmbed])

  // The count on Waiting on a signature, under the kind picked; a count that cannot be read leaves the chip's words alone.
  // The Search tab draws no chips, so it asks for no count.
  useEffect(() => {
    if (embedded) return
    let cancelled = false
    void countAgreementsWaiting(kind).then((n) => {
      if (!cancelled) setWaiting(n)
    })
    return () => {
      cancelled = true
    }
  }, [kind, tries, embedded])

  const retry = useCallback(() => setTries((n) => n + 1), [])

  // The Contract window says when a contract changed; the list reads again so its line follows.
  useEffect(() => {
    window.addEventListener('job-contract-changed', retry)
    return () => window.removeEventListener('job-contract-changed', retry)
  }, [retry])

  const today = todayYmdInAppTz()
  const groups = useMemo(() => agreementMonthGroups(rows ?? []), [rows])
  const query = { kind: kindAsk, state: stateAsk, typed: asked }
  const narrowed = agreementsNarrowed(query)
  const clear = () => {
    setTyped('')
    setKind('all')
    setState('live')
    setLimit(AGREEMENTS_PAGE)
    if (embedded) onClearEmbedSearch?.()
  }

  const open = async (row: AgreementRow) => {
    const door = agreementDoor(row)
    if (door.kind === 'person-signed') {
      setSignedDocId(door.documentId)
      return
    }
    if (door.kind === 'contract' && !agreementOpensContractWindow(row)) {
      // A voided contract opens as the preview of the page that went out: the Contract window opens on the job's live
      // contract, never on a voided record. The preview opens inside the press, so a popup blocker allows it, and takes
      // the page once the job and the contract are read.
      const ok = await openHtmlWindowWhenReady(async () => {
        const [job, contracts] = await Promise.all([fetchJobWithDetailsById(door.jobId), loadJobContractRows(door.jobId)])
        const contract = contracts.find((c) => c.id === door.recordId)
        if (!job || !contract) throw new Error('not read')
        return buildJobContractRecordHtml(contract, job, null)
      })
      if (!ok) showToast('The contract did not open. Allow popups for this page, then press it again.', 'error')
      return
    }
    if (door.kind === 'contract' || door.kind === 'work-order') {
      const job = await fetchJobWithDetailsById(door.jobId)
      if (!job) {
        showToast(door.kind === 'contract' ? 'Could not load the job for this contract' : 'Could not load the job for this work order', 'error')
        return
      }
      if (door.kind === 'contract') setContractWindow({ job, recordId: door.recordId })
      else setWorkOrder({ job, commitmentId: door.commitmentId })
    }
  }

  // Send again: read who the paper is with and their address, then open the Send window on it.
  const openSendAgain = async (row: AgreementRow) => {
    if (busyAct) return
    setBusyAct(`send:${row.id}`)
    try {
      const facts = await readPersonPaperSendFacts(row.source_id, user?.id)
      setSendAgain({ documentId: row.source_id, facts })
    } catch (e) {
      showToast(formatErrorMessage(e, 'The paper did not open to send.'), 'error')
    } finally {
      setBusyAct(null)
    }
  }

  // Copy the signing link: a new link is made and nothing is emailed. The confirm says the link sent before stops
  // working, since the signer may still hold that email.
  const copySigningLink = async (row: AgreementRow) => {
    if (busyAct) return
    if (!(await confirmDialog(copySigningLinkConfirm(row)))) return
    setBusyAct(`link:${row.id}`)
    try {
      const sent = await sendPersonPaperForSignature({ documentId: row.source_id, mode: 'link' })
      if (!sent.acceptUrl) throw new Error('The signing link did not come back.')
      let copied = true
      try {
        await navigator.clipboard.writeText(sent.acceptUrl)
      } catch {
        // The clipboard is closed to the app here: the link shows in a window to copy by hand.
        copied = (await promptDialog(signingLinkByHandPrompt(sent.acceptUrl))) !== null
      }
      if (copied) showToast(signingLinkCopiedWords(row), 'success')
      else showToast('A new signing link was made. It was not copied.', 'info')
      retry()
    } catch (e) {
      showToast(formatErrorMessage(e, 'The signing link was not made.'), 'error')
    } finally {
      setBusyAct(null)
    }
  }

  const empty = agreementsEmptyWords(query)

  return (
    <section aria-label="Agreements" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {!embedded ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="search"
            value={typed}
            onChange={(ev) => {
              setTyped(ev.target.value)
              setLimit(AGREEMENTS_PAGE)
            }}
            placeholder="Find an agreement: a customer, a job number, a person, a paper"
            aria-label="Find an agreement"
            style={{ flex: '1 1 16rem', minWidth: 0, padding: '0.5rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', boxSizing: 'border-box' }}
          />
          <AgreementsSendPaper onSent={retry} />
        </div>
      ) : null}
      {quietEmbed ? (
        <p style={quiet} data-testid="documents-agreements-embed-hint">
          Results appear when you type a search above.
        </p>
      ) : (
        <>
          {!embedded ? (
            <>
              <div role="group" aria-label="Kind of agreement" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {AGREEMENT_KIND_CHIPS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={kind === c.key}
                    onClick={() => {
                      setKind(c.key)
                      setLimit(AGREEMENTS_PAGE)
                    }}
                    style={pickChipStyle(kind === c.key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div role="group" aria-label="State" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {AGREEMENT_STATE_CHIPS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={state === c.key}
                    onClick={() => {
                      setState(c.key)
                      setLimit(AGREEMENTS_PAGE)
                    }}
                    style={pickChipStyle(state === c.key)}
                  >
                    {c.key === 'waiting' ? waitingChipLabel(c.label, waiting) : c.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {failure ? <OfflineRetryPanel failure={failure} onRetry={retry} surface="documents-agreements" idempotent busy={reading} /> : null}
          {rows == null && !failure ? (
            <p style={quiet}>Loading…</p>
          ) : rows != null && rows.length === 0 ? (
            <div data-testid="documents-agreements-empty">
              <EmptyState {...emptyWordsWithPress(empty, narrowed ? { onPress: clear } : { to: AGREEMENTS_EMPTY_PAGE.to })} />
            </div>
          ) : rows != null ? (
            <>
              <p style={quiet} data-testid="documents-agreements-count">
                {more ? `The newest ${agreementCountWords(rows.length)}` : agreementCountWords(rows.length)}
              </p>
              {groups.map((g) => (
                <Fragment key={g.ym || 'no-date'}>
                  <h3 style={band} data-testid="documents-agreements-month">
                    {g.label}
                    <span style={bandCount}>{agreementCountWords(g.rows.length)}</span>
                  </h3>
                  <div>
                    {g.rows.map((row) => {
                      const t = agreementTag(row)
                      const colors = AGREEMENT_GROUP_COLORS[t.group]
                      const name = agreementName(row)
                      const door = agreementDoor(row)
                      const chip = agreementStateChip(row, today)
                      const chipColors = AGREEMENT_STATE_COLORS[chip.tone]
                      const jobTitle = agreementJobTitle(row)
                      const tail = agreementJobTail(row)
                      const dayWords = agreementDayWords(row, today)
                      const acts = agreementCanBeSentAgain(row)
                      const sending = busyAct === `send:${row.id}`
                      const linking = busyAct === `link:${row.id}`
                      return (
                        <div key={row.id} style={line} data-testid="documents-agreements-row">
                          <div style={lineLeft}>
                            <span style={{ ...tag, background: colors.background, color: colors.color }}>{t.words}</span>
                            {door.kind === 'people-contracts' || door.kind === 'gc' ? (
                              <Link to={door.to} style={{ ...documentsLinkButton, display: 'inline' }}>
                                {name}
                              </Link>
                            ) : door.kind === 'none' ? (
                              <span style={nameText}>{name}</span>
                            ) : (
                              <button type="button" style={documentsLinkButton} onClick={() => void open(row)}>
                                {name}
                              </button>
                            )}
                            <span style={subLine}>
                              With <strong style={{ color: 'var(--text-700)', fontWeight: 600 }}>{row.with_name || 'no name on file'}</strong>
                              {jobTitle ? (
                                <>
                                  {' · '}
                                  {row.job_id ? (
                                    <Link to={`/jobs?edit=${row.job_id}`} style={jobLink}>
                                      {jobTitle}
                                    </Link>
                                  ) : (
                                    jobTitle
                                  )}
                                </>
                              ) : null}
                              {jobTitle && tail ? ` · ${tail}` : null}
                            </span>
                          </div>
                          <div style={lineRight}>
                            <span style={{ ...stateChip, background: chipColors.background, color: chipColors.color }}>{chip.words}</span>
                            {dayWords ? <span style={day}>{dayWords}</span> : null}
                            {acts ? (
                              <>
                                <button type="button" style={sending ? actBusy : documentsQuietButton} disabled={busyAct != null} onClick={() => void openSendAgain(row)}>
                                  {sending ? 'Opening…' : SEND_AGAIN_LABEL}
                                </button>
                                <button type="button" style={linking ? actBusy : documentsQuietButton} disabled={busyAct != null} onClick={() => void copySigningLink(row)}>
                                  {linking ? 'Making the link…' : COPY_SIGNING_LINK_LABEL}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Fragment>
              ))}
              {more ? (
                <div>
                  <button type="button" style={documentsQuietButton} onClick={() => setLimit((n) => n + AGREEMENTS_PAGE)}>
                    Show more
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {!embedded ? (
            <p style={quiet} data-testid="documents-agreements-doors">
              A job with no contract is in the Contract sweep, under Tools on the{' '}
              <Link to={AGREEMENTS_EMPTY_PAGE.to} style={doorLink}>
                Pipeline
              </Link>
              . An accepted estimate is on the{' '}
              <Link to="/documents?tab=estimates" style={doorLink}>
                Estimates
              </Link>{' '}
              tab.
            </p>
          ) : null}
        </>
      )}
      <JobContractModal
        open={contractWindow != null}
        onClose={() => setContractWindow(null)}
        job={contractWindow?.job ?? null}
        initialRecordId={contractWindow?.recordId ?? null}
        onChanged={retry}
      />
      {signedDocId != null ? (
        <Suspense fallback={null}>
          <PersonContractSignedRecordModal open onClose={() => setSignedDocId(null)} documentId={signedDocId} />
        </Suspense>
      ) : null}
      {sendAgain != null ? (
        <Suspense fallback={null}>
          <ContractSendWindow
            again
            target={sendAgain.facts.target}
            docId={sendAgain.documentId}
            initialEmail={sendAgain.facts.initialEmail}
            sender={sendAgain.facts.sender}
            personId={sendAgain.facts.personId}
            onClose={() => setSendAgain(null)}
            onSent={() => {
              setSendAgain(null)
              retry()
            }}
          />
        </Suspense>
      ) : null}
      {workOrder != null ? (
        <Suspense fallback={null}>
          <WorkOrderAssemblerModal
            open
            onClose={() => setWorkOrder(null)}
            jobs={[workOrder.job]}
            initial={{ commitmentId: workOrder.commitmentId, jobId: workOrder.job.id }}
            authUserId={user?.id}
            onChanged={retry}
          />
        </Suspense>
      ) : null}
    </section>
  )
}

export default DocumentsAgreementsTab
