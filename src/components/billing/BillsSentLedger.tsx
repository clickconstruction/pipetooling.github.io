import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useAuth } from '../../hooks/useAuth'
import {
  BILLS_SENT_GAP_LABEL,
  BILLS_SENT_PATH,
  BILLS_SENT_ROUTE_CHIPS,
  billsSentAgainWords,
  billsSentByWords,
  billsSentCopyLabel,
  billsSentCsv,
  billsSentCsvFileName,
  billsSentDayExtras,
  billsSentDays,
  billsSentEmptyGood,
  billsSentFilter,
  billsSentGapFilter,
  billsSentGapHeading,
  billsSentGaps,
  billsSentLines,
  billsSentListHtml,
  billsSentPaidWords,
  billsSentPayWords,
  billsSentPhoneWords,
  billsSentRecord,
  billsSentRecordHtml,
  billsSentRecordPath,
  billsSentTiles,
  billsSentTime,
  byHandDayOffered,
  byHandDayPicks,
  byHandFiling,
  byHandOthers,
  byHandOthersHeading,
  byHandOutcome,
  byHandProblem,
  byHandReadBack,
  byHandReadBackLead,
  byHandRecordLabel,
  plural,
  type BillsSentByHandDraft,
  type BillsSentChip,
  type BillsSentGap,
  type BillsSentInput,
  type BillsSentLine,
  type BillsSentPayWords,
  type BillsSentRecord,
  type BillsSentRoute,
  type BillsSentSum,
} from '../../lib/billing/billsSent'
import { readBillHandWays, readBillsSent, recordBillByHand } from '../../lib/billing/billsSentIo'
import { billHandWaysOrBuiltIn } from '../../lib/billing/billHandWays'
import { BillHandWayPicker, type BillHandWaysCtl } from './BillHandWays'
import { formatErrorMessage } from '../../utils/errorHandling'
import { openSentCopy } from '../../lib/sent/sentCopiesIo'
import { openHtmlPrintWindow } from '../../lib/jobsDocuments/printWindow'
import { saveBlobAs } from '../../lib/storageSave'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { AmountSmallCents } from '../AmountSmallCents'
import { THUMB, billLink, chipStyle, jobLink, money, phoneButton, strong, tile, tileSmall } from './billsSentLook'
import { BillsPaidByDay } from './BillsPaidByDay'
import { billsPaidLines, billsPaidSum, type BillsPaidSum } from '../../lib/billing/billsPaidDays'
import { readBillsPaid } from '../../lib/billing/billsPaidIo'
import { companyWeekStartSundayContaining } from '../../utils/dateUtils'
import { WorkedOutValue } from '../valuesInPlace/ValuesInPlace'

/**
 * Bills sent (punch list #327, PR 1): every bill that left the company, newest first under a band per day, one line
 * each time a bill goes. A line says the minute, the bill, the job, the amount, the person and each address, how it
 * went and who pressed send, and opens the copy as it went out. A day's band carries the bills that first went that
 * day and their total. The list is read from the sent copies the app already keeps (`lib/billing/billsSent.ts`), so
 * it starts the day those began, and it says so.
 *
 * PR 2: a send that kept no copy is still a line and says what it lacks (an older email with no address, a bill
 * entered from Housecall Pro with the day only, a text with the pay link). Above the days sits the strip of bills
 * that were made and have no send on record, so a bill that never went is seen and not left off the list.
 *
 * PR 3: an email line says whether it arrived (*Delivered 9:28 AM*, *Opened*, *Bounced. It did not arrive.*), a paid
 * bill says the day, and a red tile counts the sends that did not arrive on a bill still open.
 *
 * PR 4: a bill's name on a line opens that bill's record, every send of it in order, at `?bill=<id>`, so the
 * address is the link to keep or paste. **Print this record** prints it as one page.
 *
 * PR 5: **Print** and **Download CSV** take what the list shows out of the app, in the screen's order and words.
 *
 * PR 6: a row of the strip offers **Say how it went…**: how the bill went, to whom and on what day, saved as a
 * record made by hand. The bill then leaves the strip and reads as a line on that day. The ways it offers are the
 * office's own list (`bill_hand_ways`, punch list #340), read once with the page; the four in code stand in when that
 * read is refused. They are chips, one press to pick, with **＋ Add a way** and **Edit list** beside them
 * (`BillHandWays.tsx`).
 *
 * On a phone (v2.7130): the list comes first. The tiles sit in one row, the chips in one row that slides, the strip
 * folds to one line that opens it, and Print and Download CSV move under the list. A line is three rows and the
 * whole line is the press that opens the bill's record, where the copies and the print have room for a thumb.
 */

/** Sends read per step; *Show older sends* reads the next step. */
const STEP = 300

const input: CSSProperties = { font: 'inherit', fontSize: '0.9375rem', width: '100%', padding: '0.5rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', boxSizing: 'border-box' }
const dayHead: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '0.1rem 0.6rem',
  margin: '0.75rem 0 0.25rem',
  padding: '0.4rem 0.6rem',
  borderRadius: 6,
  background: 'var(--bg-subtle)',
  borderLeft: '3px solid var(--text-blue-700)',
  color: 'var(--text-strong)',
  fontSize: '0.875rem',
  fontWeight: 800,
}
const small: CSSProperties = { color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }
const lineBox: CSSProperties = { display: 'grid', gap: '0.05rem 0.6rem', padding: '0.5rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8125rem', minWidth: 0, marginTop: '0.25rem' }
const press: CSSProperties = { font: 'inherit', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2 }

