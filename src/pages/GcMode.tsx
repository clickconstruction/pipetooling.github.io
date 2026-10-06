import { useEffect, useMemo, useState, type CSSProperties, type Dispatch } from 'react'
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
import { GcBuildingRfisTab } from '../components/gc/GcBuildingRfis'
import { GcBidTabsTab } from '../components/gc/GcBidTabs'
import { GcCustomerWindow } from '../components/gc/GcCustomerWindow'
import { GcCompanyWindow } from '../components/gc/GcCompanyWindow'
import { GcCompanyOpenerContext, type CompanyOpener, type CompanyTab } from '../components/gc/gcCompanyOpener'
import { GcPlansQuickLook } from '../components/gc/GcPlansQuickLook'
import { GcNewProjectButton } from '../components/gc/GcNewProject'
import { GcPartnersBoard } from '../components/gc/GcTradeBench'
import { GcOwnerBillingMoney } from '../components/gc/GcOwnerBillingMoney'
import { GcStartTab } from '../components/gc/GcStart'
import { GcTradeMap } from '../components/gc/GcTradeMap'
import { GcTradePortal } from '../components/gc/GcTradePortal'
import { GC_ICON_PATHS } from '../components/gc/gcIcons'
import { GcProgressRing } from '../components/gc/GcProgressRing'
import { GcPriceCard, GcPriceLikely, GcPriceTrigger, type PriceCardTab } from '../components/gc/GcPriceCard'
import { usePriceCard } from '../components/gc/usePriceCard'
import { useGcStore } from '../components/gc/useGcStore'
import { useJumpStrip } from '../components/gc/useJumpStrip'
import { GcPeoplePill } from '../components/gc/GcPeoplePill'
import { GcFollowUpSheet } from '../components/gc/GcFollowUpSheet'
import { Btn, Card, Chip, PlusUnknown, Stat, type Tone } from '../components/gc/gcUi'
import { GcBoardStrip, GcCustomerHeading, GcStageHeading, GcStageSubheading, type BoardStripItem, type StageStripItem } from '../components/gc/GcBoardStages'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  boardCustomerElementId,
  projectPeople,
  allPeople,
  type ProjectPeopleSummary,
  type PersonReason,
  type ProjectPerson,
  boardSectionCounts,
  boardSectionElementId,
  boardSectionWorthWords,
  customerGroups,
  customerMoneyWords,
  currentRev,
  daysUntil,
  money,
  lostWords,
  planLabel,
  priceToOwner,
  preBidMinutesLine,
  preBidWords,
  proposalUncostedWords,
  RING_COLORS,
  proposalTotals,
  shortDate,
  stageProgress,
  stageHealth,
  tradeHasNumber,
  weekdayDate,
  type BoardGroupBy,
  type BoardSection,
  type StageProgress,
  type GcProject,
  type GcStage,
  type GcAction,
  type GcState,
} from '../lib/gcMode/gcModel'
import { boardFollowPeople, pastContract as pastContractOf } from '../lib/gcMode/gcCounts'
import { GC_PROJECT_TOUR_STEPS, GC_TOUR_STEPS } from '../lib/gcMode/gcTour'
import { GcStageHealth } from '../components/gc/GcStageHealth'

/**
 * GC mode — design spike (2026-10-02). Bids, mirrored: we are the general contractor, the plans
 * come in once, each trade is a package offered to several trade partners, and their bids,
 * contracts and draws come back through a portal. Runs on a fixture; nothing is saved.
 */

/** Set once New here? has opened itself, so it does so on a first visit only (per browser). */
const NEW_HERE_SEEN_KEY = 'gc-mode:new-here-seen'

type BoardTab = 'projects' | 'followup' | 'partners' | 'money'
type ProjectTab = 'packages' | 'plans' | 'number' | 'tabs' | 'contracts' | 'start' | 'draws' | 'owner' | 'closeout' | 'schedule' | 'log' | 'submittals' | 'rfis'

