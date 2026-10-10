// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { GcPunchList, type PunchWrites } from './GcPunchList'
import { punchCanAdd } from '../../lib/gc/punchRows'
import { GcPunchWindow } from './GcPunchWindow'
import { initialGcState } from '../../lib/gc/schedule/testState'
import { plainWordsFailures } from '../../lib/plainWords'
import type { GcProject, GcState } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const writesFn = (): { [K in keyof PunchWrites]: ReturnType<typeof vi.fn> } => ({ onAdd: vi.fn(), onRemove: vi.fn(), onFixedIn: vi.fn(), onCheck: vi.fn() })

/** Fair Oaks D's Concrete: one item to fix, one fixed waiting on our check, one checked. */
function setup(change?: (p: GcProject) => GcProject, pkgId = 'fconc') {
  const base = initialGcState()
  const found = base.projects.find((p) => p.id === 'fairoaksd')!
  const project = change ? change(found) : found
  const pkg = project.packages.find((k) => k.id === pkgId)!
  const writes = writesFn()
  render(<GcPunchList project={project} pkg={pkg} company="Guadalupe Flatwork" writes={writes} />)
  return { writes, project, pkg }
}
const item = (id: string) => document.querySelector(`[data-punch-item="${id}"]`) as HTMLElement

describe('GcPunchList', () => {
  it('reads Concrete’s three items in their three states', () => {
    setup()
    expect(document.querySelector('[data-punch-count]')!.textContent).toBe('2 of 3 still open.')
    expect([...document.querySelectorAll('[data-punch-item]')].map((el) => (el as HTMLElement).dataset.punchState)).toEqual(['open', 'fixed', 'done'])
    expect(item('fairoaksd-punch-1').textContent).toContain('to fix')
    expect(item('fairoaksd-punch-1').textContent).toContain('Grid C-4')
    expect(item('fairoaksd-punch-2').textContent).toContain('Guadalupe Flatwork fixed it Oct 1')
    expect(item('fairoaksd-punch-3').textContent).toContain('checked Oct 1')
  })

  it('records an open item fixed on their word, and takes an untouched one off after asking', () => {
    const { writes } = setup()
    fireEvent.click(within(item('fairoaksd-punch-1')).getByRole('button', { name: 'They say it is fixed' }))
    expect(writes.onFixedIn).toHaveBeenCalledWith('fairoaksd-punch-1')
    fireEvent.click(within(item('fairoaksd-punch-1')).getByRole('button', { name: 'Take it off' }))
    const ask = item('fairoaksd-punch-1').querySelector('[data-punch-remove]') as HTMLElement
    expect(ask.textContent).toContain('Take “Patch the spalled corner on the column footing” off the punch list? It stays in the record.')
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep it' }))
    expect(writes.onRemove).not.toHaveBeenCalled()
    fireEvent.click(within(item('fairoaksd-punch-1')).getByRole('button', { name: 'Take it off' }))
    fireEvent.click(within(item('fairoaksd-punch-1').querySelector('[data-punch-remove]') as HTMLElement).getByRole('button', { name: 'Take it off' }))
    expect(writes.onRemove).toHaveBeenCalledWith('fairoaksd-punch-1')
  })

  it('offers no Take it off on an item sent back, since they have worked on it', () => {
    setup((p) => ({ ...p, punch: (p.punch ?? []).map((i) => (i.id === 'fairoaksd-punch-1' ? { ...i, sentBack: { times: 1, note: 'Still chipped.', on: '2026-10-01' } } : i)) }))
    expect(within(item('fairoaksd-punch-1')).queryByRole('button', { name: 'Take it off' })).toBeNull()
    expect(item('fairoaksd-punch-1').querySelector('[data-punch-back]')!.textContent).toBe('Sent back once, last Oct 1. Still chipped.')
  })

  it('checks a fixed item, or sends it back held until it says what is still wrong', () => {
    const { writes } = setup()
    fireEvent.click(within(item('fairoaksd-punch-2')).getByRole('button', { name: 'Checked, it is fixed' }))
    expect(writes.onCheck).toHaveBeenCalledWith('fairoaksd-punch-2', true)
    fireEvent.click(within(item('fairoaksd-punch-2')).getByRole('button', { name: 'Not fixed' }))
    const send = within(item('fairoaksd-punch-2')).getByRole('button', { name: 'Send it back' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(within(item('fairoaksd-punch-2')).getByRole('textbox', { name: 'What is still wrong' }), { target: { value: ' A joint is still open. ' } })
    fireEvent.click(send)
    expect(writes.onCheck).toHaveBeenCalledWith('fairoaksd-punch-2', false, 'A joint is still open.')
  })

  it('adds an item with where it is and its photo link', () => {
    const { writes } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Add an item' }))
    const add = screen.getByRole('button', { name: 'Add to the punch list' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'A punch item for Guadalupe Flatwork' }), { target: { value: 'Grind the lip at the door' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Where on the job' }), { target: { value: 'Front door' } })
    fireEvent.change(screen.getByRole('textbox', { name: "A photo's Drive link" }), { target: { value: 'https://drive.google.com/file/d/lip' } })
    fireEvent.click(add)
    expect(writes.onAdd).toHaveBeenCalledWith('fconc', { text: 'Grind the lip at the door', where: 'Front door', photoUrl: 'https://drive.google.com/file/d/lip' })
  })

  it('offers no line to add on our own crew, on work accepted, or on a job not being built', () => {
    const base = initialGcState()
    const p = base.projects.find((x) => x.id === 'fairoaksd')!
    const conc = p.packages.find((k) => k.id === 'fconc')!
    const plumb = p.packages.find((k) => k.id === 'fplumb')!
    expect(punchCanAdd(p, conc)).toBe(true)
    expect(punchCanAdd(p, plumb)).toBe(false)
    expect(punchCanAdd(p, { ...conc, sow: { ...conc.sow!, acceptedOn: '2026-10-01' } })).toBe(false)
    expect(punchCanAdd({ ...p, closedOn: '2026-10-02' }, conc)).toBe(false)
  })

  it('says each thing a first-timer reads in plain words', () => {
    setup()
    fireEvent.click(within(item('fairoaksd-punch-1')).getByRole('button', { name: 'Take it off' }))
    const said = [
      document.querySelector('[data-punch-why]')!.textContent!,
      (item('fairoaksd-punch-1').querySelector('[data-punch-remove] span') as HTMLElement).textContent!,
      document.querySelector('[data-punch-count]')!.textContent!,
      'Nothing listed yet.',
      'Sent back once, last Oct 1. Still chipped.',
    ]
    for (const words of said) expect(plainWordsFailures(words), words).toEqual([])
  })
})

describe('GcPunchWindow', () => {
  it('has a list for each trade we hired with a signed statement of work, none for our own crew', () => {
    const base = initialGcState()
    const project = base.projects.find((p) => p.id === 'fairoaksd')!
    const state: GcState = base
    render(<GcPunchWindow state={state} project={project} writes={writesFn()} onClose={() => undefined} />)
    expect(screen.getByRole('dialog', { name: 'Fair Oaks Shops, Building D: Punch list' })).toBeTruthy()
    expect([...document.querySelectorAll('[data-punch-trade]')].map((el) => (el as HTMLElement).dataset.punchTrade)).toEqual(['fsite', 'fconc', 'fsteel', 'felec', 'froof', 'fhvac'])
    expect(document.querySelector('[data-punch-trade="fconc"]')!.textContent).toContain('2 of 3 still open.')
    for (const words of [document.querySelector('[data-punch-lede]')!.textContent!, document.querySelector('[role="dialog"] p')!.textContent!]) {
      expect(plainWordsFailures(words), words).toEqual([])
    }
  })

  it('closes on Escape', () => {
    const base = initialGcState()
    const onClose = vi.fn()
    render(<GcPunchWindow state={base} project={base.projects.find((p) => p.id === 'fairoaksd')!} writes={writesFn()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
