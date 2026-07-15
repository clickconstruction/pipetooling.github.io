import type { Dispatch, SetStateAction } from 'react'
import {
  getDaysInRange,
  HOURS_TAB_SECTION_CHEVRON,
  HOURS_TAB_SECTION_SHELL,
  HOURS_TAB_SECTION_TOGGLE_BTN,
  hoursTabSectionHeaderGap,
} from './peopleHoursTabShared'
import { WeekdayCostTable } from './WeekdayCostTable'

export type PeopleHoursTeam = { id: string; name: string; members: string[] }

export interface PeopleHoursTeamsProps {
  open: boolean
  onToggle: () => void
  canAccessPay: boolean
  teamPeriodStart: string
  setTeamPeriodStart: (v: string) => void
  teamPeriodEnd: string
  setTeamPeriodEnd: (v: string) => void
  teamsFiltered: PeopleHoursTeam[]
  setTeams: Dispatch<SetStateAction<PeopleHoursTeam[]>>
  showPeopleForMatrix: string[]
  showMaxHoursTeams: boolean
  setShowMaxHoursTeams: (v: boolean) => void
  addTeam: () => void
  updateTeamName: (teamId: string, name: string) => void
  addTeamMember: (teamId: string, personName: string) => void
  removeTeamMember: (teamId: string, personName: string) => void
  deleteTeam: (teamId: string) => void
  teamToDelete: { id: string; name: string } | null
  setTeamToDelete: (v: { id: string; name: string } | null) => void
  teamDeletingId: string | null
  getCostForPersonDateTeams: (personName: string, workDate: string) => number
}

