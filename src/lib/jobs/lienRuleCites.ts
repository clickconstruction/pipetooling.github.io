/**
 * LIEN_RULE_CITES (v2.3594; the headings are the questions they answer since v2.4826): section → the heading in the guide *read the Texas lien
 * rules the app follows* that explains it. The guide is the one copy of the rules; the
 * surfaces quote section numbers and this table turns each into a door (`/help?g=…#…`).
 * A heading renamed in the guide has to be renamed here — the test pins every entry to a
 * real heading in the guide file.
 */
import { helpGuideHref } from '../helpGuideAnchors'

export const LIEN_RULES_GUIDE_SLUG = 'texas-lien-rules-the-app-follows'

export const LIEN_RULE_CITES = {
  '§ 53.003': 'When each date falls',
  '§ 53.056': 'What the notice is and where it goes',
  '§ 53.081': 'What the notice does for the owner',
  '§ 53.052': 'What the affidavit needs before it can be filed',
  '§ 53.152': 'When a release or a waiver is owed',
  '§ 38.001': "Attorney's fees need a demand first",
  '§ 38.002': "Attorney's fees need a demand first",
  'Rule 185': 'A suit on an account needs an itemized record',
  '§ 392': 'What a letter to a homeowner may not say',
  '§ 28.004': 'Interest at 1.5 percent a month on an unpaid bill',
  '§ 302.002': 'Interest at 6 percent a year when no bill was sent',
  '§ 31.04': 'Theft of service is off unless you tick it',
  '§ 27.031': 'What a justice court can hear',
  residential: 'A house moves every date up a month',
  delivery: 'When certified mail is required',
} as const

export type LienRuleCite = keyof typeof LIEN_RULE_CITES

/** The guide, opened at the row for one cite. */
export function lienRuleHref(cite: LienRuleCite): string {
  return helpGuideHref(LIEN_RULES_GUIDE_SLUG, LIEN_RULE_CITES[cite])
}

/** Where each surface's § Rules door lands: the row that matters for what is on screen. */
export const LIEN_RULES_DOOR: Record<'desk_notice' | 'desk_affidavit' | 'window_demand' | 'window_notice' | 'window_affidavit' | 'window_release', LienRuleCite> = {
  desk_notice: '§ 53.056',
  desk_affidavit: '§ 53.052',
  window_demand: '§ 38.001',
  window_notice: '§ 53.056',
  window_affidavit: '§ 53.052',
  window_release: '§ 53.152',
}
