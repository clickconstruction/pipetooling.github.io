/**
 * The money line under a won bid (punch list #129, v2.5647): once a job exists from the bid, where it stands on money
 * for the job's people (`is_job_people`: the office, the job's account manager, the bid's estimator or account manager),
 * who read no job row of their own: the job, its stage, what is still open after the payment rule, the customer's
 * latest word and how far past it the day is, worked out by `lib/bids/bidMoneyLine.ts` from one bid-gated read
 * (`useBidMoneyStrip`). Two doors: the customer's speech bubble opens the customer's door over the page (the Pipeline
 * row's sheet, `JobCustomerSheet`), and **Send the pay page** opens the same sheet already on Text or Email with the
 * open bill's pay page as the box's `{bill}`, since the bill rows are not the person's to read. **Write down their
 * word** (v2.5648) opens the Pipeline's own sheet on the job: a day they will pay by, or that they say they paid.
 */
import { useCallback, useState, type CSSProperties } from 'react'
import { useCustomerProfileModal } from '../../contexts/CustomerProfileModalContext'
import { useBidMoneyStrip } from '../../hooks/useBidMoneyStrip'
import { bidMoneyWords, canSendPayPage, payPageKind, type BidMoneyLine as Line, type BidMoneyTone } from '../../lib/bids/bidMoneyLine'
import { JobCustomerSheet } from '../jobs/JobCustomerSheet'
import { BidMoneyTrail } from './BidMoneyTrail'
import SetPromisedPayDateModal from '../jobs/SetPromisedPayDateModal'
import { MessagesButton } from '../messages/MessagesButton'

const TONES: Record<BidMoneyTone, { bg: string; border: string; strong: string }> = {
  quiet: { bg: 'var(--bg-subtle)', border: 'var(--border)', strong: 'var(--text-strong)' },
  amber: { bg: 'var(--bg-amber-tint)', border: 'var(--border-amber)', strong: 'var(--text-amber-700)' },
  red: { bg: 'var(--bg-red-tint)', border: 'var(--border-red)', strong: 'var(--text-red-700)' },
  green: { bg: 'var(--bg-green-tint)', border: 'var(--border-green)', strong: 'var(--text-green-700)' },
}

const pill: CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', borderRadius: 9999, border: '1px solid var(--border-green)', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1.6 }
const btn: CSSProperties = { padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }
const muted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

export interface BidMoneyLineProps {
  bidId: string
  /** For a smoke, and for the Money lens (v2.5651): the line, in place of the read. */
  line?: Line | null
  loaded?: boolean
  /** The lens's page-wide read, told after a word is written. */
  onChanged?: () => void
  /** The lens draws its own first column; the line then leaves the stage and the number to it. */
  compact?: boolean
}

export function BidMoneyLine({ bidId, line: given, loaded: givenLoaded, onChanged, compact = false }: BidMoneyLineProps) {
  const strip = useBidMoneyStrip(given === undefined ? bidId : null)
  const line = given === undefined ? strip.line : given
  const loaded = given === undefined ? strip.loaded : (givenLoaded ?? true)
  const customerProfile = useCustomerProfileModal()
  const [door, setDoor] = useState<{ kind?: 'text' | 'email' } | null>(null)
  const [word, setWord] = useState(false)
  const [trail, setTrail] = useState(false)
  const loadBill = useCallback(async () => line?.payUrl ?? null, [line])
  if (!loaded || !line) return null
  const words = bidMoneyWords(line)
  const tone = TONES[line.tone]
  const sheetJob = {
    id: line.job.id,
    job_name: line.job.name,
    hcp_number: line.job.number,
    click_number: '',
    status: line.job.status ?? 'waiting',
    created_at: line.job.createdAt,
    customer_id: line.job.customerId,
    customer_name: line.job.customerName,
    customer_phone: line.job.customerPhone,
    customer_email: line.job.customerEmail,
  }
  return (
    <div data-bid-money-line={bidId} data-bid-money-tone={line.tone} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.5rem', width: '100%', padding: '0.3rem 0.6rem', borderRadius: 8, border: `1px solid ${tone.border}`, background: tone.bg, fontSize: '0.8125rem' }}>
      {compact ? null : (
        <>
          <span style={pill}>{line.job.number || '—'}</span>
          <span style={{ fontWeight: 600 }}>{words.stage}</span>
          <span style={muted}>·</span>
        </>
      )}
      <span style={{ fontWeight: line.open ? 700 : 500, color: line.open ? tone.strong : 'var(--text-muted)' }} data-bid-money-open>
        {words.money}
      </span>
      {words.word ? (
        <>
          <span style={muted}>·</span>
          <span style={{ color: line.tone === 'red' ? tone.strong : 'var(--text-base)', fontWeight: line.tone === 'red' ? 700 : 500 }} data-bid-money-word>
            {words.word}
          </span>
          {words.by ? <span style={muted}>· {words.by}</span> : null}
        </>
      ) : null}
      {line.job.customerId ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
          {canSendPayPage(line) ? (
            <button type="button" onClick={() => setDoor({ kind: payPageKind(line) })} style={{ ...btn, borderColor: 'var(--border-orange)', color: 'var(--text-orange-700)' }} data-bid-money-pay-page title="Open a text or an email to the customer with the open bill's pay page filled in">
              Send the pay page
            </button>
          ) : null}
          <MessagesButton customerId={line.job.customerId} customerName={line.job.customerName} onPressInstead={() => setDoor({})} />
        </span>
      ) : null}
      {line.open != null && line.open > 0 ? (
        <button type="button" onClick={() => setWord(true)} style={{ ...btn, borderColor: 'var(--text-link)', color: 'var(--text-link)' }} data-bid-money-word-press title="A day they will pay by, or that they say they paid">
          Write down their word
        </button>
      ) : null}
      {word ? (
        <SetPromisedPayDateModal
          jobId={line.job.id}
          jobLabel={`${line.job.number ? `#${line.job.number} \u00b7 ` : ''}${line.job.name || 'Job'}`}
          initialYmd={line.promise && line.promise.kind !== 'paid_claim' ? line.promise.promisedYmd : null}
          onClose={() => setWord(false)}
          onSaved={() => {
            strip.reload()
            onChanged?.()
          }}
        />
      ) : null}
      {line.bills.length > 0 ? (
        <button type="button" onClick={() => setTrail(true)} style={{ ...btn, border: 'none', color: 'var(--text-muted)', textDecoration: 'underline dotted', textUnderlineOffset: 3, padding: '0.15rem 0.3rem' }} data-bid-money-trail-press title="The bills, the payments, the customer's words and their lines on this job, on one timeline">
          Trail
        </button>
      ) : null}
      {trail ? <BidMoneyTrail line={line} onClose={() => setTrail(false)} /> : null}
      {door ? (
        <JobCustomerSheet
          job={sheetJob}
          onClose={() => setDoor(null)}
          onOpenRecord={customerProfile?.openCustomerProfile}
          initialKind={door.kind}
          loadBill={loadBill}
          onSent={() => setDoor(null)}
        />
      ) : null}
    </div>
  )
}
