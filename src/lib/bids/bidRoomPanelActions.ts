/**
 * Which buttons the Bid Room staff panel shows, and what they say (journey-map Tier-2 #31).
 *
 * Before this kernel the panel's only first action was "Publish & send room link", which
 * validated the GC email BEFORE minting the room — so a room could not exist without the app
 * sending an email, and Copy link (the link IS the product) was unreachable until then.
 * Estimators who email from their own client had no door. Both live rooms (2026-09-05
 * recount) were minted through that forced-email path.
 *
 * The model now: the link comes first, the email is optional.
 *   - not yet published  → primary "Get the link" (mint + rev 1, nothing emailed); "Send to GC"
 *                          beside it publishes AND emails, and needs an address.
 *   - published          → primary "Publish update" (next revision, nothing emailed);
 *                          "Send to GC" / "Email link again" sends the current link.
 *   - answered           → no publish / send actions; the link stays copyable.
 * Copy link + Open appear as soon as a revision exists — no "ever sent" gate.
 */

export type BidRoomPanelActionsInput = {
  /** An open room row exists for this GC. */
  hasRoom: boolean
  /** The room has at least one revision — its link shows a letter. */
  published: boolean
  /** A `link_sent` event exists (the app emailed the link at least once). */
  everSent: boolean
  /** The email box holds something shaped like an address. */
  hasEmail: boolean
  /** Signed or declined — the room is done. */
  answered: boolean
}

export type BidRoomPrimaryAction = {
  id: 'get_link' | 'publish_update'
  label: string
  title: string
}

export type BidRoomSendAction = {
  /** `publish_and_send` when no revision exists yet; `send_only` once one does. */
  id: 'publish_and_send' | 'send_only'
  label: string
  enabled: boolean
  title: string
}

export type BidRoomPanelActions = {
  /** The one blue button. Null once the room is answered. */
  primary: BidRoomPrimaryAction | null
  /** The email action. Null once the room is answered. */
  send: BidRoomSendAction | null
  /** Copy link + Open — the link exists and shows a letter. */
  showLink: boolean
  /** Close room — an open, unanswered room. */
  closeRoom: boolean
}

export const NEED_EMAIL_TITLE = 'Enter the GC contact email to send from here — or Get the link and paste it into your own email.'

export function bidRoomPanelActions(input: BidRoomPanelActionsInput): BidRoomPanelActions {
  const { hasRoom, published, everSent, hasEmail, answered } = input
  if (answered) {
    return { primary: null, send: null, showLink: published, closeRoom: false }
  }
  if (!published) {
    return {
      primary: {
        id: 'get_link',
        label: 'Get the link',
        title: 'Mint this GC’s room link and pin the current letter as rev 1 — nothing is emailed.',
      },
      send: {
        id: 'publish_and_send',
        label: 'Send to GC',
        enabled: hasEmail,
        title: hasEmail ? 'Publish rev 1 and email the link to the GC.' : NEED_EMAIL_TITLE,
      },
      showLink: false,
      closeRoom: hasRoom,
    }
  }
  return {
    primary: {
      id: 'publish_update',
      label: 'Publish update',
      title: 'Pin the current letter as the next revision — the link stays the same; nothing is emailed.',
    },
    send: {
      id: 'send_only',
      label: everSent ? 'Email link again' : 'Send to GC',
      enabled: hasEmail,
      title: hasEmail
        ? everSent
          ? 'Email the room link again without publishing a new revision.'
          : 'Email the room link to the GC — this also stamps the packet sent, like Mark sent today.'
        : NEED_EMAIL_TITLE,
    },
    showLink: true,
    closeRoom: true,
  }
}

/** Loose address shape — the same test the panel used before; the edge function validates for real. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
