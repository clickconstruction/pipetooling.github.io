import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import {
  GC_COMPANY_NAME,
  finalPayApplication,
  money,
  newPayAppDraft,
  payApplication,
  payApplicationForDraw,
  payAppDraftPcts,
  payAppKnown,
  payAppSteps,
  resendPayAppDraft,
  sentBackOpen,
  shortDate,
  timesSentBack,
  tradeCloseout,
  workAllBilled,
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

/**
 * GC mode design spike: the pay application a trade sends with each draw. The window is the
 * Release of Lien window's shape: numbered steps down the left, the G702 and G703 beside them,
 * filling in as the trade types and marking what the current step fills. Almost every box comes
 * from the job; the trade checks the percents, adds the period and its address, and signs.
 * The office opens the same paper, read-only, from the Draws tab.
 */

/** The gc's short name for sentences: "Click checks it". */
const GC_SHORT = GC_COMPANY_NAME.split(' ')[0] ?? GC_COMPANY_NAME

const STEP_TITLES: Record<PayAppStepKey, string> = {
  work: 'Check your work',
  details: 'Fill in a few details',
  sign: 'Sign it',
  send: `Send it to ${GC_SHORT}`,
}

/** The tag each step puts on the paper where it fills. */
const MARK_WORDS: Record<PayAppStepKey, string> = {
  work: '1 · Your work',
  details: '2 · Your details',
  sign: '3 · You sign here',
  send: '4 · What you ask for',
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
  dispatch,
}: {
  project: GcProject
  pkg: TradePackage
  partner: Partner
  dispatch: Dispatch<GcAction>
}) {
  const [open, setOpen] = useState<'draft' | 'final' | Draw | null>(null)
  // The draft lives here, not in the window: a click outside closes the window, never the work.
  // Its key says which application it is for: a new one, a resend after we sent one back, the final.
  const [held, setHeld] = useState<{ key: string; input: PayAppInput } | null>(null)
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

  return (
    <>
      <div style={{ padding: '0.55rem 0.65rem', background: 'var(--bg-subtle)', borderRadius: 6, display: 'grid', gap: '0.4rem' }}>
        {closing ? (
          <CloseoutForTrade project={project} pkg={pkg} dispatch={dispatch} onFinal={() => openWindow('final')} onSee={(d) => setOpen(d)} />
        ) : waiting ? (
          <>
            <div>
              Pay application {waiting.number} is with {GC_SHORT}. They are checking it.
            </div>
            {waiting.payApp && (
              <div>
                <Btn onClick={() => setOpen(waiting)}>See pay application {waiting.number}</Btn>
              </div>
            )}
          </>
        ) : back ? (
          <>
            <div>
              <strong style={{ color: 'var(--text-amber-800)' }}>
                {GC_SHORT} sent pay application {back.draw.number} back {shortDate(back.on)}.
              </strong>{' '}
              Fix it and send it again.
            </div>
            {back.note && <div>&ldquo;{back.note}&rdquo;</div>}
            {back.lines.map((l) => (
              <div key={l.sovId}>
                {label(l.sovId)}: {GC_SHORT} sees {l.weSee}%. You asked for {back.draw.lines.find((x) => x.sovId === l.sovId)?.toPct ?? 0}%.
              </div>
            ))}
            <div>
              <Btn kind="primary" onClick={() => openWindow('draft')}>
                {draft ? 'Go on with' : 'Fix and resend'} pay application {back.draw.number}
              </Btn>
            </div>
          </>
        ) : (
          <>
            <div>
              {ready > 0 ? (
                <>
                  You can ask for <strong>{money(ready)}</strong> now. Most of the pay application is filled in for you.
                </>
              ) : (
                <>Report your work above. Then fill out the pay application to ask for a draw.</>
              )}
            </div>
            <div>
              <Btn kind="primary" onClick={() => openWindow('draft')}>
                {draft ? 'Go on with' : 'Fill out'} pay application {sow.draws.length + 1}
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
 * The trade's closeout, in its portal: what is left before the retainage comes back. Click's
 * steps read as waits; theirs carry the button. The final waiver's button is the portal's own,
 * on the paid draw in the list under this block.
 */
function CloseoutForTrade({
  project,
  pkg,
  dispatch,
  onFinal,
  onSee,
}: {
  project: GcProject
  pkg: TradePackage
  dispatch: Dispatch<GcAction>
  onFinal: () => void
  onSee: (draw: Draw) => void
}) {
  const sow = pkg.sow
  if (!sow) return null
  const c = tradeCloseout(sow)
  const f = c.finalDraw
  const ids = { projectId: project.id, packageId: pkg.id }
  if (c.closed) {
    return (
      <div>
        <strong>You are closed out on this job.</strong> {GC_SHORT} paid back the {money(f?.net ?? 0)} it held. Thank you.
      </div>
    )
  }
  const accepted = Boolean(sow.acceptedOn)
  const warranty = Boolean(sow.warrantyOn)
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
  return (
    <>
      <div>
        <strong>Closeout.</strong> All your work is billed. {GC_SHORT} holds <strong>{money(c.held)}</strong> until the end. That is your retainage.
      </div>
      {back?.draw.final && (
        <div>
          <strong style={{ color: 'var(--text-amber-800)' }}>
            {GC_SHORT} sent your final pay application back {shortDate(back.on)}.
          </strong>{' '}
          {back.note} Fix it and send it again.
        </div>
      )}
      {item(accepted, accepted ? `${GC_SHORT} accepted your work ${shortDate(sow.acceptedOn ?? null)}.` : `${GC_SHORT} walks the work with you and checks the punch list.`)}
      {item(
        warranty,
        warranty ? 'Your warranty letter is in.' : 'Send your warranty letter.',
        warranty ? null : <Btn onClick={() => dispatch({ type: 'tradeSendWarranty', ...ids })}>Send the warranty letter</Btn>,
      )}
      {item(
        f !== null,
        f ? `Your final pay application is with ${GC_SHORT}.` : `Ask for the ${money(c.held)} with a final pay application.`,
        f ? (
          <Btn onClick={() => onSee(f)}>See it</Btn>
        ) : (
          <Btn kind="primary" disabled={!c.canAskFinal} onClick={onFinal}>
            Fill out the final pay application
          </Btn>
        ),
      )}
      {!f && !c.canAskFinal && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '1.4rem' }}>
          It opens once {GC_SHORT} accepts your work and has your warranty letter.
        </div>
      )}
      {item(
        f?.status === 'paid',
        f?.status === 'paid' ? `${GC_SHORT} paid your retainage.` : f?.status === 'approved' ? `${GC_SHORT} approved it. Payment is coming.` : `${GC_SHORT} pays your retainage.`,
      )}
      {item(
        false,
        f?.status === 'paid' ? 'Sign the unconditional waiver on final payment below.' : 'Last, you sign the unconditional waiver on final payment.',
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
  const title = `${final ? 'Final pay application' : 'Pay application'} ${app.number}${returnedAs ? ' · sent back' : revised ? ' · revised' : ''}`
  const waiverWords = final ? 'conditional waiver on final payment' : 'conditional lien waiver'
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
      approved={draw ? draw.status !== 'requested' && !returnedAs : false}
      stamp={returnedAs ? 'sent back' : revised ? 'revised' : null}
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
              {pkg.trade} · {partner.company} · {project.name} · the 702 and 703 forms
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
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
                  {viewer === 'trade' ? 'You sent this' : `${partner.company} sent this`} {shortDate(draw.payApp.signedOn)}. {draw.payApp.signedBy}
                  {draw.payApp.signedTitle ? `, ${draw.payApp.signedTitle},` : ''} signed it with a {waiverWords} for {money(draw.net)}.
                </>
              ) : (
                <>This draw was asked for before pay applications. The form is rebuilt from the draw.</>
              )}
              {returnedAs && (
                <>
                  {' '}
                  <strong style={{ color: 'var(--text-amber-800)' }}>
                    {viewer === 'office' ? 'We' : GC_SHORT} sent it back {shortDate(returnedAs.on)}.
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
          <div className="lienRelease-body gcPayApp-body">
            <div className="lienRelease-steps">
              <LienReleaseStepRow
                step={stepAt('work')}
                title={final ? 'Check it is all done' : STEP_TITLES.work}
                nextIsCurrent={current === 'details'}
                say={
                  final
                    ? 'Every line is billed at 100%. This application asks for the retainage.'
                    : sentBack
                      ? `${GC_SHORT} sent this back. Its numbers are in where it sees less. Change a line if you see it differently.`
                      : app.totals.thisPeriod > 0
                      ? 'Each line starts at what you reported. Change a line if it moved.'
                      : 'Nothing new to bill yet. Raise a line that moved.'
                }
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
                          <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>100% billed</span>
                        </div>
                      ))}
                      <div style={{ color: 'var(--text-muted)' }}>
                        Retainage held: <strong style={{ color: 'var(--text-base)' }}>{money(net)}</strong>
                      </div>
                    </>
                  )}
                  {!final && app.lines.map((l) => {
                    const before = l.fromPrevious === 0 ? 0 : Math.round((l.fromPrevious / l.scheduled) * 100)
                    return (
                      <label key={l.sovId} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'center' }}>
                        <span>
                          {l.label} <span style={{ color: 'var(--text-muted)' }}>· {money(l.scheduled)}{before > 0 ? ` · paid through ${before}%` : ''}</span>
                          {weSee.has(l.sovId) && (
                            <span style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}> · {GC_SHORT} sees {weSee.get(l.sovId)}%</span>
                          )}
                        </span>
                        <select
                          value={l.pct}
                          onChange={(e) => set({ toPct: { ...draft.toPct, [l.sovId]: Number(e.target.value) } })}
                          style={input_}
                          aria-label={`Percent done, ${l.label}`}
                        >
                          {PCTS.filter((p) => p >= before).map((p) => (
                            <option key={p} value={p}>
                              {p}% done
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  })}
                  {!final && (
                    <div style={{ color: 'var(--text-muted)' }}>
                      Work this period: <strong style={{ color: 'var(--text-base)' }}>{money(app.totals.thisPeriod)}</strong>
                    </div>
                  )}
                </div>
              </LienReleaseStepRow>

              <LienReleaseStepRow
                step={stepAt('details')}
                title={STEP_TITLES.details}
                nextIsCurrent={current === 'sign'}
                say="Pick the last day this draw covers. Your address goes on the form."
              >
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }} onFocus={() => setFocus('details')}>
                  <Field label="Period ends">
                    <input type="date" value={draft.periodTo} onChange={(e) => set({ periodTo: e.target.value })} style={input_} />
                  </Field>
                  <Field label="Your mailing address" note={known.address ? 'On file from your last one.' : 'We keep it for next time.'}>
                    <input type="text" value={draft.address} onChange={(e) => set({ address: e.target.value })} placeholder="Street, city, state, zip" style={input_} />
                  </Field>
                  <Field label="License line" note="If your trade needs one.">
                    <input type="text" value={draft.license} onChange={(e) => set({ license: e.target.value })} style={input_} />
                  </Field>
                </div>
              </LienReleaseStepRow>

              <LienReleaseStepRow
                step={stepAt('sign')}
                title={STEP_TITLES.sign}
                nextIsCurrent={current === 'send'}
                say="Type your name and title. Then tick the waiver box."
              >
                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }} onFocus={() => setFocus('sign')}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '0.5rem' }}>
                    <Field label="Your name">
                      <input type="text" value={draft.signedBy} onChange={(e) => set({ signedBy: e.target.value })} style={input_} />
                    </Field>
                    <Field label="Your title">
                      <input type="text" value={draft.signedTitle} onChange={(e) => set({ signedTitle: e.target.value })} placeholder="Owner, office manager" style={input_} />
                    </Field>
                  </div>
                  <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={draft.waiverSigned} onChange={(e) => set({ waiverSigned: e.target.checked })} style={{ marginTop: '0.2rem' }} />
                    <span>
                      I sign the {waiverWords} for {money(net)}.
                    </span>
                  </label>
                </div>
              </LienReleaseStepRow>

              <LienReleaseStepRow
                step={stepAt('send')}
                title={STEP_TITLES.send}
                last
                waitLabel="Opens when 1 to 3 are done"
                say={final ? `${GC_SHORT} checks it and pays back the retainage.` : `${GC_SHORT} checks it and pays the draw.`}
              >
                <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.875rem' }} onFocus={() => setFocus('send')}>
                  <div>
                    {final ? (
                      <>
                        You ask for <strong>{money(net)}</strong>. That is everything {GC_SHORT} held back.
                      </>
                    ) : (
                      <>
                        You ask for <strong>{money(net)}</strong>. {GC_SHORT} holds {sow.retainagePct}% of the work until the end.
                      </>
                    )}
                  </div>
                  <div>
                    <Btn kind="primary" disabled={!ready || !dispatch} onClick={send}>
                      Send to {GC_SHORT}
                    </Btn>
                  </div>
                </div>
              </LienReleaseStepRow>
            </div>

            {/* The paper: pinned light like the printed form, kept in view while the steps scroll. */}
            <div className="lienRelease-preview" data-theme="light">
              <div style={{ marginBottom: '0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-base)' }}>The form</strong> · it fills in as you work
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
                return now ? `You are on step ${now.n} of 4 · ${STEP_TITLES[now.key]}` : 'All four steps done'
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
  approved,
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
  approved: boolean
  /** A word after the page line: "revised", "sent back". */
  stamp: string | null
}) {
  const s = app.summary
  const contractDate = pkg.sow?.signedOn ?? null
  const signedOnWords = typed.signedOn === 'today' ? 'today' : shortDate(typed.signedOn)
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
        {tab('g702', 'Page 1 · 702')}
        {tab('g703', 'Page 2 · 703')}
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
              Application and certificate for payment
            </p>
            <p style={{ ...label, textAlign: 'center', margin: '0 0 0.9em' }}>
              AIA G702 · page 1 of 2{app.final ? ' · final, retainage release' : ''}{stamp ? ` · ${stamp}` : ''}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '0.6rem 1.25rem' }}>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                <Box name="To">{GC_COMPANY_NAME}</Box>
                <Mark on={mark === 'details'} tag={MARK_WORDS.details}>
                  <Box name="From">
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
                <Box name="Contract for">{pkg.trade}</Box>
              </div>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                <Box name="Project">
                  {project.name}
                  <br />
                  {project.address}
                </Box>
                <Box name="Via architect">{project.architect}</Box>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                  <Box name="Application no.">{String(app.number)}</Box>
                  <Mark on={mark === 'details'} tag="2">
                    <Box name="Period to">
                      <Val>{shortDate(typed.periodTo || null)}</Val>
                    </Box>
                  </Mark>
                  <Box name="Contract date">{shortDate(contractDate)}</Box>
                </div>
              </div>
            </div>

            <p style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '1.1em 0 0.3em', fontSize: '0.75rem' }}>
              Application for payment
            </p>
            {line('1', 'Original contract sum', money(s.originalSum))}
            {line('2', 'Net change by change orders', money(s.changeOrders))}
            {line('3', 'Contract sum to date', money(s.sumToDate))}
            <Mark on={mark === 'work'} tag={MARK_WORDS.work}>
              {line('4', 'Total completed and stored to date, from the 703', money(s.completedToDate))}
            </Mark>
            {line('5', app.final ? `Retainage, released on this final application` : `Retainage, ${s.retainagePct}% of completed work`, money(s.retainage))}
            {line('6', 'Total earned less retainage', money(s.earnedLessRetainage))}
            {line('7', 'Less previous certificates for payment', money(s.previousCertificates))}
            <Mark on={mark === 'send'} tag={MARK_WORDS.send}>
              {line('8', 'Current payment due', money(s.currentDue), true)}
            </Mark>
            {line('9', 'Balance to finish, including retainage', money(s.balanceToFinish))}
            <div style={{ ...label, marginTop: '0.4rem' }}>Change orders: none on this contract</div>

            <Mark on={mark === 'sign'} tag={MARK_WORDS.sign}>
              <div style={{ marginTop: '0.9rem' }}>
                <p style={{ margin: '0 0 0.6em' }}>
                  The undersigned certifies that the work covered by this application is done as shown. Everyone owed for earlier
                  payments has been paid. The current payment shown is now due. A{' '}
                  {app.final ? 'conditional waiver on final payment' : 'conditional lien waiver'} for {money(s.currentDue)} is signed with it.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem', alignItems: 'end' }}>
                  <div style={{ borderBottom: '1px solid var(--text-base)', paddingBottom: '0.15rem', minHeight: '1.6em', fontStyle: typed.signedOn ? 'italic' : undefined, fontSize: typed.signedOn ? '1rem' : undefined }}>
                    {typed.signedOn ? <Val>{typed.signedBy}</Val> : null}
                  </div>
                  <Box name="Title">
                    <Val>{typed.signedTitle}</Val>
                  </Box>
                  <Box name="Date">
                    <Val>{typed.signedOn ? signedOnWords : ''}</Val>
                  </Box>
                </div>
                <div style={{ ...label, marginTop: '0.2rem' }}>
                  By <Val>{typed.signedBy}</Val> for {partner.company}
                </div>
              </div>
            </Mark>

            <div style={{ marginTop: '1rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-strong)' }}>
              <p style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 0.3em', fontSize: '0.75rem' }}>
                Certificate for payment · {GC_SHORT} fills this in
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem' }}>
                <Box name="Amount certified">
                  <Val>{approved ? money(s.currentDue) : ''}</Val>
                </Box>
                <Box name="By">
                  <Val>{approved ? GC_COMPANY_NAME : ''}</Val>
                </Box>
              </div>
            </div>
          </>
        ) : (
          <>
            <p style={{ textAlign: 'center', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.15em' }}>
              Continuation sheet
            </p>
            <p style={{ ...label, textAlign: 'center', margin: '0 0 0.8em' }}>AIA G703 · page 2 of 2</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '0.45rem', marginBottom: '0.7rem' }}>
              <Box name="Application no.">{String(app.number)}</Box>
              <Box name="Period to">
                <Val>{shortDate(typed.periodTo || null)}</Val>
              </Box>
              <Box name="Project">{project.name}</Box>
            </div>
            <Mark on={mark === 'work'} tag={MARK_WORDS.work}>
              <div style={{ overflowX: 'auto' }}>
                <table className="gcPayApp-table">
                  <thead>
                    <tr>
                      <th>A<br />Item</th>
                      <th>B<br />Work</th>
                      <th>C<br />Scheduled value</th>
                      <th>D<br />Previous</th>
                      <th>E<br />This period</th>
                      <th>F<br />Stored</th>
                      <th>G<br />Done to date</th>
                      <th>%<br />G ÷ C</th>
                      <th>H<br />Balance</th>
                      <th>I<br />Retainage</th>
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
                      <td className="gcPayApp-left">Grand total</td>
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
