import { fileSignedJobContract } from '../jobs/jobContractFileWrite'
import { clearJobContractNotNeeded, dispatchJobContractChanged, markJobContractNotNeeded } from '../jobs/jobContractNotNeeded'
import { contractFillInIo, type ContractSources } from './fillInContractsIo'
import type { ContractMissingWrites } from './fillInContractsMissing'

/**
 * The contract-missing kind's reads and writes (v2.5844, punch list #176): the same three reads
 * the contract kind makes (live jobs, live contracts, e-signed estimates) and the floor; the
 * writes are the sweep's own two doors, `fileSignedJobContract` with no draft for a paper copy
 * and `markJobContractNotNeeded` for the office's answer, which Undo clears. Each tells the
 * line to re-read (`job-contract-changed`).
 */
export type ContractMissingFillInIo = {
  fetchSources: () => Promise<ContractSources>
  filePaper: (w: Extract<ContractMissingWrites, { choice: 'paper' }>, authUserId: string | null) => Promise<{ uploadError: string | null }>
  markNotNeeded: (w: Extract<ContractMissingWrites, { choice: 'not-needed' }>, authUserId: string | null) => Promise<void>
  undoNotNeeded: (jobId: string) => Promise<void>
}

export const contractMissingFillInIo: ContractMissingFillInIo = {
  fetchSources: () => contractFillInIo.fetchSources(),
  async filePaper(w, authUserId) {
    const { uploadError } = await fileSignedJobContract({
      jobId: w.jobId,
      existingDraft: null,
      basePayload: null,
      signerName: w.signerName,
      signedOn: w.signedOn,
      link: w.link,
      file: w.file,
      authUserId,
    })
    dispatchJobContractChanged()
    return { uploadError }
  },
  async markNotNeeded(w, authUserId) {
    await markJobContractNotNeeded(w.jobId, w.reason, authUserId)
    dispatchJobContractChanged()
  },
  async undoNotNeeded(jobId) {
    await clearJobContractNotNeeded(jobId)
    dispatchJobContractChanged()
  },
}
