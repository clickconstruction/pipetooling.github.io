/**
 * GC mode — design spike, after the real build's PRs 1a and 1b-i: main's job shapes are the spike's whole ones
 * here. Main's `src/lib/gc/types.ts` keeps only the fields main's kernels read; on the spike each of
 * those shapes extends its spike namesake, so a record main's kernels hand back (a company, a project,
 * a trade, a change order, a day's log) keeps every field the prototype's screens read. Main never sees this file.
 */
import type * as Spike from './gcTypes'

/* eslint-disable @typescript-eslint/no-empty-object-type -- each declaration only widens main's shape to the spike's. */
declare module '../gc/types' {
  interface GcState extends Spike.GcState {}
  interface GcProject extends Spike.GcProject {}
  interface DailyLog extends Spike.DailyLog {}
  interface TradePackage extends Spike.TradePackage {}
  interface ScopeItem extends Spike.ScopeItem {}
  interface Invite extends Spike.Invite {}
  interface SubBid extends Spike.SubBid {}
  interface BidAlternate extends Spike.BidAlternate {}
  interface QuoteExclusion extends Spike.QuoteExclusion {}
  interface Sow extends Spike.Sow {}
  interface SovLine extends Spike.SovLine {}
  interface Draw extends Spike.Draw {}
  interface DrawSentBack extends Spike.DrawSentBack {}
  interface ChangeOrder extends Spike.ChangeOrder {}
  interface Partner extends Spike.Partner {}
}
