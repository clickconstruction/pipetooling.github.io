import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import DashboardTallyStaleStaffBanner from '../components/DashboardTallyStaleStaffBanner'
import { DashboardStaleTallyStaffFollowUpModal } from '../components/DashboardStaleTallyStaffFollowUpModal'
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
import { useStaleTallyStaffFollowUp } from '../hooks/useStaleTallyStaffFollowUp'
import { TALLY_STALE_MIN_AGE_DAYS } from '../lib/tallyStaleMinAgeDays'
import { withSupabaseRetry } from '../utils/errorHandling'

const SECTIONS: { id: string; sectionId: string; label: string }[] = [
  { id: 'quickfill-warnings', sectionId: 'warnings', label: 'Warnings' },
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

const APP_SETTINGS_KEY_QUICKFILL_HIDDEN = 'quickfill_hidden_section_ids'
const APP_SETTINGS_KEY_QUICKFILL_MIN_HCP = 'quickfill_jobs_billing_min_hcp'
const DEFAULT_JOBS_BILLING_MIN_HCP = 406

const VALID_SECTION_IDS = new Set(SECTIONS.map((s) => s.sectionId))

function parseHiddenSectionIdsFromValueText(raw: string | null | undefined): Set<string> {
  if (raw == null || raw === '') return new Set()
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && VALID_SECTION_IDS.has(id)))
  } catch {
    return new Set()
  }
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
  const { user: authUser, role } = useAuth()
  const unpricedFixturesCount = useUnpricedFixturesCount()
  const {
    peopleCount: staleTallyStaffPeopleCount,
    transactionCount: staleTallyStaffTxCount,
    refetch: refetchStaleTallyStaffFollowUp,
  } = useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)
  const [warningsModalOpen, setWarningsModalOpen] = useState(false)
  const [sectionMarks, setSectionMarks] = useState<Record<string, { marked_at: string; marked_by?: string; marked_by_name?: string | null }>>({})
  const [forceExpandedSections, setForceExpandedSections] = useState<Set<string>>(new Set(['cant-reach']))
  const [hiddenSectionIds, setHiddenSectionIds] = useState<Set<string>>(() => new Set())
  const [activeSectionsPanelOpen, setActiveSectionsPanelOpen] = useState(false)
  const [jobsBillingMinHcp, setJobsBillingMinHcp] = useState<number>(DEFAULT_JOBS_BILLING_MIN_HCP)

  const persistHiddenSectionIds = useCallback(async (hidden: Set<string>) => {
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('app_settings').upsert(
            { key: APP_SETTINGS_KEY_QUICKFILL_HIDDEN, value_text: JSON.stringify([...hidden]) },
            { onConflict: 'key' },
          ),
        'save quickfill hidden section ids',
      )
    } catch (e) {
      console.error(e)
    }
  }, [])

  const persistJobsBillingMinHcp = useCallback(async (n: number) => {
    try {
      await withSupabaseRetry(
        async () =>
          await supabase.from('app_settings').upsert(
            { key: APP_SETTINGS_KEY_QUICKFILL_MIN_HCP, value_num: n },
            { onConflict: 'key' },
          ),
        'save quickfill jobs billing min hcp',
      )
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase
              .from('app_settings')
              .select('key, value_text, value_num')
              .in('key', [APP_SETTINGS_KEY_QUICKFILL_HIDDEN, APP_SETTINGS_KEY_QUICKFILL_MIN_HCP]),
          'load quickfill layout settings',
        )
        if (cancelled) return
        let hidden = new Set<string>()
        let minHcp = DEFAULT_JOBS_BILLING_MIN_HCP
        const rowList = (rows ?? []) as Array<{ key: string; value_text: string | null; value_num: number | null }>
        for (const row of rowList) {
          const r = row
          if (r.key === APP_SETTINGS_KEY_QUICKFILL_HIDDEN) {
            hidden = parseHiddenSectionIdsFromValueText(r.value_text)
          } else if (r.key === APP_SETTINGS_KEY_QUICKFILL_MIN_HCP && r.value_num != null) {
            const n = Number(r.value_num)
            if (Number.isFinite(n) && n >= 0) minHcp = Math.floor(n)
          }
        }
        setHiddenSectionIds(hidden)
        setJobsBillingMinHcp(minHcp)
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('quickfill-app-settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings' },
        (payload) => {
          const row = payload.new as { key?: string; value_text?: string | null; value_num?: number | null } | null
          if (!row?.key) return
          if (row.key === APP_SETTINGS_KEY_QUICKFILL_HIDDEN) {
            setHiddenSectionIds(parseHiddenSectionIdsFromValueText(row.value_text))
          } else if (row.key === APP_SETTINGS_KEY_QUICKFILL_MIN_HCP && row.value_num != null) {
            const n = Number(row.value_num)
            if (Number.isFinite(n) && n >= 0) setJobsBillingMinHcp(Math.floor(n))
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  function isSectionVisible(sectionId: string): boolean {
    return !hiddenSectionIds.has(sectionId)
  }

  function devSetSectionVisible(sectionId: string, visible: boolean): void {
    setHiddenSectionIds((prev) => {
      const next = new Set(prev)
      if (visible) next.delete(sectionId)
      else next.add(sectionId)
      if (role === 'dev') {
        queueMicrotask(() => {
          void persistHiddenSectionIds(next)
        })
      }
      return next
    })
  }

  const warningsSectionOnPage = useMemo(() => {
    if (role !== 'dev' && role !== 'master_technician' && role !== 'assistant') return false
    if (!isSectionVisible('warnings')) return false
    if (staleTallyStaffPeopleCount === null || staleTallyStaffTxCount === null) return false
    return staleTallyStaffPeopleCount > 0 && staleTallyStaffTxCount > 0
  }, [role, hiddenSectionIds, staleTallyStaffPeopleCount, staleTallyStaffTxCount])

  /** True if this section would render a Quickfill block (visibility + unpriced count rule). */
  const sectionWouldRenderOnPage = useCallback(
    (sectionId: string): boolean => {
      if (!isSectionVisible(sectionId)) return false
      if (sectionId === 'warnings') return warningsSectionOnPage
      if (sectionId === 'unpriced-fixtures') return unpricedFixturesCount > 0
      return true
    },
    [hiddenSectionIds, warningsSectionOnPage, unpricedFixturesCount],
  )

  const hasAnyVisibleSection = SECTIONS.some(({ sectionId }) => sectionWouldRenderOnPage(sectionId))

  const firstVisibleSectionId = useMemo(() => {
    for (const { sectionId } of SECTIONS) {
      if (!sectionWouldRenderOnPage(sectionId)) continue
      return sectionId
    }
    return null
  }, [sectionWouldRenderOnPage])

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
        {SECTIONS.filter(({ sectionId }) => sectionWouldRenderOnPage(sectionId)).map(({ id, sectionId, label }) => {
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
          {role === 'dev' ? (
            <>
              All Quickfill sections are hidden. Use <strong>Active sections (Dev Only)</strong> below to show one or more sections again.
            </>
          ) : (
            <>
              All Quickfill sections are hidden. Ask a developer to restore sections on Quickfill (<strong>Active sections (Dev Only)</strong>).
            </>
          )}
        </p>
      )}
      {warningsSectionOnPage && (
        <QuickfillSectionWrapper
          id="quickfill-warnings"
          label="Warnings"
          withTopDivider={firstVisibleSectionId !== null && firstVisibleSectionId !== 'warnings'}
          color={getButtonColor(sectionMarks['warnings']?.marked_at ?? null)}
          collapsed={isCollapsed('warnings') && !forceExpandedSections.has('warnings')}
          mark={sectionMarks['warnings']}
          onMarkUpToDate={() => markSectionUpToDate('warnings')}
          onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'warnings']))}
        >
          <DashboardTallyStaleStaffBanner
            peopleCount={typeof staleTallyStaffPeopleCount === 'number' ? staleTallyStaffPeopleCount : 0}
            transactionCount={typeof staleTallyStaffTxCount === 'number' ? staleTallyStaffTxCount : 0}
            loading={
              staleTallyStaffPeopleCount === null || staleTallyStaffTxCount === null
            }
            minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
            onOpen={() => setWarningsModalOpen(true)}
          />
          <DashboardStaleTallyStaffFollowUpModal
            open={warningsModalOpen}
            onClose={() => setWarningsModalOpen(false)}
            minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
            onDataChanged={() => void refetchStaleTallyStaffFollowUp()}
          />
        </QuickfillSectionWrapper>
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
      {role === 'dev' && (
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
          Active sections (Dev Only)
        </button>
        {activeSectionsPanelOpen && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid #e5e7eb' }}>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280' }}>
              Uncheck a section to hide it from this page and from the jump buttons above for everyone. Settings are stored in the database.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {SECTIONS.map(({ sectionId, label }) => (
                <li key={sectionId}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={isSectionVisible(sectionId)}
                        onChange={(e) => devSetSectionVisible(sectionId, e.target.checked)}
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
                            const n = Number.isFinite(v) && v >= 0 ? v : DEFAULT_JOBS_BILLING_MIN_HCP
                            setJobsBillingMinHcp(n)
                            void persistJobsBillingMinHcp(n)
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
      )}
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
