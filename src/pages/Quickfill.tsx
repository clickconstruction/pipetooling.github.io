import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { BilledAwaitingPaymentSection } from '../components/quickfill/BilledAwaitingPaymentSection'
import { CantReachSection } from '../components/quickfill/CantReachSection'
import { CrewJobsSection } from '../components/quickfill/CrewJobsSection'
import { JobsBillingReminderSection } from '../components/quickfill/JobsBillingReminderSection'
import { UnpricedFixturesSection } from '../components/quickfill/UnpricedFixturesSection'
import { SupplyHousesSection } from '../components/quickfill/SupplyHousesSection'
import { BankingSortingSnapshotSection } from '../components/quickfill/BankingSortingSnapshotSection'
import { HoursSection } from '../components/quickfill/HoursSection'
import { QuickfillPeopleHoursNewSection } from '../components/quickfill/QuickfillPeopleHoursNewSection'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useUnpricedFixturesCount } from '../hooks/useUnpricedFixturesCount'

const SECTIONS: { id: string; sectionId: string; label: string }[] = [
  { id: 'quickfill-hours', sectionId: 'hours', label: 'People Hours (Old)' },
  { id: 'quickfill-people-hours-new', sectionId: 'people-hours-new', label: 'People Hours (new)' },
  { id: 'quickfill-banking-sorting', sectionId: 'banking-sorting', label: 'Banking sorting' },
  { id: 'quickfill-crew-jobs', sectionId: 'crew-jobs', label: 'Crew Jobs / Bids' },
  { id: 'quickfill-billed-awaiting', sectionId: 'billed-awaiting', label: 'Billing Awaiting Payments' },
  { id: 'quickfill-unpriced-fixtures', sectionId: 'unpriced-fixtures', label: 'Unpriced Fixtures' },
  { id: 'quickfill-cant-reach', sectionId: 'cant-reach', label: 'Unreachable Prospects' },
  { id: 'quickfill-supply-houses', sectionId: 'supply-houses', label: 'Supply Houses' },
  { id: 'quickfill-jobs-billing', sectionId: 'jobs-billing', label: 'Jobs Billing' },
]

/** localStorage value: JSON array of sectionId strings that are hidden; missing/empty = all sections visible */
const QUICKFILL_HIDDEN_SECTIONS_KEY = 'pipetooling_quickfill_hidden_sections'

/** Min HCP (inclusive) for Jobs Billing reminder counts on Quickfill */
const QUICKFILL_JOBS_BILLING_MIN_HCP_KEY = 'pipetooling_quickfill_jobs_billing_min_hcp'
const DEFAULT_JOBS_BILLING_MIN_HCP = 406

const VALID_SECTION_IDS = new Set(SECTIONS.map((s) => s.sectionId))

function loadJobsBillingMinHcpFromStorage(): number {
  if (typeof window === 'undefined') return DEFAULT_JOBS_BILLING_MIN_HCP
  try {
    const raw = window.localStorage.getItem(QUICKFILL_JOBS_BILLING_MIN_HCP_KEY)
    if (raw == null || raw === '') return DEFAULT_JOBS_BILLING_MIN_HCP
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 0) return DEFAULT_JOBS_BILLING_MIN_HCP
    return n
  } catch {
    return DEFAULT_JOBS_BILLING_MIN_HCP
  }
}

function saveJobsBillingMinHcpToStorage(n: number): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(QUICKFILL_JOBS_BILLING_MIN_HCP_KEY, String(n))
}

function loadHiddenSectionIdsFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(QUICKFILL_HIDDEN_SECTIONS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && VALID_SECTION_IDS.has(id)))
  } catch {
    return new Set()
  }
}

function saveHiddenSectionIdsToStorage(hidden: Set<string>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(QUICKFILL_HIDDEN_SECTIONS_KEY, JSON.stringify([...hidden]))
}

type ButtonColor = 'red' | 'yellow' | 'green'

function getButtonColor(markedAt: string | null): ButtonColor {
  if (!markedAt) return 'red'
  const hoursAgo = (Date.now() - new Date(markedAt).getTime()) / (1000 * 60 * 60)
  if (hoursAgo > 30) return 'red'
  if (hoursAgo > 12) return 'yellow'
  return 'green'
}

const BUTTON_BG: Record<ButtonColor, string> = {
  red: '#fecaca',
  yellow: '#fef08a',
  green: '#bbf7d0',
}

const BUTTON_BORDER: Record<ButtonColor, string> = {
  red: '#f87171',
  yellow: '#eab308',
  green: '#22c55e',
}

