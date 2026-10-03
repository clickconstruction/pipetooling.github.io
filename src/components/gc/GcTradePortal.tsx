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
  pDate,
  planLabel,
  pt,
  pWeekday,
  portalClosedWords,
  portalInsurance,
  portalLines,
  portalPlanNews,
  portalPromiseLine,
  sowContractSum,
  sowMoney,
  unclearLines,
  type GcAction,
  type GcProject,
  type GcState,
  type Includes,
  type BidAlternate,
  type Invite,
  type Partner,
  type PortalLang,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import { BidTabTable } from './GcBidTabs'
import { GcBuildingPayAppDoor } from './GcBuildingPayApp'
import { Btn, Chip, input } from './gcUi'
import { GcPortalContacts } from './GcPortalContacts'
import { GcPortalHome } from './GcPortalHome'
import { GcPortalPay } from './GcPortalPay'
import { GcPortalLookAhead } from './GcPortalLookAhead'
import { AlternatesEditor, AnswerLines, GoodForPicker, QuoteFilePicker } from './GcPortalBidExtras'
import { ChangedLines, LineSheets, SheetChip } from './GcPortalLineSheets'
import { GcPortalMessages } from './GcPortalMessages'
import { GcPortalPaperwork } from './GcPortalPaperwork'
import { GcPortalPlans } from './GcPortalPlans'
import { GcPortalQuestions } from './GcPortalQuestions'
import { PortalBlock as Block, PortalNote } from './GcPortalUi'
import { PortalLangContext, usePortalLang } from './gcPortalLang'

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
  /** The Your pay page, over the home. */
  const [payOpen, setPayOpen] = useState(false)
  /** The company's language, kept on its record (owner, 2026-10-03): its messages go out in it too. */
  const lang: PortalLang = partner?.lang ?? 'en'
  const shown = viewId === null ? null : (state.projects.find((p) => p.id === viewId) ?? null)
  const top = useRef<HTMLDivElement | null>(null)
  const go = (id: string | null) => {
    setViewId(id)
    setPayOpen(false)
    setScreen('portal')
    const box = top.current?.getBoundingClientRect()
    if (box && box.top < 0) top.current?.scrollIntoView({ block: 'start' })
  }

  return (
    <div
      ref={top}
      data-theme="light"
      lang={lang}
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

      {partner && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0.9rem', borderBottom: '1px solid #d9d2c3', fontSize: '0.78rem' }}>
          <span>
            <strong>{GC_COMPANY.name}</strong> <span style={{ opacity: 0.7 }}>· {pt(lang, 'letterhead')}</span>
          </span>
          <button
            type="button"
            aria-pressed={lang === 'es'}
            onClick={() => dispatch({ type: 'tradeSetLanguage', partnerId: partner.id, lang: lang === 'es' ? 'en' : 'es' })}
            style={{ padding: '0.15rem 0.6rem', borderRadius: 999, border: `1px solid ${INK}`, background: lang === 'es' ? INK : 'transparent', color: lang === 'es' ? PAPER : INK, fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
          >
            {pt(lang, 'switchLang')}
          </button>
        </div>
      )}

      <PortalLangContext.Provider value={lang}>
      {!partner ? (
        <div style={{ padding: '1rem' }}>No trade partner is on this project yet. Invite one from Trades.</div>
      ) : screen === 'messages' ? (
        <div style={{ padding: '0.9rem' }}>
          <GcPortalMessages key={partner.id} state={state} partner={partner} onOpenPortal={() => go(null)} />
        </div>
      ) : payOpen ? (
        <GcPortalPay state={state} partner={partner} onHome={() => go(null)} />
      ) : shown ? (
        <ProjectPage state={state} project={shown} partner={partner} dispatch={dispatch} onHome={() => go(null)} />
      ) : (
        <div style={{ padding: '0.9rem' }}>
          <GcPortalHome
            state={state}
            partner={partner}
            dispatch={dispatch}
            onOpenProject={(id) => go(id)}
            onOpenPay={() => {
              go(null)
              setPayOpen(true)
            }}
          />
        </div>
      )}
      </PortalLangContext.Provider>
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
  const { t } = usePortalLang()
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
          {t('backHome', { gc: GC })}
        </button>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{project.name}</div>
        <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
          {project.address} · {project.sizeNote}
          <br />
          {t('gcLine', { name: GC_COMPANY.name, contact: partner.contact })}
        </div>
      </div>

      {/* A project we lost asks for nothing, paperwork included. */}
      {paperworkMissing && !project.lostOn && <GcPortalPaperwork partner={partner} today={state.today} dispatch={dispatch} />}

      <GcPortalLookAhead state={state} project={project} partner={partner} dispatch={dispatch} />

      {mine.length === 0 && <div>{t('noInvite')}</div>}
      {mine.map(({ pkg, invite }) => (
        <PackageBlock key={invite.id} state={state} project={project} pkg={pkg} invite={invite} partner={partner} dispatch={dispatch} />
      ))}

      <GcPortalContacts project={project} />
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
  const { lang, t } = usePortalLang()
  /** The plans window: closed, open on its first sheet (''), or open on a sheet the company tapped. */
  const [plansAt, setPlansAt] = useState<string | null>(null)
  const news = portalPlanNews(project, pkg, invite)
  const latest = news.latest
  const ids = { projectId: project.id, packageId: pkg.id }
  const awardedToMe = pkg.awardedInviteId === invite.id
  const awardedElsewhere = pkg.awardedInviteId !== null && !awardedToMe
  // We lost the project: the plans stay to look at, nothing else asks for anything.
  const closed = Boolean(project.lostOn) && invite.status !== 'declined'
  const closedWords = closed ? portalClosedWords(project, Boolean(invite.bid), lang) : null
  // An opened bid tab already says how it ended (owner, 2026-10-03): the result would say it twice.
  const tabSaysResult = Boolean(pkg.bidTab && invite.bid && pkg.bidTab.seenBy.includes(partner.id))
  // A newer set to open, said only while it still matters to their number.
  const behind = news.behind && !closed
  // Any look at the newest set counts as opening it, from the button or from a sheet number.
  const openPlans = (sheetId = '') => {
    if (news.behind) dispatch({ type: 'tradeOpenPlans', ...ids, inviteId: invite.id })
    setPlansAt(sheetId)
  }

  return (
    <>
      <Block title={t('plansTitle', { trade: pkg.trade })}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
          <strong>{latest?.label}</strong>
          <span style={{ opacity: 0.75 }}>{t('issued', { date: pDate(lang, latest?.issuedOn ?? null) })}</span>
          {behind ? (
            <Btn kind={news.neverOpened || news.forTrade.length > 0 ? 'primary' : 'plain'} onClick={() => openPlans()}>{t('openPlans')}</Btn>
          ) : (
            <>
              {!news.behind && <Chip tone="green">{t('latestSet')}</Chip>}
              <Btn kind="quiet" onClick={() => openPlans()}>{t('lookPlans')}</Btn>
            </>
          )}
        </div>
        {behind && news.forTrade.length > 0 && (
          <div style={{ marginTop: '0.4rem' }}>
            <PortalNote tone="amber">
              <strong>{t('newForTrade', { trade: pkg.trade })}</strong>
              {news.forTrade.map((set) => (
                <div key={set.rev}>
                  {set.label}: {set.note}
                  {set.changedSheets.length > 0 && <> {t('sheetsList', { list: set.changedSheets.join(', ') })}</>}
                </div>
              ))}
            </PortalNote>
          </div>
        )}
        {behind && !news.neverOpened && news.forTrade.length === 0 && latest && (
          <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', opacity: 0.8 }}>
            {t('setNoChange', { label: latest.label, trade: pkg.trade })}
          </div>
        )}
        {plansAt !== null && <GcPortalPlans key={plansAt} project={project} pkg={pkg} startSheet={plansAt || undefined} onClose={() => setPlansAt(null)} />}
      </Block>

      {/* Questions about the plans, while the company is still on this trade. */}
      {!closed && !awardedElsewhere && invite.status !== 'declined' && (
        <GcPortalQuestions project={project} pkg={pkg} partner={partner} today={state.today} dispatch={dispatch} onOpenSheet={openPlans} />
      )}

      {pkg.bidTab && invite.bid && (
        <Block title={t('bidTabTitle', { trade: pkg.trade })}>
          {pkg.bidTab.seenBy.includes(partner.id) ? (
            <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
              <div>{bidTabResult(project, pkg, partner.id)}</div>
              <BidTabTable rows={bidTabRows(state, pkg)} viewerId={partner.id} showNames={pkg.bidTab.showNames} />
              <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>{t('bidTabThanks')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
              <span>{t('bidTabShared', { gc: GC, date: pDate(lang, pkg.bidTab.sharedOn) })}</span>
              <Btn kind="primary" onClick={() => dispatch({ type: 'tradeSeeBidTab', ...ids, partnerId: partner.id })}>{t('seeBidTab')}</Btn>
            </div>
          )}
        </Block>
      )}

      {closedWords ? (
        tabSaysResult ? null : (
          <Block title={t('resultTitle', { trade: pkg.trade })}>
            <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
              <strong>{closedWords.why}</strong>
              <span>{closedWords.next}</span>
            </div>
          </Block>
        )
      ) : awardedElsewhere ? (
        <Block title={t('resultTitle', { trade: pkg.trade })}>{t('wentElsewhere')}</Block>
      ) : awardedToMe && pkg.sow ? (
        <SowBlock project={project} pkg={pkg} partner={partner} today={state.today} dispatch={dispatch} />
      ) : invite.status === 'declined' ? (
        <Block title={t('inviteTitle', { trade: pkg.trade })}>{t('youPassed')}</Block>
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
  const { lang, t } = usePortalLang()
  const [promiseDay, setPromiseDay] = useState('')
  const promise = portalPromiseLine(invite, today, GC, lang)
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
    <Block title={t('bidTitle', { trade: pkg.trade })}>
      {due && (
        <div style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>
          {t('dueIs')} <strong>{pDate(lang, due)}</strong>
          {days !== null && <> ({days >= 0 ? t('daysN', { n: days }) : t('pastDue')})</>}.
        </div>
      )}
      {invite.bid && !editing ? (
        <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
          <div>
            {t('yourBidLabel')} <strong>{money(invite.bid.amount)}</strong>{' '}
            {t('yourBidRest', { plans: planLabel(project, invite.bid.basedOnRev), date: pDate(lang, invite.bid.submittedOn) })}
            {goodUntil && !ranOut && <> {t('goodUntil', { date: pWeekday(lang, goodUntil) })}</>}
          </div>
          {(invite.bid.alternates ?? []).length > 0 && (
            <div>
              <span style={{ opacity: 0.75 }}>{t('alternatesLabel')}</span> {(invite.bid.alternates ?? []).map((alt) => alternateWords(alt, lang)).join(' · ')}
            </div>
          )}
          {invite.bid.quoteFile && (
            <div>
              <span style={{ opacity: 0.75 }}>{t('ownQuoteLabel')}</span> <Chip tone="grey">{invite.bid.quoteFile}</Chip>
            </div>
          )}
          {ranOut && goodUntil && (
            <PortalNote tone="amber">
              <div>{t('ranOut', { date: pWeekday(lang, goodUntil) })}</div>
              <div>
                <Btn kind="primary" onClick={() => setEditing(true)}>{t('sendAgain')}</Btn>
              </div>
            </PortalNote>
          )}
          {stale && (
            <PortalNote tone="amber">
              <div>
                {t('staleNote')} {t(openedNewest ? 'staleOpened' : 'staleNotOpened')}
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
                    {t('unclearAsk', { gc: GC, items: unclear.map((i) => i.label.charAt(0).toLowerCase() + i.label.slice(1)).join(t('or')) })}
                  </div>
                  <div>
                    <Btn kind="primary" onClick={() => setAnswering(true)}>{t('answerIt')}</Btn>
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
                title={openedNewest ? undefined : t('openFirst')}
                onClick={() => dispatch({ type: 'tradeConfirmBid', ...ids })}
              >
                {t('confirmStands')}
              </Btn>
            )}
            <Btn onClick={() => setEditing(true)}>{t('changeBid')}</Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            {t('tickHelp')}
          </div>
          {pkg.scope.map((item) =>
            includes[item.id] === 'unclear' ? (
              <div key={item.id} style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem', padding: '0.4rem 0.5rem', background: 'var(--bg-amber-100)', borderRadius: 6 }}>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>
                    <strong>{item.label}.</strong> {t('unclearLine', { gc: GC })}
                  </span>
                  <LineSheets line={lineOf(item.id)} onOpen={onOpenSheet} />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <Btn onClick={() => setIncludes({ ...includes, [item.id]: 'yes' })}>{t('inMyNumber')}</Btn>
                  <Btn onClick={() => setIncludes({ ...includes, [item.id]: 'no' })}>{t('leftOut')}</Btn>
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
              <span>{t('alsoChangedIn', { sets: sheets.sets.map((x) => x.label).join(t('and')) })}</span>
              {sheets.otherSheets.map((id) => (
                <SheetChip key={id} id={id} changed onOpen={onOpenSheet} />
              ))}
            </div>
          )}
          <label style={{ fontSize: '0.9rem' }}>
            {t('yourNumber')}{' '}
            <input type="number" min={0} step={100} value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...input, width: '9rem' }} />
          </label>
          <GoodForPicker value={goodFor} onChange={setGoodFor} />
          <input style={input} placeholder={t('anythingKnow')} value={note} onChange={(e) => setNote(e.target.value)} />
          <AlternatesEditor value={alternates} onChange={setAlternates} />
          <QuoteFilePicker value={quoteFile} onChange={setQuoteFile} />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Btn
              kind="primary"
              disabled={invite.seenRev === null || !(Number(amount) > 0) || unanswered > 0}
              title={invite.seenRev === null ? t('openFirst') : unanswered > 0 ? t('answerEach') : undefined}
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
              {t(invite.bid ? 'sendNew' : 'sendBid')}
            </Btn>
            {!invite.bid && <Btn kind="quiet" onClick={() => dispatch({ type: 'tradeDecline', ...ids })}>{t('passOn')}</Btn>}
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
                {t('keepBid')}
              </Btn>
            )}
            {invite.seenRev === null && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{t('openFirst')}</span>}
            {invite.seenRev !== null && unanswered > 0 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{t('answerEach')}</span>
            )}
          </div>
          {!invite.bid && (
            <div style={{ borderTop: '1px solid #d9d2c3', paddingTop: '0.5rem', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
              {promise ? (
                <span style={promise.late ? { color: 'var(--text-red-700)', fontWeight: 600 } : undefined}>{promise.text}</span>
              ) : (
                <span>{t('notReady', { gc: GC })}</span>
              )}
              <input type="date" min={today} value={promiseDay} onChange={(e) => setPromiseDay(e.target.value)} style={input} aria-label={t('dayAria')} />
              <Btn
                disabled={promiseDay === ''}
                onClick={() => {
                  dispatch({ type: 'tradePromise', ...ids, promisedBy: promiseDay })
                  setPromiseDay('')
                }}
              >
                {promise?.late ? t('giveNewDay') : promise ? t('changeDay') : t('tellGc', { gc: GC })}
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
  today,
  dispatch,
}: {
  project: GcProject
  pkg: TradePackage
  partner: Partner
  /** Building lane: closeout waits on dates (a trade's retainage comes 10 days after the owner's). */
  today: string
  dispatch: Dispatch<GcAction>
}) {
  const { lang, t } = usePortalLang()
  const sow = pkg.sow
  if (!sow) return null
  const ids = { projectId: project.id, packageId: pkg.id }
  const m = sowMoney(sow)

  if (sow.status === 'draft') {
    return <Block title={t('gotJobTitle', { trade: pkg.trade })}>{t('sowDraft', { gc: GC })}</Block>
  }

  return (
    <>
      <Block title={t('sowTitle', { trade: pkg.trade })}>
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem' }}>
          <div>
            <strong>{money(sow.price)}</strong> · {t('sowLine', { pct: sow.retainagePct, plans: planLabel(project, sow.basedOnRev) })}
          </div>
          <div style={{ opacity: 0.8 }}>{sow.sov.map((l) => `${l.label} ${money(l.amount)}`).join(' · ')}</div>
          {sow.status === 'sent' ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn kind="primary" disabled={partner.msa !== 'signed'} onClick={() => dispatch({ type: 'tradeSignSow', ...ids })}>
                {t('signSow')}
              </Btn>
              {partner.msa !== 'signed' && <span style={{ fontSize: '0.8rem', color: 'var(--text-red-700)' }}>{t('signMsaFirst')}</span>}
            </div>
          ) : (
            <Chip tone="green">{t('signedOn', { date: pDate(lang, sow.signedOn) })}</Chip>
          )}
        </div>
      </Block>

      {sow.status === 'signed' && (
        <Block title={t('reportTitle', { trade: pkg.trade })}>
          <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
            {sow.sov.map((l) => (
              <label key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                <span>
                  {l.label} <span style={{ opacity: 0.7 }}>· {money(l.amount)} · {t('paidThrough', { pct: l.pctBilled })}</span>
                </span>
                <select
                  value={l.pctReported}
                  onChange={(e) => dispatch({ type: 'tradeReport', ...ids, sovId: l.id, pct: Number(e.target.value) })}
                  style={input}
                  aria-label={t('percentAria', { line: l.label })}
                >
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
                    .filter((p) => p >= l.pctBilled)
                    .map((p) => (
                      <option key={p} value={p}>{t('pctDone', { pct: p })}</option>
                    ))}
                </select>
              </label>
            ))}
            {/* Building lane: a draw is asked for with its pay application (the 702 and 703). */}
            <GcBuildingPayAppDoor project={project} pkg={pkg} partner={partner} today={today} dispatch={dispatch} />
            {sow.draws.map((d) => (
              <div key={d.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{t('drawN', { n: d.number })}</strong>
                <span>
                  {money(d.net)}
                  {d.asked && <span style={{ opacity: 0.75 }}> {t('drawOfAsked', { asked: money(d.asked.net) })}</span>}
                </span>
                <Chip tone={d.status === 'paid' ? 'green' : d.status === 'approved' ? 'blue' : 'amber'}>
                  {d.status === 'requested' ? t('drawReviewing', { gc: GC }) : d.status === 'approved' ? t('drawApproved') : t('drawPaid')}
                </Chip>
                {d.status === 'paid' && d.waiver === 'conditional' && (
                  <Btn kind="primary" onClick={() => dispatch({ type: 'tradeSignUnconditional', ...ids, drawId: d.id })}>
                    {t('signUncond')}
                  </Btn>
                )}
              </div>
            ))}
            <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
              {t('sowTotals', { paid: money(m.paid), held: money(m.retainageHeld), left: money(sowContractSum(sow) - m.billed) })}
            </div>
          </div>
        </Block>
      )}
    </>
  )
}
