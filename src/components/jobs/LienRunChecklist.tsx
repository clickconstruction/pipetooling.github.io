import { useEffect, useState, type ReactNode } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { lienRunChecklistWords, lienRunTickDay, type LienRunRow } from '../../lib/jobs/lienRunChecklist'
import { trackingShape } from '../../lib/jobs/lienDeskRun'
import { runClosePaidPress, runPaidFoldWords } from '../../lib/jobs/lienRunClosePaid'
import { lienSignatureWhen } from '../../lib/jobs/lienNoticeSignature'

/**
 * The run as a checklist (v2.7328): one row per notice, three ticks across — Printed, Signed,
 * Mailed — each read from the desk's own fact (`lienRunChecklist.ts`). An open tick is its press:
 * Printed marks a paper printed elsewhere, Signed opens the pen pane, Mailed is the tracking box
 * for each paper envelope the notice is in. A ticked one says who and when. On a phone the rows
 * stack and the ticks are a row of three presses a thumb tall (`.lienRunCheck*` in index.css).
 */
export type LienRunChecklistProps = {
  rows: ReadonlyArray<LienRunRow>
  busy: boolean
  /** Who is at this screen; null hides the Signed press (the pen pane names the recorder). */
  viewer: { userId: string | null; name: string } | null
  onMarkPrinted: (row: LienRunRow) => void
  onOpenSign: (row: LienRunRow) => void
  /** The number typed for one of the row's envelopes; the host keys it to the envelope, so a shared one takes it for every notice inside. */
  onTracking: (row: LienRunRow, recipientKey: LienRunRow['recipients'][number]['key'], value: string) => void
  /** The pane drawn under a row (the pen pane) while it is open there, or null. */
  paneFor: (row: LienRunRow) => ReactNode
  /** A press beside each tracking box (the phone's Scan ›, PR B), or null. */
  besideBox?: (row: LienRunRow, recipientKey: LienRunRow['recipients'][number]['key']) => ReactNode
  /** A door landed here (`?run=<itemId>&mail=1`): scroll to this row's Mailed box and put the cursor in it. */
  focusMailItemId?: string | null
  /**
   * Close a paid notice (v2.7353): the fold's press and each paid row's own ask the host to close these
   * items; the host confirms first. `readyIds` are the ones a close takes, `heldWhy` the reason on a paid
   * row it leaves. Absent = the paid rows fold, with no press.
   */
  paid?: { readyIds: ReadonlyArray<string>; heldWhy: ReadonlyMap<string, string>; onClose: (itemIds: string[]) => void }
}

const tickBtn = (kind: 'open' | 'primary', dead: boolean) =>
  ({
    padding: '4px 10px',
    borderRadius: 7,
    border: `1px solid ${kind === 'primary' ? 'transparent' : 'var(--border-strong)'}`,
    background: kind === 'primary' ? '#2563eb' : 'var(--surface)',
    color: kind === 'primary' ? '#fff' : 'var(--text-700)',
    font: 'inherit',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: dead ? 'default' : 'pointer',
    opacity: dead ? 0.55 : 1,
    whiteSpace: 'nowrap',
  }) as const

