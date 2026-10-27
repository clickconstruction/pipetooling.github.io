---
title: read the server's words on a failed save
category: Getting Started
roles: all
keywords: failed to save, error, check constraint, duplicate key, null value, foreign key, value too long, server, what this means
order: 42
---
Sometimes a save fails with the server's own words on the line. Those words name the rule the save broke. This guide says what the common ones ask you to fix.

## What happened

The server checks every save against the database's own rules. When a save breaks one, the server refuses it and says why in its own words. The app shows them after *Failed to* and the name of what you were doing.

## What was saved

Nothing from that save. The form still holds what you typed.

## The words and what to fix

| The words say | What it means | What to do |
|---|---|---|
| *violates check constraint* | A value is outside what the field allows, like an amount of zero. | Fix the value and save again. |
| *duplicate key* | Something with the same name or number is already saved. | Find the one already there and use it. |
| *null value in column* | A field that must have a value is empty. | Fill the empty field and save again. |
| *violates foreign key* | The save points at a record that is gone. | Pick the record again from its list. |
| *permission denied* | Your role may not make this change. | Ask the office or a dev. |
| *value too long* | A field holds more than it allows. | Shorten what you typed. |

## Words the app writes itself

Some refusals are in plain words, like *Write the text first.* Those come from the app's own checks. Do what they say.

## When the words make no sense

Ask the office and read them the words exactly. A dev can tell from them which rule refused the save.
