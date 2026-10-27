---
title: turn on drafted field reports
category: Office
roles: dev, master_technician
keywords: model keys, model key, anthropic, api key, vault, draft, drafted report, voice note, talk it through, field report, phone and texts, claude, test the key, workspace, credits, platform.claude.com
order: 101
---
A tech can talk a field report through, and the app drafts the report from the words. The draft needs a model key, which the owner pastes once in Settings.

Only the owner or a dev sees the card.

## Open the card

1. Go to [Settings](/settings?tab=settings-phone-texts#settings-phone-texts-model-keys).
2. Press **Phone and texts**.
3. **Model keys** is under Inboxes.

## Get a key from Anthropic

1. Open platform.claude.com and sign in to the company's account.
2. Open the **API keys** page and press **Create key**. Give it a name you will know.
3. Pick a workspace for the key. A key with no workspace cannot draft here.
4. Copy the key right away. Anthropic shows a key once.

A new account needs credits before a key can draft. Add them on the **Billing** page at platform.claude.com.

## Save the key

1. Paste the key into **Anthropic API key**.
2. Press {{button:blue|Save the key}}.

The app keeps the key in its vault. The card never shows it again. The card says the key's last four characters, when it was saved and who saved it.

A key with a space in it is not saved. Paste it again.

## Test the key

Press {{button:outline|Test the key}}. The app asks Claude one short question with the saved key.

- *The key works. Claude answered in 1.4 seconds.* The report form now drafts.
- *Anthropic refused it.* Anthropic's own reason follows. Most refusals mean the account has no credits, or the key has no workspace.

## What happens next

The report form's {{button:outline-blue|Talk it through}} now drafts the report from what the tech said. The tech reads the draft and presses Save report. Nothing is saved before that press. See [file and review field reports](/help/reports#talk-it-through).

Each draft costs about a cent. The form says what each one cost.

## Take the key away

Press {{button:outline|Forget the key}}. The key leaves the vault. The report form then puts the tech's words into Notes as said, with no draft.
