import { useEffect, useState, type ReactNode } from 'react'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { LIEN_RUN_STEP_WORDS, lienRunRowNext, lienRunTickDay, type LienRunRow } from '../../lib/jobs/lienRunChecklist'
import { LIEN_RUN_GROUPS, lienRunPartOf, type LienRunPartKey, type LienRunStep } from '../../lib/jobs/lienRunParts'
import { trackingShape } from '../../lib/jobs/lienDeskRun'
import { runClosePaidPress, runPaidFoldWords } from '../../lib/jobs/lienRunClosePaid'
import { lienSignatureWhen } from '../../lib/jobs/lienNoticeSignature'
import LienRunMailedCopies, { type LienRunMailedCopiesPress } from './LienRunMailedCopies'
import { LienReceiptPhotoPress } from './LienReceiptPhotoPress'

/**
 * The run as a checklist (v2.7328): one row per notice, three ticks across — Printed, Signed,
 * Mailed — each read from the desk's own fact (`lienRunChecklist.ts`). An open tick is its press:
 * Printed marks a paper printed elsewhere, Signed opens the pen pane, Mailed is the tracking box
 * for each paper envelope the notice is in. A ticked one says who and when. On a phone the rows
 * stack and the ticks are a row of three presses a thumb tall (`.lienRunCheck*` in index.css).
 *
 * Since v2.7477 (punch list #362) the rows are drawn in groups by the part each notice is in
 * (`lienRunParts`): what is stopped first, each group under a head with its count in notices and its
 * dollars. A press on a head folds its rows. The ready rows start folded while the run stands on what
 * stops a notice, and the stopped ones once it is on the mail numbers. The paid rows' fold sits at
 * the foot of the Held group. The heading that counted ticks (*0 printed · 8 signed · 0 mailed of 15*)
 * is gone: the window has one count.
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
  /**
   * Un-print one notice (v2.7481): the Printed tick of these rows is a press that asks the host to put that notice
   * back in Approved · to print. The host confirms first. Absent, a ticked Printed is words alone.
   */
  unprint?: { ids: ReadonlyArray<string>; onAsk: (row: LienRunRow) => void }
  /** The part each notice is in (`lienRunParts().partOf`). Absent, each row's own facts say. */
  partOf?: ReadonlyMap<string, LienRunPartKey>
  /** Who the waiting notices wait on, for that group's head. */
  leaderName?: string | null
  /** The step the run is on: it picks which groups start folded. */
  step?: LienRunStep | null
  /**
   * What was mailed (the owner's ask of 2026-11-16): a printed row takes a scan or a photo of the papers in its
   * envelope, and lists the ones it has with a way to open each. `addingItemId` is the row a file is going up for.
   * Absent = the rows show the files they have and no press. Since v2.7525 `onRemove` takes one off (`LienRunMailedCopies.tsx`).
   */
  mailedCopies?: LienRunMailedCopiesPress
  /**
   * A receipt beside each mail number (v2.7695): the press that adds one for an envelope, a photo or a PDF, and takes
   * it off. A photo's barcode fills an empty number box. `phone` draws the press a thumb tall. Absent = no press.
   */
  receipts?: { onSet: (row: LienRunRow, recipientKey: LienRunRow['recipients'][number]['key'], url: string) => void; todayYmd: string; phone?: boolean }
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

