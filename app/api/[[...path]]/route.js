import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Stripe from 'stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------- Mongo ----------
let clientPromise = null
async function connectToMongo() {
  if (!clientPromise) {
    clientPromise = new MongoClient(process.env.MONGO_URL).connect()
  }
  const client = await clientPromise
  return client.db(process.env.DB_NAME)
}

// ---------- Stripe (lazy) ----------
let stripeInstance = null
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  if (!stripeInstance) stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
  return stripeInstance
}
const AMOUNT_CENTS = 499 // $4.99 CAD — server-side only, never from client
const CURRENCY = 'cad'

// ---------- Supabase Realtime broadcast (notification bus only; MongoDB stays authoritative) ----------
async function broadcastListingsChanged(payload = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ topic: 'listings:map', event: 'listings_changed', payload: { ...payload, changedAt: new Date().toISOString() } }],
      }),
      cache: 'no-store',
    })
    if (!res.ok) console.error('Supabase broadcast failed:', res.status)
    return res.ok
  } catch (e) {
    console.error('Supabase broadcast error:', e.message)
    return false
  }
}

// ---------- Helpers ----------
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}
const json = (data, status = 200) => handleCORS(NextResponse.json(data, { status }))

function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '60d' })
}

async function getAuthUser(request, db) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await db.collection('users').findOne({ id: payload.uid })
    return user || null
  } catch {
    return null
  }
}

function stripHouseNumber(address) {
  if (!address) return ''
  return address.replace(/^\s*\d+[\s,–-]*/, '').trim()
}

// Pin status: manual override wins, otherwise schedule (in the giver's local time)
function computeStatus(l) {
  if (l.manual_override === 'active') return 'green'
  if (l.manual_override === 'done') return 'red'
  const tz = typeof l.tz_offset === 'number' ? l.tz_offset : 240 // minutes behind UTC (JS getTimezoneOffset)
  const local = new Date(Date.now() - tz * 60000)
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes()
  const [sh, sm] = String(l.schedule_start || '17:00').split(':').map(Number)
  const [eh, em] = String(l.schedule_end || '20:00').split(':').map(Number)
  const start = sh * 60 + (sm || 0)
  const end = eh * 60 + (em || 0)
  if (nowMin >= start && nowMin < end) return 'green'
  if (nowMin >= end) return 'red'
  return 'white'
}

function isVisible(l) {
  if (l.hidden) return false
  if (l.paid) return true
  return l.trial_ends_at && new Date(l.trial_ends_at) > new Date()
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180
  const dLat = (lat2 - lat1) * r
  const dLng = (lng2 - lng1) * r
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

// Minute-by-minute simulation of "green" time today (giver local time), honouring override events + schedule
function greenMinutesToday(listing, events) {
  const tz = typeof listing.tz_offset === 'number' ? listing.tz_offset : 240
  const nowLocal = new Date(Date.now() - tz * 60000)
  const minsNow = nowLocal.getUTCHours() * 60 + nowLocal.getUTCMinutes()
  const midnightLocalUtcMs = Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate()) + tz * 60000
  let overrideState = null
  const todays = []
  for (const e of events) {
    const ts = new Date(e.at).getTime()
    if (ts < midnightLocalUtcMs) overrideState = e.override
    else todays.push({ min: Math.floor((ts - midnightLocalUtcMs) / 60000), override: e.override })
  }
  const [sh, sm] = String(listing.schedule_start || '17:00').split(':').map(Number)
  const [eh, em] = String(listing.schedule_end || '20:00').split(':').map(Number)
  const start = sh * 60 + (sm || 0)
  const end = eh * 60 + (em || 0)
  let green = 0
  let ei = 0
  for (let m = 0; m < minsNow; m++) {
    while (ei < todays.length && todays[ei].min <= m) { overrideState = todays[ei].override; ei++ }
    if (overrideState === 'active' || (overrideState === null && m >= start && m < end)) green++
  }
  return green
}

function weatherMeta(code) {
  if (code === 0) return '☀️'
  if ([1, 2, 3].includes(code)) return '⛅'
  if ([45, 48].includes(code)) return '🌫️'
  if ([51, 53, 55, 56, 57].includes(code)) return '🌦️'
  if ([61, 63, 65, 66, 67].includes(code)) return '🌧️'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️'
  if ([80, 81, 82].includes(code)) return '🌦️'
  if ([95, 96, 99].includes(code)) return '⛈️'
  return '🌡️'
}

