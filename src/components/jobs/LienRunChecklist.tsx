import { useEffect, type ReactNode } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { lienRunChecklistWords, lienRunTickDay, type LienRunRow } from '../../lib/jobs/lienRunChecklist'
import { trackingShape } from '../../lib/jobs/lienDeskRun'
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

export default function LienRunChecklist({ rows, busy, viewer, onMarkPrinted, onOpenSign, onTracking, paneFor, besideBox, focusMailItemId }: LienRunChecklistProps) {
  useEffect(() => {
    if (!focusMailItemId) return
    const box = document.querySelector<HTMLInputElement>(`[data-run-mail-box="${focusMailItemId}"]`)
    if (!box) return
    box.scrollIntoView({ block: 'center' })
    box.focus()
  }, [focusMailItemId])
  if (rows.length === 0) return null
  return (
    <div className="lienRunCheck" data-testid="run-check">
      <h3>
        The checklist <span>{lienRunChecklistWords(rows)}</span>
      </h3>
      {rows.map((r) => {
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
      })}
    </div>
  )
}
