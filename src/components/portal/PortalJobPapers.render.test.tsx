// @vitest-environment jsdom
/**
 * Render smokes for what a GC reads about a job's papers (punch list #389, step 5), against a fixture: the block sits
 * under its job's name, says the level and the picks in plain words, counts who has signed, and lists each sub
 * business with its day. It names no worker and holds no press. Every name and word is made up.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, within } from '@testing-library/react'
import { parseGcJobPapers } from '../../lib/portal/gcJobPapers'
import { PortalJobPapers } from './PortalJobPapers'

afterEach(cleanup)

const JOBS = parseGcJobPapers([
  {
    jobId: 'job-1',
    jobLabel: 'J100 · Cedar Bluff',
    papers: [
      {
        id: 'row-1',
        name: 'Sample paper',
        settingsRevision: 1,
        level: { label: 'Standard', alignedWith: 'Aligned with a placeholder place' },
        said: [
          { label: 'Photos and video', choice: 'Standard', says: 'Placeholder: ask first.', out: false },
          { label: 'Phones', choice: 'Off', says: 'Placeholder: no rule.', out: true },
        ],
        signed: 3,
        total: 9,
        businesses: [
          { name: 'Pine Ridge Excavating', people: 2, signed: 2, signedOn: '2026-11-24' },
          { name: 'Sam Sole', people: 1, signed: 0, signedOn: null },
        ],
      },
    ],
  },
  { jobId: 'job-2', jobLabel: 'J200 · Marsh', papers: [{ id: 'row-2', name: 'Another sample paper', settingsRevision: 3, level: null, said: [], signed: 0, total: 0, businesses: [] }] },
])

const job = (id: string) => document.querySelector(`[data-portal-job-papers-job="${id}"]`) as HTMLElement

describe('PortalJobPapers', () => {
  it('draws nothing for a customer whose jobs require no such paper', () => {
    render(<PortalJobPapers jobs={[]} company="Made-up Plumbing" />)
    expect(document.querySelector('[data-portal-job-papers]')).toBeNull()
  })

  it('sits under the job’s name and says the level, the picks and the paper’s own name', () => {
    render(<PortalJobPapers jobs={JOBS} company="Made-up Plumbing" />)
    const first = within(job('job-1'))
    expect(first.getByText('J100 · Cedar Bluff')).toBeTruthy()
    expect(first.getByText('How we bind everyone we bring onto this job')).toBeTruthy()
    expect(first.getByText('Sample paper')).toBeTruthy()
    expect(first.getByText('Aligned with a placeholder place')).toBeTruthy()
    const said = job('job-1').querySelector('[data-portal-job-paper-said]') as HTMLElement
    expect(said.textContent).toBe('Photos and videoStandardPlaceholder: ask first.PhonesOffPlaceholder: no rule.')
  })

  it('counts who has signed and lists each sub business with its day', () => {
    render(<PortalJobPapers jobs={JOBS} company="Made-up Plumbing" />)
    const signed = job('job-1').querySelector('[data-portal-job-paper-signed]') as HTMLElement
    expect(within(signed).getByText('3 of 9 people have signed')).toBeTruthy()
    expect(within(signed).getByText('Nobody opens this job in Made-up Plumbing’s system until they sign.')).toBeTruthy()
    const rows = [...signed.querySelectorAll('[data-portal-job-paper-business]')].map((r) => `${r.getAttribute('data-portal-job-paper-business')}: ${r.textContent}`)
    expect(rows).toEqual(['signed: Pine Ridge ExcavatingSigned Nov 24, 20262 of 2 people signed', 'owed: Sam SoleNot yet'])
  })

  it('says a mix of its own and a later revision, on a job nobody is on yet', () => {
    render(<PortalJobPapers jobs={JOBS} company="Made-up Plumbing" />)
    const second = within(job('job-2'))
    expect(second.getByText('A mix of its own')).toBeTruthy()
    expect(second.getByText('These settings are revision 3 on this job. Everyone signs each revision.')).toBeTruthy()
    expect(second.getByText('Nobody is on this job yet')).toBeTruthy()
    expect(job('job-2').querySelector('[data-portal-job-paper-said]')).toBeNull()
  })

  it('holds no press, and stays off paper', () => {
    render(<PortalJobPapers jobs={JOBS} company="Made-up Plumbing" />)
    const block = document.querySelector('[data-portal-job-papers]') as HTMLElement
    expect(block.querySelectorAll('button, a, input').length).toBe(0)
    expect(block.hasAttribute('data-screen-only')).toBe(true)
    expect(block.textContent).toContain('This is Made-up Plumbing’s paper for the people it brings onto your job.')
  })
})
