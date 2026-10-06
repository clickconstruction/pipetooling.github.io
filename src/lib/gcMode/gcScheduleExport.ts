/**
 * GC mode design spike: the schedule as a file, the Gantt's G-136 (mock-up and plan
 * `to-dos/gc-mode/mockups/G-136.md`). A customer who keeps a master schedule of their own in
 * Microsoft Project or Primavera P6 asks for ours in it; an owner asks for it in Excel. Two files
 * from one set of rows (`scheduleExport`): a spreadsheet (`scheduleCsv`) and the project file both
 * programs read (`scheduleMspdi`, the common part of Microsoft Project's XML schema, MSPDI).
 *
 * A file is the logic of the job, so it is always the whole schedule: the chart's filters and folds
 * never reach it, since a bar left out would cut the waits the rest hang on. It reads the chart's
 * bars, which read `project.schedule`, so the rough (G-45, `project.rough`) and a what-if copy never
 * reach a file. The customer's copies read `customerSchedulePicture` and nothing else: what a
 * customer may see is decided in `gcCustomerSchedule.ts`, once, for the portal, the letter, the
 * paper and the files.
 *
 * Every day is a working day (the owner's 365-day rule), so the project file carries one calendar
 * with seven working days and a bar of 12 days is 12 days in both programs. Both programs place a
 * task as early as its waits allow, so each task starts no earlier than its day in our plan
 * (`ConstraintType` 4): the programs draw our dates, and only work held past its start by what it
 * waits on moves, which is the hold the chart shows.
 *
 * Its own file, out of the barrel: it reads the Gantt's kernel, the print's words and the
 * customer's schedule.
 */
import type { WaitKind } from './gcTypes'
import type { MilestoneRow } from './gcBuildingSchedule'
import { ganttGroups, workingDays, type GanttBar, type GanttGroupBy } from './gcGantt'
import { CUSTOMER_STAGE_WORDS, customerBarWords, type CustomerSchedulePicture } from './gcCustomerSchedule'
import { forWords, type GanttPrintFor, type GanttPrintInput } from './gcGanttPrint'
import { waitKind, type WaitRow } from './gcScheduleWaits'

// ---------------------------------------------------------------------------------------------
// What goes in, what comes out
// ---------------------------------------------------------------------------------------------

/** What the window hands over: the print's input without the paper's own fields. Its filters and folds, if any, are never read. */
export type GanttExportInput = Pick<GanttPrintInput, 'bars' | 'by' | 'milestones' | 'waits' | 'today' | 'building' | 'for' | 'job'>

/** Which picture: our chart, the customer's stages (an owner), or every bar as the customer's list (a GC or an owner's rep). */
export type ExportCopy = 'team' | 'stages' | 'everyBar'

/** A row's kind: a group, a bar (a trade's line, an inspection, an added activity), a customer's stage, a date to meet, or what the work waits on from outside. */
export type ExportKind = 'group' | 'activity' | 'inspection' | 'added' | 'stage' | 'date' | WaitKind

/** One line of the file: a group (a summary task) or what sits under it. */
export interface ExportRow {
  /** 1, 2, 3… in file order: a group, then what is under it. The project file's task numbers. */
  uid: number
  /** 1: a group, a summary task in the project file and the group cell in the spreadsheet. 2: what is under it. */
  level: 1 | 2
  kind: ExportKind
  /** The group it is under: its own name for a group. */
  group: string
  name: string
  /** Our team's copy only, and only for a trade's line or a wait for one. */
  trade: string | null
  /** Our team's copy only. */
  company: string | null
  start: string
  finish: string
  /** Days it takes, every day worked. Null: a date to meet or a wait, a day of its own. */
  days: number | null
  /** Percent done. Null: not said. */
  done: number | null
  /** Spare days before it moves the finish. Our team's copy only, and only for work not done. */
  spare: number | null
  /** The chart's words for where it stands, or the customer's. */
  stands: string
  /** What it waits on, by the rows' numbers, with the days of gap. Our team's copy only. */
  waitsOn: { uid: number; name: string; gap: number }[]
  notBefore: string | null
  mustFinishBy: string | null
  /** The days it really started and finished, where known: our team's copy, and a date met. */
  actualStart: string | null
  actualFinish: string | null
}

export interface ScheduleExport {
  for: GanttPrintFor
  copy: ExportCopy
  rows: ExportRow[]
  /** "The whole schedule, by trade: 30 activities, 3 things the work waits on and 4 dates to meet." */
  count: string
  /** The line under Who it is for: the print's own, so the two windows say it one way. */
  forWords: string
  /** The job's name: the project file's title. */
  title: string
  today: string
  files: { csv: string; xml: string }
}

