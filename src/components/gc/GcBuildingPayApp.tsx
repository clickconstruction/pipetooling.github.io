import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import {
  GC_COMPANY,
  GC_COMPANY_NAME,
  bw,
  finalPayApplication,
  money,
  openInspectionFailures,
  newPayAppDraft,
  payApplication,
  payApplicationForDraw,
  payAppDraftPcts,
  payAppKnown,
  payAppSteps,
  pDate,
  resendPayAppDraft,
  sentBackOpen,
  shortDate,
  timesSentBack,
  tradeChangesFor,
  changeOrderLines,
  TRADE_RETAINAGE_WAIT_DAYS,
  tradeCloseout,
  workAllBilled,
  type BuildingWordKey,
  type Draw,
  type DrawPayApp,
  type DrawSentBack,
  type GcAction,
  type GcProject,
  type Partner,
  type PayAppInput,
  type PayAppStepKey,
  type PayApplication,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { LienReleaseStepRow } from '../jobs/LienReleaseStepRow'
import type { ReleaseStep } from '../../lib/jobs/lienReleaseSteps'
import { Btn, input as inputStyle } from './gcUi'
import { usePortalLang } from './gcPortalLang'
import { GcBuildingPunchForTrade } from './GcBuildingPunch'
import { GcBuildingSubmittalsForTrade } from './GcBuildingSubmittals'

/**
 * GC mode design spike: the pay application a trade sends with each draw. The window is the
 * Release of Lien window's shape: numbered steps down the left, the G702 and G703 beside them,
 * filling in as the trade types and marking what the current step fills. Almost every box comes
 * from the job; the trade checks the percents, adds the period and its address, and signs.
 * The office opens the same paper, read-only, from the Draws tab.
 *
 * Inside a Spanish portal the door, the window and the G702 and G703 read in Spanish
 * (gcBuildingWords.ts; owner, 2026-10-03). Outside the portal, the office's copy, it is English.
 */

/** The gc's short name for sentences: "Click checks it". */
const GC_SHORT = GC_COMPANY.shortName

const STEP_TITLES: Record<PayAppStepKey, BuildingWordKey> = { work: 'stepWork', details: 'stepDetails', sign: 'stepSign', send: 'stepSend' }

/** The tag each step puts on the paper where it fills. */
const MARK_WORDS: Record<PayAppStepKey, BuildingWordKey> = { work: 'markWork', details: 'markDetails', sign: 'markSign', send: 'markSend' }

/** The pay application's words in the portal's language, Click's short name filled in. */
function useWords() {
  const { lang } = usePortalLang()
  return { lang, w: (key: BuildingWordKey, vars?: Record<string, string | number>) => bw(lang, key, { gc: GC_SHORT, ...vars }) }
}

/** A sentence with its {amount} drawn bold. */
function withBold(text: string, value: string): ReactNode {
  return withNode(text, 'amount', <strong>{value}</strong>)
}

/** A sentence with one {blank} drawn as a node: a bold amount, a value that fills in on the paper. */
function withNode(text: string, blank: string, node: ReactNode): ReactNode {
  const [before = '', after = ''] = text.split(`{${blank}}`)
  return (
    <>
      {before}
      {node}
      {after}
    </>
  )
}

/** Which page each step fills: the work is on the G703, the rest on the G702. */
const STEP_PAGE: Record<PayAppStepKey, Page> = { work: 'g703', details: 'g702', sign: 'g702', send: 'g702' }

type Page = 'g702' | 'g703'

const PCTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

// ---------------------------------------------------------------------------------------------
// The door in the trade's portal
// ---------------------------------------------------------------------------------------------

/**
 * Where a trade asks for a draw in its portal: one button that opens the pay application, or, once
 * one is sent, a line that says it is with the office and opens it to look. Once every line is
 * billed it turns into the trade's closeout: the warranty letter, the final pay application.
 */
export function GcBuildingPayAppDoor({
  project,
  pkg,
  partner,
  today,
  dispatch,
}: {
  project: GcProject
  pkg: TradePackage
  partner: Partner
  /** The prototype's today: closeout waits on dates. */
  today: string
  dispatch: Dispatch<GcAction>
}) {
  const [open, setOpen] = useState<'draft' | 'final' | Draw | null>(null)
  // The draft lives here, not in the window: a click outside closes the window, never the work.
  // Its key says which application it is for: a new one, a resend after we sent one back, the final.
  const [held, setHeld] = useState<{ key: string; input: PayAppInput } | null>(null)
  const { lang, w } = useWords()
  const sow = pkg.sow
  if (!sow || sow.status !== 'signed') return null
  const waiting = sow.draws.find((d) => d.status === 'requested')
  const back = sentBackOpen(sow)
  const keyFor = (which: 'draft' | 'final') =>
    which === 'final' ? 'final' : back ? `resend-${back.draw.number}-${timesSentBack(sow, back.draw.number)}` : 'new'
  const draft = held && held.key === keyFor('draft') ? held.input : null
  // What the draft asks for now, or what their reported work comes to before they open it.
  const asks = payApplication(sow, sow.draws.length + 1, draft?.toPct ?? payAppDraftPcts(sow))
  const ready = asks.summary.currentDue
  const closing = workAllBilled(sow)
  const openWindow = (which: 'draft' | 'final') => {
    const key = keyFor(which)
    if (held?.key !== key) {
      setHeld({ key, input: which === 'draft' && back ? resendPayAppDraft(sow, partner, back) : newPayAppDraft(sow, partner) })
    }
    setOpen(which)
  }
  const onDraft: Dispatch<SetStateAction<PayAppInput>> = (next) =>
    setHeld((h) => (h ? { ...h, input: typeof next === 'function' ? next(h.input) : next } : h))
  const label = (sovId: string) => sow.sov.find((l) => l.id === sovId)?.label ?? sovId
  // The last draw approved for less than asked: say so, and that the rest is still theirs to ask for.
  const last = sow.draws[sow.draws.length - 1]
  const lessNote = last?.asked ? w('lessNote', { x: money(last.net), y: money(last.asked.net), n: last.number, note: last.asked.note }) : null

  // A change order sent to them: they sign it into their statement of work here (Building lane).
  const changesToSign = tradeChangesFor(project, pkg).filter((c) => c.state === 'sent')

  return (
    <>
      <InspectionFailedForTrade project={project} pkg={pkg} />
      <GcBuildingPunchForTrade project={project} pkg={pkg} dispatch={dispatch} />
      <GcBuildingSubmittalsForTrade project={project} pkg={pkg} today={today} dispatch={dispatch} />
      {changesToSign.map(({ co }) => (
        <div key={co.id} style={{ padding: '0.55rem 0.65rem', background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', borderRadius: 6, display: 'grid', gap: '0.4rem' }}>
          <div>
            <strong>{w('changeTo', { n: co.number })}</strong> {co.description.trim().replace(/[.\s]+$/, '')}.{' '}
            {co.cost < 0 ? w('changeTakes', { amount: money(-co.cost) }) : w('changeAdds', { amount: money(co.cost) })}{' '}
            {co.schedule !== 'none' ? w('changeTime', { schedule: co.schedule }) : ''}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn kind="primary" disabled={partner.msa !== 'signed'} onClick={() => dispatch({ type: 'tradeSignChange', projectId: project.id, changeOrderId: co.id })}>
              {w('signChange')}
            </Btn>
            {partner.msa !== 'signed' && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{w('signMsaFirst')}</span>}
          </div>
        </div>
      ))}
      <div style={{ padding: '0.55rem 0.65rem', background: 'var(--bg-subtle)', borderRadius: 6, display: 'grid', gap: '0.4rem' }}>
        {closing ? (
          <CloseoutForTrade project={project} pkg={pkg} today={today} onFinal={() => openWindow('final')} onSee={(d) => setOpen(d)} />
        ) : waiting ? (
          <>
            <div>{w('withGc', { n: waiting.number })}</div>
            {waiting.payApp && (
              <div>
                <Btn onClick={() => setOpen(waiting)}>{w('seePayApp', { n: waiting.number })}</Btn>
              </div>
            )}
          </>
        ) : back ? (
          <>
            <div>
              <strong style={{ color: 'var(--text-amber-800)' }}>{w('sentBackHead', { n: back.draw.number, date: pDate(lang, back.on) })}</strong> {w('fixIt')}
            </div>
            {back.note && <div>&ldquo;{back.note}&rdquo;</div>}
            {back.lines.map((l) => (
              <div key={l.sovId}>{w('seesLine', { line: label(l.sovId), n: l.weSee, m: back.draw.lines.find((x) => x.sovId === l.sovId)?.toPct ?? 0 })}</div>
            ))}
            <div>
              <Btn kind="primary" onClick={() => openWindow('draft')}>
                {w(draft ? 'goOn' : 'fixResend', { n: back.draw.number })}
              </Btn>
            </div>
          </>
        ) : (
          <>
            {lessNote && <div>{lessNote}</div>}
            <div>
              {ready > 0 ? withBold(w('canAsk'), money(ready)) : w('reportFirst')}
            </div>
            <div>
              <Btn kind="primary" onClick={() => openWindow('draft')}>
                {w(draft ? 'goOn' : 'fillOut', { n: sow.draws.length + 1 })}
              </Btn>
            </div>
          </>
        )}
      </div>
      {open !== null && held && (open === 'draft' || open === 'final') && (
        <GcBuildingPayAppWindow
          project={project}
          pkg={pkg}
          partner={partner}
          dispatch={dispatch}
          draw={null}
          final={open === 'final'}
          sentBack={open === 'draft' ? back : null}
          viewer="trade"
          draft={held.input}
          onDraft={onDraft}
          onSent={() => setHeld(null)}
          onClose={() => setOpen(null)}
        />
      )}
      {open !== null && open !== 'draft' && open !== 'final' && (
        <GcBuildingPayAppWindow project={project} pkg={pkg} partner={partner} draw={open} viewer="trade" onClose={() => setOpen(null)} />
      )}
    </>
  )
}

/**
 * An inspection that failed on the trade's work and has not passed since (owner, 2026-10-03):
 * what failed, in our superintendent's words, and the re-inspection day to fix it by.
 */
function InspectionFailedForTrade({ project, pkg }: { project: GcProject; pkg: TradePackage }) {
  const { lang, w } = useWords()
  const open = openInspectionFailures(project, pkg.id)
  if (open.length === 0) return null
  return (
    <>
      {open.map((f) => (
        <div
          key={f.activity.lineId}
          style={{ padding: '0.55rem 0.65rem', background: 'var(--bg-red-100)', border: '1px solid var(--border-strong)', borderRadius: 6, display: 'grid', gap: '0.25rem' }}
        >
          <strong style={{ color: 'var(--text-red-800)' }}>{w('inspFailed', { label: f.label, date: pDate(lang, f.failure.on) })}</strong>
          <span>&ldquo;{f.failure.note}&rdquo;</span>
          <span>{w('inspAgain', { date: pDate(lang, f.failure.reinspectOn) })}</span>
        </div>
      ))}
    </>
  )
}

/**
 * The trade's closeout, in its portal: what is left before the retainage comes back. Click's
 * steps read as waits; theirs carry the button. The final waiver's button is the portal's own,
 * on the paid draw in the list under this block.
 */
function CloseoutForTrade({
  project,
  pkg,
  today,
  onFinal,
  onSee,
}: {
  project: GcProject
  pkg: TradePackage
  today: string
  onFinal: () => void
  onSee: (draw: Draw) => void
}) {
  const { lang, w } = useWords()
  const sow = pkg.sow
  if (!sow) return null
  const c = tradeCloseout(sow, project, today)
  const f = c.finalDraw
  if (c.closed) {
    return (
      <div>
        <strong>{w('closedOut')}</strong> {w('paidBackThanks', { amount: money(f?.net ?? 0) })}
      </div>
    )
  }
  const accepted = Boolean(sow.acceptedOn)
  const back = sentBackOpen(sow)
  const item = (done: boolean, words: ReactNode, extra?: ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1rem minmax(0, 1fr)', gap: '0.4rem', alignItems: 'baseline' }}>
      <span aria-hidden style={{ fontWeight: 700, color: done ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{done ? '✓' : '•'}</span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', alignItems: 'center' }}>
        <span style={{ color: done ? 'var(--text-muted)' : undefined }}>{words}</span>
        {extra}
      </span>
    </div>
  )
  const opensWhen = w('opensWhen')
  return (
    <>
      <div>
        <strong>{w('closeoutHead')}</strong> {withBold(w('allBilled'), money(c.held))}
      </div>
      {back?.draw.final && (
        <div>
          <strong style={{ color: 'var(--text-amber-800)' }}>{w('finalSentBack', { date: pDate(lang, back.on) })}</strong> {back.note} {w('fixIt')}
        </div>
      )}
      {item(accepted, accepted ? w('accepted', { date: pDate(lang, sow.acceptedOn ?? null) }) : w('walks'))}
      {item(
        f !== null,
        f ? w('finalWith') : w('askFinal', { amount: money(c.held) }),
        f ? (
          <Btn onClick={() => onSee(f)}>{w('seeIt')}</Btn>
        ) : (
          <Btn kind="primary" disabled={!c.canAskFinal} onClick={onFinal}>
            {w('fillFinal')}
          </Btn>
        ),
      )}
      {!f && !c.canAskFinal && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.4rem' }}>{opensWhen}</div>}
      {item(
        f?.status === 'paid',
        f?.status === 'paid'
          ? w('retPaid')
          : f?.status === 'approved'
            ? w('retApproved')
            : c.opensOn
              ? w('retOn', { date: pDate(lang, c.opensOn), days: TRADE_RETAINAGE_WAIT_DAYS })
              : w('retAfter', { days: TRADE_RETAINAGE_WAIT_DAYS }),
      )}
      {item(
        false,
        f?.status === 'paid' ? w('signFinalBelow') : w('signFinalLast'),
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------------------------

export function GcBuildingPayAppWindow({
  project,
  pkg,
  partner,
  dispatch,
  draw,
  final: finalProp = false,
  sentBack = null,
  viewer,
  draft: heldDraft = null,
  onDraft,
  onSent,
  onClose,
}: {
  project: GcProject
  pkg: TradePackage
  partner: Partner
  dispatch?: Dispatch<GcAction>
  /** A sent application to look at. Null: the trade is filling out a new one. */
  draw: Draw | null
  /** A new final pay application: it asks for the retainage, every line at 100%. */
  final?: boolean
  /** A resend after we sent this application back: our note and numbers show beside theirs. */
  sentBack?: DrawSentBack | null
  viewer: 'trade' | 'office'
  /** The trade's draft, held by the door so closing the window keeps it. */
  draft?: PayAppInput | null
  onDraft?: Dispatch<SetStateAction<PayAppInput>>
  /** The application went out: the door drops its draft. */
  onSent?: () => void
  onClose: () => void
}) {
  const { lang, w } = useWords()
  const sow = pkg.sow
  const known = payAppKnown(partner)
  const [ownDraft, setOwnDraft] = useState<PayAppInput>(
    () => heldDraft ?? (sow ? newPayAppDraft(sow, partner) : { toPct: {}, periodTo: '', address: '', license: '', signedBy: '', signedTitle: '', waiverSigned: false }),
  )
  const draft = heldDraft ?? ownDraft
  const setDraft = onDraft ?? setOwnDraft
  const [focus, setFocus] = useState<PayAppStepKey | null>(null)
  // The page the trade turned to, and the step it was turned on. A new step turns the page again.
  const [pick, setPick] = useState<{ page: Page; at: PayAppStepKey | null } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const final = draw ? draw.final === true : finalProp
  // A draw we sent back, opened from the history; or an application sent again after one went back.
  const returnedAs = draw ? ((sow?.sentBack ?? []).find((b) => b.draw === draw) ?? null) : null
  const revised = !returnedAs && sow ? timesSentBack(sow, draw ? draw.number : sow.draws.length + 1) > 0 : false
  const weSee = new Map((sentBack?.lines ?? []).map((l) => [l.sovId, l.weSee]))
  const app = useMemo(() => {
    if (!sow) return null
    if (draw) return payApplicationForDraw(sow, draw)
    return finalProp ? finalPayApplication(sow) : payApplication(sow, sow.draws.length + 1, draft.toPct)
  }, [sow, draw, finalProp, draft.toPct])

  const { steps, ready } = useMemo(
    () => (app ? payAppSteps(app, draft) : { steps: [], ready: false }),
    [app, draft],
  )
  const current = steps.find((s) => s.state === 'now')?.key ?? null
  const mark = draw ? null : (focus ?? current)
  // The paper turns to the page the step fills, the way the lien window keeps its page in step.
  const page: Page = pick && pick.at === mark ? pick.page : mark ? STEP_PAGE[mark] : (pick?.page ?? 'g702')

  if (!sow || !app) return null

  const typed: Omit<DrawPayApp, 'signedOn'> & { signedOn: string | null } = draw?.payApp
    ? draw.payApp
    : { periodTo: draft.periodTo, address: draft.address, license: draft.license, signedBy: draft.signedBy, signedTitle: draft.signedTitle, signedOn: draft.waiverSigned && draft.signedTitle.trim() ? 'today' : null }

  const set = (patch: Partial<PayAppInput>) => setDraft((i) => ({ ...i, ...patch }))
  const stepAt = (key: PayAppStepKey): ReleaseStep => {
    const s = steps.find((x) => x.key === key)
    // The rail draws the lien window's step; its key names a lien step, so any one serves.
    return { n: s?.n ?? 1, key: 'details', state: s?.state ?? 'wait', waitsFor: null, folded: false }
  }
  const send = () => {
    if (!dispatch || !ready) return
    const typedIn = { periodTo: draft.periodTo, address: draft.address, license: draft.license, signedBy: draft.signedBy, signedTitle: draft.signedTitle }
    if (final) dispatch({ type: 'tradeSendFinalPayApp', projectId: project.id, packageId: pkg.id, ...typedIn })
    else dispatch({ type: 'tradeSendPayApp', projectId: project.id, packageId: pkg.id, toPct: draft.toPct, ...typedIn })
    onSent?.()
    onClose()
  }
  const net = app.summary.currentDue
  const title = `${w(final ? 'titleFinal' : 'title', { n: app.number })}${returnedAs ? w('stampBack') : revised ? w('stampRevised') : ''}`
  const waiverWords = w(final ? 'waiverFinal' : 'waiverProgress')
  // The shared step row writes "Done" and "You are here" itself; in Spanish the window's CSS puts these over them.
  const stepWords = lang === 'es' ? ({ '--gcStepDone': JSON.stringify(w('stepDone')), '--gcStepNow': JSON.stringify(w('stepNow')) } as CSSProperties) : undefined
  const waitWord = lang === 'es' ? w('stepWaiting') : undefined
  const titleId = 'gc-payapp-title'

  const paper = (
    <PayAppPaper
      app={app}
      project={project}
      pkg={pkg}
      partner={partner}
      typed={typed}
      mark={mark}
      page={page}
      onPage={(p) => setPick({ page: p, at: mark })}
      certified={draw && draw.status !== 'requested' && !returnedAs ? draw.net : null}
      stamp={returnedAs ? w('stampBack') : revised ? w('stampRevised') : null}
    />
  )

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-theme={viewer === 'trade' ? 'light' : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          borderRadius: 10,
          maxWidth: draw ? 900 : 1200,
          width: '100%',
          maxHeight: 'min(94vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{PAY_APP_CSS}</style>
        <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
          <div>
            <h2 id={titleId} style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
              {title}
            </h2>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {w('subtitle', { trade: pkg.trade, company: partner.company, project: project.name })}
            </p>
          </div>
          <button
            type="button"
            aria-label={w('close')}
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', lineHeight: 1, cursor: 'pointer', padding: '0.1rem 0.35rem' }}
          >
            ✕
          </button>
        </div>

        {draw ? (
          <div className="lienRelease-body" style={{ display: 'block' }}>
            <div style={{ padding: '0.75rem 1.25rem 0', fontSize: '0.875rem' }}>
              {draw.payApp ? (
                <>
                  {viewer === 'trade' ? w('youSent', { date: pDate(lang, draw.payApp.signedOn) }) : `${partner.company} sent this ${shortDate(draw.payApp.signedOn)}.`}{' '}
                  {w('signedIt', {
                    name: `${draw.payApp.signedBy}${draw.payApp.signedTitle ? `, ${draw.payApp.signedTitle},` : ''}`,
                    waiver: waiverWords,
                    amount: money(draw.net),
                  })}
                </>
              ) : (
                <>{w('beforePayApps')}</>
              )}
              {draw.asked && (
                <>
                  {' '}
                  <strong style={{ color: 'var(--text-amber-800)' }}>
                    {viewer === 'office' ? `We approved ${money(draw.net)} of the ${money(draw.asked.net)} asked.` : w('approvedLess', { x: money(draw.net), y: money(draw.asked.net) })}
                  </strong>{' '}
                  {draw.asked.note}
                </>
              )}
              {returnedAs && (
                <>
                  {' '}
                  <strong style={{ color: 'var(--text-amber-800)' }}>
                    {viewer === 'office' ? `We sent it back ${shortDate(returnedAs.on)}.` : w('sentItBack', { date: pDate(lang, returnedAs.on) })}
                  </strong>{' '}
                  {returnedAs.note}
                </>
              )}
            </div>
            <div data-theme="light" style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
              {paper}
            </div>
          </div>
        ) : (
          <div className={`lienRelease-body gcPayApp-body${lang === 'es' ? ' gcPayApp-es' : ''}`} style={stepWords}>
            <div className="lienRelease-steps">
              <LienReleaseStepRow
                step={stepAt('work')}
                title={w(final ? 'stepWorkFinal' : STEP_TITLES.work)}
                nextIsCurrent={current === 'details'}
                waitLabel={waitWord}
                say={w(final ? 'sayFinal' : sentBack ? 'saySentBack' : app.totals.thisPeriod > 0 ? 'sayStarts' : 'sayNothing')}
              >
                <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }} onFocus={() => setFocus('work')}>
                  {sentBack?.note && (
                    <div style={{ padding: '0.4rem 0.55rem', borderRadius: 6, background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' }}>
                      {GC_SHORT}: &ldquo;{sentBack.note}&rdquo;
                    </div>
                  )}
                  {final && (
                    <>
                      {app.lines.map((l) => (
                        <div key={l.sovId} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span>
                            {l.label} <span style={{ color: 'var(--text-muted)' }}>· {money(l.scheduled)}</span>
                          </span>
                          <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{w('billed100')}</span>
                        </div>
                      ))}
                      <div style={{ color: 'var(--text-muted)' }}>
                        {w('retHeld')} <strong style={{ color: 'var(--text-base)' }}>{money(net)}</strong>
                      </div>
                    </>
                  )}
                  {!final && app.lines.map((l) => {
                    const before = l.fromPrevious === 0 ? 0 : Math.round((l.fromPrevious / l.scheduled) * 100)
                    return (
                      <label key={l.sovId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center' }}>
                        <span>
                          {l.label} <span style={{ color: 'var(--text-muted)' }}>· {money(l.scheduled)}{before > 0 ? w('paidThrough', { n: before }) : ''}</span>
                          {weSee.has(l.sovId) && (
                            <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>{w('gcSees', { n: weSee.get(l.sovId) ?? 0 })}</span>
                          )}
                        </span>
                        <select
                          value={l.pct}
                          onChange={(e) => set({ toPct: { ...draft.toPct, [l.sovId]: Number(e.target.value) } })}
                          style={input_}
                          aria-label={w('pctAria', { line: l.label })}
                        >
                          {PCTS.filter((p) => p >= before).map((p) => (
                            <option key={p} value={p}>
                              {w('pctDone', { n: p })}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  })}
                  {!final && (
                    <div style={{ color: 'var(--text-muted)' }}>
                      {w('workPeriod')} <strong style={{ color: 'var(--text-base)' }}>{money(app.totals.thisPeriod)}</strong>
                    </div>
                  )}
                </div>
              </LienReleaseStepRow>

              <LienReleaseStepRow
                step={stepAt('details')}
                title={w(STEP_TITLES.details)}
                nextIsCurrent={current === 'sign'}
                waitLabel={waitWord}
                say={w('sayDetails')}
              >
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }} onFocus={() => setFocus('details')}>
                  <Field label={w('periodEnds')}>
                    <input type="date" value={draft.periodTo} onChange={(e) => set({ periodTo: e.target.value })} style={input_} />
                  </Field>
                  <Field label={w('address')} note={w(known.address ? 'onFile' : 'keepIt')}>
                    <input type="text" value={draft.address} onChange={(e) => set({ address: e.target.value })} placeholder={w('addressHint')} style={input_} />
                  </Field>
                  <Field label={w('license')} note={w('licenseNote')}>
                    <input type="text" value={draft.license} onChange={(e) => set({ license: e.target.value })} style={input_} />
                  </Field>
                </div>
              </LienReleaseStepRow>

              <LienReleaseStepRow
                step={stepAt('sign')}
                title={w(STEP_TITLES.sign)}
                nextIsCurrent={current === 'send'}
                waitLabel={waitWord}
                say={w('saySign')}
              >
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }} onFocus={() => setFocus('sign')}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.5rem' }}>
                    <Field label={w('yourName')}>
                      <input type="text" value={draft.signedBy} onChange={(e) => set({ signedBy: e.target.value })} style={input_} />
                    </Field>
                    <Field label={w('yourTitle')}>
                      <input type="text" value={draft.signedTitle} onChange={(e) => set({ signedTitle: e.target.value })} placeholder={w('titleHint')} style={input_} />
                    </Field>
                  </div>
                  <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={draft.waiverSigned} onChange={(e) => set({ waiverSigned: e.target.checked })} style={{ marginTop: '0.2rem' }} />
                    <span>{w('iSign', { waiver: waiverWords, amount: money(net) })}</span>
                  </label>
                </div>
              </LienReleaseStepRow>

              <LienReleaseStepRow
                step={stepAt('send')}
                title={w(STEP_TITLES.send)}
                last
                waitLabel={w('opensAfter')}
                say={w(final ? 'saySendFinal' : 'saySend')}
              >
                <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }} onFocus={() => setFocus('send')}>
                  <div>
                    {final ? withBold(w('askAllHeld'), money(net)) : withBold(w('askHolds', { pct: sow.retainagePct }), money(net))}
                  </div>
                  <div>
                    <Btn kind="primary" disabled={!ready || !dispatch} onClick={send}>
                      {w('sendTo')}
                    </Btn>
                  </div>
                </div>
              </LienReleaseStepRow>
            </div>

            {/* The paper: pinned light like the printed form, kept in view while the steps scroll. */}
            <div className="lienRelease-preview" data-theme="light">
              <div style={{ marginBottom: '0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-base)' }}>{w('theForm')}</strong> · {w('fillsIn')}
              </div>
              {paper}
            </div>
          </div>
        )}

        {!draw && (
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 650, color: 'var(--text-blue-700)' }}>
              {(() => {
                const now = steps.find((s) => s.state === 'now')
                return now ? w('onStep', { n: now.n, step: w(STEP_TITLES[now.key]) }) : w('allDone')
              })()}
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

const input_: CSSProperties = { ...inputStyle, width: '100%', boxSizing: 'border-box' }

function Field({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>
        {label}
        {note && <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {note}</span>}
      </span>
      {children}
    </label>
  )
}

// ---------------------------------------------------------------------------------------------
// The paper: the G702 and the G703
// ---------------------------------------------------------------------------------------------

const PAY_APP_CSS = `
@keyframes gcPayAppFlash { from { background: var(--bg-blue-tint); } to { background: transparent; } }
.gcPayApp-val { animation: gcPayAppFlash 1.2s ease-out; border-radius: 3px; }
.gcPayApp-table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; font-size: 0.72rem; }
.gcPayApp-table th { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.58rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; color: var(--text-muted); border: 1px solid var(--border-strong); padding: 0.25rem 0.2rem; vertical-align: bottom; text-align: center; }
.gcPayApp-table td { border: 1px solid var(--border-strong); padding: 0.25rem 0.3rem; text-align: right; white-space: nowrap; }
/* The form is the point here: on a wide screen it gets more of the window than the lien window gives its page. */
@media (min-width: 901px) {
  .gcPayApp-body .lienRelease-steps { flex: 0 1 26rem; }
  .gcPayApp-body .lienRelease-preview { flex: 1 1 36rem; }
}
.gcPayApp-table td.gcPayApp-left { text-align: left; white-space: normal; }
.gcPayApp-table tr.gcPayApp-total td { font-weight: 700; border-top: 2px solid var(--text-base); }
/* In Spanish: the step row's own "Done" and "You are here", replaced by the window's words (--gcStepDone, --gcStepNow). */
.gcPayApp-es .lienStep-label[data-state='done'], .gcPayApp-es .lienStep-label[data-state='now'] { font-size: 0; }
.gcPayApp-es .lienStep-label[data-state='done']::after { content: var(--gcStepDone); font-size: 0.6875rem; }
.gcPayApp-es .lienStep-label[data-state='now']::after { content: var(--gcStepNow); font-size: 0.6875rem; }
`

/** A value on the paper that flashes when it changes, so the trade sees the form fill. A blank reads as a line. */
function Val({ children, strong = false }: { children: string; strong?: boolean }) {
  if (!children.trim()) return <span style={{ color: 'var(--text-muted)' }}>______________</span>
  return (
    <span key={children} className="gcPayApp-val" style={{ fontWeight: strong ? 700 : undefined }}>
      {children}
    </span>
  )
}

/** The dashed outline and tag that say "this step fills this part", as the lien window marks its page. */
function Mark({ on, tag, children }: { on: boolean; tag: string; children: ReactNode }) {
  if (!on) return <div>{children}</div>
  return (
    <div data-mark="true" style={{ position: 'relative', border: '2px dashed #2563eb', borderRadius: 8, padding: '0.55rem 0.6rem 0.45rem', margin: '0.35rem -0.6rem', background: 'var(--bg-blue-tint)' }}>
      <span
        style={{
          position: 'absolute',
          top: '-0.85em',
          left: '0.6em',
          background: '#2563eb',
          color: '#ffffff',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: '0.72rem',
          fontWeight: 700,
          borderRadius: 999,
          padding: '0.1em 0.65em',
          whiteSpace: 'nowrap',
        }}
      >
        {tag}
      </span>
      {children}
    </div>
  )
}

const label: CSSProperties = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: '0.62rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text-muted)',
}

function Box({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: '0.05rem', minWidth: 0 }}>
      <span style={label}>{name}</span>
      <span>{children}</span>
    </div>
  )
}

function PayAppPaper({
  app,
  project,
  pkg,
  partner,
  typed,
  mark,
  page,
  onPage,
  certified,
  stamp,
}: {
  app: PayApplication
  project: GcProject
  pkg: TradePackage
  partner: Partner
  typed: Omit<DrawPayApp, 'signedOn'> & { signedOn: string | null }
  mark: PayAppStepKey | null
  page: Page
  onPage: (p: Page) => void
  /** What we certified: the draw's net once approved, which is less than asked when we approved less. */
  certified: number | null
  /** Words after the page line: " · revised", " · sent back". */
  stamp: string | null
}) {
  const { lang, w } = useWords()
  const s = app.summary
  const contractDate = pkg.sow?.signedOn ?? null
  const signedOnWords = typed.signedOn === 'today' ? w('today') : pDate(lang, typed.signedOn)
  const tab = (p: Page, words: string) => (
    <button
      type="button"
      onClick={() => onPage(p)}
      aria-pressed={page === p}
      style={{
        padding: '0.3rem 0.75rem',
        borderRadius: 999,
        border: `1px solid ${page === p ? '#2563eb' : 'var(--border-strong)'}`,
        background: page === p ? '#2563eb' : 'var(--surface)',
        color: page === p ? '#ffffff' : 'var(--text-base)',
        fontSize: '0.78rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {words}
    </button>
  )
  const line = (n: string, words: string, value: string, strong = false) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6rem minmax(0, 1fr) auto', gap: '0.4rem', alignItems: 'baseline', padding: '0.18rem 0', borderBottom: '1px dotted var(--border-strong)' }}>
      <span style={{ fontWeight: 700 }}>{n}</span>
      <span style={{ fontWeight: strong ? 700 : undefined }}>{words}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        <Val strong={strong}>{value}</Val>
      </span>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
        {tab('g702', w('page702'))}
        {tab('g703', w('page703'))}
      </div>
      <div
        style={{
          background: 'var(--surface)',
          color: 'var(--text-base)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '1.1rem 1.25rem',
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: '0.8rem',
          lineHeight: 1.55,
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
        }}
      >
        {page === 'g702' ? (
          <>
            <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.15em' }}>
              {w('g702Title')}
            </p>
            <p style={{ ...label, textAlign: 'center', margin: '0 0 0.9em' }}>
              {w('g702Sub')}
              {app.final ? w('g702Final') : ''}
              {stamp ?? ''}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '0.6rem 1.25rem' }}>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                <Box name={w('boxTo')}>{GC_COMPANY_NAME}</Box>
                <Mark on={mark === 'details'} tag={w(MARK_WORDS.details)}>
                  <Box name={w('boxFrom')}>
                    {partner.company}
                    <br />
                    <Val>{typed.address}</Val>
                    {typed.license.trim() ? (
                      <>
                        <br />
                        <Val>{typed.license}</Val>
                      </>
                    ) : null}
                  </Box>
                </Mark>
                <Box name={w('boxContractFor')}>{pkg.trade}</Box>
              </div>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                <Box name={w('boxProject')}>
                  {project.name}
                  <br />
                  {project.address}
                </Box>
                <Box name={w('boxArchitect')}>{project.architect}</Box>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  <Box name={w('boxAppNo')}>{String(app.number)}</Box>
                  <Mark on={mark === 'details'} tag="2">
                    <Box name={w('boxPeriodTo')}>
                      <Val>{pDate(lang, typed.periodTo || null)}</Val>
                    </Box>
                  </Mark>
                  <Box name={w('boxContractDate')}>{pDate(lang, contractDate)}</Box>
                </div>
              </div>
            </div>

            <p style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '1.1em 0 0.3em', fontSize: '0.75rem' }}>
              {w('appForPayment')}
            </p>
            {line('1', w('line1'), money(s.originalSum))}
            {line('2', w('line2'), money(s.changeOrders))}
            {line('3', w('line3'), money(s.sumToDate))}
            <Mark on={mark === 'work'} tag={w(MARK_WORDS.work)}>
              {line('4', w('line4'), money(s.completedToDate))}
            </Mark>
            {line('5', app.final ? w('line5Final') : w('line5', { pct: s.retainagePct }), money(s.retainage))}
            {line('6', w('line6'), money(s.earnedLessRetainage))}
            {line('7', w('line7'), money(s.previousCertificates))}
            <Mark on={mark === 'send'} tag={w(MARK_WORDS.send)}>
              {line('8', w('line8'), money(s.currentDue), true)}
            </Mark>
            {line('9', w('line9'), money(s.balanceToFinish))}
            <div style={{ ...label, marginTop: '0.4rem' }}>
              {(() => {
                const n = pkg.sow ? changeOrderLines(pkg.sow).length : 0
                return n === 0 ? w('coNone') : w('coSome', { n, amount: money(s.changeOrders) })
              })()}
            </div>

            <Mark on={mark === 'sign'} tag={w(MARK_WORDS.sign)}>
              <div style={{ marginTop: '0.9rem' }}>
                <p style={{ margin: '0 0 0.6em' }}>
                  {w('certifies', { waiver: w(app.final ? 'waiverFinal' : 'waiverProgress'), amount: money(s.currentDue) })}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
                  <div style={{ borderBottom: '1px solid var(--text-base)', paddingBottom: '0.15rem', minHeight: '1.6em', fontStyle: typed.signedOn ? 'italic' : undefined, fontSize: typed.signedOn ? '1rem' : undefined }}>
                    {typed.signedOn ? <Val>{typed.signedBy}</Val> : null}
                  </div>
                  <Box name={w('boxTitle')}>
                    <Val>{typed.signedTitle}</Val>
                  </Box>
                  <Box name={w('boxDate')}>
                    <Val>{typed.signedOn ? signedOnWords : ''}</Val>
                  </Box>
                </div>
                <div style={{ ...label, marginTop: '0.2rem' }}>
                  {withNode(w('byFor', { company: partner.company }), 'name', <Val>{typed.signedBy}</Val>)}
                </div>
              </div>
            </Mark>

            <div style={{ marginTop: '1rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-strong)' }}>
              <p style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 0.3em', fontSize: '0.75rem' }}>
                {w('certificate')}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem' }}>
                <Box name={w('boxCertified')}>
                  <Val>{certified === null ? '' : money(certified)}</Val>
                </Box>
                <Box name={w('boxBy')}>
                  <Val>{certified === null ? '' : GC_COMPANY_NAME}</Val>
                </Box>
              </div>
            </div>
          </>
        ) : (
          <>
            <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.15em' }}>
              {w('g703Title')}
            </p>
            <p style={{ ...label, textAlign: 'center', margin: '0 0 0.8em' }}>{w('g703Sub')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '0.45rem', marginBottom: '0.7rem' }}>
              <Box name={w('boxAppNo')}>{String(app.number)}</Box>
              <Box name={w('boxPeriodTo')}>
                <Val>{pDate(lang, typed.periodTo || null)}</Val>
              </Box>
              <Box name={w('boxProject')}>{project.name}</Box>
            </div>
            <Mark on={mark === 'work'} tag={w(MARK_WORDS.work)}>
              <div style={{ overflowX: 'auto' }}>
                <table className="gcPayApp-table">
                  <thead>
                    <tr>
                      <th>A<br />{w('colItem')}</th>
                      <th>B<br />{w('colWork')}</th>
                      <th>C<br />{w('colScheduled')}</th>
                      <th>D<br />{w('colPrevious')}</th>
                      <th>E<br />{w('colThisPeriod')}</th>
                      <th>F<br />{w('colStored')}</th>
                      <th>G<br />{w('colToDate')}</th>
                      <th>%<br />G ÷ C</th>
                      <th>H<br />{w('colBalance')}</th>
                      <th>I<br />{w('colRetainage')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {app.lines.map((l) => (
                      <tr key={l.sovId}>
                        <td>{l.item}</td>
                        <td className="gcPayApp-left">{l.label}</td>
                        <td>{money(l.scheduled)}</td>
                        <td>{money(l.fromPrevious)}</td>
                        <td>
                          <Val strong={l.thisPeriod > 0}>{money(l.thisPeriod)}</Val>
                        </td>
                        <td>{money(l.stored)}</td>
                        <td>
                          <Val>{money(l.toDate)}</Val>
                        </td>
                        <td>
                          <Val>{`${l.pct}%`}</Val>
                        </td>
                        <td>
                          <Val>{money(l.balance)}</Val>
                        </td>
                        <td>
                          <Val>{money(l.retainage)}</Val>
                        </td>
                      </tr>
                    ))}
                    <tr className="gcPayApp-total">
                      <td />
                      <td className="gcPayApp-left">{w('grandTotal')}</td>
                      <td>{money(app.totals.scheduled)}</td>
                      <td>{money(app.totals.fromPrevious)}</td>
                      <td>
                        <Val>{money(app.totals.thisPeriod)}</Val>
                      </td>
                      <td>{money(app.totals.stored)}</td>
                      <td>
                        <Val>{money(app.totals.toDate)}</Val>
                      </td>
                      <td>
                        <Val>{`${app.totals.pct}%`}</Val>
                      </td>
                      <td>
                        <Val>{money(app.totals.balance)}</Val>
                      </td>
                      <td>
                        <Val>{money(app.totals.retainage)}</Val>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Mark>
          </>
        )}
      </div>
    </div>
  )
}
