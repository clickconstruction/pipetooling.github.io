import { useEffect, useState } from 'react'
import { BilledAwaitingPaymentSection } from '../components/quickfill/BilledAwaitingPaymentSection'
import { CantReachSection } from '../components/quickfill/CantReachSection'
import { CrewJobsSection } from '../components/quickfill/CrewJobsSection'
import { JobsBillingReminderSection } from '../components/quickfill/JobsBillingReminderSection'
import { UnpricedFixturesSection } from '../components/quickfill/UnpricedFixturesSection'
import { SupplyHousesSection } from '../components/quickfill/SupplyHousesSection'
import { HoursSection } from '../components/quickfill/HoursSection'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useUnpricedFixturesCount } from '../hooks/useUnpricedFixturesCount'

const SECTIONS: { id: string; sectionId: string; label: string }[] = [
  { id: 'quickfill-hours', sectionId: 'hours', label: 'Hours' },
  { id: 'quickfill-crew-jobs', sectionId: 'crew-jobs', label: 'Crew Jobs' },
  { id: 'quickfill-billed-awaiting', sectionId: 'billed-awaiting', label: 'Billing Awaiting Payments' },
  { id: 'quickfill-unpriced-fixtures', sectionId: 'unpriced-fixtures', label: 'Unpriced Fixtures' },
  { id: 'quickfill-cant-reach', sectionId: 'cant-reach', label: 'Unreachable Prospects' },
  { id: 'quickfill-supply-houses', sectionId: 'supply-houses', label: 'Supply Houses and Subs' },
  { id: 'quickfill-jobs-billing', sectionId: 'jobs-billing', label: 'Jobs Billing' },
]

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
        {SECTIONS.filter(({ sectionId }) => sectionId !== 'unpriced-fixtures' || unpricedFixturesCount > 0).map(({ id, sectionId, label }) => {
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
      <QuickfillSectionWrapper
        id="quickfill-hours"
        label="Hours"
        color={getButtonColor(sectionMarks['hours']?.marked_at ?? null)}
        collapsed={isCollapsed('hours') && !forceExpandedSections.has('hours')}
        mark={sectionMarks['hours']}
        onMarkUpToDate={() => markSectionUpToDate('hours')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'hours']))}
      >
        <HoursSection />
      </QuickfillSectionWrapper>
      <QuickfillSectionWrapper
        id="quickfill-crew-jobs"
        label="Crew Jobs"
        color={getButtonColor(sectionMarks['crew-jobs']?.marked_at ?? null)}
        collapsed={isCollapsed('crew-jobs') && !forceExpandedSections.has('crew-jobs')}
        mark={sectionMarks['crew-jobs']}
        onMarkUpToDate={() => markSectionUpToDate('crew-jobs')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'crew-jobs']))}
      >
        <CrewJobsSection />
      </QuickfillSectionWrapper>
      <QuickfillSectionWrapper
        id="quickfill-billed-awaiting"
        label="Billing Awaiting Payments"
        color={getButtonColor(sectionMarks['billed-awaiting']?.marked_at ?? null)}
        collapsed={isCollapsed('billed-awaiting') && !forceExpandedSections.has('billed-awaiting')}
        mark={sectionMarks['billed-awaiting']}
        onMarkUpToDate={() => markSectionUpToDate('billed-awaiting')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'billed-awaiting']))}
      >
        <BilledAwaitingPaymentSection />
      </QuickfillSectionWrapper>
      {unpricedFixturesCount > 0 && (
        <QuickfillSectionWrapper
          id="quickfill-unpriced-fixtures"
          label="Unpriced Fixtures"
          color={getButtonColor(sectionMarks['unpriced-fixtures']?.marked_at ?? null)}
          collapsed={isCollapsed('unpriced-fixtures') && !forceExpandedSections.has('unpriced-fixtures')}
          mark={sectionMarks['unpriced-fixtures']}
          onMarkUpToDate={() => markSectionUpToDate('unpriced-fixtures')}
          onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'unpriced-fixtures']))}
        >
          <UnpricedFixturesSection />
        </QuickfillSectionWrapper>
      )}
      <QuickfillSectionWrapper
        id="quickfill-cant-reach"
        label="Unreachable Prospects"
        color={getButtonColor(sectionMarks['cant-reach']?.marked_at ?? null)}
        collapsed={isCollapsed('cant-reach') && !forceExpandedSections.has('cant-reach')}
        mark={sectionMarks['cant-reach']}
        onMarkUpToDate={() => markSectionUpToDate('cant-reach')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'cant-reach']))}
      >
        <CantReachSection />
      </QuickfillSectionWrapper>
      <QuickfillSectionWrapper
        id="quickfill-supply-houses"
        label="Supply Houses and Subs"
        color={getButtonColor(sectionMarks['supply-houses']?.marked_at ?? null)}
        collapsed={isCollapsed('supply-houses') && !forceExpandedSections.has('supply-houses')}
        mark={sectionMarks['supply-houses']}
        onMarkUpToDate={() => markSectionUpToDate('supply-houses')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'supply-houses']))}
      >
        <SupplyHousesSection />
      </QuickfillSectionWrapper>
      <QuickfillSectionWrapper
        id="quickfill-jobs-billing"
        label="Jobs Billing"
        color={getButtonColor(sectionMarks['jobs-billing']?.marked_at ?? null)}
        collapsed={isCollapsed('jobs-billing') && !forceExpandedSections.has('jobs-billing')}
        mark={sectionMarks['jobs-billing']}
        onMarkUpToDate={() => markSectionUpToDate('jobs-billing')}
        onOpenNow={() => setForceExpandedSections((s) => new Set([...s, 'jobs-billing']))}
      >
        <JobsBillingReminderSection />
      </QuickfillSectionWrapper>
    </div>
  )
}

function QuickfillSectionWrapper({
  id,
  label,
  color,
  collapsed,
  mark,
  onMarkUpToDate,
  onOpenNow,
  children,
}: {
  id: string
  label: string
  color: ButtonColor
  collapsed: boolean
  mark: { marked_at: string; marked_by?: string; marked_by_name?: string | null } | undefined
  onMarkUpToDate: () => void
  onOpenNow: () => void
  children: React.ReactNode
}) {
  return (
    <div id={id} style={{ marginBottom: '2rem' }}>
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
