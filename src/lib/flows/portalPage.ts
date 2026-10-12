/**
 * Messages, cut 8 (the portals): the flow read from their side, lifted from the Messages prototype (branch spike/gc-mode,
 * `to-dos/gc-mode/messages/prototype.html` v1.178: `portalStepHtml`, `portalHtml`, `portalWhereHtml`; v1.97, the list's
 * words v1.165). A trade partner's or an architect's first page, *Where you are with Click Construction*, and the
 * customer's *Where you are* card on Home both draw each step with `portalStep`. Their-move steps are the only presses,
 * with why in a sentence. The step we are on reads *We are on it* with what to expect, a step not reached yet reads
 * *Later* with when it comes, and a done step keeps its day. Nothing of ours shows: no Compared, no nudges, no other
 * companies, no office words.
 *
 * A step comes in as the flow's state already read it (`PortalStepIn`): where it stands, its papers' marks, its day.
 * The reads live in `flows/state.ts`; this file only words them, in English or Spanish (`portal/pageWords.ts`).
 *
 * Changed from the prototype, each on purpose:
 * - A decision is drawn only when it is theirs. The prototype drew our Compared step on a trade partner's page, with
 *   Accept the bid and Not this time, because its decision branch never asked who moves. Our decisions never show.
 * - Waiting on someone else names who: the architect, with the certificate when that is what we wait for, the owner, or
 *   someone else. The prototype said "your architect for the certificate" whoever it was.
 * - A done step shows its day in their language, never the office's history sentence ("She called, Tue Sep 1").
 * - A ran-out step names the paper that ran out and how to renew it. The prototype built the line from English-only
 *   names and kept the first-time why ("before we can send you an agreement"), which reads wrong once they have one.
 * - A their-move step whose own paper is already in waits on us, so it reads *We are on it*. The prototype told the
 *   architect "Your move" on an addendum they had filed and we had not sent.
 * - A shared step whose paper of ours went out is theirs: a pay application sent reads *Pay by the day on it* with
 *   its press, where the prototype said *We are on it* and never used those words.
 * - What we owe them reads as its day only, "We send it to you by Mon Oct 5.", in both languages. The owed line is
 *   typed by the office in English, so the Spanish never carried it either.
 * - The count on *Where you are* counts the rows it can show, so *All 8 steps* lists eight.
 * Pure.
 */

import {
  CODE_WORDS,
  pMonth,
  pWeekday,
  type Bilingual,
  type PageWords,
  type PaperWords,
  type PortalLang,
  type PortalPaperId,
} from '../portal/pageWords'

/** Who moves on a step, as the flow names it. */
export type PortalWho = 'us' | 'them' | 'both'

/** How a paper's fact reads for this person: on file, nothing yet, went and waits on them, or was on file and ran out. */
export type PortalPaperMark = 'ok' | 'no' | 'wait' | 'bad'

/** One paper a step turns on, as its fact reads. `ours` marks a paper we send. */
export interface PortalPaperRead {
  id: PortalPaperId
  ours: boolean
  mark: PortalPaperMark
}

/** Where a step stands for this person. A done step whose paper ran out is `lapsed`. */
export type PortalStepWhere = 'done' | 'now' | 'lapsed' | 'skipped' | 'notYet'

/** Who a step on now waits on, when it is someone other than them and us. */
export type PortalWaitingOn = 'architect' | 'owner' | 'other'

/** A step of their flow, as `flows/state.ts` reads it for one person (and, in the per-job lane, one job). */
export interface PortalStepIn {
  id: string
  /** The step's name in both languages, from the flow (Settings → Flows). */
  name: Bilingual
  who: PortalWho
  where: PortalStepWhere
  /** A fork that finishes one of two ways (Said yes, Compared). */
  decision?: boolean
  /** A step of rounds: each ask, each draw, each change order. */
  loop?: boolean
  /** Apart from the lane, with no arrow into it (change orders under Warranty). */
  aside?: boolean
  /** A round of this step is open now. An aside step shows only then. */
  roundNow?: boolean
  /** The flow's when-line for a step not reached yet. */
  later?: Bilingual | null
  /** The day it finished. */
  doneOn?: string | null
  /** On now, but waiting on someone else first. */
  waitingOn?: { who: PortalWaitingOn; forCertificate: boolean } | null
  papers?: PortalPaperRead[]
  /** The day the app has for it (a round's due day, their promised day) and whether it has passed. */
  day?: { on: string; late: boolean } | null
  /** The day we said we would have our part to them, when we owe them on this step. */
  owedBy?: string | null
  /** For a draw: any day in the month its pay application is for. */
  month?: string | null
}

interface ReadingBase {
  id: string
  name: string
}

