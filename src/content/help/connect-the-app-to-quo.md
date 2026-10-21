---
title: connect the app to Quo
category: Office
roles: dev, master_technician
keywords: phone and texts, quo, quo connection, api key, key, vault, company number, text, call, seats, inboxes
order: 100
---
Quo is the app the company numbers run on. Its key lets this app text, hear calls and list your seats and numbers. Paste the key once in Settings and never open a terminal for it.

Only the owner or a dev sees the card.

## Open the connection

1. Go to [Settings](/settings?tab=settings-phone-texts).
2. Press **Phone and texts**.
3. **Quo connection** is under Who gets a new message.

## Get the key from Quo

1. Open Quo on the web.
2. Open **Workspace settings**, then **API**.
3. Make a key, or copy the one that is there.

Quo shows a key once. Copy it right away.

## Save the key

1. Paste the key into **Quo API key**.
2. Press {{button:blue|Save the key}}.

The app keeps the key in its vault. The card never shows it again. It says the key's last four characters, when it was saved and who saved it.

A key with a space in it is not saved. Paste it again.

## What the card says next

- *Quo answered: 2 numbers and 5 people.* The key works. The two cards under it now pick from Quo's lists.
- *Quo did not give its numbers.* The key was refused or Quo is down. Press **Ask Quo again**, or paste a new key.
- *A key is set on the server by a dev.* The app texts with a key a dev set by hand. Paste it here so Settings holds it.

## Replace the key

Paste the new key and press {{button:blue|Save the key}}. Texts and calls use the new key from then on.

## What the key changes

- [Company phone seats](/help/match-each-company-phone-seat-to-a-person) picks each seat from Quo's members.
- [Inboxes](/help/set-up-the-two-inboxes) picks each number from Quo's numbers.
- Texts go out and calls come in with the key saved here. Until one is saved, the server's own key keeps them going.
