---
title: leave a note for a teammate who is away
category: Office
roles: dev, master_technician, controller
keywords: away note, away, left, note, countdown, day back, due back, sealed, archived, sign in, bring back, restore, one screen, away section, away row, users, see what they see, preview, their screen, imitate, bell
order: 43
---
A teammate who left can keep their login. While they are away, the app shows them one screen you wrote for them. Nothing else opens. You write the note person by person from their desk.

The screen holds your note and a countdown to the day back. It can show where the office is and a button to call the office. The right side of the window shows exactly what they will see.

## Write the note

1. Open their desk. Open People → Users and press {{button:outline|Archived}}, then their name.
2. On the **Status** row, press {{button:outline|Leave a note…}}.
3. Type your words in **The note**. Keep it to a few lines.
4. Flip the switches you want. Each one changes the preview on the right.
5. Press {{button:blue|Save note}}.

Their sign-in opens to that screen the next time they open the app. The desk's Status row then reads {{chip:blue|Away note on · sign-in opens to it}}.

:::cards

:::card Count down to the day back
Pick the day. The screen shows the days, hours and minutes left, with a bar for how far along they are. On the day it reads *Today's the day.*
:::

:::card Show where we are
The city comes from Settings → Office address. They can press **Use my location** to see how far away they are. Their location stays on their phone.
:::

:::card Call or text button
The office line comes from Settings → Templates → Dispatch phone. The screen gets a call button and a text button.
:::

:::card Tell me when the countdown ends
Off by default. When on, the office gets a Needs you item on the day, with Bring back on it.
:::

:::

:::example The screen they see
"See you soon, Corinne." Then the note, signed The team. Then the countdown. Then "We're in Kingsbury, TX" with Use my location. Then Call the office.
:::

## Where they are listed

Open People → Users. A teammate with a note on lists under **Away**, below the roster and above **Archived**. Each person is one row, drawn like every other row on the page.

The first line names the person and their role. Press the name to open their desk. The same line gives the day they left and the day back, with how far off that day is. One row might read *Left Nov 3 · back Nov 8, 2029, in 3 years*. Hover over the days to see the exact day and the count of days.

A small bell on the line means **Tell me when the countdown ends** is on. A note with no day back reads *no day back set*.

The second line starts with **They read:** and shows the first line of your note. That line ends in **See what they see**.

:::example An Away row
Corinne Vela, Estimator. Left Aug 29 · back Nov 22, in 12 days. They read: "Rest up, Corinne." See what they see.
:::

Press **⋯** at the end of the row for the rest. The menu holds **Open desk**, **Edit the note…** and **Bring back…**. A teammate whose employment never ended gets **Restore** in place of Bring back. Restore asks first, because it takes the note down.

## On the day back

On the day back the row turns amber and reads *back today*. After that day it reads *due back* with the day and how long ago it was. {{button:outline-amber|Bring back…}} leaves the menu and sits on the row, because it is the next press. Archived holds only the people who cannot sign in.

## On a phone

Away is one card, like every other group. Tap a row to open their desk. Swipe the row left for **See what they see**, **Edit the note…** and **Bring back…**. On the day back, Bring back sits under the row.

## See what they see

Press **See what they see** at the end of the note line on their Away row. A window opens on the screen their sign-in opens to. The window draws that screen from the note you saved.

The amber bar at the top says it is a preview. The bar names whose screen it is. You stay signed in as yourself. Nothing is saved.

Press **On the day** to see the screen the countdown ends on. Press **Today** to go back. The buttons on their screen do nothing in the preview. Theirs work.

Press {{button:outline|Close the preview}} when you are done.

The preview leaves three things out. The preview skips the sign-in page where they type their password. The miles never show, because **Use my location** does nothing here. The countdown runs on your clock, and theirs runs on their phone.

## From End employment

You can write the note on their last day. In **End employment**, keep **Archive after** ticked and press {{button:outline|Leave a note…}} in the footer. Save it, then finish the end. Their sign-in opens to the note instead of being banned.

## Change it or take it down

Press {{button:outline|Edit the note…}} on the Status row. On their Away row, the same press is in the **⋯** menu. Change the words or the switches and press {{button:blue|Save note}}. Press {{button:red|Take the note down}} to remove it. The teammate's sign-in closes again until they are brought back.

Bring back takes the note down for you. See [bring back a teammate who left](/help/bring-back-a-teammate).

## What they cannot reach

Their login is sealed. The database refuses every read and write from it except the note. Files, realtime and the edge functions refuse it too. Typing any other address in the app lands back on the note.
