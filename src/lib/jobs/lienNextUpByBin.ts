/**
 * The Lien desk's To do list in the Board's order (punch list #362, step 4; the mock-up's A, the owner's pick of
 * 2026-11-16: *D, the list by bin first*). Under the Board the list was grouped by the day and by who moves next
 * (`groupLienNextUp`). Here the same rows are grouped by the bin each paper stands in, under the bin's own name and
 * in the Board's own order, so the list reads as the Board written out: the notices' column from *Needs the owner*
 * down, then the affidavits' column.
 *
 * - **What needs you now comes first**, a group a bin. A paper whose day is further out than `LIEN_NEXT_UP_NOW_DAYS`
 *   waits under one line, **Later**, which the view folds while something needs someone now. The Board above still
 *   shows every paper, and a pressed bin or a find opens the fold.
 * - **Papers that share one act fold into one row** with a total and one press, where the desk has a press that takes
 *   them all today (`LienBinFoldRule`, handed over by the desk): the affidavits ready to file, the affidavits to send
 *   for approval. A GC's approved notices and the printed notices already fold (`run:` rows). Twelve rows with the
 *   same *File the affidavit* press read as one, with the twelve jobs behind a fold.
 * - **The leader's own rows stay on top** (*Only you can sign*, *Only you can approve*), and the reminders keep their
 *   group, as before: they are not a stage a paper stands in.
 *
 * Pure: rows in, groups out. It writes nothing and reads nothing but the rows and the bin the desk names for each.
 * A phone keeps its list by the day (`lienPhoneGroups`).
 */
import { groupLienNextUp, type LienNextUpAction, type LienNextUpGroup, type LienNextUpGrouped, type LienNextUpGroupOpts, type LienNextUpRow, type LienNextUpTarget } from './lienNextUp'
import type { LienDeskSeverity } from './lienDesk'
import { countedLabel } from '../batchWords'

/** The bin a row's paper stands in, as the Board names it; `order` is the bin's place on the Board, notices first. */
export type LienRowBin = { key: string; label: string; kind: 'notice' | 'affidavit'; order: number }

/** One fold the desk can open with a press that exists today: every row of `action` in `bin` becomes one row. */
export type LienBinFoldRule = {
  bin: string
  action: LienNextUpAction
  /** *12 affidavits approved and ready to file* */
  title: (n: number) => string
  /** The one thing to know, under the title. */
  sub: string
  /** The press's words, as the screen it opens says them; null draws the row with no press of its own. */
  button: string | null
  target: LienNextUpTarget
}

export type LienByBinOpts = Pick<LienNextUpGroupOpts, 'waitingOn' | 'risk' | 'amount'> & {
  /** The Board's bin for a row; null for a row with none (a reminder, retainage, a served copy). */
  binFor: (row: LienNextUpRow) => LienRowBin | null
  folds?: ReadonlyArray<LienBinFoldRule>
}

export type LienBinGroup = LienNextUpGrouped & {
  /** Unique among the groups: the bin's key, or the group's own name. */
  key: string
  /** The bin, or null for a group that is not one. */
  bin: string | null
  /** *3 notices*, *12 affidavits*, *2 papers*: what the head says after the name. A folded row counts its jobs. A bin whose papers all wait on the leader says so, by name: *1 notice · waiting on Malachi*. */
  countWords: string
  /** How many papers the group holds. */
  papers: number
  /** What the group's jobs still owe; null when the desk gave no amounts or nothing is owed. */
  total: number | null
  /** The head carries the press that reminds the leader: the first bin holding rows that wait on him, or *Other lien papers* when no bin does (v2.7478). */
  remind?: true
  /** Everything due later, under one line: which bins hold how many. The group is drawn folded. */
  later?: { line: string }
}

export type LienByBin = {
  groups: LienBinGroup[]
  /** The head over the bins that need someone now; null when no row does. */
  now: { label: string; papers: number; total: number | null } | null
}

/** A row that stands for several papers folded by a rule here (never a GC's run row, which is `run:`). */
export function isLienFoldRow(row: Pick<LienNextUpRow, 'key'>): boolean {
  return row.key.startsWith('fold:')
}

/**
 * The folds the desk has a press for today. The affidavits ready to file fold when the batch print would take two or
 * more, under the print's own words (*Print 10 for notarization ›*, the door of v2.7398). The affidavits to send fold
 * when the batch send would take two or more, under its words. Each press opens the Affidavits list at that pile,
 * where the batch press of the same name stands with its options. A viewer who is not the lien office gets none.
 */
