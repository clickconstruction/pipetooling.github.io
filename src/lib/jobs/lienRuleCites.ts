/**
 * LIEN_RULE_CITES (v2.3594): section → the heading in the guide *read the Texas lien
 * rules the app follows* that explains it. The guide is the one copy of the rules; the
 * surfaces quote section numbers and this table turns each into a door (`/help?g=…#…`).
 * A heading renamed in the guide has to be renamed here — the test pins every entry to a
 * real heading in the guide file.
 */
import { helpGuideHref } from '../helpGuideAnchors'

export const LIEN_RULES_GUIDE_SLUG = 'texas-lien-rules-the-app-follows'

export const LIEN_RULE_CITES = {
  '§ 53.003': 'The month rule',
  '§ 53.056': 'The § 53.056 notice',
  '§ 53.081': 'What the notice does for the owner',
  '§ 53.052': 'The affidavit',
  '§ 53.152': 'Releases and waivers',
  '§ 38.001': "Attorney's fees need presentment",
  '§ 38.002': "Attorney's fees need presentment",
  'Rule 185': 'Sworn account',
  '§ 392': 'Debt collection (homeowners)',
  '§ 28.004': 'Interest: Prompt Payment',
  '§ 302.002': 'Interest: the legal rate',
  '§ 31.04': 'Theft of service',
  '§ 27.031': 'Justice court',
  residential: 'Residential shortens everything by a month',
  delivery: 'Delivery',
} as const

export type LienRuleCite = keyof typeof LIEN_RULE_CITES

/** The guide, opened at the row for one cite. */
export function lienRuleHref(cite: LienRuleCite): string {
  return helpGuideHref(LIEN_RULES_GUIDE_SLUG, LIEN_RULE_CITES[cite])
}

/** Where each surface's § The rules door lands: the row that matters for what is on screen. */
export const LIEN_RULES_DOOR: Record<'desk_notice' | 'desk_affidavit' | 'window_demand' | 'window_notice' | 'window_affidavit' | 'window_release', LienRuleCite> = {
  desk_notice: '§ 53.056',
  desk_affidavit: '§ 53.052',
  window_demand: '§ 38.001',
  window_notice: '§ 53.056',
  window_affidavit: '§ 53.052',
  window_release: '§ 53.152',
}
