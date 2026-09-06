import { describe, expect, it } from 'vitest'
import { rehomeDoneToast, rehomeOffer, summarizeBidVisits } from './rehomeBidVisits'

describe('summarizeBidVisits (T5-04)', () => {
  it('counts total and today-or-later', () => {
    const s = summarizeBidVisits(
      [{ work_date: '2026-09-01' }, { work_date: '2026-09-06' }, { work_date: '2026-09-15' }],
      '2026-09-06',
    )
    expect(s).toEqual({ total: 3, upcoming: 2 })
  })
  it('is zero for no rows', () => {
    expect(summarizeBidVisits([], '2026-09-06')).toEqual({ total: 0, upcoming: 0 })
  })
})

describe('rehomeOffer', () => {
  it('offers nothing when there is nothing to move', () => {
    expect(rehomeOffer({ total: 0, upcoming: 0 }, 'J1007')).toBeNull()
  })
  it('names the count, the upcoming share, and the job', () => {
    const o = rehomeOffer({ total: 2, upcoming: 1 }, 'J1007')!
    expect(o.line).toBe('2 scheduled visits still sit on the bid (1 upcoming).')
    expect(o.button).toBe('Move them to J1007')
    expect(o.confirm).toContain('Move 2 scheduled visits from this bid to J1007?')
    expect(o.confirm).toContain('They keep their crew, date and time')
  })
  it('singular, all upcoming, and all past read naturally', () => {
    expect(rehomeOffer({ total: 1, upcoming: 1 }, 'J1')!.line).toBe('1 scheduled visit still sits on the bid.')
    expect(rehomeOffer({ total: 1, upcoming: 1 }, 'J1')!.button).toBe('Move it to J1')
    expect(rehomeOffer({ total: 3, upcoming: 0 }, 'J1')!.line).toBe('3 scheduled visits still sit on the bid — all in the past.')
  })
})

describe('rehomeDoneToast', () => {
  it('reports the moved count, or that nothing needed moving', () => {
    expect(rehomeDoneToast(2, 'J1007')).toBe('Moved 2 scheduled visits to J1007.')
    expect(rehomeDoneToast(1, 'J1007')).toBe('Moved 1 scheduled visit to J1007.')
    expect(rehomeDoneToast(0, 'J1007')).toBe('Nothing to move — those visits were already on the job.')
  })
})