export function lienBinFolds(f: { office: boolean; printReady: number; printButton: string; sendReady: number; /** Filed liens that owe their copies, and the press that mails them together (punch list #366). */ serveOwed?: number; serveButton?: string }): LienBinFoldRule[] {
  if (!f.office) return []
  const rules: LienBinFoldRule[] = []
  if (f.printReady >= 2) rules.push({ bin: 'affidavit:ready', action: 'file_affidavit', title: (n) => `${n} affidavits approved and ready to file`, sub: 'One stack for the notary, then the county clerk.', button: f.printButton, target: { open: 'affidavit_pile', pile: 'ready' } })
  if (f.sendReady >= 2) rules.push({ bin: 'affidavit:to_send', action: 'draft', title: (n) => `${n} affidavits to send for approval`, sub: 'Not yet sent for approval.', button: `${countedLabel('Send', f.sendReady)} for approval ›`, target: { open: 'affidavit_pile', pile: 'to_draft' } })
  if ((f.serveOwed ?? 0) >= 2) rules.push({ bin: 'affidavit:filed', action: 'record_service', title: (n) => `${n} filed liens owe their copies`, sub: 'One stack for the mail, then each mail number.', button: f.serveButton ?? null, target: { open: 'serve_copies' } })
  return rules
}

const papersOf = (r: LienNextUpRow): number => (r.jobs?.length ? r.jobs.length : 1)

function totalOf(rows: ReadonlyArray<LienNextUpRow>, amount: LienByBinOpts['amount']): number | null {
  if (!amount) return null
  let sum = 0
  for (const r of rows) {
    if (r.jobs?.length) for (const j of r.jobs) sum += amount({ ...r, jobId: j.jobId, key: `${r.kind}:${j.jobId}`, jobs: undefined }) ?? 0
    else sum += amount(r) ?? 0
  }
  return sum > 0 ? sum : null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function countWords(kind: LienRowBin['kind'] | null, n: number): string {
  return kind === 'notice' ? plural(n, 'notice', 'notices') : kind === 'affidavit' ? plural(n, 'affidavit', 'affidavits') : plural(n, 'paper', 'papers')
}

const SEVERITY_RANK: Record<LienDeskSeverity, number> = { red: 0, amber: 1, quiet: 2 }

/** Fold every row a rule takes into one, where two or more share it; the folded row stands where the first of them stood. */
function foldRows(rows: ReadonlyArray<LienNextUpRow>, bin: LienRowBin, rules: ReadonlyArray<LienBinFoldRule>): LienNextUpRow[] {
  let out = [...rows]
  for (const rule of rules) {
    if (rule.bin !== bin.key) continue
    const members = out.filter((r) => r.action === rule.action && r.jobId && !r.jobs)
    if (members.length < 2) continue
    const dated = members.filter((m) => m.dueOn).sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : a.dueOn! > b.dueOn! ? 1 : 0))
    const first = dated[0] ?? members[0]!
    const folded: LienNextUpRow = {
      key: `fold:${bin.key}:${rule.action}`,
      kind: first.kind,
      jobId: null,
      gcId: null,
      title: rule.title(members.length),
      sub: rule.sub,
      detail: rule.sub,
      dueOn: first.dueOn,
      daysLeft: first.daysLeft,
      severity: members.map((m) => m.severity).sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b])[0]!,
      group: first.group,
      action: rule.action,
      // A viewer with no move on the papers has none on the fold either.
      button: members.some((m) => m.button) ? rule.button : null,
      target: rule.target,
      jobs: members.map((m) => ({ jobId: m.jobId!, title: m.title, dueOn: m.dueOn })),
    }
    const at = out.indexOf(members[0]!)
    const taken = new Set(members)
    out = [...out.slice(0, at).filter((r) => !taken.has(r)), folded, ...out.slice(at).filter((r) => !taken.has(r))]
  }
  return out
}

const LEADER_GROUPS: ReadonlyArray<LienNextUpGroup> = ['sign', 'pen', 'mine']

