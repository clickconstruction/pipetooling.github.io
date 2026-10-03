import { useRef, useState, type Dispatch } from 'react'
import {
  alternateWords,
  bidGoodUntil,
  bidIsStale,
  bidRanOut,
  bidTabResult,
  bidTabRows,
  daysUntil,
  GC_COMPANY,
  money,
  partnerById,
  planLabel,
  portalInsurance,
  portalLines,
  portalPlanNews,
  portalPromiseLine,
  shortDate,
  sowMoney,
  unclearLines,
  weekdayDate,
  type GcAction,
  type GcProject,
  type GcState,
  type Includes,
  type BidAlternate,
  type Invite,
  type Partner,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { BidTabTable } from './GcBidTabs'
import { GcBuildingPayAppDoor } from './GcBuildingPayApp'
import { Btn, Chip, input } from './gcUi'
import { GcPortalHome } from './GcPortalHome'
import { AlternatesEditor, AnswerLines, GoodForPicker, QuoteFilePicker } from './GcPortalBidExtras'
import { ChangedLines, LineSheets, SheetChip } from './GcPortalLineSheets'
import { GcPortalMessages } from './GcPortalMessages'
import { GcPortalPaperwork } from './GcPortalPaperwork'
import { GcPortalPlans } from './GcPortalPlans'
import { PortalBlock as Block, PortalNote } from './GcPortalUi'

/**
 * GC mode design spike: what one trade partner sees. No sign-in: the link is the key, like the
 * sub portal and the customer portal. Everything pressed here lands on the office's side at once.
 *
 * Two pages: the company's home (everything it has with us, GcPortalHome) and one project's page.
 * The link opens on the home, whatever project the office has open: one link per company.
 */

interface Props {
  state: GcState
  project: GcProject
  partnerId: string
  onPickPartner: (id: string) => void
  dispatch: Dispatch<GcAction>
}

const INK = '#16283c'
const PAPER = '#f6f3ec'
const GC = GC_COMPANY.shortName

export function GcTradePortal({ state, project, partnerId, onPickPartner, dispatch }: Props) {
  const onProject = state.partners.filter((p) => project.packages.some((k) => k.invites.some((i) => i.partnerId === p.id)))
  const partner = partnerById(state, partnerId) ?? onProject[0]
  /** The project page on show. Null: the company's home, where the link lands. */
  const [viewId, setViewId] = useState<string | null>(null)
  /** Their portal, or their inbox: what we sent them, each message carrying the link. */
  const [screen, setScreen] = useState<'portal' | 'messages'>('portal')
  const shown = viewId === null ? null : (state.projects.find((p) => p.id === viewId) ?? null)
  const top = useRef<HTMLDivElement | null>(null)
  const go = (id: string | null) => {
    setViewId(id)
    setScreen('portal')
    const box = top.current?.getBoundingClientRect()
    if (box && box.top < 0) top.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <div
      ref={top}
      data-theme="light"
      style={{ background: PAPER, color: INK, border: `1px solid ${INK}`, borderRadius: 10, overflow: 'hidden', width: '100%', maxWidth: 430, marginInline: 'auto' }}
    >
      <div style={{ background: INK, color: PAPER, padding: '0.7rem 0.9rem' }}>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>
          What the trade sees · their portal
        </div>
        <select
          value={partner?.id ?? ''}
          onChange={(e) => onPickPartner(e.target.value)}
          aria-label="See the portal as"
          style={{ marginTop: '0.3rem', width: '100%', padding: '0.35rem', borderRadius: 4, border: 'none', fontSize: '1rem', fontWeight: 600 }}
        >
          {onProject.map((p) => (
            <option key={p.id} value={p.id}>{p.company}</option>
          ))}
        </select>
        {partner && (
          <div role="tablist" aria-label="What to show" style={{ display: 'flex', gap: '0.3rem', marginTop: '0.45rem' }}>
            {(
              [
                ['portal', 'Their portal'],
                ['messages', 'Their messages'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={screen === key}
                onClick={() => setScreen(key)}
                style={{
                  flex: 1,
                  padding: '0.3rem 0.5rem',
                  borderRadius: 999,
                  border: `1px solid ${PAPER}`,
                  background: screen === key ? PAPER : 'transparent',
                  color: screen === key ? INK : PAPER,
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!partner ? (
        <div style={{ padding: '1rem' }}>No trade partner is on this project yet. Invite one from Trades.</div>
      ) : screen === 'messages' ? (
        <div style={{ padding: '0.9rem' }}>
          <GcPortalMessages key={partner.id} state={state} partner={partner} onOpenPortal={() => go(null)} />
        </div>
      ) : shown ? (
        <ProjectPage state={state} project={shown} partner={partner} dispatch={dispatch} onHome={() => go(null)} />
      ) : (
        <div style={{ padding: '0.9rem' }}>
          <GcPortalHome state={state} partner={partner} dispatch={dispatch} onOpenProject={(id) => go(id)} />
        </div>
      )}
    </div>
  )
}

/** One project's page: the company's asks on it. Paperwork shows here only while something is missing. */
function ProjectPage({
  state,
  project,
  partner,
  dispatch,
  onHome,
}: {
  state: GcState
  project: GcProject
  partner: Partner
  dispatch: Dispatch<GcAction>
  onHome: () => void
}) {
  const mine = project.packages.flatMap((pkg) => pkg.invites.filter((i) => i.partnerId === partner.id).map((invite) => ({ pkg, invite })))
  const paperworkMissing = partner.msa === 'sent' || !portalInsurance(partner, state.today).done || !partner.w9
  return (
    <div style={{ padding: '0.9rem', display: 'grid', gap: '0.9rem' }}>
      <div>
        <button
          type="button"
          onClick={onHome}
          style={{ border: 'none', background: 'transparent', padding: 0, color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.85rem', marginBottom: '0.35rem' }}
        >
          ← Everything with {GC}
        </button>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{project.name}</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          {project.address} · {project.sizeNote}
          <br />
          General contractor: {GC_COMPANY.name} · Hello, {partner.contact}.
        </div>
      </div>

      {paperworkMissing && <GcPortalPaperwork partner={partner} today={state.today} dispatch={dispatch} />}

      {mine.length === 0 && <div>You have no open invitation on this project.</div>}
      {mine.map(({ pkg, invite }) => (
        <PackageBlock key={invite.id} state={state} project={project} pkg={pkg} invite={invite} partner={partner} dispatch={dispatch} />
      ))}
    </div>
  )
}

function PackageBlock({
  state,
  project,
  pkg,
  invite,
  partner,
  dispatch,
}: {
  state: GcState
  project: GcProject
  pkg: TradePackage
  invite: Invite
  partner: Partner
  dispatch: Dispatch<GcAction>
}) {
  /** The plans window: closed, open on its first sheet (''), or open on a sheet the company tapped. */
  const [plansAt, setPlansAt] = useState<string | null>(null)
  const news = portalPlanNews(project, pkg, invite)
  const latest = news.latest
  const ids = { projectId: project.id, packageId: pkg.id }
  // Any look at the newest set counts as opening it, from the button or from a sheet number.
  const openPlans = (sheetId = '') => {
    if (news.behind) dispatch({ type: 'tradeOpenPlans', ...ids, inviteId: invite.id })
    setPlansAt(sheetId)
  }
  const awardedToMe = pkg.awardedInviteId === invite.id
  const awardedElsewhere = pkg.awardedInviteId !== null && !awardedToMe

  return (
    <>
      <Block title={`${pkg.trade} · plans`}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
          <strong>{latest?.label}</strong>
          <span style={{ opacity: 0.75 }}>issued {shortDate(latest?.issuedOn ?? null)}</span>
          {news.behind ? (
            <Btn kind={news.neverOpened || news.forTrade.length > 0 ? 'primary' : 'plain'} onClick={() => openPlans()}>Open the plans</Btn>
          ) : (
            <>
              <Chip tone="green">you have the latest set</Chip>
              <Btn kind="quiet" onClick={() => openPlans()}>Look at the plans</Btn>
            </>
          )}
        </div>
        {news.behind && news.forTrade.length > 0 && (
          <div style={{ marginTop: '0.4rem' }}>
            <PortalNote tone="amber">
              <strong>New for {pkg.trade} since you last looked</strong>
              {news.forTrade.map((set) => (
                <div key={set.rev}>
                  {set.label}: {set.note}
                  {set.changedSheets.length > 0 && <> Sheets {set.changedSheets.join(', ')}.</>}
                </div>
              ))}
            </PortalNote>
          </div>
        )}
        {news.behind && !news.neverOpened && news.forTrade.length === 0 && latest && (
          <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', opacity: 0.8 }}>
            {latest.label} does not change {pkg.trade}. Open it so you price on the newest set.
          </div>
        )}
        {plansAt !== null && <GcPortalPlans key={plansAt} project={project} pkg={pkg} startSheet={plansAt || undefined} onClose={() => setPlansAt(null)} />}
      </Block>

      {pkg.bidTab && invite.bid && (
        <Block title={`${pkg.trade} · bid tab`}>
          {pkg.bidTab.seenBy.includes(partner.id) ? (
            <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
              <div>{bidTabResult(project, pkg, partner.id)}</div>
              <BidTabTable rows={bidTabRows(state, pkg)} viewerId={partner.id} showNames={pkg.bidTab.showNames} />
              <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>Thank you for your number. This is how the quotes came in.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <span>{GC} shared how the quotes came in on {shortDate(pkg.bidTab.sharedOn)}.</span>
              <Btn kind="primary" onClick={() => dispatch({ type: 'tradeSeeBidTab', ...ids, partnerId: partner.id })}>See the bid tab</Btn>
            </div>
          )}
        </Block>
      )}

      {awardedElsewhere ? (
        <Block title={`${pkg.trade} · result`}>This one went to another company. Thank you for your number.</Block>
      ) : awardedToMe && pkg.sow ? (
        <SowBlock project={project} pkg={pkg} partner={partner} dispatch={dispatch} />
      ) : invite.status === 'declined' ? (
        <Block title={`${pkg.trade} · invitation`}>You passed on this one.</Block>
      ) : (
        <BidBlock project={project} pkg={pkg} invite={invite} today={state.today} dispatch={dispatch} onOpenSheet={openPlans} />
      )}
    </>
  )
}

function BidBlock({
  project,
  pkg,
  invite,
  today,
  dispatch,
  onOpenSheet,
}: {
  project: GcProject
  pkg: TradePackage
  invite: Invite
  today: string
  dispatch: Dispatch<GcAction>
  onOpenSheet: (sheetId: string) => void
}) {
  const [promiseDay, setPromiseDay] = useState('')
  const promise = portalPromiseLine(invite, today, GC)
  const unclear = unclearLines(pkg, invite)
  const [editing, setEditing] = useState(invite.bid === null)
  const [amount, setAmount] = useState(invite.bid ? String(invite.bid.amount) : '')
  const [note, setNote] = useState(invite.bid?.note ?? '')
  const [includes, setIncludes] = useState<Record<string, Includes>>(() => {
    const start: Record<string, Includes> = {}
    for (const item of pkg.scope) start[item.id] = invite.bid?.includes[item.id] ?? 'yes'
    return start
  })
  const [goodFor, setGoodFor] = useState(invite.bid?.goodForDays ?? 30)
  const [alternates, setAlternates] = useState<BidAlternate[]>(invite.bid?.alternates ?? [])
  const [quoteFile, setQuoteFile] = useState(invite.bid?.quoteFile ?? '')
  const [answering, setAnswering] = useState(false)
  const ids = { projectId: project.id, packageId: pkg.id, inviteId: invite.id }
  const due = project.bidDue
  const days = due ? daysUntil(due, today) : null
  const unanswered = pkg.scope.filter((item) => includes[item.id] === 'unclear').length
  const openedNewest = !portalPlanNews(project, pkg, invite).behind
  const stale = bidIsStale(project, pkg, invite)
  const sheets = portalLines(project, pkg, invite)
  const lineOf = (id: string) => sheets.lines.find((l) => l.item.id === id)
  const goodUntil = invite.bid ? bidGoodUntil(invite.bid) : null
  const ranOut = invite.bid ? bidRanOut(invite.bid, today) : false

  return (
    <Block title={`${pkg.trade} · invitation to bid`}>
      {due && (
        <div style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
          Your number is due <strong>{shortDate(due)}</strong>
          {days !== null && <> ({days >= 0 ? `${days} days` : 'past due'})</>}.
        </div>
      )}
      {invite.bid && !editing ? (
        <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
          <div>
            Your bid: <strong>{money(invite.bid.amount)}</strong> on {planLabel(project, invite.bid.basedOnRev)}, sent{' '}
            {shortDate(invite.bid.submittedOn)}.{goodUntil && !ranOut && <> Good until {weekdayDate(goodUntil)}.</>}
          </div>
          {(invite.bid.alternates ?? []).length > 0 && (
            <div>
              <span style={{ opacity: 0.75 }}>Alternates:</span> {(invite.bid.alternates ?? []).map(alternateWords).join(' · ')}
            </div>
          )}
          {invite.bid.quoteFile && (
            <div>
              <span style={{ opacity: 0.75 }}>Your own quote:</span> <Chip tone="grey">{invite.bid.quoteFile}</Chip>
            </div>
          )}
          {ranOut && goodUntil && (
            <PortalNote tone="amber">
              <div>Your number ran out {weekdayDate(goodUntil)}. Send it again to keep it good.</div>
              <div>
                <Btn kind="primary" onClick={() => setEditing(true)}>Send it again</Btn>
              </div>
            </PortalNote>
          )}
          {stale && (
            <PortalNote tone="amber">
              <div>
                The plans changed for your trade after you bid.{' '}
                {openedNewest ? 'Confirm your number or change it.' : 'Open the plans above, then confirm your number or change it.'}
              </div>
              <ChangedLines trade={pkg.trade} lines={sheets.lines} otherSheets={sheets.otherSheets} setNames={sheets.sets.map((x) => x.label)} onOpen={onOpenSheet} />
            </PortalNote>
          )}
          {unclear.length > 0 && (
            <PortalNote tone="amber">
              {answering ? (
                <AnswerLines
                  items={unclear}
                  lineOf={lineOf}
                  onOpenSheet={onOpenSheet}
                  onCancel={() => setAnswering(false)}
                  onSend={(answers) => {
                    dispatch({ type: 'tradeAnswerLines', ...ids, answers })
                    setIncludes({ ...includes, ...answers })
                    setAnswering(false)
                  }}
                />
              ) : (
                <>
                  <div>
                    {GC} cannot tell if your number covers {unclear.map((i) => i.label.charAt(0).toLowerCase() + i.label.slice(1)).join(' or ')}. Answer it so
                    your number compares fairly.
                  </div>
                  <div>
                    <Btn kind="primary" onClick={() => setAnswering(true)}>Answer it</Btn>
                  </div>
                </>
              )}
            </PortalNote>
          )}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {stale && (
              <Btn
                kind="primary"
                disabled={!openedNewest}
                title={openedNewest ? undefined : 'Open the plans first.'}
                onClick={() => dispatch({ type: 'tradeConfirmBid', ...ids })}
              >
                My number stands on the new plans
              </Btn>
            )}
            <Btn onClick={() => setEditing(true)}>Change my bid</Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            Tick what your number covers. Untick what it leaves out. Tap a sheet number to open it.
          </div>
          {pkg.scope.map((item) =>
            includes[item.id] === 'unclear' ? (
              <div key={item.id} style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', padding: '0.4rem 0.5rem', background: 'var(--bg-amber-100)', borderRadius: 6 }}>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>
                    <strong>{item.label}.</strong> {GC} cannot tell if your number covers it.
                  </span>
                  <LineSheets line={lineOf(item.id)} onOpen={onOpenSheet} />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <Btn onClick={() => setIncludes({ ...includes, [item.id]: 'yes' })}>It is in my number</Btn>
                  <Btn onClick={() => setIncludes({ ...includes, [item.id]: 'no' })}>It is left out</Btn>
                </div>
              </div>
            ) : (
              <label key={item.id} style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.9rem', flexWrap: 'wrap' }}>
                <input
                  type="checkbox"
                  checked={includes[item.id] === 'yes'}
                  onChange={(e) => setIncludes({ ...includes, [item.id]: e.target.checked ? 'yes' : 'no' })}
                />
                {item.label}
                <LineSheets line={lineOf(item.id)} onOpen={onOpenSheet} />
              </label>
            ),
          )}
          {sheets.otherSheets.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              <span>Also changed in {sheets.sets.map((x) => x.label).join(' and ')}</span>
              {sheets.otherSheets.map((id) => (
                <SheetChip key={id} id={id} guessed={false} changed onOpen={onOpenSheet} />
              ))}
            </div>
          )}
          <label style={{ fontSize: '0.9rem' }}>
            Your number{' '}
            <input type="number" min={0} step={100} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...input, width: '9rem' }} />
          </label>
          <GoodForPicker value={goodFor} onChange={setGoodFor} />
          <input style={input} placeholder="Anything we should know" value={note} onChange={(e) => setNote(e.target.value)} />
          <AlternatesEditor value={alternates} onChange={setAlternates} />
          <QuoteFilePicker value={quoteFile} onChange={setQuoteFile} />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn
              kind="primary"
              disabled={invite.seenRev === null || !(Number(amount) > 0) || unanswered > 0}
              title={invite.seenRev === null ? 'Open the plans first.' : unanswered > 0 ? 'Answer each line first.' : undefined}
              onClick={() => {
                dispatch({
                  type: 'tradeSubmitBid',
                  ...ids,
                  amount: Number(amount),
                  includes,
                  note: note.trim(),
                  goodForDays: goodFor,
                  alternates,
                  ...(quoteFile ? { quoteFile } : {}),
                })
                setEditing(false)
              }}
            >
              {invite.bid ? 'Send my new number' : 'Send my bid'}
            </Btn>
            {!invite.bid && <Btn kind="quiet" onClick={() => dispatch({ type: 'tradeDecline', ...ids })}>Pass on this one</Btn>}
            {invite.bid && (
              <Btn
                kind="quiet"
                onClick={() => {
                  const was = invite.bid
                  if (!was) return
                  setAmount(String(was.amount))
                  setNote(was.note)
                  setIncludes(Object.fromEntries(pkg.scope.map((item) => [item.id, was.includes[item.id] ?? 'yes'])))
                  setGoodFor(was.goodForDays ?? 30)
                  setAlternates(was.alternates ?? [])
                  setQuoteFile(was.quoteFile ?? '')
                  setEditing(false)
                }}
              >
                Keep my bid as it is
              </Btn>
            )}
            {invite.seenRev === null && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>Open the plans first.</span>}
            {invite.seenRev !== null && unanswered > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>Answer each line first.</span>
            )}
          </div>
          {!invite.bid && (
            <div style={{ borderTop: '1px solid #d9d2c3', paddingTop: '0.5rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              {promise ? (
                <span style={promise.late ? { color: 'var(--text-red-700)', fontWeight: 600 } : undefined}>{promise.text}</span>
              ) : (
                <span>Not ready yet? Tell {GC} when your number will come.</span>
              )}
              <input type="date" min={today} value={promiseDay} onChange={(e) => setPromiseDay(e.target.value)} style={input} aria-label="The day your number will come" />
              <Btn
                disabled={promiseDay === ''}
                onClick={() => {
                  dispatch({ type: 'tradePromise', ...ids, promisedBy: promiseDay })
                  setPromiseDay('')
                }}
              >
                {promise?.late ? 'Give a new day' : promise ? 'Change the day' : `Tell ${GC}`}
              </Btn>
            </div>
          )}
        </div>
      )}
    </Block>
  )
}

function SowBlock({
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
  const sow = pkg.sow
  if (!sow) return null
  const ids = { projectId: project.id, packageId: pkg.id }
  const m = sowMoney(sow)

  if (sow.status === 'draft') {
    return <Block title={`${pkg.trade} · you got the job`}>{GC} picked your number. Your statement of work is being written.</Block>
  }

  return (
    <>
      <Block title={`${pkg.trade} · statement of work`}>
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
          <div>
            <strong>{money(sow.price)}</strong> · {sow.retainagePct}% held until the end · based on {planLabel(project, sow.basedOnRev)}
          </div>
          <div style={{ opacity: 0.8 }}>{sow.sov.map((l) => `${l.label} ${money(l.amount)}`).join(' · ')}</div>
          {sow.status === 'sent' ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn kind="primary" disabled={partner.msa !== 'signed'} onClick={() => dispatch({ type: 'tradeSignSow', ...ids })}>
                Sign the statement of work
              </Btn>
              {partner.msa !== 'signed' && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>Sign the master agreement first.</span>}
            </div>
          ) : (
            <Chip tone="green">signed {shortDate(sow.signedOn)}</Chip>
          )}
        </div>
      </Block>

      {sow.status === 'signed' && (
        <Block title={`${pkg.trade} · report your work and get paid`}>
          <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
            {sow.sov.map((l) => (
              <label key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                <span>
                  {l.label} <span style={{ opacity: 0.7 }}>· {money(l.amount)} · paid through {l.pctBilled}%</span>
                </span>
                <select
                  value={l.pctReported}
                  onChange={(e) => dispatch({ type: 'tradeReport', ...ids, sovId: l.id, pct: Number(e.target.value) })}
                  style={input}
                  aria-label={`Percent done, ${l.label}`}
                >
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
                    .filter((p) => p >= l.pctBilled)
                    .map((p) => (
                      <option key={p} value={p}>{p}% done</option>
                    ))}
                </select>
              </label>
            ))}
            {/* Building lane: a draw is asked for with its pay application (the 702 and 703). */}
            <GcBuildingPayAppDoor project={project} pkg={pkg} partner={partner} dispatch={dispatch} />
            {sow.draws.map((d) => (
              <div key={d.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>Draw {d.number}</strong>
                <span>{money(d.net)}</span>
                <Chip tone={d.status === 'paid' ? 'green' : d.status === 'approved' ? 'blue' : 'amber'}>
                  {d.status === 'requested' ? `${GC} is reviewing it` : d.status === 'approved' ? 'approved, payment coming' : `paid`}
                </Chip>
                {d.status === 'paid' && d.waiver === 'conditional' && (
                  <Btn kind="primary" onClick={() => dispatch({ type: 'tradeSignUnconditional', ...ids, drawId: d.id })}>
                    Sign the unconditional waiver
                  </Btn>
                )}
              </div>
            ))}
            <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
              Paid so far {money(m.paid)} · held {money(m.retainageHeld)} · left to bill {money(sow.price - m.billed)}
            </div>
          </div>
        </Block>
      )}
    </>
  )
}