/** Match Banking page main title (Banking h1); use h2 on Quickfill because page has an h1 */
const QUICKFILL_SECTION_TITLE_STYLE: CSSProperties = {
  margin: '0 0 1rem 0',
  fontSize: '1.5rem',
  fontWeight: 700,
  textAlign: 'left',
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function hoursUntilExpand(markedAt: string): number {
  const elapsed = (Date.now() - new Date(markedAt).getTime()) / (1000 * 60 * 60)
  return Math.max(0, Math.ceil((12 - elapsed) * 10) / 10)
}

export default function Quickfill() {
  const { user: authUser } = useAuth()
  const unpricedFixturesCount = useUnpricedFixturesCount()
  const [sectionMarks, setSectionMarks] = useState<Record<string, { marked_at: string; marked_by?: string; marked_by_name?: string | null }>>({})
  const [forceExpandedSections, setForceExpandedSections] = useState<Set<string>>(new Set(['cant-reach']))
  const [hiddenSectionIds, setHiddenSectionIds] = useState<Set<string>>(() => loadHiddenSectionIdsFromStorage())
  const [activeSectionsPanelOpen, setActiveSectionsPanelOpen] = useState(false)
  const [jobsBillingMinHcp, setJobsBillingMinHcp] = useState<number>(() => loadJobsBillingMinHcpFromStorage())

  useEffect(() => {
    saveHiddenSectionIdsToStorage(hiddenSectionIds)
  }, [hiddenSectionIds])

  useEffect(() => {
    saveJobsBillingMinHcpToStorage(jobsBillingMinHcp)
  }, [jobsBillingMinHcp])

  function isSectionVisible(sectionId: string): boolean {
    return !hiddenSectionIds.has(sectionId)
  }

  function setSectionVisible(sectionId: string, visible: boolean): void {
    setHiddenSectionIds((prev) => {
      const next = new Set(prev)
      if (visible) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  /** True if this section would render a Quickfill block (visibility + unpriced count rule). */
  function sectionWouldRenderOnPage(sectionId: string): boolean {
    if (!isSectionVisible(sectionId)) return false
    if (sectionId === 'unpriced-fixtures') return unpricedFixturesCount > 0
    return true
  }

  const hasAnyVisibleSection = SECTIONS.some(({ sectionId }) => sectionWouldRenderOnPage(sectionId))

  const firstVisibleSectionId = useMemo(() => {
    for (const { sectionId } of SECTIONS) {
      if (hiddenSectionIds.has(sectionId)) continue
      if (sectionId === 'unpriced-fixtures' && unpricedFixturesCount <= 0) continue
      return sectionId
    }
    return null
  }, [hiddenSectionIds, unpricedFixturesCount])

  async function loadSectionMarks() {
    const { data } = await supabase
      .from('quickfill_section_marks')
      .select('section_id, marked_at, marked_by, users!quickfill_section_marks_marked_by_fkey(name)')
    const map: Record<string, { marked_at: string; marked_by?: string; marked_by_name?: string | null }> = {}
    for (const row of data ?? []) {
      const r = row as { section_id: string; marked_at: string; marked_by?: string; users?: { name: string | null } | null }
      map[r.section_id] = {
        marked_at: r.marked_at,
        marked_by: r.marked_by,
        marked_by_name: r.users?.name ?? null,
      }
    }
    setSectionMarks(map)
  }

  useEffect(() => {
    loadSectionMarks()
  }, [])

  async function markSectionUpToDate(sectionId: string) {
    const { error } = await supabase.from('quickfill_section_marks').upsert(
      { section_id: sectionId, marked_at: new Date().toISOString(), marked_by: authUser?.id ?? null },
      { onConflict: 'section_id' }
    )
    if (!error) {
      setForceExpandedSections((s) => {
        const next = new Set(s)
        next.delete(sectionId)
        return next
      })
      loadSectionMarks()
    }
  }

  function isCollapsed(sectionId: string): boolean {
    const mark = sectionMarks[sectionId]
    if (!mark) return false
    const hoursAgo = (Date.now() - new Date(mark.marked_at).getTime()) / (1000 * 60 * 60)
    return hoursAgo < 12
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', textAlign: 'center' }}>Quickfill</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
        {SECTIONS.filter(({ sectionId }) => sectionId !== 'unpriced-fixtures' || unpricedFixturesCount > 0)
          .filter(({ sectionId }) => isSectionVisible(sectionId))
          .map(({ id, sectionId, label }) => {
          const mark = sectionMarks[sectionId]
          const color = getButtonColor(mark?.marked_at ?? null)
          return (
            <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
              <button
                type="button"
                onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 6,
                  background: BUTTON_BG[color],
                  border: `1px solid ${BUTTON_BORDER[color]}`,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                {label}
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {mark ? `Last marked: ${formatRelativeTime(mark.marked_at)}` : 'Never marked'}
                </span>
                {mark?.marked_by_name && (
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    by {mark.marked_by_name}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {!hasAnyVisibleSection && (
        <p
          style={{
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '0.9375rem',
            marginBottom: '1.5rem',
            padding: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#f9fafb',
          }}
        >
          All Quickfill sections are hidden. Use <strong>Active sections</strong> below to show one or more sections again.
        </p>
      )}
      {isSectionVisible('hours') && (
      <QuickfillSectionWrapper
        id="quickfill-hours"
        label="People Hours (Old)"
        withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'hours'}
        color={getButtonColor(sectionMarks['hours']?.marked_at ?? null)}
        collapsed={isCollapsed('hours') && !forceExpandedSections.has('hours')}
        mark={sectionMarks['hours']}
        onMarkUpToDate={() => markSectionUpToDate('hours')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'hours']))}
      >
        <HoursSection />
      </QuickfillSectionWrapper>
      )}
      {isSectionVisible('people-hours-new') && (
      <QuickfillSectionWrapper
        id="quickfill-people-hours-new"
        label="People Hours (new)"
        withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'people-hours-new'}
        color={getButtonColor(sectionMarks['people-hours-new']?.marked_at ?? null)}
        collapsed={isCollapsed('people-hours-new') && !forceExpandedSections.has('people-hours-new')}
        mark={sectionMarks['people-hours-new']}
        onMarkUpToDate={() => markSectionUpToDate('people-hours-new')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'people-hours-new']))}
      >
        <QuickfillPeopleHoursNewSection />
      </QuickfillSectionWrapper>
      )}
      {isSectionVisible('banking-sorting') && (
      <QuickfillSectionWrapper
        id="quickfill-banking-sorting"
        label="Banking sorting"
        withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'banking-sorting'}
        color={getButtonColor(sectionMarks['banking-sorting']?.marked_at ?? null)}
        collapsed={isCollapsed('banking-sorting') && !forceExpandedSections.has('banking-sorting')}
        mark={sectionMarks['banking-sorting']}
        onMarkUpToDate={() => markSectionUpToDate('banking-sorting')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'banking-sorting']))}
      >
        <BankingSortingSnapshotSection />
      </QuickfillSectionWrapper>
      )}
      {isSectionVisible('crew-jobs') && (
      <QuickfillSectionWrapper
        id="quickfill-crew-jobs"
        label="Crew Jobs / Bids"
        withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'crew-jobs'}
        color={getButtonColor(sectionMarks['crew-jobs']?.marked_at ?? null)}
        collapsed={isCollapsed('crew-jobs') && !forceExpandedSections.has('crew-jobs')}
        mark={sectionMarks['crew-jobs']}
        onMarkUpToDate={() => markSectionUpToDate('crew-jobs')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'crew-jobs']))}
      >
        <CrewJobsSection />
      </QuickfillSectionWrapper>
      )}
      {isSectionVisible('billed-awaiting') && (
      <QuickfillSectionWrapper
        id="quickfill-billed-awaiting"
        label="Billing Awaiting Payments"
        withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'billed-awaiting'}
        color={getButtonColor(sectionMarks['billed-awaiting']?.marked_at ?? null)}
        collapsed={isCollapsed('billed-awaiting') && !forceExpandedSections.has('billed-awaiting')}
        mark={sectionMarks['billed-awaiting']}
        onMarkUpToDate={() => markSectionUpToDate('billed-awaiting')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'billed-awaiting']))}
      >
        <BilledAwaitingPaymentSection />
      </QuickfillSectionWrapper>
      )}
      {unpricedFixturesCount > 0 && isSectionVisible('unpriced-fixtures') && (
        <QuickfillSectionWrapper
          id="quickfill-unpriced-fixtures"
          label="Unpriced Fixtures"
          withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'unpriced-fixtures'}
          color={getButtonColor(sectionMarks['unpriced-fixtures']?.marked_at ?? null)}
          collapsed={isCollapsed('unpriced-fixtures') && !forceExpandedSections.has('unpriced-fixtures')}
          mark={sectionMarks['unpriced-fixtures']}
          onMarkUpToDate={() => markSectionUpToDate('unpriced-fixtures')}
          onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'unpriced-fixtures']))}
        >
          <UnpricedFixturesSection />
        </QuickfillSectionWrapper>
      )}
      {isSectionVisible('cant-reach') && (
      <QuickfillSectionWrapper
        id="quickfill-cant-reach"
        label="Unreachable Prospects"
        withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'cant-reach'}
        color={getButtonColor(sectionMarks['cant-reach']?.marked_at ?? null)}
        collapsed={isCollapsed('cant-reach') && !forceExpandedSections.has('cant-reach')}
        mark={sectionMarks['cant-reach']}
        onMarkUpToDate={() => markSectionUpToDate('cant-reach')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'cant-reach']))}
      >
        <CantReachSection />
      </QuickfillSectionWrapper>
      )}
      {isSectionVisible('supply-houses') && (
      <QuickfillSectionWrapper
        id="quickfill-supply-houses"
        label="Supply Houses"
        withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'supply-houses'}
        color={getButtonColor(sectionMarks['supply-houses']?.marked_at ?? null)}
        collapsed={isCollapsed('supply-houses') && !forceExpandedSections.has('supply-houses')}
        mark={sectionMarks['supply-houses']}
        onMarkUpToDate={() => markSectionUpToDate('supply-houses')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'supply-houses']))}
      >
        <SupplyHousesSection />
      </QuickfillSectionWrapper>
      )}
      {isSectionVisible('jobs-billing') && (
      <QuickfillSectionWrapper
        id="quickfill-jobs-billing"
        label="Jobs Billing"
        withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'jobs-billing'}
        color={getButtonColor(sectionMarks['jobs-billing']?.marked_at ?? null)}
        collapsed={isCollapsed('jobs-billing') && !forceExpandedSections.has('jobs-billing')}
        mark={sectionMarks['jobs-billing']}
        onMarkUpToDate={() => markSectionUpToDate('jobs-billing')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'jobs-billing']))}
      >
        <JobsBillingReminderSection minHcpNumber={jobsBillingMinHcp} />
      </QuickfillSectionWrapper>
      )}
      <div
        style={{
          marginTop: '2rem',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: '#fafafa',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSectionsPanelOpen((prev) => !prev)}
          aria-expanded={activeSectionsPanelOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            margin: 0,
            padding: '1rem',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '0.75rem' }}>{activeSectionsPanelOpen ? '▼' : '▶'}</span>
          Active sections
        </button>
        {activeSectionsPanelOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Uncheck a section to hide it from this page and from the jump buttons above. Preferences are saved in this browser.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {SECTIONS.map(({ sectionId, label }) => (
                <li key={sectionId}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={isSectionVisible(sectionId)}
                        onChange={(e) => setSectionVisible(sectionId, e.target.checked)}
                      />
                      <span>{label}</span>
                    </label>
                    {sectionId === 'jobs-billing' && (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.8125rem',
                          color: '#6b7280',
                        }}
                      >
                        <span>Min HCP (inclusive)</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={jobsBillingMinHcp}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10)
                            setJobsBillingMinHcp(
                              Number.isFinite(v) && v >= 0 ? v : DEFAULT_JOBS_BILLING_MIN_HCP,
                            )
                          }}
                          style={{
                            width: '4.5rem',
                            padding: '0.2rem 0.35rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            fontSize: '0.8125rem',
                          }}
                        />
                      </label>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function QuickfillSectionWrapper({
  id,
  label,
  withTopDivider,
  color,
  collapsed,
  mark,
  onMarkUpToDate,
  onOpenNow,
  children,
}: {
  id: string
  label: string
  withTopDivider: boolean
  color: ButtonColor
  collapsed: boolean
  mark: { marked_at: string; marked_by?: string; marked_by_name?: string | null } | undefined
  onMarkUpToDate: () => void
  onOpenNow: () => void
  children: ReactNode
}) {
  return (
    <div
      id={id}
      style={{
        marginBottom: '2rem',
        ...(withTopDivider ? { borderTop: '2px solid #94a3b8', paddingTop: '1.5rem' } : {}),
      }}
    >
      <h2 style={QUICKFILL_SECTION_TITLE_STYLE}>{label}</h2>
      {collapsed ? (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 6,
            fontSize: '0.875rem',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <span>
            {label} — Marked up to date at {mark ? formatTime(mark.marked_at) : ''}{mark?.marked_by_name ? ` by ${mark.marked_by_name}` : ''}. Expands automatically in {mark ? `${hoursUntilExpand(mark.marked_at)}h` : '12h'}.
          </span>
          <button
            type="button"
            onClick={onOpenNow}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 6,
              background: 'white',
              border: '1px solid #22c55e',
              color: '#166534',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Open now
          </button>
        </div>
      ) : (
        <>
          {children}
          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={onMarkUpToDate}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                background: BUTTON_BG[color],
                border: `1px solid ${BUTTON_BORDER[color]}`,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              Mark {label} up to date!
            </button>
          </div>
        </>
      )}
    </div>
  )
}
