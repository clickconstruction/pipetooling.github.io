import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { boardTime, boardWrite, moveAsk, slideWords, whatSlides, type DayBlock, type LateMove } from './whatSlides'

/** A Chicago wall time on Monday, Oct 12, 2026 (CDT, five hours behind UTC). */
const cdt = (hm: string) => new Date(`2026-10-12T${hm}:00-05:00`).toISOString()

// Luis's morning, the integrations mockups' card 3. Made-up rows.
const block = (id: string, jobLabel: string, customer: string, timeStart: string, timeEnd: string, set: Partial<DayBlock> = {}): DayBlock => ({
  id,
  workDate: '2026-10-12',
  timeStart,
  timeEnd,
  jobLabel,
  jobsLedgerId: `jl-${jobLabel}`,
  customer,
  groupId: null,
  ...set,
})

const SEWER = block('b1', '1312', 'Dana Whitfield', '08:00:00', '08:30:00')
const HEATER = block('b2', '1298', 'Marcus Ortiz', '09:30:00', '11:00:00')
const CHURCH = block('b3', '1340', 'Hillside Church', '12:00:00', '14:00:00')
/** Luis's Tuesday, which nothing on Monday moves. */
const TUESDAY = block('b9', '1401', 'Elena Marchetti', '08:30:00', '09:00:00', { workDate: '2026-10-13' })
const MORNING = [CHURCH, TUESDAY, HEATER, SEWER]

const RUNNING_LATE: LateMove = { blockId: 'b1', timeStart: '09:30', timeEnd: '10:00', saidTo: 'Dana' }
const SENT_AT = cdt('09:02')

describe('whatSlides', () => {
  it('slides the second stop and stops at the third, whose gap takes the rest', () => {
    const read = whatSlides(MORNING, RUNNING_LATE, SENT_AT)!
    expect(read.moved).toMatchObject({ block: SEWER, fromStart: 8 * 60, toStart: 9 * 60 + 30, toEnd: 10 * 60, minutes: 90 })
    expect(read.slides.map((s) => [s.block.jobLabel, s.block.customer, boardTime(s.toStart), boardTime(s.toEnd), s.minutes])).toEqual([
      ['1298', 'Marcus Ortiz', '10:00 AM', '11:30 AM', 30],
    ])
    expect(read.holds).toBe(CHURCH)
    expect(read.pastDayEnd).toBe(false)
    expect(read.reason).toBe('said to Dana, 9:02 AM')
  })

  it('carries the slide on when the next gap is too short', () => {
    const tight = block('b3', '1340', 'Hillside Church', '11:15:00', '12:00:00')
    const lunch = block('b4', '1355', 'Greg Hill', '13:00:00', '14:00:00')
    const read = whatSlides([SEWER, HEATER, tight, lunch], RUNNING_LATE, SENT_AT)!
    expect(read.slides.map((s) => [s.block.jobLabel, s.minutes])).toEqual([
      ['1298', 30],
      ['1340', 15],
    ])
    expect(read.holds).toBe(lunch)
  })

  it('moves only the block when nothing comes after it', () => {
    const read = whatSlides(MORNING, { blockId: 'b3', timeStart: '12:30', timeEnd: '14:30', saidTo: 'Hillside' }, SENT_AT)!
    expect(read.moved.minutes).toBe(30)
    expect(read.slides).toEqual([])
    expect(read.holds).toBeNull()
  })

  it('reads nothing for a block that is not on the day, or a window that ends before it starts', () => {
    expect(whatSlides(MORNING, { ...RUNNING_LATE, blockId: 'nope' }, SENT_AT)).toBeNull()
    expect(whatSlides(MORNING, { ...RUNNING_LATE, timeEnd: '09:00' }, SENT_AT)).toBeNull()
  })

  it('marks a slide that would run past midnight', () => {
    const late = block('e1', '1500', 'Dana Whitfield', '21:00:00', '22:00:00')
    const later = block('e2', '1501', 'Greg Hill', '22:00:00', '23:30:00')
    const read = whatSlides([late, later], { blockId: 'e1', timeStart: '22:00', timeEnd: '23:00', saidTo: 'Dana' }, SENT_AT)!
    expect(read.slides[0]!.toEnd).toBe(24 * 60 + 30)
    expect(read.pastDayEnd).toBe(true)
  })
})

