/** Legacy static estimate email helpers; send path uses `estimateCustomerExperience.ts` after v2.234. */

export function estimateEmailSubject(title: string): string {
  return `Estimate: ${title || 'Your estimate'}`
}

export function estimateEmailBody(acceptUrl: string): string {
  return (
    `Please review and accept your estimate.\n\n` +
    `Open this link:\n${acceptUrl}\n\n` +
    `Thank you.`
  )
}