// ---------------------------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------------------------

/** The group of outside waits, as the chart heads its row. */
export const EXPORT_WAITS_GROUP = 'What the work waits on'
/** The dates to meet: as the chart heads them for our team, and as the portal does for the customer. */
export const EXPORT_DATES_TEAM = 'Dates the job must meet'
export const EXPORT_DATES_CUSTOMER = 'Dates to meet'
/** An owner's stages sit under one group: Primavera wants every activity under one. */
export const EXPORT_STAGES_GROUP = 'Stages of the job'

const WAIT_KINDS: readonly ExportKind[] = ['delivery', 'decision', 'permit', 'utility']

export function isWaitRow(r: Pick<ExportRow, 'kind'>): boolean {
  return WAIT_KINDS.includes(r.kind)
}

/** A date to meet or a wait: a day of its own, a milestone in the project file. */
export function isMilestoneRow(r: Pick<ExportRow, 'kind' | 'level'>): boolean {
  return r.level === 2 && (r.kind === 'date' || isWaitRow(r))
}

/** A row before it is numbered: `key` is how the rows it waits on name it, `ref` how the spreadsheet does. */
type Draft = Omit<ExportRow, 'uid' | 'level' | 'waitsOn'> & { key: string; ref: string; after: { key: string; gap: number }[] }
type GroupDraft = { name: string; rows: Draft[] }

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "a", "a and b", "a, b and c". */
function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`
}

function barKind(b: GanttBar): ExportKind {
  return b.item.activity.inspection ? 'inspection' : b.item.activity.added ? 'added' : 'activity'
}

/** How the hover card names a bar it waits on: an inspection or the job's own by its name, a trade's line with the trade. */
function barRef(b: GanttBar): string {
  return b.item.pkg ? `${b.item.label} (${b.item.trade})` : b.item.label
}

/** A date to meet in a few words: "met", "met 3 days late", "7 days late", "due". */
function dateWords(r: MilestoneRow): string {
  const late = plural(r.daysLate, 'day late', 'days late')
  if (r.state === 'hit') return 'met'
  if (r.state === 'missed') return `met ${late}`
  if (r.state === 'late') return late
  return 'due'
}

function dateDraft(r: MilestoneRow, group: string, team: boolean): Draft {
  const met = r.milestone.metOn
  return {
    key: `date:${r.milestone.id}`,
    ref: r.milestone.label,
    after: [],
    kind: 'date',
    group,
    name: r.milestone.label,
    trade: null,
    company: team ? r.company : null,
    start: r.due,
    finish: r.due,
    days: null,
    done: met ? 100 : null,
    spare: null,
    stands: dateWords(r),
    notBefore: null,
    mustFinishBy: null,
    actualStart: met,
    actualFinish: met,
  }
}

function byDue(milestones: MilestoneRow[]): MilestoneRow[] {
  return [...milestones].sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
}

/** Our team's copy: the chart's groups as it groups them, every bar, then what the work waits on, then the dates the job must meet. */
function teamGroups(input: GanttExportInput): GroupDraft[] {
  const heldBy = new Map<string, WaitRow[]>()
  for (const w of input.waits) for (const h of w.holds) heldBy.set(h.lineId, [...(heldBy.get(h.lineId) ?? []), w])
  const groups: GroupDraft[] = ganttGroups(input.bars, input.by).map((g) => ({
    name: g.title,
    rows: g.bars.map((b): Draft => {
      const a = b.item.activity
      return {
        key: b.id,
        ref: barRef(b),
        after: [...a.after.map((id) => ({ key: id, gap: a.lag?.[id] ?? 0 })), ...(heldBy.get(b.id) ?? []).map((w) => ({ key: `wait:${w.wait.id}`, gap: 0 }))],
        kind: barKind(b),
        group: g.title,
        name: b.item.label,
        trade: b.item.pkg ? b.item.trade : null,
        company: b.item.company,
        start: a.start,
        finish: a.finish,
        days: b.workDays,
        done: input.building ? Math.round(Math.min(100, b.item.actual)) : null,
        spare: b.status === 'done' ? null : b.spare,
        stands: b.statusWords,
        notBefore: a.notBefore ?? null,
        mustFinishBy: a.mustFinishBy ?? null,
        actualStart: a.actualStart ?? null,
        actualFinish: a.actualFinish ?? null,
      }
    }),
  }))
  // What the work waits on from outside: each a day of its own, the day it is expected or came, which the work it holds waits on.
  groups.push({
    name: EXPORT_WAITS_GROUP,
    rows: input.waits.map((w): Draft => {
      const day = w.wait.doneOn ?? w.wait.expectedOn
      const name = `${cap(w.wait.title)} ${waitKind(w.wait.kind).done}`
      return {
        key: `wait:${w.wait.id}`,
        ref: name,
        after: [],
        kind: w.wait.kind,
        group: EXPORT_WAITS_GROUP,
        name,
        trade: w.wait.packageId ? w.trade : null,
        company: w.wait.who,
        start: day,
        finish: day,
        days: null,
        done: w.state === 'done' ? 100 : null,
        spare: null,
        stands: w.state !== 'done' && w.late ? `${w.stateWords}, late` : w.stateWords,
        notBefore: null,
        mustFinishBy: null,
        actualStart: w.wait.doneOn,
        actualFinish: w.wait.doneOn,
      }
    }),
  })
  groups.push({ name: EXPORT_DATES_TEAM, rows: byDue(input.milestones).map((r) => dateDraft(r, EXPORT_DATES_TEAM, true)) })
  return groups
}

/** An owner's copy: their portal's stages, each with its dates and percent, then the dates to meet. */
function stageGroups(input: GanttExportInput, picture: CustomerSchedulePicture): GroupDraft[] {
  return [
    {
      name: EXPORT_STAGES_GROUP,
      rows: picture.stages.map(
        (s): Draft => ({
          key: `stage:${s.key}`,
          ref: s.label,
          after: [],
          kind: 'stage',
          group: EXPORT_STAGES_GROUP,
          name: s.label,
          trade: null,
          company: null,
          start: s.start,
          finish: s.finish,
          days: workingDays(s.start, s.finish),
          done: input.building ? Math.round(s.pct) : null,
          spare: null,
          stands: CUSTOMER_STAGE_WORDS[s.state],
          notBefore: null,
          mustFinishBy: null,
          actualStart: null,
          actualFinish: null,
        }),
      ),
    },
    { name: EXPORT_DATES_CUSTOMER, rows: byDue(picture.milestones).map((r) => dateDraft(r, EXPORT_DATES_CUSTOMER, false)) },
  ]
}

/**
 * A GC's or an owner's rep's copy: every bar of their portal's list, by stage, in their words, then
 * the dates to meet. The list puts the stage running today first; a file is read top to bottom, so
 * its stages go in the order built.
 */
function everyBarGroups(picture: CustomerSchedulePicture): GroupDraft[] {
  const bars = picture.fullChart.flatMap((x) => x.group.bars)
  return [
    ...ganttGroups(bars, 'stage').map((g) => ({
      name: g.title,
      rows: g.bars.map(
        (b): Draft => ({
          key: b.id,
          ref: b.item.label,
          after: [],
          kind: barKind(b),
          group: g.title,
          name: b.item.label,
          trade: null,
          company: null,
          start: b.item.activity.start,
          finish: b.item.activity.finish,
          days: b.workDays,
          done: b.status === 'done' ? 100 : null,
          spare: null,
          stands: customerBarWords(b).words,
          notBefore: null,
          mustFinishBy: null,
          actualStart: null,
          actualFinish: null,
        }),
      ),
    })),
    { name: EXPORT_DATES_CUSTOMER, rows: byDue(picture.milestones).map((r) => dateDraft(r, EXPORT_DATES_CUSTOMER, false)) },
  ]
}

/** Numbers the rows in file order and turns each wait into the number of the row waited on. A wait whose other end is not in the file is left out. */
function numbered(groups: GroupDraft[]): ExportRow[] {
  const kept = groups.filter((g) => g.rows.length > 0)
  const uidOf = new Map<string, { uid: number; ref: string }>()
  let next = 0
  const plan = kept.map((g) => ({ g, uid: ++next, rows: g.rows.map((r) => ({ r, uid: ++next })) }))
  for (const p of plan) for (const { r, uid } of p.rows) uidOf.set(r.key, { uid, ref: r.ref })
  return plan.flatMap(({ g, uid, rows }): ExportRow[] => {
    const start = g.rows.reduce((m, r) => (r.start < m ? r.start : m), g.rows[0]?.start ?? '')
    const finish = g.rows.reduce((m, r) => (r.finish > m ? r.finish : m), g.rows[0]?.finish ?? '')
    const head: ExportRow = {
      uid,
      level: 1,
      kind: 'group',
      group: g.name,
      name: g.name,
      trade: null,
      company: null,
      start,
      finish,
      days: workingDays(start, finish),
      done: null,
      spare: null,
      stands: '',
      waitsOn: [],
      notBefore: null,
      mustFinishBy: null,
      actualStart: null,
      actualFinish: null,
    }
    return [
      head,
      ...rows.map(({ r, uid: n }): ExportRow => {
        const { key: _key, ref: _ref, after, ...row } = r
        const waitsOn = after.flatMap((w) => {
          const to = uidOf.get(w.key)
          return to ? [{ uid: to.uid, name: to.ref, gap: w.gap }] : []
        })
        return { ...row, uid: n, level: 2, waitsOn }
      }),
    ]
  })
}

const BY_WORDS: Record<GanttGroupBy, string> = { trade: 'by trade', stage: 'by stage', company: 'by company' }

function countWords(copy: ExportCopy, by: GanttGroupBy, rows: ExportRow[]): string {
  const work = rows.filter((r) => r.kind === 'activity' || r.kind === 'inspection' || r.kind === 'added').length
  const stages = rows.filter((r) => r.kind === 'stage').length
  const waits = rows.filter(isWaitRow).length
  const dates = rows.filter((r) => r.kind === 'date').length
  const parts = [
    copy === 'stages' ? plural(stages, 'stage', 'stages') : plural(work, 'activity', 'activities'),
    ...(waits > 0 ? [plural(waits, 'thing the work waits on', 'things the work waits on')] : []),
    ...(dates > 0 ? [plural(dates, 'date to meet', 'dates to meet')] : []),
  ]
  return `The whole schedule, ${copy === 'team' ? BY_WORDS[by] : 'by stage'}: ${andList(parts)}.`
}

/** "Fair-Oaks-Shops-Building-D-schedule-2026-10-02.csv"; the customer's says who it is for: "…-schedule-for-Cibolo-Creek-Partners-2026-10-02.csv". */
export function exportFileName(job: string, today: string, ext: 'csv' | 'xml', customer: string | null): string {
  const safe = `${job} schedule${customer ? ` for ${customer}` : ''} ${today}`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${safe || 'schedule'}.${ext}`
}

