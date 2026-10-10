---
title: link our own crew to its Pipeline job
category: Bids & Estimating
roles: dev
keywords: gc mode, our own crew, pipeline job, clock in, clock-ins, percent done, stages, draws, daily log, bill the customer
order: 111
---
A trade our own crew does on a GC job runs on a job in the Pipeline. Link the two, and the GC job reads our crew's work from that Pipeline job.

The Pipeline job gives two things. The job's stages give our crew's percent done. The job's clock-ins give the daily log's count. Only a dev links the job for now.

## Pick the Pipeline job

1. Press {{button:outline|GC}} on the Bids page to open [GC projects](/gc).
2. Press {{button:outline|Draws}} on the card of a job we are building.
3. Find **Our own crew** under the trades. Press {{button:outline|Pick its Pipeline job}}.
4. A job on this GC job shows first, under **Suggested**. Press {{button:outline|Use this job}} beside it.
5. Or type the job's number, name or address. Then press {{button:outline|Use this job}}.

:::example Our own crew on Draws
Plumbing · our own crew {{chip:purple|Pipeline job J 1071}} {{button:outline|Change}}
:::

A billing-only job cannot be picked. Nobody clocks in on it. A job another crew trade already has says so, like **On Electrical already**, and cannot be picked either. So does the job a GC job's general conditions are spent on, as **On general conditions already**. One Pipeline job goes with one crew trade.

## What the GC job reads

- **The stages.** Each of our stages reads the Pipeline stage with the same name, like Rough in. The day it was reported shows beside it.
- **The whole trade.** When one of our stages has no match, the whole trade reads the job's own percent.
- **The bill.** [Bill the customer](/help/bill-the-customer-on-a-gc-job) bills our crew's line from the same percent. The line says where it came from.
- **The daily log.** The count is who clocked in on the job that day. [The daily log](/help/write-the-daily-log-for-a-job-we-are-building#our-own-crew-s-count) shows it, and nobody types over it.

The count is a number only. The GC job never shows who clocked in or for how long.

## Change or unlink it

1. Press {{button:outline|Change}} beside the job on **Our own crew**.
2. Pick another job, or press {{button:outline|Unlink it}}.

Once the job is unlinked, the daily log takes a typed count again.
