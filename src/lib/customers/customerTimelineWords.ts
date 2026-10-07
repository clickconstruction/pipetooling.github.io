/**
 * Customer timeline — the words of the floating bar (punch list #97, PR 2). Pure: the tiles,
 * the line that says what they owed on the day under the bar, the who line, a job chip.
 */
import {
  timelineDayWords,
  timelineHoursWords,
  timelineMoney,
  timelineMonthWords,
  type CustomerTimeline,
  type TimelineJob,
  type TimelineSnapshot,
  type TimelineSummary,
} from './customerTimeline'

export type TimelineTileKey = 'owed' | 'unbilled' | 'hours' | 'materials'
export type TimelineTile = { key: TimelineTileKey; label: string; value: string; sub: string; alert: boolean }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function customerTimelineTiles(s: TimelineSummary): TimelineTile[] {
  const owedBits: string[] = []
  if (s.owed > 0.005) {
    owedBits.push(`${plural(s.openBillCount, 'bill')} on ${plural(s.owedJobCount, 'job')}`)
    if (s.oldestOpenBillDays != null) owedBits.push(`oldest ${plural(s.oldestOpenBillDays, 'day')}`)
    if (s.promise && !s.promise.kept) {
      owedBits.push(s.promise.broken ? `said ${timelineDayWords(s.promise.promisedYmd)}, not paid` : `they said ${timelineDayWords(s.promise.promisedYmd)}`)
    }
  }
  const unbilledBits: string[] = []
  if (s.notYetBilledJobCount > 0) unbilledBits.push(`${plural(s.notYetBilledJobCount, 'job')} working`)
  if (s.booked > 0.005) unbilledBits.push(`${timelineMoney(s.booked)} booked on ${s.bookedJobCount} waiting`)
  return [
    { key: 'owed', label: 'Owes us', value: timelineMoney(s.owed), sub: owedBits.length > 0 ? owedBits.join(' · ') : 'nothing open', alert: s.owed > 0.005 },
    { key: 'unbilled', label: 'Not yet billed', value: timelineMoney(s.notYetBilled), sub: unbilledBits.length > 0 ? unbilledBits.join(' · ') : 'nothing waiting to bill', alert: false },
    {
      key: 'hours',
      label: 'Unpaid hours',
      value: timelineHoursWords(s.unpaidHours),
      sub: s.unpaidCrewDays > 0 ? `${plural(s.unpaidCrewDays, 'crew day')} on ${plural(s.unpaidHoursJobCount, 'open job')}` : 'no crew hours on open jobs',
      alert: false,
    },
    {
      key: 'materials',
      label: 'Unpaid materials',
      value: timelineMoney(s.unpaidMaterials),
      sub: s.unpaidTicketCount > 0 ? `${plural(s.unpaidTicketCount, 'supply ticket')} on open jobs` : 'no supply tickets on open jobs',
      alert: false,
    },
  ]
}

/** The bar's second line while you scroll: what stood on the day under the bar. */
export function customerTimelineAsOfWords(ymd: string, snap: TimelineSnapshot): string {
  return `On ${timelineDayWords(ymd)}, ${ymd.slice(0, 4)}: owed ${timelineMoney(snap.owed)} · ${timelineHoursWords(snap.unpaidHours)} unpaid · ${timelineMoney(snap.unpaidMaterials)} materials`
}

/** The facts beside the name: jobs, the GC count, since when, how fast they pay. */
export function customerTimelineWhoWords(t: Pick<CustomerTimeline, 'jobs' | 'summary'>, sinceYmd: string | null): string[] {
  const words: string[] = [`${plural(t.jobs.length, 'job')} · ${t.summary.openJobCount} open`]
  const gcCount = t.jobs.filter((j) => j.role !== 'customer').length
  if (gcCount > 0) words.push(`GC on ${plural(gcCount, 'job')}`)
  if (sinceYmd) words.push(`customer since ${timelineMonthWords(sinceYmd)}`)
  if (t.summary.daysToPay) words.push(`pays in ~${plural(t.summary.daysToPay.medianDays, 'day')}`)
  return words
}

/** A job's words on a chip and a card: '901 · Bluff Springs clinic'. */
export function customerTimelineJobWords(job: Pick<TimelineJob, 'numberLabel' | 'label'>): string {
  return `${job.numberLabel} · ${job.label}`
}
