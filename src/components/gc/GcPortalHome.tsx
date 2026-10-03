import { useRef, useState, type Dispatch, type ReactNode } from 'react'
import {
  daysUntil,
  GC_COMPANY,
  money,
  portalFirstVisit,
  portalHome,
  shortDate,
  weekdayDate,
  type GcAction,
  type GcState,
  type Partner,
  type PortalAsk,
  type PortalJobMoney,
  type PortalTodo,
} from '../../lib/gcMode/gcModel'
import { Btn, Chip, type Tone } from './gcUi'
import { GcPortalPaperwork, type PaperworkLine } from './GcPortalPaperwork'
import { PortalBlock } from './GcPortalUi'

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
}: {
  state: GcState
  partner: Partner
  dispatch: Dispatch<GcAction>
  onOpenProject: (projectId: string) => void
}) {
  const home = portalHome(state, partner.id)
  const firstVisit = portalFirstVisit(state, partner.id)
  const paperRef = useRef<HTMLDivElement | null>(null)
  const [paperAsk, setPaperAsk] = useState<{ line: PaperworkLine; n: number } | null>(null)

  const openTodo = (t: PortalTodo) => {
    if (t.projectId) {
      onOpenProject(t.projectId)
      return
    }
    if (t.key === 'msa' || t.key === 'coi' || t.key === 'w9') setPaperAsk({ line: t.key, n: (paperAsk?.n ?? 0) + 1 })
    paperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {firstVisit ? (
        <Welcome partner={partner} firstAsk={home.bidding[0]} onDone={() => dispatch({ type: 'tradeOpenPortal', partnerId: partner.id })} />
      ) : (
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Hello, {partner.contact}.</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
            This is everything {partner.company} has with {GC_COMPANY.name}. The link is yours. Keep it.
          </div>
        </div>
      )}

      <PortalBlock title={home.todos.length > 0 ? `Needs you · ${home.todos.length}` : 'Needs you'}>
        {home.todos.length === 0 ? (
          <div style={{ fontSize: '0.9rem' }}>Nothing needs you right now.</div>
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
        <PortalBlock title="Your money">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.5rem' }}>
            <Stat label="Paid to you" value={money(home.money.paid)} />
            <Stat label="Held until the end" value={money(home.money.held)} />
            {home.money.coming > 0 && <Stat label="Approved, on the way" value={money(home.money.coming)} />}
            {home.money.reviewing > 0 && <Stat label={`${GC} is looking at`} value={money(home.money.reviewing)} />}
          </div>
        </PortalBlock>
      )}

      {home.jobs.length > 0 && (
        <PortalBlock title={`Your jobs · ${home.jobs.length}`}>
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
                    <JobChip ask={ask} />
                  </span>
                  {m && ask.pkg.sow?.status === 'signed' && <JobLine m={m} />}
                </div>
              </Row>
            ))}
          </div>
        </PortalBlock>
      )}

      {home.bidding.length > 0 && (
        <PortalBlock title={`Asked to bid · ${home.bidding.length}`}>
          <div style={{ display: 'grid' }}>
            {home.bidding.map((ask, i) => (
              <Row key={ask.invite.id} first={i === 0} onClick={() => onOpenProject(ask.project.id)}>
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.2rem' }}>
                  <strong>{ask.project.name}</strong>
                  <span style={{ opacity: 0.8 }}>
                    {ask.pkg.trade} · {ask.project.town}
                  </span>
                  <span style={{ fontSize: '0.85rem' }}>{whenWords(ask, state.today)}</span>
                  <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    <BidChips ask={ask} />
                  </span>
                </div>
              </Row>
            ))}
          </div>
        </PortalBlock>
      )}

      <div ref={paperRef} style={{ scrollMarginTop: '0.5rem' }}>
        <GcPortalPaperwork key={paperAsk?.n ?? 0} partner={partner} today={state.today} dispatch={dispatch} startOpen={paperAsk?.line ?? null} />
      </div>

      {home.past.length > 0 && (
        <PortalBlock title="Before">
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', opacity: 0.85 }}>
            {home.past.map((ask) => (
              <div key={ask.invite.id}>
                {ask.project.name} · {ask.pkg.trade} · {ask.kind === 'lost' ? 'went to another company' : 'you passed'}
              </div>
            ))}
          </div>
        </PortalBlock>
      )}
    </div>
  )
}

/** The first time a company opens its link: who we are, what this page is, and the three things to know. */
function Welcome({ partner, firstAsk, onDone }: { partner: Partner; firstAsk: PortalAsk | undefined; onDone: () => void }) {
  const name = partner.contact.split(' ')[0] ?? partner.contact
  return (
    <PortalBlock title="Welcome">
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Welcome, {name}.</div>
        <div>
          {firstAsk
            ? `${GC_COMPANY.name} asked ${partner.company} to bid ${firstAsk.pkg.trade} on ${firstAsk.project.name}.`
            : `${GC_COMPANY.name} added ${partner.company} to its trade partners.`}{' '}
          This portal is where you work with us.
        </div>
        <div>It holds every job, the plans, your paperwork and your pay. There is no password. The link is yours, so keep it.</div>
        <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.25rem' }}>
          <li>Open the plans before you price.</li>
          <li>Send your number by the day it is due. Not for you? Press Pass on this one.</li>
          <li>Send your insurance and W-9 when you can. We need them before any work starts.</li>
        </ol>
        <div>
          <Btn kind="primary" onClick={onDone}>
            Got it
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
function whenWords(ask: PortalAsk, today: string): string {
  const p = ask.project
  if (p.stage !== 'pursuing') return `${GC} won the job. ${ask.pkg.trade} is not picked yet.`
  if (p.ourBidSentOn) return `${GC} sent its bid ${shortDate(p.ourBidSentOn)}. The owner picks next.`
  if (!p.bidDue) return 'No due day yet.'
  const left = daysUntil(p.bidDue, today)
  if (left < 0) return `Was due ${weekdayDate(p.bidDue)}.`
  if (left === 0) return `Due today, ${weekdayDate(p.bidDue)}.`
  return `Due ${weekdayDate(p.bidDue)}, ${left} ${left === 1 ? 'day' : 'days'} left.`
}

function BidChips({ ask }: { ask: PortalAsk }) {
  const chips: { tone: Tone; words: string }[] = []
  if (ask.invite.bid) chips.push({ tone: 'green', words: `your number ${money(ask.invite.bid.amount)}` })
  else if (ask.promise?.state === 'passed') chips.push({ tone: 'red', words: 'your day passed' })
  else chips.push({ tone: 'grey', words: 'no number yet' })
  if (ask.stale) chips.push({ tone: 'amber', words: 'plans changed' })
  if (ask.unclear.length > 0) chips.push({ tone: 'amber', words: 'a line to answer' })
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

function JobChip({ ask }: { ask: PortalAsk }) {
  const sow = ask.pkg.sow
  if (!sow || sow.status === 'draft') return <Chip tone="grey">statement of work being written</Chip>
  if (sow.status === 'sent') return <Chip tone="amber">sign the statement of work</Chip>
  return <Chip tone="green">signed {shortDate(sow.signedOn)}</Chip>
}

function JobLine({ m }: { m: PortalJobMoney }) {
  return (
    <span style={{ fontSize: '0.82rem', opacity: 0.8 }}>
      Work {m.donePct}% done · paid {money(m.paid)} · held {money(m.held)}
    </span>
  )
}
