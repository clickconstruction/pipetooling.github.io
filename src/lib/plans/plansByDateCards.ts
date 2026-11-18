/**
 * The cards of the Plans look's By date view (punch list #367, PR 2): every item on the view, a mark, a bar,
 * a lane's name, a figure, a line of the dated list or today, answers a pointer with a card of its details
 * and the presses that act on it. This file is the words and the presses; the card's box, its place and the
 * acts themselves are the screen's (`DevelopmentPlansByDate.tsx`) and the page's.
 *
 * A card is keyed like the thing it is about: `set-<id>`, `bid-<id>`, `trip-<id>`, `crew-<day>`, `job-<id>`,
 * `hist-<id>`, `lane-<key>`, `figure-<key>`, `today`. A row of a card can lead to another card (the sets
 * behind a figure, the bids of the Bids lane), so a person walks from a number to the thing itself without
 * leaving the chart. What a reader may not do is not offered: no press is drawn dead here.
 * Pure: `buildPlansByDateCards` reads the same rows `buildPlansByDate` read.
 */
import { HISTORY_SOURCE, historyVerb } from '../developments/history'
import { scheduleLengthWords, scheduleStanding } from '../bids/bidSchedule'
import { isDrawingSet, kindLabel, sheetCountWords, sourceWords } from './planSets'
import { agoWords, clip, crewRuns, dayOfYmd, dayWords, isOurs, isWon, jobsWords, plural, ymdOfDay, type PbdGlyph, type PlansByDateInput, type PlansByDateModel } from './plansByDate'

export type PbdCardAction =
  | { kind: 'open-link'; label: string; href: string }
  | { kind: 'build-from'; label: string; partId: string; setId: string; message: string; confirmLabel: string }
  | { kind: 'show-part'; label: string; partId: string }
  | { kind: 'new-set'; label: string; partId: string }
  | { kind: 'ask'; label: string; title: string }
  | { kind: 'open-bid'; label: string; bidId: string }
  | { kind: 'open-job'; label: string; jobId: string }
  | { kind: 'read-line'; label: string; entryId: string }
  | { kind: 'keep'; label: string }
  | { kind: 'set-schedule'; label: string; bidId: string }
  | { kind: 'set-sheets'; label: string; setId: string; setName: string; count: number | null }
  | { kind: 'open-trips'; label: string }

/** A line of a card; `to` is the card it leads to, null when it is only words. */
export type PbdCardRow = { key: string; glyph: PbdGlyph; day: string; text: string; soft: string; to: string | null }

export type PbdCard = {
  key: string
  glyph: PbdGlyph | null
  title: string
  kicker: string
  facts: Array<{ label: string; value: string }>
  /** A kept line's own words. */
  words: string | null
  rowsTitle: string | null
  rows: PbdCardRow[]
  /** How many more rows there are than the card lists. */
  rowsMore: number
  actions: PbdCardAction[]
  /** A quiet line: why a press is not here, or what the card cannot say. */
  quiet: string | null
}

/** What this reader may do from a card. */
export type PbdCaps = { canWritePlans: boolean; canOpenJobs: boolean; canKeep: boolean; canAsk: boolean; /** May set a bid's schedule: whoever can edit a bid. Absent reads as no. */ canEditBids?: boolean }

/** A card lists this many rows and counts the rest. */
export const PBD_CARD_ROWS = 8

export const PBD_PRESS = {
  open: 'Open ↗',
  buildFrom: 'Build from this set',
  showPart: 'See it in By part',
  newSet: '+ New set',
  ask: 'Ask the estimators',
  openBid: 'Open the bid',
  openJob: 'Open the job',
  readLine: 'Read the whole line',
  keep: 'Write a line',
  setSchedule: 'Set the schedule',
  changeSchedule: 'Change the schedule',
  setSheets: 'Set the sheet count',
  changeSheets: 'Change the sheet count',
  openTrips: 'Open the Trips look',
} as const

/** Why a job's number opens nothing for a reader with no job read. */
export const PBD_JOB_DOOR_WORDS = 'A job opens for the office and Dispatch.'

