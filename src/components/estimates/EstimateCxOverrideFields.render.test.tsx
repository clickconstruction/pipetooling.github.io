// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { EstimateExperienceOverrideKey } from '../../lib/estimateCustomerExperience'
import { CX_OVERRIDE_SECTIONS, type CxOverrideFields } from '../../lib/estimates/estimateCxOverrideSections'
import EstimateCxOverrideFields from './EstimateCxOverrideFields'

const DEFAULTS = new Proxy({} as Record<EstimateExperienceOverrideKey, string>, { get: (_t, k) => `default ${String(k)}` })

/** The editor over real state, so each functional setter runs as the page runs it. */
function Harness({ section, initial = {}, omit, onFields }: { section: 0 | 1 | 2; initial?: CxOverrideFields; omit?: EstimateExperienceOverrideKey[]; onFields: (f: CxOverrideFields) => void }) {
  const [fields, setFields] = useState<CxOverrideFields>(initial)
  onFields(fields)
  return <EstimateCxOverrideFields section={CX_OVERRIDE_SECTIONS[section]} omitKeys={omit ? new Set(omit) : undefined} fields={fields} setFields={setFields} defaults={DEFAULTS} />
}

afterEach(cleanup)

describe('EstimateCxOverrideFields', () => {
  it('shows the organization’s copy in a field with no override', () => {
    render(<Harness section={2} onFields={() => {}} />)
    expect((screen.getByLabelText('Thank you heading') as HTMLTextAreaElement).value).toBe('default thank_you_title')
    expect((screen.getByLabelText('Thank you body') as HTMLTextAreaElement).value).toBe('default thank_you_body')
    expect(screen.getByText('Shown after submit or if the customer opens an already-used link.')).toBeTruthy()
  })

  it('keeps a change as an override, and drops it when the field is cleared or typed back', () => {
    let fields: CxOverrideFields = {}
    render(<Harness section={2} onFields={(f) => (fields = f)} />)
    const box = screen.getByLabelText('Thank you heading')
    fireEvent.change(box, { target: { value: 'Thank you, neighbor' } })
    expect(fields).toEqual({ thank_you_title: 'Thank you, neighbor' })
    fireEvent.change(box, { target: { value: 'default thank_you_title' } })
    expect(fields).toEqual({})
    fireEvent.change(box, { target: { value: 'Again' } })
    fireEvent.change(box, { target: { value: '' } })
    expect(fields).toEqual({})
    // A cleared field shows the organization's copy again.
    expect((box as HTMLTextAreaElement).value).toBe('default thank_you_title')
  })

  it('hides the footer with an empty override and locks its box', () => {
    let fields: CxOverrideFields = {}
    render(<Harness section={1} onFields={(f) => (fields = f)} />)
    const tick = screen.getByLabelText('Hide company footer on this quote (acceptance page only)') as HTMLInputElement
    const box = screen.getByLabelText('Acceptance page footer (below sign-off)') as HTMLTextAreaElement
    expect(tick.checked).toBe(false)
    expect(box.disabled).toBe(false)
    fireEvent.click(tick)
    expect(fields).toEqual({ accept_page_footer: '' })
    expect(box.disabled).toBe(true)
    expect(box.value).toBe('')
    fireEvent.click(tick)
    expect(fields).toEqual({})
    expect(box.value).toBe('default accept_page_footer')
  })

  it('leaves out the fields the estimate has no use for', () => {
    render(<Harness section={1} omit={['doc_title_fallback', 'doc_valid_through_prefix']} onFields={() => {}} />)
    expect(screen.queryByLabelText('Document title fallback (empty estimate title)')).toBeNull()
    expect(screen.queryByLabelText('“Expires on” line prefix (before date)')).toBeNull()
    expect(screen.getByLabelText('Line items heading')).toBeTruthy()
  })

  it('draws every field of the section with nothing left out', () => {
    render(<Harness section={1} onFields={() => {}} />)
    expect(screen.getByLabelText('Document title fallback (empty estimate title)')).toBeTruthy()
    expect(screen.getAllByRole('textbox')).toHaveLength(CX_OVERRIDE_SECTIONS[1].keys.length)
  })
})
