import { formatUsdNoCents } from './jobFormatting'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'
import { lienCalendarMarks, type LienCalendarAxis, type LienCalendarGroup, type LienCalendarGroupFlag, type LienCalendarJob, type LienCalendarKeyGlyph, type LienCalendarMark } from './lienCalendar'
import type { LienRunwayTone } from './lienPayRunway'

/**
 * The hover cards on the Lien desk's Deadlines board (v2.5531). A mark's browser tooltip was one
 * line, a second late, one mark at a time. A card says what the mark is, when, how much rides on
 * it and what to do next, in plain words, and ends on the door the board already has. Marks that
 * touch share one card, a column per mark in their order (`lienMarkClusters`); a GC row's folded
 * flag lists the jobs behind its count (`lienGroupFlagCards`). Pure: the tab draws the glyphs
 * and wires the doors.
 */

export type LienMarkDoorKind = 'lien_window' | 'pen' | 'last_work' | 'record' | 'kinds' | 'draft'
export type LienMarkCardDoor = { kind: LienMarkDoorKind; label: string; jobIds?: string[]; ymd?: string }
export type LienMarkCardJob = { jobId: string; number: string; name: string; month: string | null; money: number }
export type LienMarkCard = {
  key: string
  glyph: LienCalendarKeyGlyph | 'notice_done'
  tone: LienRunwayTone
  title: string
  /** The dated line, a label rather than prose: "Send by Oct 15 · tomorrow". Null on a mark with no date. */
  when: string | null
  whenTone: LienRunwayTone
  /** Plain-words sentences, one idea each. */
  facts: string[]
  /** On a GC row's folded flag: the jobs behind the count. */
  jobs: LienMarkCardJob[]
  door: LienMarkCardDoor | null
  /** Where along the track the mark sits, for a door that needs it (the pen). Null on an area. */
  pct: number | null
}
/** Which doors the tab can open for the row: the card offers only those. */
export type LienMarkDoors = { pen: boolean; lastWork: boolean; record: boolean; kinds: boolean; draft: boolean }
export const NO_DOORS: LienMarkDoors = { pen: false, lastWork: false, record: false, kinds: false, draft: false }

export function daysWords(todayYmd: string, ymd: string): string {
  const d = daysBetweenYmd(todayYmd, ymd) ?? 0
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  return d > 0 ? `in ${d} days` : `${-d} days ago`
}

/** A deadline's colour: red inside a week or past, amber inside three, grey beyond. */
export function deadlineTone(todayYmd: string, ymd: string): LienRunwayTone {
  const d = daysBetweenYmd(todayYmd, ymd) ?? 0
  return d <= 7 ? 'red' : d <= 21 ? 'amber' : 'grey'
}

function dated(verb: string, ymd: string, todayYmd: string): string {
  return `${verb ? `${verb} ` : ''}${formatYmdMonthDay(ymd)} · ${daysWords(todayYmd, ymd)}`
}

