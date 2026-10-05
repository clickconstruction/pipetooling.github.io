import { useRef, useState, type Dispatch, type ReactNode } from 'react'
import {
  daysUntil,
  GC_COMPANY,
  money,
  pDate,
  portalFirstVisit,
  portalHome,
  portalQuoteDue,
  pt,
  pWeekday,
  sentBackOpen,
  tradeCloseout,
  workAllBilled,
  type GcAction,
  type GcState,
  type Partner,
  type PortalAsk,
  type PortalJobMoney,
  type PortalLang,
  type PortalTodo,
  openPromiseFor,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, type Tone } from './gcUi'
import { GcPortalPaperwork, type PaperworkLine } from './GcPortalPaperwork'
import { GcPortalDates } from './GcPortalDates'
import { PortalBlock } from './GcPortalUi'
import { usePortalLang } from './gcPortalLang'

/**
 * GC mode design spike: a company's home in its portal. The link we send a trade is one link for
 * the company, not one per project: it opens here, on everything the company has with us. What
 * needs them first, then their jobs, what they are bidding, their paperwork and what came before.
 * Drawn for a phone first. A row opens that project's page.
 */

const GC = GC_COMPANY.shortName

const DOT: Record<PortalTodo['tone'], string> = {
  red: 'var(--text-red-700)',
  amber: 'var(--text-amber-700)',
  plain: 'var(--text-muted)',
}

