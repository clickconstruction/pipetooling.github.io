import { describe, expect, it } from 'vitest'
import {
  buildChecklistJobPreset,
  checklistJobLinkLabel,
  checklistJobLinks,
  checklistJobModalPreset,
  composeChecklistJobTitle,
} from './checklistJobPreset'

const ORIGIN = 'https://clicktooling.com'

describe('checklistJobPreset (v2.3751)', () => {
  it('builds the bar from the job: HCP number first, the trade tag, address, customer, and the job door', () => {
    const p = buildChecklistJobPreset(
      {
        id: 'job-1',
        hcp_number: '1016',
        click_number: 'C42',
        job_name: ' Mission faucet ',
        job_address: '15638 Mission Crest, San Antonio, TX',
        serviceTypeName: 'Plumbing',
        customerName: 'Johnny Ingram',
      },
      ORIGIN
    )
    expect(p.number).toBe('1016')
    expect(p.name).toBe('Mission faucet')
    expect(p.trade?.tag).toBe('PLUM')
    expect(p.address).toBe('15638 Mission Crest, San Antonio, TX')
    expect(p.customer).toBe('Johnny Ingram')
    expect(p.path).toBe('/jobs?jobDetail=job-1')
    expect(p.url).toBe('https://clicktooling.com/jobs?jobDetail=job-1')
  })

  it('falls back to the Click number, then to no number; the GC stands in for a missing customer; an unknown trade has no pill; blanks are null', () => {
    const c = buildChecklistJobPreset({ id: 'j', click_number: 'C42', job_name: 'Coe pool', serviceTypeName: 'Landscaping' }, ORIGIN)
    expect(c.number).toBe('C42')
    expect(c.trade).toBeNull()
    expect(c.address).toBeNull()
    expect(c.customer).toBeNull()
    const gc = buildChecklistJobPreset({ id: 'j', job_name: 'Mission faucet', customerName: ' ', gcName: 'Johnny Ingram' }, ORIGIN)
    expect(gc.customer).toBe('Johnny Ingram')
    const none = buildChecklistJobPreset({ id: 'j', job_name: '' }, ORIGIN)
    expect(none.number).toBeNull()
    expect(none.name).toBe('Job')
  })

  it('composes exactly the pre-v2.3751 title — {{1:<num · name>}} — <typed> — and never lets a brace close the token', () => {
    const job = { number: '1016', name: 'Mission faucet' }
    expect(checklistJobLinkLabel(job)).toBe('1016 · Mission faucet')
    expect(composeChecklistJobTitle(job, '  Pick up the Moen cartridge ')).toBe(
      '{{1:1016 · Mission faucet}} — Pick up the Moen cartridge'
    )
    expect(checklistJobLinkLabel({ number: null, name: 'Job' })).toBe('— · Job')
    expect(checklistJobLinkLabel({ number: '7', name: 'Weird {name}' })).toBe('7 · Weird name')
  })

  it('keeps the job as link [1] once, whatever happened in the Links section', () => {
    const job = { url: 'https://clicktooling.com/jobs?jobDetail=job-1' }
    expect(checklistJobLinks(job, [job.url, 'https://drive.google.com/x'])).toEqual([job.url, 'https://drive.google.com/x'])
    expect(checklistJobLinks(job, ['https://drive.google.com/x'])).toEqual([job.url, 'https://drive.google.com/x'])
    expect(checklistJobLinks(job, ['', job.url])).toEqual([job.url])
  })

  it('the door preset: empty title box, the job on the bar, its link as [1]', () => {
    const preset = checklistJobModalPreset({ id: 'job-1', hcp_number: '1016', job_name: 'Mission faucet' }, ORIGIN)
    expect(preset.title).toBe('')
    expect(preset.links).toEqual(['https://clicktooling.com/jobs?jobDetail=job-1'])
    expect(preset.job.id).toBe('job-1')
  })
})
