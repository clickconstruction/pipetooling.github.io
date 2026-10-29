/**
 * Questions on a record (punch list #208 PR 4b): the section a bid's window and a job's window draw
 * under their own head, *Questions on this bid* / *Questions on this job*, with the two presses,
 * **Ask the estimators** and **Ask Dispatch**, and the log of what was asked about the record, open
 * first with the wait, then answered with the words, the same rows the Development page's Questions
 * card draws (`QuestionRow`). The presses open the page's Ask sheet with this record as its one
 * About and the lane chosen; the send writes the lane's own request naming the record, so the inbox
 * row carries it and the Development page lists it under Questions. On a job, a question asked on
 * the bid it came from shows too, marked *asked on BP418*. Drawn for the office team, who read every
 * question that names a record; the words and the order come from `lib/developments/recordQuestions.ts`.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth, type UserRole } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerNumberLabel, formatJobLedgerNumberLabel, resolveBidLedgerPrefix, resolveJobLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'
import { askRow, askSentWords, type AskDraft, type AskLane } from '../../lib/developments/ask'
import { sendAsk } from '../../lib/developments/askWrites'
import { fetchRecordQuestions, type RecordQuestionsRead } from '../../lib/developments/fetchRecordQuestions'
import { markAskedOn, RECORD_LANDS_WITH, RECORD_QUESTIONS_TITLE, recordAskAbout, recordAskKey, recordPieceLabel, recordQuestionsMeta, recordQuestionsOffered, sortQuestions, type RecordPiece } from '../../lib/developments/recordQuestions'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { formatErrorMessage } from '../../utils/errorHandling'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { DevelopmentAskSheet, type AskAboutOption, type AskPreset } from './DevelopmentAskSheet'
import { QuestionRow } from './DevelopmentSideCards'
import { SmallButton } from './developmentPageBits'

export type RecordQuestionsJob = {
  id: string
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  service_type_id: string | null
  /** The bid the job came from (`jobs_ledger.bid_id`): its questions show here too, marked. */
  linkedBid?: { id: string; bid_number: string | null; project_name: string | null; service_type_id: string | null } | null
}

export type RecordQuestionsBid = { id: string; bid_number: string | null; project_name: string | null; service_type_id: string | null }

export type RecordQuestionsRecord = { kind: 'job'; job: RecordQuestionsJob } | { kind: 'bid'; bid: RecordQuestionsBid }

/** The reads and the write, swappable for a smoke. */
export type RecordQuestionsIo = { read: typeof fetchRecordQuestions; send: typeof sendAsk }

/** The sheet's layer from a record's window: above the Job window (1010) and the Bid window (1000) it opens over. */
const RECORD_ASK_Z = 1040

const SECTION_LABEL: CSSProperties = { fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }

