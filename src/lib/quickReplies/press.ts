/**
 * Job Mode's big buttons (v2.5573, punch list #112): which team line for customers each press sends, as
 * `quick_replies.phone_press` keeps it. One live line a press. The editor's **Big button on Job Mode** picker sets it
 * through `set_quick_reply_press`; the Job Mode kernel (`lib/jobMode/onMyWay.ts`) finds the line by it. Pure.
 */
export type PhonePress = 'on_my_way' | 'im_here'

export const PHONE_PRESSES: readonly PhonePress[] = ['on_my_way', 'im_here']

/** The press a column value names, or null for anything else. */
export function phonePressOf(value: unknown): PhonePress | null {
  return value === 'on_my_way' || value === 'im_here' ? value : null
}

/** Each press's name, as the button and the picker say it. */
export const PRESS_WORDS: Readonly<Record<PhonePress, string>> = { on_my_way: 'On my way', im_here: 'I’m here' }

/** The editor's picker. */
export const PRESS_PICKER = {
  label: 'Big button on Job Mode',
  note: 'The press that sends this line from the big green button, with no sheet of lines. One line each.',
  none: 'Not a big button',
} as const
