import { useEffect, useRef, useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { portalAsks, portalFirstVisit } from '../../lib/gc/portal'
import { pt, pWeekday, type PortalLang } from '../../lib/gc/portalI18n'
import { askChips, askWhen, pastWords, paperworkLineOf, portalHomeGroups, portalHomeTodos, type PaperworkLine, type SentMessage } from '../../lib/gc/tradePortalPage'
import type { PortalAsk, PortalTodo } from '../../lib/gc/portal'
import type { PortalSchedule } from '../../lib/gc/schedule/portalSchedule'
import type { GcState, Partner } from '../../lib/gc/types'
import { HAIR, INK, MUTED, PAPER, PORTAL_FONT } from '../../lib/portal/portalTheme'
import { Btn, Chip } from './gcUi'
import { GcTradePortalProject } from './GcTradePortalProject'
import { PortalLangContext, usePortalLang } from './gcTradePortalLang'
import { usePortalPress, usePress } from './gcTradePortalPress'
import { GcTradePortalPeople } from './GcTradePortalPeople'
import { GcTradePortalPaperwork, GcTradePortalPapersPage } from './GcTradePortalPapers'
import { PortalBlock, PortalNote, PortalRow } from './GcTradePortalUi'

/**
 * GC mode, the trade partner portal (P1b-ii-b, to-dos/gc-mode/PORTAL_REAL_BUILD.md): what one company sees at its
 * link, read only, from the design spike's `GcTradePortal.tsx`, `GcPortalHome.tsx` and `GcPortalMessages.tsx`. One
 * link per company: it opens on the company's home (its asks, who gets our emails, its paperwork with us, what came
 * before), a row opens that project's page, Your papers lists every paper it signed with us (P5b-1), and Messages lists
 * what we sent it as it went. Drawn for a phone first.
 */

const GC = GC_COMPANY.shortName

export function GcTradePortalView({
  state,
  partnerId,
  lang,
  messages,
  planUrl,
  banner,
  schedules = {},
}: {
  state: GcState
  partnerId: string
  lang: PortalLang
  messages: SentMessage[]
  /** The Drive link of a project's set by its number; empty when it has none. */
  planUrl: (projectId: string, rev: number) => string
  /** A line above the page: the sample, or the office's preview. */
  banner?: string
  /** The company's chart on each job being built, by the job's id (the schedule's PR 14b). */
  schedules?: Record<string, PortalSchedule>
}) {
  const partner = state.partners.find((p) => p.id === partnerId)
  const [viewId, setViewId] = useState<string | null>(null)
  const [screen, setScreen] = useState<'portal' | 'messages' | 'papers'>('portal')
  // A to-do lands on its block of the project page (P5c-3c-i): the block's data-portal-anchor, once the page is drawn.
  const [anchor, setAnchor] = useState<string | null>(null)
  const top = useRef<HTMLDivElement | null>(null)
  const shown = viewId === null ? null : (state.projects.find((p) => p.id === viewId) ?? null)
  const go = (id: string | null, at?: string) => {
    setViewId(id)
    setScreen('portal')
    setAnchor(at ?? null)
    const box = top.current?.getBoundingClientRect()
    if (box && box.top < 0) top.current?.scrollIntoView({ block: 'start' })
  }
  useEffect(() => {
    if (!anchor || !shown) return
    top.current?.querySelector(`[data-portal-anchor="${anchor}"]`)?.scrollIntoView?.({ block: 'start' })
    setAnchor(null)
  }, [anchor, shown])
  if (!partner) return null
  const tab = (key: 'portal' | 'messages', label: string) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={screen === key}
      onClick={() => setScreen(key)}
      style={{
        flex: 1,
        minHeight: 36,
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
  )
  return (
    <PortalLangContext.Provider value={lang}>
      <div
        ref={top}
        data-theme="light"
        lang={lang}
        style={{ background: PAPER, color: INK, fontFamily: PORTAL_FONT, border: `1px solid ${INK}`, borderRadius: 10, overflow: 'hidden', width: '100%', maxWidth: 520, marginInline: 'auto' }}
      >
        <header style={{ background: INK, color: PAPER, padding: '0.7rem 0.9rem' }}>
          <div style={{ fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8 }}>
            {GC_COMPANY.name} · {pt(lang, 'letterhead')}
          </div>
          <div style={{ marginTop: '0.3rem', fontSize: '1rem', fontWeight: 600 }}>{partner.company}</div>
          <div role="tablist" aria-label={partner.company} style={{ display: 'flex', gap: '0.3rem', marginTop: '0.45rem' }}>
            {tab('portal', pt(lang, 'navPortal'))}
            {tab('messages', pt(lang, 'navMessages', { gc: GC }))}
          </div>
        </header>
        {banner && <div style={{ padding: '0.45rem 0.9rem', borderBottom: `1px solid ${HAIR}`, fontSize: '0.8rem', background: 'var(--bg-amber-100)' }}>{banner}</div>}
        {screen === 'messages' ? (
          <div style={{ padding: '0.9rem' }}>
            <Messages partner={partner} messages={messages} onOpenPortal={() => go(null)} />
          </div>
        ) : screen === 'papers' ? (
          <GcTradePortalPapersPage state={state} partner={partner} onHome={() => go(null)} onOpenProject={(id) => go(id)} />
        ) : shown ? (
          <GcTradePortalProject project={shown} partner={partner} today={state.today} planUrl={(rev) => planUrl(shown.id, rev)} onHome={() => go(null)} schedule={schedules[shown.id] ?? null} />
        ) : (
          <div style={{ padding: '0.9rem' }}>
            <Home state={state} partner={partner} onOpenProject={go} onPapers={() => setScreen('papers')} />
          </div>
        )}
      </div>
    </PortalLangContext.Provider>
  )
}

/** The company's home: hello, its asks still open, who gets our emails, and what came before. */
function Home({ state, partner, onOpenProject, onPapers }: { state: GcState; partner: Partner; onOpenProject: (id: string, anchor?: string) => void; onPapers: () => void }) {
  const { lang, t } = usePortalLang()
  const asks = portalAsks(state, partner.id)
  const { jobs, bidding, past } = portalHomeGroups(asks)
  const todos = portalHomeTodos(state, partner.id, asks, lang)
  const press = usePortalPress()
  // The paperwork line a to-do opened (P5b-1): its block scrolls into view, and the vetting form opens.
  const [paperLine, setPaperLine] = useState<PaperworkLine | null>(null)
  const paperwork = useRef<HTMLDivElement | null>(null)
  const openTodo = (todo: PortalTodo) => {
    if (todo.projectId) {
      onOpenProject(todo.projectId, todo.anchor)
      return
    }
    setPaperLine(paperworkLineOf(todo.key))
    paperwork.current?.scrollIntoView?.({ block: 'start' })
  }
  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      {press && portalFirstVisit(state, partner.id) ? (
        <Welcome partner={partner} firstAsk={bidding[0]} />
      ) : (
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('hello', { name: partner.contact || partner.company })}</div>
          <div style={{ fontSize: '0.85rem', color: MUTED }}>{t('homeIntro', { company: partner.company, gc: GC_COMPANY.name })}</div>
        </div>
      )}
      <NeedsYou todos={todos} onOpen={openTodo} />
      {jobs.length > 0 && (
        <PortalBlock title={`${t('yourJobs')} · ${jobs.length}`}>
          <div style={{ display: 'grid' }}>
            {jobs.map((ask, i) => (
              <PortalRow key={ask.invite.id} first={i === 0} onClick={() => onOpenProject(ask.project.id)}>
                <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.2rem' }}>
                  <strong>{ask.project.name}</strong>
                  <span style={{ color: MUTED }}>{ask.pkg.trade}</span>
                </span>
              </PortalRow>
            ))}
          </div>
        </PortalBlock>
      )}
      <PortalBlock title={bidding.length > 0 ? `${t('askedToBid')} · ${bidding.length}` : t('askedToBid')}>
        {bidding.length === 0 ? (
          <div style={{ fontSize: '0.9rem' }}>{t('nothingNeeds')}</div>
        ) : (
          <div style={{ display: 'grid' }}>
            {bidding.map((ask, i) => (
              <PortalRow key={ask.invite.id} first={i === 0} onClick={() => onOpenProject(ask.project.id)}>
                <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.2rem' }}>
                  <strong>{ask.project.name}</strong>
                  <span style={{ color: MUTED }}>{ask.pkg.trade}</span>
                  <span style={{ fontSize: '0.85rem' }}>{askWhen(ask, state.today, lang)}</span>
                  <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {askChips(ask, lang).map((c) => (
                      <Chip key={c.words} tone={c.tone}>
                        {c.words}
                      </Chip>
                    ))}
                  </span>
                </span>
              </PortalRow>
            ))}
          </div>
        )}
      </PortalBlock>
      <div ref={paperwork} data-portal-anchor="paperwork" style={{ scrollMarginTop: '0.5rem' }}>
        <GcTradePortalPaperwork partner={partner} today={state.today} open={paperLine} onOpen={setPaperLine} onPapers={onPapers} />
      </div>
      <GcTradePortalPeople partner={partner} />
      {past.length > 0 && (
        <PortalBlock title={t('before')}>
          <div style={{ display: 'grid' }}>
            {past.map((ask, i) => (
              <PortalRow key={ask.invite.id} first={i === 0} onClick={() => onOpenProject(ask.project.id)}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem' }}>
                  {ask.project.name} · {ask.pkg.trade} · {pastWords(ask, lang)}
                </span>
              </PortalRow>
            ))}
          </div>
        </PortalBlock>
      )}
    </div>
  )
}

