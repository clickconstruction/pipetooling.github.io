/**
 * Your people's week, the Monday email (punch list #273, PR 5, v2.6603): the payload's shape as get_people_week_payload
 * answers it, the subject, the headline, and the HTML and text renders. One source for the dispatcher
 * (`people-week-email`) and the app (`src/lib/peopleWeek.ts` re-exports it for Settings → What the team sees).
 * No imports, so the app's tests import it as the functions do.
 */

export type PeopleWeekCard = {
  title: string
  from_percent: number
  to_percent: number
  done: boolean
  lines_ticked: number
  lines_total: number
  photos: number
  last_words: string | null
}

export type PeopleWeekRoadmap = { task_title: string; stage_title: string; roadmap_title: string; percent: number; done: boolean }

export type PeopleWeekJob = { hcp_number: string; customer_name: string; pct_complete: number | null; sessions: number; reports: number }

export type PeopleWeekStuck = { title: string; age_days: number }

export type PeopleWeekPerson = {
  user_id: string
  name: string
  open: number
  done: number
  moved: number
  photos: number
  cards: PeopleWeekCard[]
  roadmap: PeopleWeekRoadmap[]
  jobs: PeopleWeekJob[]
  stuck: PeopleWeekStuck[]
}

export type PeopleWeekPayload = {
  /** YYYY-MM-DD, the Monday. */
  week_start: string
  /** YYYY-MM-DD, the Sunday. */
  week_end: string
  people: PeopleWeekPerson[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ymdParts(ymd: string): { m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return { m: Number(m[2]), d: Number(m[3]) }
}

/** *Nov 2 to 8*, *Nov 30 to Dec 6*. */
export function weekWords(weekStart: string, weekEnd: string): string {
  const a = ymdParts(weekStart)
  const b = ymdParts(weekEnd)
  if (!a || !b) return `${weekStart} to ${weekEnd}`
  const ma = MONTHS[a.m - 1] ?? ''
  const mb = MONTHS[b.m - 1] ?? ''
  return a.m === b.m ? `${ma} ${a.d} to ${b.d}` : `${ma} ${a.d} to ${mb} ${b.d}`
}

export function peopleWeekSubject(p: PeopleWeekPayload): string {
  return `Your people’s week · ${weekWords(p.week_start, p.week_end)}`
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** *3 people · 3 cards done · 2 moved · 1 stuck*, the line under the title. */
export function peopleWeekHeadline(p: PeopleWeekPayload): string {
  const done = p.people.reduce((s, x) => s + x.done, 0)
  const moved = p.people.reduce((s, x) => s + x.moved, 0)
  const stuck = p.people.filter((x) => x.stuck.length > 0).length
  const parts = [plural(p.people.length, 'person', 'people'), `${plural(done, 'card', 'cards')} done`, `${moved} moved`]
  if (stuck > 0) parts.push(`${stuck} stuck`)
  return parts.join(' · ')
}

/** *2 cards done · 1 moved · 4 photos*, or *nothing moved*. */
export function personLine(x: PeopleWeekPerson): string {
  if (x.done === 0 && x.moved === 0 && x.jobs.length === 0) return 'nothing moved'
  const parts: string[] = []
  if (x.done > 0) parts.push(`${plural(x.done, 'card', 'cards')} done`)
  if (x.moved > 0) parts.push(`${x.moved} moved`)
  if (x.photos > 0) parts.push(plural(x.photos, 'photo', 'photos'))
  return parts.join(' · ')
}

export function cardLine(c: PeopleWeekCard): string {
  const parts = [c.title, `${c.from_percent} → ${c.to_percent}`]
  if (c.done) parts.push(c.lines_total > 0 ? `done · ${c.lines_ticked} of ${c.lines_total}` : 'done')
  else if (c.lines_total > 0) parts.push(`${c.lines_ticked} of ${c.lines_total} lines`)
  if (c.last_words) parts.push(`“${c.last_words}”`)
  if (c.photos > 0) parts.push(plural(c.photos, 'photo', 'photos'))
  return parts.join(' · ')
}

export function jobLine(j: PeopleWeekJob): string {
  const label = [j.hcp_number, j.customer_name].filter(Boolean).join(' · ') || 'a job'
  const parts = [label]
  if (typeof j.pct_complete === 'number') parts.push(`${Math.round(j.pct_complete)}% done`)
  parts.push(plural(j.sessions, 'day', 'days'))
  if (j.reports > 0) parts.push(plural(j.reports, 'report', 'reports'))
  return parts.join(' · ')
}

export function roadmapLine(r: PeopleWeekRoadmap): string {
  return `${r.task_title} · ${r.roadmap_title} › ${r.stage_title} · ${r.done ? 'done' : `${r.percent}%`}`
}

export function stuckLine(s: PeopleWeekStuck): string {
  return `${s.title} · ${s.age_days} days, no move`
}

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderPeopleWeekText(p: PeopleWeekPayload, reviewUrl: string): string {
  const out: string[] = [peopleWeekSubject(p), peopleWeekHeadline(p), '']
  for (const x of p.people) {
    out.push(`${x.name} · ${personLine(x)}`)
    if (x.cards.length) {
      out.push('  Cards')
      for (const c of x.cards) out.push(`    ${cardLine(c)}`)
    }
    if (x.roadmap.length) {
      out.push('  Roadmap')
      for (const r of x.roadmap) out.push(`    ${roadmapLine(r)}`)
    }
    if (x.jobs.length) {
      out.push('  Jobs')
      for (const j of x.jobs) out.push(`    ${jobLine(j)}`)
    }
    if (x.stuck.length) {
      out.push('  Stuck')
      for (const s of x.stuck) out.push(`    ${stuckLine(s)}`)
    }
    out.push('')
  }
  out.push(`Open Review: ${reviewUrl}`)
  out.push('You get this every week on the day you picked. Change who is in it or stop it on Settings → Your account → My email schedule.')
  return out.join('\n')
}

export function renderPeopleWeekHtml(p: PeopleWeekPayload, reviewUrl: string): string {
  const group = (label: string, lines: string[]) =>
    lines.length === 0
      ? ''
      : `<tr><td style="padding:4px 10px 4px 0;vertical-align:top;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;white-space:nowrap">${esc(label)}</td><td style="padding:4px 0;font-size:14px;line-height:1.45;color:#111827">${lines.map((l) => esc(l)).join('<br>')}</td></tr>`
  const people = p.people
    .map(
      (x) => `
      <div style="border-top:1px solid #e5e7eb;padding:12px 0">
        <div style="font-size:16px;font-weight:700;color:#111827">${esc(x.name)} <span style="font-size:13px;font-weight:600;color:#6b7280">· ${esc(personLine(x))}</span></div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:6px;border-collapse:collapse">
          ${group('Cards', x.cards.map(cardLine))}
          ${group('Roadmap', x.roadmap.map(roadmapLine))}
          ${group('Jobs', x.jobs.map(jobLine))}
          ${group('Stuck', x.stuck.map(stuckLine))}
        </table>
      </div>`,
    )
    .join('')
  return `<!doctype html>
<html><body style="margin:0;padding:24px 16px;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d1d5db;border-radius:12px;padding:18px 20px">
    <div style="font-size:18px;font-weight:800">${esc(peopleWeekSubject(p))}</div>
    <div style="font-size:14px;font-weight:700;color:#374151;margin:4px 0 12px">${esc(peopleWeekHeadline(p))}</div>
    ${people || '<div style="font-size:14px;color:#6b7280">Nobody you follow has an open card this week.</div>'}
    <div style="border-top:1px solid #e5e7eb;margin-top:8px;padding-top:10px;font-size:13px;color:#6b7280">
      <a href="${esc(reviewUrl)}" style="color:#2563eb;text-decoration:none">Open Review</a> · You get this every week on the day you picked. Change who is in it or stop it on Settings → Your account → My email schedule.
    </div>
  </div>
</body></html>`
}
