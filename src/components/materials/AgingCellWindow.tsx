/**
 * The window an aging cell opens (SupplyHousesTab map, extraction step 10): exactly the bills the cell sums, under
 * their job, with the job account in words, and the move window's worked list and its move modal.
 *
 * The JSX moved from `SupplyHousesTab` as it stood. It draws only: its state, reads and writes are the aging engine
 * (`useSupplyHouseAgingWindows`), handed in whole as `aging` and read under the names the tab used, and the doors out
 * of it (a bill's Edit window, the house's Record a payment, the house itself) are the tab's, lent as props.
 */
import { Fragment } from 'react'
import { formatCurrency } from '../../lib/format'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  agingCellModalDoors,
  agingCellRowDoors,
  agingCellTitle,
  buildSupplyHouseAgingMatrix,
  daysPastDue,
  invoicesForAgingCell,
  isMovableAgingInvoice,
} from '../../lib/supplyHouseAging'
import { AgingInvoiceDoor, AgingMakePaymentDoor, AgingRowDoors } from './AgingCellDoors'
import { SUPPLY_MOVE_ASK_AGE, ageState } from '../../lib/ageState'
import { STICKY_MODAL_CLOSE_BUTTON_STYLE, stickyModalHeaderStyle, stickyModalPanelStyle } from '../../lib/stickyModalHeaderStyle'
import {
  creditPairingLine,
} from '../../lib/materials/supplyHouseInvoiceForm'
import { MarkJobAccountOpenedModal } from './MarkJobAccountOpenedModal'
import { openedViaPhrase } from '../../lib/materials/jobSupplyHouseAccounts'
import { AGING_CELL_NO_JOB_HEADING, AGING_MOVE_EMAIL_NO_ACCOUNT, agingCellAccountSplit, agingCellJobStateWords, agingCellJobsLine, agingMoveNoAccountLine, agingMoveNoRepLine, groupAgingCellByJob, type AgingCellJobGroup } from '../../lib/materials/agingCellByJob'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { isSupplyCredit } from '../../lib/supplyHouseDocument'
import { EmptyState } from '../EmptyState'
import type { SupplyHouseAgingWindows } from './useSupplyHouseAgingWindows'
import type { AgingInvoiceRow, SupplyHouseSummaryRow } from './useSupplyHouseAccountsPayable'
import type { SupplyHouse } from './useSupplyHouseInvoiceForm'


/**
 * Format a DATE-only column (YYYY-MM-DD) in the user's locale. `new Date('2026-07-10')` parses
 * as UTC midnight, which renders as the PREVIOUS day in US timezones — parse at local noon.
 */
function formatYmdLocal(ymd: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(ymd + 'T12:00:00') : new Date(ymd)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString()
}

/** The teal "of which on a job account" words, on an aging cell and on a flagged bill's chip. */
export const JOB_ACCOUNT_LINE_TITLE = "Of this, on the house's job account — the owner's debt to collect on, not Click's. The cell keeps the house's total."

export interface AgingCellWindowProps {
  /** The aging windows' engine, whole. */
  aging: SupplyHouseAgingWindows
  agingUnpaidInvoices: AgingInvoiceRow[]
  supplyHouseSummary: SupplyHouseSummaryRow[]
  supplyHousesList: SupplyHouse[]
  agingMatrix: ReturnType<typeof buildSupplyHouseAgingMatrix>
  agingMovable: AgingInvoiceRow[]
  agingTodayYmd: string
  agingCellDoorBusy: string | null
  openInvoiceFromAgingCell: (inv: AgingInvoiceRow, focus: 'invoice-due' | 'invoice-job-search' | null) => Promise<void>
  openPaymentFromAgingCell: (houseId: string) => Promise<void>
  openHouseFromAging: (supplyHouseId: string) => void
}

