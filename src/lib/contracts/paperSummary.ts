/**
 * The summary, the level and the sample of a paper built from settings (punch list #389, step 2). The summary says a
 * job's picks in plain words, one line a setting, from the settings list's own words. It is made from the same picks
 * as the paper, so the two cannot disagree, and it is not the contract. The level is a name and the kind of place it
 * sits beside, never a score. The sample is the real paper for those picks, with made-up names.
 *
 * Pure: no React, no supabase, no clock.
 */
import { choiceOf, type PaperLevel, type PaperPicks, type SettingsDef } from './paperSettings'

type Lang = 'en' | 'es'

/** A Spanish word where it has one, else the English. */
const said = (lang: Lang, en: string, es: string): string => (lang === 'es' && es.trim() !== '' ? es.trim() : en.trim())

/** The named level these picks are, or null for a mix of its own: every setting on the level's own pick. */
export function levelOf(def: SettingsDef, picks: PaperPicks): PaperLevel | null {
  return def.levels.find((l) => def.settings.every((s) => l.picks[s.key] === picks[s.key])) ?? null
}

export const LEVEL_MIX = { en: 'A mix of its own', es: 'Una combinación propia' } as const

/** The level in words: its name and what it is aligned with. A mix has no place beside it. */
export function levelWords(def: SettingsDef, picks: PaperPicks, lang: Lang = 'en'): { name: string; aligned: string } {
  const level = levelOf(def, picks)
  if (!level) return { name: LEVEL_MIX[lang], aligned: '' }
  return { name: said(lang, level.label, level.labelEs), aligned: said(lang, level.alignedWith, level.alignedWithEs) }
}

/** *Standard, aligned with regular businesses*, or the name alone. For a chip and for the sample's stamp. */
export function levelLine(def: SettingsDef, picks: PaperPicks, lang: Lang = 'en'): string {
  const { name, aligned } = levelWords(def, picks, lang)
  if (!aligned) return name
  return `${name}, ${aligned.charAt(0).toLowerCase()}${aligned.slice(1)}`
}

/** One line of the summary: a setting, the choice picked, and what that choice says in plain words. */
export interface SummaryLine {
  key: string
  label: string
  choice: string
  says: string
  /** True when the pick leaves the topic out of the paper. */
  out: boolean
}

/** The summary for these picks, a line a setting, in the list's own order. A setting with no pick is left out. */
export function summaryLines(def: SettingsDef, picks: PaperPicks, lang: Lang = 'en'): SummaryLine[] {
  return def.settings.flatMap((s) => {
    const c = choiceOf(def, s.key, picks[s.key])
    if (!c) return []
    return [{ key: s.key, label: said(lang, s.label, s.labelEs), choice: said(lang, c.label, c.labelEs), says: said(lang, c.says, c.saysEs), out: c.out }]
  })
}

/** The line under every summary. */
export const SUMMARY_NOTE = {
  en: 'The summary is made from the same settings as the paper, so the two cannot disagree. It is not the contract.',
  es: 'El resumen se hace con los mismos ajustes que el documento, así que no pueden diferir. No es el contrato.',
} as const

/** The made-up party a sample goes to. No real company or person is named on a sample. */
export const SAMPLE_PARTY = { company: 'Sample Sub LLC', signer: 'Jordan Sample', job: 'Job J0000, a sample' } as const

export const SAMPLE_MARK = { en: 'SAMPLE', es: 'MUESTRA' } as const

/** The stamp at the foot of a sample: that it is one, its level and its revision. */
export function sampleStamp(def: SettingsDef, picks: PaperPicks, revision: number, lang: Lang = 'en'): string {
  const level = levelLine(def, picks, lang)
  return lang === 'es' ? `MUESTRA, no es para firmar. ${level}. Revisión ${revision}.` : `SAMPLE, not for signature. ${level}. Revision ${revision}.`
}

/** The press that prints the sample, and why it is dead: a paper that cannot go has no sample. */
export function samplePress(problem: string | null): { label: string; dead: boolean; why: string | null } {
  return { label: 'Print the sample', dead: problem != null, why: problem }
}
