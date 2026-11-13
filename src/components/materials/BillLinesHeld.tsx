import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { EmptyState } from '../EmptyState'
import { emptyWords } from '../../lib/emptyWords'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { moneyWords } from '../../lib/materials/lines/paperChecks'
import type { PaperIo } from '../../lib/materials/lines/paperIo'
import type { PaperRow } from '../../lib/materials/lines/paperRows'
import type { HeldBillsData, HeldBillsIo } from '../../lib/materials/lines/heldBillsIo'
import { groupToggleLabel, HELD_PRESS_WORDS, heldBills, showHeldLabel, standingWords, toReadWords, type HeldBill, type HeldGroup, type HeldPress, type HeldReason } from '../../lib/materials/lines/heldBills'
import { PaperLookModal } from './PaperLookModal'

/**
 * Supply house bill lines, the bills that need a person (punch list #298 PR 3, v2.7110; frame F of the card's
 * mock-up). One line on the Supply houses tab says where every bill's lines stand, and its press opens the window:
 * each reason a bill waits, how many bills, and what opens it. A reason opens to its bills, and each bill offers its
 * door: **Look** for a paper whose sums are off, **Open the bill** for one whose link, number or amount is wrong. The
 * sweep reads by itself, so nothing here starts a read. The counts and the words are `heldBills.ts`; the reads are
 * `heldBillsIo.ts`.
 */