/** The schedule as rows: the chart's bars for our team, the customer's picture for them. Never filtered, never folded. */
export function scheduleExport(input: GanttExportInput): ScheduleExport {
  const picture = input.job.customer
  const copy: ExportCopy = input.for === 'team' ? 'team' : picture.everyBar ? 'everyBar' : 'stages'
  const rows = numbered(copy === 'team' ? teamGroups(input) : copy === 'stages' ? stageGroups(input, picture) : everyBarGroups(picture))
  const customer = input.for === 'customer' ? picture.name : null
  return {
    for: input.for,
    copy,
    rows,
    count: countWords(copy, input.by, rows),
    forWords: forWords(input),
    title: input.job.name,
    today: input.today,
    files: { csv: exportFileName(input.job.name, input.today, 'csv', customer), xml: exportFileName(input.job.name, input.today, 'xml', customer) },
  }
}

// ---------------------------------------------------------------------------------------------
// The spreadsheet
// ---------------------------------------------------------------------------------------------

const KIND_WORDS: Record<ExportKind, string> = {
  group: 'group',
  activity: 'activity',
  inspection: 'inspection',
  added: 'added activity',
  stage: 'stage',
  date: 'date to meet',
  delivery: 'delivery',
  decision: 'decision',
  permit: 'permit',
  utility: 'utility',
}

