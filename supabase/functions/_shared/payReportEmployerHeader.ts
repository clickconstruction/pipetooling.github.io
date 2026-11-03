/**
 * The employer block at the top of a pay report, and of a signed hours statement (punch list #212, PR 3): the legal
 * name, the EIN and the address. One place to change when the entity does. No imports, so the pay report's HTML in the
 * app (`src/constants/payReportEmployerHeader.ts` re-exports it) and the statement's PDF in the functions read one copy.
 */
export const PAY_REPORT_EMPLOYER_NAME = 'CLICK PLUMBING AND ELECTRICAL'
export const PAY_REPORT_EIN = '33-3002741'
export const PAY_REPORT_ADDRESS = '5501 Balcones Dr A141 Austin, TX 78731'