export function AgingCellWindow({ aging, agingUnpaidInvoices, supplyHouseSummary, supplyHousesList, agingMatrix, agingMovable, agingTodayYmd, agingCellDoorBusy, openInvoiceFromAgingCell, openPaymentFromAgingCell, openHouseFromAging }: AgingCellWindowProps) {
  const {
    agingCellModal,
    setAgingCellModal,
    agingCellJobs,
    agingCellAccounts,
    setAgingCellAccounts,
    agingCellAccountsLoaded,
    agingCellReps,
    agingCellMarkOpenedFor,
    setAgingCellMarkOpenedFor,
    agingCellFlagAnywayFor,
    setAgingCellFlagAnywayFor,
    agingMoveData,
    agingMoveModalFor,
    setAgingMoveModalFor,
    agingMoveAttest,
    setAgingMoveAttest,
    agingMoveBusy,
    agingMoveError,
    setAgingMoveError,
    sendMoveRequest,
    markMovedConfirmed,
    setInvoiceJobAcct,
  } = aging
  if (!agingCellModal) return null
  const { houseId, cell } = agingCellModal
  const isMovableList = cell === 'movable'
  const cellRows = isMovableList
    ? agingMovable.slice().sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    : invoicesForAgingCell(agingUnpaidInvoices, houseId, cell, agingTodayYmd)
  const houseNameOf = (id: string) =>
    supplyHouseSummary.find((r) => r.supply_house_id === id)?.name ??
    supplyHousesList.find((s: SupplyHouse) => s.id === id)?.name ??
    'this house'
  const houseName = houseId ? houseNameOf(houseId) : 'Every house'
  const total = cellRows.reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const isCredits = cell === 'credits'
  const movableToAsk = isMovableList ? cellRows.filter((r) => !agingMoveData.asks[r.id]).length : 0
  const noun = isCredits
    ? cellRows.length === 1 ? 'credit memo' : 'credit memos'
    : cellRows.length === 1 ? 'invoice' : 'invoices'
  // The footer row's modal groups by house, in the matrix's own order (owed desc).
  const groups = houseId && !isMovableList
    ? [{ key: houseId, name: null as string | null, rows: cellRows }]
    : agingMatrix.rows
        .map((r) => ({ key: r.supplyHouseId, name: r.name as string | null, rows: cellRows.filter((inv) => inv.supply_house_id === r.supplyHouseId) }))
        .filter((g) => g.rows.length > 0)
  // v2.5694: the window by job. The strip answers the cell's question first: how much is on a job account. Then
  // each house's rows sit under their job, whose heading says its job-account state in words and holds its press.
  const allocationsOf = (id: string) => agingCellJobs.allocations[id] ?? []
  const accountOf = (jobId: string, hId: string) => (agingCellAccountsLoaded ? agingCellAccounts[`${jobId}:${hId}`] ?? null : undefined)
  const byHouse = groups.map((g) => ({ ...g, byJob: groupAgingCellByJob(g.rows, allocationsOf, accountOf) }))
  const accountSplit = agingCellAccountSplit(cellRows)
  const showSplit = !isMovableList && !isCredits && cellRows.length > 0
  const onPct = accountSplit.onAmount + accountSplit.offAmount > 0 ? (accountSplit.onAmount / (accountSplit.onAmount + accountSplit.offAmount)) * 100 : 0
  const jobsLine = agingCellAccountsLoaded ? agingCellJobsLine(byHouse.flatMap((g) => g.byJob.jobs), houseId ? houseName : null) : ''
  const money = (n: number) => (n < 0 ? `−$${formatCurrency(Math.abs(n))}` : `$${formatCurrency(n)}`)
  const jobLabelOf = (jobId: string) => {
    const d = agingCellJobs.jobs[jobId]
    return d ? { num: effectiveJobLedgerNumber(d.hcp_number, d.click_number) || '', name: d.job_name || '—' } : { num: '', name: jobId.slice(0, 8) }
  }
  const jobsText = (invoiceId: string) =>
    allocationsOf(invoiceId)
      .map((a) => {
        const j = jobLabelOf(a.job_id)
        return `${j.num ? `${j.num} · ` : ''}${j.name} (${a.pct}%)`
      })
      .join(', ')
  // markOnTitle: the row offers Mark it on (with these words on hover) when not flagged and past its window.
  const renderRow = (inv: AgingInvoiceRow, markOnTitle: string | null, note: string | null) => {
    const credit = isSupplyCredit(inv.amount)
    const isOn = inv.on_job_account === true
    // PR 3: a still-current single-job row moves through the move modal, never a bare flag.
    const movableRow = !isOn && isMovableAgingInvoice(inv, allocationsOf(inv.id).length, agingTodayYmd, agingMoveData.notNeeded.has(inv.id) ? 'not_needed' : null)
    const moveAsk = movableRow ? agingMoveData.asks[inv.id] ?? null : null
    const openMoveModal = () => {
      setAgingMoveModalFor(inv.id)
      setAgingMoveAttest(false)
      setAgingMoveError(null)
    }
    const days = inv.due_date && !credit ? daysPastDue(inv.due_date, agingTodayYmd) : null
    const po = inv.purchase_order_number?.trim()
    const poDate = `${po ? `PO ${po} · ` : ''}${formatYmdLocal(inv.invoice_date)}`
    const pair = creditPairingLine(inv, agingUnpaidInvoices)
    // A bill paid in part sits in the cell for what is left on it, and says what it was billed for.
    const partNote = inv.billed != null && Math.abs(inv.billed - inv.amount) > 0.005 ? `left of $${formatCurrency(Math.abs(inv.billed))}` : null
    const rowNote = [inv.is_interest ? 'interest, not a job cost' : null, partNote, pair, note].filter(Boolean).join(' · ')
    return (
      <div key={inv.id} className="aging-win-row">
        <AgingInvoiceDoor invoiceNumber={inv.invoice_number} busy={agingCellDoorBusy === inv.id} onOpen={() => void openInvoiceFromAgingCell(inv, null)} />
        <span className="aging-win-po" title={poDate}>{poDate}</span>
        {/* A credit never wears an age chip — it has a size, not an age (v2.3500). */}
        {credit ? (
          <span className="aging-win-age" />
        ) : !inv.due_date ? (
          <span className="aging-win-age">no due date</span>
        ) : days != null && days > 0 ? (
          <span className={`aging-win-age ${days >= 60 ? 'aging-win-age--old' : 'aging-win-age--late'}`} title={`${days} days past due · due ${formatYmdLocal(inv.due_date)}`}>
            {days} d
          </span>
        ) : (
          <span className="aging-win-age" title={`Due ${formatYmdLocal(inv.due_date)}`}>
            due {Number(inv.due_date.slice(5, 7))}/{Number(inv.due_date.slice(8, 10))}
          </span>
        )}
        <span className={`aging-win-amt${credit ? ' aging-win-amt--credit' : ''}`}>{money(Number(inv.amount ?? 0))}</span>
        <span className="aging-win-rowstate">
          <AgingRowDoors
            doors={agingCellRowDoors(inv, agingCellAccountsLoaded ? allocationsOf(inv.id).length : null)}
            busy={agingCellDoorBusy === inv.id}
            onAddDueDate={() => void openInvoiceFromAgingCell(inv, 'invoice-due')}
            onPickJob={() => void openInvoiceFromAgingCell(inv, 'invoice-job-search')}
          />
          {credit ? null : isOn ? (
            <button type="button" className="aging-win-state aging-win-state--on" onClick={() => void setInvoiceJobAcct(inv, false)} title={`${JOB_ACCOUNT_LINE_TITLE} Press to take it off.`}>
              On it ✓
            </button>
          ) : movableRow ? (
            moveAsk ? (
              (() => {
                const age = ageState(moveAsk.requested_at, undefined, SUPPLY_MOVE_ASK_AGE)
                return (
                  <button
                    type="button"
                    onClick={openMoveModal}
                    title={`The move was asked for by ${moveAsk.via}${moveAsk.sent_to ? ` (${moveAsk.sent_to})` : ''} — follow up with a call, then mark it moved`}
                    style={{ padding: '1px 8px', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', font: 'inherit', background: age === 'red' ? 'var(--bg-red-100)' : 'var(--bg-amber-tint)', color: age === 'red' ? 'var(--text-red-800)' : 'var(--text-amber-800)' }}
                  >
                    asked {formatYmdLocal(calendarYmdInAppTzFromIso(moveAsk.requested_at))} · follow up ☎
                  </button>
                )
              })()
            ) : (
              <button
                type="button"
                className="aging-win-btn"
                onClick={openMoveModal}
                title={`Movable${inv.due_date ? ` until ${formatYmdLocal(inv.due_date)}` : ''}. A house moves a charge onto the job account only while it is current. Start the move with a call or an emailed request.`}
              >
                Move it…
              </button>
            )
          ) : markOnTitle ? (
            <button type="button" className="aging-win-link" onClick={() => void setInvoiceJobAcct(inv, true)} title={markOnTitle}>
              Mark it on
            </button>
          ) : null}
        </span>
        {inv.link ? (
          <a className="aging-win-ext" href={inv.link} target="_blank" rel="noreferrer" title="The invoice" aria-label={`Open invoice ${inv.invoice_number}`}>
            ↗
          </a>
        ) : (
          <span className="aging-win-ext" />
        )}
        {rowNote ? <span className="aging-win-note">{rowNote}</span> : null}
      </div>
    )
  }
  const renderJob = (job: AgingCellJobGroup<AgingInvoiceRow>) => {
    const j = jobLabelOf(job.jobId)
    const words = agingCellJobStateWords(job.state, houseNameOf(job.houseId))
    // A past-due bill is marked on with one press per row. With an open account every such row offers it. With
    // none on record, Flag anyway unfolds the same press for this job (the to-do #132 call: never a block).
    const jobKey = `${job.jobId}:${job.houseId}`
    const noAccount = job.state.kind === 'none' || job.state.kind === 'requested' || job.state.kind === 'not_needed'
    const pastWindowOff = job.rows.filter((r) => r.on_job_account !== true && !isMovableAgingInvoice(r, 1, agingTodayYmd)).length
    const anywayOpen = noAccount && agingCellFlagAnywayFor === jobKey
    const markOnTitle =
      job.state.kind === 'open'
        ? 'The job account is open at this house. One press marks this invoice on it.'
        : anywayOpen
          ? 'No job account on record. This only records that the house carries this bill on one. The house roster keeps its bought, no account line.'
          : null
    const n = job.rows.length
    return (
      <div key={`${job.jobId}:${job.houseId}`} className="aging-win-job">
        <div className="aging-win-job-head">
          <div className="aging-win-job-name">
            {j.num ? <span className="aging-win-job-num">{j.num}</span> : null}
            {j.name}
          </div>
          <div className="aging-win-job-act">
            <span className={`aging-win-state aging-win-state--${words.tone}`}>{words.label}</span>
            {job.state.kind === 'none' || job.state.kind === 'requested' ? (
              <button type="button" className="aging-win-btn" onClick={() => setAgingCellMarkOpenedFor({ inv: job.rows[0]!, flagOnOpen: false })}>
                Mark opened…
              </button>
            ) : null}
            {noAccount && pastWindowOff > 0 ? (
              <button
                type="button"
                className="aging-win-link"
                aria-pressed={anywayOpen}
                onClick={() => setAgingCellFlagAnywayFor(anywayOpen ? null : jobKey)}
                title="Flag a bill as on the job account with no account on record"
                style={{ color: 'var(--text-muted)' }}
              >
                {anywayOpen ? 'Done' : 'Flag anyway…'}
              </button>
            ) : null}
          </div>
          <div className="aging-win-job-meta">
            {n} {n === 1 ? 'invoice' : 'invoices'} · {money(job.total)}
            {job.onCount > 0 && job.offCount > 0 ? ` · ${job.onCount} of ${n} on it` : ''}
          </div>
        </div>
        <div className="aging-win-rows">{job.rows.map((r) => renderRow(r, markOnTitle, null))}</div>
      </div>
    )
  }
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setAgingCellModal(null)
      }}
      style={{ position: 'fixed', inset: 0, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1003 }}
    >
      <div role="dialog" aria-modal="true" aria-label={isMovableList ? 'Still movable: current charges not on a job account' : `${houseName}, ${agingCellTitle(cell)}`} style={{ background: 'var(--surface)', borderRadius: 8, maxHeight: 'min(90vh, 100%)', overflow: 'auto', ...stickyModalPanelStyle(800) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', ...stickyModalHeaderStyle() }}>
          <div>
            {/* v2.5766: the house is the title and the bucket a chip beside it; the subtitle says one thing. */}
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {isMovableList ? 'Still movable' : houseName}
              <span style={{ fontSize: '0.74rem', fontWeight: 600, padding: '1px 9px', borderRadius: 999, border: '1px solid var(--border-strong)', color: isMovableList || cell === 'current' || cell === 'noDueDate' || cell === 'owed' || cell === 'credits' ? 'var(--text-muted)' : '#b42318', whiteSpace: 'nowrap' }}>
                {isMovableList ? 'current charges not on a job account' : agingCellTitle(cell)}
              </span>
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {isMovableList
                ? 'A house moves a charge onto the job account only while it is current. Call the rep, or email the request and follow up, then mark each one moved.'
                : `${cellRows.length} unpaid ${noun}, the cell's sum`}
            </p>
          </div>
          <button type="button" onClick={() => setAgingCellModal(null)} style={STICKY_MODAL_CLOSE_BUTTON_STYLE} aria-label="Close">×</button>
        </div>
        {showSplit ? (
          <div className="aging-win-split">
            <div className="aging-win-split-row">
              <div className="aging-win-fig aging-win-fig--on">
                <b>{money(accountSplit.onAmount)}</b>
                <span>on job accounts · {accountSplit.onCount} of {accountSplit.onCount + accountSplit.offCount} · the owners' debt</span>
              </div>
              <div className="aging-win-fig aging-win-fig--off">
                <b>{money(accountSplit.offAmount)}</b>
                <span>not on one · {accountSplit.offCount} of {accountSplit.onCount + accountSplit.offCount} · Click's debt</span>
              </div>
            </div>
            <div className="aging-win-bar" role="img" aria-label={`${money(accountSplit.onAmount)} on job accounts, ${money(accountSplit.offAmount)} not on one`}>
              {accountSplit.onAmount > 0 ? <i className="aging-win-bar-on" style={{ width: `${onPct}%` }} /> : null}
              {accountSplit.offAmount > 0 ? <i className="aging-win-bar-off" style={{ width: `${100 - onPct}%` }} /> : null}
            </div>
            {jobsLine ? <p className="aging-win-why">{jobsLine}</p> : null}
          </div>
        ) : null}
        {cellRows.length === 0 ? (
          <EmptyState compact main={isMovableList ? 'Nothing left to move. Every current charge that belongs on a job account is on one. ✓' : 'Nothing is left in this cell.'} />
        ) : !agingCellAccountsLoaded ? (
          <p style={{ margin: 0, padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Reading the jobs…</p>
        ) : (
          byHouse.map((g) => (
            <Fragment key={g.key}>
              {g.name ? (
                <div className="aging-win-house">
                  {g.name} · {money(g.rows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0))}
                  {isMovableList ? (() => {
                    const rep = (agingCellReps[g.key] ?? []).find((r) => typeof r.email === 'string' && r.email.includes('@')) ?? (agingCellReps[g.key] ?? [])[0]
                    const unasked = g.rows.filter((r) => !agingMoveData.asks[r.id])
                    const busyKey = `house:${g.key}`
                    return (
                      <>
                        {rep ? (
                          <span style={{ marginLeft: '0.6rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#0f766e' }}>
                            ☎ {(rep.name ?? '').trim() || rep.email}{'phone' in rep && rep.phone ? ` · ${rep.phone}` : ''}
                          </span>
                        ) : (
                          <span style={{ marginLeft: '0.6rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'var(--text-amber-800)' }}>no job-accounts rep on file — add one on the house</span>
                        )}
                        {rep && typeof rep.email === 'string' && rep.email.includes('@') && unasked.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => void sendMoveRequest(unasked.map((r) => r.id), busyKey, false)}
                            disabled={agingMoveBusy === busyKey}
                            style={{ marginLeft: '0.6rem', padding: '0.1rem 0.55rem', fontSize: '0.7rem', fontWeight: 600, textTransform: 'none', letterSpacing: 0, background: 'transparent', color: '#0f766e', border: '1px solid #0f766e', borderRadius: 4, cursor: 'pointer', font: 'inherit', opacity: agingMoveBusy === busyKey ? 0.6 : 1 }}
                          >
                            {agingMoveBusy === busyKey ? 'Sending…' : `✉ Email ${(rep.name ?? '').trim().split(' ')[0] || 'the rep'} the list ›`}
                          </button>
                        ) : null}
                      </>
                    )
                  })() : null}
                </div>
              ) : null}
              {g.byJob.jobs.map(renderJob)}
              {g.byJob.split.length > 0 ? (
                <div className="aging-win-job">
                  <div className="aging-win-job-head">
                    <div className="aging-win-job-name">Split across jobs</div>
                    <div className="aging-win-job-meta">A job account belongs to one property. A split invoice cannot sit on one.</div>
                  </div>
                  <div className="aging-win-rows">{g.byJob.split.map((r) => renderRow(r, null, jobsText(r.id)))}</div>
                </div>
              ) : null}
              {g.byJob.noJob.length > 0 ? (
                <div className="aging-win-job">
                  <div className="aging-win-job-head">
                    <div className="aging-win-job-name">{AGING_CELL_NO_JOB_HEADING}</div>
                    <div className="aging-win-job-meta">Press Pick a job › on the row to choose its job.</div>
                  </div>
                  <div className="aging-win-rows">{g.byJob.noJob.map((r) => renderRow(r, null, null))}</div>
                </div>
              ) : null}
              {g.byJob.credits.length > 0 ? (
                <div className="aging-win-job">
                  {isCredits ? null : (
                    <div className="aging-win-job-head">
                      <div className="aging-win-job-name">Credit memos</div>
                    </div>
                  )}
                  <div className="aging-win-rows" style={isCredits ? { paddingTop: '0.4rem' } : undefined}>
                    {g.byJob.credits.map((r) => renderRow(r, null, allocationsOf(r.id).length > 0 ? jobsText(r.id) : null))}
                  </div>
                </div>
              ) : null}
            </Fragment>
          ))
        )}
        {/* Sticky pins to the panel's content box: the negative bottom and margin cover its bottom padding, so no
            row shows through under the pinned footer. */}
        <div style={{ position: 'sticky', bottom: '-1.5rem', zIndex: 2, background: 'var(--surface)', borderTop: '1px solid var(--border)', margin: '0 -1.5rem -1.5rem', padding: '0.6rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600 }}>
            {isMovableList ? (
              <>
                {cellRows.length === 0 ? 'All moved or marked.' : `${movableToAsk} to ask · ${cellRows.length - movableToAsk} asked, awaiting the house · $${formatCurrency(total)}`}
                {agingMoveError ? <span style={{ display: 'block', fontWeight: 500, color: 'var(--text-red-700)' }}>{agingMoveError}</span> : null}
              </>
            ) : (
              <>
            {isCredits ? 'Open credits' : 'Cell total'}: {money(total)}
              </>
            )}
          </div>
          {houseId && agingCellModalDoors(houseId, cell).openHouse ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <AgingMakePaymentDoor doors={agingCellModalDoors(houseId, cell)} busy={agingCellDoorBusy === `house:${houseId}`} onMakePayment={() => void openPaymentFromAgingCell(houseId)} />
              <button
                type="button"
                onClick={() => {
                  setAgingCellModal(null)
                  openHouseFromAging(houseId)
                }}
                style={{ padding: '0.4rem 0.9rem', fontSize: '0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
              >
                Open {houseName} ›
              </button>
            </div>
          ) : null}
        </div>
        {/* PR 3: the move modal — the attested call, or the emailed request with a follow-up. */}
        {agingMoveModalFor && (() => {
          const inv = agingUnpaidInvoices.find((r) => r.id === agingMoveModalFor)
          if (!inv) return null
          const allocations = agingCellJobs.allocations[inv.id] ?? agingMoveData.allocations[inv.id] ?? []
          const jobId = allocations.length === 1 ? allocations[0]!.job_id : null
          if (!jobId) return null
          const d = agingCellJobs.jobs[jobId]
          const jobLabel = d ? `${effectiveJobLedgerNumber(d.hcp_number, d.click_number) || '—'} · ${d.job_name || '—'}` : 'its job'
          const key = `${jobId}:${inv.supply_house_id}`
          const account = agingCellAccounts[key] ?? null
          const reps = agingCellReps[inv.supply_house_id] ?? []
          const rep = reps.find((r) => typeof r.email === 'string' && r.email.includes('@')) ?? reps[0] ?? null
          const repHasEmail = rep != null && typeof rep.email === 'string' && rep.email.includes('@')
          const moveAsk = agingMoveData.asks[inv.id] ?? null
          const daysLeft = inv.due_date ? -daysPastDue(inv.due_date, agingTodayYmd) : 0
          const thisHouse = houseNameOf(inv.supply_house_id)
          const closeMove = () => {
            setAgingMoveModalFor(null)
            setAgingMoveAttest(false)
            setAgingMoveError(null)
          }
          return (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) closeMove()
              }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem 1rem' }}
            >
              <div role="dialog" aria-modal="true" aria-label={`Move ${inv.invoice_number} onto the job account`} style={{ background: 'var(--surface)', borderRadius: 8, width: 'min(560px, 100%)', maxHeight: 'min(88vh, 100%)', overflow: 'auto', padding: '1rem 1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Move {inv.invoice_number} onto the job account</h3>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {thisHouse} · {jobLabel} · ${formatCurrency(inv.amount)}{inv.due_date ? <> · due {formatYmdLocal(inv.due_date)} — <strong style={{ color: 'var(--text-amber-800)' }}>{daysLeft} day{daysLeft === 1 ? '' : 's'} left in the window</strong></> : null}
                    </p>
                  </div>
                  <button type="button" onClick={closeMove} style={STICKY_MODAL_CLOSE_BUTTON_STYLE} aria-label="Close">×</button>
                </div>
                {account?.status === 'open' ? (
                  <div style={{ margin: '0.7rem 0 0', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)', fontSize: '0.8125rem' }}>
                    Job account open{account.account_ref ? ` · ref ${account.account_ref}` : ''}{account.opened_at ? ` · ${openedViaPhrase(account.opened_via)} ${new Date(account.opened_at).toLocaleDateString()}` : ''}.
                  </div>
                ) : (
                  <div style={{ margin: '0.7rem 0 0', padding: '0.45rem 0.6rem', borderRadius: 6, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ flex: '1 1 14rem' }}>{agingMoveNoAccountLine(rep?.name)}</span>
                    <button
                      type="button"
                      onClick={() => setAgingCellMarkOpenedFor({ inv, flagOnOpen: true })}
                      style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', fontWeight: 600, background: '#0f766e', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}
                    >
                      Mark opened…
                    </button>
                  </div>
                )}
                {moveAsk ? (
                  <div style={{ margin: '0.5rem 0 0', padding: '0.45rem 0.6rem', borderRadius: 6, background: ageState(moveAsk.requested_at, undefined, SUPPLY_MOVE_ASK_AGE) === 'red' ? 'var(--bg-red-100)' : 'var(--bg-amber-tint)', color: ageState(moveAsk.requested_at, undefined, SUPPLY_MOVE_ASK_AGE) === 'red' ? 'var(--text-red-800)' : 'var(--text-amber-800)', fontSize: '0.8125rem' }}>
                    Asked by {moveAsk.via} {formatYmdLocal(calendarYmdInAppTzFromIso(moveAsk.requested_at))}{moveAsk.sent_to ? ` (${moveAsk.sent_to})` : ''} — follow up with a call{rep ? `: ☎ ${(rep.name ?? '').trim() || rep.email}${'phone' in rep && rep.phone ? ` · ${rep.phone}` : ''}` : ''}.
                  </div>
                ) : null}
                <div style={{ margin: '0.9rem 0 0.25rem', fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  The call{rep ? ` — ☎ ${(rep.name ?? '').trim() || rep.email}${'phone' in rep && rep.phone ? ` · ${rep.phone}` : ''}` : ''}
                </div>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={agingMoveAttest}
                    onChange={(e) => setAgingMoveAttest(e.target.checked)}
                    style={{ marginTop: 2, accentColor: '#0f766e' }}
                  />
                  <span>I called {thisHouse}{rep?.name?.trim() ? ` (${rep.name.trim()})` : ''} — this charge was moved onto the job account.</span>
                </label>
                <button
                  type="button"
                  disabled={!agingMoveAttest || agingMoveBusy === 'move'}
                  onClick={() => void markMovedConfirmed(inv, jobId)}
                  style={{ marginTop: '0.5rem', padding: '0.35rem 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: '#0f766e', color: 'white', border: 'none', borderRadius: 5, cursor: !agingMoveAttest || agingMoveBusy === 'move' ? 'not-allowed' : 'pointer', opacity: !agingMoveAttest || agingMoveBusy === 'move' ? 0.5 : 1 }}
                >
                  {agingMoveBusy === 'move' ? 'Marking…' : 'Mark it moved ✓'}
                </button>
                {!moveAsk ? (
                  <>
                    <div style={{ margin: '1rem 0 0.25rem', fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Or ask by email — we follow up with a call
                    </div>
                    {repHasEmail ? (
                      <>
                        <div style={{ padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          <div><strong style={{ color: 'var(--text-base)' }}>To:</strong> {(rep!.name ?? '').trim() || 'Job accounts'} · {rep!.email}</div>
                          <div><strong style={{ color: 'var(--text-base)' }}>Subject:</strong> Move invoice {inv.invoice_number} to the {jobLabel.split(' ·')[0]} job account</div>
                          <div style={{ marginTop: '0.3rem', borderTop: '1px dashed var(--border)', paddingTop: '0.3rem' }}>
                            Please move this charge onto the job account for {jobLabel}: {inv.invoice_number} · {formatYmdLocal(inv.invoice_date)} · ${formatCurrency(inv.amount)}{inv.purchase_order_number?.trim() ? ` · PO ${inv.purchase_order_number}` : ''}.{' '}
                            {account?.status === 'open' && account.account_ref ? `Account ref ${account.account_ref}.` : AGING_MOVE_EMAIL_NO_ACCOUNT} We'll call to confirm. Replies come to you.
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={agingMoveBusy === 'send'}
                          onClick={() => void sendMoveRequest([inv.id], 'send', false)}
                          style={{ marginTop: '0.5rem', padding: '0.35rem 0.9rem', fontSize: '0.875rem', fontWeight: 600, background: '#0f766e', color: 'white', border: 'none', borderRadius: 5, cursor: agingMoveBusy === 'send' ? 'not-allowed' : 'pointer', opacity: agingMoveBusy === 'send' ? 0.6 : 1 }}
                        >
                          {agingMoveBusy === 'send' ? 'Sending…' : 'Send the request ›'}
                        </button>
                      </>
                    ) : (
                      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>
                        {agingMoveNoRepLine(thisHouse)}
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={agingMoveBusy === 'send' || !repHasEmail}
                    onClick={() => void sendMoveRequest([inv.id], 'send', true)}
                    style={{ marginTop: '0.75rem', padding: '0.25rem 0.6rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', font: 'inherit' }}
                  >
                    {agingMoveBusy === 'send' ? 'Sending…' : 'Send the email again ›'}
                  </button>
                )}
                {agingMoveError ? <p style={{ margin: '0.6rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{agingMoveError}</p> : null}
              </div>
            </div>
          )
        })()}
        {/* A job heading's or the move modal's Mark opened… — the shared v2.3423 sheet, stacked above (z 1100). */}
        {agingCellMarkOpenedFor && (() => {
          const { inv, flagOnOpen } = agingCellMarkOpenedFor
          const alloc = agingCellJobs.allocations[inv.id] ?? []
          const jobId = alloc.length === 1 ? alloc[0]!.job_id : null
          if (!jobId) return null
          const d = agingCellJobs.jobs[jobId]
          const key = `${jobId}:${inv.supply_house_id}`
          return (
            <MarkJobAccountOpenedModal
              jobId={jobId}
              jobLabel={d ? `${effectiveJobLedgerNumber(d.hcp_number, d.click_number) || '—'} · ${d.job_name || '—'}` : 'this job'}
              house={{ id: inv.supply_house_id, name: houseNameOf(inv.supply_house_id) }}
              existing={agingCellAccounts[key] ?? null}
              reps={agingCellReps[inv.supply_house_id] ?? []}
              onClose={() => setAgingCellMarkOpenedFor(null)}
              onSaved={(row) => {
                setAgingCellMarkOpenedFor(null)
                setAgingCellAccounts((prev) => ({ ...prev, [key]: row }))
                // From the move modal, saved as open flags the invoice the press was about. From a job
                // heading it only records the account; each invoice then wears its own Mark it on.
                if (flagOnOpen && row.status === 'open') void setInvoiceJobAcct(inv, true)
              }}
            />
          )
        })()}
      </div>
    </div>
  )
}
