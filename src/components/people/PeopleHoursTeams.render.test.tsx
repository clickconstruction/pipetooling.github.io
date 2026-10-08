// @vitest-environment jsdom
/**
 * People → Hours → Teams (#46 row 6, v2.4953): the section reads and writes through the one
 * `teams` value `usePeopleHoursTeams` returns. Open or closed, the period cost, the writes a pay
 * viewer gets, the delete confirm, max hours, and read-only for everyone else.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PeopleHoursTeams, type PeopleHoursTeamsProps } from './PeopleHoursTeams'
import type { PeopleHoursTeamsApi } from '../../hooks/usePeopleHoursTeams'

afterEach(cleanup)

function teamsApi(over: Partial<PeopleHoursTeamsApi> = {}): PeopleHoursTeamsApi {
  return {
    setTeams: vi.fn(),
    teamsFiltered: [{ id: 't1', name: 'Service', members: ['Sam Lee', 'Jo Park'] }],
    // Two days: 2026-09-21 and 2026-09-22.
    teamPeriodStart: '2026-09-21',
    setTeamPeriodStart: vi.fn(),
    teamPeriodEnd: '2026-09-22',
    setTeamPeriodEnd: vi.fn(),
    showMaxHoursTeams: false,
    setShowMaxHoursTeams: vi.fn(),
    teamToDelete: null,
    setTeamToDelete: vi.fn(),
    teamDeletingId: null,
    loadTeams: vi.fn(() => Promise.resolve()),
    addTeam: vi.fn(() => Promise.resolve()),
    updateTeamName: vi.fn(() => Promise.resolve()),
    addTeamMember: vi.fn(() => Promise.resolve()),
    removeTeamMember: vi.fn(() => Promise.resolve()),
    deleteTeam: vi.fn(() => Promise.resolve()),
    getCostForPersonDateTeams: vi.fn(() => 100),
    ...over,
  }
}

function renderTeams(over: Partial<PeopleHoursTeamsProps> = {}) {
  const props: PeopleHoursTeamsProps = {
    open: true,
    onToggle: vi.fn(),
    canAccessPay: true,
    showPeopleForMatrix: ['Sam Lee', 'Jo Park', 'Ana Ruiz'],
    teams: teamsApi(),
    ...over,
  }
  render(<PeopleHoursTeams {...props} />)
  return props
}

describe('PeopleHoursTeams', () => {
  it('closed, it is a toggle only', () => {
    const props = renderTeams({ open: false })
    const toggle = screen.getByRole('button', { name: /Teams/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Add team')).toBeNull()
    fireEvent.click(toggle)
    expect(props.onToggle).toHaveBeenCalledTimes(1)
  })

  it('prices the period from the teams value: two people, two days, $100 a day', () => {
    renderTeams()
    expect(screen.getByText('Period: $400')).toBeTruthy()
    expect((screen.getByDisplayValue('2026-09-21') as HTMLInputElement).type).toBe('date')
  })

  it("a pay viewer's writes go to the teams value", () => {
    const props = renderTeams()
    const t = props.teams
    fireEvent.click(screen.getByRole('button', { name: 'Add team' }))
    expect(t.addTeam).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByDisplayValue('2026-09-22'), { target: { value: '2026-09-28' } })
    expect(t.setTeamPeriodEnd).toHaveBeenCalledWith('2026-09-28')
    // The add-person list leaves out who is already on the team.
    const select = screen.getByDisplayValue('+ Add person') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['', 'Ana Ruiz'])
    fireEvent.change(select, { target: { value: 'Ana Ruiz' } })
    expect(t.addTeamMember).toHaveBeenCalledWith('t1', 'Ana Ruiz')
    fireEvent.blur(screen.getByDisplayValue('Service'), { target: { value: '  ' } })
    expect(t.updateTeamName).toHaveBeenCalledWith('t1', 'New Team')
    fireEvent.click(screen.getByRole('button', { name: 'Delete team Service' }))
    expect(t.setTeamToDelete).toHaveBeenCalledWith({ id: 't1', name: 'Service' })
    fireEvent.click(screen.getByLabelText('show max hours'))
    expect(t.setShowMaxHoursTeams).toHaveBeenCalledWith(true)
  })

  it('removes a member from its chip', () => {
    const props = renderTeams()
    // The name is also a row of the weekday cost table; the chip is the one with a remove button.
    const chip = screen.getAllByText('Jo Park').find((el) => el.querySelector('button'))!
    fireEvent.click(chip.querySelector('button')!)
    expect(props.teams.removeTeamMember).toHaveBeenCalledWith('t1', 'Jo Park')
  })

  it('the delete confirm deletes the team the value names', () => {
    const props = renderTeams({ teams: teamsApi({ teamToDelete: { id: 't1', name: 'Service' } }) })
    expect(screen.getByText('Delete team?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(props.teams.deleteTeam).toHaveBeenCalledWith('t1')
  })

  it('without pay access the section is read-only', () => {
    renderTeams({ canAccessPay: false })
    expect(screen.queryByRole('button', { name: 'Add team' })).toBeNull()
    expect(screen.queryByDisplayValue('Service')).toBeNull()
    expect(screen.getByText('Service')).toBeTruthy()
    expect(screen.queryByDisplayValue('+ Add person')).toBeNull()
  })
})
