import { leaderFirstName } from './lienWord'

/**
 * The words on a draft footer's approval presses, and the line beside them (v2.7308). Pure.
 *
 * Three presses put a paper past the office: the leader's own okay, the office writing down that the leader already
 * said so, and the office sending it to him. Until v2.7308 they read *Approve ▸*, *The leader said to file it ▸* and
 * *Send for approval ▸*, and the owner, who holds both roles under the dev sign-in, could not tell the first two apart.
 * The owner's call of 2026-11-15: each press says whose okay it is, and the leader is named as the app has him on the
 * job (`master_user_id` → `leaderNameFor`, the same name the word record and the signing code use), never typed here.
 * With no master on the job the words fall back to *the leader*.
 */

export type LienLeaderPaper = 'affidavit' | 'notice' | 'retainage'

export type LienLeaderPressWords = {
  /** The leader's first name as the app has him on the job, else 'the leader'. */
  name: string
  /** The office's amber press: the leader already said so, and a note follows. */
  onWord: string
  onWordTitle: string
  onWordLine: string
  /** The leader's own green press. An affidavit is signed before a notary, so the press is the okay alone; a notice carries his name. */
  approve: string
  approveLine: string
  /** The office's blue press: the paper goes to him. */
  ask: string
  askLine: string
}

export function lienLeaderPressWords(leaderName: string | null | undefined, paper: LienLeaderPaper): LienLeaderPressWords {
  const first = leaderFirstName(leaderName)
  const name = first || 'the leader'
  const cap = first || 'The leader'
  const verb = paper === 'affidavit' ? 'file' : 'send'
  const lands = paper === 'affidavit' ? 'Ready to file' : 'the run'
  return {
    name,
    onWord: `${cap} said to ${verb} it…`,
    onWordTitle: `${cap} already said to ${verb} it. Write down who, when and how, and it goes in ${lands} on that word.`,
    onWordLine: `Write down what ${name} said. It goes in ${lands} on that word.`,
    approve: paper === 'affidavit' ? 'I approve it ▸' : 'Sign and approve ▸',
    approveLine: paper === 'affidavit' ? 'Your okay puts it in Ready to file. The paper is signed before a notary.' : 'Your name goes on the paper, and it goes in the run.',
    ask: `Ask ${name} to approve ▸`,
    askLine: paper === 'affidavit' ? `Goes to ${name}. An affidavit is sworn and filed at the county, and ${name} signs it.` : `Goes to ${name}, then out with the run.`,
  }
}