export function PeopleHoursTeams({
  open,
  onToggle,
  canAccessPay,
  teamPeriodStart,
  setTeamPeriodStart,
  teamPeriodEnd,
  setTeamPeriodEnd,
  teamsFiltered,
  setTeams,
  showPeopleForMatrix,
  showMaxHoursTeams,
  setShowMaxHoursTeams,
  addTeam,
  updateTeamName,
  addTeamMember,
  removeTeamMember,
  deleteTeam,
  teamToDelete,
  setTeamToDelete,
  teamDeletingId,
  getCostForPersonDateTeams,
}: PeopleHoursTeamsProps) {
  return (
    <>
      <section id="people-hours-teams" style={HOURS_TAB_SECTION_SHELL}>
        <div style={hoursTabSectionHeaderGap(open)}>
          <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            style={HOURS_TAB_SECTION_TOGGLE_BTN}
          >
            <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{open ? '▼' : '▶'}</span>
            Teams
          </button>
        </div>
        {open ? (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                <input type="date" value={teamPeriodStart} onChange={(e) => setTeamPeriodStart(e.target.value)} style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
              </label>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                <input type="date" value={teamPeriodEnd} onChange={(e) => setTeamPeriodEnd(e.target.value)} style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }} />
              </label>
              {canAccessPay && (
                <button type="button" onClick={addTeam} style={{ padding: '0.35rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem' }}>
                  Add team
                </button>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
              Add people to teams to see combined cost for a date range (default: last 7 days).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {teamsFiltered.map((team) => {
                const teamsReadOnly = !canAccessPay
                const costForRange = (start: string, end: string) =>
                  team.members.reduce((sum, p) => sum + getDaysInRange(start, end).reduce((s, d) => s + getCostForPersonDateTeams(p, d), 0), 0)
                const today = new Date().toLocaleDateString('en-CA')
                const yesterday = (() => {
                  const d = new Date()
                  d.setDate(d.getDate() - 1)
                  return d.toLocaleDateString('en-CA')
                })()
                const last7Start = (() => {
                  const d = new Date()
                  d.setDate(d.getDate() - 6)
                  return d.toLocaleDateString('en-CA')
                })()
                const last3Start = (() => {
                  const d = new Date()
                  d.setDate(d.getDate() - 2)
                  return d.toLocaleDateString('en-CA')
                })()
                const periodCost = costForRange(teamPeriodStart, teamPeriodEnd)
                const last7Cost = costForRange(last7Start, today)
                const last3Cost = costForRange(last3Start, today)
                const yesterdayCost = costForRange(yesterday, yesterday)
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                const daysInRange = getDaysInRange(teamPeriodStart, teamPeriodEnd)
                const memberCostByWeekday = team.members.map((m) => {
                  const byDay = dayNames.map((_, dayOfWeek) => {
                    const matchingDays = daysInRange.filter((d) => new Date(d + 'T12:00:00').getDay() === dayOfWeek)
                    return matchingDays.reduce((sum, d) => sum + getCostForPersonDateTeams(m, d), 0)
                  })
                  const total = byDay.reduce((s, v) => s + v, 0)
                  return { member: m, byDay, total }
                })
                return (
                  <div key={team.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.5rem 0.75rem', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      {teamsReadOnly ? (
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{team.name}</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                          <input
                            type="text"
                            value={team.name}
                            onChange={(e) => setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t)))}
                            onBlur={(e) => updateTeamName(team.id, e.target.value.trim() || 'New Team')}
                            style={{ padding: '0.2rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontWeight: 600, minWidth: 100, fontSize: '0.875rem' }}
                          />
                          <button
                            type="button"
                            aria-label={`Delete team ${team.name}`}
                            title="Delete team"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setTeamToDelete({ id: team.id, name: team.name })}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0.15rem 0.35rem',
                              fontSize: '1rem',
                              lineHeight: 1,
                              color: 'var(--text-muted)',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
                        <span style={{ fontWeight: 600 }}>Period: ${Math.round(periodCost).toLocaleString('en-US')}</span>
                        <span style={{ color: 'var(--text-muted)' }}>7d: ${Math.round(last7Cost).toLocaleString('en-US')}</span>
                        <span style={{ color: 'var(--text-muted)' }}>3d: ${Math.round(last3Cost).toLocaleString('en-US')}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Yesterday: ${Math.round(yesterdayCost).toLocaleString('en-US')}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {team.members.map((m) => (
                        <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.15rem 0.35rem', background: 'var(--bg-200)', borderRadius: 4, fontSize: '0.75rem' }}>
                          {m}
                          {!teamsReadOnly && (
                            <button type="button" onClick={() => removeTeamMember(team.id, m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.875rem' }}>×</button>
                          )}
                        </span>
                      ))}
                      {!teamsReadOnly && (
                        <select
                          value=""
                          onChange={(e) => {
                            const v = e.target.value
                            if (v) { addTeamMember(team.id, v); e.target.value = '' }
                          }}
                          style={{ padding: '0.15rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.75rem' }}
                        >
                          <option value="">+ Add person</option>
                          {showPeopleForMatrix.filter((p) => !team.members.includes(p)).map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <WeekdayCostTable
                      marginTop="0.5rem"
                      rows={memberCostByWeekday.map((r) => ({ label: r.member, byDay: r.byDay, total: r.total }))}
                    />
                  </div>
                )
              })}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.75rem', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showMaxHoursTeams}
                onChange={(e) => setShowMaxHoursTeams(e.target.checked)}
              />
              show max hours
            </label>
          </>
        ) : null}
      </section>
      {teamToDelete ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 12,
          }}
          onClick={() => {
            if (!teamDeletingId) setTeamToDelete(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="people-delete-team-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              padding: '1.5rem',
              borderRadius: 8,
              minWidth: 320,
              maxWidth: 'min(92vw, 420px)',
            }}
          >
            <h3 id="people-delete-team-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem' }}>
              Delete team?
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-600)', margin: '0 0 1rem', lineHeight: 1.45 }}>
              Delete <strong>{teamToDelete.name}</strong>? All people on this team will be removed from it. This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={!!teamDeletingId}
                onClick={() => setTeamToDelete(null)}
                style={{
                  padding: '0.45rem 0.85rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  cursor: teamDeletingId ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!teamDeletingId}
                onClick={() => void deleteTeam(teamToDelete.id)}
                style={{
                  padding: '0.45rem 0.85rem',
                  border: '1px solid #b91c1c',
                  borderRadius: 4,
                  background: '#b91c1c',
                  color: 'white',
                  cursor: teamDeletingId ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {teamDeletingId ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
