/**
 * Residential R5's push: Settings → Phone and texts → **Reply push**, the owner's switch for the reply push in words.
 * The switch is `app_settings`'s `REPLY_PUSH_ON_KEY` (R5's PR 3, migration `20261014110000_messages_notify_cron.sql`,
 * 'false' as it ships): the minute cron posts the sweep to `messages-notify` only while it reads 'true', the function
 * checks it too, and only the owner and a dev may change it (`master_or_dev_update_messages_reply_push_on`). The
 * sweep pushes a customer's, a lead's or a sub's reply to whoever has the conversation. Pure.
 *
 * v2.5540: the card also holds **the office's wait**, `app_settings` `messages_office_wait_minutes` (`OFFICE_WAIT_KEY`,
 * `value_num`, 15 as R5's SQL made it, `master_or_dev_update_messages_office_wait`): the minutes `pushesFor`
 * (`notifyRule.ts`) waits for whoever has a reply before the office hears too. 0 is at once, so a team that shares one
 * number hears every reply together. `parseOfficeWait` reads what the owner typed; `officeWaitLine` says what it means.
 */
import type { UserRole } from '../../hooks/useAuth'
import { OFFICE_WAIT_MINUTES } from './notifyRule'

export const REPLY_PUSH_TITLE = 'Reply push'
export const REPLY_PUSH_WHAT =
  'When a customer, a lead or a sub answers, whoever has the conversation gets a push on their phone. If nobody on the team writes back first, the office hears after its wait.'
export const REPLY_PUSH_CONFIRM = {
  title: 'Turn on the reply push?',
  message: 'When someone answers, whoever has the conversation gets a push within a minute. The office hears after its wait.',
  confirmLabel: 'Turn it on',
} as const
export const REPLY_PUSH_ON_TOAST = 'The reply push is on. Pushes go out within a minute.'
export const REPLY_PUSH_OFF_TOAST = 'The reply push is off. Nobody is pushed when a customer answers.'
export const REPLY_PUSH_NOT_SAVED = 'The switch did not change. Only the owner or a dev can turn the reply push on or off.'

/** Who may turn the reply push on or off: the owner and a dev, as the switch's UPDATE policy (`is_master_or_dev()`) allows. */
export function canSwitchReplyPush(role: UserRole | null | undefined): boolean {
  return role === 'master_technician' || role === 'dev'
}

/** Whether the switch reads on: only 'true' lets the cron post, as its statement and the function read it. */
export function replyPushIsOn(valueText: string | null | undefined): boolean {
  return valueText === 'true'
}

/** The line under the switch: what happens while it is on, or that nothing does while it is off. */
export function replyPushStateWords(on: boolean): string {
  return on ? 'Pushes go out within a minute.' : 'Off: nobody is pushed when a customer answers.'
}

export const OFFICE_WAIT_LABEL = 'The office hears after'
export const OFFICE_WAIT_UNIT = 'minutes'
export const OFFICE_WAIT_FIELD = 'Minutes before the office hears'
export const OFFICE_WAIT_SAVE = 'Save the wait'
export const OFFICE_WAIT_WHAT = 'How long the app waits for whoever has the conversation before the office hears too. 0 means at once.'
export const OFFICE_WAIT_SAVED_TOAST = 'The wait is saved.'
export const OFFICE_WAIT_NOT_SAVED = 'The wait did not change. Only the owner or a dev can change it.'
export const OFFICE_WAIT_BAD = 'Type a whole number of minutes, 0 to 240.'
/** The longest wait the card takes: four hours, past which a reply has waited the working day. */
export const OFFICE_WAIT_MAX = 240

/** The wait as the row keeps it: a whole number of minutes, 0 or more; anything else reads the default. */
export function readOfficeWait(valueNum: number | null | undefined): number {
  return typeof valueNum === 'number' && Number.isFinite(valueNum) && valueNum >= 0 ? Math.round(valueNum) : OFFICE_WAIT_MINUTES
}

/** What the owner typed, as minutes: a whole number from 0 to `OFFICE_WAIT_MAX`, else null. */
export function parseOfficeWait(raw: string): number | null {
  const words = raw.trim()
  if (!/^\d{1,3}$/.test(words)) return null
  const n = Number(words)
  return n <= OFFICE_WAIT_MAX ? n : null
}

/** The line under the wait: what the number means for the office. */
export function officeWaitLine(minutes: number): string {
  if (minutes === 0) return 'The office hears at once, with whoever has it.'
  return `The office hears after ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} when nobody writes back.`
}
