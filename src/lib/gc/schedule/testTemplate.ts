/**
 * A made-up schedule template with rows (punch list #204): a quick-lube shell of 52 rows in 8 phases
 * with 6 dates to meet, the mock-up's list (`to-dos/schedule-builder/mockup.html`, D2, in git history since the to-do retired on 2026-10-28) filled out. Names
 * and days are invented. Several rows are named like Fair Oaks D's lines (`testState.ts`) so a draw on
 * it lands rows on lines, as the job's own work on a package, and with no company yet. Tests read it;
 * nothing else does.
 */
import type { ScheduleTemplate, TemplateRow, TemplateWho } from './types'

const trade = (t: string): TemplateWho => ({ kind: 'trade', trade: t })
const US: TemplateWho = { kind: 'us' }
const OFFICE: TemplateWho = { kind: 'office' }

/** A row, waits written as names with an optional gap: `['Layout and sawcut limits', 1]`. */
function row(phase: string, label: string, who: TemplateWho, days: number, after: (string | [string, number])[] = [], more: Partial<Pick<TemplateRow, 'offset' | 'milestone' | 'place'>> = {}): TemplateRow {
  return {
    phase,
    label,
    who,
    days,
    after: after.map((w) => (typeof w === 'string' ? { row: w } : { row: w[0], gap: w[1] })),
    offset: more.offset ?? 0,
    milestone: more.milestone ?? false,
    ...(more.place ? { place: more.place } : {}),
  }
}

export const QUICK_LUBE_PHASES = [
  { key: 'precon', name: 'Preconstruction and procurement' },
  { key: 'site', name: 'Sitework and utilities' },
  { key: 'foundations', name: 'Foundations and slab' },
  { key: 'shell', name: 'Building shell' },
  { key: 'mep', name: 'MEP rough-in' },
  { key: 'interior', name: 'Interior and equipment' },
  { key: 'exterior', name: 'Exterior sitework' },
  { key: 'closeout', name: 'Commissioning and closeout' },
]

