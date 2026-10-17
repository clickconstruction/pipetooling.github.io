// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ProspectPersonForm } from './ProspectPersonForm'
import { EMPTY_COMPANY, EMPTY_PERSON, rowFromBlocks } from '../../lib/prospects/personBlock'

describe('ProspectPersonForm (v2.5601)', () => {
  afterEach(cleanup)

  it('draws the person first, then the company, and reports each box as typed', () => {
    const onPerson = vi.fn()
    const onCompany = vi.fn()
    render(<ProspectPersonForm person={EMPTY_PERSON} onPerson={onPerson} company={EMPTY_COMPANY} onCompany={onCompany} kind="gc_lead" double={<p role="status">a double</p>} />)
    const labels = [...document.querySelectorAll('label > span, div > span')].map((s) => s.textContent).filter((t) => t && /^[A-Z]/.test(t))
    expect(labels.indexOf('Name')).toBeLessThan(labels.indexOf('Company'))
    expect(screen.getByText(/leave it empty for a person on their own/)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('a double')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dana Whitlock' } })
    expect(onPerson).toHaveBeenLastCalledWith({ ...EMPTY_PERSON, name: 'Dana Whitlock' })
    fireEvent.click(screen.getByLabelText('Yes'))
    expect(onPerson).toHaveBeenLastCalledWith({ ...EMPTY_PERSON, okToText: 'yes' })
    fireEvent.click(screen.getByLabelText('Spanish'))
    expect(onPerson).toHaveBeenLastCalledWith({ ...EMPTY_PERSON, lang: 'es' })
    fireEvent.change(screen.getByLabelText('Office phone'), { target: { value: '(210) 555-0188' } })
    expect(onCompany).toHaveBeenLastCalledWith({ ...EMPTY_COMPANY, officePhone: '(210) 555-0188' })
  })

  it('on a sub the company hint names the bench, and an empty company block makes a person', () => {
    render(<ProspectPersonForm person={{ ...EMPTY_PERSON, name: 'Dana' }} onPerson={() => {}} company={EMPTY_COMPANY} onCompany={() => {}} kind="sub" />)
    expect(screen.getByText(/the company on the bench/)).toBeTruthy()
    expect(rowFromBlocks({ ...EMPTY_PERSON, name: 'Dana' }, EMPTY_COMPANY).is_person).toBe(true)
  })
})