/** A step read from their side. `yours`, `decide` and `ranOut` carry the "!" mark; `done` the check; the rest a dot. */
export type PortalStepReading =
  | (ReadingBase & { kind: 'done'; when: string })
  | (ReadingBase & {
      kind: 'yours'
      /** "due Wed Sep 30" or "late since Wed Sep 30", drawn after the name. */
      due: string | null
      late: boolean
      line: string
      button: string | null
      button2: string | null
      paper: PortalPaperId | null
      /** The press opens our sign page (a paper we sent that waits on their signature); else their upload or entry. */
      signs: boolean
    })
  | (ReadingBase & { kind: 'decide'; line: string; accept: string; decline: string })
  | (ReadingBase & { kind: 'ranOut'; line: string; button: string | null; paper: PortalPaperId | null })
  | (ReadingBase & { kind: 'waiting'; line: string })
  | (ReadingBase & { kind: 'onIt'; line: string })
  | (ReadingBase & { kind: 'later'; line: string })

/** A decision shows only when it is theirs and on now: our Compared never shows, and a fork not reached reads nothing. */
function shows(step: PortalStepIn): boolean {
  if (step.where === 'skipped') return false
  if (step.decision) return step.who === 'them' && step.where === 'now'
  return true
}

/** The paper a step's reading is about: theirs that is not in yet, else theirs, else the first. */
function pickPaper(papers: PortalPaperRead[]): PortalPaperRead | null {
  return papers.find((p) => !p.ours && p.mark !== 'ok') ?? papers.find((p) => !p.ours) ?? papers[0] ?? null
}

function line(...parts: (string | null | undefined)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join(' ')
}

function waitingWords(lang: PortalLang, w: { who: PortalWaitingOn; forCertificate: boolean }, words: PageWords): string {
  if (w.who === 'architect') return words.say(lang, w.forCertificate ? 'waitCertificate' : 'waitArchitect')
  return words.say(lang, w.who === 'owner' ? 'waitOwner' : 'waitOther')
}

function whyWords(lang: PortalLang, step: PortalStepIn, paper: PortalPaperRead | null, pw: PaperWords | null, words: PageWords): string {
  if (paper?.id === 'waiver') {
    return step.month && step.day
      ? words.say(lang, 'waiverWhy', { month: pMonth(lang, step.month), day: pWeekday(lang, step.day.on) })
      : words.say(lang, 'waiverWhyPlain')
  }
  return pw?.why ?? words.say(lang, 'yourMove')
}

/**
 * One step read from their side, or null when it does not show (skipped for them, a decision that is ours or not on
 * now). `after` is the step before it in the flow, for the when-line of a step not reached that has none of its own.
 */
export function portalStep(lang: PortalLang, step: PortalStepIn, after: Bilingual | null = null, words: PageWords = CODE_WORDS): PortalStepReading | null {
  if (!shows(step)) return null
  const base = { id: step.id, name: step.name[lang] }
  const papers = step.papers ?? []
  const paper = pickPaper(papers)
  const pw = paper ? words.paper(lang, paper.id) : null

  if (step.where === 'done') return { ...base, kind: 'done', when: step.doneOn ? pWeekday(lang, step.doneOn) : words.say(lang, 'doneWord') }

  if (step.where === 'lapsed') {
    const bad = papers.find((p) => p.mark === 'bad') ?? paper
    const bw = bad ? words.paper(lang, bad.id) : null
    const text = bw?.yours ? line(words.say(lang, 'ranOut', { paper: bw.yours }), bw.renew) : (bw?.why ?? words.say(lang, 'yourMove'))
    return { ...base, kind: 'ranOut', line: text, button: bw?.button ?? null, paper: bad?.id ?? null }
  }

  if (step.where === 'now') {
    if (step.waitingOn) return { ...base, kind: 'waiting', line: waitingWords(lang, step.waitingOn, words) }
    if (step.decision) return { ...base, kind: 'decide', line: words.say(lang, 'sayYesNo'), accept: words.say(lang, 'acceptBid'), decline: words.say(lang, 'notThisTime') }
    // A shared step is theirs once its paper is out to them: their own paper, or ours once it went (a pay application).
    const theirs = step.who === 'them' || (step.who === 'both' && !!paper && (!paper.ours || paper.mark !== 'no'))
    // Theirs, and still on us: our paper not sent yet, or their own paper already in.
    const weOwe = !!paper && (paper.ours ? paper.mark === 'no' : paper.mark === 'ok')
    if (theirs && !weOwe) {
      const due = step.day ? words.say(lang, step.day.late ? 'lateSince' : 'dueOn', { day: pWeekday(lang, step.day.on) }) : null
      return {
        ...base,
        kind: 'yours',
        due,
        late: !!step.day?.late,
        line: whyWords(lang, step, paper, pw, words),
        button: pw?.button ?? null,
        button2: pw?.button2 ?? null,
        paper: paper?.id ?? null,
        signs: !!paper && paper.ours && paper.mark === 'wait',
      }
    }
    const expect = step.owedBy ? words.say(lang, 'sendBy', { day: pWeekday(lang, step.owedBy) }) : pw?.onIt
    return { ...base, kind: 'onIt', line: line(words.say(lang, 'onIt'), expect) }
  }

  const when = step.later?.[lang] ?? pw?.comes ?? (after ? words.say(lang, 'afterStep', { step: after[lang] }) : '')
  return { ...base, kind: 'later', line: line(words.say(lang, 'later'), when) }
}

