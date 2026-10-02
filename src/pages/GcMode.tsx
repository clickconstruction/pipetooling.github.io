import { useReducer, useState } from 'react'
import { BidsModeToggle } from '../components/gc/BidsModeToggle'
import {
  GcContractsTab,
  GcDrawsTab,
  GcNumberTab,
  GcPackagesTab,
  GcPlansTab,
} from '../components/gc/GcOfficeTabs'
import { GcFollowUpTab } from '../components/gc/GcAskThread'
import { GcBidTabsTab } from '../components/gc/GcBidTabs'
import { GcCustomerWindow } from '../components/gc/GcCustomerWindow'
import { GcPlansQuickLook } from '../components/gc/GcPlansQuickLook'
import { GcPartnersBoard } from '../components/gc/GcTradeBench'
import { GcStartTab } from '../components/gc/GcStart'
import { GcTradeMap } from '../components/gc/GcTradeMap'
import { GcTradePortal } from '../components/gc/GcTradePortal'
import { GC_ICON_PATHS } from '../components/gc/gcIcons'
import { Btn, Card, Chip, Stat, type Tone } from '../components/gc/gcUi'
import { useMatchMedia } from '../hooks/useMatchMedia'
import {
  carriedAmount,
  currentRev,
  daysUntil,
  followUps,
  gcReducer,
  initialGcState,
  money,
  planLabel,
  plansReach,
  proposalTotals,
  shortDate,
  weekdayDate,
  type GcProject,
  type GcStage,
} from '../lib/gcMode/gcModel'

/**
 * GC mode — design spike (2026-10-02). Bids, mirrored: we are the general contractor, the plans
 * come in once, each trade is a package offered to several trade partners, and their bids,
 * contracts and draws come back through a portal. Runs on a fixture; nothing is saved.
 */

type BoardTab = 'projects' | 'followup' | 'partners'
type ProjectTab = 'packages' | 'plans' | 'number' | 'tabs' | 'contracts' | 'start' | 'draws'

const STAGES: { key: GcStage; label: string; tone: Tone; blurb: string }[] = [
  { key: 'pursuing', label: 'Bidding to the owner', tone: 'amber', blurb: 'Collect a number for every trade, then give the owner a price.' },
  { key: 'buyout', label: 'Buying out', tone: 'blue', blurb: 'We won. Award each trade, get everything signed, then start.' },
  { key: 'building', label: 'Building', tone: 'green', blurb: 'Trades report their work and ask for draws.' },
]