export function GcPortalHome({
  state,
  partner,
  dispatch,
  onOpenProject,
  onOpenPay,
  onOpenPapers,
}: {
  state: GcState
  partner: Partner
  dispatch: Dispatch<GcAction>
  /** Opens a project page, landing on one of its blocks when the to-do names one. */
  onOpenProject: (projectId: string, anchor?: string) => void
  /** Open Your pay: every pay application on the company's jobs. */
  onOpenPay: () => void
  /** Your papers: every paper the company signed with us. */
  onOpenPapers: () => void
}) {
  const { lang, t: tr } = usePortalLang()
  const home = portalHome(state, partner.id, lang)
  const firstVisit = portalFirstVisit(state, partner.id)
  const paperRef = useRef<HTMLDivElement | null>(null)
  const [paperAsk, setPaperAsk] = useState<{ line: PaperworkLine; n: number } | null>(null)

  const openTodo = (t: PortalTodo) => {
    if (t.projectId) {
      onOpenProject(t.projectId, t.anchor)
      return
    }
    if (t.key === 'msa' || t.key === 'coi' || t.key === 'w9' || t.key === 'vet') setPaperAsk({ line: t.key, n: (paperAsk?.n ?? 0) + 1 })
    paperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {firstVisit ? (
        <Welcome partner={partner} firstAsk={home.bidding[0]} onDone={() => dispatch({ type: 'tradeOpenPortal', partnerId: partner.id })} />
      ) : (
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{tr('hello', { name: partner.contact })}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{tr('homeIntro', { company: partner.company, gc: GC_COMPANY.name })}</div>
        </div>
      )}

      <PortalBlock title={home.todos.length > 0 ? `${tr('needsYou')} · ${home.todos.length}` : tr('needsYou')}>
        {home.todos.length === 0 ? (
          <div style={{ fontSize: '0.9rem' }}>{tr('nothingNeeds')}</div>
        ) : (
          <div style={{ display: 'grid' }}>
            {home.todos.map((t, i) => (
              <Row key={t.key} first={i === 0} onClick={() => openTodo(t)}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: DOT[t.tone], flexShrink: 0, marginTop: '0.4rem' }} />
                <span style={{ flex: 1, fontWeight: t.tone === 'red' ? 600 : 400 }}>{t.text}</span>
              </Row>
            ))}
          </div>
        )}
      </PortalBlock>

      {home.money && (
        <PortalBlock title={tr('yourMoney')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
            <Stat label={tr('paidToYou')} value={money(home.money.paid)} />
            <Stat label={tr('heldEnd')} value={money(home.money.held)} />
            {home.money.coming > 0 && <Stat label={tr('approvedWay')} value={money(home.money.coming)} />}
            {home.money.reviewing > 0 && <Stat label={tr('gcLooking', { gc: GC })} value={money(home.money.reviewing)} />}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <Btn kind="quiet" onClick={onOpenPay}>
              {tr('seeEveryPayment')} ›
            </Btn>
          </div>
        </PortalBlock>
      )}

      {home.jobs.length > 0 && (
        <PortalBlock title={`${tr('yourJobs')} · ${home.jobs.length}`}>
          <div style={{ display: 'grid' }}>
            {home.jobs.map(({ ask, money: m }, i) => (
              <Row key={ask.invite.id} first={i === 0} onClick={() => onOpenProject(ask.project.id)}>
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.2rem' }}>
                  <strong>{ask.project.name}</strong>
                  <span style={{ opacity: 0.8 }}>
                    {ask.pkg.trade}
                    {m ? ` · ${money(m.price)}` : ''}
                  </span>
                  <span>
                    <JobChip ask={ask} lang={lang} />
                  </span>
                  {m && ask.pkg.sow?.status === 'signed' && <JobLine m={m} lang={lang} />}
                </div>
              </Row>
            ))}
          </div>
        </PortalBlock>
      )}

      {home.bidding.length > 0 && (
        <PortalBlock title={`${tr('askedToBid')} · ${home.bidding.length}`}>
          <div style={{ display: 'grid' }}>
            {home.bidding.map((ask, i) => (
              <Row key={ask.invite.id} first={i === 0} onClick={() => onOpenProject(ask.project.id)}>
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.2rem' }}>
                  <strong>{ask.project.name}</strong>
                  <span style={{ opacity: 0.8 }}>
                    {ask.pkg.trade} · {ask.project.town}
                  </span>
                  <span style={{ fontSize: '0.85rem' }}>{whenWords(ask, state.today, lang)}</span>
                  <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <BidChips ask={ask} lang={lang} />
                  </span>
                </div>
              </Row>
            ))}
          </div>
        </PortalBlock>
      )}

      <GcPortalDates state={state} partner={partner} dispatch={dispatch} />

      <div ref={paperRef} style={{ scrollMarginTop: '0.5rem' }}>
        <GcPortalPaperwork
          key={paperAsk?.n ?? 0}
          partner={partner}
          today={state.today}
          dispatch={dispatch}
          startOpen={paperAsk?.line ?? null}
          promises={{ insurance: openPromiseFor(state, { partnerId: partner.id, kind: 'insurance' }), w9: openPromiseFor(state, { partnerId: partner.id, kind: 'w9' }) }}
        />
        {/* Your papers: every paper signed with us, to read or print (owner, 2026-10-04). */}
        <div style={{ marginTop: '0.35rem' }}>
          <Btn kind="quiet" onClick={onOpenPapers}>
            {tr('papersLink')} ›
          </Btn>
        </div>
      </div>

      {home.past.length > 0 && (
        <PortalBlock title={tr('before')}>
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', opacity: 0.85 }}>
            {home.past.map((ask) =>
              ask.kind === 'closed' ? (
                // A project we lost still opens: its plans stay there to look at.
                <button
                  key={ask.invite.id}
                  type="button"
                  onClick={() => onOpenProject(ask.project.id)}
                  style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer', font: 'inherit' }}
                >
                  {ask.project.name} · {ask.pkg.trade} · {tr(ask.project.lostWhy === 'project_died' ? 'closedShortDied' : 'closedShortLost', { gc: GC })}{' '}
                  <span aria-hidden style={{ opacity: 0.5 }}>›</span>
                </button>
              ) : (
                <div key={ask.invite.id}>
                  {ask.project.name} · {ask.pkg.trade} · {tr(ask.kind === 'lost' ? 'wentOther' : 'youPassedShort')}
                </div>
              ),
            )}
          </div>
        </PortalBlock>
      )}
    </div>
  )
}

/** The first time a company opens its link: who we are, what this page is, and the three things to know. */
function Welcome({ partner, firstAsk, onDone }: { partner: Partner; firstAsk: PortalAsk | undefined; onDone: () => void }) {
  const { t } = usePortalLang()
  const name = partner.contact.split(' ')[0] ?? partner.contact
  return (
    <PortalBlock title={t('welcomeTitle')}>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('welcomeName', { name })}</div>
        <div>
          {firstAsk
            ? t('welcomeAsked', { gc: GC_COMPANY.name, company: partner.company, trade: firstAsk.pkg.trade, project: firstAsk.project.name })
            : t('welcomeAdded', { gc: GC_COMPANY.name, company: partner.company })}{' '}
          {t('welcomeWhere')}
        </div>
        <div>{t('welcomeHolds')}</div>
        <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.25rem' }}>
          <li>{t('welcome1')}</li>
          <li>{t('welcome2')}</li>
          <li>{t('welcome3')}</li>
        </ol>
        <div>
          <Btn kind="primary" onClick={onDone}>
            {t('gotIt')}
          </Btn>
        </div>
      </div>
    </PortalBlock>
  )
}

