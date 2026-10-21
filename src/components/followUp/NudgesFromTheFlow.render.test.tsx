// @vitest-environment jsdom
/**
 * Follow up's Nudges from the flow over the flows' demo people (`nudgeRows` on their day, over the seed flows): one row a
 * person, worst first, with the steps its one message names, our move, why and the presses. A press acts on its own row,
 * a row's buttons wait while its press runs, and the section says when nothing is quiet, while it reads and when it
 * could not read. Nothing here is a real row.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NOW, demoPeople } from '../../lib/flows/demoPeople.fixture'
import { FLOW_FIXTURE_PEOPLE } from '../../lib/flows/flowFixtures'
import { nudgeNamesOf, type NudgeKind, type NudgePerson } from '../../lib/flows/flowNudgesIo'
import { nudgeRows, type NudgeRow } from '../../lib/flows/nudges'
import { SEED_FLOWS } from '../../lib/flows/seed'
import { stepById } from '../../lib/flows/state'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { NUDGES_EMPTY, NUDGES_LOADING, NudgesFromTheFlow, type NudgesFromTheFlowProps } from './NudgesFromTheFlow'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const ROWS = nudgeRows(demoPeople(), NOW)
const NAMES = new Map<string, NudgePerson>(
  FLOW_FIXTURE_PEOPLE.filter((p) => p.kind !== 'unknown').map((p) => [
    p.contactId,
    { ...nudgeNamesOf({ name: p.name, goes_by: null, company: p.company }), kind: p.kind as NudgeKind },
  ]),
)
const FLOWS = { customer: SEED_FLOWS.customer, trade: SEED_FLOWS.trade, arch: SEED_FLOWS.arch }

function draw(patch: Partial<NudgesFromTheFlowProps> = {}) {
  const props: NudgesFromTheFlowProps = {
    rows: ROWS,
    names: NAMES,
    flows: FLOWS,
    pressing: null,
    onOpenThread: vi.fn(),
    onHold: vi.fn(),
    onRemindNow: vi.fn(),
    ...patch,
  }
  renderWithProviders(<NudgesFromTheFlow {...props} />)
  return props
}

const rowOf = (contactId: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(`[data-nudge-row="${contactId}"]`)
  if (!row) throw new Error(`no row for ${contactId}`)
  return row
}
const rowFor = (contactId: string): NudgeRow => {
  const row = ROWS.find((r) => r.contactId === contactId)
  if (!row) throw new Error(`no nudge row for ${contactId}`)
  return row
}

describe('NudgesFromTheFlow', () => {
  it('draws one row a person, worst first, with the steps its message names, our move, why and the presses', () => {
    draw()
    expect(ROWS.map((r) => r.contactId)).toEqual(['priya', 'greg', 'jonah'])
    expect(screen.getByRole('heading', { name: 'Nudges from the flow (3)' })).toBeTruthy()
    expect([...document.querySelectorAll('[data-nudge-row]')].map((el) => el.getAttribute('data-nudge-row'))).toEqual(['priya', 'greg', 'jonah'])

    const greg = within(rowOf('greg'))
    expect(greg.getByRole('button', { name: 'Hillside Excavation' })).toBeTruthy()
    expect(greg.getByText('Asked to quote')).toBeTruthy()
    expect(greg.getByText('Our move · a text')).toBeTruthy()
    expect(greg.getByText('late 2 days · waiting on their quote · insurance expired')).toBeTruthy()
    expect(greg.getByRole('button', { name: 'Text Greg' })).toBeTruthy()
    expect(greg.getByRole('button', { name: 'Hold until Mon' })).toBeTruthy()
    expect(greg.getByRole('button', { name: 'Remind now' })).toBeTruthy()
    // Papers in lapsed, but Greg's one message is about the quote, so its pill is not drawn.
    expect(greg.queryByText('Papers in')).toBeNull()

    // Jonah's one message names both steps on now, and the flow asked for an email.
    const jonah = within(rowOf('jonah'))
    for (const id of ['certify', 'questions']) expect(jonah.getByText(stepById(SEED_FLOWS.arch, id)?.name ?? id)).toBeTruthy()
    expect(jonah.getByText('Our move · an email')).toBeTruthy()
    expect(jonah.getByRole('button', { name: `Email ${NAMES.get('jonah')?.first}` })).toBeTruthy()
  })

  it('acts on its own row: the name and the nudge open the thread, and Hold until Mon and Remind now hand over the row', () => {
    const props = draw()
    const greg = within(rowOf('greg'))
    fireEvent.click(greg.getByRole('button', { name: 'Hillside Excavation' }))
    fireEvent.click(greg.getByRole('button', { name: 'Text Greg' }))
    expect(props.onOpenThread).toHaveBeenCalledTimes(2)
    expect(props.onOpenThread).toHaveBeenNthCalledWith(1, 'greg')
    expect(props.onOpenThread).toHaveBeenNthCalledWith(2, 'greg')

    fireEvent.click(greg.getByRole('button', { name: 'Hold until Mon' }))
    expect(props.onHold).toHaveBeenCalledTimes(1)
    expect(props.onHold).toHaveBeenCalledWith(rowFor('greg'))
    fireEvent.click(within(rowOf('jonah')).getByRole('button', { name: 'Remind now' }))
    expect(props.onRemindNow).toHaveBeenCalledTimes(1)
    expect(props.onRemindNow).toHaveBeenCalledWith(rowFor('jonah'))
  })

  it("waits on a row while its press runs, and only that row's buttons", () => {
    draw({ pressing: 'greg' })
    for (const name of ['Text Greg', 'Hold until Mon', 'Remind now']) {
      expect((within(rowOf('greg')).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    }
    for (const name of ['Hold until Mon', 'Remind now']) {
      expect((within(rowOf('jonah')).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false)
    }
  })

  it('says when no step is quiet, while it reads, and when it could not read', () => {
    draw({ rows: [] })
    expect(screen.getByRole('heading', { name: 'Nudges from the flow (0)' })).toBeTruthy()
    expect(screen.getByText(NUDGES_EMPTY)).toBeTruthy()
    cleanup()

    // Reading: the empty line never shows before the rows come.
    draw({ rows: [], loading: true })
    expect(screen.getByText(NUDGES_LOADING)).toBeTruthy()
    expect(screen.queryByText(NUDGES_EMPTY)).toBeNull()
    cleanup()

    // A failed read says so, above the rows it last read.
    draw({ problem: 'Read the threads: timed out' })
    expect(screen.getByRole('alert').textContent).toBe('The nudges did not load. Read the threads: timed out')
    expect(document.querySelectorAll('[data-nudge-row]')).toHaveLength(3)
  })
})