export default function LienRunChecklist({ rows, busy, viewer, onMarkPrinted, onOpenSign, onTracking, paneFor, besideBox, focusMailItemId, paid, mailedCopies, receipts, unprint, partOf, leaderName, step = null }: LienRunChecklistProps) {
  // A head pressed by hand: its group stays as the person left it, whatever step the run moves to.
  const [folds, setFolds] = useState<Partial<Record<LienRunPartKey, boolean>>>({})
  // While the cursor is in a number box the rows stay in the groups they were in: a row that moved to *Ready to record*
  // on its first digit would take the box, and the cursor, with it. They regroup when the cursor leaves.
  const [placed, setPlaced] = useState<ReadonlyMap<string, LienRunPartKey> | null>(null)
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
  const partFor = (r: LienRunRow): LienRunPartKey => partOf?.get(r.itemId) ?? lienRunPartOf(r)
  const leader = (leaderName ?? '').trim() || 'the leader'
  // The row's own line, but for the two rows whose group says more than their ticks do: one that waits on the
  // signature, and one held back by a job it is combined with.
  const lineOf = (r: LienRunRow): string => {
    const part = partFor(r)
    if (part !== lienRunPartOf(r)) return 'prints on one form with a job that is not ready'
    if (part === 'wait') return `not signed · ${r.leader?.name ? `${r.leader.name} signs from a phone, or here with Signed ▸` : 'the job names no leader to sign it'}`
    return r.line
  }
  const drawRow = (r: LienRunRow) => {
    const owner = r.recipients.find((x) => x.key === 'owner')
    const gc = r.recipients.find((x) => x.key === 'original_contractor')
    const who = [owner ? `Owner: ${owner.name || '—'}` : '', gc ? `GC: ${gc.name || '—'}` : ''].filter(Boolean).join(' · ')
    const printedOk = r.printed != null || r.paperless
    // Nothing to claim (v2.7337): the job owes $0 now, so the row's own Signed and Mailed are closed with it.
    const closed = r.nothingToClaim
    // A row that waits on the signature (v2.7477) offers Signed ▸ before it prints, as its envelope's card does: the packet will not print it unsigned.
    const canSign = !!viewer && !!r.leader?.name && (printedOk || partFor(r) === 'wait') && !closed
    const boxes = r.recipients.filter((x) => x.needsNumber)
    // A paid row and an emailed one have nothing in an envelope; a row not printed yet shows the files it has and no press.
    const copiesShown = !closed && !r.paperless && (r.mailedCopies.length > 0 || (!!mailedCopies && printedOk))
    const next = closed ? null : lienRunRowNext(r, { canAddCopy: !!mailedCopies, canAddReceipt: !!receipts })
    return (
      <div key={r.itemId} className="lienRunCheckRow" data-testid={`run-check-${r.itemId}`} data-waits={r.waitsOn ?? 'none'} data-held={r.held ? 'yes' : 'no'}>
        <div className="lienRunCheckHead">
          <b>
            {r.label}
            {/* Two jobs at one address read as two at that address (v2.7489): the street, when the name does not say it. */}
            {r.street ? <span className="lienRunStreet" data-testid={`run-check-street-${r.itemId}`}> · {r.street}</span> : null}
          </b>
          <span className="lienRunCheckAmt">{formatUsdNoCents(r.amount)}</span>
          <span className="lienRunCheckWho">{who}</span>
          {r.held ? (
            <span className="lienRunCheckHeld" data-testid={`run-check-held-${r.itemId}`}>Held · {r.held}</span>
          ) : (
            <span className="lienRunCheckLine" data-testid={`run-check-line-${r.itemId}`}>{lineOf(r)}</span>
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
        {/* The one thing to do next (v2.7695), from the row's own facts. A held row and a paid one say why on their own line. */}
        {next ? (
          <div className="lienRunCheckNext" data-testid={`run-check-next-${r.itemId}`}>
            <b>{LIEN_RUN_STEP_WORDS.next}</b> {next}
          </div>
        ) : null}
        <div className="lienRunCheckTicks" role="group" aria-label={`${r.label} — the four steps`}>
          <div className="lienRunCheckTick" data-tick="printed" data-on={printedOk ? 'yes' : 'no'}>
            <span className="lienRunCheckTickName">{LIEN_RUN_STEP_WORDS.printed}</span>
            {r.printed && unprint?.ids.includes(r.itemId) ? (
              // The tick is a press (v2.7481): a row marked printed by mistake goes back on its own, after a confirm.
              <button
                type="button"
                className="lienRunCheckDone lienRunCheckUndo"
                onClick={() => unprint.onAsk(r)}
                disabled={busy}
                aria-label={`${r.label}: printed ${lienRunTickDay(r.printed.at)}${r.printed.by ? ` by ${r.printed.by}` : ''}. Undo…`}
                title={`Printed ${lienSignatureWhen(r.printed.at).day} at ${lienSignatureWhen(r.printed.at).clock} CT${r.printed.by ? ` by ${r.printed.by}` : ''}. Not printed, or not going out? Press to put this notice back in Approved · to print. It asks first.`}
                data-testid={`run-check-unprint-${r.itemId}`}
              >
                <span data-testid={`run-check-printed-${r.itemId}`}>
                  ✓ {lienRunTickDay(r.printed.at)}
                  {r.printed.by ? ` · ${r.printed.by}` : ''}
                </span>
                <span className="lienRunCheckUndoWord"> · Undo…</span>
              </button>
            ) : r.printed ? (
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
            <span className="lienRunCheckTickName">{LIEN_RUN_STEP_WORDS.signed}</span>
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
          {/* What goes in the envelope (the owner's ask of 2026-11-16), a step of its own since v2.7695: the files the notice has, and on a printed paper row the press that adds one. */}
          <div className="lienRunCheckTick" data-tick="envelope" data-on={r.mailedCopies.length > 0 ? 'yes' : 'no'}>
            <span className="lienRunCheckTickName">{LIEN_RUN_STEP_WORDS.envelope}</span>
            {copiesShown ? (
              <LienRunMailedCopies row={r} canAdd={printedOk} busy={busy} press={mailedCopies} />
            ) : (
              <span className="lienRunCheckWait" data-testid={`run-check-envelope-${r.itemId}`}>{closed ? 'nothing to mail' : r.paperless ? '— by email' : !printedOk ? 'print first' : 'no file added'}</span>
            )}
          </div>
          <div className="lienRunCheckTick" data-tick="mailed" data-on={r.mailed ? 'yes' : 'no'}>
            <span className="lienRunCheckTickName">{LIEN_RUN_STEP_WORDS.mailed}</span>
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
                        onFocus={() => setPlaced(new Map(rows.map((row) => [row.itemId, partFor(row)])))}
                        onBlur={() => setPlaced(null)}
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
                      {/* The envelope's receipt (v2.7695): a photo or a PDF. A photo's barcode fills a number box nobody has typed in. */}
                      {receipts && printedOk && !closed ? (
                        <span className="lienRunCheckReceipt" data-testid={`run-check-receipt-${r.itemId}-${x.key}`}>
                          <LienReceiptPhotoPress
                            jobId={r.jobId}
                            jobNumber={r.jobNumber}
                            of={x.key}
                            paper="notice"
                            day={receipts.todayYmd}
                            url={x.receiptUrl}
                            compact={!receipts.phone}
                            onSaved={(url) => receipts.onSet(r, x.key, url)}
                            onTakeOff={() => receipts.onSet(r, x.key, '')}
                            onRead={(tracking) => {
                              if (!x.tracking.trim()) onTracking(r, x.key, tracking)
                            }}
                          />
                        </span>
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
  const paidFold =
    paidRows.length > 0 ? (
      <>
        <div data-testid="run-paid-fold" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', margin: '0.1rem 0', padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-page)', fontSize: '0.8125rem' }}>
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
        {foldOpen ? paidRows.map(drawRow) : null}
      </>
    ) : null
  return (
    <div className="lienRunCheck" data-testid="run-check">
      {LIEN_RUN_GROUPS.map((g) => {
        const inGroup = rows.filter((r) => (placed?.get(r.itemId) ?? partFor(r)) === g.key)
        if (inGroup.length === 0) return null
        const dollars = inGroup.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
        // A door landed on a row (a sheet's code): its group opens whatever the step says.
        const landed = !!focusMailItemId && inGroup.some((r) => r.itemId === focusMailItemId)
        const startsFolded = g.key === 'ready' ? step === 1 : g.key === 'held' || g.key === 'wait' ? step === 3 : false
        const open = folds[g.key] ?? (landed || !startsFolded)
        const liveInGroup = inGroup.filter((r) => !r.nothingToClaim)
        return (
          <section key={g.key} className="lienRunGroup" data-testid={`run-group-${g.key}`} data-open={open ? 'yes' : 'no'} aria-label={g.head(inGroup.length, leader)}>
            <button type="button" className="lienRunGroupHead" data-tone={g.tone} aria-expanded={open} onClick={() => setFolds((f) => ({ ...f, [g.key]: !open }))} data-testid={`run-group-head-${g.key}`}>
              <span aria-hidden="true">{open ? '▾' : '▸'}</span>
              <span>{g.head(inGroup.length, leader)}</span>
              <span className="lienRunGroupTot">{formatUsdNoCents(dollars)}</span>
            </button>
            {open ? liveInGroup.map(drawRow) : null}
            {/* The paid rows' line shows whether or not the head is folded: its Close N press is never two presses away. */}
            {g.key === 'held' ? paidFold : null}
          </section>
        )
      })}
    </div>
  )
}
