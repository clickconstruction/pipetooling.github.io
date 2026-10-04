import {
  bidTabRows,
  bidTabsOpen,
  bidsIn,
  money,
  packageHasTab,
  shortDate,
  type BidTabRow,
  type GcProject,
  type TradePackage,
} from '../../lib/gcMode/gcModel'
import type { GcPaneProps } from './GcOfficeTabs'
import { usePortalLang } from './gcPortalLang'
import { Btn, Card, Chip, Why, num, td, th } from './gcUi'

/** The table's words in the portal's language (the Portal lane's, PORTAL_SPANISH.md). */
const TAB_WORDS = {
  en: { rank: 'Rank', company: 'Company', quote: 'Quote', overLow: 'Over the low', low: 'low', you: '(you)', awarded: 'awarded', another: 'Another company' },
  es: { rank: 'Lugar', company: 'Empresa', quote: 'Cotización', overLow: 'Arriba de la más baja', low: 'la más baja', you: '(usted)', awarded: 'adjudicada', another: 'Otra empresa' },
} as const

/**
 * GC mode design spike: bid tabs. After our bid is in, every company that quoted a trade gets
 * that trade's quotes back, low to high, with its own row marked. Names are hidden unless the
 * office says to show them. The office reads one table per trade. A company reads its own copy
 * in its portal.
 */

/** The tab as one company reads it. viewerId null is the office's own read: every name shows. */
export function BidTabTable({ rows, viewerId, showNames }: { rows: BidTabRow[]; viewerId: string | null; showNames: boolean }) {
  // 'en' everywhere outside the portal, so the office's own read stays English.
  const w = TAB_WORDS[usePortalLang().lang]
  // A company's own read sits in a narrow portal block (about 283 px on a phone): tighter cells,
  // no Rank column (the order already ranks them and their row is marked), and "la más baja" may
  // wrap. The office's read keeps every column.
  const compact = viewerId !== null
  const pad = compact ? { padding: '0.35rem 0.3rem' } : null
  const head = { ...th, ...pad, whiteSpace: 'normal' } as const
  const cell = { ...td, ...pad }
  const money_ = { ...num, ...pad }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {/* Headers wrap so the table fits a phone, even in Spanish ("Arriba de la más baja"); the numbers stay on one line. */}
          {!compact && <th style={head}>{w.rank}</th>}
          <th style={head}>{w.company}</th>
          <th style={{ ...head, textAlign: 'right' }}>{w.quote}</th>
          <th style={{ ...head, textAlign: 'right' }}>{w.overLow}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const mine = r.partnerId === viewerId
          const name = viewerId === null || showNames || mine ? r.company : w.another
          return (
            <tr key={r.partnerId} style={{ background: mine ? 'var(--bg-amber-100)' : undefined, fontWeight: mine ? 700 : 400 }}>
              {!compact && <td style={cell}>{r.rank}</td>}
              <td style={cell}>
                {name}
                {mine ? ` ${w.you}` : ''} {r.awarded && <Chip tone="green">{w.awarded}</Chip>}
              </td>
              <td style={money_}>{money(r.amount)}</td>
              <td style={r.rank === 1 ? { ...money_, whiteSpace: 'normal' } : money_}>{r.rank === 1 ? w.low : `${r.overLowPct}%`}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function GcBidTabsTab({ state, project, dispatch, onSeePortal }: GcPaneProps) {
  const open = bidTabsOpen(project)
  const withTab = project.packages.filter(packageHasTab)
  const thin = project.packages.filter((p) => !p.selfPerform && bidsIn(p).length < 2)

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <Why>
        A bid tab gives each company that quoted a trade the quotes on that trade, low to high, with its own row
        marked. It is the thanks for bidding. A company that sees where it stood answers the next time we ask.
      </Why>

      {!open && (
        <Card style={{ background: 'var(--bg-amber-tint)' }}>
          <strong>Bid tabs open once our bid is in.</strong> Before then a tab would show one company another
          company&rsquo;s price while they can still change their own.
          <div style={{ marginTop: '0.5rem' }}>
            <Btn kind="primary" onClick={() => dispatch({ type: 'markBidSent', projectId: project.id })}>
              We sent our bid to {project.owner}
            </Btn>
          </div>
        </Card>
      )}

      {withTab.map((pkg) => (
        <TabCard key={pkg.id} state={state} project={project} pkg={pkg} dispatch={dispatch} open={open} onSeePortal={onSeePortal} />
      ))}

      {thin.length > 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No tab for {thin.map((p) => p.trade).join(', ')}: a tab needs two quotes.
        </div>
      )}
    </div>
  )
}

