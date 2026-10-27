/**
 * The Next line (punch list #176, change 2): under a station's question, one line that names
 * the first row to act on and its verb, *Lean on TF Harper · $29,323 · 38 days*. Each station's
 * body sorts its rows and hands the kernel the shape it has; the kernel picks the worst row
 * where the body's order is not worst first, and writes the words. Null means the station has
 * nothing to say: at zero, or a count with no row behind it (the warmth totals, the GC week).
 * Pure: rows in, one line or null out.
 */

function money(n: number): string {
  return `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
}

function days(n: number): string {
  if (n <= 0) return 'today'
  return n === 1 ? '1 day' : `${n} days`
}

function weekday(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

function monthDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Whole days from an ISO stamp to `nowMs`, never negative. */
export function ageDays(iso: string, nowMs: number): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
}

function hours(h: number): string {
  return `${Math.round(h * 10) / 10} h`
}

/** Billed Awaiting Payment: the customer whose oldest bill has waited longest, ties to the most owed. */
export function billedAwaitingNextLine(groups: ReadonlyArray<{ customerName: string; total: number; worstAgeDays: number | null }>): string | null {
  const g = [...groups].sort((a, b) => (b.worstAgeDays ?? -1) - (a.worstAgeDays ?? -1) || b.total - a.total)[0]
  if (!g) return null
  const name = g.customerName.trim() || 'the customer'
  return g.worstAgeDays != null ? `Lean on ${name} · ${money(g.total)} · ${days(g.worstAgeDays)}` : `Lean on ${name} · ${money(g.total)}`
}

/** People Hours: the oldest day still waiting, from the by-day breakdown (any order). */
export function peopleHoursNextLine(breakdown: ReadonlyArray<{ workDate: string; count: number; hours: number }>): string | null {
  const oldest = [...breakdown].sort((a, b) => a.workDate.localeCompare(b.workDate))[0]
  if (!oldest) return null
  return `Approve ${weekday(oldest.workDate)}'s ${oldest.count === 1 ? '1 session' : `${oldest.count} sessions`} · ${hours(oldest.hours)}`
}

/** Vehicle check-ins: the first row (never read first, then the most stale). */
export function vehicleCheckinNextLine(
  rows: ReadonlyArray<{ vehicle: { year: number | string | null; make: string | null; model: string | null }; holderName: string | null; motorPool: boolean; daysStale: number | null }>,
): string | null {
  const r = rows[0]
  if (!r) return null
  const truck = [r.vehicle.year, r.vehicle.make, r.vehicle.model].filter((x) => x != null && String(x).trim() !== '').join(' ') || 'the truck'
  const stale = r.daysStale == null ? 'never read' : `${days(r.daysStale)} since the last reading`
  if (r.motorPool || !r.holderName) return `Read the ${truck}'s miles · ${stale}`
  return `Ask ${r.holderName} for the ${truck}'s miles · ${stale}`
}

/** Physical inbox: the oldest undecided paper. */
export function physicalInboxNextLine(rows: ReadonlyArray<{ title: string; ageDays: number }>): string | null {
  const r = rows[0]
  if (!r) return null
  return `Decide “${r.title.trim() || 'the paper'}” · ${days(r.ageDays)} in the tray`
}

/** Supply Houses: the house with the most past 60 days. */
export function supplyHousesNextLine(rows: ReadonlyArray<{ name: string; past60_90: number; past90plus: number }>): string | null {
  const r = rows
    .map((x) => ({ name: x.name, past: x.past60_90 + x.past90plus }))
    .filter((x) => x.past > 0)
    .sort((a, b) => b.past - a.past)[0]
  if (!r) return null
  return `Pay or dispute ${r.name} · ${money(r.past)} past 60 days`
}

export type MissingJobInfoLists = {
  noCustomer: ReadonlyArray<{ number: string; name: string }>
  noEmail: ReadonlyArray<{ number: string; name: string }>
  noPictures: ReadonlyArray<{ number: string; name: string }>
}

/** Missing job info: a customer first, then a billing email, then a pictures link. */
export function missingJobInfoNextLine(lists: MissingJobInfoLists): string | null {
  const label = (j: { number: string; name: string }) => [j.number, j.name].filter((s) => s.trim()).join(' ')
  if (lists.noCustomer[0]) return `Link a customer to ${label(lists.noCustomer[0])}`
  if (lists.noEmail[0]) return `Add a billing email to ${label(lists.noEmail[0])}`
  if (lists.noPictures[0]) return `Add a pictures link to ${label(lists.noPictures[0])}`
  return null
}

/** Property kinds: the first row (the lien clock first, then the most open). */
export function propertyKindsNextLine(rows: ReadonlyArray<{ address: string; customerName: string; openBalance: number; lienClock: boolean }>): string | null {
  const r = rows[0]
  if (!r) return null
  const tail = r.lienClock ? ' · lien clock running' : r.openBalance > 0 ? ` · ${money(r.openBalance)} open` : ''
  return `Pick residential or commercial for ${r.address.trim() || 'the property'} · ${r.customerName.trim() || 'no customer'}${tail}`
}

/** Percent complete: the first card and the number the facts suggest. */
export function percentCompleteNextLine(cards: ReadonlyArray<{ label: string; suggestedPct: number }>): string | null {
  const c = cards[0]
  if (!c) return null
  return `Move ${c.label} to ${Math.round(c.suggestedPct)}%`
}

/** Missing bill dates: the first bill. */
export function undatedBillsNextLine(bills: ReadonlyArray<{ customerName: string | null; amount: number; hcpNumber: string | null }>): string | null {
  const b = bills[0]
  if (!b) return null
  const who = (b.customerName ?? '').trim() || 'the customer'
  const on = (b.hcpNumber ?? '').trim()
  return `Date ${who}'s ${money(b.amount)} bill${on ? ` on ${on}` : ''}`
}