function toPublic(l) {
  return {
    id: l.id,
    host_name: l.host_name,
    address_display: l.hide_number === false ? l.address : stripHouseNumber(l.address),
    lat: l.lat,
    lng: l.lng,
    status: computeStatus(l),
    photo_url: l.photo_status === 'rejected' ? null : l.photo_url || null,
    candy_note: l.candy_note || '',
    schedule_start: l.schedule_start,
    schedule_end: l.schedule_end,
  }
}

const clean = ({ _id, ...rest }) => rest
const cleanUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, language: u.language })

// ---------- Seed data ----------
const DEMO_PHOTOS = [
  'https://images.unsplash.com/photo-1572978306654-a3835dd40cd4?w=800&q=70',
  'https://images.unsplash.com/photo-1760496154536-ed413efacc77?w=800&q=70',
  'https://images.unsplash.com/photo-1635079661006-20bb3610a77b?w=800&q=70',
]

async function seedDatabase(db) {
  const users = db.collection('users')
  const listings = db.collection('listings')
  const now = new Date()
  const in3days = new Date(now.getTime() + 3 * 24 * 3600 * 1000)

  const ensureUser = async (email, password, name, role) => {
    let u = await users.findOne({ email })
    if (!u) {
      u = { id: uuidv4(), email, password_hash: bcrypt.hashSync(password, 10), name, role, language: 'en', created_at: now }
      await users.insertOne(u)
    }
    return u
  }

  const admin = await ensureUser('admin@boomap.ca', 'BooAdmin2025!', 'BooMap Admin', 'admin')
  const demo = await ensureUser('demo@boomap.ca', 'BooDemo2025!', 'The Tremblay Family', 'giver')

  const seedListings = [
    { key: 'seed-1', user_id: demo.id, host_name: 'The Tremblay Family', address: '4523 Rue Saint-Denis, Montréal, QC', lat: 45.5248, lng: -73.5936, photo_url: DEMO_PHOTOS[0], schedule_start: '17:00', schedule_end: '20:30', manual_override: null, candy_note: 'Full-size chocolate bars!', paid: false, trial_ends_at: in3days },
    { key: 'seed-2', user_id: 'seed-user-2', host_name: 'Maison Citrouille', address: '312 Avenue du Mont-Royal E, Montréal, QC', lat: 45.5231, lng: -73.5817, photo_url: DEMO_PHOTOS[1], schedule_start: '16:00', schedule_end: '21:00', manual_override: 'active', candy_note: 'Bonbons sans allergènes 🍭', paid: true, trial_ends_at: in3days },
    { key: 'seed-3', user_id: 'seed-user-3', host_name: 'The Spooky Smiths', address: '87 Rue Rachel O, Montréal, QC', lat: 45.5275, lng: -73.5872, photo_url: DEMO_PHOTOS[2], schedule_start: '17:30', schedule_end: '20:00', manual_override: null, candy_note: 'Glow sticks + gummies', paid: true, trial_ends_at: in3days },
    { key: 'seed-4', user_id: 'seed-user-4', host_name: 'La famille Gagnon', address: '1201 Rue Marie-Anne E, Montréal, QC', lat: 45.5312, lng: -73.5744, photo_url: null, schedule_start: '18:00', schedule_end: '21:00', manual_override: 'done', candy_note: '', paid: true, trial_ends_at: in3days },
    { key: 'seed-5', user_id: 'seed-user-5', host_name: 'Haunted Duplex', address: '55 Rue Prince-Arthur E, Montréal, QC', lat: 45.5152, lng: -73.5711, photo_url: DEMO_PHOTOS[1], schedule_start: '17:00', schedule_end: '19:30', manual_override: 'active', candy_note: 'Chips & chocolate', paid: true, trial_ends_at: in3days },
  ]

  for (const s of seedListings) {
    const exists = await listings.findOne({ seed_key: s.key })
    if (!exists) {
      await listings.insertOne({
        id: uuidv4(), seed_key: s.key, ...s,
        hide_number: true, tz_offset: 240, photo_status: s.photo_url ? 'approved' : 'none',
        hidden: false, reported_count: 0, created_at: now, updated_at: now,
      })
    }
  }
  return { admin: admin.email, demo: demo.email, listings: seedListings.length }
}