const card = (c: Partial<PbdCard> & Pick<PbdCard, 'key' | 'title'>): PbdCard => ({ glyph: null, kicker: '', facts: [], words: null, rowsTitle: null, rows: [], rowsMore: 0, actions: [], quiet: null, ...c })

function capRows(rows: PbdCardRow[]): { rows: PbdCardRow[]; rowsMore: number } {
  return rows.length > PBD_CARD_ROWS ? { rows: rows.slice(0, PBD_CARD_ROWS), rowsMore: rows.length - PBD_CARD_ROWS } : { rows, rowsMore: 0 }
}

/** A card from an item's one line, for a view handed no cards: the line's first words lead, the rest follow. */
export function plansByDateTipCard(key: string, tip: string): PbdCard {
  const [title, ...rest] = tip.split(' · ')
  return card({ key, title: title ?? tip, kicker: rest.join(' · ') })
}

/** The card for a burst bar: its sets as rows, each leading to its own card. */
export function plansByDateClusterCard(key: string, memberKeys: ReadonlyArray<string>, cards: ReadonlyMap<string, PbdCard>, model: Pick<PlansByDateModel, 'rows'>): PbdCard {
  const byKey = new Map(model.rows.map((r) => [r.key, r]))
  const rows = memberKeys.flatMap((k): PbdCardRow[] => {
    const r = byKey.get(k)
    return r ? [{ key: k, glyph: r.glyph, day: r.ymd, text: r.text, soft: r.soft, to: cards.has(k) ? k : null }] : []
  })
  const first = rows[0]
  const last = rows[rows.length - 1]
  const lane = first ? (byKey.get(first.key)?.lane ?? '') : ''
  const range = first && last ? `${dayWords(first.day, first.day.slice(0, 4) !== last.day.slice(0, 4))} to ${dayWords(last.day)}` : ''
  // Newest first, since the newest is the one a person looks for.
  return card({ key, glyph: 'cluster', title: plural(rows.length, 'set', 'sets'), kicker: [lane, range].filter(Boolean).join(' · '), rowsTitle: 'Too close together to draw apart', ...capRows([...rows].reverse()) })
}

