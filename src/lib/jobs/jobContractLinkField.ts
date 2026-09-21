/**
 * The contract field on a job (Contract sweep refresh — to-dos/contract-sweep-refresh).
 *
 * Some customers already have a contract with us, kept in Google Drive. When a job has nothing
 * on file, its Customer Contract row shows a field for that link; filing it is the ordinary
 * paper-record write (`fileSignedJobContract`), so the job reads "✍ On file · Google Doc"
 * everywhere the contract record is read — the sweep, the chips, Bill Customer. The link lives
 * on the contract record, not in a second column on the job that could fall out of step. Pure.
 */
import { isHttpUrl } from './jobContractDocument'

export type ContractLinkFieldState = {
  /** The field is offered while no agreement is signed or out for signature. */
  show: boolean
  canFile: boolean
  /** Something was typed that is not a link. */
  invalid: boolean
  /** Why it cannot be filed yet, or null. */
  hint: string | null
}

export function contractLinkFieldState(input: { coverageKind: string; link: string; signerName: string }): ContractLinkFieldState {
  const show = input.coverageKind === 'none' || input.coverageKind === 'draft'
  const typed = input.link.trim()
  const isLink = isHttpUrl(typed)
  const invalid = typed.length > 0 && !isLink
  const hasSigner = input.signerName.trim().length > 0
  const hint = !typed ? null : invalid ? 'That is not a link yet — in Drive, Share → Copy link, then paste it here.' : !hasSigner ? 'Put a customer on the job first — the contract is filed as signed by them.' : null
  return { show, canFile: show && isLink && hasSigner, invalid, hint }
}
