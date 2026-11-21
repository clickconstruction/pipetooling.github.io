/**
 * The office's settings page on a job (punch list #389, step 4): a Contract Book entry's settings list, turned into the
 * paper the walked flow draws (`lib/documentBuilder/documentBuilder.ts`, the flow Taunya shaped in the Document
 * builder), and the flow's answer turned back into a job's picks.
 *
 * The Book says a paper in settings and choices. The flow says it in topics and levels: every topic's slider has the
 * same stops, Off and then the list's levels. A level's stop on a topic is the choice that level picks for that
 * setting, so two levels may share a choice. A choice that leaves the topic out is Off.
 *
 *   - `flowDefFromBook` makes the flow's paper: the levels, a topic a setting, what each level says on it, what puts a
 *     person in breach and what the site must have (the lines the Book keeps beside each choice), the notice and the
 *     site note.
 *   - `picksFromFlow` reads the job's picks out of what the person chose, and `flowFromPicks` puts a job's picks back
 *     on the sliders, starting from its basis.
 *   - `blanksToType` names the blanks no picked choice fills, which the office types for this job.
 *   - `changeWords` says what a change will do before it is pressed, from the kernel's plan.
 *
 * No clause wording is here. Pure: no React, no supabase, no clock.
 */
import {
  PAPER_OFF,
  plural,
  type PaperDef,
  type PaperSettings,
  type PaperStop,
  type PaperTopic,
  type PaperTopicLevel,
} from '../documentBuilder/documentBuilder'
import type { SettingsChangePlan } from './jobPaperSettings'
import {
  choiceLines,
  choiceOf,
  tidyLines,
  type PaperField,
  type PaperPicks,
  type PaperSetting,
  type SettingChoice,
  type SettingsDef,
} from './paperSettings'

/** The words of the page that are the app's own, not the Book's. */
export const JOB_FLOW_WORDS = {
  noLevels: 'This paper has no levels yet, so it is set on one page.',
  noticeTitle: 'Before you start',
  noticeTick: 'I have read this.',
  siteTitle: 'Match the paper to the site',
  asksNothing: 'This level asks nothing of the site.',
  offSays: 'Off. This job does not require this paper.',
  offReview:
    'Off. This job does not require this paper. Nobody is asked to sign.',
  offNote: 'There is nothing to require while the paper is off.',
  basisAsk: "Pick the level this job's paper should express.",
  basisHow:
    'Every page after this one starts on it. You can move any one page up or down.',
  siteFact: 'The site must have',
  levelsTitle: 'The levels',
  reviewTitle: "This job's paper",
  confirmPress: 'Require this paper',
  nothingPress: 'Nothing to require',
  beforeConfirm: 'Nothing reaches a signer until this press.',
} as const

const es = (lang: 'en' | 'es', en: string, spanish: string): string =>
  lang === 'es' && spanish.trim() !== '' ? spanish : en

/** Why the walked flow cannot draw this list, in words, or null when it can. The one page of choices always can. */
export function flowUnfit(def: SettingsDef): string | null {
  return def.levels.length === 0 ? JOB_FLOW_WORDS.noLevels : null
}

/** The choice a level picks for a setting. */
function levelChoice(
  def: SettingsDef,
  levelKey: string,
  setting: PaperSetting,
): SettingChoice | null {
  const level = def.levels.find((l) => l.key === levelKey)
  return level ? choiceOf(def, setting.key, level.picks[setting.key]) : null
}

/** The one blank every choice of a setting fills, when there is one: the topic then reads as a fact, like *Secrecy lasts*. */
function factField(def: SettingsDef, setting: PaperSetting): PaperField | null {
  const kept = setting.choices.filter((c) => !c.out)
  const keys =
    kept.length > 0
      ? Object.keys(kept[0]!.fills).filter((k) =>
          kept.every((c) => (c.fills[k] ?? '') !== ''),
        )
      : []
  return def.fields.find((f) => f.key === keys[0]) ?? null
}

/** Who and what the paper is about, for the flow's own lines. */
export interface JobFlowAbout {
  paperId: string
  title: string
  job: string
}

