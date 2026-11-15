/**
 * Why a text goes, on its own so the texts switch (`textsSwitch.ts`) takes the five words and not `send.ts` with the
 * events, the text's composer and the boxes behind it: on the edge a function uploads every file an import names, a type
 * import too, and dev-mcp carried all of that for this one type (punch list #359). `send.ts` re-exports it, so every
 * reader of the send kernel imports as before.
 *
 * A person's reply, the app's nudge and the text back after a missed call (`missed`, punch list #195) follow the
 * opt-out line's rules. The app's answer to HELP and its confirmation of a stop carry their own STOP or START words, so
 * they take no line. A `missed` text is the app's own: its line is marked `auto`, which Follow up and the thread read as
 * nobody's move.
 */
export type SendPurpose = 'reply' | 'nudge' | 'answer' | 'confirm' | 'missed'