const DOT: Record<PortalTodo['tone'], string> = {
  red: 'var(--text-red-700)',
  amber: 'var(--text-amber-700)',
  plain: 'var(--text-muted)',
}

/**
 * Needs you (P5c-3c-i, the spike's `GcPortalHome.tsx`): what is the company's to do, red first, each opening its project
 * at its block. Company paperwork has no project: it opens the home's paperwork block at its line (P5b-1).
 */
function NeedsYou({ todos, onOpen }: { todos: PortalTodo[]; onOpen: (todo: PortalTodo) => void }) {
  const { t } = usePortalLang()
  return (
    <PortalBlock title={todos.length > 0 ? `${t('needsYou')} · ${todos.length}` : t('needsYou')}>
      {todos.length === 0 ? (
        <div style={{ fontSize: '0.9rem' }}>{t('nothingNeeds')}</div>
      ) : (
        <div style={{ display: 'grid' }}>
          {todos.map((todo, i) => {
            const words = (
              <>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: DOT[todo.tone], flexShrink: 0, marginTop: '0.4rem' }} />
                <span style={{ flex: 1, fontWeight: todo.tone === 'red' ? 600 : 400 }}>{todo.text}</span>
              </>
            )
            return (
              <PortalRow key={todo.key} first={i === 0} onClick={() => onOpen(todo)}>
                {words}
              </PortalRow>
            )
          })}
        </div>
      )}
    </PortalBlock>
  )
}

