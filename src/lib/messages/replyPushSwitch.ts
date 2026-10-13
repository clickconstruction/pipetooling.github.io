/**
 * Residential R5's push: Settings → Phone and texts → **Reply push**, the owner's switch for the reply push in words.
 * The switch is `app_settings`'s `REPLY_PUSH_ON_KEY` (R5's PR 3, migration `20261014110000_messages_notify_cron.sql`,
 * 'false' as it ships): the minute cron posts the sweep to `messages-notify` only while it reads 'true', the function
 * checks it too, and only the owner and a dev may change it (`master_or_dev_update_messages_reply_push_on`). The
 * sweep pushes a customer's, a lead's or a sub's reply to whoever has the conversation. Pure.
 */
import type { UserRole } from '../../hooks/useAuth'

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
