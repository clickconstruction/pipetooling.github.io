// @vitest-environment jsdom
/**
 * Render smokes for the Job Address autocomplete (v2.2338): typing past the
 * minimum fetches suggestions (debounced), the dropdown bolds the match and
 * carries the required Google attribution, picking one fills the field in
 * Title Case + statement shape and pre-warms the geocode cache, and Escape
 * dismisses until the next edit.
 */
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { JobFormIdentityFields } from './JobFormIdentityFields'
import { jobKind } from '../../lib/jobs/jobKind'

const invoke = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}))

const SUGGESTIONS = {
  suggestions: [
    { main: '1207 Kingsbury Ln', mainMatchEnd: 9, secondary: 'Kingsbury, TX, USA', full: '1207 Kingsbury Ln, Kingsbury, TX 78638, USA' },
    { main: '1207 Kings Hwy', mainMatchEnd: 9, secondary: 'San Antonio, TX, USA', full: '1207 Kings Hwy, San Antonio, TX 78204, USA' },
  ],
}

function Harness() {
  const [jobAddress, setJobAddress] = useState('')
  const [jobName, setJobName] = useState('')
  const [hcp, setHcp] = useState('')
  const [click, setClick] = useState('')
  const [svc, setSvc] = useState('')
  return (
    <JobFormIdentityFields
      hcpNumber={hcp}
      setHcpNumber={setHcp}
      clickNumber={click}
      setClickNumber={setClick}
      jobName={jobName}
      setJobName={setJobName}
      jobAddress={jobAddress}
      setJobAddress={setJobAddress}
      formServiceTypeId={svc}
      setFormServiceTypeId={setSvc}
      serviceTypeOptions={[{ id: 'p', name: 'Plumbing' }]}
      tradePill={null}
      onTradePillClick={() => {}}
    />
  )
}

beforeEach(() => {
  cleanup()
  invoke.mockReset()
  invoke.mockResolvedValue({ data: SUGGESTIONS, error: null })
})

async function typeAddress(value: string) {
  const input = screen.getByPlaceholderText('Address') as HTMLInputElement
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
  return input
}

describe('JobFormIdentityFields address autocomplete', () => {
  it('fetches after the minimum length and renders bold-matched suggestions with Google attribution', async () => {
    render(<Harness />)
    await typeAddress('1207 king')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy(), { timeout: 2000 })
    expect(invoke).toHaveBeenCalledWith('address-autocomplete', { body: { input: '1207 king' } })
    expect(screen.getAllByText('1207 King').length).toBeGreaterThan(0) // bold match segment
    expect(screen.getByText('Kingsbury, TX')).toBeTruthy() // locality, USA stripped
    expect(screen.getByText('powered by Google')).toBeTruthy()
  })

  it('takes a suggestion on click: field fills in saved shape, geocode pre-warms, dropdown closes', async () => {
    render(<Harness />)
    const input = await typeAddress('1207 king')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy(), { timeout: 2000 })
    fireEvent.mouseDown(screen.getByText('sbury Ln'))
    expect(input.value).toBe('1207 Kingsbury Ln, Kingsbury, TX 78638')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(invoke).toHaveBeenCalledWith('geocode-address-batch', {
      body: { addresses: ['1207 Kingsbury Ln, Kingsbury, TX 78638'] },
    })
  })

  it('keyboard: arrows move the highlight, Enter takes, Escape dismisses until the next edit', async () => {
    render(<Harness />)
    const input = await typeAddress('1207 king')
    await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy(), { timeout: 2000 })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('1207 Kings Hwy, San Antonio, TX 78204')
    // dismissal: type again → dropdown returns; Escape → gone until next edit
    fireEvent.change(input, { target: { value: '1207 kingf' } })
    await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy(), { timeout: 2000 })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('stays a plain input below the minimum length and when the function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'nope' } })
    render(<Harness />)
    await typeAddress('120')
    await new Promise((r) => setTimeout(r, 450))
    expect(invoke).not.toHaveBeenCalled()
    await typeAddress('1207 king')
    await new Promise((r) => setTimeout(r, 450))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('JobFormIdentityFields kind control (punch list #238)', () => {
  function KindHarness({ onPress, read, busy }: { onPress: (k: 'service' | 'project') => void; read: ReturnType<typeof jobKind>; busy?: boolean }) {
    return (
      <JobFormIdentityFields
        hcpNumber=""
        setHcpNumber={() => {}}
        clickNumber="1031"
        setClickNumber={() => {}}
        jobName="Harbor Lane Offices"
        setJobName={() => {}}
        jobAddress=""
        setJobAddress={() => {}}
        formServiceTypeId=""
        setFormServiceTypeId={() => {}}
        serviceTypeOptions={[{ id: 'p', name: 'Plumbing' }]}
        tradePill={null}
        onTradePillClick={() => {}}
        kind={{ read, onPress, busy }}
      />
    )
  }

  it('draws no control without the kind prop', () => {
    render(<Harness />)
    expect(screen.queryByTestId('job-form-kind')).toBeNull()
  })

  it('defaults to Project from the bid with the reason under it, and a press hands back the other kind', () => {
    const onPress = vi.fn()
    render(<KindHarness onPress={onPress} read={jobKind({ bid_id: 'b1', bidNumber: 'B917', revenue: 112000, firstWorkDate: null })} />)
    const project = screen.getByRole('button', { name: 'Project' })
    const service = screen.getByRole('button', { name: 'Service call' })
    expect(project.getAttribute('aria-pressed')).toBe('true')
    expect(service.getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('job-form-kind-reason').textContent).toBe('Project · priced $112,000 from bid B917. Change it if that is wrong.')
    fireEvent.click(service)
    expect(onPress).toHaveBeenCalledWith('service')
  })

  it('waits for the press when the signals settle nothing, and says what each kind means', () => {
    const onPress = vi.fn()
    render(<KindHarness onPress={onPress} read={jobKind({ click_number: '1031', firstWorkDate: null })} />)
    expect(screen.getByRole('button', { name: 'Project' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Service call' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('job-form-kind-reason').textContent).toContain('your call')
    expect(screen.getByTestId('job-form-kind-reason').textContent).toContain('A project is priced before it starts')
    fireEvent.click(screen.getByRole('button', { name: 'Project' }))
    expect(onPress).toHaveBeenCalledWith('project')
  })

  it('both presses wait while a save is on its way', () => {
    render(<KindHarness onPress={() => {}} read={jobKind({ kind: 'service' })} busy />)
    expect((screen.getByRole('button', { name: 'Project' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Service call' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