/** "August", or "August 2025" when the year is not today's. */
export function monthName(key: string | null, todayYmd: string): string {
  if (!key) return 'the last work month'
  const sameYear = key.slice(0, 4) === todayYmd.slice(0, 4)
  return new Date(`${key.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', sameYear ? { month: 'long', timeZone: 'UTC' } : { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function monthsApart(fromYmd: string, toYmd: string): number {
  return (Number(toYmd.slice(0, 4)) - Number(fromYmd.slice(0, 4))) * 12 + (Number(toYmd.slice(5, 7)) - Number(fromYmd.slice(5, 7)))
}

/** The property behind a lien date, read back from the dates: three months on is a house, four a commercial building. */
export function kindWords(job: Pick<LienCalendarJob, 'runway'>): string {
  const r = job.runway
  if (r.kindAssumed) return 'a property with no kind, read as a house'
  if (!r.basisYmd || !r.lienByYmd) return 'the property'
  const months = monthsApart(r.basisYmd, r.lienByYmd)
  return months >= 4 ? 'a commercial building' : 'a house'
}

function moneyFact(job: Pick<LienCalendarJob, 'openBalance'>): string {
  return `${formatUsdNoCents(job.openBalance)} is owed on this job.`
}

/** What a pay date means against the lien flag, as the card says it. */
export function payVersusLien(payYmd: string, lienByYmd: string, todayYmd: string): { tone: LienRunwayTone; text: string } {
  if (!lienByYmd) return { tone: 'amber', text: 'This job has no lien date.' }
  if (payYmd < todayYmd) return { tone: 'amber', text: 'That day has passed and the money is not in.' }
  const d = daysBetweenYmd(payYmd, lienByYmd) ?? 0
  if (d < 0) return { tone: 'red', text: `That is ${-d} ${-d === 1 ? 'day' : 'days'} after the lien flag. File first.` }
  if (d === 0) return { tone: 'red', text: 'That is the lien day itself. File first.' }
  return { tone: 'green', text: `That leaves ${d} ${d === 1 ? 'day' : 'days'} of room before the lien flag.` }
}

function lienWindowDoor(label = 'Open the Lien window ›'): LienMarkCardDoor {
  return { kind: 'lien_window', label }
}

function goneCard(key: string, ymd: string, by: 'notice' | 'lien', job: LienCalendarJob, todayYmd: string, pct: number | null): LienMarkCard {
  const date = formatYmdMonthDay(ymd)
  return {
    key,
    glyph: 'gone',
    tone: 'red',
    title: 'Lien gone',
    when: dated('Closed', ymd, todayYmd),
    whenTone: 'red',
    facts: [
      by === 'notice' ? `The § 53.056 notice was due ${date} and none is recorded.` : `The § 53.052 window closed ${date} with nothing filed.`,
      'Nothing can be filed after that day.',
      `${formatUsdNoCents(job.openBalance)} is still owed. Collections or the Legal desk can chase it.`,
    ],
    jobs: [],
    door: lienWindowDoor(),
    pct,
  }
}

/** One mark's card on a job row. */
export function lienMarkCard(m: LienCalendarMark, job: LienCalendarJob, todayYmd: string, doors: LienMarkDoors): LienMarkCard {
  const r = job.runway
  switch (m.kind) {
    case 'work': {
      const month = monthName(m.ymd.slice(0, 7), todayYmd)
      if (m.fromCreation)
        return {
          key: `work:${m.ymd}`,
          glyph: 'work_hollow',
          tone: 'amber',
          title: 'No approved hours',
          when: dated('Dated', m.ymd, todayYmd),
          whenTone: 'amber',
          facts: [
            `The board counts from the month the job was created, ${month}.`,
            'That is a stand-in, not a fact. If the work was done in another month, the flags sit in the wrong place.',
            'Approve the hours or set the last day before a notice goes out.',
          ],
          jobs: [],
          door: doors.lastWork ? { kind: 'last_work', label: 'Set the last day ›' } : null,
          pct: m.pct,
        }
      return {
        key: `work:${m.ymd}`,
        glyph: 'work',
        tone: 'grey',
        title: 'Last day worked',
        when: dated('', m.ymd, todayYmd),
        whenTone: 'grey',
        facts: [
          `The lien flag counts from ${month}. Each notice flag counts from its own month.`,
          r.datedByHand ? 'This day was set by hand.' : 'It is the last approved clock day on the job.',
          'A wrong day moves every flag on this row.',
        ],
        jobs: [],
        door: doors.lastWork ? { kind: 'last_work', label: 'Change the last day ›' } : null,
        pct: m.pct,
      }
    }
    case 'gone':
      return goneCard(`gone:${m.ymd}`, m.ymd, m.by, job, todayYmd, null)
    case 'pay': {
      const vs = payVersusLien(m.ymd, r.lienByYmd, todayYmd)
      return {
        key: `pay:${m.ymd}`,
        glyph: 'pay',
        tone: 'green',
        title: 'Pay date they gave',
        when: dated('', m.ymd, todayYmd),
        whenTone: vs.tone,
        facts: [vs.text, 'A promise on the job, the GC’s word, or the pay speed estimate.', moneyFact(job)],
        jobs: [],
        door: doors.pen ? { kind: 'pen', label: 'Change it ›' } : lienWindowDoor(),
        pct: m.pct,
      }
    }
    case 'pay_missing':
      return {
        key: 'pay_missing',
        glyph: 'pay_missing',
        tone: 'grey',
        title: 'No pay date yet',
        when: null,
        whenTone: 'grey',
        facts: ['Nobody has said when this will be paid.', moneyFact(job)],
        jobs: [],
        door: doors.pen ? { kind: 'pen', label: 'Record what they said ›' } : lienWindowDoor(),
        pct: m.pct,
      }
    case 'notice': {
      const month = monthName(m.monthKey, todayYmd)
      if (m.done)
        return {
          key: `notice:${m.ymd}:${m.monthKey ?? ''}`,
          glyph: 'notice_done',
          tone: 'green',
          title: `Notice on file · ${month}`,
          when: dated('Was due', m.ymd, todayYmd),
          whenTone: 'green',
          facts: [`${month}’s § 53.056 notice is recorded.`, `The lien for ${month} stays alive to its own flag.`],
          jobs: [],
          door: lienWindowDoor(),
          pct: m.pct,
        }
      if (m.mailed)
        return {
          key: `mailed:${m.ymd}:${m.monthKey ?? ''}`,
          glyph: 'mailed',
          tone: 'amber',
          title: `In the mail · ${month}`,
          when: dated('Record the number by', m.ymd, todayYmd),
          whenTone: deadlineTone(todayYmd, m.ymd),
          facts: [`${month}’s notice was printed from the desk and is on its way.`, 'Its certified number is not on record yet, so it is not on file.', moneyFact(job)],
          jobs: [],
          door: doors.record ? { kind: 'record', label: 'Record the mailing ›', jobIds: [job.jobId] } : lienWindowDoor(),
          pct: m.pct,
        }
      return {
        key: `notice:${m.ymd}:${m.monthKey ?? ''}`,
        glyph: 'notice',
        tone: m.tone,
        title: `Notice owed · ${month}`,
        when: dated('Send by', m.ymd, todayYmd),
        whenTone: deadlineTone(todayYmd, m.ymd),
        facts: [`A § 53.056 notice for ${month}’s work. It goes to the owner and the GC.`, moneyFact(job)],
        jobs: [],
        door: lienWindowDoor('Draft the notice ›'),
        pct: m.pct,
      }
    }
    case 'lien': {
      if (m.closed) return goneCard(`lien:${m.ymd}`, m.ymd, r.closedBy === 'notice' ? 'notice' : 'lien', job, todayYmd, m.pct)
      // A filed lien draws no flag: the runway's filed row keeps no date, so the row ends at its work tick.
      const basis = r.basisYmd ? monthName(r.basisYmd.slice(0, 7), todayYmd) : 'the last work month'
      return {
        key: `lien:${m.ymd}`,
        glyph: 'lien',
        tone: m.tone,
        title: 'Lien deadline',
        when: dated('File by', m.ymd, todayYmd),
        whenTone: deadlineTone(todayYmd, m.ymd),
        facts: ['The last day to file the lien affidavit with the county, § 53.052.', `Counted from ${basis}’s work on ${kindWords(job)}.`, moneyFact(job)],
        jobs: [],
        door: lienWindowDoor(),
        pct: m.pct,
      }
    }
    case 'run': {
      const payYmd = r.marks?.pay ? addDaysYmd(todayYmd, r.marks.pay.days) : null
      const lienDate = r.lienByYmd ? formatYmdMonthDay(r.lienByYmd) : 'the lien date'
      const payDate = payYmd ? formatYmdMonthDay(payYmd) : 'the pay date'
      const gap = payYmd && r.lienByYmd ? Math.abs(daysBetweenYmd(payYmd, r.lienByYmd) ?? 0) : 0
      const gapWords = `${gap} ${gap === 1 ? 'day' : 'days'}`
      return m.short
        ? {
            key: 'run',
            glyph: 'short',
            tone: 'red',
            title: 'File first',
            when: null,
            whenTone: 'red',
            facts: [`The lien window closes ${lienDate}, ${gapWords} before the money is expected on ${payDate}.`, 'File the affidavit first, or get the pay date moved ahead of the flag.'],
            jobs: [],
            door: lienWindowDoor(),
            pct: null,
          }
        : {
            key: 'run',
            glyph: 'room',
            tone: 'green',
            title: 'Room',
            when: null,
            whenTone: 'green',
            facts: [`The money is expected ${payDate}, ${gapWords} before the lien flag on ${lienDate}.`, 'Wait for it. The lien is still there if it does not come.'],
            jobs: [],
            door: null,
            pct: null,
          }
    }
    case 'bracket':
      return {
        key: 'bracket',
        glyph: 'bracket',
        tone: 'amber',
        title: 'Kind not set',
        when: null,
        whenTone: 'amber',
        facts: [`The board shows the house date, ${r.lienByYmd ? formatYmdMonthDay(r.lienByYmd) : 'the earlier one'}. A commercial building would be ${formatYmdMonthDay(m.toYmd)}.`, 'A house read as commercial is a lien lost a month late.'],
        jobs: [],
        door: doors.kinds ? { kind: 'kinds', label: 'Set the kind ›' } : null,
        pct: null,
      }
  }
}

/** The marks that sit at one point on the line. A run, a bracket and the grey wash are areas with their own hover. */
export function isPointMark(m: LienCalendarMark): boolean {
  return m.kind === 'work' || m.kind === 'pay' || m.kind === 'pay_missing' || m.kind === 'notice' || m.kind === 'lien'
}

export type LienMarkCluster = { key: string; pct: number; indexes: number[] }

/** Chains of points no further apart than `thresholdPct`, left to right; each index is the mark's place in `marks`. */
export function clusterByPct(points: ReadonlyArray<{ index: number; pct: number }>, thresholdPct: number): LienMarkCluster[] {
  const sorted = [...points].sort((a, b) => a.pct - b.pct || a.index - b.index)
  const out: LienMarkCluster[] = []
  let cur: LienMarkCluster | null = null
  let last = 0
  for (const p of sorted) {
    if (cur && p.pct - last <= thresholdPct) {
      cur.indexes.push(p.index)
    } else {
      cur = { key: '', pct: p.pct, indexes: [p.index] }
      out.push(cur)
    }
    last = p.pct
  }
  for (const c of out) c.key = c.indexes.join('-')
  return out
}

/** A job row's point marks folded into clusters: marks that touch share one card. */
export function lienMarkClusters(marks: ReadonlyArray<LienCalendarMark>, thresholdPct: number): LienMarkCluster[] {
  const points: Array<{ index: number; pct: number }> = []
  marks.forEach((m, index) => {
    if (isPointMark(m) && 'pct' in m) points.push({ index, pct: m.pct })
  })
  return clusterByPct(points, thresholdPct)
}

function sumWords(jobs: ReadonlyArray<LienMarkCardJob>): string {
  const total = jobs.reduce((s, j) => s + j.money, 0)
  return `${formatUsdNoCents(total)} across the ${jobs.length}.`
}

/** A GC row's folded flag at one date: a card per kind present, each listing the jobs behind its count. */
export function lienGroupFlagCards(f: LienCalendarGroupFlag, group: Pick<LienCalendarGroup, 'jobs' | 'kind'>, axis: LienCalendarAxis, todayYmd: string, doors: LienMarkDoors): LienMarkCard[] {
  const owed: LienMarkCardJob[] = []
  const mailed: LienMarkCardJob[] = []
  const liens: LienMarkCardJob[] = []
  for (const j of group.jobs) {
    for (const m of lienCalendarMarks(j, axis)) {
      if (m.kind === 'notice' && m.ymd === f.ymd && !m.done) (m.mailed ? mailed : owed).push({ jobId: j.jobId, number: j.number, name: j.name, month: monthName(m.monthKey, todayYmd), money: j.openBalance })
      else if (m.kind === 'lien' && m.ymd === f.ymd && !m.closed) liens.push({ jobId: j.jobId, number: j.number, name: j.name, month: null, money: j.openBalance })
    }
  }
  const out: LienMarkCard[] = []
  if (owed.length)
    out.push({
      key: `group-notices:${f.ymd}`,
      glyph: 'notice',
      tone: f.tone,
      title: `${owed.length} ${owed.length === 1 ? 'notice' : 'notices'} owed`,
      when: dated('Send by', f.ymd, todayYmd),
      whenTone: deadlineTone(todayYmd, f.ymd),
      facts: owed.length > 1 ? [sumWords(owed)] : [],
      jobs: owed,
      door: doors.draft ? { kind: 'draft', label: `Draft the ${owed.length} ›`, ymd: f.ymd, jobIds: owed.map((j) => j.jobId) } : null,
      pct: f.pct,
    })
  if (mailed.length)
    out.push({
      key: `group-mailed:${f.ymd}`,
      glyph: 'mailed',
      tone: 'amber',
      title: `${mailed.length} in the mail`,
      when: dated(mailed.length === 1 ? 'Record the number by' : 'Record the numbers by', f.ymd, todayYmd),
      whenTone: deadlineTone(todayYmd, f.ymd),
      facts: ['Printed from the desk and on the way. The certified numbers are not on record yet.'],
      jobs: mailed,
      door: doors.record ? { kind: 'record', label: mailed.length === 1 ? 'Record the mailing ›' : `Record the ${mailed.length} mailings ›`, jobIds: mailed.map((j) => j.jobId) } : null,
      pct: f.pct,
    })
  if (liens.length)
    out.push({
      key: `group-liens:${f.ymd}`,
      glyph: 'lien',
      tone: group.kind === 'gone' ? 'red' : f.tone,
      title: `${liens.length} ${liens.length === 1 ? 'lien' : 'liens'} to file`,
      when: dated('File by', f.ymd, todayYmd),
      whenTone: deadlineTone(todayYmd, f.ymd),
      facts: ['The last day to file each affidavit with the county, § 53.052.', 'Open the row to see each job’s own flag.', ...(liens.length > 1 ? [sumWords(liens)] : [])],
      jobs: liens,
      door: null,
      pct: f.pct,
    })
  return out
}

/** The GC row's one dot: the GC's word for every job, or none yet. */
export function lienGroupWordCard(group: Pick<LienCalendarGroup, 'name' | 'jobs'>, wordYmd: string | null, todayYmd: string, canPen: boolean): LienMarkCard {
  const n = group.jobs.length
  if (wordYmd)
    return {
      key: `group-word:${wordYmd}`,
      glyph: 'pay',
      tone: 'green',
      title: `${group.name} said ${formatYmdMonthDay(wordYmd)}`,
      when: dated('', wordYmd, todayYmd),
      whenTone: wordYmd < todayYmd ? 'amber' : 'green',
      facts: [`One word for all ${n} ${n === 1 ? 'job' : 'jobs'}.`],
      jobs: [],
      door: canPen ? { kind: 'pen', label: 'Change it ›' } : null,
      pct: null,
    }
  return {
    key: 'group-word',
    glyph: 'pay_missing',
    tone: 'grey',
    title: 'No pay date yet',
    when: null,
    whenTone: 'grey',
    facts: [`No one date for ${group.name}’s ${n} ${n === 1 ? 'job' : 'jobs'} yet.`, canPen ? 'Press the dot to give the GC’s word for all of them.' : 'The office can record the GC’s word for all of them.'],
    jobs: [],
    door: canPen ? { kind: 'pen', label: 'Record the GC’s word ›' } : null,
    pct: null,
  }
}