/**
 * The Book entry as the flow's paper. `flowUnfit` says first whether it can be one. The flow never shows a clause, so
 * none is read: a topic's page says what its level means, what puts a person in breach and what the site must have.
 */
export function flowDefFromBook(
  def: SettingsDef,
  about: JobFlowAbout,
  lang: 'en' | 'es' = 'en',
): PaperDef {
  const topics: PaperTopic[] = def.settings.map((s) => {
    const out = s.choices.find((c) => c.out) ?? null
    const fact = factField(def, s)
    const levels: Record<string, PaperTopicLevel> = {}
    for (const l of def.levels) {
      const c = levelChoice(def, l.key, s)
      if (!c) continue
      const blank = fact
        ? es(lang, c.fills[fact.key] ?? '', c.fillsEs[fact.key] ?? '')
        : ''
      levels[l.key] = {
        says: es(lang, c.says, c.saysEs),
        breach: c.out ? [] : choiceLines(c, 'breach', lang),
        site: c.out ? [] : choiceLines(c, 'site', lang),
        ...(blank !== '' ? { blank } : {}),
      }
    }
    const label = es(lang, s.label, s.labelEs)
    return {
      key: s.key,
      label,
      section: label,
      ...(fact ? { fact: es(lang, fact.label, fact.labelEs) } : {}),
      inEveryPaper: out === null,
      ...(out ? { offSays: es(lang, out.says, out.saysEs) } : {}),
      levels,
    }
  })
  const notice = def.notice
  const site = def.siteNote
  return {
    id: about.paperId,
    title: about.title,
    job: about.job,
    company: '',
    protectedParty: '',
    words: {
      offSays: JOB_FLOW_WORDS.offSays,
      offReview: JOB_FLOW_WORDS.offReview,
      offNote: JOB_FLOW_WORDS.offNote,
      basisAsk: JOB_FLOW_WORDS.basisAsk,
      basisHow: JOB_FLOW_WORDS.basisHow,
      siteFact: JOB_FLOW_WORDS.siteFact,
      levelsTitle: JOB_FLOW_WORDS.levelsTitle,
      reviewTitle: JOB_FLOW_WORDS.reviewTitle,
      confirmPress: JOB_FLOW_WORDS.confirmPress,
      nothingPress: JOB_FLOW_WORDS.nothingPress,
      beforeConfirm: JOB_FLOW_WORDS.beforeConfirm,
    },
    levels: def.levels.map((l) => ({
      id: l.key,
      name: es(lang, l.label, l.labelEs),
      alignedWith: es(lang, l.alignedWith, l.alignedWithEs),
    })),
    notice: {
      title:
        es(lang, notice?.title ?? '', notice?.titleEs ?? '') ||
        JOB_FLOW_WORDS.noticeTitle,
      lines:
        lang === 'es' && tidyLines(notice?.linesEs).length > 0
          ? tidyLines(notice?.linesEs)
          : tidyLines(notice?.lines),
      placeholder: '',
      tick:
        es(lang, notice?.tick ?? '', notice?.tickEs ?? '') ||
        JOB_FLOW_WORDS.noticeTick,
    },
    site: {
      lead: es(lang, site?.lead ?? '', site?.leadEs ?? ''),
      title:
        es(lang, site?.title ?? '', site?.titleEs ?? '') ||
        JOB_FLOW_WORDS.siteTitle,
      lines:
        lang === 'es' && tidyLines(site?.linesEs).length > 0
          ? tidyLines(site?.linesEs)
          : tidyLines(site?.lines),
      asksNothing: JOB_FLOW_WORDS.asksNothing,
      placeholder: '',
    },
    topics,
    signers: [],
  }
}

/** Whether the list opens on a notice: one with a line. The database asks for its box only then. */
export function hasNotice(def: SettingsDef): boolean {
  return tidyLines(def.notice?.lines).length > 0
}

/**
 * The job's picks, read out of what the person chose in the flow: a topic's stop is the choice its level picks, and
 * Off is the choice that leaves the topic out. Null when the whole paper is off, or a stop has no choice behind it.
 */
