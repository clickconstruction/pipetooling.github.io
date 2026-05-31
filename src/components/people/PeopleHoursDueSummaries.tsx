import { useState } from 'react'
import {
  getDaysInRange,
  HOURS_TAB_SECTION_CHEVRON,
  HOURS_TAB_SECTION_SHELL,
  HOURS_TAB_SECTION_TOGGLE_BTN,
  hoursTabSectionHeaderGap,
} from './peopleHoursTabShared'
import type { PeopleHoursTeam } from './PeopleHoursTeams'

export interface PeopleHoursDueSummariesProps {
  open: boolean
  onToggle: () => void
  matrixDays: string[]
  showPeopleForMatrix: string[]
  costMatrixTags: Record<string, string>
  teamsFiltered: PeopleHoursTeam[]
  teamPeriodStart: string
  teamPeriodEnd: string
  hoursDateStart: string
  hoursDateEnd: string
  getCostForPersonDateMatrix: (personName: string, workDate: string) => number
  getEffectiveHours: (personName: string, workDate: string) => number
  getCostForPersonDateTeams: (personName: string, workDate: string) => number
}

export function PeopleHoursDueSummaries({
  open,
  onToggle,
  matrixDays,
  showPeopleForMatrix,
  costMatrixTags,
  teamsFiltered,
  teamPeriodStart,
  teamPeriodEnd,
  hoursDateStart,
  hoursDateEnd,
  getCostForPersonDateMatrix,
  getEffectiveHours,
  getCostForPersonDateTeams,
}: PeopleHoursDueSummariesProps) {
  const [tagLedgerModalTag, setTagLedgerModalTag] = useState<string | null>(null)
  const [teamLedgerModalTeam, setTeamLedgerModalTeam] = useState<PeopleHoursTeam | null>(null)

  return (
    <>
      <section id="people-hours-due-summaries" style={HOURS_TAB_SECTION_SHELL}>
        <div style={hoursTabSectionHeaderGap(open)}>
          <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            style={HOURS_TAB_SECTION_TOGGLE_BTN}
          >
            <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{open ? '▼' : '▶'}</span>
            Due by Trade / Team
          </button>
        </div>
        {open ? (
          <>
            {(() => {
              const matrixTotal = matrixDays.reduce(
                (daySum, d) => daySum + showPeopleForMatrix.reduce((s, p) => s + getCostForPersonDateMatrix(p, d), 0),
                0
              )
              const tagTotals = new Map<string, number>()
              const tagHours = new Map<string, number>()
              for (const personName of showPeopleForMatrix) {
                const periodCost = matrixDays.reduce((s, d) => s + getCostForPersonDateMatrix(personName, d), 0)
                const periodHrs = matrixDays.reduce((s, d) => s + getEffectiveHours(personName, d), 0)
                const tags = (costMatrixTags[personName] ?? '').split(',').map((t) => t.trim()).filter(Boolean)
                for (const tag of tags) {
                  tagTotals.set(tag, (tagTotals.get(tag) ?? 0) + periodCost)
                  tagHours.set(tag, (tagHours.get(tag) ?? 0) + periodHrs)
                }
              }
              const sortedTags = [...tagTotals.entries()].sort((a, b) => b[1] - a[1])
              if (sortedTags.length === 0) return null
              return (
                <section style={{ marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9375rem' }}>Due by Trade</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                    {sortedTags.map(([tag, total]) => {
                      const pct = matrixTotal > 0 ? Math.round((total / matrixTotal) * 100) : 0
                      const hrs = tagHours.get(tag) ?? 0
                      const costPerHr = hrs > 0 ? `$${(total / hrs).toFixed(1)}/hr` : '—'
                      return (
                        <span
                          key={tag}
                          role="button"
                          tabIndex={0}
                          onClick={() => setTagLedgerModalTag(tag)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTagLedgerModalTag(tag) } }}
                          style={{ fontWeight: 500, cursor: 'pointer' }}
                          title="Click to view ledger"
                        >
                          {tag} ${Math.round(total).toLocaleString('en-US')} | {pct}% | {costPerHr}
                        </span>
                      )
                    })}
                  </div>
                </section>
              )
            })()}
            {teamsFiltered.length > 0 && (
              <section style={{ marginBottom: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9375rem' }}>Due by Team:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem' }}>
                  {teamsFiltered.map((team) => {
                    const costForRange = (start: string, end: string) =>
                      team.members.reduce((sum, p) => sum + getDaysInRange(start, end).reduce((s, d) => s + getCostForPersonDateTeams(p, d), 0), 0)
                    const periodCost = costForRange(teamPeriodStart, teamPeriodEnd)
                    return (
                      <span
                        key={team.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setTeamLedgerModalTeam(team)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTeamLedgerModalTeam(team) } }}
                        style={{ fontWeight: 500, cursor: 'pointer' }}
                        title="Click to view ledger"
                      >
                        {team.name}: ${Math.round(periodCost).toLocaleString('en-US')}
                      </span>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        ) : null}
      </section>
      {tagLedgerModalTag && (() => {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const peopleWithTag = showPeopleForMatrix.filter((p) =>
          (costMatrixTags[p] ?? '').split(',').map((t) => t.trim()).filter(Boolean).includes(tagLedgerModalTag)
        )
        const daysInRange = getDaysInRange(hoursDateStart, hoursDateEnd)
        const memberCostByWeekday = peopleWithTag.map((personName) => {
          const byDay = dayNames.map((_, dayOfWeek) => {
            const matchingDays = daysInRange.filter((d) => new Date(d + 'T12:00:00').getDay() === dayOfWeek)
            return matchingDays.reduce((sum, d) => sum + getCostForPersonDateMatrix(personName, d), 0)
          })
          const total = byDay.reduce((s, v) => s + v, 0)
          return { personName, byDay, total }
        })
        const costByWeekday = dayNames.map((_, dayOfWeek) =>
          memberCostByWeekday.reduce((s, r) => s + (r.byDay[dayOfWeek] ?? 0), 0)
        )
        const periodTotal = costByWeekday.reduce((s, v) => s + v, 0)
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setTagLedgerModalTag(null)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: 8,
                padding: '1rem 1.25rem',
                maxWidth: '90vw',
                maxHeight: '85vh',
                overflow: 'auto',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                  {tagLedgerModalTag} — Week of {hoursDateStart} to {hoursDateEnd}
                </h3>
                <button
                  type="button"
                  onClick={() => setTagLedgerModalTag(null)}
                  style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Close
                </button>
              </div>
              <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Person</th>
                    {dayNames.map((name) => (
                      <th key={name} style={{ padding: '0.25rem 0.35rem', textAlign: 'right', minWidth: 50 }}>{name}</th>
                    ))}
                    <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {memberCostByWeekday.map(({ personName, byDay, total }) => (
                    <tr key={personName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.2rem 0.5rem' }}>{personName}</td>
                      {byDay.map((val, i) => (
                        <td key={dayNames[i]} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                      ))}
                      <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${Math.round(total).toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                    <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                    {costByWeekday.map((val, i) => (
                      <td key={dayNames[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                    ))}
                    <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${Math.round(periodTotal).toLocaleString('en-US')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}
      {teamLedgerModalTeam && (() => {
        const team = teamLedgerModalTeam
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const daysInRange = getDaysInRange(teamPeriodStart, teamPeriodEnd)
        const memberCostByWeekday = team.members.map((personName) => {
          const byDay = dayNames.map((_, dayOfWeek) => {
            const matchingDays = daysInRange.filter((d) => new Date(d + 'T12:00:00').getDay() === dayOfWeek)
            return matchingDays.reduce((sum, d) => sum + getCostForPersonDateTeams(personName, d), 0)
          })
          const total = byDay.reduce((s, v) => s + v, 0)
          return { personName, byDay, total }
        })
        const costByWeekday = dayNames.map((_, dayOfWeek) =>
          memberCostByWeekday.reduce((s, r) => s + (r.byDay[dayOfWeek] ?? 0), 0)
        )
        const periodTotal = costByWeekday.reduce((s, v) => s + v, 0)
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setTeamLedgerModalTeam(null)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: 8,
                padding: '1rem 1.25rem',
                maxWidth: '90vw',
                maxHeight: '85vh',
                overflow: 'auto',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                  {team.name} — {teamPeriodStart} to {teamPeriodEnd}
                </h3>
                <button
                  type="button"
                  onClick={() => setTeamLedgerModalTeam(null)}
                  style={{ padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  Close
                </button>
              </div>
              <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.25rem 0.5rem', textAlign: 'left' }}>Person</th>
                    {dayNames.map((name) => (
                      <th key={name} style={{ padding: '0.25rem 0.35rem', textAlign: 'right', minWidth: 50 }}>{name}</th>
                    ))}
                    <th style={{ padding: '0.25rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {memberCostByWeekday.map(({ personName, byDay, total }) => (
                    <tr key={personName} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.2rem 0.5rem' }}>{personName}</td>
                      {byDay.map((val, i) => (
                        <td key={dayNames[i]} style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                      ))}
                      <td style={{ padding: '0.2rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>${Math.round(total).toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid #e5e7eb', fontWeight: 600 }}>
                    <td style={{ padding: '0.25rem 0.5rem' }}>Total</td>
                    {costByWeekday.map((val, i) => (
                      <td key={dayNames[i]} style={{ padding: '0.25rem 0.35rem', textAlign: 'right' }}>${Math.round(val).toLocaleString('en-US')}</td>
                    ))}
                    <td style={{ padding: '0.25rem 0.5rem', textAlign: 'right' }}>${Math.round(periodTotal).toLocaleString('en-US')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}
    </>
  )
}
