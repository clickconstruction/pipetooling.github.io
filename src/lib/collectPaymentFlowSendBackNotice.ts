/** Modal copy when sending a job from Ready to Bill to Working while a collect payment flow is active. */

export function paragraphForSendBackCollectPaymentFlow(flowStatus: string | null | undefined): string | null {
  let stage: string | null = null
  if (flowStatus === 'draft') {
    stage = 'step 1 of 3 (certify line items)'
  } else if (flowStatus === 'pending_dispatch') {
    stage = 'step 2 of 3 (awaiting dispatch)'
  } else if (flowStatus === 'approved_for_terminal') {
    stage = 'step 3 of 3 (customer pays)'
  } else {
    return null
  }
  return `This will also cancel the field Collect payment flow (currently: ${stage}). If the job was waiting for dispatch approval, it will leave that queue.`
}
