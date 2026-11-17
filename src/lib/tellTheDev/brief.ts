/**
 * Tell the dev (punch list #380): a note as a brief.
 *
 * *Copy as a brief* in the dev's inbox puts this on the clipboard: the note with its page and
 * state, in words a coding session can start from. It names the sender by role and never by
 * name, and it ends with the rule that a card restates the note with no real names, because the
 * repo is public and a note is not.
 */
import { noteKindChip, wordlessNoteLine } from './starts'
import { roleWords, type NoteContext } from './noteContext'

export type NoteForBrief = {
  kind: string | null
  body: string | null
  page_path: string | null
  created_at: string | null
  context: NoteContext | null
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? `An ${word.toLowerCase()}` : `A ${word.toLowerCase()}`
}

export function noteBrief(note: NoteForBrief): string {
  const ctx = note.context
  const lines: string[] = ['A note from the app, sent through Tell the dev. Work it through the three lenses: the sender’s seat, the job behind the ask, the whole office.', '']
  lines.push(`Kind: ${noteKindChip(note.kind)}`)
  if (ctx) {
    const who = roleWords(ctx.role) || 'Someone'
    const seat = [ctx.seat.training ? 'in training mode' : '', ctx.seat.twin ? 'a digital twin' : ''].filter(Boolean).join(', ')
    lines.push(`From: ${article(who)}${seat ? `, ${seat}` : ''}`)
    lines.push(`Page: ${ctx.page_label}${note.page_path ? ` (${note.page_path})` : ''}`)
    lines.push(`Window open: ${ctx.window ?? 'none'}`)
    const screen = ctx.screen.kind === 'phone' ? 'phone' : `desk, ${ctx.screen.width} wide`
    lines.push(`Screen: ${screen}${ctx.modes.length ? `, ${ctx.modes.join(' and ')} on` : ''}`)
    if (ctx.app_version) lines.push(`App version: ${ctx.app_version}`)
    if (ctx.errors.length) lines.push(`Error lines shown: ${ctx.errors.map((e) => `"${e.words}"`).join('; ')}`)
    if (ctx.refused.length) lines.push(`Refused by the server: ${ctx.refused.map((r) => `${r.what} (${r.status})`).join(', ')}`)
  }
  if (note.created_at) lines.push(`Sent: ${note.created_at}`)
  lines.push('')
  const words = (note.body ?? '').trim()
  lines.push(words ? `They wrote: "${words}"` : wordlessNoteLine(note.kind))
  lines.push('')
  lines.push('Restate it in your own words with no real names before it goes in a card, a commit or a PR. The repo is public.')
  return lines.join('\n')
}
