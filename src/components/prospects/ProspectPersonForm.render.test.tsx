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
  it('a paste from Google Maps fills the company, the address and the link, sets the source, and clears itself (v2.5604)', () => {
    const onCompany = vi.fn()
    const onSource = vi.fn()
    render(<ProspectPersonForm person={EMPTY_PERSON} onPerson={() => {}} company={EMPTY_COMPANY} onCompany={onCompany} onSource={onSource} kind="sub" />)
    const box = screen.getByLabelText('Paste from Google Maps') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Bexar Fire' } })
    expect(onCompany).not.toHaveBeenCalled()
    expect(box.value).toBe('Bexar Fire')
    fireEvent.change(box, { target: { value: 'Bexar Fire Protection\n1800 Cibolo Trail, Boerne, TX 78006\nhttps://maps.app.goo.gl/x7QzAbc' } })
    expect(onCompany).toHaveBeenCalledWith({ ...EMPTY_COMPANY, company: 'Bexar Fire Protection', address: '1800 Cibolo Trail, Boerne, TX 78006', mapsUrl: 'https://maps.app.goo.gl/x7QzAbc' })
    expect(onSource).toHaveBeenCalledWith('Google Maps')
    expect(box.value).toBe('')
    expect(screen.getByLabelText('License')).toBeTruthy()
  })
})
