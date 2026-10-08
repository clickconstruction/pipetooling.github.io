import { useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { planLabel } from '../../lib/gc/lookups'
import { questionsCloseOn } from '../../lib/gc/planQuestions'
import { bidIsStale } from '../../lib/gc/bids'
import { bidGoodUntil, bidRanOut, portalClosedWords, portalContacts, portalLeavesOut, portalPlanNews, portalPromiseLine, portalQuestions, portalQuoteDue, portalVetting, unclearLines } from '../../lib/gc/portal'
import { pDate, pWeekday } from '../../lib/gc/portalI18n'
import { replyByEmailWords } from '../../lib/gc/tradePortalPage'
import type { GcProject, Invite, Partner, TradePackage } from '../../lib/gc/types'
import { daysUntil, money } from '../../lib/gc/words'
import { COPPER, HAIR, MUTED } from '../../lib/portal/portalTheme'
import { Btn, Chip } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'
import { usePortalPress, usePress } from './gcTradePortalPress'
import { AnswerLines, AskQuestion, ConfirmQuote, PassOnAsk, QuoteDay } from './GcTradePortalPresses'
import { QuoteForm } from './GcTradePortalQuoteForm'
import { PortalBlock, PortalNote } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal (P1b-ii-b): one project's page, read only, from the design spike's
 * `GcTradePortal.tsx` (its ProjectPage, PackageBlock and BidBlock) and `GcPortalQuestions.tsx`. The company sees its
 * plans, the questions it may read, where its ask stands and who to call. The presses (a quote, a day, a question,
 * pass) come with the submit function (P2b); until then the page says who to email.
 */

const GC = GC_COMPANY.shortName
const LINK = { color: 'var(--text-blue-500)', fontSize: '0.85rem' } as const

export function GcTradePortalProject({
  project,
  partner,
  today,
  planUrl,
  onHome,
}: {
  project: GcProject
  partner: Partner
  today: string
  /** The Drive link of a set by its number; empty when it has none. */
  planUrl: (rev: number) => string
  onHome: () => void
}) {
  const { t } = usePortalLang()
  const mine = project.packages.flatMap((pkg) => pkg.invites.filter((i) => i.partnerId === partner.id).map((invite) => ({ pkg, invite })))
  return (
    <div style={{ padding: '0.9rem', display: 'grid', gap: '0.9rem' }}>
      <div>
        <button
          type="button"
          onClick={onHome}
          style={{ border: 'none', background: 'transparent', padding: '0.4rem 0', minHeight: 44, color: 'var(--text-blue-500)', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          {t('backHome', { gc: GC })}
        </button>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{project.name}</div>
        <div style={{ fontSize: '0.85rem', color: MUTED }}>
          {[project.address, project.sizeNote].filter((s) => s.trim() !== '').join(' · ')}
          <br />
          {t('gcLine', { name: GC_COMPANY.name, contact: partner.contact })}
        </div>
      </div>
      {mine.length === 0 && <div>{t('noInvite')}</div>}
      {mine.map(({ pkg, invite }) => (
        <TradeBlocks key={invite.id} project={project} pkg={pkg} invite={invite} partner={partner} today={today} planUrl={planUrl} />
      ))}
      <Contacts project={project} />
    </div>
  )
}

function TradeBlocks({
  project,
  pkg,
  invite,
  partner,
  today,
  planUrl,
}: {
  project: GcProject
  pkg: TradePackage
  invite: Invite
  partner: Partner
  today: string
  planUrl: (rev: number) => string
}) {
  const { lang, t } = usePortalLang()
  const news = portalPlanNews(project, pkg, invite)
  const latest = news.latest
  const url = latest ? planUrl(latest.rev) : ''
  // We lost the project: the plans stay to look at, nothing else asks for anything.
  const closed = Boolean(project.lostOn) && invite.status !== 'declined'
  const closedWords = closed ? portalClosedWords(project, Boolean(invite.bid), lang) : null
  const questions = portalQuestions(project, pkg.id, partner.id)
  const closeOn = questionsCloseOn(project)
  // The prototype's closing rule on its own shape (main's questionsOpen reads the row's 'bidding'): never on a bid we lost.
  const canAsk = !project.lostOn && (closeOn === null || today < closeOn)
  const press = usePortalPress()
  const opened = usePress()
  return (
    <>
      <PortalBlock title={t('plansTitle', { trade: pkg.trade })}>
        {latest ? (
          <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{latest.label}</strong>
              <span style={{ color: MUTED }}>{t('issued', { date: pDate(lang, latest.issuedOn) })}</span>
              {!news.behind && <Chip tone="green">{t('latestSet')}</Chip>}
            </div>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...LINK, fontSize: '0.9rem', fontWeight: 600 }}
                // Opening the newest set is what lets a quote price it (tradeOpenPlans); the link still opens.
                onClick={() => {
                  if (press && news.behind && !closed) void opened.run('open_plans', { inviteId: invite.id })
                }}
              >
                {t(news.behind ? 'openPlans' : 'lookPlans')} ↗
              </a>
            ) : (
              <span style={{ color: MUTED, fontSize: '0.85rem' }}>{t('plansNotShared', { gc: GC })}</span>
            )}
            {news.behind && !closed && news.forTrade.length > 0 && (
              <PortalNote tone="amber">
                <strong>{t('newForTrade', { trade: pkg.trade })}</strong>
                <span>{news.forTrade.map((s) => s.label).join(', ')}</span>
              </PortalNote>
            )}
          </div>
        ) : (
          <span style={{ color: MUTED, fontSize: '0.85rem' }}>{t('plansNotShared', { gc: GC })}</span>
        )}
      </PortalBlock>

      {!closed && invite.status !== 'declined' && (questions.length > 0 || closeOn || (press && canAsk)) && (
        <PortalBlock title={t('questionsTitle', { trade: pkg.trade })}>
          <div style={{ display: 'grid', gap: '0.55rem', fontSize: '0.9rem' }}>
            {press && canAsk ? (
              <AskQuestion packageId={pkg.id} closeOn={closeOn} />
            ) : (
              closeOn && <div style={{ fontSize: '0.85rem', color: MUTED }}>{t(today < closeOn ? 'askBy' : 'askClosed', { date: pWeekday(lang, closeOn) })}</div>
            )}
            {questions.map((pq) => (
              <div key={pq.q.id} style={{ display: 'grid', gap: '0.25rem', borderTop: `1px solid ${HAIR}`, paddingTop: '0.45rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: MUTED }}>
                  <span>{t(pq.mine ? 'youAsked' : 'anotherAsked', { date: pDate(lang, pq.q.askedOn) })}</span>
                  {(pq.q.sheets ?? []).length > 0 && <span>· {(pq.q.sheets ?? []).join(', ')}</span>}
                  {pq.state === 'asked' && <Chip tone="grey">{t('qWaiting', { gc: GC })}</Chip>}
                  {pq.state === 'with the architect' && <Chip tone="blue">{t('qWithArchitect')}</Chip>}
                </div>
                <div>{pq.q.text}</div>
                {pq.q.answer !== null && pq.answerOn && (
                  <div style={{ border: `1px solid ${HAIR}`, borderRadius: 6, padding: '0.4rem 0.55rem' }}>
                    <strong>{t('qAnswer', { date: pDate(lang, pq.answerOn) })}</strong> {pq.q.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </PortalBlock>
      )}

      {closedWords ? (
        <PortalBlock title={t('resultTitle', { trade: pkg.trade })}>
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.9rem' }}>
            <strong>{closedWords.why}</strong>
            <span>{closedWords.next}</span>
          </div>
        </PortalBlock>
      ) : invite.status === 'declined' ? (
        <PortalBlock title={t('inviteTitle', { trade: pkg.trade })}>{t('youPassed')}</PortalBlock>
      ) : (
        <AskBlock project={project} pkg={pkg} invite={invite} today={today} openedNewest={!news.behind} notVetted={portalVetting(partner).state === 'send' || portalVetting(partner).state === 'checking'} />
      )}
    </>
  )
}

/** Where the ask stands: the due day, their quote or the day they gave, the lines to answer, what to leave out. */
function AskBlock({
  project,
  pkg,
  invite,
  today,
  openedNewest,
  notVetted,
}: {
  project: GcProject
  pkg: TradePackage
  invite: Invite
  today: string
  openedNewest: boolean
  notVetted: boolean
}) {
  const { lang, t } = usePortalLang()
  const press = usePortalPress()
  const [editing, setEditing] = useState(false)
  const stale = bidIsStale(project, pkg, invite)
  const due = portalQuoteDue(project)
  const days = due ? daysUntil(due, today) : null
  const bid = invite.bid
  const goodUntil = bid ? bidGoodUntil(bid) : null
  const ranOut = bid ? bidRanOut(bid, today) : false
  const promise = portalPromiseLine(invite, today, GC, lang)
  const unclear = unclearLines(pkg, invite)
  const leavesOut = portalLeavesOut(pkg, lang)
  // The form is open with no quote yet, or once the company presses Change my quote (P2b-ii).
  const form = Boolean(press) && (!bid || editing)
  return (
    <PortalBlock title={t('bidTitle', { trade: pkg.trade })}>
      <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
        {due && (
          <div>
            {t('dueIs')} <strong>{pDate(lang, due)}</strong>
            {days !== null && <> ({days >= 0 ? t('daysN', { n: days }) : t('pastDue')})</>}.
          </div>
        )}
        {bid && !form ? (
          <div>
            {t('yourBidLabel')} <strong>{money(bid.amount)}</strong> {t('yourBidRest', { plans: planLabel(project, bid.basedOnRev), date: pDate(lang, bid.submittedOn) })}
            {goodUntil && !ranOut && <> {t('goodUntil', { date: pWeekday(lang, goodUntil) })}</>}
          </div>
        ) : promise && !press ? (
          <div style={promise.late ? { color: 'var(--text-red-700)', fontWeight: 600 } : undefined}>{promise.text}</div>
        ) : null}
        {ranOut && goodUntil && !form && (
          <PortalNote tone="amber">
            <div>{t('ranOut', { date: pWeekday(lang, goodUntil) })}</div>
            {press && (
              <div>
                <Btn kind="primary" onClick={() => setEditing(true)}>
                  {t('sendAgain')}
                </Btn>
              </div>
            )}
          </PortalNote>
        )}
        {press && bid && stale && !form && <ConfirmQuote invite={invite} openedNewest={openedNewest} />}
        {unclear.length > 0 &&
          !form &&
          (press ? (
            <AnswerLines invite={invite} items={unclear} />
          ) : (
            <PortalNote tone="amber">
              {t('unclearAsk', { gc: GC, items: unclear.map((i) => i.label.charAt(0).toLowerCase() + i.label.slice(1)).join(t('or')) })}
            </PortalNote>
          ))}
        {!form && (
          <div>
            <div style={{ fontSize: '0.85rem', color: MUTED }}>{t('mInviteCover')}</div>
            <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.2rem', display: 'grid', gap: '0.1rem' }}>
              {pkg.scope.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          </div>
        )}
        {leavesOut.length > 0 && (
          <div>
            <div style={{ fontSize: '0.85rem', color: MUTED }}>{t('mInviteLeavesOut')}</div>
            <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.2rem', display: 'grid', gap: '0.1rem' }}>
              {leavesOut.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {form && <QuoteForm pkg={pkg} invite={invite} notVetted={notVetted} onDone={() => setEditing(false)} />}
        {press && bid && !form && (
          <div>
            <Btn onClick={() => setEditing(true)}>{t('changeBid')}</Btn>
          </div>
        )}
        {press && !bid && <QuoteDay invite={invite} today={today} />}
        {press && !bid && <PassOnAsk invite={invite} />}
        <div style={{ fontSize: '0.85rem', borderTop: `1px solid ${HAIR}`, paddingTop: '0.45rem', color: COPPER }}>{replyByEmailWords(project, lang)}</div>
      </div>
    </PortalBlock>
  )
}

function digits(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}

/** Who to call: our superintendent on site and the project manager (while we bid, the project manager alone). */
function Contacts({ project }: { project: GcProject }) {
  const { t } = usePortalLang()
  const { team, bidding } = portalContacts(project)
  if (team.length === 0) return null
  return (
    <PortalBlock title={t('whoToCall')}>
      <div style={{ display: 'grid', gap: '0.45rem', fontSize: '0.9rem' }}>
        {team.map((c) => (
          <div key={`${c.role}:${c.name}`} style={{ display: 'grid', gap: '0.1rem' }}>
            <div>
              <strong>{c.name}</strong> <span style={{ color: MUTED }}>· {c.role === 'superintendent' ? t('roleSuper') : bidding ? t('rolePmBid') : t('rolePm')}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              {c.phone && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{c.phone}</span>}
              {c.phone && (
                <a href={`tel:${digits(c.phone)}`} style={LINK}>
                  {t('callLink')}
                </a>
              )}
              {c.phone && c.role === 'superintendent' && (
                <a href={`sms:${digits(c.phone)}`} style={LINK}>
                  {t('textLink')}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} style={LINK}>
                  {t('emailLink')}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </PortalBlock>
  )
}