export function RecordQuestions({ record, role, io, onAskOpenChange }: { record: RecordQuestionsRecord; role: UserRole | null | undefined; io?: Partial<RecordQuestionsIo>; /** The window it sits in may hold its own Escape while the sheet is open. */ onAskOpenChange?: (open: boolean) => void }) {
  const offered = recordQuestionsOffered(role)
  const prefixes = useLedgerPrefixMap()
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const read = io?.read ?? fetchRecordQuestions
  const send = io?.send ?? sendAsk

  const piece: RecordPiece = useMemo(() => {
    if (record.kind === 'job') {
      const j = record.job
      return { kind: 'job', id: j.id, label: recordPieceLabel(formatJobLedgerNumberLabel(resolveJobLedgerPrefix(j.service_type_id, prefixes), j.hcp_number, j.click_number), j.job_name) }
    }
    const b = record.bid
    return { kind: 'bid', id: b.id, label: recordPieceLabel(formatBidLedgerNumberLabel(resolveBidLedgerPrefix(b.service_type_id, prefixes), b.bid_number), b.project_name) }
  }, [record, prefixes])
  const fromBid = useMemo(() => {
    if (record.kind !== 'job' || !record.job.linkedBid) return null
    const b = record.job.linkedBid
    return { id: b.id, label: recordPieceLabel(formatBidLedgerNumberLabel(resolveBidLedgerPrefix(b.service_type_id, prefixes), b.bid_number), b.project_name) }
  }, [record, prefixes])

  const [data, setData] = useState<RecordQuestionsRead | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await read({ kind: piece.kind, id: piece.id }, fromBid?.id ?? null))
      setFailure(null)
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'The questions did not load.'))
    } finally {
      setLoading(false)
    }
  }, [read, piece.kind, piece.id, fromBid?.id])
  useEffect(() => {
    if (!offered) return
    void load()
  }, [offered, load])

  // The sheet: this record as its one About, the lane the press chose.
  const [ask, setAsk] = useState<AskPreset | null>(null)
  const [asking, setAsking] = useState(false)
  useEffect(() => {
    onAskOpenChange?.(ask !== null)
    return () => onAskOpenChange?.(false)
  }, [ask, onAskOpenChange])
  const options: AskAboutOption[] = useMemo(() => [{ key: recordAskKey(piece), label: piece.label, about: recordAskAbout(piece), group: piece.kind === 'job' ? 'jobs' : 'bids' }], [piece])
  const openAsk = (lane: AskLane) => setAsk({ lane, aboutKey: recordAskKey(piece) })
  const sendDraft = async (draft: AskDraft): Promise<boolean> => {
    if (!user?.id) {
      showToast('Sign in first.', 'error', 5000)
      return false
    }
    setAsking(true)
    try {
      const out = await send(draft.lane, askRow(draft, null, piece.label, user.id))
      const words = askSentWords(draft, piece.label)
      showToast(out.pushed ? words : `${words} The push did not go: ${out.pushError ?? 'no reason given'}.`, out.pushed ? 'success' : 'warning', 7000)
      await load()
      return true
    } catch (e) {
      showToast(`Not asked: ${formatErrorMessage(e)}`, 'error', 6000)
      return false
    } finally {
      setAsking(false)
    }
  }

  if (!offered) return null
  const rows = data ? markAskedOn(sortQuestions(data.requests), piece, fromBid) : []
  const names = data?.names ?? new Map<string, string>()
  return (
    <section aria-label={RECORD_QUESTIONS_TITLE[piece.kind]} data-testid={`record-questions-${piece.kind}`} style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={SECTION_LABEL}>{RECORD_QUESTIONS_TITLE[piece.kind]}</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} data-testid="record-questions-meta">
          {data ? recordQuestionsMeta(data.requests) : loading ? 'reading…' : ''}
        </span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}>
          <SmallButton onClick={() => openAsk('estimators')} title={`Ask the estimators about ${piece.label}: a bid, its plans, its price. The answer comes back here.`}>
            Ask the estimators
          </SmallButton>
          <SmallButton onClick={() => openAsk('dispatch')} title={`Ask Dispatch about ${piece.label}: a crew, a day on site. The answer comes back here.`}>
            Ask Dispatch
          </SmallButton>
        </span>
      </div>
      {failure ? (
        <OfflineRetryPanel failure={failure} onRetry={() => void load()} idempotent surface={`record-questions-${piece.kind}`} />
      ) : rows.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map((r) => (
            <QuestionRow key={r.id} request={r} names={names} askedOn={r.askedOn} />
          ))}
        </div>
      ) : data ? (
        <EmptyState main={`Nothing asked about ${piece.kind === 'job' ? 'this job' : 'this bid'} yet.`} next={{ label: 'Ask the estimators', onPress: () => openAsk('estimators') }} tail="starts the first question." compact />
      ) : null}
      <DevelopmentAskSheet open={ask !== null} preset={ask} options={options} siteName={piece.label} landsWith={RECORD_LANDS_WITH[piece.kind]} zIndex={RECORD_ASK_Z} busy={asking} onSend={sendDraft} onClose={() => setAsk(null)} />
    </section>
  )
}