export function BillLinesHeld({ io, paperIo, onOpenBill, loadPaperBytes, refreshKey = 0 }: {
  io: HeldBillsIo
  paperIo: Pick<PaperIo, 'loadForInvoices' | 'save' | 'accept'>
  /** Opens the bill's own window on the tab, where its link, number and amount are. The window closes first. */
  onOpenBill: (bill: { invoiceId: string; houseId: string | null }) => void
  /** Our copy of a paper's PDF, for the Look window's left pane, when the paper kept one. */
  loadPaperBytes?: (filePath: string) => Promise<ArrayBuffer | null>
  /** The tab bumps this after it saves a bill or a paper, so the line reads again. */
  refreshKey?: number
}) {
  const [data, setData] = useState<HeldBillsData | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [openReasons, setOpenReasons] = useState<ReadonlySet<HeldReason>>(() => new Set())
  const [look, setLook] = useState<{ paper: PaperRow; bill: HeldBill; bytes: ArrayBuffer | null } | null>(null)
  const [lookProblem, setLookProblem] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      setData(await io.load())
      setFailure(null)
    } catch (e) {
      setFailure(recoveryFailureFromError(e, 'Could not read where the bills’ lines stand.'))
    } finally {
      setBusy(false)
    }
  }, [io])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => {
    if (!open || look) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, look])

  const held = useMemo(() => (data ? heldBills(data) : null), [data])

  async function press(kind: HeldPress, bill: HeldBill) {
    setLookProblem(null)
    if (kind === 'bill') {
      setOpen(false)
      onOpenBill({ invoiceId: bill.invoiceId, houseId: bill.houseId })
      return
    }
    const paper = (await paperIo.loadForInvoices([bill.invoiceId])).get(bill.invoiceId)
    if (!paper) {
      setLookProblem(`The lines of ${bill.number} could not be read just now. Try again.`)
      return
    }
    setLook({ paper, bill, bytes: paper.filePath && loadPaperBytes ? await loadPaperBytes(paper.filePath) : null })
  }

  function toggle(reason: HeldReason) {
    setOpenReasons((was) => {
      const next = new Set(was)
      if (next.has(reason)) next.delete(reason)
      else next.add(reason)
      return next
    })
  }

  if (failure && !held) {
    return <OfflineRetryPanel failure={failure} onRetry={load} surface="bill-lines-held" idempotent busy={busy} style={{ margin: '0 0 0.75rem' }} />
  }
  if (!held || held.standing.bills === 0) return null
  const { standing, groups } = held

  const chip = (tone: 'ok' | 'wait' | 'muted', words: string) => (
    <span
      style={{
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: '0.75rem',
        fontWeight: 600,
        ...(tone === 'ok'
          ? { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' }
          : tone === 'wait'
            ? { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', border: '1px solid var(--border-strong)' }
            : { background: 'var(--bg-muted)', color: 'var(--text-muted)' }),
      }}
    >
      {words}
    </span>
  )
  const cell: CSSProperties = { padding: '0.45rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem', textAlign: 'left' }
  const head: CSSProperties = { ...cell, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }
  const small: CSSProperties = { padding: '0.15rem 0.5rem', fontSize: '0.75rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', whiteSpace: 'nowrap' }

  const billRows = (g: HeldGroup) => (
    <div data-testid={`bill-lines-bills-${g.reason}`} style={{ margin: '0.5rem 0 0', background: 'var(--bg-subtle)', borderRadius: 6 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                {['House', 'Bill', 'Date', 'Amount', g.reason === 'no_pdf' ? '' : 'What was found', ''].map((h, i) => (
                  <th key={i} style={{ ...head, textAlign: i === 3 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.bills.map((b) => (
                <tr key={b.invoiceId}>
                  <td style={cell}>{b.houseName}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{b.number || 'no number'}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>{b.dateYmd}</td>
                  <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{moneyWords(b.amountCents)}</td>
                  <td style={{ ...cell, color: 'var(--text-muted)' }}>{b.note}</td>
                  <td style={{ ...cell, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                      {b.link ? (
                        <a href={b.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-blue-500)' }}>Open in Drive</a>
                      ) : null}
                      {g.presses.map((p) => (
                        <button key={p} type="button" onClick={() => void press(p, b)} aria-label={`${HELD_PRESS_WORDS[p]}: ${b.number || 'the bill'}`} style={small}>
                          {HELD_PRESS_WORDS[p]}
                        </button>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  )

  return (
    <>
      <div data-testid="bill-lines-strip" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>{standingWords(standing)}</span>
        {groups.length > 0 ? (
          <button type="button" onClick={() => setOpen(true)} style={small}>
            {showHeldLabel(standing)}
          </button>
        ) : null}
      </div>

      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Bill lines" data-testid="bill-lines-held" onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))', zIndex: 1250 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(980px, 100%)', maxHeight: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem 1.1rem 1.1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--text-strong)' }}>Bill lines</h2>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{standingWords(standing)}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>✕ Close</button>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {chip('ok', `${standing.addUp.toLocaleString('en-US')} ${standing.addUp === 1 ? 'adds' : 'add'} up`)}
              {standing.off ? chip('wait', `${standing.off.toLocaleString('en-US')} with a gap`) : null}
              {standing.held ? chip('wait', `${standing.held.toLocaleString('en-US')} held`) : null}
              {standing.noPdf ? chip('muted', `${standing.noPdf.toLocaleString('en-US')} with no PDF`) : null}
              {standing.toRead ? chip('muted', `${standing.toRead.toLocaleString('en-US')} to read`) : null}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Only bills that add up count toward what the company buys. The app reads a bill’s PDF by itself. {toReadWords(standing.toRead)}
            </div>

            {failure ? <OfflineRetryPanel failure={failure} onRetry={load} surface="bill-lines-held" idempotent busy={busy} /> : null}
            {lookProblem ? <div role="alert" style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{lookProblem}</div> : null}

            {groups.length === 0 ? (
              <EmptyState compact main={emptyWords({ kind: 'waiting', who: 'a person' }).main} />
            ) : (
              <div role="list" style={{ borderTop: '1px solid var(--border)' }}>
                {groups.map((g) => {
                  const isOpen = openReasons.has(g.reason)
                  return (
                    <div key={g.reason} role="listitem" data-testid={`bill-lines-group-${g.reason}`} style={{ borderBottom: '1px solid var(--border)', padding: '0.6rem 0' }}>
                      {/* Why it waits and what opens it on the left; how many bills and the press on the right. On a phone the right side drops under. */}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-strong)' }}>{g.words}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{g.door}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {g.bills.length.toLocaleString('en-US')} {g.bills.length === 1 ? 'bill' : 'bills'}
                          </span>
                          <button type="button" aria-expanded={isOpen} onClick={() => toggle(g.reason)} style={small}>
                            {groupToggleLabel(isOpen, g.bills.length)}
                          </button>
                        </div>
                      </div>
                      {isOpen ? billRows(g) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {look ? (
        <PaperLookModal
          paper={look.paper}
          invoice={{ id: look.bill.invoiceId, invoice_number: look.bill.number, amount: look.bill.amountCents / 100, link: look.bill.link, invoice_date: look.bill.dateYmd }}
          io={paperIo}
          fileBytes={look.bytes}
          onClose={() => setLook(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </>
  )
}