const PROJECT_TABS: { key: ProjectTab; label: string }[] = [
  { key: 'packages', label: 'Trades' },
  { key: 'plans', label: 'Plans' },
  { key: 'number', label: 'Our number' },
  { key: 'tabs', label: 'Bid tabs' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'start', label: 'Get started' },
  { key: 'draws', label: 'Draws' },
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
  const [projectId, setProjectId] = useState<string | null>(null)
  const [tab, setTab] = useState<ProjectTab>('packages')
  const [portalOpen, setPortalOpen] = useState(true)
  const [portalPartnerId, setPortalPartnerId] = useState('')
  const [plansForId, setPlansForId] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [mapFor, setMapFor] = useState<{ projectId: string; packageId: string } | null>(null)
  const [levelPackageId, setLevelPackageId] = useState<string | null>(null)
  const wide = useMatchMedia('(min-width: 1560px)')
  const project = state.projects.find((p) => p.id === projectId) ?? null
  const plansFor = state.projects.find((p) => p.id === plansForId) ?? null
  const customer = state.customers.find((c) => c.id === customerId) ?? null
  const mapProject = state.projects.find((p) => p.id === mapFor?.projectId) ?? null
  const toChase = followUps(state).filter((f) => f.why !== 'waiting')

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
            {toChase.length > 0 && (
              <span style={{ background: '#dc2626', color: 'white', borderRadius: 999, padding: '0 0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>
                {toChase.length}
              </span>
            )}
          </button>
          <button type="button" style={tabButton(boardTab === 'partners')} onClick={() => { setBoardTab('partners'); setProjectId(null) }}>
            Trade partners
          </button>
        </div>
        <Chip tone="violet" title="Runs on made-up data. Nothing is saved.">Prototype</Chip>
        <Btn kind="quiet" onClick={() => { dispatch({ type: 'reset' }); setProjectId(null) }}>Start over</Btn>
      </div>

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
        <div style={{ display: 'grid', gap: '1.1rem' }}>
          {STAGES.map((stage) => {
            const rows = state.projects
              .filter((p) => p.stage === stage.key)
              .sort((a, b) => (a.bidDue ?? '9999').localeCompare(b.bidDue ?? '9999'))
            return (
              <section key={stage.key}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>{stage.label} ({rows.length})</h3>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{stage.blurb}</span>
                </div>
                {rows.length === 0 ? (
                  <Card style={{ color: 'var(--text-muted)' }}>None right now.</Card>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {rows.map((p) => (
                      <ProjectRow
                        key={p.id}
                        project={p}
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
              <button key={t.key} type="button" style={tabButton(tab === t.key)} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <Btn kind="quiet" onClick={() => setPortalOpen(!portalOpen)}>
              {portalOpen ? 'Hide what the trade sees' : 'See what the trade sees'}
            </Btn>
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
                  onSeePortal={(id) => {
                    setPortalPartnerId(id)
                    setPortalOpen(true)
                  }}
                />
              )}
              {tab === 'contracts' && <GcContractsTab state={state} project={project} dispatch={dispatch} />}
              {tab === 'draws' && <GcDrawsTab state={state} project={project} dispatch={dispatch} />}
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

function coverageWords(project: GcProject): string {
  const withNumber = project.packages.filter((p) => carriedAmount(p) !== null).length
  return `${withNumber} of ${project.packages.length} trades have a number`
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
} as const

/**
 * The days left before our bid is due, in an area of its own at the head of the row: the one
 * number an estimator plans the week around. Red inside a week, amber inside two.
 */
function DueBlock({ project, today }: { project: GcProject; today: string }) {
  const box = {
    display: 'grid',
    justifyItems: 'center',
    padding: '0.35rem 0.4rem',
    borderRadius: 8,
    lineHeight: 1.15,
    fontVariantNumeric: 'tabular-nums',
  } as const
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

function ProjectRow({
  project,
  today,
  onOpen,
  onPlans,
  onCustomer,
  onArchitect,
  chase,
  onChase,
}: {
  project: GcProject
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
  const signed = project.packages.filter((p) => p.sow?.status === 'signed').length
  const subs = project.packages.filter((p) => !p.selfPerform).length
  const reach = plansReach(project)
  const newest = planLabel(project, currentRev(project))
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
        gridTemplateColumns: '6.5rem minmax(0, 2fr) minmax(0, 2fr) auto auto',
        gap: '1rem',
        alignItems: 'center',
      }}
    >
      <DueBlock project={project} today={today} />
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
          <button
            type="button"
            style={customerLink}
            title={`See ${project.owner}: every project, what they owe, who to call`}
            onClick={(e) => { e.stopPropagation(); onCustomer() }}
          >
            {project.owner}
          </button>{' '}
          · drawn by{' '}
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
      <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        <Chip tone={totals.holes.length > 0 ? 'red' : 'green'}>{coverageWords(project)}</Chip>
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
      <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }} aria-label="Links">
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
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '1.05rem', textAlign: 'right' }}>
        {money(totals.price)}
        {totals.holes.length > 0 && (
          <span style={{ display: 'block', fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-red-700)' }}>so far, with holes</span>
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
  const stage = STAGES.find((s) => s.key === project.stage)
  return (
    <Card style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <Btn kind="quiet" onClick={onBack}>← Project Board</Btn>
          <h2 style={{ margin: '0.1rem 0 0.15rem', fontSize: '1.3rem' }}>
            {project.name} {stage && <Chip tone={stage.tone}>{stage.label}</Chip>}
          </h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {project.address} · {project.sizeNote} · Owner:{' '}
            <button type="button" style={customerLink} onClick={onCustomer}>{project.owner}</button> · Architect:{' '}
            <button type="button" style={customerLink} onClick={onArchitect}>{project.architect}</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
          {project.stage === 'pursuing' && project.bidDue && <DueBlock project={project} today={today} />}
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
          <Stat label={totals.holes.length > 0 ? 'Price so far, with holes' : 'Price to the owner'} value={money(totals.price)} />
        </div>
      </div>
    </Card>
  )
}