const ROUTE_COLORS: Readonly<Record<BillsSentRoute, { background: string; color: string }>> = {
  email: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' },
  printed: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  statement: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
  text: { background: 'var(--bg-violet-tint)', color: 'var(--text-violet-700)' },
  housecall_pro: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  by_hand: { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' },
  other: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
}



function Tile({ label, sum, testId, stacked = false }: { label: string; sum: BillsSentSum; testId: string; stacked?: boolean }) {
  return (
    <div style={tile} data-testid={testId}>
      <span style={tileSmall}>{label}</span>
      <b style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>
        {sum.bills} {sum.bills === 1 ? 'bill' : 'bills'}
      </b>{' '}
      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', ...(stacked ? { display: 'block' } : {}) }}><AmountSmallCents value={sum.total} /></span>
    </div>
  )
}

/** The looks of a line's stamp: green is money in, amber is part of it, a dashed box is none yet. */
const STAMP_LOOKS: Readonly<Record<BillsSentPayWords['tone'], CSSProperties>> = {
  paid: { background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', border: '1px solid var(--border-green)', fontWeight: 700 },
  part: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber, var(--border-strong))', fontWeight: 700 },
  open: { color: 'var(--text-700)', border: '1px dashed var(--border-strong)', fontWeight: 600 },
}

/** Who has paid, as a stamp: *✓ Paid Fri, Nov 20*, *Part paid · $1,500.00*, *Not paid*. */
function PayStamp({ words }: { words: BillsSentPayWords }) {
  return (
    <span data-testid="bills-sent-stamp" data-tone={words.tone} style={{ display: 'inline-block', fontSize: '0.75rem', borderRadius: 6, padding: '0.05rem 0.5rem', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', ...STAMP_LOOKS[words.tone] }}>
      {words.tone === 'paid' ? '✓ ' : ''}
      {words.stamp}
      {words.stampAmount != null ? (
        <>
          {' · '}
          <AmountSmallCents value={words.stampAmount} />
        </>
      ) : null}
    </span>
  )
}

/** The small words under a stamp: the way in bold, then when, then what is still out. Null when there is nothing to say. */
function PayHow({ words }: { words: BillsSentPayWords }) {
  if (!words.way && !words.when && words.outAmount == null) return null
  return (
    <span data-testid="bills-sent-pay-how" style={{ fontSize: '0.71875rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
      {words.way ? <b style={{ color: 'var(--text-700)', fontWeight: 600 }}>{words.way}</b> : null}
      {words.way && words.when ? ' · ' : ''}
      {words.when}
      {words.outAmount != null ? (
        <>
          {words.way || words.when ? ' · ' : ''}
          <AmountSmallCents value={words.outAmount} /> out
        </>
      ) : null}
    </span>
  )
}

/** How a send's arrival reads: a bounce is red, the mail service's silence is quiet, and an arrival is plain, since green on this page means money. */
function deliveryStyle(tone: BillsSentLine['deliveryTone']): CSSProperties {
  return { color: tone === 'bad' ? 'var(--text-red-700)' : tone === 'ok' ? 'var(--text-700)' : 'var(--text-muted)', fontWeight: tone === 'bad' ? 600 : 500, marginLeft: 'auto', textAlign: 'right' }
}

function Line({ line, phone, today, onOpen }: { line: BillsSentLine; phone: boolean; today: string; onOpen: (line: BillsSentLine) => void }) {
  const colors = ROUTE_COLORS[line.route]
  const again = billsSentAgainWords(line)
  const time = line.dayOnly ? 'Day only' : billsSentTime(line.atIso)
  const span: CSSProperties = phone ? { gridColumn: '1 / -1', minWidth: 0 } : { gridColumn: '2 / -1', minWidth: 0 }
  const kept = !!line.copy?.copyPath
  const by = billsSentByWords(line)
  const pay = billsSentPayWords(line, today)
  // A line with no payment state keeps the word it had: a bill the page knows is paid and nothing more.
  const paid = pay ? '' : billsSentPaidWords(line)
  // The money column: the amount, then who has paid, then how. The address beside it keeps to its own column.
  // The column is three lines beside two rows: the second row takes the slack, so the bill and its address stay together.
  const beside: CSSProperties = pay && !phone ? { gridColumn: '2', minWidth: 0 } : span
  // The payer is on the line above: the name is said again only when the copy went to someone else, or names no address.
  const toName = line.toAddresses.length > 0 && line.toName === line.payer ? '' : line.toName
  return (
    <div data-testid="bills-sent-line" style={{ ...lineBox, gridTemplateColumns: phone ? 'minmax(0, 1fr) auto' : '4.6rem minmax(0, 1fr) auto', ...(pay && !phone ? { gridTemplateRows: 'auto 1fr' } : {}), ...(line.stillMissed ? { borderColor: 'var(--text-red-700)' } : {}) }}>
      <div style={phone ? { ...strong, gridColumn: '1 / -1', fontVariantNumeric: 'tabular-nums' } : { ...strong, gridColumn: '1', gridRow: '1 / span 3', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{time}</div>
      <div style={{ minWidth: 0, overflowWrap: 'anywhere', ...(phone ? {} : { gridColumn: '2', gridRow: '1' }) }}>
        {line.billId ? (
          <Link to={billsSentRecordPath(line.billId)} style={billLink} title="Open every send of this bill">
            {line.what}
          </Link>
        ) : (
          <b style={strong}>{line.what}</b>
        )}
        {line.jobWords ? (
          <>
            {' · '}
            {line.jobTo ? (
              <Link to={line.jobTo} style={jobLink}>
                {line.jobWords}
              </Link>
            ) : (
              line.jobWords
            )}
          </>
        ) : null}
        {line.payer ? ` · ${line.payer}` : ''}
      </div>
      <div data-testid="bills-sent-money" style={{ display: 'grid', gap: '0.1rem', justifyItems: 'end', alignContent: 'start', minWidth: 0, ...(phone ? {} : { gridColumn: '3', gridRow: pay ? '1 / span 2' : '1' }) }}>
        <span style={line.counts ? money : { ...money, color: 'var(--text-muted)' }}>{line.amount != null ? <AmountSmallCents value={line.amount} /> : ''}</span>
        {pay ? <PayStamp words={pay} /> : null}
        {pay ? <PayHow words={pay} /> : null}
      </div>
      {line.toAddresses.length > 0 || line.toName ? (
        <div style={{ ...beside, color: 'var(--text-700)', overflowWrap: 'anywhere' }} data-testid="bills-sent-to">
          To {toName}
          {toName && line.toAddresses.length > 0 ? ' · ' : ''}
          <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{line.toAddresses.join(', ')}</span>
          {line.copyTo.length > 0 ? (
            <>
              {' · copy to '}
              <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{line.copyTo.join(', ')}</span>
            </>
          ) : null}
        </div>
      ) : null}
      {line.note ? <div style={{ ...span, color: 'var(--text-700)' }}>{line.note}</div> : null}
      <div style={{ ...span, display: 'flex', flexWrap: 'wrap', gap: '0.15rem 0.5rem', alignItems: 'center', color: 'var(--text-muted)' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, borderRadius: 999, padding: '0.05rem 0.5rem', whiteSpace: 'nowrap', background: colors.background, color: colors.color }}>{line.routeWords}</span>
        {by ? <span>{by}</span> : null}
        {again ? <span>{again}</span> : null}
        {paid ? <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{paid}</span> : null}
        {kept ? (
          <button type="button" style={press} onClick={() => onOpen(line)} title="Open the copy as it went out">
            {line.route === 'printed' ? 'Copy as printed' : 'Copy as sent'}
          </button>
        ) : line.copy ? (
          <span style={{ color: 'var(--text-amber-800)' }}>The copy was not kept. This line is the record.</span>
        ) : null}
        {/* Whether it arrived sits at the right edge of the row, under the money column (the owner, 2026-11-23). */}
        {line.delivery ? (
          <span data-testid="bills-sent-delivery" style={deliveryStyle(line.deliveryTone)}>
            {line.delivery}
          </span>
        ) : null}
      </div>
    </div>
  )
}

const phoneCard: CSSProperties = { display: 'block', padding: '0.6rem 0.7rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.875rem', minWidth: 0, marginTop: '0.3rem', color: 'var(--text-base)', textDecoration: 'none' }

/**
 * A line on a phone: the time, how it went and the amount, then the work, then where it went and whether it
 * arrived. A bill's line is one press, the whole of it, that opens the bill's record. A line that is no bill's
 * (a statement) keeps its own press for the copy.
 */
function PhoneLine({ line, today, onOpen }: { line: BillsSentLine; today: string; onOpen: (line: BillsSentLine) => void }) {
  const colors = ROUTE_COLORS[line.route]
  const words = billsSentPhoneWords(line)
  const by = billsSentByWords(line)
  const pay = billsSentPayWords(line, today)
  const paid = pay ? '' : billsSentPaidWords(line)
  const bar: CSSProperties | null = pay
    ? {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.15rem 0.5rem',
        margin: '0.4rem -0.7rem -0.6rem',
        padding: '0.4rem 0.7rem',
        borderTop: `1px solid ${pay.tone === 'paid' ? 'var(--border-green)' : pay.tone === 'part' ? 'var(--border-amber, var(--border-strong))' : 'var(--border)'}`,
        borderRadius: '0 0 9px 9px',
        background: pay.tone === 'paid' ? 'var(--bg-green-tint)' : pay.tone === 'part' ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)',
        color: pay.tone === 'paid' ? 'var(--text-green-800)' : pay.tone === 'part' ? 'var(--text-amber-800)' : 'var(--text-700)',
        fontSize: '0.8125rem',
        fontVariantNumeric: 'tabular-nums',
      }
    : null
  const card: CSSProperties = line.stillMissed ? { ...phoneCard, borderColor: 'var(--text-red-700)' } : phoneCard
  const body = (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.15rem 0.45rem' }}>
        <b style={{ ...strong, fontVariantNumeric: 'tabular-nums' }}>{line.dayOnly ? 'Day only' : billsSentTime(line.atIso)}</b>
        <span style={{ fontSize: '0.6875rem', fontWeight: 700, borderRadius: 999, padding: '0.05rem 0.5rem', whiteSpace: 'nowrap', background: colors.background, color: colors.color }}>{line.routeWords}</span>
        {by ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{by}</span> : null}
        <span style={{ ...(line.counts ? money : { ...money, color: 'var(--text-muted)' }), marginLeft: 'auto' }}>{line.amount != null ? <AmountSmallCents value={line.amount} /> : ''}</span>
      </div>
      <div style={{ ...strong, fontWeight: 600, overflowWrap: 'anywhere', marginTop: '0.15rem' }}>{words.main}</div>
      {words.to ? <div style={{ color: 'var(--text-700)', fontSize: '0.8125rem', overflowWrap: 'anywhere', marginTop: '0.1rem' }}>{words.to}</div> : null}
      {line.delivery || words.again || paid ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 0.5rem', color: 'var(--text-700)', fontSize: '0.8125rem', marginTop: '0.05rem' }} data-testid="bills-sent-line-facts">
          {words.again ? <span>{words.again}</span> : null}
          {paid ? <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{paid}</span> : null}
          {line.delivery ? (
            <span data-testid="bills-sent-delivery" style={deliveryStyle(line.deliveryTone)}>
              {line.delivery}
            </span>
          ) : null}
        </div>
      ) : null}
      {line.note ? <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '0.1rem' }}>{line.note}</div> : null}
      {pay && bar ? (
        <div style={bar} data-testid="bills-sent-pay-bar" data-tone={pay.tone}>
          <b style={{ fontWeight: 800 }}>
            {pay.tone === 'paid' ? '✓ ' : ''}
            {pay.stamp}
            {pay.stampAmount != null ? (
              <>
                {' · '}
                <AmountSmallCents value={pay.stampAmount} />
              </>
            ) : null}
          </b>
          <span style={{ marginLeft: 'auto', color: 'var(--text-700)', textAlign: 'right' }}>
            {[pay.way, pay.when].filter(Boolean).join(' · ')}
            {pay.outAmount != null ? (
              <>
                {pay.way || pay.when ? ' · ' : ''}
                <AmountSmallCents value={pay.outAmount} /> out
              </>
            ) : null}
          </span>
        </div>
      ) : null}
    </>
  )
  if (line.billId) {
    return (
      <Link to={billsSentRecordPath(line.billId)} data-testid="bills-sent-line" style={card}>
        {body}
      </Link>
    )
  }
  return (
    <div data-testid="bills-sent-line" style={card}>
      {body}
      {line.copy?.copyPath ? (
        <button type="button" style={{ ...phoneButton, marginTop: '0.4rem' }} onClick={() => onOpen(line)}>
          {line.route === 'printed' ? 'Copy as printed' : 'Copy as sent'}
        </button>
      ) : null}
    </div>
  )
}

/** How many open gaps the strip shows before *Show all*. */
const GAPS_SHOWN = 5

const gapBox: CSSProperties = { border: '1px solid var(--border-amber, var(--border-strong))', background: 'var(--bg-amber-tint)', borderRadius: 10, padding: '0.55rem 0.7rem', fontSize: '0.8125rem', minWidth: 0 }
const gapRow: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0 0.6rem', paddingTop: '0.4rem', marginTop: '0.4rem', borderTop: '1px dashed var(--border-strong)' }

const fieldLabel: CSSProperties = { display: 'grid', gap: '0.15rem', fontSize: '0.75rem', color: 'var(--text-700)', minWidth: 0 }
const field: CSSProperties = { font: 'inherit', fontSize: '0.875rem', padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)', minWidth: 0, boxSizing: 'border-box', width: '100%' }

/** A bill a press of several did not record, with the reason the database or the signal gave. */
type ByHandFailure = { billId: string; why: string }

/** A day one press away under the form's date; the pressed one is the day the form holds. */
function dayPick(picked: boolean, phone: boolean): CSSProperties {
  return {
    font: 'inherit',
    fontSize: phone ? '0.8125rem' : '0.75rem',
    padding: '0.15rem 0.6rem',
    minHeight: phone ? 40 : undefined,
    borderRadius: 999,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: picked ? 700 : 500,
    border: `1px solid ${picked ? 'var(--text-strong)' : 'var(--border-strong)'}`,
    background: picked ? 'var(--text-strong)' : 'var(--surface)',
    color: picked ? 'var(--surface)' : 'var(--text-700)',
  }
}

/**
 * The small form under a row of the strip: how the bill went, to whom, the day, and a note. Saving files a record
 * made by hand; the list reads again and the bill moves from the strip to its day. The day opens on the day the bill
 * was made, with **Today** one press away (punch list #340, R1): a bill in the strip may be weeks old, and a record
 * cannot be changed once saved.
 *
 * R2: the person's other bills with no send on record are listed to tick. The button counts what it will record,
 * each bill gets its own record, and the press keeps going past a bill that is refused: the rest save, and the
 * refused bill stays on the strip with its reason (`onRan`).
 *
 * R3: above the button the form reads the record back, the day, the way, the person and the recorder, so the person
 * sees the sentence before a press that cannot be undone. Until the form is whole, that place says what is missing.
 */
function ByHandForm({ gap, others, waysCtl, onSaved, onRan, onClose }: { gap: BillsSentGap; others: BillsSentGap[]; waysCtl: BillHandWaysCtl; onSaved: () => void; onRan: (ran: string[], failed: ByHandFailure[]) => void; onClose: () => void }) {
  const phone = useIsMobile()
  const { showToast } = useToastContext()
  const { profileName } = useAuth()
  const today = todayYmdInAppTz()
  const [draft, setDraft] = useState<BillsSentByHandDraft>(() => ({ how: '', toWhom: gap.payer, wentOnYmd: byHandDayOffered(gap.billedYmd, today), note: '' }))
  const [saving, setSaving] = useState(false)
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const ways = waysCtl.ways
  const problem = byHandProblem(draft, today, ways)
  // A bill recorded since it was ticked has left the strip, and its tick with it.
  const also = others.filter((g) => ticked.has(g.billId))
  const readBack = byHandReadBack(draft, today, profileName ?? '', ways)
  const save = async () => {
    if (problem || saving) return
    setSaving(true)
    try {
      if (also.length === 0) {
        try {
          await recordBillByHand(byHandFiling(gap, draft, ways))
          showToast('Recorded. The bill is on the list on the day it went.', 'success')
          onRan([gap.billId], [])
          onSaved()
        } catch (e) {
          showToast(formatErrorMessage(e, 'The record was not saved.'), 'error')
        }
        return
      }
      // Each bill is its own record. A bill that is refused is named with its reason, and the rest still save.
      const bills = [gap, ...also]
      const failed: ByHandFailure[] = []
      for (const bill of bills) {
        try {
          await recordBillByHand(byHandFiling(bill, draft, ways))
        } catch (e) {
          failed.push({ billId: bill.billId, why: formatErrorMessage(e, 'The record was not saved.') })
        }
      }
      const done = bills.length - failed.length
      const outcome = byHandOutcome(done, failed.length)
      showToast(outcome.line, outcome.tone)
      onRan(
        bills.map((b) => b.billId),
        failed,
      )
      if (done > 0) onSaved()
    } finally {
      setSaving(false)
    }
  }
  const tick = (billId: string, on: boolean) =>
    setTicked((was) => {
      const next = new Set(was)
      if (on) next.add(billId)
      else next.delete(billId)
      return next
    })
  return (
    <div data-testid="bills-sent-by-hand" style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.5rem', marginTop: '0.4rem', padding: '0.5rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <BillHandWayPicker ctl={waysCtl} value={draft.how} onPick={(key) => setDraft((d) => ({ ...d, how: key }))} />
      <label style={fieldLabel}>
        Who it went to
        <input type="text" value={draft.toWhom} onChange={(ev) => setDraft((d) => ({ ...d, toWhom: ev.target.value }))} placeholder="A name, and an address if you have one" style={field} />
      </label>
      <div style={{ display: 'grid', gap: '0.3rem', minWidth: 0, alignContent: 'start' }}>
        <label style={fieldLabel}>
          The day it went
          <input type="date" value={draft.wentOnYmd} max={today} onChange={(ev) => setDraft((d) => ({ ...d, wentOnYmd: ev.target.value }))} style={field} />
        </label>
        <div role="group" aria-label="Days one press away" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {byHandDayPicks(gap.billedYmd, today).map((p) => (
            <button key={p.ymd} type="button" aria-pressed={draft.wentOnYmd === p.ymd} title={p.label === p.short ? undefined : p.label} onClick={() => setDraft((d) => ({ ...d, wentOnYmd: p.ymd }))} style={dayPick(draft.wentOnYmd === p.ymd, phone)}>
              {p.short}
            </button>
          ))}
        </div>
      </div>
      <label style={fieldLabel}>
        A note, if you want one
        <input type="text" value={draft.note} onChange={(ev) => setDraft((d) => ({ ...d, note: ev.target.value }))} style={field} />
      </label>
      {others.length > 0 ? (
        <div data-testid="bills-sent-by-hand-others" style={{ gridColumn: '1 / -1', display: 'grid', gap: '0.2rem', minWidth: 0, padding: '0.45rem 0.55rem', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem', color: 'var(--text-700)', maxHeight: '15rem', overflowY: 'auto' }}>
          <b style={{ color: 'var(--text-strong)' }}>{byHandOthersHeading(others.length, gap.payer)}</b>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tick the ones that went the same way, to the same person, on the same day.</span>
          {others.map((g) => (
            <label key={g.billId} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: '0 0.5rem', alignItems: 'center', minHeight: phone ? THUMB : undefined, cursor: 'pointer', overflowWrap: 'anywhere' }}>
              <input type="checkbox" checked={ticked.has(g.billId)} onChange={(ev) => tick(g.billId, ev.target.checked)} style={{ width: phone ? 20 : undefined, height: phone ? 20 : undefined }} />
              <span>
                <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{g.jobWords || 'Bill'}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {' · '}
                  {g.billedWords}
                  {g.paid ? ' Paid since.' : ''}
                </span>
              </span>
              <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{g.amount != null ? <AmountSmallCents value={g.amount} /> : ''}</b>
            </label>
          ))}
        </div>
      ) : null}
      <div data-testid="bills-sent-by-hand-will" style={{ gridColumn: '1 / -1', minWidth: 0, padding: '0.45rem 0.55rem', borderRadius: 6, border: '1px dashed var(--border-strong)', fontSize: '0.8125rem', color: 'var(--text-700)', overflowWrap: 'anywhere' }}>
        {readBack ? (
          <>
            <b style={{ color: 'var(--text-strong)' }}>{byHandReadBackLead(1 + also.length)}</b> {readBack}
          </>
        ) : (
          problem
        )}
        <span style={{ display: 'block', marginTop: '0.15rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{phone ? 'It cannot be changed once saved.' : 'It is your word, with your name. It cannot be changed once saved.'}</span>
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!!problem || saving}
          style={{ font: 'inherit', fontSize: phone ? '0.875rem' : '0.8125rem', fontWeight: 700, padding: phone ? '0 0.9rem' : '0.35rem 0.8rem', minHeight: phone ? THUMB : undefined, borderRadius: phone ? 8 : 6, border: '1px solid transparent', cursor: problem || saving ? 'default' : 'pointer', background: problem || saving ? DEAD_PRESS_FILL : '#2563eb', color: problem || saving ? DEAD_PRESS_TEXT : '#fff' }}
        >
          {saving ? 'Saving…' : byHandRecordLabel(1 + also.length)}
        </button>
        <button type="button" onClick={onClose} style={phone ? phoneButton : press}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function GapRow({ gap, others, why, waysCtl, onSaved, onRan }: { gap: BillsSentGap; others: BillsSentGap[]; why: string | undefined; waysCtl: BillHandWaysCtl; onSaved: () => void; onRan: (ran: string[], failed: ByHandFailure[]) => void }) {
  const phone = useIsMobile()
  const [saying, setSaying] = useState(false)
  return (
    <div style={gapRow} data-testid="bills-sent-gap">
      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
        <Link to={billsSentRecordPath(gap.billId)} style={billLink} title="Open this bill's record">
          Bill
        </Link>
        {gap.jobWords ? (
          <>
            {' · '}
            {gap.jobTo ? (
              <Link to={gap.jobTo} style={jobLink}>
                {gap.jobWords}
              </Link>
            ) : (
              gap.jobWords
            )}
          </>
        ) : null}
        {gap.payer ? ` · ${gap.payer}` : ''}
      </div>
      <div style={money}>{gap.amount != null ? <AmountSmallCents value={gap.amount} /> : ''}</div>
      <div style={{ gridColumn: '1 / -1', color: 'var(--text-700)' }}>
        {gap.billedWords} {gap.paid ? 'Paid since. The app sent nothing for this bill.' : 'Not paid. The app has no email, text or print for this bill.'}{' '}
        {saying ? null : (
          <button type="button" style={phone ? { ...phoneButton, display: 'block', marginTop: '0.4rem' } : press} onClick={() => setSaying(true)}>
            Say how it went…
          </button>
        )}
      </div>
      {why ? (
        <div data-testid="bills-sent-not-recorded" style={{ gridColumn: '1 / -1', color: 'var(--text-red-700)', fontWeight: 600 }}>
          {why}
        </div>
      ) : null}
      {saying ? <ByHandForm gap={gap} others={others} waysCtl={waysCtl} onSaved={onSaved} onRan={onRan} onClose={() => setSaying(false)} /> : null}
    </div>
  )
}

/**
 * The strip above the days: the open bills with no send on record, then the paid ones behind a press. A bill may
 * have been handed over on site or sent from someone's own mailbox, and the strip says the app cannot know.
 */
function GapStrip({ open, paid, every, expanded, waysCtl, onSaved }: { open: BillsSentGap[]; paid: BillsSentGap[]; every: BillsSentGap[]; expanded: boolean; waysCtl: BillHandWaysCtl; onSaved: () => void }) {
  const [all, setAll] = useState(false)
  const [showPaid, setShowPaid] = useState(false)
  // The bills a press of several did not record, each with its reason, until a later press records them.
  const [notRecorded, setNotRecorded] = useState<Readonly<Record<string, string>>>({})
  const onRan = (ran: string[], failed: ByHandFailure[]) => {
    setNotRecorded((was) => {
      const next = { ...was }
      for (const id of ran) delete next[id]
      for (const f of failed) next[f.billId] = f.why
      return next
    })
    // A bill that was not recorded is shown, wherever on the strip it sat.
    if (failed.length > 0) {
      setAll(true)
      if (failed.some((f) => paid.some((g) => g.billId === f.billId))) setShowPaid(true)
    }
  }
  if (open.length === 0 && paid.length === 0) return null
  const stayed = [...open, ...paid].filter((g) => notRecorded[g.billId]).length
  const row = (g: BillsSentGap) => <GapRow key={g.billId} gap={g} others={byHandOthers(g, every)} why={notRecorded[g.billId]} waysCtl={waysCtl} onSaved={onSaved} onRan={onRan} />
  const shown = all || expanded ? open : open.slice(0, GAPS_SHOWN)
  return (
    <div style={gapBox} data-testid="bills-sent-gaps">
      <b style={{ color: 'var(--text-amber-800)' }}>{open.length > 0 ? billsSentGapHeading(open.length) : 'Every open bill has a send on record'}</b>
      {open.length > 0 ? <div style={{ color: 'var(--text-700)' }}>The app made these bills and sent nothing for them. One may have been handed over or sent from a mailbox the app cannot see.</div> : null}
      {stayed > 0 ? (
        <div data-testid="bills-sent-not-recorded-head" style={{ marginTop: '0.3rem', color: 'var(--text-red-700)', fontWeight: 600 }}>
          {byHandOutcome(0, stayed).head}
        </div>
      ) : null}
      {shown.map(row)}
      {open.length > shown.length ? (
        <div style={{ marginTop: '0.4rem' }}>
          <button type="button" style={press} onClick={() => setAll(true)}>
            Show all {open.length}
          </button>
        </div>
      ) : null}
      {paid.length > 0 ? (
        <div style={{ marginTop: '0.4rem', color: 'var(--text-700)' }}>
          {paid.length === 1 ? '1 more bill was paid with no send on record.' : `${paid.length} more bills were paid with no send on record.`}{' '}
          <button type="button" style={press} onClick={() => setShowPaid((v) => !v)} aria-expanded={showPaid}>
            {showPaid ? 'Hide them' : 'Show them'}
          </button>
        </div>
      ) : null}
      {showPaid ? paid.map(row) : null}
    </div>
  )
}

/** One bill's record: every send of it, newest first, with the copy of each and a print of the whole. */
function RecordPanel({ record, onOpen, onPrint }: { record: BillsSentRecord; onOpen: (line: BillsSentLine) => void; onPrint: () => void }) {
  const phone = useIsMobile()
  return (
    <div data-testid="bills-sent-record" style={{ ...lineBox, display: 'block', padding: '0.7rem 0.8rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem 0.6rem', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-strong)' }}>
          {record.what}
          {record.jobWords ? (
            <>
              {' · '}
              {record.jobTo ? (
                <Link to={record.jobTo} style={jobLink}>
                  {record.jobWords}
                </Link>
              ) : (
                record.jobWords
              )}
            </>
          ) : null}
        </h2>
        <span style={{ ...money, marginLeft: 'auto' }}>{record.amount != null ? <AmountSmallCents value={record.amount} /> : ''}</span>
      </div>
      <p style={{ margin: '0.1rem 0 0.5rem', color: 'var(--text-muted)' }}>{[record.payer, record.stateWords].filter(Boolean).join(' · ')}</p>
      {record.payments.length > 0 ? (
        <div data-testid="bills-sent-record-payments" style={{ margin: '0 0 0.5rem', padding: '0.4rem 0.6rem', borderRadius: 8, background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-green-800)' }}>{record.payments.length === 1 ? 'The payment on this bill' : 'The payments on this bill, oldest first'}</div>
          {record.payments.map((p) => (
            <div key={p.id} data-testid="bills-sent-record-payment" style={{ display: 'flex', flexWrap: 'wrap', gap: '0 0.6rem', alignItems: 'baseline', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
              <WorkedOutValue>{p.when}</WorkedOutValue>
              <span>{p.way}</span>
              <span style={{ marginLeft: 'auto' }}>
                <WorkedOutValue>
                  <AmountSmallCents value={p.amount} />
                </WorkedOutValue>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {record.events.length === 0 ? (
        <p style={{ margin: '0.4rem 0', color: 'var(--text-amber-800)' }} data-testid="bills-sent-record-none">
          This bill has no send on record. The app sent no email, text or print for it.
        </p>
      ) : (
        record.events.map((e) => (
          <div key={e.id} data-testid="bills-sent-record-event" style={{ borderTop: '1px solid var(--border)', padding: '0.4rem 0' }}>
            <div>
              <b style={strong}>{e.when}</b> · {e.head}
            </div>
            <div style={{ color: 'var(--text-700)', overflowWrap: 'anywhere' }}>
              {e.detail}{' '}
              {e.line.copy?.copyPath ? (
                <button type="button" style={phone ? { ...phoneButton, display: 'block', marginTop: '0.35rem' } : press} onClick={() => onOpen(e.line)}>
                  {e.line.route === 'printed' ? 'Copy as printed' : 'Copy as sent'}
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}
      {record.madeWords ? <p style={{ margin: '0.4rem 0 0', paddingTop: '0.4rem', borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>{record.madeWords}</p> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.6rem' }}>
        <button type="button" onClick={onPrint} style={phone ? phoneButton : { ...chipStyle(false), borderRadius: 6, fontWeight: 700, color: 'var(--text-strong)' }}>
          Print this record
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Delivered means their mail server took it. It does not mean someone read it.</span>
      </div>
    </div>
  )
}

export function BillsSentLedger() {
  const { showToast } = useToastContext()
  const phone = useIsMobile()
  const [params, setParams] = useSearchParams()
  const billParam = params.get('bill')
  // The page's two views behind one switch (punch list #422): bills by the day they went, money by the day it came.
  const view: 'sent' | 'paid' = params.get('view') === 'paid' ? 'paid' : 'sent'
  const setView = useCallback(
    (next: 'sent' | 'paid') => {
      setParams((prev) => {
        const to = new URLSearchParams(prev)
        // The second view's own state (its day, its month, its chip) leaves the address with it.
        for (const key of ['view', 'day', 'month', 'how']) to.delete(key)
        if (next === 'paid') to.set('view', 'paid')
        return to
      })
    },
    [setParams],
  )
  // The list is read for the first view and for one bill's record. The second view reads its own month.
  const listWanted = view === 'sent' || !!billParam
  const [route, setRoute] = useState<BillsSentChip>('all')
  const [typed, setTyped] = useState('')
  const [limit, setLimit] = useState(STEP)
  const [data, setData] = useState<BillsSentInput | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(false)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (!listWanted) return
    let cancelled = false
    setReading(true)
    void readBillsSent({ limit })
      .then((read) => {
        if (cancelled) return
        setData(read)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setFailure(recoveryFailureFromError(e, 'The bills sent did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [limit, tries, listWanted])
  const retry = useCallback(() => setTries((n) => n + 1), [])

  // The list under How the bill went, read with the page and again after each change to it. Until it answers, and
  // when it is refused, the four in code, which cannot be changed.
  const [waysRead, setWaysRead] = useState(() => billHandWaysOrBuiltIn(null))
  const reloadWays = useCallback(async () => {
    const read = await readBillHandWays()
    // A read that fails after the list was shown keeps what is on the screen.
    setWaysRead((was) => (read == null && was.fromTable ? was : billHandWaysOrBuiltIn(read)))
  }, [])
  useEffect(() => {
    void reloadWays()
  }, [reloadWays])
  const waysCtl = useMemo<BillHandWaysCtl>(() => ({ ways: waysRead.ways, canEdit: waysRead.fromTable, reload: reloadWays }), [waysRead, reloadWays])

  const today = todayYmdInAppTz()
  // What came in since the Sunday that began this week, for the tile that opens the second view. Its own small
  // read by day, so a payment on a bill older than the list is counted. Best effort: no answer, no tile.
  const [paidWeek, setPaidWeek] = useState<BillsPaidSum | null>(null)
  useEffect(() => {
    if (view !== 'sent' || billParam) return
    let cancelled = false
    void readBillsPaid({ from: companyWeekStartSundayContaining(today) ?? today, to: today })
      .then((read) => {
        if (!cancelled) setPaidWeek(billsPaidSum(billsPaidLines(read)))
      })
      .catch(() => {
        if (!cancelled) setPaidWeek(null)
      })
    return () => {
      cancelled = true
    }
  }, [view, billParam, today, tries])
  const lines = useMemo(() => (data ? billsSentLines(data, { todayYmd: today }) : []), [data, today])
  const tiles = useMemo(() => billsSentTiles(lines, today), [lines, today])
  const shown = useMemo(() => billsSentFilter(lines, route, typed), [lines, route, typed])
  const days = useMemo(() => billsSentDays(shown, today), [shown, today])
  const missed = useMemo(() => lines.filter((l) => l.stillMissed).length, [lines])
  const gaps = useMemo(() => (data ? billsSentGaps(data, lines) : { open: [], paid: [] }), [data, lines])
  // Every bill with no send, whatever the search leaves: the form offers a person's other bills from all of them.
  const everyGap = useMemo(() => [...gaps.open, ...gaps.paid], [gaps])
  const gapsShown = useMemo(() => ({ open: billsSentGapFilter(gaps.open, typed), paid: billsSentGapFilter(gaps.paid, typed) }), [gaps, typed])
  // The strip rides with every bill (All) and is the whole list under its own chip; a route chip shows that route alone.
  const stripVisible = (route === 'all' || route === 'gap') && gapsShown.open.length + gapsShown.paid.length > 0
  const narrowed = route !== 'all' || typed.trim() !== ''
  const good = billsSentEmptyGood(route, typed)
  const clear = () => {
    setTyped('')
    setRoute('all')
  }
  const open = useCallback(
    async (line: BillsSentLine) => {
      if (!line.copy) return
      const ok = await openSentCopy(line.copy, billsSentCopyLabel(line))
      if (!ok) showToast('Could not open the copy. Allow pop-ups for this site and press it again.', 'error')
    },
    [showToast],
  )

  const record = useMemo(() => (billParam && data ? billsSentRecord(billParam, lines, data) : null), [billParam, data, lines])
  const printRecord = () => {
    if (record && !openHtmlPrintWindow(billsSentRecordHtml(record, new Date().toISOString()))) showToast('The print window was blocked. Allow pop-ups for this site and press it again.', 'error')
  }

  if (billParam) {
    return (
      <section aria-label="One bill's record" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <div>
          <Link to={BILLS_SENT_PATH} style={{ color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none', ...(phone ? { display: 'inline-flex', alignItems: 'center', minHeight: THUMB } : {}) }}>
            ← All bills sent
          </Link>
        </div>
        {failure ? <OfflineRetryPanel failure={failure} onRetry={retry} surface="bills-sent" idempotent busy={reading} /> : null}
        {data == null && !failure ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
        ) : record ? (
          <RecordPanel record={record} onOpen={(l) => void open(l)} onPrint={printRecord} />
        ) : data != null ? (
          <EmptyState main="That bill is not on this list." next={{ label: 'See all bills sent', to: BILLS_SENT_PATH }} />
        ) : null}
      </section>
    )
  }

  const switchPress = (pressed: boolean): CSSProperties => ({
    fontFamily: 'inherit',
    fontSize: '0.8125rem',
    fontWeight: pressed ? 700 : 600,
    minHeight: phone ? THUMB : 34,
    border: 'none',
    cursor: 'pointer',
    background: pressed ? 'var(--text-strong)' : 'transparent',
    color: pressed ? 'var(--surface)' : 'var(--text-700)',
  })
  const viewSwitch = (
    <div role="group" aria-label="View" data-testid="bills-sent-view" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
      <button type="button" aria-pressed={view === 'sent'} onClick={() => setView('sent')} style={switchPress(view === 'sent')}>
        By day sent
      </button>
      <button type="button" aria-pressed={view === 'paid'} onClick={() => setView('paid')} style={switchPress(view === 'paid')}>
        By day paid
      </button>
    </div>
  )
  if (view === 'paid') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {viewSwitch}
        <BillsPaidByDay />
      </div>
    )
  }

  // What goes out of the app is what the list shows: the lines the chip and the search leave, and the open gaps with them.
  const outGaps = stripVisible ? gapsShown.open : []
  const shownWords = [BILLS_SENT_ROUTE_CHIPS.find((c) => c.key === route)?.label ?? 'All', typed.trim() ? `“${typed.trim()}”` : ''].filter(Boolean).join(' · ') + '.'
  const printList = () => {
    if (!openHtmlPrintWindow(billsSentListHtml(days, outGaps, { printedAtIso: new Date().toISOString(), shownWords, todayYmd: today }))) showToast('The print window was blocked. Allow pop-ups for this site and press it again.', 'error')
  }
  const saveCsv = () => {
    // The byte order mark lets a spreadsheet read the file's accents and dots as written.
    saveBlobAs(new Blob(['\ufeff', billsSentCsv(shown, outGaps)], { type: 'text/csv;charset=utf-8' }), billsSentCsvFileName(today))
  }
  const nothingShown = shown.length === 0 && outGaps.length === 0
  const outPress: CSSProperties = phone ? phoneButton : { ...chipStyle(false), borderRadius: 6, fontWeight: 700, color: 'var(--text-strong)' }
  // Print and the file: above the list at a desk, under it on a phone, where the list comes first.
  const outRow =
    data != null && !nothingShown ? (
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: phone ? 'flex-start' : 'flex-end' }} data-testid="bills-sent-out">
        <button type="button" onClick={printList} style={outPress}>
          Print
        </button>
        <button type="button" onClick={saveCsv} style={outPress}>
          Download CSV
        </button>
      </div>
    ) : null
  // A tile that counts something to look at is the press that shows it.
  const tilePress: CSSProperties = { ...tile, font: 'inherit', textAlign: 'left', cursor: 'pointer' }
  // On a phone an even count of tiles sits two to a row, so no tile is left alone on a row of its own.
  const tileCount = 2 + (tiles.unpaid.bills > 0 ? 1 : 0) + (paidWeek && paidWeek.payments > 0 ? 1 : 0) + (missed > 0 ? 1 : 0) + (gaps.open.length > 0 ? 1 : 0)
  // On a phone the strip is one line until it is asked for, so the list is on the first screen.
  const stripFolded = phone && route === 'all'

  return (
    <section aria-label="Bills sent" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {viewSwitch}
      {phone ? null : outRow}
      <div style={{ display: 'grid', gridTemplateColumns: phone ? (tileCount % 2 === 0 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(5.2rem, 1fr))') : 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '0.4rem' }}>
        <Tile label="Today" sum={tiles.today} testId="bills-sent-tile-today" stacked={phone} />
        <Tile label="This week" sum={tiles.week} testId="bills-sent-tile-week" stacked={phone} />
        {tiles.unpaid.bills > 0 ? (
          <button type="button" onClick={() => setRoute('unpaid')} style={tilePress} data-testid="bills-sent-tile-unpaid" title="Show the bills on this list that are not paid in full">
            <span style={tileSmall}>Not paid</span>
            <b style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>
              {tiles.unpaid.bills} {tiles.unpaid.bills === 1 ? 'bill' : 'bills'}
            </b>{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', ...(phone ? { display: 'block' } : {}) }}>
              <AmountSmallCents value={tiles.unpaid.total} />
            </span>
          </button>
        ) : null}
        {paidWeek && paidWeek.payments > 0 ? (
          <button type="button" onClick={() => setView('paid')} style={{ ...tilePress, background: 'var(--bg-green-tint)', borderColor: 'var(--border-green)' }} data-testid="bills-sent-tile-paid-week" title="See what came in, a day at a time">
            <span style={{ ...tileSmall, color: 'var(--text-green-800)' }}>Paid this week</span>
            <b style={{ color: 'var(--text-strong)', fontSize: '0.9375rem' }}>
              {paidWeek.payments} {paidWeek.payments === 1 ? 'payment' : 'payments'}
            </b>{' '}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', ...(phone ? { display: 'block' } : {}) }}>
              <AmountSmallCents value={paidWeek.total} />
            </span>
          </button>
        ) : null}
        {missed > 0 ? (
          <button type="button" onClick={() => setRoute('missed')} style={{ ...tilePress, background: 'var(--bg-red-tint)', borderColor: 'var(--text-red-700)' }} data-testid="bills-sent-tile-missed">
            <span style={{ ...tileSmall, color: 'var(--text-red-700)' }}>Did not arrive</span>
            <b style={{ color: 'var(--text-red-700)', fontSize: '0.9375rem' }}>{missed}</b>
          </button>
        ) : null}
        {gaps.open.length > 0 ? (
          <button type="button" onClick={() => setRoute('gap')} style={{ ...tilePress, background: 'var(--bg-amber-tint)', borderColor: 'var(--border-amber, var(--border-strong))' }} data-testid="bills-sent-tile-gaps">
            <span style={{ ...tileSmall, color: 'var(--text-amber-800)' }}>{BILLS_SENT_GAP_LABEL}</span>
            <b style={{ color: 'var(--text-amber-800)', fontSize: '0.9375rem' }}>{gaps.open.length}</b>
          </button>
        ) : null}
      </div>
      <input type="search" value={typed} onChange={(ev) => setTyped(ev.target.value)} placeholder={phone ? 'Find a bill' : 'Find a bill: a job, a customer, an address, a bill number'} aria-label="Find a bill" style={phone ? { ...input, fontSize: '1rem', minHeight: THUMB } : input} />
      <div role="group" aria-label="How it went" style={phone ? { display: 'flex', gap: '0.35rem', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '0.15rem', WebkitOverflowScrolling: 'touch' } : { display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
        {BILLS_SENT_ROUTE_CHIPS.map((c) => (
          <button key={c.key} type="button" aria-pressed={route === c.key} onClick={() => setRoute(c.key)} style={chipStyle(route === c.key, phone)}>
            {c.label}
          </button>
        ))}
      </div>
      {failure ? <OfflineRetryPanel failure={failure} onRetry={retry} surface="bills-sent" idempotent busy={reading} /> : null}
      {stripVisible && stripFolded ? (
        gapsShown.open.length > 0 ? (
          <button type="button" onClick={() => setRoute('gap')} data-testid="bills-sent-gaps-fold" style={{ ...gapBox, fontFamily: 'inherit', fontSize: '0.875rem', textAlign: 'left', cursor: 'pointer', minHeight: THUMB, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <b style={{ color: 'var(--text-amber-800)', flex: '1 1 auto' }}>{billsSentGapHeading(gapsShown.open.length)}</b>
            <span style={{ color: 'var(--text-amber-800)', textDecoration: 'underline', textUnderlineOffset: 2, whiteSpace: 'nowrap' }}>Show</span>
          </button>
        ) : null
      ) : stripVisible ? (
        <GapStrip open={gapsShown.open} paid={gapsShown.paid} every={everyGap} expanded={route === 'gap'} waysCtl={waysCtl} onSaved={retry} />
      ) : null}
      {data == null && !failure ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : route === 'gap' && stripVisible ? null : data != null && shown.length === 0 ? (
        <div data-testid="bills-sent-empty">
          {good ? (
            // A chip that lists what still wants someone, with nothing under it: the good state, said as one.
            <EmptyState main={`${emptyWords({ kind: 'waiting', who: good.who }).main} ${good.why}`} next={{ label: 'See every send', onPress: clear }} />
          ) : narrowed ? (
            <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'sends', query: typed.trim() }), { onPress: clear })} />
          ) : (
            <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'bills sent', page: { label: 'Open the Pipeline', tail: 'to send the first.' } }), { to: '/jobs?tab=stages' })} />
          )}
        </div>
      ) : (
        <div>
          {days.map((day) => {
            const extras = billsSentDayExtras(day)
            return (
              <div key={day.ymd || 'none'}>
                <h2 style={dayHead} data-testid="bills-sent-day">
                  <span>{day.label}</span>
                  <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                    {day.sum.bills > 0 ? (
                      <>
                        {plural(day.sum.bills, 'bill')} · <AmountSmallCents value={day.sum.total} />
                      </>
                    ) : (
                      '0 bills'
                    )}
                  </span>
                  {extras ? <span style={small}>{extras}</span> : null}
                  {day.back.bills > 0 ? (
                    <span data-testid="bills-sent-day-back" style={{ flex: '1 0 100%', textAlign: 'right', fontWeight: 500, fontSize: '0.8125rem', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
                      <WorkedOutValue>
                        {day.back.paid} of {day.back.bills}
                      </WorkedOutValue>{' '}
                      paid
                      {day.back.out > 0 ? (
                        <>
                          {' · '}
                          <WorkedOutValue>
                            <AmountSmallCents value={day.back.out} />
                          </WorkedOutValue>{' '}
                          still out
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </h2>
                {day.lines.map((line) =>
                  phone ? <PhoneLine key={line.id} line={line} today={today} onOpen={(l) => void open(l)} /> : <Line key={line.id} line={line} phone={false} today={today} onOpen={(l) => void open(l)} />,
                )}
              </div>
            )
          })}
        </div>
      )}
      {data != null && [data.copies.length, data.stripeRows?.length ?? 0, data.stamps?.length ?? 0].some((n) => n >= limit) ? (
        <div>
          <button type="button" onClick={() => setLimit((n) => n + STEP)} disabled={reading} style={phone ? phoneButton : { ...chipStyle(false), borderRadius: 6 }}>
            {reading ? 'Reading…' : 'Show older sends'}
          </button>
        </div>
      ) : null}
      {phone ? outRow : null}
      {data != null ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.75rem' }} data-testid="bills-sent-foot">
          All times are Central. A day’s total counts each bill once, on the day it first went. Paid and still out count those same bills. Not paid counts every bill on this list that is not paid in full. A send before Oct 5, 2026 has its time and no address, because the app kept no copy then. Delivered means their mail server took it. It does not mean someone read it.
        </p>
      ) : null}
    </section>
  )
}

export default BillsSentLedger