/** The first time a company opens its link: who we are, what this page is, and the three things to know (the spike's Welcome). */
function Welcome({ partner, firstAsk }: { partner: Partner; firstAsk: PortalAsk | undefined }) {
  const { t } = usePortalLang()
  const { busy, problem, run } = usePress()
  const name = partner.contact.split(' ')[0] || partner.company
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
        {problem && <div style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>{problem}</div>}
        <div>
          <Btn kind="primary" disabled={busy} onClick={() => void run('got_it')}>
            {t('gotIt')}
          </Btn>
        </div>
      </div>
    </PortalBlock>
  )
}

/** What we sent the company, newest first, as it went. The newest is open. */
function Messages({ partner, messages, onOpenPortal }: { partner: Partner; messages: SentMessage[]; onOpenPortal: () => void }) {
  const { lang, t } = usePortalLang()
  const [openId, setOpenId] = useState<string | null>(messages[0]?.id ?? null)
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ fontSize: '0.85rem', color: MUTED }}>{t('messagesIntro', { gc: GC_COMPANY.name, company: partner.company })}</div>
      {messages.length === 0 && <div style={{ fontSize: '0.9rem' }}>{t('nothingSent')}</div>}
      {messages.map((m) =>
        m.id === openId ? (
          <article key={m.id} style={{ background: 'var(--surface)', border: `1px solid ${HAIR}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '0.55rem 0.75rem', borderBottom: `1px solid ${HAIR}`, fontSize: '0.78rem', display: 'grid', gap: '0.1rem' }}>
              <span>
                <strong>{GC_COMPANY.name}</strong> <span style={{ color: MUTED }}>· {pWeekday(lang, m.on)}</span>
              </span>
              {m.to.length > 0 && <span style={{ color: MUTED }}>{t('sentTo', { names: m.to.join(', ') })}</span>}
              <span style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>{m.subject}</span>
            </div>
            <div style={{ padding: '0.7rem 0.75rem', display: 'grid', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.45 }}>
              {m.lines.map((line, i) =>
                typeof line === 'string' ? (
                  <div key={i}>{line}</div>
                ) : (
                  <div key={i}>
                    {line.title && <div>{line.title}</div>}
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.15rem' }}>
                      {line.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
              <div>
                <button
                  type="button"
                  onClick={onOpenPortal}
                  style={{ minHeight: 40, padding: '0.35rem 0.9rem', borderRadius: 6, border: 'none', background: INK, color: PAPER, fontWeight: 600, cursor: 'pointer' }}
                >
                  {t('openPortal')}
                </button>
              </div>
            </div>
          </article>
        ) : (
          <button
            key={m.id}
            type="button"
            onClick={() => setOpenId(m.id)}
            style={{ display: 'grid', gap: '0.15rem', textAlign: 'left', width: '100%', minHeight: 44, padding: '0.55rem 0.7rem', background: 'var(--surface)', border: `1px solid ${HAIR}`, borderRadius: 8, color: 'inherit', cursor: 'pointer', fontSize: '0.88rem' }}
          >
            <span style={{ fontSize: '0.75rem', color: MUTED }}>
              {GC_COMPANY.name} · {pWeekday(lang, m.on)}
            </span>
            <span style={{ fontWeight: 600 }}>{m.subject}</span>
          </button>
        ),
      )}
      <PortalNote tone="paper">{t('linkYours')}</PortalNote>
    </div>
  )
}