// ---------- Route handler ----------
async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    if ((route === '/' || route === '/root') && method === 'GET') {
      return json({ message: 'BooMap API 🎃', mapbox_configured: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN })
    }

    // ============ AUTH ============
    if (route === '/auth/register' && method === 'POST') {
      const body = await request.json()
      const email = String(body.email || '').toLowerCase().trim()
      const password = String(body.password || '')
      const name = String(body.name || '').trim()
      if (!email || !email.includes('@') || password.length < 6 || !name) {
        return json({ error: 'invalid_input' }, 400)
      }
      const existing = await db.collection('users').findOne({ email })
      if (existing) return json({ error: 'email_taken' }, 409)
      const user = {
        id: uuidv4(), email, password_hash: bcrypt.hashSync(password, 10),
        name, role: 'giver', language: body.language === 'fr' ? 'fr' : 'en', created_at: new Date(),
      }
      await db.collection('users').insertOne(user)
      return json({ token: signToken(user), user: cleanUser(user) })
    }

    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const email = String(body.email || '').toLowerCase().trim()
      const user = await db.collection('users').findOne({ email })
      if (!user || !bcrypt.compareSync(String(body.password || ''), user.password_hash)) {
        return json({ error: 'invalid_credentials' }, 401)
      }
      return json({ token: signToken(user), user: cleanUser(user) })
    }

    if (route === '/auth/me' && method === 'GET') {
      const user = await getAuthUser(request, db)
      if (!user) return json({ error: 'unauthorized' }, 401)
      return json({ user: cleanUser(user) })
    }

    // ============ LISTINGS ============
    if (route === '/listings/public' && method === 'GET') {
      const all = await db.collection('listings').find({}).limit(5000).toArray()
      const visible = all.filter(isVisible).map(toPublic)
      return json({ listings: visible, server_time: new Date().toISOString() })
    }

    if (route === '/listings/mine' && method === 'GET') {
      const user = await getAuthUser(request, db)
      if (!user) return json({ error: 'unauthorized' }, 401)
      const l = await db.collection('listings').findOne({ user_id: user.id })
      if (!l) return json({ listing: null })
      return json({ listing: { ...clean(l), status: computeStatus(l), visible: isVisible(l) } })
    }

    if (route === '/listings' && method === 'POST') {
      const user = await getAuthUser(request, db)
      if (!user) return json({ error: 'unauthorized' }, 401)
      const body = await request.json()
      const lat = Number(body.lat)
      const lng = Number(body.lng)
      if (!body.address || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return json({ error: 'invalid_address' }, 400)
      }
      if (body.photo_url && String(body.photo_url).length > 2_800_000) {
        return json({ error: 'photo_too_large' }, 400)
      }
      const timeRe = /^\d{2}:\d{2}$/
      const schedule_start = timeRe.test(body.schedule_start) ? body.schedule_start : '17:00'
      const schedule_end = timeRe.test(body.schedule_end) ? body.schedule_end : '20:00'

      const existing = await db.collection('listings').findOne({ user_id: user.id })
      const fields = {
        host_name: String(body.host_name || user.name).slice(0, 80),
        address: String(body.address).slice(0, 200),
        lat, lng,
        hide_number: body.hide_number !== false,
        schedule_start, schedule_end,
        candy_note: String(body.candy_note || '').slice(0, 200),
        tz_offset: Number.isFinite(Number(body.tz_offset)) ? Number(body.tz_offset) : 240,
        updated_at: new Date(),
      }
      // Photo handling: new photo goes to pending moderation (shown until rejected)
      if (body.photo_url !== undefined) {
        fields.photo_url = body.photo_url || null
        fields.photo_status = body.photo_url ? (existing && existing.photo_url === body.photo_url ? existing.photo_status : 'pending') : 'none'
      }

      if (existing) {
        await db.collection('listings').updateOne({ id: existing.id }, { $set: fields })
        const updated = await db.collection('listings').findOne({ id: existing.id })
        await broadcastListingsChanged({ listingId: existing.id, change: 'updated' })
        return json({ listing: { ...clean(updated), status: computeStatus(updated), visible: isVisible(updated) } })
      }
      const listing = {
        id: uuidv4(), user_id: user.id, ...fields,
        manual_override: null, paid: false,
        trial_ends_at: new Date(Date.now() + 3 * 24 * 3600 * 1000),
        hidden: false, reported_count: 0, created_at: new Date(),
      }
      await db.collection('listings').insertOne(listing)
      await broadcastListingsChanged({ listingId: listing.id, change: 'created' })
      return json({ listing: { ...clean(listing), status: computeStatus(listing), visible: isVisible(listing) } })
    }

    if (route === '/listings/override' && method === 'PATCH') {
      const user = await getAuthUser(request, db)
      if (!user) return json({ error: 'unauthorized' }, 401)
      const body = await request.json()
      const value = ['active', 'done'].includes(body.override) ? body.override : null
      const l = await db.collection('listings').findOne({ user_id: user.id })
      if (!l) return json({ error: 'no_listing' }, 404)
      await db.collection('listings').updateOne({ id: l.id }, { $set: { manual_override: value, updated_at: new Date() } })
      await db.collection('status_events').insertOne({ id: uuidv4(), listing_id: l.id, override: value, at: new Date() })
      const updated = await db.collection('listings').findOne({ id: l.id })
      await broadcastListingsChanged({ listingId: l.id, change: 'status', status: computeStatus(updated) })
      return json({ listing: { ...clean(updated), status: computeStatus(updated), visible: isVisible(updated) } })
    }

    // ============ GEOCODING (Mapbox proxy) ============
    if (route === '/geocode' && method === 'GET') {
      const q = (new URL(request.url).searchParams.get('q') || '').trim()
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) return json({ error: 'mapbox_token_missing', features: [] }, 503)
      if (q.length < 3 || q.length > 120) return json({ features: [] })
      const p = new URLSearchParams({ q, access_token: token, country: 'ca', autocomplete: 'true', limit: '5', types: 'address,street,postcode,place' })
      const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${p}`, { cache: 'no-store' })
      if (!res.ok) return json({ error: 'geocoding_failed', features: [] }, 502)
      const data = await res.json()
      const features = (data.features || []).map((f) => ({
        id: f.id,
        label: f.properties?.full_address || f.properties?.name || '',
        lng: f.geometry?.coordinates?.[0],
        lat: f.geometry?.coordinates?.[1],
      }))
      return json({ features })
    }

    // ============ WALKING ROUTE (Mapbox Directions proxy) ============
    if (route === '/route' && method === 'GET') {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) return json({ error: 'mapbox_token_missing' }, 503)
      const coordsParam = (new URL(request.url).searchParams.get('coords') || '').trim()
      const pairs = coordsParam.split(';').filter(Boolean)
      if (pairs.length < 2 || pairs.length > 12) return json({ error: 'invalid_coords' }, 400)
      const coords = []
      for (const p of pairs) {
        const [lng, lat] = p.split(',').map(Number)
        if (!isFinite(lng) || !isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          return json({ error: 'invalid_coords' }, 400)
        }
        coords.push(`${lng},${lat}`)
      }
      const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords.join(';')}?geometries=geojson&overview=full&access_token=${token}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return json({ error: 'directions_failed' }, 502)
      const data = await res.json()
      const r = data.routes && data.routes[0]
      if (!r) return json({ error: 'no_route_found' }, 404)
      return json({ geometry: r.geometry, distance_m: Math.round(r.distance), duration_s: Math.round(r.duration) })
    }

    // ============ ROUTE SHARING ============
    if (route === '/routes/share' && method === 'POST') {
      const body = await request.json()
      const ids = Array.isArray(body.house_ids) ? body.house_ids.map(String).slice(0, 12) : []
      if (ids.length < 1) return json({ error: 'no_houses' }, 400)
      const found = await db.collection('listings').find({ id: { $in: ids } }).toArray()
      if (found.length === 0) return json({ error: 'houses_not_found' }, 404)
      const shared = { id: uuidv4().slice(0, 8), house_ids: ids, created_at: new Date() }
      await db.collection('shared_routes').insertOne(shared)
      return json({ id: shared.id })
    }

    if (route === '/routes/shared' && method === 'GET') {
      const id = (new URL(request.url).searchParams.get('id') || '').trim()
      if (!id) return json({ error: 'missing_id' }, 400)
      const shared = await db.collection('shared_routes').findOne({ id })
      if (!shared) return json({ error: 'not_found' }, 404)
      return json({ house_ids: shared.house_ids })
    }

    // ============ STATS TRACKING (anonymous, fire-and-forget) ============
    if (route === '/track' && method === 'POST') {
      const body = await request.json()
      if (body.metric !== 'route_add') return json({ error: 'invalid_metric' }, 400)
      await db.collection('listings').updateOne({ id: String(body.listing_id || '') }, { $inc: { stats_route_adds: 1 } })
      return json({ ok: true })
    }

    // ============ CANDY STATS NIGHT (giver recap) ============
    if (route === '/listings/stats' && method === 'GET') {
      const user = await getAuthUser(request, db)
      if (!user) return json({ error: 'unauthorized' }, 401)
      const l = await db.collection('listings').findOne({ user_id: user.id })
      if (!l) return json({ error: 'no_listing' }, 404)
      const events = await db.collection('status_events').find({ listing_id: l.id }).sort({ at: 1 }).limit(500).toArray()
      const all = await db.collection('listings').find({}).limit(5000).toArray()
      const visible = all.filter(isVisible)
      const greenTotal = visible.filter((x) => computeStatus(x) === 'green').length
      const neighborsGreen = visible.filter(
        (x) => x.id !== l.id && computeStatus(x) === 'green' && haversineKm(l.lat, l.lng, x.lat, x.lng) <= 1.5
      ).length
      return json({
        minutes_live_today: greenMinutesToday(l, events),
        route_adds: l.stats_route_adds || 0,
        neighbors_green_nearby: neighborsGreen,
        green_total: greenTotal,
        reports_open: await db.collection('reports').countDocuments({ listing_id: l.id, status: 'open' }),
      })
    }

    // ============ TRICK-OR-TREAT WEATHER (Open-Meteo primary, met.no fallback — both keyless) ============
    if (route === '/weather' && method === 'GET') {
      const sp = new URL(request.url).searchParams
      const lat = Number(sp.get('lat'))
      const lng = Number(sp.get('lng'))
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return json({ error: 'invalid_coords' }, 400)
      }
      const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`
      const cached = await db.collection('weather_cache').findOne({ key: cacheKey })
      if (cached && Date.now() - new Date(cached.fetched_at).getTime() < 30 * 60000) {
        return json(cached.data)
      }

      let result = null
      // Primary: Open-Meteo (16-day horizon)
      try {
        const p = new URLSearchParams({
          latitude: String(lat), longitude: String(lng),
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code',
          temperature_unit: 'celsius', wind_speed_unit: 'kmh', timezone: 'auto', forecast_days: '16',
        })
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
        const body = await res.json()
        if (res.ok && body?.daily?.time && Array.isArray(body.daily.time)) {
          const daily = body.daily
          const year = Number(daily.time[0].slice(0, 4))
          const halloweenIdx = daily.time.indexOf(`${year}-10-31`)
          const idx = halloweenIdx >= 0 ? halloweenIdx : 0
          const code = Number(daily.weather_code?.[idx])
          result = {
            target_date: daily.time[idx], is_halloween: halloweenIdx >= 0,
            tmax: daily.temperature_2m_max?.[idx], tmin: daily.temperature_2m_min?.[idx],
            precip_prob: daily.precipitation_probability_max?.[idx], wind: daily.wind_speed_10m_max?.[idx],
            emoji: weatherMeta(code), attribution: 'Weather data by Open-Meteo.com',
          }
        }
      } catch (e) { console.error('open-meteo failed:', e.message) }

      // Fallback: MET Norway locationforecast (keyless, needs identifying User-Agent)
      if (!result) {
        try {
          const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`, {
            headers: { 'User-Agent': 'BooMap/1.0 halloween-trick-or-treat-map', Accept: 'application/json' },
            cache: 'no-store',
          })
          const body = await res.json()
          const series = body?.properties?.timeseries
          if (res.ok && Array.isArray(series) && series.length) {
            const year = series[0].time.slice(0, 4)
            const target = series.some((s) => s.time.startsWith(`${year}-10-31`)) ? `${year}-10-31` : series[0].time.slice(0, 10)
            const day = series.filter((s) => s.time.startsWith(target))
            const temps = day.map((s) => s.data?.instant?.details?.air_temperature).filter((v) => typeof v === 'number')
            const winds = day.map((s) => s.data?.instant?.details?.wind_speed).filter((v) => typeof v === 'number')
            const precip = day.reduce((acc, s) => acc + (s.data?.next_6_hours?.details?.precipitation_amount || 0), 0)
            const symbol = day.find((s) => s.data?.next_6_hours?.summary?.symbol_code)?.data?.next_6_hours?.summary?.symbol_code || ''
            const emoji = /thunder/.test(symbol) ? '⛈️' : /snow|sleet/.test(symbol) ? '🌨️' : /rain|shower/.test(symbol) ? '🌧️' : /fog/.test(symbol) ? '🌫️' : /clearsky|fair/.test(symbol) ? '☀️' : '⛅'
            result = {
              target_date: target, is_halloween: target.endsWith('-10-31'),
              tmax: temps.length ? Math.round(Math.max(...temps) * 10) / 10 : null,
              tmin: temps.length ? Math.round(Math.min(...temps) * 10) / 10 : null,
              precip_prob: precip >= 2 ? 80 : precip >= 0.2 ? 50 : 10,
              wind: winds.length ? Math.round(Math.max(...winds) * 3.6) : null,
              emoji, attribution: 'Weather data by MET Norway',
            }
          }
        } catch (e) { console.error('met.no failed:', e.message) }
      }

      if (!result) return json({ error: 'weather_unavailable' }, 502)
      await db.collection('weather_cache').updateOne(
        { key: cacheKey },
        { $set: { key: cacheKey, data: result, fetched_at: new Date() } },
        { upsert: true }
      )
      return json(result)
    }

    // ============ REPORTS ============
    if (route === '/reports' && method === 'POST') {
      const body = await request.json()
      const listing = await db.collection('listings').findOne({ id: String(body.listing_id || '') })
      if (!listing) return json({ error: 'listing_not_found' }, 404)
      const reasons = ['inappropriate', 'wrong_address', 'safety', 'other']
      const report = {
        id: uuidv4(), listing_id: listing.id,
        reason: reasons.includes(body.reason) ? body.reason : 'other',
        comment: String(body.comment || '').slice(0, 500),
        status: 'open', created_at: new Date(),
      }
      await db.collection('reports').insertOne(report)
      await db.collection('listings').updateOne({ id: listing.id }, { $inc: { reported_count: 1 } })
      return json({ ok: true })
    }

    // ============ PAYMENTS (Stripe) ============
    if (route === '/payments/checkout' && method === 'POST') {
      const user = await getAuthUser(request, db)
      if (!user) return json({ error: 'unauthorized' }, 401)
      const stripe = getStripe()
      if (!stripe) return json({ error: 'stripe_not_configured' }, 503)
      const listing = await db.collection('listings').findOne({ user_id: user.id })
      if (!listing) return json({ error: 'no_listing' }, 404)
      if (listing.paid) return json({ error: 'already_paid' }, 400)

      const base = process.env.NEXT_PUBLIC_BASE_URL
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: CURRENCY,
            unit_amount: AMOUNT_CENTS,
            product_data: { 
              name: 'BooMap Seasonal Pass 🎃', 
              description: 'One-time seasonal fee — your house stays on the map all Halloween season.',
              tax_code: 'txcd_10000000'
            },
          },
          quantity: 1,
        }],
        success_url: `${base}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/?payment=cancelled`,
        metadata: { userId: user.id, listingId: listing.id, integration: 'boomap-seasonal-pass' },
        automatic_tax: { enabled: true },
        allow_promotion_codes: true,
      })

      await db.collection('payment_transactions').updateOne(
        { stripe_session_id: session.id },
        {
          $setOnInsert: {
            id: uuidv4(), stripe_session_id: session.id, user_id: user.id, listing_id: listing.id,
            amount_cents: AMOUNT_CENTS, currency: CURRENCY, status: 'pending', created_at: new Date(),
          },
          $set: { updated_at: new Date() },
        },
        { upsert: true }
      )
      return json({ url: session.url, session_id: session.id })
    }

    if (route === '/payments/status' && method === 'GET') {
      const sessionId = new URL(request.url).searchParams.get('session_id')
      if (!sessionId || !/^cs_/.test(sessionId)) return json({ error: 'invalid_session_id' }, 400)
      const tx = await db.collection('payment_transactions').findOne({ stripe_session_id: sessionId })
      if (tx && tx.status === 'paid') return json({ status: 'paid' })
      const stripe = getStripe()
      if (!stripe) return json({ error: 'stripe_not_configured' }, 503)
      // Verify directly with Stripe (server-side, secure) — covers envs without webhook delivery
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.payment_status === 'paid') {
        await db.collection('payment_transactions').updateOne(
          { stripe_session_id: sessionId },
          { $set: { status: 'paid', paid_at: new Date(), updated_at: new Date(), stripe_payment_intent: session.payment_intent || null } },
          { upsert: true }
        )
        const listingId = session.metadata?.listingId || (tx && tx.listing_id)
        if (listingId) {
          await db.collection('listings').updateOne({ id: listingId }, { $set: { paid: true, paid_at: new Date() } })
          await broadcastListingsChanged({ listingId, change: 'paid' })
        }
        return json({ status: 'paid' })
      }
      if (session.status === 'expired') return json({ status: 'expired' })
      return json({ status: 'pending' })
    }

    if (route === '/webhooks/stripe' && method === 'POST') {
      const stripe = getStripe()
      if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return json({ error: 'webhook_not_configured' }, 400)
      const signature = request.headers.get('stripe-signature')
      const rawBody = await request.text()
      let event
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)
      } catch (err) {
        return json({ error: `signature_error` }, 400)
      }
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object
        if (session.payment_status === 'paid') {
          await db.collection('payment_transactions').updateOne(
            { stripe_session_id: session.id },
            { $set: { status: 'paid', paid_at: new Date(), updated_at: new Date() } },
            { upsert: true }
          )
          if (session.metadata?.listingId) {
            await db.collection('listings').updateOne({ id: session.metadata.listingId }, { $set: { paid: true, paid_at: new Date() } })
            await broadcastListingsChanged({ listingId: session.metadata.listingId, change: 'paid' })
          }
        }
      }
      return json({ received: true })
    }

    // ============ ADMIN ============
    if (route === '/admin/overview' && method === 'GET') {
      const user = await getAuthUser(request, db)
      if (!user || user.role !== 'admin') return json({ error: 'forbidden' }, 403)
      const listings = (await db.collection('listings').find({}).limit(2000).toArray()).map((l) => ({
        ...clean(l), status: computeStatus(l), visible: isVisible(l),
      }))
      const reports = (await db.collection('reports').find({ status: 'open' }).limit(500).toArray()).map(clean)
      return json({ listings, reports })
    }

    if (route === '/admin/listings' && method === 'PATCH') {
      const user = await getAuthUser(request, db)
      if (!user || user.role !== 'admin') return json({ error: 'forbidden' }, 403)
      const body = await request.json()
      const l = await db.collection('listings').findOne({ id: String(body.listing_id || '') })
      if (!l) return json({ error: 'not_found' }, 404)
      const set = {}
      if (body.action === 'approve_photo') set.photo_status = 'approved'
      else if (body.action === 'reject_photo') set.photo_status = 'rejected'
      else if (body.action === 'hide') set.hidden = true
      else if (body.action === 'unhide') set.hidden = false
      else return json({ error: 'invalid_action' }, 400)
      await db.collection('listings').updateOne({ id: l.id }, { $set: { ...set, updated_at: new Date() } })
      await broadcastListingsChanged({ listingId: l.id, change: 'moderation' })
      return json({ ok: true })
    }

    if (route === '/admin/reports' && method === 'PATCH') {
      const user = await getAuthUser(request, db)
      if (!user || user.role !== 'admin') return json({ error: 'forbidden' }, 403)
      const body = await request.json()
      const status = ['resolved', 'dismissed'].includes(body.status) ? body.status : null
      if (!status) return json({ error: 'invalid_status' }, 400)
      await db.collection('reports').updateOne({ id: String(body.report_id || '') }, { $set: { status, updated_at: new Date() } })
      return json({ ok: true })
    }

    // ============ SEED ============
    // Protégé en prod : définir SEED_SECRET et l'envoyer en header x-seed-secret.
    // Sans SEED_SECRET (dev local), l'endpoint reste ouvert.
    if (route === '/seed' && method === 'POST') {
      const seedSecret = process.env.SEED_SECRET
      if (seedSecret && request.headers.get('x-seed-secret') !== seedSecret) {
        return json({ error: 'forbidden' }, 403)
      }
      const result = await seedDatabase(db)
      return json({ ok: true, ...result })
    }

    return json({ error: `Route ${route} not found` }, 404)
  } catch (error) {
    console.error('API Error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}
export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