export function buildPlansByDateCards(input: PlansByDateInput, model: PlansByDateModel, caps: PbdCaps): Map<string, PbdCard> {
  const out = new Map<string, PbdCard>()
  const add = (c: PbdCard) => out.set(c.key, c)
  const today = model.today
  const names = input.names ?? {}
  const rowOf = new Map(model.rows.map((r) => [r.key, r]))
  const rowTo = (key: string): PbdCardRow[] => {
    const r = rowOf.get(key)
    return r ? [{ key, glyph: r.glyph, day: r.ymd, text: r.lane && r.lane !== 'Bids' && r.lane !== 'History' && r.lane !== 'Crews on site' && r.lane !== 'Trips' ? `${r.lane}: ${r.text}` : r.text, soft: r.soft, to: key }] : []
  }

  // The bids
  const sent = input.bids
    .map((b) => ({ ...b, sentYmd: input.toYmd(b.sent), sentDay: dayOfYmd(input.toYmd(b.sent)) }))
    .filter((b): b is typeof b & { sentYmd: string; sentDay: number } => b.sentDay != null)
    .sort((a, b) => a.sentDay - b.sentDay)
  const anchor = sent.find((b) => isWon(b.outcome)) ?? sent[0] ?? null

  // The sets, as the chart placed them
  const parts = [...input.parts].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
  const partById = new Map(parts.map((p) => [p.id, p]))
  const setById = new Map(input.sets.map((s) => [s.id, s]))
  const placed = input.sets.flatMap((s) => {
    const part = partById.get(s.part_id)
    if (!part || !isDrawingSet(s)) return []
    const ymd = s.dated && dayOfYmd(s.dated) != null ? s.dated : input.toYmd(s.came_at)
    const day = dayOfYmd(ymd)
    return ymd && day != null ? [{ ...s, ymd, day, part }] : []
  })
  const issued = placed.filter((s) => !isOurs(s)).sort((a, b) => a.day - b.day)

  for (const s of placed) {
    const p = s.part
    const ours = isOurs(s)
    const current = p.current_set_id === s.id
    const hasDate = s.dated != null && dayOfYmd(s.dated) != null
    const name = s.name.trim() || kindLabel(s.kind)
    const cameYmd = input.toYmd(s.came_at)
    const parent = s.replaces_set_id ? setById.get(s.replaces_set_id) : undefined
    const parentPart = parent ? partById.get(parent.part_id) : undefined
    const facts: PbdCard['facts'] = [{ label: 'On the sheets', value: hasDate ? dayWords(s.ymd) : 'no date' }]
    if (cameYmd) facts.push({ label: 'Came', value: `${dayWords(cameYmd)} · ${agoWords(today - (dayOfYmd(cameYmd) ?? today))}` })
    if (s.sheet_count != null) facts.push({ label: 'Sheets', value: sheetCountWords(s.sheet_count) })
    if (parent) facts.push({ label: 'Replaces', value: `${parent.name.trim() || kindLabel(parent.kind)}${parentPart && parentPart.id !== p.id ? ` on ${parentPart.name}` : ''}` })
    const by = s.created_by ? names[s.created_by] : undefined
    if (by) facts.push({ label: 'Added by', value: by })
    if ((s.memo ?? '').trim()) facts.push({ label: 'Memo', value: clip((s.memo ?? '').trim(), 240) })
    if ((s.changes ?? '').trim()) facts.push({ label: 'What changed', value: clip((s.changes ?? '').trim(), 240) })
    const actions: PbdCardAction[] = []
    const link = (s.link ?? '').trim()
    if (/^https?:\/\//i.test(link)) actions.push({ kind: 'open-link', label: PBD_PRESS.open, href: link })
    if (caps.canWritePlans && !current && !ours) actions.push({ kind: 'build-from', label: PBD_PRESS.buildFrom, partId: p.id, setId: s.id, message: `Build ${p.name} from ${name}? Every job on ${p.name} follows the set its part builds from.`, confirmLabel: `Build from ${name}` })
    if (caps.canWritePlans) actions.push({ kind: 'set-sheets', label: s.sheet_count != null ? PBD_PRESS.changeSheets : PBD_PRESS.setSheets, setId: s.id, setName: name, count: s.sheet_count ?? null })
    actions.push({ kind: 'show-part', label: PBD_PRESS.showPart, partId: p.id })
    if (caps.canAsk) actions.push({ kind: 'ask', label: PBD_PRESS.ask, title: `${p.name}: ${name}` })
    add(
      card({
        key: `set-${s.id}`,
        glyph: ours ? 'ours' : !hasDate ? 'undated' : current ? 'current' : 'set',
        title: name,
        kicker: [p.name, name === kindLabel(s.kind) ? '' : kindLabel(s.kind), sourceWords(s.source), current ? 'the set it builds from' : ''].filter(Boolean).join(' · '),
        facts,
        actions,
        quiet: link ? null : 'No link on this set yet.',
      }),
    )
  }

  const hasSchedule = (b: PlansByDateInput['bids'][number]) => dayOfYmd(input.toYmd(b.scheduleStart)) != null
  const scheduleAction = (b: PlansByDateInput['bids'][number]): PbdCardAction[] => (caps.canEditBids ? [{ kind: 'set-schedule', label: hasSchedule(b) ? PBD_PRESS.changeSchedule : PBD_PRESS.setSchedule, bidId: b.id }] : [])

  // A bid's schedule: the bar, its lane's name and its two lines of the list share one card.
  for (const b of input.bids) {
    const startYmd = input.toYmd(b.scheduleStart)
    const startDay = dayOfYmd(startYmd)
    if (!startYmd || startDay == null) continue
    const endRaw = b.scheduleNoEnd ? null : input.toYmd(b.scheduleEnd)
    const endDay = dayOfYmd(endRaw)
    const endYmd = endRaw && endDay != null && endDay >= startDay ? endRaw : null
    const standing = scheduleStanding({ start: startYmd, end: endYmd }, ymdOfDay(today))
    const facts: PbdCard['facts'] = [
      { label: 'Starts', value: dayWords(startYmd) },
      { label: 'Ends', value: endYmd ? dayWords(endYmd) : 'no end date' },
    ]
    if (endYmd) facts.push({ label: 'Length', value: scheduleLengthWords(startYmd, endYmd) })
    const c = card({
      key: `sched-${b.id}`,
      glyph: standing.over ? 'scheduleOver' : 'schedule',
      title: `${b.label}’s schedule`,
      kicker: standing.words,
      facts,
      actions: [...scheduleAction(b), { kind: 'open-bid', label: PBD_PRESS.openBid, bidId: b.id }],
      quiet: 'A person typed these two dates on the bid. Nothing is counted from the day it was sent.',
    })
    for (const key of [`sched-${b.id}`, `schedover-${b.id}`, `schedstart-${b.id}`, `schedend-${b.id}`, `lane-sched-${b.id}`]) add({ ...c, key })
  }

  for (const b of sent) {
    const plansYmd = input.toYmd(b.plansDated)
    const outcomeYmd = input.toYmd(b.outcomeAt)
    const outcomeWord = isWon(b.outcome) ? 'Won' : (b.outcome ?? '').toLowerCase() === 'lost' ? 'Lost' : null
    const facts: PbdCard['facts'] = [{ label: 'Sent', value: `${dayWords(b.sentYmd)} · ${agoWords(today - b.sentDay)}` }]
    if (plansYmd && dayOfYmd(plansYmd) != null) facts.push({ label: 'Priced from plans dated', value: dayWords(plansYmd) })
    if (outcomeWord) facts.push({ label: outcomeWord, value: outcomeYmd && dayOfYmd(outcomeYmd) != null ? dayWords(outcomeYmd) : 'no day on record' })
    const since = issued.filter((s) => s.day > b.sentDay)
    facts.push({ label: 'Sets since it was sent', value: `${since.length} of ${issued.length}` })
    const c = card({
      key: `bid-${b.id}`,
      glyph: 'bid',
      title: [b.label, (b.name ?? '').trim()].filter(Boolean).join(' · '),
      kicker: outcomeWord ? outcomeWord.toLowerCase() : 'sent, no answer yet',
      facts,
      rowsTitle: since.length ? 'The sets since' : null,
      ...capRows([...since].reverse().flatMap((s) => rowTo(`set-${s.id}`))),
      actions: [{ kind: 'open-bid', label: PBD_PRESS.openBid, bidId: b.id }, ...scheduleAction(b)],
    })
    add(c)
    add({ ...c, key: `bidplans-${b.id}` })
    add({ ...c, key: `bidout-${b.id}` })
  }

  // The trips (punch list #379): a bar's card says the trip, and its one press opens the Trips look.
  const openTrips: PbdCardAction = { kind: 'open-trips', label: PBD_PRESS.openTrips }
  for (const t of input.trips ?? []) {
    if (!rowOf.has(`trip-${t.id}`)) continue
    const facts: PbdCard['facts'] = []
    if (t.who) facts.push({ label: 'Who went', value: t.who })
    if (t.why) facts.push({ label: 'What for', value: clip(t.why, 240) })
    add(card({ key: `trip-${t.id}`, glyph: 'trip', title: `Trip ${t.when}`, kicker: t.standing, facts, actions: [openTrips] }))
  }

  // The crews
  const jobByLabel = new Map(input.jobs.map((j) => [j.label, j]))
  const clockJobs = input.clock === 'read' ? input.jobs.filter((j) => (j.days ?? []).length > 0) : []
  const runs = crewRuns(clockJobs)
  for (const r of runs) {
    const fromYmd = ymdOfDay(r.from)
    const endYmd = ymdOfDay(r.to)
    add(
      card({
        key: `crew-${r.from}`,
        glyph: 'crew',
        title: 'Crews on site',
        kicker: `${r.from === r.to ? dayWords(fromYmd) : `${dayWords(fromYmd, fromYmd.slice(0, 4) !== endYmd.slice(0, 4))} to ${dayWords(endYmd)}`} · ${plural(r.days, 'day', 'days')}`,
        rowsTitle: 'The jobs on this bar',
        ...capRows(
          r.byJob.map((j): PbdCardRow => {
            const job = jobByLabel.get(j.label)
            return { key: `crewjob-${r.from}-${j.label}`, glyph: 'crew', day: '', text: [j.label, (job?.name ?? '').trim()].filter(Boolean).join(' · '), soft: plural(j.days, 'day', 'days'), to: job ? `job-${job.id}` : null }
          }),
        ),
      }),
    )
  }
  for (const j of input.jobs) {
    const firstYmd = input.toYmd(j.firstWorkDay)
    const lastYmd = input.toYmd(j.lastWorkDay)
    const days = input.clock === 'read' ? (j.days ?? []).length : 0
    const facts: PbdCard['facts'] = []
    if (days) facts.push({ label: 'Days by the clock', value: String(days) })
    if (firstYmd && dayOfYmd(firstYmd) != null) facts.push({ label: 'First work day', value: dayWords(firstYmd) })
    if (lastYmd && dayOfYmd(lastYmd) != null) facts.push({ label: 'Last work day', value: `${dayWords(lastYmd)} · ${agoWords(today - (dayOfYmd(lastYmd) ?? today))}` })
    const part = j.partId ? partById.get(j.partId) : undefined
    if (part) facts.push({ label: 'Builds from', value: part.name })
    add(
      card({
      key: `job-${j.id}`,
      glyph: days ? 'crew' : 'crewOpen',
      title: [j.label, (j.name ?? '').trim()].filter(Boolean).join(' · '),
      kicker: days ? 'on the clock' : 'first work day to last, the days between are not on the clock',
      facts,
      actions: caps.canOpenJobs ? [{ kind: 'open-job', label: PBD_PRESS.openJob, jobId: j.id }] : [],
      quiet: caps.canOpenJobs ? null : PBD_JOB_DOOR_WORDS,
      }),
    )
  }

  // The kept lines
  for (const h of input.history) {
    const ymd = input.toYmd(h.happenedAt)
    if (!ymd || dayOfYmd(ymd) == null) continue
    const verb = HISTORY_SOURCE[h.source] ? historyVerb(h.source) : 'Note'
    const body = h.body.trim()
    const cut = h.bodyChars != null && h.bodyChars > h.body.length
    add(
      card({
        key: `hist-${h.id}`,
        glyph: h.source === 'letter' ? 'letter' : 'tick',
        title: verb,
        kicker: [dayWords(ymd), h.byName ? `kept by ${h.byName}` : '', h.about ? `about ${h.about}` : ''].filter(Boolean).join(' · '),
        words: cut ? `${body}…` : body,
        actions: [{ kind: 'read-line', label: PBD_PRESS.readLine, entryId: h.id }],
      }),
    )
  }

  // A lane's name
  for (const lane of model.lanes) {
    if (lane.kind === 'bids') {
      add(card({ key: 'lane-bids', title: 'Bids', kicker: [lane.sub, model.unsentBids.length ? `${model.unsentBids.length} with no sent day: ${jobsWords(model.unsentBids)}` : ''].filter(Boolean).join(' · '), rowsTitle: sent.length ? 'Each on the day it was sent' : null, ...capRows([...sent].reverse().flatMap((b) => rowTo(`bid-${b.id}`))) }))
    } else if (lane.kind === 'schedule') {
      continue
    } else if (lane.kind === 'part') {
      const p = partById.get(lane.key)
      if (!p) continue
      const mine = placed.filter((s) => s.part.id === p.id).sort((a, b) => b.day - a.day)
      const current = mine.find((s) => s.id === p.current_set_id)
      const jobs = input.jobs.filter((j) => j.partId === p.id).map((j) => j.label)
      const facts: PbdCard['facts'] = [{ label: 'Builds from', value: current ? `${current.name.trim() || kindLabel(current.kind)} · ${current.dated ? dayWords(current.ymd) : `came ${dayWords(current.ymd)}`}` : 'no set yet' }]
      if (jobs.length) facts.push({ label: jobs.length === 1 ? 'The job on it' : 'The jobs on it', value: jobsWords(jobs) })
      const actions: PbdCardAction[] = []
      if (caps.canWritePlans) actions.push({ kind: 'new-set', label: PBD_PRESS.newSet, partId: p.id })
      actions.push({ kind: 'show-part', label: PBD_PRESS.showPart, partId: p.id })
      add(card({ key: `lane-${p.id}`, title: p.name, kicker: lane.sub, facts, rowsTitle: mine.length ? 'Its sets, newest first' : null, ...capRows(mine.flatMap((s) => rowTo(`set-${s.id}`).map((r) => ({ ...r, text: r.text.replace(`${p.name}: `, '') })))), actions }))
    } else if (lane.kind === 'trips') {
      add(card({ key: 'lane-trips', title: 'Trips', kicker: lane.sub, rowsTitle: 'Newest first', ...capRows([...lane.spans].reverse().flatMap((s) => rowTo(s.key))), actions: [openTrips] }))
    } else if (lane.kind === 'crew') {
      add(card({ key: 'lane-crew', title: 'Crews on site', kicker: lane.sub, rowsTitle: lane.spans.length ? 'Newest first' : null, ...capRows([...lane.spans].reverse().flatMap((s) => rowTo(s.key))), quiet: input.clock === 'closed' ? 'The clock’s days read for the office.' : null }))
    } else {
      const kept = [...lane.marks].reverse()
      add(card({ key: 'lane-history', title: 'History', kicker: lane.sub, rowsTitle: kept.length ? 'Newest first' : null, ...capRows(kept.flatMap((m) => rowTo(m.key))), actions: caps.canKeep ? [{ kind: 'keep', label: PBD_PRESS.keep }] : [] }))
    }
  }

  // The four figures
  for (const f of model.figures) {
    let rows: PbdCardRow[] = []
    let rowsTitle: string | null = null
    if (f.key === 'first' && issued[0]) rows = rowTo(`set-${issued[0].id}`)
    else if (f.key === 'newest' && issued.length) rows = rowTo(`set-${issued[issued.length - 1]?.id ?? ''}`)
    else if (f.key === 'since') {
      rows = [...(anchor ? issued.filter((s) => s.day > anchor.sentDay) : issued)].reverse().flatMap((s) => rowTo(`set-${s.id}`))
      rowsTitle = rows.length ? 'Newest first' : null
    } else if (f.key === 'crew') {
      const crew = model.lanes.find((l) => l.kind === 'crew')
      rows = [...(crew?.spans ?? [])].reverse().flatMap((s) => rowTo(s.key))
      rowsTitle = rows.length ? 'Newest first' : null
    }
    if (f.key === 'sheets') {
      // The sets being built from, each with its count or the words that nobody has counted it.
      rows = parts.flatMap((p) => {
        const cur = placed.find((s) => s.id === p.current_set_id)
        return cur ? rowTo(`set-${cur.id}`).map((r) => ({ ...r, text: r.text.replace(', the set it builds from', ''), soft: cur.sheet_count != null ? sheetCountWords(cur.sheet_count) : 'not counted yet' })) : []
      })
      rowsTitle = rows.length ? 'The sets being built from' : null
    }
    if (f.key === 'schedule' && f.bidId) rows = [...rowTo(`schedstart-${f.bidId}`), ...rowTo(`schedend-${f.bidId}`)]
    add(card({ key: `figure-${f.key}`, title: f.label, kicker: `${f.value} · ${f.sub}`, rowsTitle, ...capRows(rows), quiet: f.key === 'since' ? 'Our own as-builts are not counted. They were not issued to us.' : f.key === 'sheets' ? 'A person types a set’s sheet count on its card.' : null }))
  }

  // Today
  const newest = issued[issued.length - 1]
  const lastSpan = model.lanes.find((l) => l.kind === 'crew')?.spans.slice(-1)[0]
  const todayFacts: PbdCard['facts'] = []
  if (newest) todayFacts.push({ label: 'Newest set', value: `${newest.name.trim() || kindLabel(newest.kind)} on ${newest.part.name} · ${agoWords(today - newest.day)}` })
  if (lastSpan) todayFacts.push({ label: 'Last on site', value: `${dayWords(ymdOfDay(lastSpan.to))} · ${agoWords(today - lastSpan.to)}` })
  add(card({ key: 'today', glyph: 'today', title: 'Today', kicker: dayWords(ymdOfDay(today)), facts: todayFacts, actions: caps.canKeep ? [{ kind: 'keep', label: PBD_PRESS.keep }] : [] }))

  return out
}
