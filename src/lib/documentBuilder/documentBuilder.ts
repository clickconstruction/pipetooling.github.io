/**
 * The document builder's kernel for a walked builder (punch list #404, the flow of #389): the rules of a paper
 * that is put together from settings. A paper has a short list of levels, loosest first, and a list of topics.
 * Each topic sits on one level, or on Off when the paper can do without it. The person first picks
 * a basis, the level the whole paper should express, and then walks one page a topic.
 *
 * Nothing here is about secrecy. The first paper is a job's secrecy paper, and its contents are the
 * `PaperDef` in `secrecyPaper.fixture.ts`. A second kind of paper is a second `PaperDef`.
 *
 * Every rule of the flow lives here: a level's name and place, what a level means on a topic, the
 * breach lines a level brings and the ones it keeps from the level under it, what the site must have, the basis and what is off it,
 * which step is shut, and the words each of those says. Pure: no React, no supabase, no clock.
 */

/** The stop left of every level: the topic, or the whole paper, is left out. */
export const PAPER_OFF = 'off'

/** A stop on a slider: `PAPER_OFF` or a level's id. */
export type PaperStop = string

export type PaperLevel = {
  id: string
  /** The level's name, as the owner settled it: *Standard*. */
  name: string
  /** The kind of place the level sits beside, as a whole line: *Aligned with regular businesses*. */
  alignedWith: string
  /** A shorter name for a slider's stop, when the name is too long for one. */
  shortName?: string
}

/** One topic on one level. The three lists are kept beside the wording they describe. */
export type PaperTopicLevel = {
  /** What the level means on this topic, in plain words. */
  says: string
  /** What puts a person in breach. */
  breach: string[]
  /** What the site must have for this level to hold. Empty when it asks nothing of the site. */
  site: string[]
  /** The value that fills the clause's blank, for a topic that is one wording with a blank. */
  blank?: string
}

export type PaperTopic = {
  key: string
  label: string
  /** Where the topic sits in the paper, as its label: *Section 5: Photos and video*. */
  section: string
  /** A few words naming the topic's blank as a fact about a level: *Secrecy lasts*. Only for a topic with a blank. */
  fact?: string
  /** True when no paper can leave the topic out, so its slider has no Off. */
  inEveryPaper: boolean
  /** What Off means on this topic. Unused when the topic is in every paper. */
  offSays?: string
  /** Keyed by level id. */
  levels: Record<string, PaperTopicLevel>
}

export type PaperDef = {
  id: string
  title: string
  job: string
  company: string
  protectedParty: string
  /** The sentences that name this kind of paper. Everything else the flow says is built below. */
  words: {
    offSays: string
    offReview: string
    offNote: string
    basisAsk: string
    /** How the basis works, under the levels. */
    basisHow: string
    /** The name of the fact that counts what a level asks of the site: *The site must have*. */
    siteFact: string
    levelsTitle: string
    reviewTitle: string
    confirmPress: string
    nothingPress: string
    beforeConfirm: string
  }
  /** Loosest first. */
  levels: PaperLevel[]
  notice: { title: string; lines: string[]; placeholder: string; tick: string }
  site: { lead: string; title: string; lines: string[]; asksNothing: string; placeholder: string }
  topics: PaperTopic[]
  signers: Array<{ group: string; people: number }>
}

/** What the person has chosen. `off` is the whole paper; a topic's own Off lives in `topics`. */
export type PaperSettings = {
  off: boolean
  /** The level the paper should express. Every page starts on it. */
  basis: string
  /** Keyed by topic key. */
  topics: Record<string, PaperStop>
}

export type PaperStepKind = 'notice' | 'basis' | 'site' | 'topic' | 'review'
export type PaperStep = { key: string; kind: PaperStepKind; name: string }

/** Where the person is in the flow. `ackAt` is when the box on the first page was ticked. */
export type PaperFlow = { step: number; ackAt: string | null; done: boolean }

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

// ---------------------------------------------------------------------------
// Levels and stops
// ---------------------------------------------------------------------------

/** Every stop of a slider, loosest first: Off, then the levels. */
export function paperStops(def: PaperDef): PaperStop[] {
  return [PAPER_OFF, ...def.levels.map((l) => l.id)]
}

/** A stop's place, Off being 0. A stop the paper does not have is -1. */
export function stopRank(def: PaperDef, stop: PaperStop): number {
  return paperStops(def).indexOf(stop)
}

function levelOf(def: PaperDef, stop: PaperStop): PaperLevel | undefined {
  return def.levels.find((l) => l.id === stop)
}

export function stopName(def: PaperDef, stop: PaperStop): string {
  return stop === PAPER_OFF ? 'Off' : (levelOf(def, stop)?.name ?? stop)
}