export const QUICK_LUBE_ROWS: TemplateRow[] = [
  // Preconstruction and procurement
  row('precon', 'Notice to proceed and precon meeting', OFFICE, 5),
  row('precon', 'Submittals, permits and approvals', OFFICE, 15, ['Notice to proceed and precon meeting']),
  row('precon', 'Order long-lead items', OFFICE, 15, ['Notice to proceed and precon meeting']),
  row('precon', "Builder's risk and insurance certificates", OFFICE, 3, ['Notice to proceed and precon meeting']),
  row('precon', 'Start date', OFFICE, 1, [['Notice to proceed and precon meeting', 5]], { milestone: true }),
  row('precon', 'Mobilize, temp facilities, SWPPP and fencing', trade('Sitework'), 3, ['Start date']),
  // Sitework and utilities
  row('site', 'Layout and sawcut limits', trade('Sitework'), 3, [['Mobilize, temp facilities, SWPPP and fencing', 1]]),
  row('site', 'Erosion control, silt fence and inlet protection', trade('Sitework'), 2, ['Layout and sawcut limits']),
  row('site', 'Light demolition', trade('Sitework'), 2, [['Erosion control, silt fence and inlet protection', 1]]),
  row('site', 'Rough grading and building pad', trade('Sitework'), 7, ['Light demolition']),
  row('site', 'Underground sanitary sewer, lift station and boring', US, 15, [['Erosion control, silt fence and inlet protection', 1]]),
  row('site', 'Underground', US, 3, [['Rough grading and building pad', 1]]),
  row('site', 'Underground storm drainage', trade('Sitework'), 2, ['Underground']),
  row('site', 'Site underground electrical and service conduits', trade('Electrical'), 5, ['Underground storm drainage']),
  // Foundations and slab
  row('foundations', 'Foundations', trade('Concrete'), 5, ['Site underground electrical and service conduits']),
  row('foundations', 'Pit reinforcement, embeds and inspections', trade('Concrete'), 4, ['Foundations']),
  row('foundations', 'Pour pits and grade beams', trade('Concrete'), 1, ['Pit reinforcement, embeds and inspections']),
  row('foundations', 'Underground MEP rough-in', US, 5, ['Pour pits and grade beams']),
  row('foundations', 'Slab inspection', OFFICE, 1, ['Underground MEP rough-in']),
  row('foundations', 'Slab on grade pour and finish', trade('Concrete'), 1, ['Slab inspection'], { milestone: true }),
  row('foundations', 'Cure and sawcut control joints', trade('Concrete'), 1, [['Slab on grade pour and finish', 1]]),
  row('foundations', 'Dumpster enclosure foundation and walls', trade('Masonry'), 9, [['Slab on grade pour and finish', 2]]),
  // Building shell
  row('shell', 'Erection', trade('Structural steel'), 7, ['Cure and sawcut control joints']),
  row('shell', 'Masonry veneer and CMU walls', trade('Masonry'), 6, ['Erection']),
  row('shell', 'Exterior framing and sheathing', trade('Framing and drywall'), 5, ['Erection']),
  row('shell', 'TPO membrane', trade('Roofing'), 5, ['Exterior framing and sheathing']),
  row('shell', 'Storefront glass and doors', trade('Glass and storefront'), 4, ['TPO membrane']),
  row('shell', 'Roof on', trade('Roofing'), 1, ['TPO membrane'], { milestone: true }),
  // MEP rough-in
  row('mep', 'Rough in', US, 5, ['Exterior framing and sheathing']),
  row('mep', 'Electrical rough-in', trade('Electrical'), 5, ['Exterior framing and sheathing']),
  row('mep', 'Rooftop units', trade('HVAC'), 5, ['TPO membrane']),
  row('mep', 'Rough-in inspection', OFFICE, 2, ['Rough in', 'Electrical rough-in', 'Rooftop units']),
  // Interior and equipment
  row('interior', 'Hang and tape drywall', trade('Framing and drywall'), 5, ['Rough-in inspection']),
  row('interior', 'Ceilings and grid', trade('Framing and drywall'), 3, ['Hang and tape drywall']),
  row('interior', 'Paint', trade('Painting'), 4, ['Hang and tape drywall']),
  row('interior', 'Flooring', trade('Flooring'), 3, ['Paint']),
  row('interior', 'Set lube equipment and lifts', US, 5, [['Hang and tape drywall', 1]]),
  row('interior', 'Doors, hardware and millwork', trade('Doors and hardware'), 3, ['Paint']),
  row('interior', 'Electrical trim and lighting', trade('Electrical'), 4, ['Paint']),
  row('interior', 'Test and balance', trade('HVAC'), 3, ['Paint']),
  row('interior', 'Signage and lube bay graphics', OFFICE, 2, [['Paint', 3]]),
  // Exterior sitework
  row('exterior', 'Sidewalks and curbs', trade('Concrete'), 4, ['Dumpster enclosure foundation and walls']),
  row('exterior', 'Paving', trade('Paving'), 5, [['Sidewalks and curbs', 2]]),
  row('exterior', 'Striping and signs', trade('Paving'), 1, [['Paving', 1]]),
  row('exterior', 'Site lighting', trade('Electrical'), 3, ['Paving']),
  row('exterior', 'Landscaping and irrigation', trade('Landscaping'), 4, ['Paving']),
  row('exterior', 'Paving done', trade('Paving'), 1, ['Striping and signs'], { milestone: true }),
  // Commissioning and closeout
  row('closeout', 'Final inspection', OFFICE, 2, ['Flooring', 'Set lube equipment and lifts', 'Doors, hardware and millwork', 'Electrical trim and lighting', 'Test and balance', 'Striping and signs', 'Landscaping and irrigation']),
  row('closeout', 'Test and balance report and O and M manuals', OFFICE, 2, ['Test and balance']),
  row('closeout', 'Punch list and cleaning', OFFICE, 3, ['Final inspection']),
  row('closeout', 'Punch list done', OFFICE, 1, ['Punch list and cleaning'], { milestone: true }),
  row('closeout', 'Certificate of occupancy', OFFICE, 1, ['Punch list done'], { milestone: true }),
]

/** The quick-lube shell as a saved template, version 2, counting working days. */
export function quickLubeTemplate(more: Partial<ScheduleTemplate> = {}): ScheduleTemplate {
  return {
    id: 'tpl-quicklube-3',
    name: 'Quick-lube shell, 2 bays',
    from: { projectId: '', name: '', donePct: 0 },
    on: '2026-10-27',
    by: 'Dana',
    lines: [],
    stages: [],
    weeks: 0,
    kind: 'Quick lube',
    phases: QUICK_LUBE_PHASES,
    rows: QUICK_LUBE_ROWS,
    workingDays: true,
    ...more,
  }
}
