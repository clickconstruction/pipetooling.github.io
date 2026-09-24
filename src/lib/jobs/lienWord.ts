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
  standing_over: { pick: 'he is standing over me', record: 'standing over the desk' },
  typing: { pick: 'he is typing it in', record: 'typed it in himself' },
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

/** The record line: `on the leader’s word · Robert, Sep 24 · standing over the desk`. */
export function wordRecordWords(item: { word_note: string | null; word_channel: string | null } | null | undefined): string {
  const note = item?.word_note?.trim() ?? ''
  const how = isLienWordChannel(item?.word_channel) ? LIEN_WORD_CHANNEL_WORDS[item.word_channel].record : ''
  return ['on the leader’s word', note, how].filter(Boolean).join(' · ')
}

/** The line under the picker once a presence channel is picked — what the record will say and who made it. */
export function presenceLine(channel: string | null | undefined, recorderName: string | null | undefined): string {
  if (!leaderPresent(channel)) return ''
  const who = recorderName?.trim() || 'the office'
  return channel === 'typing'
    ? `Recorded by ${who}: the leader typed this in himself, at this desk. It goes to Ready to send on his word; he can pull it back with “Not what I said”.`
    : `Recorded by ${who}: the leader was standing here and said to send it. It goes to Ready to send on his word; he can pull it back with “Not what I said”.`
}

/** The note the row opens with: `Robert, Sep 24` when the leader is named, else `the leader, Sep 24`. */
export function defaultWordNote(leaderName: string | null | undefined, todayWords: string): string {
  return `${leaderName?.trim() || 'the leader'}, ${todayWords}`
}