export function stopShortName(def: PaperDef, stop: PaperStop): string {
  const level = levelOf(def, stop)
  return stop === PAPER_OFF ? 'Off' : (level?.shortName ?? level?.name ?? stop)
}

/** The line under a level's name. Off sits beside no place. */
export function alignedWith(def: PaperDef, stop: PaperStop): string {
  return levelOf(def, stop)?.alignedWith ?? ''
}

/** How far along the track a stop sits, 0 to 100. */
export function stopPercent(def: PaperDef, stop: PaperStop): number {
  const last = paperStops(def).length - 1
  const at = Math.max(0, stopRank(def, stop))
  return last > 0 ? (at / last) * 100 : 0
}

/** The stop at a place in the list, held inside the list's ends. */
export function stopAt(def: PaperDef, rank: number): PaperStop {
  const stops = paperStops(def)
  return stops[Math.max(0, Math.min(stops.length - 1, Math.round(rank)))] ?? PAPER_OFF
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export function topicOf(def: PaperDef, key: string): PaperTopic | undefined {
  return def.topics.find((t) => t.key === key)
}

/** The loosest stop a topic can take: a topic in every paper has no Off. */
export function topicFloor(topic: PaperTopic): number {
  return topic.inEveryPaper ? 1 : 0
}

/** What a stop means on a topic. */
export function topicSays(def: PaperDef, key: string, stop: PaperStop): string {
  const topic = topicOf(def, key)
  if (!topic) return ''
  return stop === PAPER_OFF ? (topic.offSays ?? '') : (topic.levels[stop]?.says ?? '')
}

/** True when the topic is one wording with a blank, so its levels differ by a number and not by a rule. */
export function topicHasBlank(topic: PaperTopic): boolean {
  return Object.values(topic.levels).some((l) => l.blank != null)
}

export type BreachGroups = {
  /** The lines this level brings: the level one step looser does not have them. */
  own: string[]
  /** The lines the level one step looser has too. They still apply, and the page draws them in grey. */
  carried: string[]
  /** The level's name when its own lines are *New at* it, else null. */
  newAt: string | null
}

/**
 * What puts a person in breach on a topic at a stop, in two groups: what the level brings, and what
 * it keeps from the level one step looser. Every line in either group applies at this level. A line
 * the looser level had and this one replaced is in neither. On the loosest level every line is its
 * own and nothing is new, since nothing sits under it. A topic with a blank is never *New at* a
 * level, since its lines differ only by the number.
 */
export function breachGroups(def: PaperDef, key: string, stop: PaperStop): BreachGroups {
  const topic = topicOf(def, key)
  if (!topic || stop === PAPER_OFF) return { own: [], carried: [], newAt: null }
  const lines = topic.levels[stop]?.breach ?? []
  const under = stopAt(def, stopRank(def, stop) - 1)
  if (under === PAPER_OFF) return { own: lines, carried: [], newAt: null }
  const before = topic.levels[under]?.breach ?? []
  return {
    own: lines.filter((line) => !before.includes(line)),
    carried: lines.filter((line) => before.includes(line)),
    newAt: topicHasBlank(topic) ? null : stopShortName(def, stop),
  }
}

/** What the site must have for a topic's stop to hold. Empty when it asks nothing. */
export function siteLines(def: PaperDef, key: string, stop: PaperStop): string[] {
  if (stop === PAPER_OFF) return []
  return topicOf(def, key)?.levels[stop]?.site ?? []
}

/** What a whole level asks of the site, topic by topic. A topic that asks nothing is left out. */
export function siteAsks(def: PaperDef, level: string): Array<{ key: string; label: string; lines: string[] }> {
  return def.topics.map((t) => ({ key: t.key, label: t.label, lines: siteLines(def, t.key, level) })).filter((row) => row.lines.length > 0)
}

/**
 * What the paper as it now stands asks of the site, topic by topic: each topic at its own stop, not
 * at the basis. This is the list to hold against the real site before anyone is asked to sign.
 */
export function siteNeeds(def: PaperDef, s: PaperSettings): Array<{ key: string; label: string; lines: string[] }> {
  if (s.off) return []
  return def.topics.map((t) => ({ key: t.key, label: t.label, lines: siteLines(def, t.key, s.topics[t.key] ?? s.basis) })).filter((row) => row.lines.length > 0)
}

export type LevelFact = { key: string; label: string; value: string }

/**
 * What a level does, as a few facts a person can hold against another level: the value of every
 * topic that is one wording with a blank, then how many things the level asks of the site. They are
 * the same facts in the same order on every level, so they change in place as the basis moves.
 */
export function levelFacts(def: PaperDef, level: string): LevelFact[] {
  if (!levelOf(def, level)) return []
  const blanks = def.topics.flatMap((t): LevelFact[] => {
    const blank = t.levels[level]?.blank
    return blank == null ? [] : [{ key: t.key, label: t.fact ?? t.label, value: blank }]
  })
  const asked = siteAsks(def, level).reduce((n, row) => n + row.lines.length, 0)
  return [...blanks, { key: 'site', label: def.words.siteFact, value: asked === 0 ? 'Nothing' : plural(asked, 'thing', 'things') }]
}

export type ClauseDrawing =
  | { kind: 'out' }
  /** One wording with a blank: the tag is the value that fills it. */
  | { kind: 'blank'; tag: string; blank: string }
  /** One wording out of several: `bars` are the grey bars' widths in percent. */
  | { kind: 'picked'; tag: string; bars: number[] }

/**
 * How the core clause is drawn. No wording is ever shown: a clause is grey bars, more of them the
 * stricter the level, so the page moves while the handle is dragged.
 */
export function clauseDrawing(def: PaperDef, key: string, stop: PaperStop): ClauseDrawing {
  const topic = topicOf(def, key)
  if (!topic || stop === PAPER_OFF) return { kind: 'out' }
  const blank = topic.levels[stop]?.blank
  if (blank != null) return { kind: 'blank', tag: `Filled in: ${blank}`, blank }
  const rank = stopRank(def, stop)
  const letter = String.fromCharCode(64 + rank)
  const bars = Array.from({ length: 1 + rank }, (_, i) => (i === rank ? 34 + rank * 13 : 100))
  return { kind: 'picked', tag: `Wording ${letter}`, bars }
}

// ---------------------------------------------------------------------------
// The settings and the basis
// ---------------------------------------------------------------------------

/** A new paper: on, with the loosest level as its basis and every topic on it. */
export function startSettings(def: PaperDef): PaperSettings {
  const basis = def.levels[0]?.id ?? PAPER_OFF
  return { off: false, basis, topics: Object.fromEntries(def.topics.map((t) => [t.key, basis])) }
}

/** The whole paper's level: a level's id when every topic sits on it, else `'custom'`. */
export function paperLevel(def: PaperDef, s: PaperSettings): string {
  const hit = def.levels.find((l) => def.topics.every((t) => s.topics[t.key] === l.id))
  return hit ? hit.id : 'custom'
}

/** Picking a level as the basis turns the paper on and sets every topic back to it. */
export function withBasis(def: PaperDef, s: PaperSettings, level: string): PaperSettings {
  if (!levelOf(def, level)) return s
  return { off: false, basis: level, topics: Object.fromEntries(def.topics.map((t) => [t.key, level])) }
}

/** The whole paper off. The topics keep their stops, though a level picked afterwards resets them. */
export function withPaperOff(s: PaperSettings): PaperSettings {
  return { ...s, off: true }
}

/**
 * One topic moved to a stop. A topic in every paper is held at its loosest level. When the move puts
 * every topic on one level, that level becomes the basis: the paper then expresses it, whatever the
 * person first picked.
 */
export function withTopic(def: PaperDef, s: PaperSettings, key: string, stop: PaperStop): PaperSettings {
  const topic = topicOf(def, key)
  if (!topic) return s
  const held = stopAt(def, Math.max(topicFloor(topic), stopRank(def, stop)))
  const next: PaperSettings = { ...s, topics: { ...s.topics, [key]: held } }
  const level = paperLevel(def, next)
  return !next.off && level !== 'custom' ? { ...next, basis: level } : next
}

/** True when a topic's page has been moved off the basis. */
export function isOffBasis(s: PaperSettings, key: string): boolean {
  return s.topics[key] !== s.basis
}

/** The topics moved off the basis, in the paper's order. */
export function offBasisKeys(def: PaperDef, s: PaperSettings): string[] {
  return def.topics.filter((t) => isOffBasis(s, t.key)).map((t) => t.key)
}

/** The paper's level in a few words, for a chip: *Standard*, or *Standard, 1 page off it*. */
export function paperLevelLine(def: PaperDef, s: PaperSettings): string {
  if (s.off) return 'Off'
  const n = offBasisKeys(def, s).length
  const name = stopName(def, s.basis)
  return n === 0 ? name : `${name}, ${plural(n, 'page', 'pages')} off it`
}

/** The line at the top of a topic's page. */
export function basisLine(def: PaperDef, s: PaperSettings): string {
  return `Your basis is ${stopName(def, s.basis)}.`
}

/** The line under the levels on the basis page. */
export function basisNote(def: PaperDef, s: PaperSettings): string {
  if (s.off) return def.words.offSays
  const n = offBasisKeys(def, s).length
  if (n > 0) return `${plural(n, 'page is', 'pages are')} off the basis. Picking a level here sets every page back to it.`
  return `Every page is on ${stopName(def, s.basis)}.`
}

/** The line at the top of the review. */
export function reviewLine(def: PaperDef, s: PaperSettings): string {
  const n = offBasisKeys(def, s).length
  return `${basisLine(def, s)} ${n > 0 ? `${plural(n, 'page is', 'pages are')} off it.` : 'Every page is on it.'}`
}

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------

/** The steps in order: the disclaimer, the basis, the site, one page a topic, the review. */
export function flowSteps(def: PaperDef): PaperStep[] {
  return [
    { key: 'notice', kind: 'notice', name: 'Before you start' },
    { key: 'basis', kind: 'basis', name: 'The basis' },
    { key: 'site', kind: 'site', name: 'Match the paper to the site' },
    ...def.topics.map((t): PaperStep => ({ key: t.key, kind: 'topic', name: t.label })),
    { key: 'review', kind: 'review', name: 'Review' },
  ]
}

/**
 * The stop a step stands for, so the step bar can draw the paper's shape: the basis step is the
 * basis, a topic's step is the topic's own stop, and the other steps stand for none. With the whole
 * paper Off every one of them is Off.
 */
export function stepStop(s: PaperSettings, step: PaperStep): PaperStop | null {
  if (step.kind !== 'basis' && step.kind !== 'topic') return null
  if (s.off) return PAPER_OFF
  return step.kind === 'basis' ? s.basis : (s.topics[step.key] ?? s.basis)
}

export function startFlow(): PaperFlow {
  return { step: 0, ackAt: null, done: false }
}

const BASIS_AT = 1

/**
 * A step nobody can open yet. Nothing past the disclaimer opens until its box is ticked. With the
 * paper Off there is nothing to set, so every step between the basis and the review is shut.
 */
export function isStepShut(def: PaperDef, s: PaperSettings, flow: PaperFlow, i: number): boolean {
  const last = flowSteps(def).length - 1
  return (flow.ackAt == null && i > 0) || (s.off && i > BASIS_AT && i < last)
}

/** The step *Next* opens. With the paper Off, the basis goes straight to the review. */
export function nextStep(def: PaperDef, s: PaperSettings, flow: PaperFlow): number {
  const last = flowSteps(def).length - 1
  return s.off && flow.step === BASIS_AT ? last : Math.min(last, flow.step + 1)
}

/** The step *Back* opens. With the paper Off, the review goes straight back to the basis. */
export function prevStep(def: PaperDef, s: PaperSettings, flow: PaperFlow): number {
  const last = flowSteps(def).length - 1
  return s.off && flow.step === last ? BASIS_AT : Math.max(0, flow.step - 1)
}

/** Open a step. A shut step opens the first page instead. Any move clears a confirm already pressed. */
export function goToStep(def: PaperDef, s: PaperSettings, flow: PaperFlow, i: number): PaperFlow {
  const last = flowSteps(def).length - 1
  const step = Math.max(0, Math.min(last, i))
  return { ...flow, step: isStepShut(def, s, flow, step) ? 0 : step, done: false }
}

/**
 * The flow after the settings or the tick changed under it. A person left on a step that is now
 * shut goes to the basis when the paper was switched Off, and to the first page otherwise.
 */
export function settleFlow(def: PaperDef, s: PaperSettings, flow: PaperFlow): PaperFlow {
  if (!isStepShut(def, s, flow, flow.step)) return flow
  return { ...flow, step: s.off && flow.ackAt != null ? BASIS_AT : 0 }
}

/** The tick on the disclaimer. `at` is the minute it was ticked, kept with it. */
export function withAck(flow: PaperFlow, ticked: boolean, at: string): PaperFlow {
  return { ...flow, ackAt: ticked ? at : null }
}

export function stepCountLine(def: PaperDef, flow: PaperFlow): string {
  return `Step ${flow.step + 1} of ${flowSteps(def).length}`
}

/** The words on the *Next* press: it names the page it opens. */
export function nextLabel(def: PaperDef, s: PaperSettings, flow: PaperFlow): string {
  return `Next: ${flowSteps(def)[nextStep(def, s, flow)]?.name ?? ''}`
}

export function signerCount(def: PaperDef): number {
  return def.signers.reduce((n, g) => n + g.people, 0)
}

/** The review's press and the line under it. Dead when the paper is Off: there is nothing to require. */
export function confirmWords(def: PaperDef, s: PaperSettings, flow: PaperFlow): { label: string; dead: boolean; note: string } {
  if (s.off) return { label: def.words.nothingPress, dead: true, note: def.words.offNote }
  const note = flow.done ? `Required. ${plural(signerCount(def), 'person', 'people')} asked to sign. You are first.` : def.words.beforeConfirm
  return { label: def.words.confirmPress, dead: false, note }
}
