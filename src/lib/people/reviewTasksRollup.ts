// Collapses a person's outstanding checklist instances so a recurring item
// that has piled up ("Review PipeTooling Jobs" × 34) reads as one line —
// what it is, how often, how many were missed since when, how many are
// still ahead — while one-off tasks stay as they are. Pure.

export type ReviewOutstandingTaskInput = {
  id: string
  title: string
  links?: string[] | null
  scheduled_date: string
  /** Parent checklist item; instances of one item are the recurrence. */
  checklist_item_id?: string | null
}

export type ReviewTaskLine =
  | { kind: 'single'; task: ReviewOutstandingTaskInput }
  | {
      kind: 'recurring'
      groupKey: string
      title: string
      links?: string[] | null
      /** e.g. "weekly", "every two weeks", "every 10 days". */
      cadence: string
      count: number
      /** Scheduled before today and still open. */
      missed: number
      /** Scheduled today or later. */
      upcoming: number
      firstMissed: string | null
      lastMissed: string | null
      nextDue: string | null
    }

export type ReviewTasksRollup = { lines: ReviewTaskLine[]; total: number }

function dayDiff(a: string, b: string): number {
  const toUtc = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

export function cadenceLabel(gapDays: number): string {
  if (gapDays <= 1) return 'daily'
  if (gapDays === 7) return 'weekly'
  if (gapDays === 14) return 'every two weeks'
  if (gapDays >= 28 && gapDays <= 31) return 'monthly'
  return `every ${gapDays} days`
}

function medianGap(dates: string[]): number | null {
  if (dates.length < 2) return null
  const gaps: number[] = []
  for (let i = 1; i < dates.length; i += 1) gaps.push(dayDiff(dates[i - 1]!, dates[i]!))
  gaps.sort((a, b) => a - b)
  return gaps[Math.floor(gaps.length / 2)] ?? null
}

/** Sort key: the earliest date a line is about (missed first, then upcoming). */
function lineDate(line: ReviewTaskLine): string {
  if (line.kind === 'single') return (line.task.scheduled_date ?? '').trim() || '9999-12-31'
  return line.firstMissed ?? line.nextDue ?? '9999-12-31'
}

export function buildReviewTasksRollup(
  tasks: readonly ReviewOutstandingTaskInput[],
  todayYmd: string,
  minInstances = 3,
): ReviewTasksRollup {
  const groups = new Map<string, ReviewOutstandingTaskInput[]>()
  for (const t of tasks) {
    const key = (t.checklist_item_id ?? '').trim() || `title:${t.title.trim().toLowerCase()}`
    const list = groups.get(key) ?? []
    list.push(t)
    groups.set(key, list)
  }
  const lines: ReviewTaskLine[] = []
  for (const [groupKey, list] of groups) {
    const dated = list.filter((t) => (t.scheduled_date ?? '').trim()).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    if (dated.length < minInstances || dated.length !== list.length) {
      for (const t of list) lines.push({ kind: 'single', task: t })
      continue
    }
    const missed = dated.filter((t) => t.scheduled_date < todayYmd)
    const upcoming = dated.filter((t) => t.scheduled_date >= todayYmd)
    const gap = medianGap(dated.map((t) => t.scheduled_date))
    const head = dated[0]!
    lines.push({
      kind: 'recurring',
      groupKey,
      title: head.title,
      links: head.links,
      cadence: gap == null ? 'recurring' : cadenceLabel(gap),
      count: dated.length,
      missed: missed.length,
      upcoming: upcoming.length,
      firstMissed: missed[0]?.scheduled_date ?? null,
      lastMissed: missed[missed.length - 1]?.scheduled_date ?? null,
      nextDue: upcoming[0]?.scheduled_date ?? null,
    })
  }
  lines.sort((a, b) => lineDate(a).localeCompare(lineDate(b)))
  return { lines, total: tasks.length }
}