const STAGES: { key: GcStage; label: string; tone: Tone; blurb: string }[] = [
  { key: 'pursuing', label: 'Bidding to the customer', tone: 'amber', blurb: 'Collect a number for every trade, then give the customer a price.' },
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
    blurb: 'Every trade closed out and the customer paid our last bill. Kept here for the record.',
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
    blurb: 'Bids the customer gave to another builder. Kept so we learn why.',
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
  // Questions about the plans while we build (the owner, 2026-10-05: its own tab beside Submittals).
  { key: 'rfis', label: 'RFIs' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'log', label: 'Daily log' },
  { key: 'draws', label: 'Draws' },
  { key: 'owner', label: 'Bill the customer' },
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
  // The session's one copy, shared with the dashboard's Needs you (the owner, 2026-10-04).
  const [state, dispatch] = useGcStore()
  // The dashboard's Needs you opens GC mode on Follow up (/bids/gc?tab=followup; the owner, 2026-10-04).
  const [boardTab, setBoardTab] = useState<BoardTab>(() => (new URLSearchParams(window.location.search).get('tab') === 'followup' ? 'followup' : 'projects'))
  // By stage every time the board opens (the owner, 2026-10-04, question 9): not remembered.
  const [boardGroup, setBoardGroup] = useState<BoardGroupBy>('stage')
  // The dashboard's change-request line opens a job at a tab (/bids/gc?project=<id>&ptab=owner; the owner, 2026-10-05).
  const [projectId, setProjectId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('project'))
  const [tab, setTab] = useState<ProjectTab>(() => {
    const ptab = new URLSearchParams(window.location.search).get('ptab')
    return ptab && PROJECT_TABS.some((t) => t.key === ptab) ? (ptab as ProjectTab) : 'packages'
  })
  const [portalOpen, setPortalOpen] = useState(true)
  const [portalPartnerId, setPortalPartnerId] = useState('')
  const [plansForId, setPlansForId] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  // A trade's company window, at the tab and paper that was clicked (the owner, 2026-10-04).
  const [companyAt, setCompanyAt] = useState<{ partnerId: string; tab?: CompanyTab; doc?: string; focus?: string; send?: boolean } | null>(null)
  // A customer's window opened at a paper, its send open (Get started's Send to sign, the owner, 2026-10-04).
  const [customerAt, setCustomerAt] = useState<{ tab?: CompanyTab; doc?: string; send?: boolean } | null>(null)
  const companyOpener = useMemo<CompanyOpener>(
    () => ({
      openPartner: (partnerId, at) => setCompanyAt({ partnerId, ...at }),
      openCustomer: (id, at) => {
        setCustomerAt(at ?? null)
        setCustomerId(id)
      },
    }),
    [],
  )
  const [mapFor, setMapFor] = useState<{ projectId: string; packageId: string } | null>(null)
  const [levelPackageId, setLevelPackageId] = useState<string | null>(null)
  // A bar to open when the Schedule tab mounts (G-146): a reason about it pressed on a board row's card.
  const [openLineId, setOpenLineId] = useState<string | null>(null)
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
  const companyPartner = state.partners.find((x) => x.id === companyAt?.partnerId) ?? null
  const mapProject = state.projects.find((p) => p.id === mapFor?.projectId) ?? null
  // Everyone we are waiting on, each once across every job: the board rows' sum (the owner, 2026-10-04: "make them match").
  const chaseCount = allPeople(state).count

  // Who we are waiting on for each job (the owner, 2026-10-04): the row's one count, and the
  // Building lane's Follow up sheet behind each person's Call and Follow up.
  const [sheet, setSheet] = useState<{ projectId: string; partnerId?: string; calling?: boolean } | null>(null)
  const peopleFor = (p: GcProject) => {
    const summary = projectPeople(state, p)
    // The sheet's id for a person: the company, or the architect or customer as `customer:<id>`.
    const sheetId = (person: ProjectPerson) => person.partnerId ?? `customer:${person.customerId ?? ''}`
    const first = summary.people[0]
    return {
      summary,
      onFollowUp: (person: ProjectPerson, calling: boolean) => setSheet({ projectId: p.id, partnerId: sheetId(person), calling }),
      onWorkList: first ? () => setSheet({ projectId: p.id, partnerId: sheetId(first) }) : null,
      // A reason about a bar pressed on the card (G-146): the job opens on its Schedule tab at that bar.
      onReason: (_person: ProjectPerson, reason: PersonReason) => {
        if (!reason.lineId) return
        setOpenLineId(reason.lineId)
        setBoardTab('projects')
        setProjectId(p.id)
        setTab('schedule')
      },
    }
  }
  const sheetProject = state.projects.find((x) => x.id === sheet?.projectId) ?? null

  // The stage strip (the owner, 2026-10-04): a pill per board section, 1, 2, 3 for the stages.
  const sectionCounts = boardSectionCounts(state)
  const stripItems: StageStripItem[] = BOARD_SECTIONS.map((sec) => {
    const n = STAGES.findIndex((st) => st.key === sec.key)
    return {
      key: sec.key,
      label: sec.label,
      ...(n >= 0 ? { number: n + 1 } : {}),
      tone: STAGES[n]?.tone ?? 'grey',
      count: sectionCounts.find((c) => c.key === sec.key)?.count ?? 0,
    }
  })
  // By customer (the owner, 2026-10-04: "once a user clicks on By customer, we should change the
  // header"): a pill per customer, with a dot for each stage they have jobs in.
  const groups = customerGroups(state)
  const customerItems: BoardStripItem[] = groups.map((g) => ({
    key: g.customer.id,
    label: g.customer.name,
    tone: 'blue',
    count: g.open.length,
    dots: STAGES.filter((st) => g.open.some((p) => p.stage === st.key)).map((st) => st.tone),
  }))
  const onBoard = boardTab === 'projects' && !project
  // Jump to a stage on By stage, or to a customer on By customer; the one in view is lit.
  const { active: activeKey, jumpTo } = useJumpStrip(
    onBoard,
    boardGroup === 'stage' ? BOARD_SECTIONS.map((sec) => sec.key) : groups.map((g) => g.customer.id),
    (key) => (boardGroup === 'stage' ? boardSectionElementId(key as BoardSection) : boardCustomerElementId(key)),
    boardGroup,
  )

  return (
    <GcCompanyOpenerContext.Provider value={companyOpener}>
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
          <button type="button" data-tour="gc-tab-partners" style={tabButton(boardTab === 'partners')} onClick={() => { setBoardTab('partners'); setProjectId(null) }}>
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
          key={`${customer.id}:${customerAt?.doc ?? ''}`}
          {...(customerAt ? { at: customerAt } : {})}
          onClose={() => {
            setCustomerId(null)
            setCustomerAt(null)
          }}
          onPlans={setPlansForId}
          onCustomer={(id) => {
            setCustomerAt(null)
            setCustomerId(id)
          }}
          onOpenProject={(id) => {
            setBoardTab('projects')
            setProjectId(id)
            setTab('packages')
            setCustomerId(null)
          }}
        />
      )}

      {sheet && sheetProject && (
        // One job's people (the owner, 2026-10-04: Work the list for just this job), on the Building lane's sheet.
        <GcFollowUpSheet
          state={state}
          dispatch={dispatch}
          {...(sheet.partnerId ? { startPartnerId: sheet.partnerId } : {})}
          startCalling={sheet.calling ?? false}
          onClose={() => setSheet(null)}
          list={(s) => {
            const job = s.projects.find((x) => x.id === sheetProject.id)
            // What the row counts (G-146): the call list's people with its items, then Follow up's others.
            return job ? boardFollowPeople(s, job) : []
          }}
          title={sheetProject.name}
        />
      )}

      {companyPartner && companyAt && (
        <GcCompanyWindow
          key={`${companyPartner.id}:${companyAt.tab ?? ''}:${companyAt.doc ?? ''}:${companyAt.focus ?? ''}${companyAt.send ? ':send' : ''}`}
          state={state}
          partner={companyPartner}
          dispatch={dispatch}
          at={companyAt}
          onClose={() => setCompanyAt(null)}
          onOpenProject={(id) => {
            setBoardTab('projects')
            setProjectId(id)
            setTab('packages')
            setCompanyAt(null)
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
          dispatch={dispatch}
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
          <GcBoardStrip
            items={boardGroup === 'stage' ? stripItems : customerItems}
            active={activeKey}
            onJump={jumpTo}
            label={boardGroup === 'stage' ? 'Jump to a stage' : 'Jump to a customer'}
            lead={<GroupSwitch value={boardGroup} onChange={setBoardGroup} />}
            trail={
              boardGroup === 'customer' ? (
                <span data-tour="gc-new-project">
                  <GcNewProjectButton state={state} dispatch={dispatch} onCreated={(id) => { setProjectId(id); setTab('packages') }} />
                </span>
              ) : undefined
            }
          />
          {boardGroup === 'customer' && groups.map((group) => {
            const words = customerMoneyWords(group.summary)
            const folded = [...group.closed.map((p) => ({ p, word: `closed ${shortDate(p.closedOn ?? '')}` })), ...group.lost.map((p) => ({ p, word: 'lost' }))]
            return (
              <section key={group.customer.id}>
                <GcCustomerHeading
                  id={boardCustomerElementId(group.customer.id)}
                  name={group.customer.name}
                  title={`See ${group.customer.name}: every project, what they owe, who to call`}
                  onName={() => setCustomerId(group.customer.id)}
                  count={group.open.length}
                  sub={`${group.customer.kind} · ${group.customer.contact}`}
                  money={words}
                />
                {group.open.length === 0 ? (
                  <Card style={{ color: 'var(--text-muted)' }}>Nothing open with them right now.</Card>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {/* The customer's jobs under a small heading for each stage (the owner, 2026-10-04). */}
                    {STAGES.filter((st) => group.open.some((p) => p.stage === st.key)).map((st) => {
                      const jobs = group.open.filter((p) => p.stage === st.key)
                      const item = stripItems.find((x) => x.key === st.key)
                      return (
                        <div key={st.key} style={{ display: 'grid', gap: '0.5rem' }}>
                          {item && <GcStageSubheading item={{ ...item, count: jobs.length }} />}
                          {jobs.map((p) => (
                            <ProjectRow
                              key={p.id}
                              project={p}
                              byCustomer
                              preBidMinutes={preBidMinutesLine(state, p)}
                              progress={stageProgress(state, p)}
                              today={state.today}
                              onOpen={() => { setProjectId(p.id); setTab('packages') }}
                              priceCard={{ state, dispatch, onTab: (t) => { setProjectId(p.id); setTab(t) } }}
                              onPlans={() => setPlansForId(p.id)}
                              onCustomer={() => setCustomerId(p.customerId)}
                              onArchitect={() => setCustomerId(p.architectId)}
                              people={peopleFor(p)}
                              pastContract={pastContractOf(state, p)}
                              onChase={() => setBoardTab('followup')}
                            />
                          ))}
                        </div>
                      )
                    })}
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
                {/* A heading in the stage's color with its number, count and worth (the owner, 2026-10-04).
                    New here?'s first stop numbers the three stage titles 1, 2, 3: its anchor stays on the title. */}
                <GcStageHeading
                  item={stripItems.find((x) => x.key === stage.key) ?? { key: stage.key, label: stage.label, tone: 'grey', count: rows.length }}
                  worth={boardSectionWorthWords(sectionCounts.find((c) => c.key === stage.key) ?? { key: stage.key, count: 0, worth: 0 })}
                  blurb={stage.blurb}
                  titleTour={`gc-stage-title-${stage.key}`}
                  right={
                    stage.key === 'pursuing' ? (
                      <span data-tour="gc-new-project">
                        <GcNewProjectButton state={state} dispatch={dispatch} onCreated={(id) => { setProjectId(id); setTab('packages') }} />
                      </span>
                    ) : undefined
                  }
                />
                {rows.length === 0 ? (
                  <Card style={{ color: 'var(--text-muted)' }}>{stage.empty}</Card>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {rows.map((p, i) => (
                      <div key={p.id} data-tour={i === 0 ? `gc-row-${stage.key}` : undefined}>
                      <ProjectRow
                        project={p}
                        tourKey={i === 0 ? stage.key : undefined}
                        preBidMinutes={preBidMinutesLine(state, p)}
                        progress={stageProgress(state, p)}
                        today={state.today}
                        onOpen={() => { setProjectId(p.id); setTab('packages') }}
                        priceCard={{ state, dispatch, onTab: (t) => { setProjectId(p.id); setTab(t) } }}
                        onPlans={() => setPlansForId(p.id)}
                        onCustomer={() => setCustomerId(p.customerId)}
                        onArchitect={() => setCustomerId(p.architectId)}
                        people={peopleFor(p)}
                        pastContract={pastContractOf(state, p)}
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
          <ProjectHeader state={state} dispatch={dispatch} onTab={setTab} project={project} today={state.today} onBack={() => setProjectId(null)} onPlans={() => setPlansForId(project.id)} onCustomer={() => setCustomerId(project.customerId)} onArchitect={() => setCustomerId(project.architectId)} onCompany={setCustomerId} />
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
              {tab === 'schedule' && <GcBuildingScheduleTab key={`${project.id}:${openLineId ?? ''}`} state={state} project={project} dispatch={dispatch} openLineId={openLineId} />}
              {tab === 'log' && <GcBuildingLogTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'submittals' && <GcBuildingSubmittalsTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'rfis' && <GcBuildingRfisTab state={state} project={project} dispatch={dispatch} />}
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
    </GcCompanyOpenerContext.Provider>
  )
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
function DueBlock({ project, today, pastContract }: { project: GcProject; today: string; /** The finish past the contract (the counts). */ pastContract?: { days: number; words: string } | null }) {
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
  if (project.stage === 'building' && project.schedule) return <GcBuildingScheduleBlock project={project} today={today} box={box} {...(pastContract ? { pastContract } : {})} />
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
  preBidMinutes = null,
  byCustomer = false,
  progress,
  today,
  onOpen,
  onPlans,
  onCustomer,
  onArchitect,
  people,
  onChase,
  priceCard,
  pastContract,
}: {
  project: GcProject
  /** The first row of a board section: its ring and its block carry walkthrough anchors (gc-ring-…, gc-due-…). */
  tourKey?: string
  /** The pre-bid meeting's minutes, held and not sent with a set yet (`preBidMinutesLine`). */
  preBidMinutes?: string | null
  /** On the board by customer: the section names the customer, so the row names its stage instead. */
  byCustomer?: boolean
  /** How far through its stage the project is: the ring at the head of the row. */
  progress: StageProgress
  today: string
  onOpen: () => void
  onPlans: () => void
  onCustomer: () => void
  onArchitect: () => void
  /** Who we are waiting on for this job, and what pressing each one does (GcPeoplePill). */
  people: {
    summary: ProjectPeopleSummary
    onFollowUp: (person: ProjectPerson, calling: boolean) => void
    onWorkList: (() => void) | null
    /** A reason about a bar pressed (G-146): open the job's Schedule tab at the bar. */
    onReason?: (person: ProjectPerson, reason: PersonReason) => void
  }
  /** Opens Follow up. */
  onChase: () => void
  /** The finish past the contract (G-98, the counts): the block goes red with the days. */
  pastContract?: { days: number; words: string } | null
  /** The card behind the price (the owner's pick B, 2026-10-04, Building lane's GcPriceCard): each trade by what it needs next. */
  priceCard?: { state: GcState; dispatch: Dispatch<GcAction>; onTab: (tab: PriceCardTab) => void }
}) {
  const totals = proposalTotals(project)
  const card = usePriceCard()
  const owner = priceToOwner(project)
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
        <DueBlock project={project} today={today} {...(pastContract ? { pastContract } : {})} />
      </div>
      <span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '1rem', fontWeight: 700, color: 'var(--text-base)', cursor: 'pointer', textAlign: 'left' }}
        >
          {project.name}
        </button>
        <br />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {!byCustomer && (
            <>
              {/* The dot rides inside the button, like the architect's, so it never starts or sits alone on a line. */}
              <button
                type="button"
                style={{ ...customerLink, textDecoration: 'none' }}
                title={`See ${project.owner}: every project, what they owe, who to call`}
                onClick={(e) => { e.stopPropagation(); onCustomer() }}
              >
                <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--border-blue)', textUnderlineOffset: 3 }}>{project.owner}</span>
                <span style={{ color: 'var(--text-muted)' }}>{'\u00a0·'}</span>
              </button>{' '}
            </>
          )}
          {/* "drawn by" and the architect move to the next line together when they fit there (the
              owner, 2026-10-04); a name longer than a line still wraps inside, on its own lines. */}
          <span style={{ display: 'inline-block' }}>
            drawn by{' '}
            {/* The dot rides inside the button, not underlined, so it stays with the name's last word: a
                line may break right after a button, which left the dot alone on a phone. */}
            <button
              type="button"
              style={{ ...customerLink, textDecoration: 'none' }}
              title={`See ${project.architect}: the sets they issued and the questions waiting on them`}
              onClick={(e) => { e.stopPropagation(); onArchitect() }}
            >
              <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--border-blue)', textUnderlineOffset: 3 }}>{project.architect}</span>
              <span style={{ color: 'var(--text-muted)' }}>{'\u00a0·'}</span>
            </button>
          </span>{' '}
          {/* The size moves to the next line whole rather than breaking inside it (the owner,
              2026-10-04); one longer than a line still wraps inside, on its own lines. */}
          <span style={{ display: 'inline-block' }}>{project.sizeNote}</span>
        </span>
      </span>
      <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', ...under }}>
        {project.lostOn && <Chip tone="grey" title={project.lostNote ?? undefined}>{lostWords(project)}</Chip>}
        {/* New Project's pre-bid meeting (the owner, 2026-10-04): coming up while bidding, then its minutes to send. */}
        {project.stage === 'pursuing' && !project.lostOn && project.preBid && project.preBid.attended === null && (
          <Chip tone={project.preBid.mandatory ? 'amber' : 'blue'} title={preBidWords(project) ?? undefined}>
            pre-bid {weekdayDate(project.preBid.on)}
            {project.preBid.mandatory ? ' · required' : ''}
          </Chip>
        )}
        {project.stage === 'pursuing' && !project.lostOn && preBidMinutes && (
          <Chip tone="amber" title={`${preBidMinutes} They go out with the next set of plans.`}>
            pre-bid minutes not sent yet
          </Chip>
        )}
        {/* Everyone we are waiting on, in one count (the owner, 2026-10-04: "say number of people to call
            and then when a user hovers over it they see the details"). The price, plans and statements
            of work chips left: the ring and the price line say those, and who owes us is in the card. */}
        <GcPeoplePill
          summary={people.summary}
          projectName={project.name}
          {...(tourKey ? { tourKey } : {})}
          onFollowUp={people.onFollowUp}
          onWorkList={people.onWorkList}
          onOpenFollowUp={onChase}
          {...(people.onReason ? { onReason: people.onReason } : {})}
        />
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
          <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>
            {priceCard ? (
              <GcPriceTrigger card={card} label={`so far, with ${totals.holes.length} ${totals.holes.length === 1 ? 'hole' : 'holes'}. Show each trade.`}>
                so far, with {totals.holes.length} {totals.holes.length === 1 ? 'hole' : 'holes'}
              </GcPriceTrigger>
            ) : (
              'so far, with holes'
            )}
          </span>
        ) : (
          totals.plugged.length > 0 && (
            <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>
              {priceCard ? (
                <GcPriceTrigger card={card} label="with our guesses in it. Show each trade.">
                  with our guesses in it
                </GcPriceTrigger>
              ) : (
                'with our guesses in it'
              )}
            </span>
          )
        )}
        {/* The price once every trade is in (the owner's pick B, 2026-10-04): a hole at its lowest quote or our budget. */}
        {priceCard && !owner.signed && <GcPriceLikely state={priceCard.state} project={project} />}
      </span>
      {priceCard && !owner.signed && (
        <GcPriceCard card={card} state={priceCard.state} project={project} dispatch={priceCard.dispatch} onTab={priceCard.onTab} onFollowUp={onChase} />
      )}
    </div>
  )
}

function ProjectHeader({
  state,
  dispatch,
  onTab,
  project,
  today,
  onBack,
  onPlans,
  onCustomer,
  onArchitect,
  onCompany,
}: {
  state: GcState
  dispatch: Dispatch<GcAction>
  /** Opens a project tab: the strip's next step. */
  onTab: (tab: ProjectTab) => void
  project: GcProject
  today: string
  onBack: () => void
  onPlans: () => void
  onCustomer: () => void
  onArchitect: () => void
  /** Any company's window by id: the property's owner when it differs from the customer. */
  onCompany: (id: string) => void
}) {
  const totals = proposalTotals(project)
  const owner = priceToOwner(project)
  const stage = STAGES.find((s) => s.key === project.stage)
  // The stage-health strip (the owner, 2026-10-04) shows the trades; the header keeps its Trades count only where there is no strip.
  const health = stageHealth(state, project)
  const withNumber = project.packages.filter((p) => tradeHasNumber(state, p)).length
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
            {/* The owner, 2026-10-04: the one we bill is the customer; the property's owner shows when different. */}
            {project.address} · {project.sizeNote} · Customer:{' '}
            <button type="button" style={customerLink} onClick={onCustomer}>{project.owner}</button>
            {project.propertyOwner && project.propertyOwnerId && (
              <>
                {' '}· Owner:{' '}
                <button type="button" style={customerLink} onClick={() => onCompany(project.propertyOwnerId ?? '')}>{project.propertyOwner}</button>
              </>
            )}{' '}
            · Architect:{' '}
            <button type="button" style={customerLink} onClick={onArchitect}>{project.architect}</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
          {project.stage === 'pursuing' && project.bidDue && !project.lostOn && <DueBlock project={project} today={today} />}
          {!health && (
            <Stat
              label="Trades"
              tone={withNumber < project.packages.length ? 'red' : 'green'}
              value={
                <>
                  {withNumber} of {project.packages.length}
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.1 }}>with a number</span>
                </>
              }
            />
          )}
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
            label={owner.signed ? 'Price to the customer, as signed' : totals.holes.length > 0 ? 'Price so far, with holes' : 'Price to the customer'}
            value={owner.signed ? money(owner.price) : <>{money(totals.price)}<PlusUnknown words={proposalUncostedWords(project)} /></>}
          />
        </div>
      </div>
      <GcStageHealth state={state} project={project} dispatch={dispatch} onTab={onTab} />
    </Card>
  )
}
