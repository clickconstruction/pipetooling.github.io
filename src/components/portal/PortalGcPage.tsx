/**
 * Messages, cut 8b-i: the customer's page for one GC job, shape B (the Messages prototype's v1.162 to v1.165, branch
 * spike/gc-mode). A home and three tabs: Home (Your move, This week, Your people), Money (the win first, one card per
 * pay application, the change orders waiting, History and the statement folded), Schedule (their schedule and what
 * moved, by its reason) and Papers (signed, waiting on you with the existing forms, comes later). Every sentence comes
 * from the page words with the office's edits laid over (`customer_page_words`); Español shows only while both the
 * job's switch and main's Spanish gate are on. Drawn from `customerPageModel`; nothing of ours reaches it.
 *
 * Interim, until 8b-ii: Your move reads the job's own facts, and Where you are waits for the customer's flow. Messages
 * comes with the thread (8e). Customer-facing ⇒ single-theme light on the statement's paper.
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { GC_CARD_FEE_PCT } from '../../../supabase/functions/_shared/gcCardBill'
import { portalShownLang } from '../../lib/gc/portalI18n'
import { customerPageModel, type CustomerHomeMove, type PortalGcPage as Page } from '../../lib/portal/customerPage'
import type { MoneyCard } from '../../lib/portal/moneyStory'
import { CODE_WORDS, wordsWith, type PageWords, type PortalLang } from '../../lib/portal/pageWords'
import type { PortalGcJob, PortalPayload } from '../../lib/portal/portalPayload'
import { CARD, COPPER, HAIR, INK, MUTED, PAPER, PAPER_GREEN } from '../../lib/portal/portalTheme'
import { sampleStateFromToken } from '../../lib/customerSampleMode'
import { staffAwarePublicHeaders } from '../../lib/publicFunctionStaffHeaders'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { AcceptWork, ChangeOrderRow, OurContract } from './PortalGcForms'
import { PortalGcSchedule } from './PortalGcSchedule'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

type Tab = 'home' | 'money' | 'schedule' | 'papers'
const TABS: { tab: Tab; key: 'tabHome' | 'tabMoney' | 'tabSchedule' | 'tabPapers' }[] = [
  { tab: 'home', key: 'tabHome' },
  { tab: 'money', key: 'tabMoney' },
  { tab: 'schedule', key: 'tabSchedule' },
  { tab: 'papers', key: 'tabPapers' },
]

/** A paper opened on the page, for the office's read-back: one quiet request, never in a sample. */
function paperOpened(token: string, kind: 'contract' | 'change_order' | 'pay_app', id: string): void {
  if (!token || sampleStateFromToken(token)) return
  void (async () => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/customer-portal?token=${encodeURIComponent(token)}&paper=${kind}:${encodeURIComponent(id)}`, { headers: await staffAwarePublicHeaders() })
    } catch {
      // The read-back misses one open; the page never shows it.
    }
  })()
}

const card: CSSProperties = { border: `1px solid ${HAIR}`, borderRadius: 8, background: CARD, padding: '10px 12px', display: 'grid', gap: 6 }
const moveCard: CSSProperties = { ...card, borderColor: COPPER, borderWidth: 2 }
const heading: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUTED }
const solid: CSSProperties = { background: COPPER, color: '#fff', border: 'none', borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const plain: CSSProperties = { background: CARD, color: INK, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '0.45rem 0.9rem', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const fold: CSSProperties = { background: 'none', border: 'none', padding: 0, color: INK, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontSize: 13 }
const line: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }

function YourMove({ lang, move, words, onPapers }: { lang: PortalLang; move: CustomerHomeMove; words: PageWords; onPapers: () => void }) {
  const title = words.say(lang, 'yourMoveTitle')
  if (move.kind === 'none' || move.kind === 'off') {
    return (
      <div data-testid="portal-gc-move" style={card}>
        <div style={heading}>{title}</div>
        <div style={{ color: INK }}>{move.line}</div>
      </div>
    )
  }
  const sub = move.kind === 'change' ? move.detail.join(' · ') : move.sub
  const due = move.kind === 'paper' ? move.due : null
  return (
    <div data-testid="portal-gc-move" style={moveCard}>
      <div style={heading}>{title}</div>
      <div style={{ fontWeight: 700, color: INK }}>{due ? `${move.title} · ${due}` : move.title}</div>
      {sub && <div style={{ color: MUTED, fontSize: 12 }}>{sub}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {move.buttons.map((b) => (
          <button key={b.label} type="button" onClick={onPapers} style={b.primary ? solid : plain}>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PayAppCard({ c, billUrl, onRead }: { c: Extract<MoneyCard, { kind: 'payApp' }>; billUrl: string | null; onRead: () => void }) {
  return (
    <div data-testid={`portal-gc-payapp-${c.n}`} style={c.open ? moveCard : card}>
      <div style={line}>
        <span style={heading}>{`${c.title} · ${c.month}`}</span>
        {c.pill && <span style={{ color: PAPER_GREEN, fontWeight: 700, fontSize: 12 }}>{c.pill}</span>}
      </div>
      <div style={line}>
        <span style={{ fontWeight: 700, color: INK }}>{c.covers}</span>
        <span style={{ fontWeight: c.open ? 700 : 500, color: INK }}>{c.amount}</span>
      </div>
      <div style={{ display: 'grid', gap: 2, fontSize: 12 }}>
        {c.checks.map((k) => (
          <span key={k.words} style={{ color: k.mark === 'done' ? PAPER_GREEN : INK, fontWeight: k.mark === 'strong' ? 700 : 400 }}>
            {k.mark === 'done' ? `✓ ${k.words}` : k.words}
          </span>
        ))}
      </div>
      {billUrl && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {c.buttons
            .filter((b) => b.press !== 'waivers')
            .map((b) => (
              <a key={b.label} href={billUrl} target="_blank" rel="noreferrer" onClick={onRead} style={{ ...(b.primary ? solid : plain), textDecoration: 'none' }}>
                {b.label}
              </a>
            ))}
        </div>
      )}
    </div>
  )
}

export function PortalGcPage({ token, job, page, payload, formatUsd }: { token: string; job: PortalGcJob; page: Page; payload: PortalPayload; formatUsd: (n: number) => string }) {
  const [tab, setTab] = useState<Tab>('home')
  const [chosen, setChosen] = useState<PortalLang>('en')
  const [showOlder, setShowOlder] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [statementOpen, setStatementOpen] = useState(false)
  const spanish = page.switches.spanish && portalShownLang('es') === 'es'
  const lang: PortalLang = spanish ? chosen : 'en'
  const words = useMemo(() => (payload.pageWords.length ? wordsWith(payload.pageWords) : CODE_WORDS), [payload.pageWords])
  const today = todayYmdInAppTz()
  const model = useMemo(
    () =>
      customerPageModel(
        lang,
        {
          job,
          page,
          bills: payload.bills,
          waivers: payload.waivers,
          cardFeePct: payload.cardBills.length ? GC_CARD_FEE_PCT : null,
          company: { name: payload.company.name, phone: payload.company.phone },
          today,
        },
        { showOlder, words },
      ),
    [lang, job, page, payload, today, showOlder, words],
  )
  const billUrlOf = (n: number): string | null => {
    const app = page.payApps.find((a) => a.number === n)
    return app?.invoiceId ? (payload.bills.find((b) => b.invoiceId === app.invoiceId)?.payUrl ?? null) : null
  }
  const appIdOf = (n: number): string | null => page.payApps.find((a) => a.number === n)?.id ?? null

  return (
    <div data-testid="portal-gc-page" style={{ border: `1px solid ${HAIR}`, borderRadius: 8, background: PAPER, padding: '10px 12px', display: 'grid', gap: 10, fontSize: 13, color: INK }}>
      <div style={line}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{job.name}</div>
          <div style={{ color: MUTED, fontSize: 12 }}>{words.say(lang, 'withCompany', { company: payload.company.name })}</div>
        </div>
        {spanish && (
          <button type="button" onClick={() => setChosen(lang === 'en' ? 'es' : 'en')} style={plain}>
            {words.say(lang, 'switchLang')}
          </button>
        )}
      </div>
      <div role="tablist" aria-label={job.name} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: `1px solid ${HAIR}`, paddingBottom: 6 }}>
        {TABS.map((t) => (
          <button
            key={t.tab}
            type="button"
            role="tab"
            aria-selected={tab === t.tab}
            data-testid={`portal-gc-tab-${t.tab}`}
            onClick={() => setTab(t.tab)}
            style={{ ...plain, padding: '0.3rem 0.7rem', borderColor: tab === t.tab ? COPPER : HAIR, color: tab === t.tab ? COPPER : INK }}
          >
            {words.say(lang, t.key)}
          </button>
        ))}
      </div>

      {tab === 'home' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <YourMove lang={lang} move={model.move} words={words} onPapers={() => setTab('papers')} />
          {model.week && (
            <div data-testid="portal-gc-week" style={card}>
              <div style={heading}>{model.week.title}</div>
              <div>{model.week.line}</div>
              {model.week.photosUrl && (
                <a href={model.week.photosUrl} target="_blank" rel="noreferrer" style={{ color: COPPER, fontWeight: 700 }}>
                  {words.say(lang, 'seePhotos')}
                </a>
              )}
              <div style={{ color: MUTED, fontSize: 12 }}>{model.week.note}</div>
            </div>
          )}
          <div data-testid="portal-gc-people" style={card}>
            <div style={heading}>{words.say(lang, 'peopleTitle')}</div>
            {model.people.map((p) => (
              <div key={`${p.name}-${p.role}`} style={line}>
                <span>
                  <b>{p.name}</b> <span style={{ color: MUTED }}>{p.role}</span>
                </span>
                {p.phone && (
                  <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} style={{ color: COPPER }}>
                    {p.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'money' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div data-testid="portal-gc-money-header" style={card}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{model.money.header.big}</div>
            <div style={{ color: MUTED, fontSize: 12 }}>{model.money.header.small.join(' · ')}</div>
            <div style={{ height: 6, borderRadius: 3, background: HAIR, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, model.money.header.pct))}%`, height: '100%', background: PAPER_GREEN }} />
            </div>
            <div style={{ color: PAPER_GREEN, fontSize: 12 }}>{`✓ ${model.money.header.check}`}</div>
          </div>
          {model.money.header.howPay && (
            <div style={card}>
              <div style={heading}>{model.money.header.howPay.title}</div>
              <div>{model.money.header.howPay.words}</div>
            </div>
          )}
          {model.money.cards.map((c, i) => {
            if (c.kind === 'payApp') {
              const id = appIdOf(c.n)
              return <PayAppCard key={`app-${c.n}`} c={c} billUrl={billUrlOf(c.n)} onRead={() => id && paperOpened(token, 'pay_app', id)} />
            }
            if (c.kind === 'after') {
              return (
                <div key={`after-${i}`} style={card}>
                  <div style={heading}>{c.title}</div>
                  {c.rows.map((r) => (
                    <div key={r.title}>
                      <b>{`${r.title} · ${r.month}`}</b>
                      <div style={{ color: MUTED, fontSize: 12 }}>{r.words}</div>
                    </div>
                  ))}
                  <div style={{ color: MUTED, fontSize: 12 }}>{c.note}</div>
                </div>
              )
            }
            if (c.kind === 'changes') {
              return (
                <div key={`changes-${i}`} data-testid="portal-gc-money-changes" style={moveCard}>
                  <div style={heading}>{c.title}</div>
                  {c.rows.map((r) => (
                    <div key={r.title} style={line}>
                      <span>{r.detail ? `${r.title} · ${r.detail}` : r.title}</span>
                      <span style={{ color: COPPER, fontWeight: 700 }}>{r.amount}</span>
                    </div>
                  ))}
                  <div style={{ color: MUTED, fontSize: 12 }}>{c.note}</div>
                </div>
              )
            }
            return (
              <button key={`older-${i}`} type="button" onClick={() => setShowOlder(true)} style={{ ...fold, fontWeight: 600, color: MUTED }}>
                {`${c.words} ›`}
              </button>
            )
          })}
          <div style={card}>
            <button type="button" onClick={() => setHistoryOpen(!historyOpen)} style={fold} aria-expanded={historyOpen}>
              {`${model.money.history.title} ${historyOpen ? '▾' : '›'}`}
            </button>
            {historyOpen && (
              <div data-testid="portal-gc-history" style={{ display: 'grid', gap: 6 }}>
                {model.money.history.events.map((e, i) => (
                  <div key={`${e.title}-${i}`} style={{ color: e.kind === 'next' ? MUTED : INK }}>
                    <div style={line}>
                      <b>{e.title}</b>
                      {e.amount && <span>{e.amount}</span>}
                    </div>
                    {e.sub.length > 0 && <div style={{ color: MUTED, fontSize: 12 }}>{e.sub.join(' · ')}</div>}
                  </div>
                ))}
                <div style={{ ...line, borderTop: `1px solid ${HAIR}`, paddingTop: 6 }}>
                  <span>{model.money.history.investedSoFar.label}</span>
                  <span>{model.money.history.investedSoFar.amount}</span>
                </div>
                <div style={line}>
                  <span>{model.money.history.toFinish.label}</span>
                  <span>{model.money.history.toFinish.amount}</span>
                </div>
              </div>
            )}
          </div>
          <div data-testid="portal-gc-statement" style={card}>
            <button type="button" onClick={() => setStatementOpen(!statementOpen)} style={fold} aria-expanded={statementOpen}>
              {`${model.money.statement.title} ${statementOpen ? '▾' : '›'}`}
            </button>
            {(statementOpen ? model.money.statement.rows : model.money.statement.rows.slice(0, 2)).map((r) => (
              <div key={r.label} style={{ ...line, fontWeight: r.sum ? 700 : 400, borderTop: r.sum ? `1px solid ${HAIR}` : undefined, paddingTop: r.sum ? 4 : 0 }}>
                <span>{r.count !== undefined ? `${r.label} (${r.count})` : r.label}</span>
                <span>{r.amount}</span>
              </div>
            ))}
          </div>
          <div style={{ color: MUTED, fontSize: 12 }}>{model.money.payNote}</div>
        </div>
      )}

      {tab === 'schedule' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {job.schedule && <PortalGcSchedule schedule={job.schedule} />}
          <div data-testid="portal-gc-moved" style={card}>
            <div style={heading}>{words.say(lang, 'whatMoved')}</div>
            {model.moves.length ? (
              model.moves.map((m, i) => (
                <div key={`${m.activity}-${i}`} style={line}>
                  <span>
                    {m.activity}
                    <span style={{ display: 'block', color: MUTED, fontSize: 12 }}>{m.why}</span>
                  </span>
                  <span>{m.when}</span>
                </div>
              ))
            ) : (
              <div style={{ color: MUTED }}>{words.say(lang, 'nothingMoved')}</div>
            )}
          </div>
        </div>
      )}

      {tab === 'papers' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div data-testid="portal-gc-signed" style={card}>
            <div style={heading}>{model.papers.signed.title}</div>
            {model.papers.signed.empty && <div style={{ color: MUTED }}>{model.papers.signed.empty}</div>}
            {model.papers.signed.rows.map((r) => (
              <div key={`${r.title}-${r.detail ?? ''}`}>
                <div>
                  <span style={{ color: PAPER_GREEN }}>✓ </span>
                  {r.detail ? `${r.title} · ${r.detail}` : r.title}
                </div>
                <div style={{ color: MUTED, fontSize: 12 }}>{r.sub.join(' · ')}</div>
              </div>
            ))}
          </div>
          {(job.contract?.state === 'toSign' || job.changeOrders.length > 0 || job.canAccept) && (
            <div data-testid="portal-gc-waiting" style={moveCard}>
              <div style={heading}>{words.say(lang, 'waitingOnYou')}</div>
              {job.contract?.state === 'toSign' && (
                <OurContract token={token} job={job} contract={job.contract} formatUsd={formatUsd} onOpen={() => job.contract?.state === 'toSign' && paperOpened(token, 'contract', job.contract.sendId)} />
              )}
              {job.changeOrders.map((co) => (
                <ChangeOrderRow key={co.id} token={token} co={co} formatUsd={formatUsd} onOpen={() => paperOpened(token, 'change_order', co.id)} />
              ))}
              {job.canAccept && <AcceptWork token={token} job={job} />}
            </div>
          )}
          {model.papers.later && (
            <div style={card}>
              <div style={heading}>{model.papers.later.title}</div>
              {model.papers.later.rows.map((r) => (
                <div key={r.title}>
                  {r.title}
                  <span style={{ display: 'block', color: MUTED, fontSize: 12 }}>{r.when}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ color: MUTED, fontSize: 12 }}>{model.papers.footer}</div>
        </div>
      )}
    </div>
  )
}

export default PortalGcPage
