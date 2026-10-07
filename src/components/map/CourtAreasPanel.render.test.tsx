// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CourtAreasPanel, type CourtAreaListed } from './CourtAreasPanel'

const area = (id: string, county: string, precinct: string): CourtAreaListed => ({
  id, county, precinct, label: '', source: 'drawn', sourceNote: '', active: true, createdAt: '2026-10-07T03:00:00Z',
  polygon: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
})

describe('CourtAreasPanel (v2.4769)', () => {
  it('says the coverage, lists the areas by county with their source, and names a drawn shape before saving it', () => {
    const onSave = vi.fn()
    const onRemove = vi.fn()
    render(<CourtAreasPanel areas={[area('a', 'Guadalupe', '2'), area('b', 'Bexar', '1')]} coverage={{ placed: 40, outside: 6, onLine: 2, outsideLabels: [], onLineLabels: [] }} pending busy={false} error={null} onSave={onSave} onCancelPending={() => {}} onRename={() => {}} onRemove={onRemove} onFocus={() => {}} />)
    expect(document.querySelector('[data-court-coverage]')!.textContent).toBe('40 of 46 addresses inside a drawn area · 6 outside every area · 2 on a line to settle')
    expect(screen.getByText('Bexar County').parentElement!.textContent).toContain('JP Pct 1')
    expect(screen.getAllByText(/drawn by the office · 2026-10-07/)).toHaveLength(2)
    const save = screen.getByRole('button', { name: 'Save the area' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(screen.getByText('Name the county.')).toBeTruthy()
    fireEvent.change(screen.getAllByLabelText('County')[0]!, { target: { value: 'Guadalupe' } })
    fireEvent.change(screen.getAllByLabelText('Precinct')[0]!, { target: { value: '2' } })
    expect(screen.getByText(/Guadalupe precinct 2 is already drawn/)).toBeTruthy()
    fireEvent.change(screen.getAllByLabelText('Precinct')[0]!, { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Drawn from'), { target: { value: 'county PDF, 2024' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledWith({ county: 'Guadalupe', precinct: '3', label: '', sourceNote: 'county PDF, 2024' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]!)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('Classify now runs the night’s job by hand and shows what it said (v2.4770)', () => {
    const onClassify = vi.fn()
    render(<CourtAreasPanel areas={[area('a', 'Guadalupe', '2')]} coverage={{ placed: 1, outside: 0, onLine: 0, outsideLabels: [], onLineLabels: [] }} pending={false} busy={false} error={null} onSave={() => {}} onCancelPending={() => {}} onRename={() => {}} onRemove={() => {}} onFocus={() => {}} onClassify={onClassify} classifyWords="40 placed · 6 outside · 2 on a line · 0 with no point · 3 records written" />)
    fireEvent.click(screen.getByRole('button', { name: 'Classify now' }))
    expect(onClassify).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-court-classify-words]')!.textContent).toContain('3 records written')
  })

  it('with nothing drawn it says so, and a rename goes out with the new words', () => {
    const onRename = vi.fn()
    render(<CourtAreasPanel areas={[area('a', 'Guadalupe', '2')]} coverage={{ placed: 0, outside: 0, onLine: 0, outsideLabels: [], onLineLabels: [] }} pending={false} busy={false} error="Could not save." onSave={() => {}} onCancelPending={() => {}} onRename={onRename} onRemove={() => {}} onFocus={() => {}} />)
    expect(screen.getByText('No pins with a point on the map yet.')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toBe('Could not save.')
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Seguin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onRename).toHaveBeenCalledWith('a', { county: 'Guadalupe', precinct: '2', label: 'Seguin', sourceNote: '' })
  })
})