/** "Foundations (Concrete)", "Slab on grade (Concrete) +3 days". */
function waitsOnWords(w: ExportRow['waitsOn'][number]): string {
  if (w.gap === 0) return w.name
  return `${w.name} ${w.gap > 0 ? '+' : '-'}${plural(Math.abs(w.gap), 'day', 'days')}`
}

type Column = { head: string; cell: (r: ExportRow) => string | number | null }

/** The columns of each copy. The customer's have no company, no spare days and no waits. */
export const CSV_COLUMNS: Record<ExportCopy, Column[]> = {
  team: [
    { head: 'Group', cell: (r) => r.group },
    { head: 'Activity', cell: (r) => r.name },
    { head: 'Kind', cell: (r) => KIND_WORDS[r.kind] },
    { head: 'Trade', cell: (r) => r.trade },
    { head: 'Company', cell: (r) => r.company },
    { head: 'Start', cell: (r) => r.start },
    { head: 'Finish', cell: (r) => r.finish },
    { head: 'Days', cell: (r) => r.days },
    { head: 'Done %', cell: (r) => r.done },
    { head: 'Spare days', cell: (r) => r.spare },
    { head: 'Where it stands', cell: (r) => r.stands },
    { head: 'Waits on', cell: (r) => r.waitsOn.map(waitsOnWords).join('; ') },
    { head: 'Not before', cell: (r) => r.notBefore },
    { head: 'Must finish by', cell: (r) => r.mustFinishBy },
    { head: 'Really started', cell: (r) => r.actualStart },
    { head: 'Really finished', cell: (r) => r.actualFinish },
  ],
  everyBar: [
    { head: 'Stage', cell: (r) => r.group },
    { head: 'Activity', cell: (r) => r.name },
    { head: 'Start', cell: (r) => r.start },
    { head: 'Finish', cell: (r) => r.finish },
    { head: 'Where it stands', cell: (r) => r.stands },
  ],
  stages: [
    { head: 'Group', cell: (r) => r.group },
    { head: 'Name', cell: (r) => r.name },
    { head: 'Start', cell: (r) => r.start },
    { head: 'Finish', cell: (r) => r.finish },
    { head: 'Done %', cell: (r) => r.done },
    { head: 'Where it stands', cell: (r) => r.stands },
  ],
}

