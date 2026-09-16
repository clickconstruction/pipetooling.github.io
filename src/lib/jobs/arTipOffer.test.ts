import { describe, it, expect } from 'vitest'
import {
  buildArTipOffer,
  soleJobOfAllocations,
  arTipJobLabel,
  AR_TIP_OFFER_EPS,
  type ArTipAllocation,
} from './arTipOffer'

const row = (jobId: string, hcp: string, name: string, amount: number): ArTipAllocation => ({
  job_id: jobId,
  hcp_number: hcp,
  job_name: name,
  amount,
})

/** The live case this was built for: Elaine Giesber's deposit, three bills on job 960. */
const ELAINE: ArTipAllocation[] = [
  row('j960', '960', 'Elaine Giesber-Installations Pcv & Lavatory Sink', 650),
  row('j960', '960', 'Elaine Giesber-Installations Pcv & Lavatory Sink', 483.2),
  row('j960', '960', 'Elaine Giesber-Installations Pcv & Lavatory Sink', 672.5),
]

describe('arTipJobLabel', () => {
  it('reads the way the applied breakdown does', () => {
    expect(arTipJobLabel(row('j1', '960', 'Elaine Giesber-Installations', 1))).toBe(
      '960 · Elaine Giesber-Installations',
    )
  })

  it('falls back to an em dash on either half', () => {
    expect(arTipJobLabel({ job_id: 'j1', hcp_number: '', job_name: '', amount: 1 })).toBe('— · —')
    expect(arTipJobLabel({ job_id: 'j1', hcp_number: null, job_name: 'Knight', amount: 1 })).toBe('— · Knight')
  })
})

describe('soleJobOfAllocations', () => {
  it('finds the one job every row shares', () => {
    expect(soleJobOfAllocations(ELAINE)).toEqual({
      jobId: 'j960',
      label: '960 · Elaine Giesber-Installations Pcv & Lavatory Sink',
    })
  })

  it('returns null when the rows span two jobs', () => {
    expect(soleJobOfAllocations([...ELAINE, row('j712', '712', 'Knight Contracting', 100)])).toBeNull()
  })

  it('returns null on no rows, and on a row with no job', () => {
    expect(soleJobOfAllocations([])).toBeNull()
    expect(soleJobOfAllocations([{ job_id: null, hcp_number: '1', job_name: 'x', amount: 1 }])).toBeNull()
  })
})

describe('buildArTipOffer', () => {
  it('offers the whole remainder on the one job the deposit paid', () => {
    const offer = buildArTipOffer({ remaining: 50, allocations: ELAINE })
    expect(offer).not.toBeNull()
    expect(offer?.amount).toBe(50)
    expect(offer?.jobId).toBe('j960')
    expect(offer?.headline).toBe('$50.00 more than the bills.')
    expect(offer?.sentence).toBe(
      'They paid over. Record it as a tip on 960 · Elaine Giesber-Installations Pcv & Lavatory Sink.',
    )
    expect(offer?.buttonLabel).toBe('Add a $50.00 Tip line')
  })

  it('offers the deposit’s own jobs as a closed list when it paid more than one', () => {
    const offer = buildArTipOffer({
      remaining: 50,
      allocations: [...ELAINE, row('j712', '712', 'Knight Contracting', 100)],
    })
    expect(offer?.jobId).toBeNull()
    expect(offer?.jobLabel).toBeNull()
    expect(offer?.sentence).toContain('more than one job')
    expect(offer?.buttonLabel).toBe('Add a $50.00 Tip line')
    expect(offer?.jobChoices).toEqual([
      { jobId: 'j960', label: '960 · Elaine Giesber-Installations Pcv & Lavatory Sink' },
      { jobId: 'j712', label: '712 · Knight Contracting' },
    ])
  })

  it('lists the single job as the only choice', () => {
    expect(buildArTipOffer({ remaining: 50, allocations: ELAINE })?.jobChoices).toEqual([
      { jobId: 'j960', label: '960 · Elaine Giesber-Installations Pcv & Lavatory Sink' },
    ])
  })

  it('never offers when the applied rows carry no job id', () => {
    expect(
      buildArTipOffer({ remaining: 50, allocations: [{ job_id: null, hcp_number: '1', job_name: 'x', amount: 1 }] }),
    ).toBeNull()
  })

  it('never offers on an untouched deposit — that money is unmatched, not a tip', () => {
    expect(buildArTipOffer({ remaining: 1855.7, allocations: [] })).toBeNull()
  })

  it('never offers once the deposit is fully applied', () => {
    expect(buildArTipOffer({ remaining: 0, allocations: ELAINE })).toBeNull()
    expect(buildArTipOffer({ remaining: AR_TIP_OFFER_EPS, allocations: ELAINE })).toBeNull()
    expect(buildArTipOffer({ remaining: -5, allocations: ELAINE })).toBeNull()
  })

  it('never offers on a deposit marked returned', () => {
    expect(buildArTipOffer({ remaining: 50, allocations: ELAINE, returned: true })).toBeNull()
  })

  it('survives a null or unreadable remainder', () => {
    expect(buildArTipOffer({ remaining: null, allocations: ELAINE })).toBeNull()
    expect(buildArTipOffer({ remaining: undefined, allocations: ELAINE })).toBeNull()
    expect(buildArTipOffer({ remaining: Number.NaN, allocations: ELAINE })).toBeNull()
  })

  it('rounds the remainder to cents', () => {
    expect(buildArTipOffer({ remaining: 12.345, allocations: ELAINE })?.amount).toBe(12.35)
    expect(buildArTipOffer({ remaining: 0.014, allocations: ELAINE })?.amount).toBe(0.01)
  })

  it('formats thousands in the button', () => {
    expect(buildArTipOffer({ remaining: 1234.5, allocations: ELAINE })?.buttonLabel).toBe(
      'Add a $1,234.50 Tip line',
    )
  })
})
