---
title: set up Floaty and the ring game
category: Office
roles: dev
keywords: easter egg, floaty, visitor, ring, catch, slingshot, morale, tuning, settings
order: 96
---
Floaty is a small visitor who floats around the screen for people you choose, on screens you choose. He plays near the cursor and flees when chased. Since v2.3282 he can be caught: press on him and he stops, a ring appears somewhere else, and the person slingshots him through it. Everything about the visit is a slider, and changes apply instantly — no deploy.

## Where the card lives

Gear menu → Settings → **Email templates & testing** → **Easter eggs**. One card per visitor (today: Floaty).

:::example Easter eggs → Floaty
**Floaty** &nbsp; daily debut + 1-in-15 · plays 7s · flees 0.70× · catch & ring: 1 shot, holds 20s &nbsp; {{chip:green|Enabled}}

Who &nbsp; {{chip:blue|Wendi ×}} {{button:outline|+ add person}} &nbsp;&nbsp; Where &nbsp; {{chip:blue|Bids · Followup · By builder ×}} {{button:outline|+ add screens}} &nbsp; {{button:outline|Tuning…}} {{button:gray|Preview here now}}
:::

- **Enabled** turns the visitor on or off for everyone listed.
- **Who** is the list of people he visits. Nobody else ever sees him.
- **Where** is the list of screens. The picker lists every screen in the app; Bids opens down to its tabs. A screen a listed person can't reach shows a quiet "hidden for …" note — harmless to leave checked.
- {{button:gray|Preview here now}} plays a visit on the screen you're on, with the sliders as they currently sit, skipping the dice roll. Use it to feel a change before anyone else does.

## What the person sees

1. On the first open of a targeted screen each day he visits for sure; later opens roll the dice.
2. He drifts in from the side and plays near the cursor, fleeing if chased. Left alone, he leaves after the play time.
3. **Press on him** and he's caught: he stops, and a floating ring appears somewhere else on the screen.
4. **Drag him back** like a slingshot. A rubber band and a dotted arc show the flight path. Let go to shoot. (A plain click just holds him.)
5. Through the middle of the ring counts — over the top or up from underneath. His body only collides with the ring's two ends: an almost-in shot rattles back out toward the person; a wide miss sails past.
6. A swish pulses the ring green and he drops through. A miss brings him back for another shot until the shots run out. If nobody shoots, he wriggles free after the hold time.

He never blocks a click: the sprite only takes the mouse while he's catchable, and he never appears for anyone with reduced motion turned on.

## Tuning

{{button:outline|Tuning…}} opens the sliders. Drag to try a value; it saves when you let go. {{button:outline|Reset to defaults}} puts everything back.

:::example The visit
| Slider | What it does | Default |
|---|---|---|
| Appears 1 in | After the daily debut, each targeted-screen open appears 1-in-N (1 = every open) | 15 |
| Plays for | Seconds he plays before drifting off | 7s |
| Flee speed | How hard he runs from the cursor at the start of the day — lower is easier to catch | 0.70× |
| Faster through the day | How much faster he is by 6pm than at 6am, rising steadily; every new day he starts slow again ("steady" turns it off) | +0.30× by 6pm |
:::

:::example Catch & ring
| Slider | What it does | Default |
|---|---|---|
| Catch & ring on | Off means the original visit only: he can't be clicked | on |
| Holds after catch | Seconds he waits to be shot before wriggling free | 20s |
| Shots per catch | Misses bring him back until these run out | 1 |
| Sling power | How fast a full pull sends him | 9.0 |
| Gravity | How hard the arc bends | 1500 |
| Aim preview | How much of the flight path the dotted arc shows — shorter is riskier | 0.8s |
| Ring width | The gap between the two ends he can bounce off | 1.00× |
:::

A good pairing to start with: **Flee speed** down if nobody can catch him in the morning, **Faster through the day** up so the afternoon is a real chase, **Aim preview** down once they can make shots easily.
