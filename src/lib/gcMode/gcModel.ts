/**
 * GC mode — design spike (2026-10-02). Nothing here reads or writes the database: the page runs
 * on the fixture below through one reducer, so the office side and the trade's portal can be
 * played against each other. The shapes are drawn the way the tables would be, so the spike
 * doubles as a first schema sketch (a project → plan sets + trade packages → invites → a bid →
 * a statement of work under the master agreement → draws).
 */

// The model is split by area into the files below; this file re-exports all of them so every
// import of './gcModel' keeps working. Add new code to the file for its area, not here.
export * from './gcTypes'
export * from './gcWords'
export * from './gcLookups'
export * from './gcPlans'
export * from './gcStart'
export * from './gcProgress'
export * from './gcBids'
export * from './gcCustomers'
export * from './gcMap'
export * from './gcFollowUp'
export * from './gcBench'
export * from './gcReducer'
export * from './gcFixture'
export * from './gcNewProject'
export * from './gcBuilding'
export * from './gcOwnerBilling'
export * from './gcPortal'
export * from './gcPortalI18n'
export * from './gcBuildingSchedule'
export * from './gcBuildingWords'
export * from './gcPartnerSchedule'
export * from './gcBuildingPay'
export * from './gcLost'
export * from './gcStale'
export * from './gcBuildingPunch'
export * from './gcBuildingLog'
export * from './gcBuildingSubmittals'
export * from './gcBuildingPromises'
export * from './gcOwnerBillingAhead'
export * from './gcBoardGroups'
export * from './gcVetting'
export * from './gcPromises'
export * from './gcOwnerBillingInterest'
export * from './gcTheirSov'
export * from './gcReliability'
