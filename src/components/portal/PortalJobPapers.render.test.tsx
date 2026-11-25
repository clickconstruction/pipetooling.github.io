// @vitest-environment jsdom
/**
 * Render smokes for what a GC reads about a job's papers (punch list #389, step 5), against a fixture: the block sits
 * under its job's name, says the level and the picks in plain words, counts who has signed, and lists each sub
 * business with its day. It names no worker unless the office set the job to, and under the count alone it lists no
 * business. Its one press downloads the sample. Every name and word is made up.
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

  it('names no signer as every paper starts, and each one once the office sets the job to', () => {
    render(<PortalJobPapers jobs={JOBS} company="Made-up Plumbing" />)
    expect(document.querySelector('[data-portal-job-paper-signers]')).toBeNull()
    cleanup()
    const named = parseGcJobPapers([{ jobId: 'job-1', jobLabel: 'J100 · Cedar Bluff', papers: [{ id: 'row-1', name: 'Sample paper', settingsRevision: 1, level: null, said: [], signed: 2, total: 9, view: 'names', businesses: [{ name: 'Pine Ridge Excavating', people: 2, signed: 1, signedOn: null }], signers: [{ name: 'Tall Pine', business: 'Pine Ridge Excavating', signedOn: '2026-11-23' }, { name: 'Hector Helper', business: null, signedOn: '2026-11-24' }] }] }])
    render(<PortalJobPapers jobs={named} company="Made-up Plumbing" />)
    const list = document.querySelector('[data-portal-job-paper-signers]') as HTMLElement
    expect(within(list).getByText('Who has signed')).toBeTruthy()
    expect([...list.querySelectorAll('[data-portal-job-paper-signer]')].map((r) => r.textContent)).toEqual(['Tall PineSigned Nov 23, 2026Pine Ridge Excavating', 'Hector HelperSigned Nov 24, 2026'])
    expect(document.querySelectorAll('[data-portal-job-paper-business]').length).toBe(1)
  })

  it('under the count alone it lists no business and no signer, and still counts', () => {
    const counted = parseGcJobPapers([{ jobId: 'job-1', jobLabel: 'J100 · Cedar Bluff', papers: [{ id: 'row-1', name: 'Sample paper', settingsRevision: 1, level: null, said: [], signed: 2, total: 9, view: 'count', businesses: [{ name: 'Pine Ridge Excavating', people: 2, signed: 1, signedOn: null }], signers: [{ name: 'Tall Pine', business: null, signedOn: '2026-11-23' }] }] }])
    render(<PortalJobPapers jobs={counted} company="Made-up Plumbing" />)
    const signed = document.querySelector('[data-portal-job-paper-signed]') as HTMLElement
    expect(within(signed).getByText('2 of 9 people have signed')).toBeTruthy()
    expect(signed.querySelectorAll('[data-portal-job-paper-business], [data-portal-job-paper-signer]').length).toBe(0)
    expect(signed.textContent).not.toContain('Pine Ridge')
    expect(signed.textContent).not.toContain('Tall Pine')
  })

  it('holds no press without the page’s link, and stays off paper', () => {
    render(<PortalJobPapers jobs={JOBS} company="Made-up Plumbing" />)
    const block = document.querySelector('[data-portal-job-papers]') as HTMLElement
    expect(block.querySelectorAll('button, a, input').length).toBe(0)
    expect(block.hasAttribute('data-screen-only')).toBe(true)
    expect(block.textContent).toContain('This is Made-up Plumbing’s paper for the people it brings onto your job.')
  })

  it('with the page’s link, each paper offers its own sample, a finger tall, in a tab of its own', () => {
    render(<PortalJobPapers jobs={JOBS} company="Made-up Plumbing" token="tok-zz-0123456789abcdef" />)
    const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-portal-job-paper-sample]')]
    expect(links.map((a) => a.textContent)).toEqual(['Download a sample', 'Download a sample'])
    expect(links.map((a) => new URL(a.href).search)).toEqual(['?t=tok-zz-0123456789abcdef&p=row-1', '?t=tok-zz-0123456789abcdef&p=row-2'])
    expect(new URL(links[0]!.href).pathname).toBe('/functions/v1/open-job-paper-sample')
    expect(links[0]!.target).toBe('_blank')
    expect(links[0]!.rel).toBe('noopener noreferrer')
    expect(links[0]!.style.minHeight).toBe('44px')
    expect(document.querySelector('[data-portal-job-papers]')!.querySelectorAll('button, input').length).toBe(0)
  })

  it('the sample statement, whose jobs are made up, offers no sample', () => {
    render(<PortalJobPapers jobs={JOBS} company="Made-up Plumbing" token="sample-gc" />)
    expect(document.querySelectorAll('[data-portal-job-paper-sample]').length).toBe(0)
  })

  it('the GC’s own form says whose it is and who has signed, with no level, sample or proposal', () => {
    const jobs = parseGcJobPapers([
      {
        jobId: 'job-3',
        jobLabel: 'J300 · Quarry',
        papers: [],
        ownForms: [{ id: 'row-f', name: 'Sample GC form', signed: 1, total: 4, businesses: [{ name: 'Pine Ridge Excavating', people: 2, signed: 2, signedOn: '2026-11-24' }, { name: 'Sam Sole', people: 1, signed: 0, signedOn: null }] }],
      },
    ])
    const { container } = render(<PortalJobPapers jobs={jobs} company="Sample Plumbing" token="a-real-token" />)
    const job = container.querySelector('[data-portal-job-papers-job="job-3"]') as HTMLElement
    expect(within(job).getByText('J300 · Quarry')).toBeTruthy()
    const block = job.querySelector('[data-portal-job-own-form="row-f"]') as HTMLElement
    expect(within(block).getByText('Subs sign your own form')).toBeTruthy()
    expect(within(block).getByText('Sample GC form')).toBeTruthy()
    expect(within(block).getByText('Every person Sample Plumbing brings onto this job signs the form you gave us before they see the job.')).toBeTruthy()
    expect(within(block).getByText('1 of 4 people have signed')).toBeTruthy()
    expect(block.querySelectorAll('[data-portal-job-paper-business]')).toHaveLength(2)
    expect(within(block).getByText('This is your form. It does not change the agreement between Sample Plumbing and you.')).toBeTruthy()
    // A form has no settings: nothing to download as a sample, nothing to propose, and no block of a paper.
    expect(container.querySelector('[data-portal-job-paper-sample]')).toBeNull()
    expect(container.querySelector('[data-portal-job-paper]')).toBeNull()
    expect(within(block).queryByRole('button')).toBeNull()
    expect(within(block).queryByText('How we bind everyone we bring onto this job')).toBeNull()
  })

  it('a job with a paper and the GC’s own form draws both under the one job name', () => {
    const jobs = parseGcJobPapers([{ ...JSON.parse(JSON.stringify(JOBS[0])), ownForms: [{ id: 'row-f', name: 'Sample GC form', signed: 0, total: 9, businesses: [] }] }])
    const { container } = render(<PortalJobPapers jobs={jobs} company="Sample Plumbing" />)
    expect(container.querySelectorAll('[data-portal-job-papers-job]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-portal-job-own-form]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-portal-job-paper]')).toHaveLength(1)
  })
})