describe('moveAsk', () => {
  it('says the move and the slide, with Move it and Leave the board', () => {
    const ask = moveAsk(whatSlides(MORNING, RUNNING_LATE, SENT_AT)!, 'Luis')
    expect(ask).toEqual({
      head: 'Move the board too?',
      lines: ['Job 1312 moves from 8:00 AM to 9:30 AM.', 'Luis’s next stop slides 30 minutes.'],
      presses: [
        { id: 'move', label: 'Move it' },
        { id: 'leave', label: 'Leave the board' },
      ],
    })
  })

  it('names every stop’s slide, nothing else, and the crew block the tech leaves', () => {
    const tight = block('b3', '1340', 'Hillside Church', '11:15:00', '12:00:00', { groupId: 'crew-1' })
    const two = moveAsk(whatSlides([SEWER, HEATER, tight], RUNNING_LATE, SENT_AT)!, 'Luis')
    expect(two.lines.slice(1)).toEqual(['Luis’s next 2 stops slide 30 minutes and 15 minutes.', 'Luis leaves the crew block.'])
    const none = moveAsk(whatSlides(MORNING, { blockId: 'b3', timeStart: '12:30', timeEnd: '14:30', saidTo: 'Hillside' }, SENT_AT)!, 'Luis')
    expect(none.lines[1]).toBe('Nothing else on Luis’s day moves.')
  })

  it('offers only Leave the board past midnight', () => {
    const late = block('e1', '1500', 'Dana Whitfield', '21:00:00', '22:00:00')
    const later = block('e2', '1501', 'Greg Hill', '22:00:00', '23:30:00')
    const ask = moveAsk(whatSlides([late, later], { blockId: 'e1', timeStart: '22:00', timeEnd: '23:00', saidTo: 'Dana' }, SENT_AT)!, 'Luis')
    expect(ask.presses).toEqual([{ id: 'leave', label: 'Leave the board' }])
    expect(ask.lines).toContain('That would run Luis’s day past midnight.')
  })

  it('passes the plain words rules', () => {
    const tight = block('b3', '1340', 'Hillside Church', '11:15:00', '12:00:00', { groupId: 'crew-1' })
    const read = whatSlides([SEWER, { ...HEATER, groupId: 'crew-2' }, tight], RUNNING_LATE, SENT_AT)!
    const write = boardWrite(read, 'Luis')!
    const words = [...moveAsk(read, 'Luis').lines, write.jobLine, write.dispatcherNote.reference_summary]
    expect(words.flatMap(plainWordsFailures)).toEqual([])
  })
})

describe('boardWrite', () => {
  it('writes one self_move_schedule_block row per block, the last stop first, in the RPC’s own shape', () => {
    const write = boardWrite(whatSlides(MORNING, RUNNING_LATE, SENT_AT)!, 'Luis')!
    expect(write.rows).toEqual([
      { p_block_id: 'b2', p_work_date: '2026-10-12', p_time_start: '10:00:00', p_time_end: '11:30:00' },
      { p_block_id: 'b1', p_work_date: '2026-10-12', p_time_start: '09:30:00', p_time_end: '10:00:00' },
    ])
  })

  it('words the job’s event line and the dispatcher’s note for R8’s SQL', () => {
    const write = boardWrite(whatSlides(MORNING, RUNNING_LATE, SENT_AT)!, 'Luis')!
    expect(write.jobLine).toBe('Running late. Moved from 8:00 AM to 9:30 AM, said to Dana, 9:02 AM.')
    expect(write.dispatcherNote).toEqual({
      title: 'Luis is running late on job 1312',
      reference_summary: 'Job 1312 moves from 8:00 AM to 9:30 AM, said to Dana, 9:02 AM. Job 1298 for Marcus Ortiz slides 30 minutes.',
      job_ledger_id: 'jl-1312',
    })
  })

  it('writes the moved block alone when nothing comes after it, and nothing past midnight', () => {
    const alone = boardWrite(whatSlides(MORNING, { blockId: 'b3', timeStart: '12:30', timeEnd: '14:30', saidTo: 'Hillside' }, SENT_AT)!, 'Luis')!
    expect(alone.rows).toEqual([{ p_block_id: 'b3', p_work_date: '2026-10-12', p_time_start: '12:30:00', p_time_end: '14:30:00' }])
    const late = block('e1', '1500', 'Dana Whitfield', '21:00:00', '22:00:00')
    const later = block('e2', '1501', 'Greg Hill', '22:00:00', '23:30:00')
    expect(boardWrite(whatSlides([late, later], { blockId: 'e1', timeStart: '22:00', timeEnd: '23:00', saidTo: 'Dana' }, SENT_AT)!, 'Luis')).toBeNull()
  })
})

describe('the words for a time', () => {
  it('says a board time and a slide length', () => {
    expect([boardTime(0), boardTime(9 * 60 + 5), boardTime(12 * 60), boardTime(23 * 60 + 59)]).toEqual(['12:00 AM', '9:05 AM', '12:00 PM', '11:59 PM'])
    expect([slideWords(1), slideWords(30), slideWords(60), slideWords(75), slideWords(150)]).toEqual([
      '1 minute',
      '30 minutes',
      '1 hour',
      '1 hour 15 minutes',
      '2 hours 30 minutes',
    ])
  })
})
