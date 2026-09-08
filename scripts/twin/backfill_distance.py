#!/usr/bin/env python3
"""backfill_distance.py — fill blank Distance to Office on bids that have an address (stdlib only).

    python3 scripts/twin/backfill_distance.py            # dry run: list what would be measured
    python3 scripts/twin/backfill_distance.py --apply    # measure and PATCH bids.distance_from_office
    python3 scripts/twin/backfill_distance.py --apply --all   # decided/sent bids too (default: live only)

Uses the same doors the bid form uses (v2.3142 fills on save; this covers bids
saved before that): the `geocode-one` and `driving-distance` edge functions
with a staff (dev-seat) session, measuring from the office anchor in
app_settings (`office_address_v1`, else `map_default_view_v1`). Routed miles
when Google Routes answers, straight-line × 1.3 otherwise (the form's fallback).
A typed distance is never touched — only blanks are filled.
"""
import json
import math
import sys
import urllib.error
import urllib.request

from twinenv import anon_key, supabase_url
from twinrest import jwt_as_dev, rest

ROAD_WINDING = 1.3  # mirrors TRAVEL_ROAD_WINDING_FACTOR in src/lib/jobTravelEstimate.ts
METERS_PER_MILE = 1609.344


def fn(jwt: str, name: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{supabase_url()}/functions/v1/{name}", data=json.dumps(body).encode(),
        headers={"apikey": anon_key(), "Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
    )
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"HTTP {e.code}", "detail": e.read().decode()[:200]}


def haversine_m(a: dict, b: dict) -> float:
    r = 6371000.0
    p1, p2 = math.radians(a["lat"]), math.radians(b["lat"])
    dp, dl = math.radians(b["lat"] - a["lat"]), math.radians(b["lng"] - a["lng"])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def fmt_miles(m: float) -> str:
    v = round(m * 10) / 10
    return str(int(v)) if v == int(v) else f"{v:.1f}"


def office_anchor(jwt: str) -> dict | None:
    rows = rest(jwt, "GET", "app_settings?select=key,value_text&key=in.(office_address_v1,map_default_view_v1)")
    if not isinstance(rows, list):
        return None
    by = {r["key"]: r["value_text"] for r in rows}
    if by.get("office_address_v1"):
        v = json.loads(by["office_address_v1"])
        if v.get("lat") is not None and v.get("lng") is not None:
            return {"lat": float(v["lat"]), "lng": float(v["lng"]), "label": v.get("address") or "office address"}
    if by.get("map_default_view_v1"):
        v = json.loads(by["map_default_view_v1"])
        return {"lat": float(v["centerLat"]), "lng": float(v["centerLng"]), "label": v.get("addressLabel") or "map default view"}
    return None


def main() -> int:
    apply = "--apply" in sys.argv
    everything = "--all" in sys.argv
    jwt = jwt_as_dev()
    anchor = office_anchor(jwt)
    if not anchor:
        sys.exit("no office anchor — set Settings → Templates → Office address first")
    print(f"measuring from: {anchor['label']}")
    q = ("bids?select=id,bid_number,project_name,address,distance_from_office"
         "&adopted_into_bid_id=is.null&address=not.is.null"
         "&or=(distance_from_office.is.null,distance_from_office.eq.)&order=created_at.desc")
    if not everything:
        q += "&bid_date_sent=is.null"
    bids = rest(jwt, "GET", q)
    if not isinstance(bids, list):
        sys.exit(f"bid list failed: {bids}")
    bids = [b for b in bids if str(b.get("address") or "").strip()]
    print(f"{len(bids)} bid(s) with an address and no distance{'' if everything else ' (live only)'}")
    done = 0
    for b in bids:
        addr = str(b["address"]).strip()
        geo = fn(jwt, "geocode-one", {"address": addr})
        if not geo.get("ok"):
            print(f"  b{b['bid_number']:5} {b['project_name'][:34]:34} could not locate: {addr}")
            continue
        dest = {"lat": geo["lat"], "lng": geo["lng"]}
        routed = fn(jwt, "driving-distance", {"origin": {"lat": anchor["lat"], "lng": anchor["lng"]}, "destination": dest})
        if routed.get("ok") and isinstance(routed.get("meters"), (int, float)) and routed["meters"] >= 0:
            miles, src = fmt_miles(routed["meters"] / METERS_PER_MILE), "routed"
        else:
            miles, src = fmt_miles(haversine_m(anchor, dest) * ROAD_WINDING / METERS_PER_MILE), "estimate"
        print(f"  b{b['bid_number']:5} {b['project_name'][:34]:34} {miles:>7} mi  ({src})  {addr[:40]}")
        if apply:
            out = rest(jwt, "PATCH", f"bids?id=eq.{b['id']}", {"distance_from_office": miles})
            if isinstance(out, list) and out:
                done += 1
            else:
                print(f"      update refused: {out}")
    print("Dry run — add --apply" if not apply else f"updated {done} bid(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
