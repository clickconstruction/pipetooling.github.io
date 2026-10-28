---
title: know what to do when the app is slow
category: Getting Started
roles: all
keywords: slow, the app is slow right now, could not reach the app, retry, freeze, loading, keep this open, no signal, spinner, blank page, signed out, read at, kept, stamp, faded, the page you see
---
A slow morning used to look like a dead app. Now one line at the top of every screen says so.

## The line at the top

The app watches every read it makes. When a read has waited four seconds and nothing has come back, a line appears above the menu. The line reads *The app is slow right now.* in amber. The line goes away on its own as soon as a read comes back.

You do not need to do anything. Leave the page open. Do not reload the page. Do not press the same button again. The app is catching up.

:::example The line on a slow morning

**The app is slow right now.**

:::

## The page you see

The Pipeline keeps the board you last saw on your device. When the app is slow, the board you see is the one you last read. A chip beside *Updating jobs…* says how old it is, like *board from 6 h ago*. The line at the top adds *The page you see was read at 7:52 AM.*

Money on a kept board reads faded. A press on a kept row waits until the live board lands. You can still read the board. You can still open the search and add a job.

When the live read fails, the board stays. A line under the chip says the refresh did not land.

## Could not reach the app

When the app gets no answer at all, the line turns red. The line reads *Could not reach the app.* and offers {{button:outline|Retry}}. Check your signal first. Then press Retry. Retry opens the page again.

## No signal

When your phone has no signal, the line reads *No signal.* in grey. Nothing is wrong with the app. The line goes when the signal is back.

## When the app is opening

Opening the app during a slow spell used to end on the sign-in page. Now the loading screen reads *The app is slow right now. Keep this open.* Keep the tab open. The app signs you in as soon as it answers. You are not signed out.

## For a dev

A dev whose screen has been slow for a minute reads one more line. The line is *Run /db-freeze before anyone restarts.*

Follow the runbook before anyone restarts the database. A restart destroys the evidence of a lock pileup.