const field = { font: 'inherit', fontSize: '0.78rem', padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', width: '100%', minWidth: 0 } as const

export default function LienRunChecklist({ rows, busy, viewer, onMarkPrinted, onOpenSign, onTracking, paneFor, besideBox, focusMailItemId, paid }: LienRunChecklistProps) {
  useEffect(() => {
    if (!focusMailItemId) return
    const box = document.querySelector<HTMLInputElement>(`[data-run-mail-box="${focusMailItemId}"]`)
    if (!box) return
    box.scrollIntoView({ block: 'center' })
    box.focus()
  }, [focusMailItemId])
  // Paid since (v2.7353): a notice whose job owes $0 sits under one line at the foot, out of the working list.
  const [paidOpen, setPaidOpen] = useState<boolean | null>(null)
  if (rows.length === 0) return null
  const live = rows.filter((r) => !r.nothingToClaim)
  const paidRows = rows.filter((r) => r.nothingToClaim)
  const foldOpen = paidOpen ?? live.length === 0
  const closeIds = paid ? paidRows.map((r) => r.itemId).filter((id) => paid.readyIds.includes(id)) : []
  const closePress = paid ? runClosePaidPress({ ready: closeIds.length, held: paidRows.length - closeIds.length }) : null
  const drawRow = (r: LienRunRow) => {
    const owner = r.recipients.find((x) => x.key === 'owner')
    const gc = r.recipients.find((x) => x.key === 'original_contractor')
    const who = [owner ? `Owner: ${owner.name || '—'}` : '', gc ? `GC: ${gc.name || '—'}` : ''].filter(Boolean).join(' · ')
    const printedOk = r.printed != null || r.paperless
    // Nothing to claim (v2.7337): the job owes $0 now, so the row's own Signed and Mailed are closed with it.
    const closed = r.nothingToClaim
    const canSign = !!viewer && !!r.leader?.name && printedOk && !closed
    const boxes = r.recipients.filter((x) => x.needsNumber)
    return (
      <div key={r.itemId} className="lienRunCheckRow" data-testid={`run-check-${r.itemId}`} data-waits={r.waitsOn ?? 'none'} data-held={r.held ? 'yes' : 'no'}>
        <div className="lienRunCheckHead">
          <b>{r.label}</b>
          <span className="lienRunCheckAmt">{formatUsdNoCents(r.amount)}</span>
          <span className="lienRunCheckWho">{who}</span>
          {r.held ? (
            <span className="lienRunCheckHeld" data-testid={`run-check-held-${r.itemId}`}>Held · {r.held}</span>
          ) : (
            <span className="lienRunCheckLine" data-testid={`run-check-line-${r.itemId}`}>{r.line}</span>
          )}
          {closed && paid ? (
            paid.readyIds.includes(r.itemId) ? (
              <button type="button" onClick={() => paid.onClose([r.itemId])} disabled={busy} title="Nothing is mailed. The notice leaves the run and the desk." style={tickBtn('open', busy)} data-testid={`run-check-close-${r.itemId}`}>
                Close…
              </button>
            ) : paid.heldWhy.get(r.itemId) ? (
              <span className="lienRunCheckWho" data-testid={`run-check-close-why-${r.itemId}`}>{paid.heldWhy.get(r.itemId)}</span>
            ) : null
          ) : null}
        </div>
        <div className="lienRunCheckTicks" role="group" aria-label={`${r.label} — the three ticks`}>
          <div className="lienRunCheckTick" data-tick="printed" data-on={printedOk ? 'yes' : 'no'}>
            <span className="lienRunCheckTickName">Printed</span>
            {r.printed ? (
              <span className="lienRunCheckDone" title={`Printed ${lienSignatureWhen(r.printed.at).day} at ${lienSignatureWhen(r.printed.at).clock} CT${r.printed.by ? ` by ${r.printed.by}` : ''}`} data-testid={`run-check-printed-${r.itemId}`}>
                ✓ {lienRunTickDay(r.printed.at)}
                {r.printed.by ? ` · ${r.printed.by}` : ''}
              </span>
            ) : r.paperless ? (
              <span className="lienRunCheckDone" data-testid={`run-check-printed-${r.itemId}`}>— by email</span>
            ) : (
              <button type="button" onClick={() => onMarkPrinted(r)} disabled={busy || !!r.held} title={r.held ? r.held : 'The paper printed elsewhere, or by hand: mark it printed, with your name and the time. Printing the packet ticks this by itself.'} style={tickBtn('open', busy || !!r.held)} data-testid={`run-check-mark-printed-${r.itemId}`}>
                Printed ▸
              </button>
            )}
          </div>
          <div className="lienRunCheckTick" data-tick="signed" data-on={r.signed ? 'yes' : 'no'}>
            <span className="lienRunCheckTickName">Signed</span>
            {r.signed === 'not_needed' ? (
              <span className="lienRunCheckDone" data-testid={`run-check-signed-${r.itemId}`}>—</span>
            ) : r.signed ? (
              <span className="lienRunCheckDone" title={`Signed ${r.signed.how === 'pen' ? 'with a pen' : 'with his name'} ${lienSignatureWhen(r.signed.at).day}${r.signed.how === 'pen' ? `, written down by ${r.signed.by}` : ` by ${r.signed.by}`}`} data-testid={`run-check-signed-${r.itemId}`}>
                ✓ {r.signed.how} · {lienRunTickDay(r.signed.at)}
                {r.signed.how === 'pen' ? ` · ${r.signed.by}` : ''}
              </span>
            ) : canSign ? (
              <button type="button" onClick={() => onOpenSign(r)} disabled={busy} title={`${r.leader?.name} signed the paper with a pen: write down when and how you know`} style={tickBtn('open', busy)} data-testid={`run-check-sign-${r.itemId}`}>
                Signed ▸
              </button>
            ) : (
              <span className="lienRunCheckWait" data-testid={`run-check-sign-${r.itemId}`}>{closed ? 'nothing to sign' : !printedOk ? 'print first' : r.leader?.name ? `waits on ${r.leader.name}` : 'no leader named'}</span>
            )}
          </div>
          <div className="lienRunCheckTick" data-tick="mailed" data-on={r.mailed ? 'yes' : 'no'}>
            <span className="lienRunCheckTickName">Mailed</span>
            {r.mailed && boxes.length === 0 ? (
              <span className="lienRunCheckDone" data-testid={`run-check-mailed-${r.itemId}`}>✓ {r.mailed.tracking}</span>
            ) : (
              <div className="lienRunCheckBoxes">
                {boxes.map((x, i) => {
                  const shape = trackingShape(x.method, x.tracking)
                  const short = x.key === 'owner' ? 'owner' : 'GC'
                  return (
                    <div key={x.key} className="lienRunCheckBox" data-on={x.mailed ? 'yes' : 'no'}>
                      <span className="lienRunCheckBoxWho">{short}</span>
                      <input
                        value={x.tracking}
                        onChange={(ev) => onTracking(r, x.key, ev.target.value)}
                        disabled={!printedOk || closed}
                        placeholder={closed ? 'nothing to mail' : !printedOk ? 'print first' : x.method === 'hand' ? 'who signed for it' : x.method === 'traceable_courier' ? 'the courier’s number' : '9407 1118 …'}
                        aria-label={`${r.label} — ${short} tracking`}
                        inputMode={x.method === 'certified_mail' ? 'numeric' : undefined}
                        className="lienRunTracking"
                        style={field}
                        data-run-mail-box={i === 0 ? r.itemId : undefined}
                      />
                      {closed ? null : besideBox?.(r, x.key)}
                      {x.tracking.trim() && shape.hint ? (
                        <span className="lienRunCheckShape" data-ok={shape.ok ? 'yes' : 'no'}>
                          {shape.ok ? '✓ ' : ''}
                          {shape.hint}
                        </span>
                      ) : x.mailed && x.tracking.trim() ? (
                        <span className="lienRunCheckShape" data-ok="yes">✓</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        {paneFor(r)}
      </div>
    )
  }
  return (
    <div className="lienRunCheck" data-testid="run-check">
      <h3>
        The checklist <span>{lienRunChecklistWords(live)}</span>
      </h3>
      {live.map(drawRow)}
      {paidRows.length > 0 ? (
        <div data-testid="run-paid-fold" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', margin: '0.5rem 0 0.25rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', fontSize: '0.8125rem' }}>
          <button type="button" onClick={() => setPaidOpen(!foldOpen)} aria-expanded={foldOpen} data-testid="run-paid-fold-toggle" style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-700)', cursor: 'pointer', textAlign: 'left' }}>
            {runPaidFoldWords(paidRows.length)} {foldOpen ? '▴' : '▾'}
          </button>
          <span style={{ color: 'var(--text-muted)', flex: '1 1 12rem' }}>Each job owes $0 now. No press at the foot takes them.</span>
          {paid && closePress ? (
            <button type="button" onClick={() => paid.onClose(closeIds)} disabled={busy || closePress.dead} title={closePress.dead ? 'None of these can be closed from the run. Each row says why.' : 'Nothing is mailed. Each notice leaves the run and the desk.'} style={tickBtn('open', busy || closePress.dead)} data-testid="run-close-paid">
              {closePress.button}{closePress.dead ? '' : '…'}
            </button>
          ) : null}
        </div>
      ) : null}
      {foldOpen ? paidRows.map(drawRow) : null}
    </div>
  )
}