/** What every company is told beside its tab, said once for the office. */
function outcomeWords(project: GcProject, pkg: TradePackage): string {
  if (project.stage === 'pursuing') return 'Each company also reads that our bid is in and the customer has not picked a builder yet.'
  if (pkg.awardedInviteId === null) return 'Each company also reads that we won the project and this trade is not awarded yet.'
  return 'Each company also reads how it came out: the winner that the trade is theirs, the rest that it went to another company.'
}

/**
 * One trade, one table. The office reads every name. What a company sees differs in one way only
 * (the other names), so that is said in a line under the table, and the real thing is one press
 * away in their portal. Nothing is drawn twice.
 */
function TabCard({
  state,
  project,
  pkg,
  dispatch,
  open,
  onSeePortal,
}: GcPaneProps & { pkg: TradePackage; open: boolean }) {
  const rows = bidTabRows(state, pkg)
  const tab = pkg.bidTab
  const showNames = tab?.showNames ?? false
  const first = rows[0]
  const ids = { projectId: project.id, packageId: pkg.id }

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '0.7rem 1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        <strong>{pkg.trade}</strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {rows.length} quotes · low {first ? money(first.amount) : ''}
        </span>
        {tab ? (
          <Chip tone="green">shared {shortDate(tab.sharedOn)}</Chip>
        ) : (
          <Chip tone={open ? 'amber' : 'grey'}>{open ? 'not shared yet' : 'waits for our bid'}</Chip>
        )}
        <span style={{ flex: 1 }} />
        {tab && (
          <label style={{ fontSize: '0.85rem', display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
            <input type="checkbox" checked={showNames} onChange={(e) => dispatch({ type: 'shareBidTab', ...ids, showNames: e.target.checked })} />
            Show company names to each other
          </label>
        )}
        {!tab && (
          <Btn kind="primary" disabled={!open} onClick={() => dispatch({ type: 'shareBidTab', ...ids, showNames: false })}>
            Share with the {rows.length} who quoted
          </Btn>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Rank</th>
              <th style={th}>Company</th>
              <th style={{ ...th, textAlign: 'right' }}>Quote</th>
              <th style={{ ...th, textAlign: 'right' }}>Over the low</th>
              <th style={th}>Their copy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.partnerId}>
                <td style={td}>{r.rank}</td>
                <td style={td}>
                  {r.company}{' '}
                  {/* Our copy names the estimator who awarded it (question 7); the trades' copies say only "awarded". */}
                  {r.awarded && <Chip tone="green">{pkg.awardedBy ? `awarded by ${pkg.awardedBy}` : 'awarded'}</Chip>}
                </td>
                <td style={num}>{money(r.amount)}</td>
                <td style={num}>{r.rank === 1 ? 'low' : `${r.overLowPct}%`}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {!tab ? (
                    <span style={{ color: 'var(--text-muted)' }}>not sent</span>
                  ) : (
                    <>
                      <Chip tone={tab.seenBy.includes(r.partnerId) ? 'green' : 'amber'}>
                        {tab.seenBy.includes(r.partnerId) ? 'opened' : 'not opened yet'}
                      </Chip>{' '}
                      {onSeePortal && <Btn kind="quiet" onClick={() => onSeePortal(r.partnerId)}>See it as them</Btn>}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', color: 'var(--text-600)' }}>
        {showNames
          ? 'Each company sees every name, with its own row marked.'
          : 'Each company sees its own row marked. The other rows read "Another company".'}{' '}
        {outcomeWords(project, pkg)}
      </div>
    </Card>
  )
}
