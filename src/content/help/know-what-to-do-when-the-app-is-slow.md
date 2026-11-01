---
title: know what to do when the app is slow
category: Getting Started
roles: all
keywords: slow, the app is slow right now, could not reach the app, retry, freeze, loading, keep this open, no signal, spinner, blank page, signed out, read at, kept, stamp, faded, the page you see, your day as read at, my schedule, job mode, no blocks scheduled, counts from, quickfill, roller, round
---
A slow morning used to look like a dead app. Now one line at the top of every screen says so.

## The line at the top

The app watches every read it makes. When a read has waited four seconds and nothing has come back, a line appears above the menu. The line reads *The app is slow right now.* in amber. Under it the line reads *It goes the moment a read lands. Nothing to press.* The line goes away on its own as soon as a read comes back.

You do not need to do anything. Leave the page open. Do not reload the page. Do not press the same button again. The app is catching up.

:::example The line on a slow morning

**The app is slow right now.** It goes the moment a read lands. Nothing to press.

:::

## The page you see

The Pipeline keeps the board you last saw on your device. When the app is slow, the board you see is the one you last read. A chip beside *Updating jobs…* says how old it is, like *board from 6 h ago*. The line at the top adds *The page you see was read at 7:52 AM.*

Money on a kept board reads faded. A press on a kept row waits until the live board lands. You can still read the board. You can still open the search and add a job.

When the live read fails, the board stays. A line under the chip says the refresh did not land.

## Your day on the phone

My Schedule and the Job Mode card keep the day they last read on your phone. On a slow morning the day draws at once. A line above it reads *Your day as read at 7:52 AM · reading again…*. The time is when your phone last read the day. The line goes when the live read lands.

:::example A slow morning on My Schedule

**Your day as read at 7:52 AM · reading again…**

**Today** Thu, Oct 29

Ridgeway Builders · 8:00 AM to 12:00 PM

Pruett & Vance · 1:00 PM to 4:00 PM

:::

The presses that write on the day wait until the live read lands. {{button:outline|Update % done}}, {{button:outline|Leave Report}} and the pencil sit faded. On the Job Mode card the whole press bar waits. {{button:outline-blue|+ Add job}}, the calendar and {{button:green|Clock In}} stay live.

When the live read fails, the day stays. The line reads *Your day as read at 7:52 AM · could not read again · Retry*. Press {{button:outline|Retry}} to read the day again. With nothing kept, My Schedule names what went wrong instead of an empty day. It never says *Nothing scheduled today* when the read failed.

Each day is kept under its own date. Yesterday's day is never shown as today's.

## The office's round

Quickfill's Roller and the phone's round keep the deck you last read on your device. On a slow morning the round draws at once. A line above it reads *Counts from 7:52 AM · counting again…*. Each station's count and Next line are from that read. {{button:green|Done}} and {{button:blue|Worked it}} wait until the live count lands. {{button:outline|Skip}} and {{button:outline|Not sure what to do}} stay live. Read [run the office day with Quickfill](/help/quickfill#when-the-app-is-slow) for the whole of it.

## Could not reach the app

When the app gets no answer at all, the line turns red. The line reads *Could not reach the app.* and offers {{button:outline|Retry}}. Under it the line reads *Check your signal, then press Retry to open the page again.* Check your signal first. Then press Retry. Retry opens the page again.

## No signal

When your phone has no signal, the line reads *No signal.* in grey. Under it the line reads *Clock presses, notes and reports wait on the phone and go out when the signal is back.* Nothing is wrong with the app. The line goes when the signal is back.

A clock press, a job note or a field report you make with no signal waits on the phone. The line counts it, like *No signal. 2 waiting to send ›*. Read [keep working when the signal drops](/help/keep-working-when-the-signal-drops) for what waits and what does not.

## When the app is opening

Opening the app during a slow spell used to end on the sign-in page. Now the loading screen reads *The app is slow right now. Keep this open.* Keep the tab open. The app signs you in as soon as it answers. You are not signed out.

## For a dev

A dev whose screen has been slow for a minute reads one more line. The line is *Run /db-freeze before anyone restarts.*

Follow the runbook before anyone restarts the database. A restart destroys the evidence of a lock pileup.
