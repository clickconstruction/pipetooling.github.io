// @vitest-environment jsdom
/**
 * The schedule builder's Templates page (punch list #204, PR 3) on main's test state with its io handed in: the
 * list with the quick-lube shell and an old-shape template, the kind filter, New template opening an empty
 * editor, the editor's words and its save disabled until the draft can go, a row added and named, and Save
 * handing the body and the version to the io.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ConfirmDialogProvider } from '../../contexts/ConfirmDialogContext'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { quickLubeTemplate } from '../../lib/gc/schedule/testTemplate'
import { templateShape } from '../../lib/gc/schedule/templates'
import type { ScheduleTemplate } from '../../lib/gc/schedule/types'
import { GcTemplatesPage, type TemplatesIo } from './GcTemplatesPage'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const old: ScheduleTemplate = { id: 'tpl-old', name: 'Fair Oaks Shops, Building D', on: '2026-10-06', by: 'Dana', ...templateShape(s, fairOaks)!, rows: undefined, phases: undefined, workingDays: undefined } as ScheduleTemplate
const quick = quickLubeTemplate({ by: 'Dana' })

function fakeIo(templates: ScheduleTemplate[] = [quick, old]): TemplatesIo & { save: ReturnType<typeof vi.fn> } {
  return {
    load: vi.fn(() => Promise.resolve(templates)),
    save: vi.fn(() => Promise.resolve('tpl-new')),
    saveFromJob: vi.fn(() => Promise.resolve('tpl-job')),
    rename: vi.fn(() => Promise.resolve()),
    setAside: vi.fn(() => Promise.resolve()),
  }
}

function page(io: TemplatesIo, openAt: string | null = null) {
  return render(
    <ConfirmDialogProvider>
      <GcTemplatesPage state={s} trades={['Sitework', 'Plumbing']} io={io} openAt={openAt} />
    </ConfirmDialogProvider>,
  )
}

describe('the Templates page', () => {
  it('lists every current template with its kind, rows, phases, weeks and who saved it, and filters by kind', async () => {
    const io = fakeIo()
    const { container } = page(io)
    const quickRow = await screen.findByText('Quick-lube shell, 2 bays')
    expect(quickRow).toBeTruthy()
    const row = container.querySelector('[data-template="tpl-quicklube-3"]')!
    expect(row.textContent).toContain('version 1')
    expect(row.textContent).toContain('Quick lube')
    expect(row.textContent).toContain('Tue Oct 27 by Dana')
    const oldRow = container.querySelector('[data-template="tpl-old"]')!
    expect(oldRow.textContent).toContain('from a job')
    expect(oldRow.textContent).toContain('by stage')
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'Quick lube' } })
    expect(container.querySelector('[data-template="tpl-old"]')).toBeNull()
    expect(container.querySelector('[data-template="tpl-quicklube-3"]')).toBeTruthy()
  })

  it('says what fills an empty list and offers New template', async () => {
    page(fakeIo([]))
    expect(await screen.findByText(/No templates yet/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'New template' }).length).toBeGreaterThan(0)
  })

  it('opens an empty editor on New template, where Save waits on a name, a phase and a row', async () => {
    const io = fakeIo()
    page(io)
    fireEvent.click((await screen.findAllByRole('button', { name: 'New template' }))[0]!)
    expect(screen.getByText('Nothing to draw yet. Add a phase, then a row. 0 rows, 0 phases, 0 milestones.')).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Save the template' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(screen.getByText('Give it a name.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText("The template's name"), { target: { value: 'ZZ test shell' } })
    expect(screen.getByText('A template needs at least one phase.')).toBeTruthy()
  })

  it('opens a template in the editor, adds a row to a phase, names it, and hands the save its body and version', async () => {
    const io = fakeIo()
    const { container } = page(io, 'tpl-quicklube-3')
    expect(await screen.findByText(/^Makes \d+ weeks from a Monday start\. 52 rows, 8 phases, 6 milestones\.$/)).toBeTruthy()
    expect(screen.getByText('version 1')).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Save as version 2' }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
    expect(container.querySelectorAll('tr[data-row]')).toHaveLength(52)
    // A row added to the last phase: unnamed, so the save waits on its name.
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a row' })[0]!)
    expect(container.querySelectorAll('tr[data-row]')).toHaveLength(53)
    expect(screen.getByText(/^Name row \d+ in Commissioning and closeout\.$/)).toBeTruthy()
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Row 6 in Commissioning and closeout'), { target: { value: 'Owner training' } })
    expect(screen.getByText(/53 rows, 8 phases, 6 milestones\.$/)).toBeTruthy()
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    const [body, versionOf] = io.save.mock.calls[0] as [{ name: string; rows: { label: string }[]; workingDays: boolean; on: string }, string | null]
    expect(versionOf).toBe('tpl-quicklube-3')
    expect(body).toMatchObject({ name: 'Quick-lube shell, 2 bays', workingDays: true, on: s.today })
    expect(body.rows.map((r) => r.label)).toContain('Owner training')
    await waitFor(() => expect(io.load).toHaveBeenCalledTimes(2))
  })
})

describe('Paste rows (PR 4)', () => {
  it('opens a new template with the paste box up, reads the paste as it is typed, and Add puts the rows on the draft', async () => {
    const io = fakeIo()
    const { container } = page(io)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Paste rows' }))[0]!)
    expect(container.querySelector('[data-paste-box]')).toBeTruthy()
    expect(screen.getByText('No row read yet.')).toBeTruthy()
    const add = () => screen.getByRole('button', { name: /^Add( \d+)? rows?$/ }) as HTMLButtonElement
    expect(add().disabled).toBe(true)
    expect(add().textContent).toBe('Add rows')
    const T = '\t'
    fireEvent.change(screen.getByLabelText('Pasted rows'), { target: { value: [['Precon', 'Notice to proceed', 'Office', '5'].join(T), ['', 'Start date', '', '', 'Notice to proceed', '5', 'yes'].join(T), 'no tab here'].join('\n') } })
    expect(screen.getByText('Read 2 rows in 1 phase, 1 of them a date to meet.')).toBeTruthy()
    expect(screen.getByText('Line 3 has no tab between the phase and the row.')).toBeTruthy()
    expect(add().textContent).toBe('Add 2 rows')
    fireEvent.click(add())
    expect(container.querySelector('[data-paste-box]')).toBeNull()
    expect(container.querySelectorAll('tr[data-row]')).toHaveLength(2)
    expect(screen.getByText(/^Makes \d+ weeks? from a Monday start\. 2 rows, 1 phase, 1 milestone\.$/)).toBeTruthy()
  })
})
