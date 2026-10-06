/**
 * GC mode design spike: the made-up file G-145's tests and the browser check bring in (mock-up
 * `to-dos/gc-mode/mockups/G-145.md`). Cibolo Creek Partners' master schedule for Fair Oaks Shops,
 * Building D, as Microsoft Project saves it with Save as XML: the job's summary as task 0, a group of
 * six dates and a group of nine activities. Their dates against ours, today Fri Oct 2: Notice to
 * proceed passed, Slab poured ours met, Dry-in 7 days later, the rough-in inspection 3 days later,
 * substantial completion 7 days earlier, and a new Grand opening. Never read by the app itself.
 */
import { MSPDI_NAMESPACE } from './gcScheduleExport'

export const THEIR_DATES_SAMPLE_FILE = 'cibolo-master.xml'

type SampleTask = { uid: number; name: string; level: number; summary?: boolean; milestone?: boolean; start: string; finish: string }

const TASKS: SampleTask[] = [
  { uid: 0, name: 'Fair Oaks Shops, Building D', level: 0, summary: true, start: '2026-07-01', finish: '2027-01-15' },
  { uid: 1, name: 'Owner milestones', level: 1, summary: true, start: '2026-07-01', finish: '2027-01-15' },
  { uid: 2, name: 'Notice to proceed', level: 2, milestone: true, start: '2026-07-01', finish: '2026-07-01' },
  { uid: 3, name: 'Slab poured', level: 2, milestone: true, start: '2026-08-28', finish: '2026-08-28' },
  { uid: 4, name: 'Dry-in', level: 2, milestone: true, start: '2026-10-02', finish: '2026-10-02' },
  { uid: 5, name: 'Rough-in inspection', level: 2, milestone: true, start: '2026-10-16', finish: '2026-10-16' },
  { uid: 6, name: 'Substantial completion', level: 2, milestone: true, start: '2026-12-04', finish: '2026-12-04' },
  { uid: 7, name: 'Grand opening', level: 2, milestone: true, start: '2027-01-15', finish: '2027-01-15' },
  { uid: 8, name: 'Shell building', level: 1, summary: true, start: '2026-07-06', finish: '2026-12-04' },
  { uid: 9, name: 'Site work', level: 2, start: '2026-07-06', finish: '2026-08-28' },
  { uid: 10, name: 'Foundations', level: 2, start: '2026-07-20', finish: '2026-08-07' },
  { uid: 11, name: 'Slab', level: 2, start: '2026-08-10', finish: '2026-08-28' },
  { uid: 12, name: 'Structural steel', level: 2, start: '2026-08-17', finish: '2026-10-02' },
  { uid: 13, name: 'Roofing', level: 2, start: '2026-09-21', finish: '2026-10-21' },
  { uid: 14, name: 'MEP rough-in', level: 2, start: '2026-09-14', finish: '2026-10-09' },
  { uid: 15, name: 'Interior finishes', level: 2, start: '2026-10-19', finish: '2026-11-20' },
  { uid: 16, name: 'Site finish', level: 2, start: '2026-10-19', finish: '2026-11-13' },
  { uid: 17, name: 'Punch list', level: 2, start: '2026-11-23', finish: '2026-12-04' },
]

function el(name: string, value: string | number): string {
  return `<${name}>${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</${name}>`
}

function hours(t: SampleTask): string {
  if (t.milestone || t.summary) return 'PT0H0M0S'
  const d = Math.round((Date.parse(t.finish) - Date.parse(t.start)) / 86400000) + 1
  return `PT${d * 8}H0M0S`
}

/** The file, as Project writes it: only the elements G-137's reader reads, in the schema's order. */
export const THEIR_DATES_SAMPLE_XML = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  `<Project xmlns="${MSPDI_NAMESPACE}">`,
  el('SaveVersion', 14),
  el('Name', THEIR_DATES_SAMPLE_FILE),
  el('Title', 'Fair Oaks Shops, Building D'),
  el('Company', 'Cibolo Creek Partners'),
  el('ScheduleFromStart', 1),
  el('StartDate', '2026-07-01T08:00:00'),
  el('FinishDate', '2027-01-15T17:00:00'),
  el('MinutesPerDay', 480),
  '<Tasks>',
  ...TASKS.map((t) =>
    [
      '<Task>',
      el('UID', t.uid),
      el('ID', t.uid),
      el('Name', t.name),
      el('OutlineLevel', t.level),
      el('Start', `${t.start}T08:00:00`),
      el('Finish', `${t.finish}T17:00:00`),
      el('Duration', hours(t)),
      el('Milestone', t.milestone ? 1 : 0),
      el('Summary', t.summary ? 1 : 0),
      '</Task>',
    ].join(''),
  ),
  '</Tasks>',
  '</Project>',
  '',
].join('\n')
