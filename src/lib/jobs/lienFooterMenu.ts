import { canSendLienOnWord, isLienLeader, isLienOffice } from './lienDesk'
import { lienLeaderPressWords, type LienLeaderPaper } from './lienLeaderPress'

/**
 * One press per draft footer (v2.7324). Pure.
 *
 * The owner's call of 2026-11-15: the leader always signs a notice with his typed name and always wet-signs an
 * affidavit before a notary, so the draw pad, the signing code, the pen record and the word record are exceptions.
 * Each draft footer is one primary press — the leader's own okay, or the office's ask — with the rare doors behind
 * a small menu: the office's *He already okayed it ▾* (his word, the pen), the leader's *Sign another way ▾* on a
 * notice (the pad, his code on someone else's screen). The leader on an affidavit gets nothing extra: he signs it
 * on paper. Blocked, the host draws *Go to gate N ▴* alone and the kernel returns no press and no menu. The leader
 * is named as the presses already name him (`leaderNameFor(master_user_id)` → `lienLeaderPressWords`).
 */

/** How his name reaches the notice: typed on his own sign-in, drawn on the line, or his code on someone else's screen. */
export type LienSignWay = 'type' | 'draw' | 'code'

export type LienFooterMenuRowKey = 'word' | 'pen' | 'sign:type' | 'sign:draw' | 'sign:code'

export type LienFooterMenuRow = {
  key: LienFooterMenuRowKey
  label: string
  /** The tooltip and the row's second line: what the door does. */
  title: string
}

export type LienFooterMenu = {
  key: 'okayed' | 'sign'
  /** The menu's press, with its ▾. */
  label: string
  /** The popover's accessible name. */
  aria: string
  rows: LienFooterMenuRow[]
}

export type LienFooterPrimary = {
  key: 'approve' | 'ask' | 'run'
  label: string
  /** What the press will do, as the state line beside it says. A sentence. */
  line: string
}

export type LienFooterInput = {
  role: string | null | undefined
  paper: LienLeaderPaper
  leaderName: string | null | undefined
  /** A gate blocks the paper: the host draws the way to the gate; no press, no menu. */
  blocked: boolean
  /** Where the office's press sends the paper when the viewer is not the leader: to him, straight into the run under a live send rule, or parked under the hold rule. */
  route?: 'leader' | 'run' | 'hold'
  /** The notice's sign line as it stands (notices only): his way, whose screen, and whether his code can be taken here. */
  sign?: { way: LienSignWay; otherScreen: boolean; codeReady: boolean } | null
  /** The pen record is wired on this footer (a notice with months; never an affidavit). */
  pen?: boolean
}

export type LienFooter = {
  primary: LienFooterPrimary | null
  menus: LienFooterMenu[]
  /** The quiet link left of the presses: Already mailed? Record it… (a notice, for the office). Save draft went in v2.7327: the draft saves itself. */
  links: Array<'by_hand'>
}

export const LIEN_FOOTER_OKAYED_LABEL = 'He already okayed it ▾'
export const LIEN_FOOTER_SIGN_LABEL = 'Sign another way ▾'
export const LIEN_FOOTER_PEN_LABEL = 'He signed the paper…'
export const LIEN_FOOTER_PEN_TITLE = 'He signed the printed paper with a pen. Write down who, when and how you know, and add the signed page. It goes in the run on that record.'
export const LIEN_FOOTER_AFFIDAVIT_LEADER_LINE = 'Ready to file. You sign it on paper before a notary.'

/** The leader's own line on a notice: what reaches the paper when he presses. */
export function lienSignWayLine(way: LienSignWay, otherScreen: boolean, name: string): string {
  if (way === 'code') return `${name}’s code signs it, and it goes in the run.`
  if (way === 'draw') return otherScreen ? `${name} signs on the line, and it goes in the run.` : 'Your signature on the line goes on it, and it goes in the run.'
  return 'Your typed name goes on it, and it goes in the run.'
}

/** The ways he can sign on this screen: his own sign-in types or draws; someone else's screen draws, or takes his code when he has one. */
export function lienSignWays(otherScreen: boolean, codeReady: boolean): LienSignWay[] {
  return otherScreen ? (codeReady ? ['draw', 'code'] : ['draw']) : ['type', 'draw']
}

function signRow(way: LienSignWay, name: string): LienFooterMenuRow {
  if (way === 'draw') return { key: 'sign:draw', label: 'Draw it', title: 'Sign on the line with a finger or the mouse.' }
  if (way === 'code') return { key: 'sign:code', label: `Use ${name}’s signing code`, title: `${name} types his code here, and the app checks it.` }
  return { key: 'sign:type', label: 'Type my name', title: 'Your name goes on the line in the cursive face.' }
}

export function lienFooter(input: LienFooterInput): LienFooter {
  const { role, paper, blocked } = input
  const press = lienLeaderPressWords(input.leaderName, paper)
  const leader = isLienLeader(role)
  const links: LienFooter['links'] = paper === 'notice' && isLienOffice(role) ? ['by_hand'] : []
  if (blocked) return { primary: null, menus: [], links }

  let primary: LienFooterPrimary
  if (leader) {
    const line =
      paper === 'affidavit'
        ? LIEN_FOOTER_AFFIDAVIT_LEADER_LINE
        : paper === 'retainage'
          ? 'Your okay puts it in the run.'
          : lienSignWayLine(input.sign?.way ?? 'type', input.sign?.otherScreen ?? false, press.name)
    primary = { key: 'approve', label: press.approve, line }
  } else if (input.route === 'run') {
    primary = { key: 'run', label: 'Put it in the run ▸', line: 'Straight into the run.' }
  } else if (input.route === 'hold') {
    primary = { key: 'ask', label: press.ask, line: 'Parks under the hold rule.' }
  } else {
    primary = { key: 'ask', label: press.ask, line: `One line on ${press.name}’s phone.` }
  }

  const menus: LienFooterMenu[] = []
  if (canSendLienOnWord(role)) {
    const rows: LienFooterMenuRow[] = [{ key: 'word', label: press.onWord, title: press.onWordTitle }]
    if (paper !== 'affidavit' && input.pen) rows.push({ key: 'pen', label: LIEN_FOOTER_PEN_LABEL, title: LIEN_FOOTER_PEN_TITLE })
    menus.push({ key: 'okayed', label: LIEN_FOOTER_OKAYED_LABEL, aria: 'He already okayed it. Pick how.', rows })
  }
  if (leader && paper === 'notice' && input.sign) {
    const rows = lienSignWays(input.sign.otherScreen, input.sign.codeReady)
      .filter((w) => w !== input.sign!.way)
      .map((w) => signRow(w, press.name))
    if (rows.length) menus.push({ key: 'sign', label: LIEN_FOOTER_SIGN_LABEL, aria: 'Sign another way. Pick how.', rows })
  }
  return { primary, menus, links }
}