/** The steps that can show, in order, each with the one before it for its when-line. */
function readAll(lang: PortalLang, steps: PortalStepIn[], before: Bilingual | null, words: PageWords): { step: PortalStepIn; reading: PortalStepReading }[] {
  const out: { step: PortalStepIn; reading: PortalStepReading }[] = []
  let prev = before
  for (const step of steps) {
    const reading = portalStep(lang, step, prev, words)
    if (!reading) continue
    out.push({ step, reading })
    prev = step.name
  }
  return out
}

/** A lane of their flow, in the flow's order. The per-job lane carries one read per job they are asked on. */
export type PortalLaneIn =
  | { lane: 'once'; steps: PortalStepIn[] }
  | { lane: 'perJob'; jobs: { name: string; steps: PortalStepIn[] }[] }
  | { lane: 'anyTime'; steps: PortalStepIn[] }

export interface PortalPageIn {
  /** Our company's name, as the letterhead has it. */
  company: string
  /** The office's number for questions. */
  phone: string
  /** Off the flow (declined, lost): the page thanks them first. */
  off: boolean
  lanes: PortalLaneIn[]
}

export interface PortalPageSection {
  /** "Getting set up", a job's name, or "Open". */
  title: string
  rows: PortalStepReading[]
}

export interface PortalPage {
  title: string
  off: string | null
  sections: PortalPageSection[]
  questions: string
}

/**
 * A trade partner's or an architect's first page: Getting set up (the Once lane), one section per job they are asked on
 * (an aside step only while one of its rounds is open), then Open (an Any time step with a round open). A section with
 * no rows is left out, so a skipped master agreement draws nothing.
 */
export function portalPage(lang: PortalLang, page: PortalPageIn, words: PageWords = CODE_WORDS): PortalPage {
  const sections: PortalPageSection[] = []
  let before: Bilingual | null = null
  for (const lane of page.lanes) {
    if (lane.lane === 'once') {
      const rows = readAll(lang, lane.steps, before, words)
      if (rows.length) sections.push({ title: words.say(lang, 'setUp'), rows: rows.map((r) => r.reading) })
      before = rows[rows.length - 1]?.step.name ?? before
    } else if (lane.lane === 'perJob') {
      let last: Bilingual | null = before
      for (const job of lane.jobs) {
        const rows = readAll(lang, job.steps.filter((s) => !s.aside || s.roundNow), before, words)
        if (rows.length) sections.push({ title: job.name, rows: rows.map((r) => r.reading) })
        last = rows[rows.length - 1]?.step.name ?? last
      }
      before = last
    } else {
      const rows = readAll(lang, lane.steps.filter((s) => s.roundNow), before, words)
      if (rows.length) sections.push({ title: words.say(lang, 'openSection'), rows: rows.map((r) => r.reading) })
    }
  }
  return {
    title: words.say(lang, 'pageTitle', { company: page.company }),
    off: page.off ? words.say(lang, 'offThanks') : null,
    sections,
    questions: words.say(lang, 'questions', { phone: page.phone }),
  }
}

export interface CustomerWhere {
  title: string
  /** "3 of 8 done". */
  count: string
  /** The bar's fill, a whole percent. */
  pct: number
  rows: PortalStepReading[]
  /** The press under the rows: "All 8 steps" while folded, "Fewer" while open. */
  more: string
}

/**
 * The customer's *Where you are* on Home: the job's per-job lane from their side, with a bar, and three rows (the last
 * done, the one on now, the next) that open to all. A change order, aside, is on Money and Papers instead.
 */
export function customerWhere(lang: PortalLang, steps: PortalStepIn[], all = false, words: PageWords = CODE_WORDS): CustomerWhere {
  const rows = readAll(lang, steps.filter((s) => !s.aside), null, words)
  const total = rows.length
  const done = rows.filter((r) => r.reading.kind === 'done').length
  const now = rows.findIndex((r) => r.step.where === 'now')
  const from = Math.max(0, (now < 0 ? done : now) - 1)
  const shown = all ? rows : rows.slice(from, from + 3)
  return {
    title: words.say(lang, 'whereTitle'),
    count: words.say(lang, 'whereCount', { done, total }),
    pct: total ? Math.round((100 * done) / total) : 0,
    rows: shown.map((r) => r.reading),
    more: all ? words.say(lang, 'fewer') : words.say(lang, 'allSteps', { n: total }),
  }
}