/** One cell, RFC 4180: quoted when it holds a comma, a quote or a line break. Text a spreadsheet would run as a formula starts with a quote mark (OWASP's rule for CSV files). */
function csvCell(v: string | number | null): string {
  if (v === null) return ''
  if (typeof v === 'number') return String(v)
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * The spreadsheet: a header, then one line for each row under a group, the group in its own column.
 * UTF-8 with the byte-order mark Excel looks for, so an accent or a dash opens right; dates as
 * 2026-10-09, which every spreadsheet reads as a date; lines end CRLF.
 */
export function scheduleCsv(x: Pick<ScheduleExport, 'rows' | 'copy'>): string {
  const columns = CSV_COLUMNS[x.copy]
  const lines = [columns.map((c) => csvCell(c.head)).join(','), ...x.rows.filter((r) => r.level === 2).map((r) => columns.map((c) => csvCell(c.cell(r))).join(','))]
  return `﻿${lines.join('\r\n')}\r\n`
}

// ---------------------------------------------------------------------------------------------
// The project file
// ---------------------------------------------------------------------------------------------

export const MSPDI_NAMESPACE = 'http://schemas.microsoft.com/project'
/** Project's first text field on a task, which the file names Company. Our team's copy only. */
export const MSPDI_TEXT1 = 188743731
/** A working day: 8:00 to 12:00 and 13:00 to 17:00, 480 minutes, in tenths of a minute for a link's gap. */
const DAY_START = '08:00:00'
const DAY_FINISH = '17:00:00'
const MINUTES_PER_DAY = 480
const LAG_PER_DAY = MINUTES_PER_DAY * 10
/** Days, the format both programs show a duration and a gap in. */
const FORMAT_DAYS = 7
/** Finish to start: the only kind of wait the app has. */
const FINISH_TO_START = 1
/** Start no earlier than. */
const START_NO_EARLIER_THAN = 4

/** XML text: the five marks escaped, and the control characters XML 1.0 refuses taken out. */
function xmlText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function el(name: string, value: string | number): string {
  return `<${name}>${typeof value === 'number' ? String(value) : xmlText(value)}</${name}>`
}

/** A duration of whole working days: "PT96H0M0S" for 12. */
function hours(days: number): string {
  return `PT${days * (MINUTES_PER_DAY / 60)}H0M0S`
}

/** The one calendar: every day worked, 8:00 to 17:00 with an hour at noon. */
function calendarXml(): string {
  const day = (type: number) =>
    `<WeekDay>${el('DayType', type)}${el('DayWorking', 1)}<WorkingTimes><WorkingTime>${el('FromTime', DAY_START)}${el('ToTime', '12:00:00')}</WorkingTime><WorkingTime>${el('FromTime', '13:00:00')}${el('ToTime', DAY_FINISH)}</WorkingTime></WorkingTimes></WeekDay>`
  return `<Calendar>${el('UID', 1)}${el('Name', 'Every day')}${el('IsBaseCalendar', 1)}${el('BaseCalendarUID', -1)}<WeekDays>${[1, 2, 3, 4, 5, 6, 7].map(day).join('')}</WeekDays></Calendar>`
}

/**
 * One task, its elements in the schema's order. A milestone sits at the end of its day, so the work
 * that waits on it starts the next morning, as the chart holds it. Every task under a group starts
 * no earlier than its day in our plan (or its Not before, if later), so neither program moves it.
 */
function taskXml(r: ExportRow, outline: string, withCompany: boolean): string {
  const milestone = isMilestoneRow(r)
  const startAt = milestone ? DAY_FINISH : DAY_START
  const pin = r.notBefore && r.notBefore > r.start ? r.notBefore : r.start
  return [
    '<Task>',
    el('UID', r.uid),
    el('ID', r.uid),
    el('Name', r.name),
    el('OutlineNumber', outline),
    el('OutlineLevel', r.level),
    el('Start', `${r.start}T${startAt}`),
    el('Finish', `${r.finish}T${DAY_FINISH}`),
    el('Duration', hours(milestone ? 0 : workingDays(r.start, r.finish))),
    el('DurationFormat', FORMAT_DAYS),
    el('Milestone', milestone ? 1 : 0),
    el('Summary', r.level === 1 ? 1 : 0),
    r.done !== null ? el('PercentComplete', r.done) : '',
    r.actualStart ? el('ActualStart', `${r.actualStart}T${startAt}`) : '',
    r.actualFinish ? el('ActualFinish', `${r.actualFinish}T${DAY_FINISH}`) : '',
    r.level === 2 ? `${el('ConstraintType', START_NO_EARLIER_THAN)}${el('ConstraintDate', `${pin}T${startAt}`)}` : '',
    ...r.waitsOn.map((w) => `<PredecessorLink>${el('PredecessorUID', w.uid)}${el('Type', FINISH_TO_START)}${el('CrossProject', 0)}${el('LinkLag', w.gap * LAG_PER_DAY)}${el('LagFormat', FORMAT_DAYS)}</PredecessorLink>`),
    withCompany && r.company && r.level === 2 ? `<ExtendedAttribute>${el('FieldID', MSPDI_TEXT1)}${el('Value', r.company)}</ExtendedAttribute>` : '',
    '</Task>',
  ].join('')
}

/**
 * The project file both programs read: Microsoft Project's XML (MSPDI), only the part Primavera P6
 * imports too. One every-day calendar; the groups as summary tasks, which Primavera makes its WBS,
 * so nothing sits at the top alone; tasks numbered 1, 2, 3; links only between tasks in the file;
 * no baselines, deadlines, resources or notes. The company rides in the first text field, on our
 * team's copy only.
 */
export function scheduleMspdi(x: ScheduleExport): string {
  const withCompany = x.copy === 'team'
  const first = x.rows.reduce((m, r) => (r.start < m ? r.start : m), x.rows[0]?.start ?? x.today)
  const last = x.rows.reduce((m, r) => (r.finish > m ? r.finish : m), x.rows[0]?.finish ?? x.today)
  let group = 0
  let child = 0
  const tasks = x.rows.map((r) => {
    if (r.level === 1) {
      group += 1
      child = 0
      return taskXml(r, String(group), withCompany)
    }
    child += 1
    return taskXml(r, `${group}.${child}`, withCompany)
  })
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<Project xmlns="${MSPDI_NAMESPACE}">`,
    el('SaveVersion', 14),
    el('Name', x.files.xml),
    el('Title', x.title),
    el('ScheduleFromStart', 1),
    el('StartDate', `${first}T${DAY_START}`),
    el('FinishDate', `${last}T${DAY_FINISH}`),
    el('CalendarUID', 1),
    el('DefaultStartTime', DAY_START),
    el('DefaultFinishTime', DAY_FINISH),
    el('MinutesPerDay', MINUTES_PER_DAY),
    el('MinutesPerWeek', MINUTES_PER_DAY * 7),
    el('DaysPerMonth', 30),
    el('DurationFormat', FORMAT_DAYS),
    el('StatusDate', `${x.today}T${DAY_FINISH}`),
    ...(withCompany ? [`<ExtendedAttributes><ExtendedAttribute>${el('FieldID', MSPDI_TEXT1)}${el('FieldName', 'Text1')}${el('Alias', 'Company')}</ExtendedAttribute></ExtendedAttributes>`] : []),
    `<Calendars>${calendarXml()}</Calendars>`,
    '<Tasks>',
    ...tasks,
    '</Tasks>',
    '</Project>',
    '',
  ].join('\n')
}
