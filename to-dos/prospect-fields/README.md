---
name: "Prospect fields: who we are talking to"
number: 117
group: close
status: built 2026-10-17 in five PRs, stacked (v2.5600 #5806 the columns, v2.5601 #5807 the person block, v2.5603 #5808 the three seeds, v2.5604 #5809 the Maps paste, v2.5606 #5813 May we text?); migration 20261017010000 pushed, quo-send and four more importers of the kernel copy redeployed, and the walk on prod passed 9 of 9 the same day
summary: >
  Every prospect is a person we call, sometimes at a company. New Prospect and Edit prospect ask
  for the person first, their title, cell, email, language and whether we may text them, and the
  company under them; a homeowner on Jobs to GC leaves the company empty and lands as a Residential
  customer with nothing retyped. A sub is pasted from Google Maps, keeps their license and profile,
  and the same place is a double. Add customer, Add a company and New project read one seed, so
  the record is whole from day one: their name on the bill, texts on their cell, the portal in
  their language. Messages texts a prospect only after they said yes on the call.
next: Use it for a week and answer the six calls at the mock-up's foot. The reply box saying before the send that a prospect has not been asked is the one residual.
size: S · M · M · S · S
blocker: none; the owner's call on texting consent is built as drawn (ask on the call) and is one constant away from "a number they gave us counts as yes".
opinion: shipped as drawn in B; the shape is the person first and the company under them, and nothing changed the lanes or the deck's machine.
mockup: to-dos/prospect-fields/mockup.html
---

# Prospect fields: who we are talking to

## The ask

Grace, 2026-10-17: "when it is an owner it is not always a company it is sometimes a person, and
when it is a sub they'll usually have a google maps business profile, how could we refine the
prospects fields to better accommodate this and other things you might help me think up now?"
Then: make a mock-up, and ask whether it is the best we can do, holistic, and thinking about the
customer. Then: "build it".

## The decision

**Every prospect is a person we call, sometimes at a company.** The form's first block is the
person (name, title, cell, email, language, May we text?); the company block is under it and may
be empty, which makes the person the record (`is_person`). The row keeps `company_name` as the
title for every reader, so the deck, the list, the doubles and the ZZ rule read as before.

**Paste first, type second.** A sub's Google profile is pasted as Share copies it; the company
block fills itself, the source reads Google Maps, and the link is the fourth double key.

**One seed for the three landings.** Add customer opens Residential for a person on their own and
Commercial for a company, with the person's cell as the phone, their language set, and the person
as the contact person with their title. Add a company carries the cell, the license and the Maps
link. New project takes the person's name when there is no company.

**May we text? is asked on the call.** The chip on the card saves the answer, and `quo-send`
texts a prospect only after the yes, naming who has not been asked.

## Where it stands

| PR | Version | What it did |
|---|---|---|
| #5806 | v2.5600 | The columns: `is_person`, `contact_title`, `contact_phone`, `ok_to_text`, `maps_url`, `license`, `also_reach` on prospects; `maps_url` on the bench; `gc_add_company` reads `mapsUrl`. Migration `20261017010000`. |
| #5807 | v2.5601 | The person block on New Prospect and Edit prospect (`personBlock.ts`, `ProspectPersonForm.tsx`); the card names the person, dials the cell first; language on every kind. |
| #5808 | v2.5603 | The three seeds: `customerDraftFromProspect`, `contactPersonFromProspect` on `markProspectConverted`'s tail, `benchDraftFromProspect` with the license and the Maps link. |
| #5809 | v2.5604 | Paste from Google Maps (`mapsShareText.ts`), the Maps and License boxes, Maps ↗ on the card, the Maps double key. |
| #5813 | v2.5606 | May we text? pressed on the card; `textRefusal` (`textingRule.ts`, copied into the edge kernels) holds a text in `quo-send` until the yes. |

**Not built, on purpose:** a second card row asking person or company (the empty company block says it); the Places read (rating, hours, the sub's point for distance: a paid Google read, the owner's call); photos; a separate home address for a person; the reply box's pre-send warning (it learns on the send, from the refusal's words).

**Grace's calls, as built:** the person first on every kind; May we text? asked on the call, a text refused without the yes; cell and office as two labeled numbers; no Places read; Also reach as one free line; the PR order as above.

## How to verify

1. New Prospect on Jobs to GC: The person we call heads the form, The company under it. Type a name and a cell, leave the company empty, Save. The card's title is the person. Asked us ✓ opens Add customer as Residential.
2. New Prospect on Subs: paste a Google Maps Share block. Company, Address and Google Maps fill in, the source reads Google Maps. Save. The card shows Maps ↗ and the license.
3. Type the same Maps link on a new sub: the double line names Subs and offers Open it.
4. Add to the bench ✓ on that sub: Add a company shows the cell, the license and the Google Maps link.
5. Press the texting chip on a card, pick Yes: the chip reads OK to text. From Messages, a text to a prospect still at Not asked says who has not been asked.
