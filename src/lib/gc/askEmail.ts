/**
 * GC mode, the Ask window's emails (the Board's B4-a, switched to the Portal lane's P3 sender, v2.4939): what each
 * new ask sends and what line it leaves. A dev's press emails each company its invitation through `gc-trade-email`
 * (kind `invite`, key `<invite id>:invite`, so a repeat sends nothing); the ask then reads *Invitation emailed.*, or
 * the refusal's office words when it did not go out. A dev sends only with the window's tick on, which starts empty
 * until the owner names an inbox (call 3). Anyone else, or a press without the tick, saves the asks, each noted as not
 * emailed. Pure: the database writes are `askGcCompanies`' (gcIo.ts).
 */
import { partnerById } from './lookups'
import { inviteMessage } from './portal'
import type { PortalLang } from './portalI18n'
import { gcTradeEmailRefusal, inviteEmailLines, type TradeEmailAnswer, type TradeEmailRequest } from './tradeEmail'
import type { GcState, Invite } from './types'

/** The line an ask gets once its invitation went out: a contact with the company, so Follow up counts it. */
export const ASK_EMAILED_NOTE = 'Invitation emailed.'
/** The office's note on an ask saved without its email (no contact with the company yet). */
export const ASK_NOT_SENT_NOTE = 'Asked to quote. The invitation was not emailed.'

/** An ask `gc_invite_companies` just made. */
export interface NewAsk {
  inviteId: string
  companyId: string
}

/** What one ask came to: sent, or not, with the words to say why. */
export interface AskOutcome extends NewAsk {
  sent: boolean
  /** The refusal's office words. Null when sent, or when no send was tried. */
  words: string | null
}

/** The line each ask carries in its story: an email, or the office's note. */
export interface AskLine extends NewAsk {
  how: 'email' | 'note'
  note: string
}

export type InviteEmail = Omit<TradeEmailRequest, 'group'>

/** The invitation email for a new ask, drawn as the window drew it (`inviteMessage`). Null when the trade or company is gone. */
export function inviteEmailRequest(state: GcState, projectId: string, packageId: string, ask: NewAsk, lang: PortalLang): InviteEmail | null {
  const project = state.projects.find((p) => p.id === projectId)
  const pkg = project?.packages.find((k) => k.id === packageId)
  const partner = partnerById(state, ask.companyId)
  if (!project || !pkg || !partner) return null
  const invite: Invite = { id: ask.inviteId, partnerId: ask.companyId, status: 'invited', invitedOn: state.today, bid: null, seenRev: null }
  const m = inviteMessage(project, pkg, invite, partner, lang)
  return { companyId: ask.companyId, kind: 'invite', key: `${ask.inviteId}:invite`, projectId, lang, subject: m.subject, lines: inviteEmailLines(m, lang) }
}

/**
 * Send each new ask's invitation, one at a time, and say what line each ask gets. With no `send` (the reader cannot
 * email yet, or the tick is off), nothing is sent and each ask is noted as not emailed. A repeat (`already`) leaves no
 * second line.
 */
export async function inviteAsks(asks: NewAsk[], send: ((ask: NewAsk) => Promise<TradeEmailAnswer>) | null): Promise<{ outcomes: AskOutcome[]; lines: AskLine[] }> {
  const outcomes: AskOutcome[] = []
  const lines: AskLine[] = []
  for (const ask of asks) {
    if (!send) {
      outcomes.push({ ...ask, sent: false, words: null })
      lines.push({ ...ask, how: 'note', note: ASK_NOT_SENT_NOTE })
      continue
    }
    const answer = await send(ask)
    if (answer.ok) {
      outcomes.push({ ...ask, sent: true, words: null })
      if (!answer.already) lines.push({ ...ask, how: 'email', note: ASK_EMAILED_NOTE })
    } else {
      const words = gcTradeEmailRefusal(answer.key)
      outcomes.push({ ...ask, sent: false, words })
      lines.push({ ...ask, how: 'note', note: words })
    }
  }
  return { outcomes, lines }
}
