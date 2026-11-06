// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { defaultLevels, type MachineQuestion } from '../../lib/machines/machines'
import type { MachineTemplate } from '../../lib/machines/machinesIo'
import type { TemplatesIo } from '../../lib/machines/templatesIo'
import { MachineTemplatesSettingsCard } from './MachineTemplatesSettingsCard'

vi.mock('../../hooks/useAuth', () => useAuthModuleMock({ profileName: 'Carla Nguyen', role: 'dev' }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => Promise.resolve({ data: [] }) }) } }))

const templates: MachineTemplate[] = [
  { id: 't1', name: 'Small excavator', kind: 'excavator', size: 'small', levels: defaultLevels('excavator'), sort: 10, active: true },
  { id: 't4', name: 'Skid steer', kind: 'skid_steer', size: null, levels: defaultLevels('skid_steer'), sort: 40, active: true },
]
const questions: MachineQuestion[] = [
  { id: 'q1', templateId: null, machineId: null, words: 'Hydraulic hoses and cylinders, no leaks', holdsMachine: true, when: 'pre' },
  { id: 'q2', templateId: null, machineId: null, words: 'Nothing new broken or leaking since the morning', holdsMachine: true, when: 'post' },
  { id: 'q3', templateId: 't1', machineId: null, words: 'Bucket pins, teeth and the thumb tight', holdsMachine: true, when: 'pre' },
]
function fakeIo(): TemplatesIo & { saved: unknown[] } {
  const saved: unknown[] = []
  return {
    saved,
    load: async () => ({ templates, questions }),
    saveTemplate: async (t) => {
      saved.push(['template', t])
      return t.id ?? 't-new'
    },
    retireTemplate: async (id) => {
      saved.push(['retire', id])
    },
    saveQuestions: async (templateId, rows) => {
      saved.push(['questions', templateId, rows.map((r) => r.words)])
    },
  }
}

describe('Settings → Machine templates', () => {
  afterEach(() => cleanup())

  it('lists the templates as tabs, opens one with its gauges and own questions, and saves both', async () => {
    const io = fakeIo()
    renderWithProviders(<MachineTemplatesSettingsCard io={io} />)
    expect(await screen.findByRole('tab', { name: 'Small excavator' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Small excavator' }))
    expect(document.querySelectorAll('[data-gauge-row]')).toHaveLength(4)
    expect(screen.getByDisplayValue('Bucket pins, teeth and the thumb tight')).toBeTruthy()
    fireEvent.click(screen.getByText('Save Small excavator'))
    await vi.waitFor(() => expect(io.saved.length).toBe(2))
    expect(io.saved[0]).toEqual(['template', expect.objectContaining({ id: 't1', name: 'Small excavator', kind: 'excavator', size: 'small' })])
    expect(io.saved[1]).toEqual(['questions', 't1', ['Bucket pins, teeth and the thumb tight']])
  })

  it('every machine’s walk and the leaving check are their own lists', async () => {
    const io = fakeIo()
    renderWithProviders(<MachineTemplatesSettingsCard io={io} />)
    expect(await screen.findByDisplayValue('Hydraulic hoses and cylinders, no leaks')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'The leaving check' }))
    expect(screen.getByDisplayValue('Nothing new broken or leaking since the morning')).toBeTruthy()
    fireEvent.click(screen.getByText('Add one'))
    fireEvent.change(screen.getByLabelText('Question 2'), { target: { value: 'Keys with the lead' } })
    fireEvent.click(screen.getByText('Save 2 questions'))
    await vi.waitFor(() => expect(io.saved[0]).toEqual(['questions', null, ['Nothing new broken or leaking since the morning', 'Keys with the lead']]))
  })
})
