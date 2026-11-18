/**
 * A look at another person's Task Mode (punch list #381). On Checklist → Review the owner opens a person's card and
 * presses **See <name>'s Task Mode**. A window draws that person's Today as their phone draws it. It is a look: the
 * viewer stays signed in as themself, the day is read with the read the office already has, and no press that would
 * change anything works.
 *
 * This file is the part with no screen in it: the words, and the one rule that says which presses still work. Every
 * sentence is held to `plainWords.ts` by the test.
 */

/** A person's first name, for the press and the lines that speak of them. An empty name reads *them*. */
export function lookFirstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0]
  return first || 'them'
}

/** *Dana's*, with the mark a name takes. */
function owned(name: string): string {
  return `${name}’s`
}

/** The press on a person's opened card on Review. */
export function lookPressLabel(name: string | null | undefined): string {
  return `See ${owned(lookFirstName(name))} Task Mode`
}

export function lookPressTitle(name: string | null | undefined): string {
  return `See what ${owned(lookFirstName(name))} phone shows in Task Mode. Nothing is changed.`
}

/** The window's head. */
export function lookWindowTitle(name: string | null | undefined): string {
  const whole = (name ?? '').trim()
  return whole ? `${owned(whole)} Task Mode` : 'Their Task Mode'
}

/** When the window read the day: *Read at 2:41 PM*. The window does not move after that. */
export function lookReadAtWords(at: Date): string {
  return `Read at ${at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export const LOOK_READ_AGAIN_LABEL = 'Read again'
export const LOOK_CLOSE_LABEL = 'Close'

/** The amber line under the head. Its first two words are drawn bold. */
export const LOOK_LINE_LEAD = 'A look.'
export function lookLine(name: string | null | undefined): string {
  const first = lookFirstName(name)
  return `This is what ${owned(first)} phone shows. No press here works, and nothing changes for ${first}.`
}

/**
 * The side column's list. The first three live on the person's own phone, so no window on another screen can read them.
 * The last is read for the signed-in person alone today.
 */
export const LOOK_CANT_TITLE = 'What this look does not show'
export function lookCantLines(name: string | null | undefined): string[] {
  const first = lookFirstName(name)
  return [
    `Whether ${owned(first)} phone has Task Mode on.`,
    `A task ${first} lifted to Do first.`,
    `How far each task is from ${first}.`,
    `Notes that tag ${first} and wait on an answer.`,
  ]
}

/** What a press is, for the rule below: the nearest thing a person can press or type in. */
const PRESSABLE = 'button, [role="button"], a, summary, label, input, select, textarea, [contenteditable="true"]'
const FIELD = 'input, select, textarea, [contenteditable="true"]'

/**
 * May this press go through in a look? Only a press that shows more or folds something away: a control that wears
 * `aria-expanded` and opens no menu or window of acts, or a link that opens in a new tab. Everything else is dead,
 * and so is a press this file has never heard of, since a new act added to Today must not work as someone else.
 *
 * `root` is the look's own box. A press outside it, such as a sheet drawn elsewhere on the page, is dead too.
 */
export function lookAllowsPress(target: Element | null, root: Element): boolean {
  if (!target || !root.contains(target)) return false
  const press = target.closest(PRESSABLE)
  if (!press || !root.contains(press)) return false
  if (press.matches(FIELD) || press.matches('label')) return false
  if (press.matches('a')) return press.hasAttribute('href') && press.getAttribute('target') === '_blank'
  return press.hasAttribute('aria-expanded') && !press.hasAttribute('aria-haspopup')
}

/** A box a person can type in or pick from. A look leaves none of them holding the keyboard. */
export function lookIsField(target: Element | null): boolean {
  return !!target && target.matches(FIELD)
}

/** The keys that press: a look checks them as it checks a click. Every other key moves around the page and is let be. */
export function lookKeyPresses(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar'
}
