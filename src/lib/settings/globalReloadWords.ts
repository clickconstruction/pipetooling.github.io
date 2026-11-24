/**
 * Global Reload, in words (Diane, 2026-11-24): *move the Global Reload button out of the gear wheel drop down and
 * put it somewhere in settings where below it we explain cases where someone would want to press it.*
 *
 * The press makes every other open copy of the app hard-reload at once (`ForceReloadContext`). It sat in the gear
 * menu under **Hard Reload**, one row from a press a dev makes many times a day, with no word on what it does to
 * the people it reaches. It lives in Settings → Advanced now, with these words under it and a window that asks
 * first.
 *
 * Every line here is what the code does, read from it on 2026-11-24:
 * - the broadcast does not come back to the copy that sent it (Supabase's `self: false`), so that copy stays;
 * - a copy reloads at once, with no look at typed words, an open window or a save on its way out;
 * - a copy that reloaded inside the last five seconds ignores it (`ForceReloadContext`'s own guard);
 * - only the signed-in shell listens, and `RealtimeLifecycleProvider` drops every channel after five minutes
 *   hidden. `ForceReloadProvider` does not join again, so that copy has stopped listening until it reloads;
 * - without the press, an open copy asks for a new version each hour, and when looked at again after fifteen
 *   minutes hidden (`UpdatePrompt`), then takes a quiet moment.
 *
 * Plain words (`plainWords.ts`): `globalReloadWords.test.ts` holds every line.
 */
export const GLOBAL_RELOAD_TITLE = 'Global Reload'
export const GLOBAL_RELOAD_PRESS = 'Global Reload'

/** Above the press: what it is, in one line. */
export const GLOBAL_RELOAD_LEAD = 'Makes every other open copy of the app reload now, on every phone and computer that is signed in.'

/** The window that asks first. */
export const GLOBAL_RELOAD_CONFIRM = {
  title: 'Reload every open copy of the app?',
  message: 'Everyone else who is signed in reloads now. Words they typed and have not sent are lost.',
  confirmLabel: 'Reload everyone',
  cancelLabel: 'Keep them working',
} as const

/** Under the press once it was sent. */
export const GLOBAL_RELOAD_SENT = 'Sent. Every other open copy is reloading. This copy stays as it is.'
/** Under the press when there was no channel to send on. */
export const GLOBAL_RELOAD_NOT_SENT = 'Not sent. This copy is not connected. Reload this page and press again.'

export type GlobalReloadSection = { heading: string; lines: readonly string[] }

/** Under the press: when to press it, when to leave it, and what it does to the people it reaches. */
export const GLOBAL_RELOAD_SECTIONS: readonly GlobalReloadSection[] = [
  {
    heading: 'Press it when',
    lines: [
      'A fault in the app is doing harm, and the fix is live. People must be on the fix now.',
      'You are about to push a database change the old app would misread. Deploy the app first. Press Global Reload. Then push the change.',
      'Many people are stuck on an old version at the same time.',
    ],
  },
  {
    heading: 'Leave it alone when',
    lines: [
      'You made an ordinary deploy. The app updates itself at a quiet moment and loses nothing.',
      'One person is stuck. Ask them to press Hard Reload in their gear menu.',
      'The new version is not live yet. A reload before that brings back the same version.',
    ],
  },
  {
    heading: 'What it does to people',
    lines: [
      'It reloads over whatever each person is doing. It does not ask first.',
      'Words they typed and have not sent are lost. An unsaved form is lost.',
      'Hard Reload and the update notice ask first over typed words. Global Reload does not.',
    ],
  },
  {
    heading: 'Who it reaches',
    lines: [
      'Only copies that are open and signed in right now.',
      'A copy that sat hidden for five minutes has stopped listening. It updates itself when it is next used.',
      'A copy that reloaded in the last five seconds ignores it.',
      'Without the press, an open copy finds a new version within the hour. Then it waits for a quiet moment.',
    ],
  },
]