export function picksFromFlow(
  def: SettingsDef,
  s: PaperSettings,
): PaperPicks | null {
  if (s.off) return null
  const picks: PaperPicks = {}
  for (const setting of def.settings) {
    const stop = s.topics[setting.key] ?? s.basis
    const choice =
      stop === PAPER_OFF
        ? (setting.choices.find((c) => c.out) ?? null)
        : levelChoice(def, stop, setting)
    if (!choice) return null
    picks[setting.key] = choice.key
  }
  return picks
}

/** The stop a pick sits on: Off for a choice that leaves the topic out, else a level that picks it, the basis first. */
export function stopOfPick(
  def: SettingsDef,
  setting: PaperSetting,
  pick: string | undefined,
  basis: string | null,
): PaperStop | null {
  const choice = choiceOf(def, setting.key, pick)
  if (!choice) return null
  if (choice.out) return PAPER_OFF
  const on = def.levels.filter((l) => l.picks[setting.key] === choice.key)
  return (on.find((l) => l.key === basis) ?? on[0])?.key ?? null
}

/**
 * A job's picks put back on the flow's sliders, starting from its basis. With no basis kept, the basis is the level
 * most topics sit on, the loosest of them on a tie. Null when a pick sits on no level, which the one page of choices
 * still shows.
 */
export function flowFromPicks(
  def: SettingsDef,
  picks: PaperPicks,
  basis: string | null,
): PaperSettings | null {
  if (def.levels.length === 0) return null
  const kept = def.levels.some((l) => l.key === basis) ? basis : null
  const topics: Record<string, PaperStop> = {}
  for (const setting of def.settings) {
    const stop = stopOfPick(def, setting, picks[setting.key], kept)
    if (stop === null) return null
    topics[setting.key] = stop
  }
  if (kept) return { off: false, basis: kept, topics }
  const count = (key: string) =>
    Object.values(topics).filter((t) => t === key).length
  const best = def.levels.reduce(
    (a, l) => (count(l.key) > count(a.key) ? l : a),
    def.levels[0]!,
  )
  return { off: false, basis: best.key, topics }
}

/** The blanks no picked choice fills: the office types each for this job. */
export function blanksToType(
  def: SettingsDef,
  picks: PaperPicks | null,
): PaperField[] {
  if (!picks) return []
  const filled = new Set<string>()
  for (const s of def.settings)
    for (const [k, v] of Object.entries(
      choiceOf(def, s.key, picks[s.key])?.fills ?? {},
    ))
      if (v !== '') filled.add(k)
  return def.fields.filter((f) => !filled.has(f.key))
}

/** The typed blanks that still need words, by name. */
export function blanksMissing(
  def: SettingsDef,
  picks: PaperPicks | null,
  typed: Record<string, string>,
): string[] {
  return blanksToType(def, picks)
    .filter((f) => (typed[f.key] ?? '').trim() === '')
    .map((f) => f.label || f.key)
}

const WAY: Record<SettingsChangePlan['change'], string> = {
  same: 'No topic moves. The words of the paper changed.',
  stricter: 'This makes the paper stricter.',
  looser: 'This makes the paper looser.',
  mixed: 'This makes the paper stricter on some topics and looser on others.',
}

/**
 * What a change to a job's settings will do, said before the press. `press` is the button's own words, and `dead`
 * holds it when there is nothing to save.
 */
export function changeWords(plan: SettingsChangePlan): {
  press: string
  dead: boolean
  lines: string[]
} {
  if (plan.kind === 'nothing')
    return {
      press: 'Save the settings',
      dead: true,
      lines: ['Nothing is changed yet.'],
    }
  if (plan.kind === 'refused')
    return { press: 'Save the settings', dead: true, lines: [plan.words] }
  if (plan.kind === 'saved')
    return {
      press: 'Save the settings',
      dead: false,
      lines: [
        WAY[plan.change],
        'Nobody has signed yet, so nobody signs again.',
      ],
    }
  const who = plural(plan.signAgain, 'person has', 'people have')
  return {
    press: `Save, and ask ${plural(plan.signAgain, 'person', 'people')} to sign again`,
    dead: false,
    lines: [
      WAY[plan.change],
      `${who} signed this paper. Each signs the new version again, and the job stays closed to each until then.`,
    ],
  }
}
