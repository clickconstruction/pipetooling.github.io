// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FLOW_FIXTURE_NOW, flowFixture } from '../../../lib/flows/flowFixtures'
import { SEED_FLOWS } from '../../../lib/flows/seed'
import { flat, readFlow, stepReading } from '../../../lib/flows/state'
import { installDomShims } from '../../../test/renderSmokeMocks'
import { GcRoundWindow } from './GcRoundWindow'
import type { RoundSpec } from './gcRoundOpener'

installDomShims()

const priya = flowFixture('priya')
const reading = readFlow(SEED_FLOWS.customer, priya.stamps, FLOW_FIXTURE_NOW)
const step = flat(SEED_FLOWS.customer).find((s) => s.id === 'co')!
const SPEC: RoundSpec = {
  contactId: 'priya',
  who: { name: 'Dr. Priya Raman', firstName: 'Dr. Raman' },
  step,
  round: stepReading(reading, 'co', 'helotes')!.rounds[1]!,
  projectId: 'helotes',
  detail: { changeOrder: { what: 'a sink in exam 3', adds: null, days: null, sumBefore: null, sentOn: '2026-09-30', openedOn: null } },
  record: { partnerId: null, customerId: 'cu-priya' },
}

describe('GcRoundWindow', () => {
  it('reads a change order with its state, whether they opened it and its facts, and sends each press to the page', () => {
    const onAction = vi.fn()
    render(<GcRoundWindow spec={SPEC} onClose={vi.fn()} onAction={onAction} />)
    const win = within(screen.getByRole('dialog', { name: 'CO 2 · a sink in exam 3' }))
    expect(win.getByText('Change orders · Dr. Priya Raman')).toBeTruthy()
    expect(win.getByText('open since Sep 30')).toBeTruthy()
    expect(win.getByText('Dr. Raman has not opened it.')).toBeTruthy()
    expect(win.getByText('Wed Sep 30')).toBeTruthy()
    expect(win.queryByText('Adds')).toBeNull()
    fireEvent.click(win.getByRole('button', { name: 'Ask again' }))
    expect(onAction).toHaveBeenCalledWith('ask-again', SPEC)
  })

  it('closes on Close and on Escape', () => {
    const onClose = vi.fn()
    render(<GcRoundWindow spec={SPEC} onClose={onClose} onAction={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
