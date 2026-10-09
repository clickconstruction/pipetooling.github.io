/**
 * The leader's word on a lien paper (v2.3405): the office records that he said to send it — who,
 * when, and how — and the paper goes to Ready to send on that record. v2.3813 adds the two
 * declarations the office makes when he is beside them: *he is standing over me* and *he is typing
 * it in*. No sign-in and no second session — the office writes it down, the row keeps the channel,
 * and he sees it in *Sent on your word* with *Not what I said* to pull it back.
 */

export const LIEN_WORD_CHANNELS = ['phone', 'in_person', 'text', 'standing_over', 'typing'] as const
export type LienWordChannel = (typeof LIEN_WORD_CHANNELS)[number]

/** The channels that mean the leader is at the desk as the record is made. */
export const LIEN_WORD_PRESENT_CHANNELS: readonly LienWordChannel[] = ['standing_over', 'typing']

/** How each channel reads on the picker, and afterwards on the record. */
export const LIEN_WORD_CHANNEL_WORDS: Record<LienWordChannel, { pick: string; record: string }> = {
  phone: { pick: 'by phone', record: 'by phone' },
  in_person: { pick: 'in person', record: 'in person' },
  text: { pick: 'by text', record: 'by text' },
  standing_over: { pick: 'standing over me', record: 'standing over the desk' },
  typing: { pick: 'typing it in', record: 'typed it in himself' },
}

export function isLienWordChannel(v: string | null | undefined): v is LienWordChannel {
  return (LIEN_WORD_CHANNELS as readonly string[]).includes(v ?? '')
}

/** True when the leader is here — not a word remembered from the truck. */
export function leaderPresent(channel: string | null | undefined): boolean {
  return channel === 'standing_over' || channel === 'typing'
}

/**
 * Why *Record it* is refused, or '' when it may go. A claim set by hand over the app's balance is
 * the leader's alone (v2.3682) — a remembered word does not carry it, but a leader standing at
 * the desk is the leader approving it knowingly.
 */
export function wordRecordBlock(claimGate: 'leader' | 'look' | null, channel: string | null | undefined): string {
  if (claimGate !== 'leader') return ''
  if (leaderPresent(channel)) return ''
  return 'The claim is set by hand over the balance — the leader approves that one himself. If he is here, say so.'
}

/** The leader's first name, for `on Malachi's word` (v2.4856); '' when the desk does not know him. */
export function leaderFirstName(leaderName: string | null | undefined): string {
  return (leaderName ?? '').trim().split(/\s+/)[0] ?? ''
}

/** `on Malachi’s word` when the desk knows the job's master (v2.4856), else `on the leader’s word`. */
export function onWhoseWord(leaderName?: string | null): string {
  const first = leaderFirstName(leaderName)
  return first ? `on ${first}’s word` : 'on the leader’s word'
}

/** The record line: `on Malachi’s word · Malachi Whites, Sep 24 · standing over the desk` (`on the leader’s word` when the master is not known). */
export function wordRecordWords(item: { word_note: string | null; word_channel: string | null } | null | undefined, leaderName?: string | null): string {
  const note = item?.word_note?.trim() ?? ''
  const how = isLienWordChannel(item?.word_channel) ? LIEN_WORD_CHANNEL_WORDS[item.word_channel].record : ''
  return [onWhoseWord(leaderName), note, how].filter(Boolean).join(' · ')
}

/**
 * The short line beside the row once a presence channel is picked (v2.4856: one sentence each, the rest
 * is in the preview) — who is making the record, and that the leader can pull it back.
 */
export function presenceLine(channel: string | null | undefined, recorderName: string | null | undefined, leaderName?: string | null): string {
  if (!leaderPresent(channel)) return ''
  const who = recorderName?.trim() || 'the office'
  const he = leaderFirstName(leaderName) || 'He'
  return `Recorded by ${who}. ${he} can pull it back with “Not what I said”.`
}

export type WordRecordPreview = {
  /** On the notice, in Ready to send: the footer's first words. */
  ready: string
  /** The desk's title bar, for the leader. */
  strip: string
  /** The queue row's state words. */
  row: string
  /** Who recorded it and what pulls it back. */
  record: string
  /** The paper is untouched. */
  paper: string
}

/**
 * What the record will say in every place it lands (v2.4856, the owner's ask: *see what that signature
 * looks like on what it goes on*). The word is written to the desk item only — never onto the notice —
 * and shows in three places: the notice's Ready footer, the leader's *Sent on your word* strip, and
 * the queue row. The same `wordRecordWords` the desk draws afterwards, so the preview cannot drift.
 */
export function wordRecordPreview(input: { leaderName?: string | null; note: string; channel: LienWordChannel; recorderName?: string | null; jobLabel: string; gcName?: string | null; amountWords?: string }): WordRecordPreview {
  const words = wordRecordWords({ word_note: input.note, word_channel: input.channel }, input.leaderName)
  const who = input.recorderName?.trim() || 'the office'
  const he = leaderFirstName(input.leaderName) || 'the leader'
  const present = leaderPresent(input.channel)
  return {
    ready: `On ${words.slice(3)}`,
    strip: lienFyiStrip([{ jobLabel: input.jobLabel, by: 'word' }]),
    row: [input.jobLabel, input.gcName ? `GC ${input.gcName}` : '', input.amountWords ?? '', words].filter(Boolean).join(' · '),
    record: present
      ? `Recorded by ${who}: ${he} was at the desk and said to send it. ${he} can pull it back with “Not what I said” while it has not gone out.`
      : `Recorded by ${who} from ${he}'s word, given ${LIEN_WORD_CHANNEL_WORDS[input.channel].record}. ${he} can pull it back with “Not what I said” while it has not gone out.`,
    paper: 'The notice itself does not change. The owner and the GC never see who approved it or how; the record stays on the desk and in the job’s history.',
  }
}

/** The note the row opens with: `Robert, Sep 24` when the leader is named, else `the leader, Sep 24`. */
export function defaultWordNote(leaderName: string | null | undefined, todayWords: string): string {
  return `${leaderName?.trim() || 'the leader'}, ${todayWords}`
}

/** A notice that reached Ready to send, or went out, without the leader pressing Approve. */
export type LienFyiSend = { jobLabel: string; by: 'word' | 'rule'; gcName?: string | null }

/**
 * The leader's FYI list in the desk's title bar (v2.5028; the owner's call of 2026-10-09). *Sent on your
 * word* names the notices the office sent on his spoken word, and also the ones a GC's standing rule
 * approved and sent ("Send notices without asking"), marked as that GC's rule — so the rule's promise,
 * "you see each send in your FYI list", holds: `Sent on your word: 650 · by Loberg Contracting’s rule: 702, 715`.
 * With no word sends the rule's part leads: `Sent by Loberg Contracting’s rule: 702`. '' when nothing went.
 */
export function lienFyiStrip(sends: readonly LienFyiSend[]): string {
  const word = sends.filter((s) => s.by === 'word').map((s) => s.jobLabel)
  const ruleByGc = new Map<string, string[]>()
  for (const s of sends) {
    if (s.by !== 'rule') continue
    const gc = s.gcName?.trim() || 'the GC'
    ruleByGc.set(gc, [...(ruleByGc.get(gc) ?? []), s.jobLabel])
  }
  const parts: string[] = word.length ? [`Sent on your word: ${word.join(', ')}`] : []
  for (const [gc, labels] of ruleByGc) parts.push(`${parts.length ? 'by' : 'Sent by'} ${gc}’s rule: ${labels.join(', ')}`)
  return parts.join(' · ')
}