/** Complete, no Total Bill: the lowest job number first. */
export function completeNoBillNextLine(jobs: ReadonlyArray<{ hcp_number: string | null; job_name: string | null }>): string | null {
  const j = [...jobs].sort((a, b) => (a.hcp_number ?? '').localeCompare(b.hcp_number ?? '', undefined, { numeric: true }))[0]
  if (!j) return null
  return `Set the Total Bill on ${[j.hcp_number, j.job_name].filter((s) => (s ?? '').trim()).join(' ') || 'the job'}`
}

/** Unassigned field time: the oldest day with hours on no job. */
export function unassignedFieldTimeNextLine(rows: ReadonlyArray<{ personName: string; workDate: string; unallocatedHrs: number }>): string | null {
  const r = [...rows].sort((a, b) => a.workDate.localeCompare(b.workDate) || b.unallocatedHrs - a.unallocatedHrs)[0]
  if (!r) return null
  return `Put ${r.personName}'s ${hours(r.unallocatedHrs)} on ${weekday(r.workDate)} on a job`
}

/** Jobs Cleanup: the first sheet, else the money cards. */
export function jobsCleanupNextLine(sheets: ReadonlyArray<{ contractor: string; total: number; typedNumber: string | null; address: string }>, moneyCards: number): string | null {
  const s = sheets[0]
  if (s) {
    const where = (s.typedNumber ?? '').trim() || s.address.trim()
    return `Link ${s.contractor.trim() || 'the sub'}'s ${money(s.total)} sheet${where ? ` · ${where}` : ''} to a job`
  }
  if (moneyCards > 0) return moneyCards === 1 ? 'Work the 1 money card below' : `Work the ${moneyCards} money cards below`
  return null
}

/** Field photos → Drive: the oldest estimate still holding photos. */
export function fieldPhotosNextLine(groups: ReadonlyArray<{ label: string; photos: ReadonlyArray<unknown> }>): string | null {
  const g = groups[0]
  if (!g) return null
  return `Move ${g.photos.length === 1 ? '1 photo' : `${g.photos.length} photos`} for ${g.label} to Drive`
}

/** Texts: the reply waited on longest, else the text that never arrived. */
export function textsNextLine(ledger: { needsReply: ReadonlyArray<{ name: string; waiting: string }>; notDelivered: ReadonlyArray<{ name: string }> }): string | null {
  const r = ledger.needsReply[0]
  if (r) return `Reply to ${r.name} · ${r.waiting}`
  const n = ledger.notDelivered[0]
  if (n) return `Call ${n.name} · the text never arrived`
  return null
}

/** Email: the box with the most threads past the limit, else the most open. */
export function emailNextLine(boxes: ReadonlyArray<{ title: string; open: number; past: number }>, limitDays: number): string | null {
  const b = [...boxes].filter((x) => x.open > 0).sort((a, c) => c.past - a.past || c.open - a.open)[0]
  if (!b) return null
  const past = b.past > 0 ? ` · ${b.past} past ${days(limitDays)}` : ''
  return `Clear ${b.title} · ${b.open} open${past}`
}

/** Banking sorting: the oldest unsorted row. */
export function bankingSortingNextLine(rows: ReadonlyArray<{ counterparty_name: string | null; amount: number; posted_at: string | null }>): string | null {
  const r = [...rows].sort((a, b) => (a.posted_at ?? '').localeCompare(b.posted_at ?? ''))[0]
  if (!r) return null
  const from = r.posted_at ? ` from ${monthDay(r.posted_at)}` : ''
  return `Sort the ${money(r.amount)} ${(r.counterparty_name ?? '').trim() || 'bank'} row${from}`
}

/** Dispatch inbox: the first open request (a customer waiting first, then the oldest). */
export function dispatchInboxNextLine(rows: ReadonlyArray<{ status: string; title: string; created_at: string | null; senderName: string | null; priority: string | null | undefined }>, nowMs: number): string | null {
  const r = rows.find((x) => x.status === 'open')
  if (!r) return null
  const who = (r.senderName ?? '').trim() || 'someone'
  const title = r.title.trim().length > 60 ? `${r.title.trim().slice(0, 59)}…` : r.title.trim()
  const head = r.priority === 'high' ? 'Customer waiting: answer' : 'Answer'
  return `${head} ${who}'s “${title}” · waiting ${days(r.created_at ? ageDays(r.created_at, nowMs) : 0)}`
}

/** The office boxes: the first box not ticked. */
export function boxesNextLine(items: ReadonlyArray<{ id: string; label: string }>, isOpen: (id: string) => boolean): string | null {
  const b = items.find((i) => isOpen(i.id))
  return b ? `Tick: ${b.label}` : null
}

/** Job follow-ups: the stalest quiet job. */
export function jobFollowupsNextLine(entry: { hcpNumber: string | null; jobName: string | null; quietDays: number } | null | undefined): string | null {
  if (!entry) return null
  const job = [entry.hcpNumber, entry.jobName].filter((s) => (s ?? '').trim()).join(' ') || 'the job'
  return `Call about ${job} · quiet ${days(entry.quietDays)}`
}

/**
 * Today's lines (v2.5868): the first of the viewer's own lines, worst first, in the card's own words. Since v2.5907
 * (punch list #178) the deck is the station's body on Quickfill, so when it opens on a row the line is that row's
 * sentence, the first press of the morning; with no row the first line as before.
 */
export function todaysLinesNextLine(yours: ReadonlyArray<{ title: string }>, firstRow: { title: string } | null = null): string | null {
  const row = firstRow?.title.trim()
  if (row) return row
  const first = yours[0]
  return first ? first.title.trim() || null : null
}
