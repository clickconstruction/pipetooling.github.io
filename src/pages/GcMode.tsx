import { useEffect, useReducer, useState, type CSSProperties } from 'react'
import { SpotlightTour } from '../components/SpotlightTour'
import { BidsModeToggle } from '../components/gc/BidsModeToggle'
import {
  GcContractsTab,
  GcDrawsTab,
  GcNumberTab,
  GcPackagesTab,
  GcPlansTab,
} from '../components/gc/GcOfficeTabs'
import { GcFollowUpTab } from '../components/gc/GcAskThread'
import { GcOwnerBillingTab } from '../components/gc/GcOwnerBillingTab'
import { GcCloseoutTab } from '../components/gc/GcCloseout'
import { GcBuildingScheduleBlock, GcBuildingScheduleTab } from '../components/gc/GcBuildingSchedule'
import { GcBuildingLogTab } from '../components/gc/GcBuildingLog'
import { GcBuildingSubmittalsTab } from '../components/gc/GcBuildingSubmittals'
import { GcBidTabsTab } from '../components/gc/GcBidTabs'
import { GcCustomerWindow } from '../components/gc/GcCustomerWindow'
import { GcPlansQuickLook } from '../components/gc/GcPlansQuickLook'
import { GcNewProjectButton } from '../components/gc/GcNewProject'
import { GcPartnersBoard } from '../components/gc/GcTradeBench'
import { GcOwnerBillingMoney } from '../components/gc/GcOwnerBillingMoney'
import { GcStartTab } from '../components/gc/GcStart'
import { GcTradeMap } from '../components/gc/GcTradeMap'
import { GcTradePortal } from '../components/gc/GcTradePortal'
import { GC_ICON_PATHS } from '../components/gc/gcIcons'
import { GcProgressRing } from '../components/gc/GcProgressRing'
import { Btn, Card, Chip, PlusUnknown, Stat, type Tone } from '../components/gc/gcUi'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  carriedAmount,
  carriedUncosted,
  customerGroups,
  customerMoneyWords,
  quoteRanOut,
  isGuess,
  currentRev,
  daysUntil,
  followUps,
  gcReducer,
  initialGcState,
  money,
  lostWords,
  planLabel,
  priceToOwner,
  promisesToChase,
  proposalUncostedWords,
  RING_COLORS,
  sentBackOpen,
  timesSentBack,
  plansReach,
  proposalTotals,
  shortDate,
  stageProgress,
  weekdayDate,
  type BoardGroupBy,
  type StageProgress,
  type GcProject,
  type GcStage,
} from '../lib/gcMode/gcModel'
import { GC_PROJECT_TOUR_STEPS, GC_TOUR_STEPS } from '../lib/gcMode/gcTour'

/**
 * GC mode — design spike (2026-10-02). Bids, mirrored: we are the general contractor, the plans
 * come in once, each trade is a package offered to several trade partners, and their bids,
 * contracts and draws come back through a portal. Runs on a fixture; nothing is saved.
 */

/** Set once New here? has opened itself, so it does so on a first visit only (per browser). */
const NEW_HERE_SEEN_KEY = 'gc-mode:new-here-seen'

type BoardTab = 'projects' | 'followup' | 'partners' | 'money'
type ProjectTab = 'packages' | 'plans' | 'number' | 'tabs' | 'contracts' | 'start' | 'draws' | 'owner' | 'closeout' | 'schedule' | 'log' | 'submittals'

const STAGES: { key: GcStage; label: string; tone: Tone; blurb: string }[] = [
  { key: 'pursuing', label: 'Bidding to the owner', tone: 'amber', blurb: 'Collect a number for every trade, then give the owner a price.' },
  { key: 'buyout', label: 'Buying out', tone: 'blue', blurb: 'We won. Award each trade, get everything signed, then start.' },
  { key: 'building', label: 'Building', tone: 'green', blurb: 'Trades report their work and ask for draws.' },
]

/**
 * The board's sections: the three stages, then Closed (the owner, 2026-10-02). A closed job keeps
 * its stage ('building') and leaves Building for its own section once `closedOn` is set, from the
 * Building lane's Close the job on Closeout.
 */
