/**
 * GC mode — design spike: who at a trade gets what, on the office's side (the owner, 2026-10-05:
 * "build both", on the Portal lane's *who at the company gets what*). The company window's About
 * lists the people the company named and the emails each gets. Follow up's Email goes to whoever
 * gets the kinds it chases: a waiver or a W-9 to the bookkeeper, a quote to the estimator. A text
 * and a call stay with the main contact, the one number we have.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { MailTo } from '../gc/companyPeople'
export { followItemMailGroup, followUpMailTo, mailToGreeting, mailToWhy } from '../gc/companyPeople'

export type { CompanyPerson } from '../gc/companyPeople'
export { companyPeople, mailGroupList, mailGroupName } from '../gc/companyPeople'
