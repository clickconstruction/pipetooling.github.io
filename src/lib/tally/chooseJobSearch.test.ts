import { describe, expect, it } from 'vitest'
import { chooseJobHit, chooseJobNumber, chooseJobSearchWords, litRuns, searchChooseJobs, type ChooseJobRow } from './chooseJobSearch'

const PREFIXES = { plumbing: { job: 'J', bid: 'B' }, electrical: { job: 'JE', bid: 'BE' } }

const job = (over: Partial<ChooseJobRow> & { id: string }): ChooseJobRow => ({
  hcp_number: '972',
  click_number: null,
  job_name: 'Pinpoint & gas test',
  job_address: '1140 Lago Vista Dr, San Marcos, TX 78666',
  customer_name: 'Alvarez Homes',
  service_type_id: 'plumbing',
  ...over,
})

const JOBS: ChooseJobRow[] = [
  job({ id: 'a' }),
  job({ id: 'b', hcp_number: '971', job_name: 'Water heater swap', job_address: '408 Pecan Hollow, Kyle, TX', customer_name: 'Nguyen' }),
  job({ id: 'c', hcp_number: '97', job_name: 'Diagnostic visit', job_address: '6320 Aster Run, New Braunfels, TX', customer_name: null }),
  job({ id: 'd', hcp_number: '611', job_name: 'Tunnel under the slab', job_address: '90 Hopkins St, San Marcos, TX', customer_name: 'Alvarez Homes' }),
  job({ id: 'e', hcp_number: '1970', job_name: 'Repipe', job_address: '2497 Ranch Rd, Blanco, TX', customer_name: null }),
]

const lit = (runs: { text: string; lit: boolean }[]) => runs.filter((r) => r.lit).map((r) => r.text)

describe('chooseJobSearchWords', () => {
  it('splits on spaces, lowercases, drops blanks', () => {
    expect(chooseJobSearchWords('  Tunnel   MARCOS ')).toEqual(['tunnel', 'marcos'])
    expect(chooseJobSearchWords('')).toEqual([])
  })
})

describe('chooseJobNumber', () => {
  it('prints the HCP number, else the Click number, else a dash', () => {
    expect(chooseJobNumber({ hcp_number: '972', click_number: 'C12' })).toBe('972')
    expect(chooseJobNumber({ hcp_number: '', click_number: 'C12' })).toBe('C12')
    expect(chooseJobNumber({ hcp_number: null, click_number: null })).toBe('—')
  })
})

describe('litRuns', () => {
  it('lights every occurrence of every word and keeps the original case', () => {
    expect(litRuns('San Marcos, San Antonio', ['san'])).toEqual([
      { text: 'San', lit: true },
      { text: ' Marcos, ', lit: false },
      { text: 'San', lit: true },
      { text: ' Antonio', lit: false },
    ])
  })
  it('merges overlapping words into one run', () => {
    expect(lit(litRuns('San Marcos', ['san', 'n mar']))).toEqual(['San Mar'])
  })
  it('gives one unlit run when nothing lands, and nothing for empty text', () => {
    expect(litRuns('Kyle', ['zzz'])).toEqual([{ text: 'Kyle', lit: false }])
    expect(litRuns('', ['k'])).toEqual([])
  })
})

describe('chooseJobHit', () => {
  it('every word must land somewhere', () => {
    expect(chooseJobHit(JOBS[0]!, ['tunnel'], PREFIXES)).toBeNull()
    expect(chooseJobHit(JOBS[3]!, ['tunnel', 'marcos'], PREFIXES)).not.toBeNull()
    expect(chooseJobHit(JOBS[3]!, ['tunnel', 'kyle'], PREFIXES)).toBeNull()
  })
  it('lights each word where it landed', () => {
    const hit = chooseJobHit(JOBS[3]!, ['tunnel', 'marcos'], PREFIXES)!
    expect(lit(hit.name)).toEqual(['Tunnel'])
    expect(lit(hit.address)).toEqual(['Marcos'])
    expect(lit(hit.number)).toEqual([])
  })
  it('the number typed with or without its letter lands on the bare number and lights it', () => {
    expect(lit(chooseJobHit(JOBS[0]!, ['972'], PREFIXES)!.number)).toEqual(['972'])
    expect(lit(chooseJobHit(JOBS[0]!, ['j972'], PREFIXES)!.number)).toEqual(['972'])
    expect(lit(chooseJobHit(JOBS[0]!, ['j97'], PREFIXES)!.number)).toEqual(['97'])
  })
  it('a job on another trade reads its own letters', () => {
    const electrical = job({ id: 'x', hcp_number: '55', service_type_id: 'electrical' })
    expect(chooseJobHit(electrical, ['je55'], PREFIXES)).not.toBeNull()
    expect(chooseJobHit(electrical, ['j55'], PREFIXES)).toBeNull()
  })
  it('ranks the number typed first, a number that starts with it second, the rest third', () => {
    expect(chooseJobHit(JOBS[2]!, ['97'], PREFIXES)!.rank).toBe(0)
    expect(chooseJobHit(JOBS[0]!, ['97'], PREFIXES)!.rank).toBe(1)
    expect(chooseJobHit(JOBS[4]!, ['97'], PREFIXES)!.rank).toBe(2)
    expect(chooseJobHit(JOBS[4]!, [], PREFIXES)!.rank).toBe(2)
  })
  it('shows the customer line only when a word landed on it', () => {
    expect(lit(chooseJobHit(JOBS[0]!, ['alvarez'], PREFIXES)!.customer ?? [])).toEqual(['Alvarez'])
    expect(chooseJobHit(JOBS[0]!, ['972'], PREFIXES)!.customer).toBeNull()
    expect(chooseJobHit(JOBS[2]!, ['97'], PREFIXES)!.customer).toBeNull()
  })
  it('nothing typed keeps every job, unlit', () => {
    const hit = chooseJobHit(JOBS[0]!, [], PREFIXES)!
    expect(hit.number).toEqual([{ text: '972', lit: false }])
    expect(hit.customer).toBeNull()
  })
  it('a job with no name prints a dash for it', () => {
    expect(chooseJobHit(job({ id: 'n', job_name: '' }), [], PREFIXES)!.name).toEqual([{ text: '—', lit: false }])
  })
})

describe('searchChooseJobs', () => {
  it('nothing typed keeps every job in its order', () => {
    expect(searchChooseJobs(JOBS, '  ', PREFIXES).map((h) => h.job.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('a number: the exact number, then the ones that start with it, then the rest in order', () => {
    expect(searchChooseJobs(JOBS, '97', PREFIXES).map((h) => h.job.id)).toEqual(['c', 'a', 'b', 'e'])
  })
  it('two words find the job whichever way round', () => {
    expect(searchChooseJobs(JOBS, 'marcos tunnel', PREFIXES).map((h) => h.job.id)).toEqual(['d'])
    expect(searchChooseJobs(JOBS, 'tunnel marcos', PREFIXES).map((h) => h.job.id)).toEqual(['d'])
  })
  it('a customer finds every job of theirs', () => {
    expect(searchChooseJobs(JOBS, 'alvarez', PREFIXES).map((h) => h.job.id)).toEqual(['a', 'd'])
  })
  it('a word that lands nowhere finds nothing', () => {
    expect(searchChooseJobs(JOBS, 'lago vista 99', PREFIXES)).toEqual([])
  })
})
