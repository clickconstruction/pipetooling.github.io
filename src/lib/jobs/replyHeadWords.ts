/**
 * Reply in place (punch list #125, v2.6691): the head over the customer's box when the office answers a line from Job
 * activity, *Replying to Dana's text · 9:05a*. A text is a text and an email an email; a call, a missed call or a
 * voicemail is named by the line's own channel word, since the answer to each is a text.
 */
import type { MessageChannel } from '../messages/thread'

export interface ReplyHeadLine {
  /** The line's clock, as the feed draws it: "9:05a". */
  timeLabel: string
  message: {
    /** Who the thread is with: "Dana". */
    withName: string
    channel: MessageChannel
    /** The feed's small word after the name: "call · 3:12", "missed call", "voicemail". */
    channelWord: string
  }
}

export function replyHeadWords(line: ReplyHeadLine): string {
  const what = line.message.channel === 'email' ? 'email' : line.message.channel === 'text' ? 'text' : line.message.channelWord || 'line'
  return `Replying to ${line.message.withName}’s ${what} · ${line.timeLabel}`
}

/** Which kind answers a line: an email by email, anything else by text. */
export function replyKindFor(channel: MessageChannel): 'text' | 'email' {
  return channel === 'email' ? 'email' : 'text'
}