export function groupLienNextUpByBin(rows: ReadonlyArray<LienNextUpRow>, opts: LienByBinOpts): LienByBin {
  // The day's own grouping decides who a row belongs to and in what order: the leader's rows, the rows at risk first,
  // the approvals the office waits on, the rest by day, the reminders, and what is coming.
  const byDay = groupLienNextUp(rows, { waitingOn: opts.waitingOn, risk: opts.risk, amount: opts.amount })
  const rowsOf = (group: LienNextUpGroup) => byDay.find((g) => g.group === group)?.rows ?? []
  const waiting = new Set(rowsOf('waiting'))
  const now = [...rowsOf('risk'), ...rowsOf('waiting'), ...rowsOf('now')]
  const later = rowsOf('coming')
  const amount = opts.amount

  const plain = (g: LienNextUpGrouped): LienBinGroup => ({ ...g, key: g.group, bin: null, papers: g.rows.reduce((n, r) => n + papersOf(r), 0), countWords: String(g.rows.length), total: null })
  const groups: LienBinGroup[] = byDay.filter((g) => LEADER_GROUPS.includes(g.group)).map(plain)

  // One group a bin, in the Board's order; a row with no bin goes last, under its own head.
  const bins = new Map<string, { bin: LienRowBin; rows: LienNextUpRow[] }>()
  const loose: LienNextUpRow[] = []
  for (const r of now) {
    const bin = opts.binFor(r)
    if (!bin) {
      loose.push(r)
      continue
    }
    const held = bins.get(bin.key)
    if (held) held.rows.push(r)
    else bins.set(bin.key, { bin, rows: [r] })
  }
  let remindGiven = false
  for (const { bin, rows: binRows } of [...bins.values()].sort((a, b) => a.bin.order - b.bin.order)) {
    const folded = foldRows(binRows, bin, opts.folds ?? [])
    const papers = folded.reduce((n, r) => n + papersOf(r), 0)
    const waits = binRows.some((r) => waiting.has(r))
    const allWait = waits && binRows.every((r) => waiting.has(r))
    const group: LienBinGroup = { group: allWait ? 'waiting' : 'now', label: bin.label, rows: folded, part: true, key: bin.key, bin: bin.key, papers, countWords: `${countWords(bin.kind, papers)}${allWait ? ` · waiting on ${opts.waitingOn?.trim() || 'the leader'}` : ''}`, total: totalOf(folded, amount) }
    if (waits && !remindGiven) {
      group.remind = true
      remindGiven = true
    }
    groups.push(group)
  }
  if (loose.length) {
    const other: LienBinGroup = { group: 'now', label: 'Other lien papers', rows: loose, part: true, key: 'other', bin: null, papers: loose.length, countWords: countWords(null, loose.length), total: totalOf(loose, amount) }
    // A retainage notice that waits on the leader has a message since v2.7478, and no bin: with no bin's head to carry the press, this head does.
    if (!remindGiven && loose.some((r) => waiting.has(r))) {
      other.remind = true
      remindGiven = true
    }
    groups.push(other)
  }

  const reminders = byDay.find((g) => g.group === 'reminders')
  if (reminders) groups.push(plain(reminders))

  if (later.length) {
    // In the Board's order too, so the folded line and the rows under it read the same way.
    const withBin = later.map((r, i) => ({ r, i, bin: opts.binFor(r) }))
    withBin.sort((a, b) => (a.bin?.order ?? Number.MAX_SAFE_INTEGER) - (b.bin?.order ?? Number.MAX_SAFE_INTEGER) || a.i - b.i)
    const counts = new Map<string, { label: string; n: number }>()
    for (const { r, bin } of withBin) {
      const key = bin?.key ?? 'other'
      const c = counts.get(key)
      if (c) c.n += papersOf(r)
      else counts.set(key, { label: bin ? `${bin.label}, ${bin.kind === 'notice' ? 'notices' : 'affidavits'}` : 'Other lien papers', n: papersOf(r) })
    }
    const sorted = withBin.map((x) => x.r)
    const papers = sorted.reduce((n, r) => n + papersOf(r), 0)
    groups.push({ group: 'coming', label: 'Later', rows: sorted, key: 'later', bin: null, papers, countWords: countWords(null, papers), total: totalOf(sorted, amount), later: { line: [...counts.values()].map((c) => `${c.label} ${c.n}`).join(' · ') } })
  }

  const nowGroups = groups.filter((g) => g.part)
  const nowPapers = nowGroups.reduce((n, g) => n + g.papers, 0)
  return { groups, now: nowGroups.length ? { label: 'Needs you now', papers: nowPapers, total: totalOf(nowGroups.flatMap((g) => g.rows), amount) } : null }
}
