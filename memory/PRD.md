# BooMap — PRD & Build Log

## Product
Mobile-first real-time Halloween trick-or-treating map.
- Roles: Candy Givers (accounts, paid) and Trick-or-Treaters (free, anonymous browsing).
- Pins: white = registered/not started, green = giving now, red = done. Auto by schedule + manual override.
- Monetization: 3-day free trial per listing, then one-time $4.99 CAD Seasonal Pass via Stripe.
- Privacy: street numbers hidden by default, photo moderation, report listings, no GPS tracking of browsers.
- Bilingual EN/FR from day one (lib/i18n.js).

## Stack decisions (user confirmed)
- Maps + geocoding: Mapbox (token PENDING from user — graceful fallback implemented)
- Realtime: Supabase chosen by user (credentials PENDING) — interim: 10s polling with map source setData
- Payments: Stripe TEST keys provided and wired
- DB: MongoDB (env MONGO_URL) — Supabase migration to discuss when creds arrive

## Key endpoints (all /api)
auth/register, auth/login, auth/me, listings (POST upsert), listings/mine, listings/public,
listings/override (PATCH), geocode (GET ?q=), reports (POST), payments/checkout, payments/status,
webhooks/stripe, admin/overview, admin/listings (PATCH), admin/reports (PATCH), seed (POST)

## Status computation
manual_override wins; else schedule HH:MM compared in giver local time via tz_offset (minutes, JS getTimezoneOffset convention). Visibility: !hidden && (paid || trial active).

## Files
- /app/app/api/[[...path]]/route.js — full backend
- /app/app/page.js — SPA (map / auth / dashboard / admin views)
- /app/components/BooMap.js — mapbox-gl clustered map with fallback
- /app/lib/i18n.js — EN/FR strings