const BOARD_SECTIONS: {
  key: GcStage | 'closed' | 'lost'
  label: string
  blurb: string
  empty: string
  holds: (p: GcProject) => boolean
  order: (a: GcProject, b: GcProject) => number
}[] = [
  ...STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    blurb: s.blurb,
    empty: 'None right now.',
    holds: (p: GcProject) => p.stage === s.key && !p.closedOn && !p.lostOn,
    order: (a: GcProject, b: GcProject) => (a.bidDue ?? '9999').localeCompare(b.bidDue ?? '9999'),
  })),
  {
    key: 'closed',
    label: 'Closed',
    blurb: 'Every trade closed out and the owner paid our last bill. Kept here for the record.',
    empty: 'None yet.',
    holds: (p: GcProject) => Boolean(p.closedOn),
    // Newest closed first.
    order: (a: GcProject, b: GcProject) => (b.closedOn ?? '').localeCompare(a.closedOn ?? ''),
  },
  {
    // A bid the owner gave to someone else (the owner, 2026-10-03): it keeps its stage and leaves
    // Bidding once lostOn is set, from We lost this on Our number.
    key: 'lost',
    label: 'Lost',
    blurb: 'Bids the owner gave to another builder. Kept so we learn why.',
    empty: 'None yet.',
    holds: (p: GcProject) => Boolean(p.lostOn),
    order: (a: GcProject, b: GcProject) => (b.lostOn ?? '').localeCompare(a.lostOn ?? ''),
  },
]

const PROJECT_TABS: { key: ProjectTab; label: string }[] = [
  { key: 'packages', label: 'Trades' },
  { key: 'plans', label: 'Plans' },
  { key: 'number', label: 'Our number' },
  { key: 'tabs', label: 'Bid tabs' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'start', label: 'Get started' },
  { key: 'submittals', label: 'Submittals' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'log', label: 'Daily log' },
  { key: 'draws', label: 'Draws' },
  { key: 'owner', label: 'Bill the owner' },
  { key: 'closeout', label: 'Closeout' },
]

function tabButton(active: boolean) {
  return {
    padding: '0.5rem 0.9rem',
    border: 'none',
    borderBottom: active ? '2px solid var(--text-blue-500)' : '2px solid transparent',
    background: 'transparent',
    color: active ? 'var(--text-blue-500)' : 'var(--text-muted)',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    marginBottom: -2,
  } as const
}

