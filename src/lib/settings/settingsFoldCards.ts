/**
 * A Settings card that folds to its name and one line (punch list #261): the shape every
 * card on Jobs & billing has, and since PR 2 (v2.6631) the three cards the owner moved to
 * other tabs — HCP reconcile to Data & recovery, Sub portal · pay schedule to People & teams,
 * The office's county to Company beside the office address. A moved card keeps answering to
 * the anchor it had on Jobs & billing, so every link, door and guide that named the old anchor
 * still lands on the card and opens it: the deep links map the old anchor to the new tab and
 * rewrite it to the new one before the page looks for the element.
 */

export interface SettingsFoldCardSpec {
  /** The press's name in Settings → Usage (`data-nav`). */
  slug: string
  /** The element id a link lands on. */
  anchor: string
  title: string
  /** One line of what the card sets, under its name on the fold header. */
  line: string
  /** Anchors the card answered to before it moved; a link on one still opens it. */
  movedFrom?: readonly string[]
}

/** An anchor inside a card that a link may name instead of the card's own: the rate card's Who counts as what list. */
export const SETTINGS_CARD_CHILD_ANCHORS: Readonly<Record<string, string>> = {
  'who-counts-as-what': 'settings-jobs-rates',
}

/** Pure: whether an announced id is this card, a child anchor inside it, or an anchor it had before it moved. */
export function settingsCardIsTarget(c: SettingsFoldCardSpec, id: string): boolean {
  if (!id) return false
  if (id === c.anchor || SETTINGS_CARD_CHILD_ANCHORS[id] === c.anchor) return true
  return c.movedFrom?.includes(id) ?? false
}

export type MovedSettingsCardSlug = 'hcp-reconcile' | 'sub-pay' | 'office-county'

export interface MovedSettingsCard extends SettingsFoldCardSpec {
  slug: MovedSettingsCardSlug
  /** The tab the card lives on now. */
  tab: string
  movedFrom: readonly string[]
}

/** The three cards the owner moved off Jobs & billing (call 2, answered 2026-11-07), each on its new tab with its old anchor. */
export const MOVED_SETTINGS_CARDS: Readonly<Record<MovedSettingsCardSlug, MovedSettingsCard>> = {
  'hcp-reconcile': {
    slug: 'hcp-reconcile',
    tab: 'settings-data',
    anchor: 'settings-data-hcp-reconcile',
    movedFrom: ['settings-jobs-hcp-reconcile'],
    title: 'HCP reconcile',
    line: 'import billing history from HouseCall Pro exports, previewed before anything is written',
  },
  'sub-pay': {
    slug: 'sub-pay',
    tab: 'settings-people',
    anchor: 'settings-people-sub-pay',
    movedFrom: ['settings-jobs-sub-pay'],
    title: 'Sub portal · pay schedule',
    line: 'the pay-run weekday and the words on the subs’ portal',
  },
  'office-county': {
    slug: 'office-county',
    tab: 'settings-company',
    anchor: 'settings-company-office-county',
    movedFrom: ['settings-jobs-office-county'],
    title: 'The office’s county for sworn statements',
    line: 'where a sworn statement opens its venue line',
  },
}

export const MOVED_SETTINGS_CARD_LIST: readonly MovedSettingsCard[] = Object.values(MOVED_SETTINGS_CARDS)

/** Pure: every anchor a moved card answers to, new and old, each mapped to the card's tab, for the deep links. */
export function movedSettingsCardAnchorToTab(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of MOVED_SETTINGS_CARD_LIST) {
    out[c.anchor] = c.tab
    for (const old of c.movedFrom) out[old] = c.tab
  }
  return out
}

/** Pure: an old anchor → the anchor the card carries now, so the page looks for an element that exists. */
export function movedSettingsCardAnchorNow(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of MOVED_SETTINGS_CARD_LIST) for (const old of c.movedFrom) out[old] = c.anchor
  return out
}
