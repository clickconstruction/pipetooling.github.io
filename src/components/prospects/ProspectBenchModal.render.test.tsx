// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProspectBenchModal } from './ProspectBenchModal'
import type { BenchDraft } from '../../lib/prospects/prospectKinds'

const draft: BenchDraft = {
  name: 'Bexar Fire Protection',
  trades: ['Fire sprinkler', 'HVAC'],
  contactName: 'Tomás Reyna',
  phone: '(210) 555-0188',
  email: 'bids@bexarfire.example',
  address: '1800 Cibolo Trail, Boerne',
  maxMiles: 40,
  known: false,
  lang: 'en',
}

describe('ProspectBenchModal (v2.5559)', () => {
  afterEach(cleanup)

  it("opens as the bench's Add a company, filled from the sub, and saves the draft", () => {
    const onSave = vi.fn()
    render(<ProspectBenchModal draft={draft} saving={false} error={null} onSave={onSave} onCancel={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Add a company' })).toBeTruthy()
    expect((screen.getByLabelText('Company') as HTMLInputElement).value).toBe('Bexar Fire Protection')
    expect((screen.getByLabelText(/Trades/) as HTMLInputElement).value).toBe('Fire sprinkler, HVAC')
    expect((screen.getByLabelText('Goes up to (miles)') as HTMLInputElement).value).toBe('40')
    expect((screen.getByLabelText('English') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save to the bench' }))
    expect(onSave).toHaveBeenCalledWith({
      name: 'Bexar Fire Protection',
      trades: ['Fire sprinkler', 'HVAC'],
      contactName: 'Tomás Reyna',
      phone: '(210) 555-0188',
      email: 'bids@bexarfire.example',
      address: '1800 Cibolo Trail, Boerne',
      maxMiles: 40,
      known: false,
      lang: 'en',
    })
  })

  it('holds a save with no trade named, and says why', () => {
    const onSave = vi.fn()
    render(<ProspectBenchModal draft={{ ...draft, trades: [] }} saving={false} error={null} onSave={onSave} onCancel={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save to the bench' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Name the trade they do.')).toBeTruthy()
  })

  it('takes what the caller changes: a second trade, Spanish, worked with them before', () => {
    const onSave = vi.fn()
    render(<ProspectBenchModal draft={{ ...draft, trades: ['Fire sprinkler'], maxMiles: null, lang: undefined }} saving={false} error={null} onSave={onSave} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/Trades/), { target: { value: 'Fire sprinkler, Plumbing' } })
    fireEvent.click(screen.getByLabelText('Spanish'))
    fireEvent.click(screen.getByLabelText('We have worked with them before'))
    fireEvent.click(screen.getByRole('button', { name: 'Save to the bench' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ trades: ['Fire sprinkler', 'Plumbing'], lang: 'es', known: true, maxMiles: null }))
  })

  it('shows the server refusal and never cancels while saving', () => {
    const onCancel = vi.fn()
    render(<ProspectBenchModal draft={draft} saving error="Pick the trade they do." onSave={() => {}} onCancel={onCancel} />)
    expect(screen.getByText('Pick the trade they do.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy()
  })

  it('shows the license and the Google Maps boxes filled from the sub, and saves them (v2.5603)', () => {
    const onSave = vi.fn()
    render(<ProspectBenchModal draft={{ name: 'Bexar Fire Protection', trades: ['Fire sprinkler'], contactName: 'Tomás Reyna', phone: '(210) 555-0122', email: '', address: '', maxMiles: null, known: false, license: 'TX SCR-1884', mapsUrl: 'https://maps.app.goo.gl/x7Qz' }} saving={false} error={null} onSave={onSave} onCancel={() => {}} />)
    expect((screen.getByLabelText('License') as HTMLInputElement).value).toBe('TX SCR-1884')
    expect((screen.getByLabelText('Google Maps') as HTMLInputElement).value).toBe('https://maps.app.goo.gl/x7Qz')
    fireEvent.click(screen.getByRole('button', { name: 'Save to the bench' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ license: 'TX SCR-1884', mapsUrl: 'https://maps.app.goo.gl/x7Qz', phone: '(210) 555-0122' }))
  })
})