export default function GcMode() {
  const [state, dispatch] = useReducer(gcReducer, undefined, initialGcState)
  const [boardTab, setBoardTab] = useState<BoardTab>('projects')
  // By stage every time the board opens (the owner, 2026-10-04, question 9): not remembered.
  const [boardGroup, setBoardGroup] = useState<BoardGroupBy>('stage')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [tab, setTab] = useState<ProjectTab>('packages')
  const [portalOpen, setPortalOpen] = useState(true)
  const [portalPartnerId, setPortalPartnerId] = useState('')
  const [plansForId, setPlansForId] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [mapFor, setMapFor] = useState<{ projectId: string; packageId: string } | null>(null)
  const [levelPackageId, setLevelPackageId] = useState<string | null>(null)
  // New here? opens itself on a first visit (the big list, Board item 8), once per browser.
  const [tourOpen, setTourOpen] = useState(() => {
    try {
      return !window.localStorage.getItem(NEW_HERE_SEEN_KEY)
    } catch {
      return false
    }
  })
  // Remember it once it has shown; set here, not in the initializer, which React may run twice.
  useEffect(() => {
    if (!tourOpen) return
    try {
      window.localStorage.setItem(NEW_HERE_SEEN_KEY, '1')
    } catch {
      /* private window: it opens again next visit */
    }
  }, [tourOpen])
  const [projectTourOpen, setProjectTourOpen] = useState(false)
  const wide = useMatchMedia('(min-width: 1560px)')
  const project = state.projects.find((p) => p.id === projectId) ?? null
  const plansFor = state.projects.find((p) => p.id === plansForId) ?? null
  const customer = state.customers.find((c) => c.id === customerId) ?? null
  const mapProject = state.projects.find((p) => p.id === mapFor?.projectId) ?? null
  const toChase = followUps(state).filter((f) => f.why !== 'waiting')
  // The badge also counts a promise whose day came and insurance that ran out (question 8).
  const chaseCount = toChase.length + promisesToChase(state)

  return (
    <div className="pageWrap" style={{ maxWidth: 1500, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
        <BidsModeToggle mode="gc" />
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', flex: '1 1 auto' }}>
          <button type="button" style={tabButton(boardTab === 'projects')} onClick={() => { setBoardTab('projects'); setProjectId(null) }}>
            Project Board
          </button>
          <button type="button" style={tabButton(boardTab === 'followup')} onClick={() => { setBoardTab('followup'); setProjectId(null) }}>
            Follow up{' '}
            {chaseCount > 0 && (
              <span style={{ background: '#dc2626', color: 'white', borderRadius: 999, padding: '0 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>
                {chaseCount}
              </span>
            )}
          </button>
          <button type="button" style={tabButton(boardTab === 'partners')} onClick={() => { setBoardTab('partners'); setProjectId(null) }}>
            Trade partners
          </button>
          {/* Money across every job that is ours (the Owner Billing lane's; the owner, 2026-10-03). In the real build: the owner and the controller only. */}
          <button type="button" style={tabButton(boardTab === 'money')} onClick={() => { setBoardTab('money'); setProjectId(null) }}>
            Money
          </button>
        </div>
        <Chip tone="violet" title="Runs on made-up data. Nothing is saved.">Prototype</Chip>
        <Btn kind="quiet" onClick={() => { dispatch({ type: 'reset' }); setProjectId(null) }}>Start over</Btn>
        <span data-tour="gc-new-here">
          <Btn
            kind="primary"
            title="A walk through the three stages a project moves through"
            onClick={() => {
              setBoardTab('projects')
              setBoardGroup('stage')
              setProjectId(null)
              setCustomerId(null)
              setPlansForId(null)
              setMapFor(null)
              setTourOpen(true)
            }}
          >
            New here?
          </Btn>
        </span>
      </div>

      {tourOpen && <SpotlightTour steps={GC_TOUR_STEPS} onClose={() => setTourOpen(false)} />}
      {projectTourOpen && <SpotlightTour steps={GC_PROJECT_TOUR_STEPS} onClose={() => setProjectTourOpen(false)} />}

      {customer && !plansFor && (
        <GcCustomerWindow
          state={state}
          customer={customer}
          dispatch={dispatch}
          key={customer.id}
          onClose={() => setCustomerId(null)}
          onPlans={setPlansForId}
          onCustomer={setCustomerId}
          onOpenProject={(id) => {
            setBoardTab('projects')
            setProjectId(id)
            setTab('packages')
            setCustomerId(null)
          }}
        />
      )}

      {mapProject && mapFor && (
        <GcTradeMap
          state={state}
          project={mapProject}
          packageId={mapFor.packageId}
          dispatch={dispatch}
          onPickPackage={(packageId) => setMapFor({ projectId: mapProject.id, packageId })}
          onClose={() => setMapFor(null)}
          onLevel={(packageId) => {
            setLevelPackageId(packageId)
            setBoardTab('projects')
            setProjectId(mapProject.id)
            setTab('packages')
            setMapFor(null)
          }}
        />
      )}

      {plansFor && (
        <GcPlansQuickLook
          key={plansFor.id}
          project={plansFor}
          onClose={() => setPlansForId(null)}
          onSeeWhoHasIt={() => {
            setBoardTab('projects')
            setProjectId(plansFor.id)
            setTab('plans')
            setPlansForId(null)
            setCustomerId(null)
          }}
        />
      )}

      {boardTab === 'followup' && (
        <GcFollowUpTab state={state} dispatch={dispatch} onMap={(projectId, packageId) => setMapFor({ projectId, packageId })} />
      )}

      {boardTab === 'money' && (
        <GcOwnerBillingMoney
          state={state}
          onOpenBill={(id) => {
            setBoardTab('projects')
            setProjectId(id)
            setTab('owner')
          }}
        />
      )}

      {boardTab === 'partners' && (
        <GcPartnersBoard
          state={state}
          dispatch={dispatch}
          onFollowUp={() => setBoardTab('followup')}
          onOpenProject={(id) => {
            setBoardTab('projects')
            setProjectId(id)
            setTab('packages')
          }}
        />
      )}

      {boardTab === 'projects' && !project && (
        <div style={{ display: 'grid', gap: '1.1rem' }} data-tour="gc-board">
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '-0.4rem' }}>
            <GroupSwitch value={boardGroup} onChange={setBoardGroup} />
            {boardGroup === 'customer' && (
              <span style={{ marginLeft: 'auto' }} data-tour="gc-new-project">
                <GcNewProjectButton state={state} dispatch={dispatch} onCreated={(id) => { setProjectId(id); setTab('packages') }} />
              </span>
            )}
          </div>
          {boardGroup === 'customer' && customerGroups(state).map((group) => {
            const words = customerMoneyWords(group.summary)
            const folded = [...group.closed.map((p) => ({ p, word: `closed ${shortDate(p.closedOn ?? '')}` })), ...group.lost.map((p) => ({ p, word: 'lost' }))]
            return (
              <section key={group.customer.id}>
                <div style={{ display: 'flex', gap: '0.25rem 0.6rem', alignItems: 'baseline', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>
                    <button
                      type="button"
                      style={{ ...customerLink, fontWeight: 700 }}
                      title={`See ${group.customer.name}: every project, what they owe, who to call`}
                      onClick={() => setCustomerId(group.customer.id)}
                    >
                      {group.customer.name}
                    </button>{' '}
                    ({group.open.length})
                  </h3>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{group.customer.kind} · {group.customer.contact}</span>
                  {words && <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>{words}</span>}
                </div>
                {group.open.length === 0 ? (
                  <Card style={{ color: 'var(--text-muted)' }}>Nothing open with them right now.</Card>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {group.open.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
                        byCustomer
                        progress={stageProgress(state, p)}
                        today={state.today}
                        onOpen={() => { setProjectId(p.id); setTab('packages') }}
                        onPlans={() => setPlansForId(p.id)}
                        onCustomer={() => setCustomerId(p.customerId)}
                        onArchitect={() => setCustomerId(p.architectId)}
                        chase={toChase.filter((f) => f.project.id === p.id).length}
                        onChase={() => setBoardTab('followup')}
                      />
                    ))}
                  </div>
                )}
                {/* Closed and lost jobs fold into one quiet line under the customer (the mock-up's rule). */}
                {folded.length > 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    Also:{' '}
                    {folded.map(({ p, word }, i) => (
                      <span key={p.id}>
                        {i > 0 && ' · '}
                        <button type="button" style={customerLink} onClick={() => { setProjectId(p.id); setTab('packages') }}>{p.name}</button>, {word}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
          {boardGroup === 'stage' && BOARD_SECTIONS.map((stage) => {
            const rows = state.projects.filter(stage.holds).sort(stage.order)
            return (
              <section key={stage.key} data-tour={`gc-stage-${stage.key}`}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{stage.label} ({rows.length})</h3>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{stage.blurb}</span>
                  {stage.key === 'pursuing' && <span style={{ marginLeft: 'auto' }} data-tour="gc-new-project"><GcNewProjectButton state={state} dispatch={dispatch} onCreated={(id) => { setProjectId(id); setTab('packages') }} /></span>}
                </div>
                {rows.length === 0 ? (
                  <Card style={{ color: 'var(--text-muted)' }}>{stage.empty}</Card>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {rows.map((p, i) => (
                      <div key={p.id} data-tour={i === 0 ? `gc-row-${stage.key}` : undefined}>
                      <ProjectRow
                        project={p}
                        tourKey={i === 0 ? stage.key : undefined}
                        progress={stageProgress(state, p)}
                        today={state.today}
                        onOpen={() => { setProjectId(p.id); setTab('packages') }}
                        onPlans={() => setPlansForId(p.id)}
                        onCustomer={() => setCustomerId(p.customerId)}
                        onArchitect={() => setCustomerId(p.architectId)}
                        chase={toChase.filter((f) => f.project.id === p.id).length}
                        onChase={() => setBoardTab('followup')}
                      />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {boardTab === 'projects' && project && (
        <div>
          <ProjectHeader project={project} today={state.today} onBack={() => setProjectId(null)} onPlans={() => setPlansForId(project.id)} onCustomer={() => setCustomerId(project.customerId)} onArchitect={() => setCustomerId(project.architectId)} />
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid var(--border)', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {PROJECT_TABS.map((t) => (
              <button key={t.key} type="button" style={tabButton(tab === t.key)} onClick={() => setTab(t.key)} data-tour={`gc-ptab-${t.key}`}>
                {t.label}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <Btn kind="quiet" onClick={() => setProjectTourOpen(true)} title="A walk through this job's tabs, in the order a job goes.">
              Walk me through this job
            </Btn>
            <span data-tour="gc-see-trade">
              <Btn kind="quiet" onClick={() => setPortalOpen(!portalOpen)}>
                {portalOpen ? 'Hide what the trade sees' : 'See what the trade sees'}
              </Btn>
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gap: '1rem',
              alignItems: 'start',
              gridTemplateColumns: portalOpen && wide ? 'minmax(0, 1fr) 24rem' : 'minmax(0, 1fr)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              {tab === 'packages' && (
                <GcPackagesTab
                  key={`${project.id}:${levelPackageId ?? ''}`}
                  state={state}
                  project={project}
                  dispatch={dispatch}
                  openPackageId={levelPackageId}
                  onMap={(packageId) => setMapFor({ projectId: project.id, packageId })}
                  onSeePortal={(id) => {
                    setPortalPartnerId(id)
                    setPortalOpen(true)
                  }}
                />
              )}
              {tab === 'plans' && <GcPlansTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'number' && <GcNumberTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'tabs' && (
                <GcBidTabsTab
                  state={state}
                  project={project}
                  dispatch={dispatch}
                  onSeePortal={(id) => {
                    setPortalPartnerId(id)
                    setPortalOpen(true)
                  }}
                />
              )}
              {tab === 'start' && (
                <GcStartTab
                  state={state}
                  project={project}
                  dispatch={dispatch}
                  onOpenSchedule={() => setTab('schedule')}
                  onSeePortal={(id) => {
                    setPortalPartnerId(id)
                    setPortalOpen(true)
                  }}
                />
              )}
              {tab === 'contracts' && <GcContractsTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'draws' && <GcDrawsTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'owner' && <GcOwnerBillingTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'schedule' && <GcBuildingScheduleTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'log' && <GcBuildingLogTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'submittals' && <GcBuildingSubmittalsTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'closeout' && (
                <GcCloseoutTab
                  state={state}
                  project={project}
                  dispatch={dispatch}
                  onSeePortal={(id) => {
                    setPortalPartnerId(id)
                    setPortalOpen(true)
                  }}
                />
              )}
            </div>
            {portalOpen && (
              <div style={{ display: 'grid', gap: '0.75rem', position: wide ? 'sticky' : 'static', top: '0.5rem' }}>
                <GcTradePortal
                  key={`${project.id}:${portalPartnerId}`}
                  state={state}
                  project={project}
                  partnerId={portalPartnerId}
                  onPickPartner={setPortalPartnerId}
                  dispatch={dispatch}
                />
                <Card>
                  <div style={{ fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    What just happened
                  </div>
                  {state.log.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Press something on either side. Each move shows up here.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem' }}>
                      {state.log.slice(0, 7).map((entry) => (
                        <div key={entry.id}>
                          <Chip tone={entry.who === 'trade' ? 'amber' : 'blue'}>{entry.who === 'trade' ? 'trade' : 'office'}</Chip> {entry.text}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** A guess is not a number here: the chip counts real quotes and our own crew, and names the guesses. */
/** The number we carry on a trade is a quote past its good-until day (question 14). */
function carriedRanOut(pkg: GcProject['packages'][number], today: string): boolean {
  if (pkg.sow) return false
  const invite = pkg.invites.find((i) => i.id === (pkg.awardedInviteId ?? pkg.carried))
  return !!invite?.bid && quoteRanOut(invite.bid, today)
}

function coverageWords(project: GcProject, today: string): string {
  // The same rule as the ring's card: a guess, a carried quote with a line that has no cost, or one
  // past its good-until day is not a real number yet.
  const missing = (p: GcProject['packages'][number]) => carriedUncosted(p).length > 0
  const ran = (p: GcProject['packages'][number]) => carriedRanOut(p, today)
  const real = project.packages.filter((p) => carriedAmount(p) !== null && !isGuess(p) && !missing(p) && !ran(p)).length
  const guessed = project.packages.filter(isGuess).length
  const uncosted = project.packages.filter(missing).length
  const ranOut = project.packages.filter(ran).length
  const base = `${real} of ${project.packages.length} trades have a real number`
  return [
    base,
    guessed > 0 ? `${guessed} on our guess` : null,
    uncosted > 0 ? `${uncosted} missing a cost` : null,
    ranOut > 0 ? `${ranOut} ran out` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

function GcIcon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size} fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const linkIcon = {
  color: 'var(--text-blue-500)',
  background: 'transparent',
  border: 'none',
  padding: '0.25rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
} as const

/**
 * A row opens its project on a click anywhere, as a Bid Board row opens its bid. The Links
 * cluster is the Bid Board's: the same folder and plans glyphs, in the same blue.
 */
const customerLink = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--text-link)',
  cursor: 'pointer',
  textDecoration: 'underline',
  textDecorationColor: 'var(--border-blue)',
  textUnderlineOffset: 3,
  textAlign: 'left',
} as const

/**
 * The days left before our bid is due, in an area of its own at the head of the row: the one
 * number an estimator plans the week around. Red inside a week, amber inside two.
 */
function DueBlock({ project, today }: { project: GcProject; today: string }) {
  const box = {
    display: 'grid',
    justifyItems: 'center',
    padding: '0.35rem 0.25rem',
    borderRadius: 8,
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
  } as const
  if (project.lostOn) {
    return (
      <span style={{ ...box, color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }} title={`Lost ${weekdayDate(project.lostOn)}. ${lostWords(project)}.`}>
        <span>lost</span>
        <span style={{ fontWeight: 600 }}>{shortDate(project.lostOn)}</span>
      </span>
    )
  }
  if (project.closedOn) {
    return (
      <span style={{ ...box, color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }} title={`Closed ${weekdayDate(project.closedOn)}.`}>
        <span>closed</span>
        <span style={{ fontWeight: 600 }}>{shortDate(project.closedOn)}</span>
      </span>
    )
  }
  // A won job's row shows what is next, not when our bid went in (the owner, 2026-10-03).
  if (project.stage === 'buyout') return <StartBlock project={project} today={today} box={box} />
  // Building lane: once a schedule is drawn, its measures (days behind or ahead, milestones, look-ahead).
  if (project.stage === 'building' && project.schedule) return <GcBuildingScheduleBlock project={project} today={today} box={box} />
  if (project.stage === 'building' && project.startedOn) {
    // Until the schedule's measures exist (the Building lane), the day work started.
    return (
      <span style={{ ...box, color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }} title={`Work started ${weekdayDate(project.startedOn)}.`}>
        <span>started</span>
        <span style={{ fontWeight: 600 }}>{shortDate(project.startedOn)}</span>
      </span>
    )
  }
  if (project.stage !== 'pursuing' || !project.bidDue) {
    return (
      <span style={{ ...box, color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
        {project.ourBidSentOn ? (
          <>
            <span>our bid went in</span>
            <span style={{ fontWeight: 600 }}>{shortDate(project.ourBidSentOn)}</span>
          </>
        ) : (
          <span>no due date</span>
        )}
      </span>
    )
  }
  const days = daysUntil(project.bidDue, today)
  const sent = project.ourBidSentOn !== null
  const tone = sent
    ? { bg: 'var(--bg-green-100)', fg: 'var(--text-green-800)' }
    : days <= 7
      ? { bg: 'var(--bg-red-100)', fg: 'var(--text-red-800)' }
      : days <= 14
        ? { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)' }
        : { bg: 'var(--bg-muted)', fg: 'var(--text-700)' }
  const words = sent ? 'bid is in' : days < 0 ? (days === -1 ? 'day late' : 'days late') : days === 0 ? 'due today' : days === 1 ? 'day left' : 'days left'
  return (
    <span
      style={{ ...box, background: tone.bg, color: tone.fg }}
      title={sent ? `Our bid went in ${shortDate(project.ourBidSentOn)}. It was due ${weekdayDate(project.bidDue)}.` : `Our bid is due ${weekdayDate(project.bidDue)}.`}
    >
      {sent ? (
        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>✓</span>
      ) : (
        days !== 0 && <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{Math.abs(days)}</span>
      )}
      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{words}</span>
      <span style={{ fontSize: '0.75rem' }}>{weekdayDate(project.bidDue)}</span>
    </span>
  )
}

/**
 * Buying out: the days until the planned start, coloured like the days-left block (red inside a
 * week, amber inside two). No start date yet says so; a planned day that passed reads "days late"
 * because Start is still shut.
 */
function StartBlock({ project, today, box }: { project: GcProject; today: string; box: CSSProperties }) {
  if (!project.startDate) {
    return (
      <span style={{ ...box, color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }} title="No start date yet. Set it on Get started.">
        <span>no start date</span>
      </span>
    )
  }
  const days = daysUntil(project.startDate, today)
  const tone =
    days <= 7
      ? { bg: 'var(--bg-red-100)', fg: 'var(--text-red-800)' }
      : days <= 14
        ? { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)' }
        : { bg: 'var(--bg-muted)', fg: 'var(--text-700)' }
  const words = days < 0 ? (days === -1 ? 'day late' : 'days late') : days === 0 ? 'starts today' : days === 1 ? 'day to start' : 'days to start'
  return (
    <span
      style={{ ...box, background: tone.bg, color: tone.fg }}
      title={days < 0 ? `Work was planned to start ${weekdayDate(project.startDate)}. Start is still shut.` : `Work is planned to start ${weekdayDate(project.startDate)}.`}
    >
      {days !== 0 && <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{Math.abs(days)}</span>}
      <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{words}</span>
      <span style={{ fontSize: '0.75rem' }}>{weekdayDate(project.startDate)}</span>
    </span>
  )
}

/** By stage | By customer at the top of the board (question 9). By stage is the board's own order. */
function GroupSwitch({ value, onChange }: { value: BoardGroupBy; onChange: (v: BoardGroupBy) => void }) {
  const options: { key: BoardGroupBy; label: string }[] = [
    { key: 'stage', label: 'By stage' },
    { key: 'customer', label: 'By customer' },
  ]
  return (
    <span role="group" aria-label="Group the board" data-tour="gc-group-switch" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 999, overflow: 'hidden' }}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          style={{
            border: 'none',
            padding: '0.25rem 0.8rem',
            fontSize: '0.8rem',
            fontWeight: value === o.key ? 600 : 400,
            cursor: 'pointer',
            background: value === o.key ? 'var(--bg-blue-50)' : 'transparent',
            color: value === o.key ? 'var(--text-blue-800)' : 'var(--text-muted)',
          }}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

function ProjectRow({
  project,
  tourKey,
  byCustomer = false,
  progress,
  today,
  onOpen,
  onPlans,
  onCustomer,
  onArchitect,
  chase,
  onChase,
}: {
  project: GcProject
  /** The first row of a board section: its ring and its block carry walkthrough anchors (gc-ring-…, gc-due-…). */
  tourKey?: string
  /** On the board by customer: the section names the customer, so the row names its stage instead. */
  byCustomer?: boolean
  /** How far through its stage the project is: the ring at the head of the row. */
  progress: StageProgress
  today: string
  onOpen: () => void
  onPlans: () => void
  onCustomer: () => void
  onArchitect: () => void
  /** Companies to call on this project now. */
  chase: number
  onChase: () => void
}) {
  const totals = proposalTotals(project)
  const owner = priceToOwner(project)
  const signed = project.packages.filter((p) => p.sow?.status === 'signed').length
  const subs = project.packages.filter((p) => !p.selfPerform).length
  const reach = plansReach(project)
  const newest = planLabel(project, currentRev(project))
  const stage = STAGES.find((st) => st.key === project.stage)
  // A phone or a narrow pane: the ring, the days and the name on top, the rest on the lines under.
  const narrow = useMatchMedia('(max-width: 760px)')
  // Six columns side by side need about 1,060 px: the widest chip is about 260 px and the name
  // needs as much. Between a phone and that, the chips take a line of their own under the name.
  const roomy = useMatchMedia('(min-width: 1100px)')
  const under = narrow ? ({ gridColumn: '1 / -1' } as const) : roomy ? undefined : ({ gridColumn: '3 / -1', gridRow: 2 } as const)
  return (
    <div
      onClick={onOpen}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        cursor: 'pointer',
        color: 'var(--text-base)',
        display: 'grid',
        // The block column fits the Building lane's schedule block ("1 of 2 milestones", which does
        // not wrap) with the block's slim side padding; one width per layout keeps the rows aligned.
        gridTemplateColumns: narrow
          ? '3.5rem 6.5rem minmax(0, 1fr)'
          : roomy
            ? '3.5rem 7rem minmax(0, 2fr) minmax(0, 2fr) auto auto'
            : '3.5rem 7rem minmax(0, 1fr) auto auto',
        gap: narrow ? '0.6rem 0.75rem' : roomy ? '1rem' : '0.5rem 1rem',
        alignItems: 'center',
      }}
    >
      {/* The owner, 2026-10-04: the walkthrough lights the ring itself, then the block, not the whole row. */}
      <div data-tour={tourKey ? `gc-ring-${tourKey}` : undefined} style={{ display: 'flex', justifyContent: 'center' }}>
        <GcProgressRing progress={progress} color={RING_COLORS[project.stage]} stageLabel={project.lostOn ? 'Lost' : project.closedOn ? 'Closed' : (stage?.label ?? '')} />
      </div>
      <div data-tour={tourKey ? `gc-due-${tourKey}` : undefined} style={{ display: 'flex' }}>
        <DueBlock project={project} today={today} />
      </div>
      <span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '1rem', fontWeight: 700, color: 'var(--text-base)', cursor: 'pointer', textAlign: 'left' }}
        >
          {project.name}
        </button>
        {byCustomer && stage && (
          <>
            {' '}
            <Chip tone={stage.tone}>{stage.label}</Chip>
          </>
        )}
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {!byCustomer && (
            <>
              <button
                type="button"
                style={customerLink}
                title={`See ${project.owner}: every project, what they owe, who to call`}
                onClick={(e) => { e.stopPropagation(); onCustomer() }}
              >
                {project.owner}
              </button>{' '}
              ·{' '}
            </>
          )}
          drawn by{' '}
          <button
            type="button"
            style={customerLink}
            title={`See ${project.architect}: the sets they issued and the questions waiting on them`}
            onClick={(e) => { e.stopPropagation(); onArchitect() }}
          >
            {project.architect}
          </button>{' '}
          · {project.sizeNote}
        </span>
      </span>
      <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', ...under }}>
        {project.lostOn && <Chip tone="grey" title={project.lostNote ?? undefined}>{lostWords(project)}</Chip>}
        {/* A pay application sent back twice or more (the owner's yes, 2026-10-02; Board item 6): someone calls them. */}
        {project.packages.map((pkg) => {
          const back = pkg.sow ? sentBackOpen(pkg.sow) : null
          const times = pkg.sow && back ? timesSentBack(pkg.sow, back.draw.number) : 0
          return times >= 2 ? (
            <Chip key={`back-${pkg.id}`} tone="red" title={`Pay application ${back?.draw.number} on ${pkg.trade} went back ${times} times. Call them.`}>
              {pkg.trade}: sent back {times} times
            </Chip>
          ) : null
        })}
        <Chip tone={totals.holes.length > 0 ? 'red' : totals.plugged.length > 0 ? 'amber' : 'green'}>{coverageWords(project, today)}</Chip>
        {chase > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChase() }}
            title="Companies we are waiting on that need a call. Opens Follow up."
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
          >
            <Chip tone="amber">{chase} to call</Chip>
          </button>
        )}
        {project.stage !== 'pursuing' && <Chip tone={signed === subs ? 'green' : 'amber'}>{signed} of {subs} statements of work signed</Chip>}
        <Chip tone={reach.have === reach.of ? 'grey' : 'amber'} title={`${reach.have} of ${reach.of} trade partners have opened ${newest}.`}>
          plans: {newest}{reach.have === reach.of ? '' : ` · ${reach.of - reach.have} have not opened it`}
        </Chip>
      </span>
      <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center', ...(narrow ? { gridColumn: '1 / 3' } : null) }} aria-label="Links">
        <button
          type="button"
          style={linkIcon}
          title="Project folder. In the real build this opens the folder in a new tab."
          aria-label={`Project folder, ${project.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <GcIcon d={GC_ICON_PATHS.folder} />
        </button>
        <button
          type="button"
          style={linkIcon}
          title={`Plans · ${newest}`}
          aria-label={`Plans, ${project.name}`}
          onClick={(e) => { e.stopPropagation(); onPlans() }}
        >
          <GcIcon d={GC_ICON_PATHS.plans} />
        </button>
      </span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '1.05rem', textAlign: 'right', ...(narrow ? { gridColumn: '3 / -1' } : null) }}>
        {owner.signed ? (
          // The owner's price stays what they signed (Owner Billing, 2026-10-04): no "+ ?", no holes.
          <>
            {money(owner.price)}
            <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              as signed{owner.changeOrders > 0 ? `, with ${owner.changeOrders} change ${owner.changeOrders === 1 ? 'order' : 'orders'}` : ''}
            </span>
          </>
        ) : (
          <>
            {money(totals.price)}
            <PlusUnknown words={proposalUncostedWords(project)} />
          </>
        )}
        {owner.signed ? null : totals.holes.length > 0 ? (
          <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>so far, with holes</span>
        ) : (
          totals.plugged.length > 0 && (
            <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>with our guesses in it</span>
          )
        )}
      </span>
    </div>
  )
}

function ProjectHeader({
  project,
  today,
  onBack,
  onPlans,
  onCustomer,
  onArchitect,
}: {
  project: GcProject
  today: string
  onBack: () => void
  onPlans: () => void
  onCustomer: () => void
  onArchitect: () => void
}) {
  const totals = proposalTotals(project)
  const owner = priceToOwner(project)
  const stage = STAGES.find((s) => s.key === project.stage)
  return (
    <Card style={{ marginBottom: '0.75rem' }} dataTour="gc-project-header">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <Btn kind="quiet" onClick={onBack}>← Project Board</Btn>
          <h2 style={{ margin: '0.1rem 0 0.15rem', fontSize: '1.3rem' }}>
            {project.name}{' '}
            {project.lostOn ? (
              <Chip tone="grey" title={`Lost ${weekdayDate(project.lostOn)}. ${lostWords(project)}.`}>Lost</Chip>
            ) : project.closedOn ? (
              <Chip tone="grey" title={`Closed ${weekdayDate(project.closedOn)}.`}>Closed</Chip>
            ) : (
              stage && <Chip tone={stage.tone}>{stage.label}</Chip>
            )}
          </h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {project.address} · {project.sizeNote} · Owner:{' '}
            <button type="button" style={customerLink} onClick={onCustomer}>{project.owner}</button> · Architect:{' '}
            <button type="button" style={customerLink} onClick={onArchitect}>{project.architect}</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
          {project.stage === 'pursuing' && project.bidDue && !project.lostOn && <DueBlock project={project} today={today} />}
          <Stat
            label="Trades"
            tone={totals.holes.length > 0 ? 'red' : 'green'}
            value={
              <>
                {project.packages.length - totals.holes.length} of {project.packages.length}
                <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.1 }}>covered</span>
              </>
            }
          />
          <Stat
            label="Plans"
            value={
              <button
                type="button"
                onClick={onPlans}
                title="Look at the plans"
                style={{ ...linkIcon, padding: 0, gap: '0.3rem', font: 'inherit' }}
              >
                <GcIcon d={GC_ICON_PATHS.plans} size={18} />
                {planLabel(project, currentRev(project))}
              </button>
            }
          />
          <Stat
            label={owner.signed ? 'Price to the owner, as signed' : totals.holes.length > 0 ? 'Price so far, with holes' : 'Price to the owner'}
            value={owner.signed ? money(owner.price) : <>{money(totals.price)}<PlusUnknown words={proposalUncostedWords(project)} /></>}
          />
        </div>
      </div>
    </Card>
  )
}