/** One tappable line of a list, with the arrow that says it opens something. */
function Row({ first, onClick, children }: { first: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        gap: '0.55rem',
        alignItems: 'flex-start',
        width: '100%',
        textAlign: 'left',
        padding: '0.55rem 0.1rem',
        border: 'none',
        borderTop: first ? 'none' : '1px solid var(--border)',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '0.9rem',
        lineHeight: 1.35,
      }}
    >
      {children}
      <span aria-hidden style={{ opacity: 0.5, fontSize: '1.1rem', lineHeight: 1, alignSelf: 'center' }}>
        ›
      </span>
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

/** When their number is due, or where the job stands once our own bid went in. */
function whenWords(ask: PortalAsk, today: string, lang: PortalLang): string {
  const p = ask.project
  if (p.stage !== 'pursuing') return pt(lang, 'whenWon', { gc: GC, trade: ask.pkg.trade })
  if (p.ourBidSentOn) return pt(lang, 'whenSent', { gc: GC, date: pDate(lang, p.ourBidSentOn) })
  // The day we want quotes by, three days before our bid is due (owner, 2026-10-04).
  const due = portalQuoteDue(p)
  if (!due) return pt(lang, 'noDueDay')
  const left = daysUntil(due, today)
  const date = pWeekday(lang, due)
  if (left < 0) return pt(lang, 'wasDue', { date })
  if (left === 0) return pt(lang, 'dueToday', { date })
  return pt(lang, left === 1 ? 'dueIn1' : 'dueInN', { date, n: left })
}

function BidChips({ ask, lang }: { ask: PortalAsk; lang: PortalLang }) {
  const chips: { tone: Tone; words: string }[] = []
  if (ask.invite.bid) chips.push({ tone: 'green', words: pt(lang, 'chipNumber', { amount: money(ask.invite.bid.amount) }) })
  else if (ask.promise?.state === 'passed') chips.push({ tone: 'red', words: pt(lang, 'chipDayPassed') })
  else chips.push({ tone: 'grey', words: pt(lang, 'chipNoNumber') })
  if (ask.ranOut) chips.push({ tone: 'amber', words: pt(lang, 'chipRanOut') })
  if (ask.stale) chips.push({ tone: 'amber', words: pt(lang, 'chipPlansChanged') })
  if (ask.unclear.length > 0) chips.push({ tone: 'amber', words: pt(lang, 'chipLineToAnswer') })
  return (
    <>
      {chips.map((c) => (
        <Chip key={c.words} tone={c.tone}>
          {c.words}
        </Chip>
      ))}
    </>
  )
}

function JobChip({ ask, lang }: { ask: PortalAsk; lang: PortalLang }) {
  const sow = ask.pkg.sow
  if (!sow || sow.status === 'draft') return <Chip tone="grey">{pt(lang, 'chipSowWritten')}</Chip>
  if (sow.status === 'sent') return <Chip tone="amber">{pt(lang, 'chipSignSow')}</Chip>
  if (workAllBilled(sow)) return tradeCloseout(sow).closed ? <Chip tone="green">{pt(lang, 'chipClosedOut')}</Chip> : <Chip tone="blue">{pt(lang, 'chipClosingOut')}</Chip>
  const back = sentBackOpen(sow)
  if (back) return <Chip tone="amber">{pt(lang, 'chipSentBack', { n: back.draw.number })}</Chip>
  return <Chip tone="green">{pt(lang, 'signedOn', { date: pDate(lang, sow.signedOn) })}</Chip>
}

function JobLine({ m, lang }: { m: PortalJobMoney; lang: PortalLang }) {
  return <span style={{ fontSize: '0.82rem', opacity: 0.8 }}>{pt(lang, 'jobLine', { pct: m.donePct, paid: money(m.paid), held: money(m.held) })}</span>
}
