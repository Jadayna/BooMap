'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { getT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { MapPin, Ghost, Globe, LogOut, Clock, Navigation, Flag, ShieldCheck, Camera, X, Candy, Sparkles, CreditCard } from 'lucide-react'

const BooMap = dynamic(() => import('@/components/BooMap'), { ssr: false })

const HERO_IMG = 'https://images.unsplash.com/photo-1573306522240-15658094d2e1?w=1400&q=70'

// ---------- helpers ----------
const kmBetween = (a, b) => {
  if (!a || !b) return null
  const r = Math.PI / 180
  const dLat = (b[1] - a[1]) * r
  const dLon = (b[0] - a[0]) * r
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
const fmtDist = (km) => (km == null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`)

const STATUS_STYLE = {
  green: 'bg-green-500/15 text-green-400 border-green-500/40',
  red: 'bg-red-500/15 text-red-400 border-red-500/40',
  white: 'bg-slate-100/10 text-slate-200 border-slate-400/40',
}
const STATUS_DOT = { green: 'bg-green-500', red: 'bg-red-500', white: 'bg-slate-100' }

const StatusBadge = ({ status, t }) => (
  <Badge variant="outline" className={`gap-1.5 ${STATUS_STYLE[status] || STATUS_STYLE.white}`}>
    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status] || STATUS_DOT.white}`} />
    {status === 'green' ? t('statusGreen') : status === 'red' ? t('statusRed') : t('statusWhite')}
  </Badge>
)

// ---------- Header ----------
const Header = ({ t, lang, setLang, user, setView, onLogout }) => (
  <header className="sticky top-0 z-40 border-b border-purple-900/50 bg-[#160f23]/90 backdrop-blur">
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
      <button onClick={() => setView('map')} className="flex items-center gap-2" data-testid="logo-btn">
        <span className="text-2xl">🎃</span>
        <span className="text-2xl text-orange-400" style={{ fontFamily: 'Creepster, cursive', letterSpacing: '1px' }}>
          {t('appName')}
        </span>
      </button>
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" className="text-purple-200 hover:bg-purple-900/40 hover:text-orange-300" onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} data-testid="lang-toggle">
          <Globe className="mr-1 h-4 w-4" />
          {lang === 'en' ? 'FR' : 'EN'}
        </Button>
        {user ? (
          <>
            <Button variant="ghost" size="sm" className="text-purple-200 hover:bg-purple-900/40 hover:text-orange-300" onClick={() => setView(user.role === 'admin' ? 'admin' : 'dashboard')} data-testid="dashboard-btn">
              {user.role === 'admin' ? <ShieldCheck className="mr-1 h-4 w-4" /> : <Ghost className="mr-1 h-4 w-4" />}
              <span className="hidden sm:inline">{user.role === 'admin' ? t('admin') : t('dashboard')}</span>
            </Button>
            <Button variant="ghost" size="icon" className="text-purple-200 hover:bg-purple-900/40 hover:text-orange-300" onClick={onLogout} data-testid="logout-btn">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-500" onClick={() => setView('auth')} data-testid="im-giving-btn">
            <Candy className="mr-1 h-4 w-4" />
            {t('imGiving')}
          </Button>
        )}
      </div>
    </div>
  </header>
)

// ---------- Report dialog ----------
const ReportDialog = ({ t, listingId, open, onClose }) => {
  const [reason, setReason] = useState('inappropriate')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const reasons = [
    ['inappropriate', t('reasonInappropriate')],
    ['wrong_address', t('reasonWrongAddress')],
    ['safety', t('reasonSafety')],
    ['other', t('reasonOther')],
  ]
  const submit = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listingId, reason, comment }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('reportThanks'))
      onClose()
    } catch {
      toast.error(t('errGeneric'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-purple-900 bg-[#1e1530] text-orange-50">
        <DialogHeader>
          <DialogTitle className="text-orange-300">{t('reportTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label className="text-purple-200">{t('reportReason')}</Label>
          <div className="grid grid-cols-1 gap-2">
            {reasons.map(([value, label]) => (
              <button key={value} onClick={() => setReason(value)} data-testid={`report-reason-${value}`}
                className={`rounded-md border px-3 py-2 text-left text-sm transition ${reason === value ? 'border-orange-500 bg-orange-500/15 text-orange-200' : 'border-purple-800 bg-purple-950/40 text-purple-200 hover:border-purple-600'}`}>
                {label}
              </button>
            ))}
          </div>
          <Label className="text-purple-200">{t('reportComment')}</Label>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} className="border-purple-800 bg-purple-950/40 text-orange-50" data-testid="report-comment" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} className="text-purple-300">{t('cancel')}</Button>
            <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-500" data-testid="report-submit">
              <Flag className="mr-1 h-4 w-4" />{t('reportSubmit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- House card ----------
const HouseCard = ({ house, t, distance, onReport, highlight }) => (
  <Card className={`overflow-hidden border-purple-900/60 bg-[#1e1530] ${highlight ? 'ring-2 ring-orange-500' : ''}`} data-testid={`house-card-${house.id}`}>
    <CardContent className="p-0">
      <div className="flex gap-3">
        {house.photo_url ? (
          <img src={house.photo_url} alt="" className="h-24 w-24 shrink-0 object-cover" />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-purple-950/60 text-3xl">🏚️</div>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pr-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold text-orange-100">{house.host_name}</p>
            <StatusBadge status={house.status} t={t} />
          </div>
          <p className="flex items-center gap-1 truncate text-xs text-purple-300">
            <MapPin className="h-3 w-3 shrink-0" />{house.address_display}
            {distance && <span className="ml-1 whitespace-nowrap text-orange-400">· {distance} {t('away')}</span>}
          </p>
          <p className="flex items-center gap-1 text-xs text-purple-300">
            <Clock className="h-3 w-3" />{house.schedule_start}–{house.schedule_end}
            {house.candy_note && <span className="truncate text-purple-400">· 🍬 {house.candy_note}</span>}
          </p>
          <button onClick={() => onReport(house.id)} className="self-start text-[11px] text-purple-500 underline-offset-2 hover:text-red-400 hover:underline" data-testid={`report-btn-${house.id}`}>
            <Flag className="mr-0.5 inline h-3 w-3" />{t('report')}
          </button>
        </div>
      </div>
    </CardContent>
  </Card>
)

// ---------- Map view ----------
const MapView = ({ t, houses, setView, user }) => {
  const [filter, setFilter] = useState('all')
  const [userPoint, setUserPoint] = useState(null)
  const [locating, setLocating] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [reportId, setReportId] = useState(null)
  const [heroVisible, setHeroVisible] = useState(true)

  const filtered = useMemo(() => (filter === 'all' ? houses : houses.filter((h) => h.status === filter)), [houses, filter])
  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (userPoint) arr.sort((a, b) => (kmBetween(userPoint, [a.lng, a.lat]) ?? 999) - (kmBetween(userPoint, [b.lng, b.lat]) ?? 999))
    else arr.sort((a, b) => (a.status === 'green' ? -1 : 1) - (b.status === 'green' ? -1 : 1))
    return arr
  }, [filtered, userPoint])

  const locate = () => {
    if (!navigator.geolocation) return toast.error(t('locationDenied'))
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setUserPoint([coords.longitude, coords.latitude]); setLocating(false) },
      () => { toast.error(t('locationDenied')); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    )
  }

  const filters = [
    ['all', t('filterAll')],
    ['green', t('filterGiving')],
    ['white', t('filterSoon')],
    ['red', t('filterDone')],
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
      {heroVisible && (
        <div className="relative overflow-hidden rounded-2xl border border-purple-900/60" data-testid="hero-banner">
          <img src={HERO_IMG} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#160f23]/95 via-[#160f23]/80 to-[#160f23]/40" />
          <button onClick={() => setHeroVisible(false)} className="absolute right-2 top-2 z-10 rounded-full bg-black/40 p-1 text-purple-200 hover:text-white" data-testid="hero-dismiss">
            <X className="h-4 w-4" />
          </button>
          <div className="relative z-[1] space-y-2 p-5 sm:p-7">
            <h1 className="text-2xl text-orange-300 sm:text-3xl" style={{ fontFamily: 'Creepster, cursive' }}>{t('heroTitle')}</h1>
            <p className="max-w-md text-sm text-purple-100">{t('heroSubtitle')}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-500" onClick={locate} data-testid="hero-find-candy">
                <Navigation className="mr-1 h-4 w-4" />{t('findCandy')}
              </Button>
              <Button size="sm" variant="outline" className="border-purple-500 bg-transparent text-purple-100 hover:bg-purple-900/50" onClick={() => setView(user ? 'dashboard' : 'auth')} data-testid="hero-add-house">
                <Sparkles className="mr-1 h-4 w-4" />{t('addMyHouse')}
              </Button>
            </div>
            <p className="pt-1 text-[11px] text-purple-400">🔒 {t('privacyNote')}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {filters.map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} data-testid={`filter-${value}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${filter === value ? 'border-orange-500 bg-orange-500/20 text-orange-300' : 'border-purple-800 bg-purple-950/40 text-purple-300 hover:border-purple-600'}`}>
            {value !== 'all' && <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />}
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1 text-[11px] text-green-400 sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />{t('updatedLive')}
          </span>
          <Button size="sm" variant="outline" className="border-purple-700 bg-transparent text-purple-200 hover:bg-purple-900/50" onClick={locate} disabled={locating} data-testid="near-me-btn">
            <Navigation className="mr-1 h-3.5 w-3.5" />{locating ? t('locating') : t('nearMe')}
          </Button>
        </div>
      </div>

      <BooMap houses={filtered} userPoint={userPoint} onSelect={setSelectedId} fallbackText={t('mapTokenMissing')} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-purple-300">
        <span className="font-semibold uppercase tracking-wide text-purple-400">{t('legend')}:</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-purple-500 bg-slate-100" />{t('legendWhite')}</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />{t('legendGreen')}</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />{t('legendRed')}</span>
      </div>

      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-orange-200">
          <Ghost className="h-4 w-4" />{t('nearbyHouses')} <span className="text-purple-400">({sorted.length} {t('housesOnMap')})</span>
        </h2>
        {sorted.length === 0 && <p className="rounded-lg border border-purple-900/60 bg-[#1e1530] p-4 text-sm text-purple-300" data-testid="no-houses">{t('noHouses')}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {sorted.map((h) => (
            <HouseCard key={h.id} house={h} t={t} highlight={selectedId === h.id}
              distance={userPoint ? fmtDist(kmBetween(userPoint, [h.lng, h.lat])) : null}
              onReport={setReportId} />
          ))}
        </div>
      </div>

      {reportId && <ReportDialog t={t} listingId={reportId} open={!!reportId} onClose={() => setReportId(null)} />}
    </div>
  )
}

// ---------- Auth view ----------
const AuthView = ({ t, lang, onAuthed }) => {
  const [busy, setBusy] = useState(false)
  const [login, setLogin] = useState({ email: '', password: '' })
  const [reg, setReg] = useState({ name: '', email: '', password: '' })

  const submit = async (path, body, errKey) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      onAuthed(data.token, data.user)
    } catch {
      toast.error(t(errKey))
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'border-purple-800 bg-purple-950/40 text-orange-50 placeholder:text-purple-500'
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <Card className="border-purple-900/60 bg-[#1e1530]">
        <CardContent className="space-y-4 p-6">
          <div className="text-center">
            <span className="text-4xl">👻</span>
            <p className="mt-2 text-sm text-purple-300">{t('authGiverNote')}</p>
          </div>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 bg-purple-950/60">
              <TabsTrigger value="login" data-testid="tab-login">{t('login')}</TabsTrigger>
              <TabsTrigger value="register" data-testid="tab-register">{t('registerTab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label className="text-purple-200">{t('email')}</Label>
                <Input type="email" className={inputCls} value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} data-testid="login-email" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-purple-200">{t('password')}</Label>
                <Input type="password" className={inputCls} value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} data-testid="login-password" />
              </div>
              <Button className="w-full bg-orange-600 hover:bg-orange-500" disabled={busy} onClick={() => submit('login', login, 'errLogin')} data-testid="login-submit">
                {t('login')} 🎃
              </Button>
            </TabsContent>
            <TabsContent value="register" className="space-y-3 pt-3">
              <div className="space-y-1.5">
                <Label className="text-purple-200">{t('hostName')}</Label>
                <Input className={inputCls} value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} data-testid="register-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-purple-200">{t('email')}</Label>
                <Input type="email" className={inputCls} value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} data-testid="register-email" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-purple-200">{t('password')}</Label>
                <Input type="password" className={inputCls} value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} data-testid="register-password" />
              </div>
              <Button className="w-full bg-orange-600 hover:bg-orange-500" disabled={busy} onClick={() => submit('register', { ...reg, language: lang }, 'errRegister')} data-testid="register-submit">
                {t('createAccount')} 🍬
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- Address autocomplete ----------
const AddressAutocomplete = ({ t, value, onChange, onPick, onTokenMissing, inputCls }) => {
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!value || value.trim().length < 3 || !open) { setResults([]); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`, { signal: controller.signal })
        if (res.status === 503) { onTokenMissing(); setResults([]); return }
        const data = await res.json()
        setResults(data.features || [])
      } catch {}
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [value, open]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <Input className={inputCls} value={value} placeholder={t('addressSearch')} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true) }} data-testid="address-input" />
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-purple-700 bg-[#241a35] shadow-xl">
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm text-purple-100 hover:bg-purple-900/60"
                onClick={() => { onPick(f); setOpen(false); setResults([]) }}>
                {f.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------- Dashboard (Candy Giver) ----------
const DashboardView = ({ t, api, paymentSessionId, onPaymentHandled }) => {
  const [listing, setListing] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [manualCoords, setManualCoords] = useState(false)
  const [form, setForm] = useState({
    host_name: '', address: '', lat: '', lng: '', hide_number: true,
    schedule_start: '17:00', schedule_end: '20:00', candy_note: '', photo_url: '',
  })
  const fileRef = useRef(null)
  const inputCls = 'border-purple-800 bg-purple-950/40 text-orange-50 placeholder:text-purple-500'

  const loadMine = useCallback(async () => {
    const data = await api('GET', '/listings/mine')
    if (data && data.listing) {
      setListing(data.listing)
      setForm({
        host_name: data.listing.host_name || '',
        address: data.listing.address || '',
        lat: String(data.listing.lat ?? ''),
        lng: String(data.listing.lng ?? ''),
        hide_number: data.listing.hide_number !== false,
        schedule_start: data.listing.schedule_start || '17:00',
        schedule_end: data.listing.schedule_end || '20:00',
        candy_note: data.listing.candy_note || '',
        photo_url: data.listing.photo_url || '',
      })
    }
    setLoaded(true)
  }, [api])

  useEffect(() => { loadMine() }, [loadMine])

  // Payment result polling (after Stripe redirect)
  useEffect(() => {
    if (!paymentSessionId) return
    let stopped = false
    let tries = 0
    toast.info(t('paymentPending'))
    const poll = async () => {
      if (stopped || tries++ > 40) return
      const data = await api('GET', `/payments/status?session_id=${encodeURIComponent(paymentSessionId)}`)
      if (stopped) return
      if (data && data.status === 'paid') {
        toast.success(t('paymentSuccess'))
        loadMine()
        onPaymentHandled()
        return
      }
      if (data && data.status === 'expired') { onPaymentHandled(); return }
      setTimeout(poll, 2000)
    }
    poll()
    return () => { stopped = true }
  }, [paymentSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true)
    const body = {
      ...form,
      lat: parseFloat(form.lat), lng: parseFloat(form.lng),
      tz_offset: new Date().getTimezoneOffset(),
    }
    const data = await api('POST', '/listings', body)
    setBusy(false)
    if (data && data.listing) {
      setListing(data.listing)
      toast.success(t('saved'))
    } else {
      toast.error(data && data.error === 'photo_too_large' ? t('photoTooLarge') : t('errGeneric'))
    }
  }

  const setOverride = async (value) => {
    const data = await api('PATCH', '/listings/override', { override: value })
    if (data && data.listing) setListing(data.listing)
  }

  const pay = async () => {
    setBusy(true)
    const data = await api('POST', '/payments/checkout')
    setBusy(false)
    if (data && data.url) window.location.assign(data.url)
    else toast.error(t('errGeneric'))
  }

  const onPhotoFile = (e) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error(t('photoTooLarge')); return }
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, photo_url: reader.result }))
    reader.readAsDataURL(file)
  }

  if (!loaded) return <div className="p-10 text-center text-purple-300">🕸️ …</div>

  const trialDaysLeft = listing ? Math.max(0, Math.ceil((new Date(listing.trial_ends_at) - Date.now()) / 86400000)) : 3
  const trialExpired = listing && !listing.paid && new Date(listing.trial_ends_at) < new Date()

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-2xl text-orange-300" style={{ fontFamily: 'Creepster, cursive' }}>{t('myHouseTitle')}</h1>

      {listing && (
        <Card className="border-purple-900/60 bg-[#1e1530]" data-testid="status-card">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-purple-200">{t('statusNow')}</p>
              <StatusBadge status={listing.status} t={t} />
            </div>
            <p className="text-xs text-purple-400">{t('autoModeNote')} ({listing.schedule_start}–{listing.schedule_end})</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button size="sm" onClick={() => setOverride('active')} data-testid="override-active"
                className={listing.manual_override === 'active' ? 'bg-green-600 hover:bg-green-500' : 'bg-green-900/50 text-green-300 hover:bg-green-800/60'}>
                {t('overrideStart')}
              </Button>
              <Button size="sm" onClick={() => setOverride('done')} data-testid="override-done"
                className={listing.manual_override === 'done' ? 'bg-red-600 hover:bg-red-500' : 'bg-red-900/50 text-red-300 hover:bg-red-800/60'}>
                {t('overrideDone')}
              </Button>
              <Button size="sm" onClick={() => setOverride(null)} data-testid="override-auto"
                className={!listing.manual_override ? 'bg-purple-600 hover:bg-purple-500' : 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/60'}>
                {t('overrideAuto')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {listing && (
        <Card className={`border-purple-900/60 bg-[#1e1530] ${trialExpired ? 'ring-1 ring-red-500/60' : ''}`} data-testid="payment-card">
          <CardContent className="space-y-2 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-purple-200">
              <CreditCard className="h-4 w-4" />{t('seasonalPass')}
            </p>
            {listing.paid ? (
              <p className="text-sm font-medium text-green-400" data-testid="pass-active">{t('passActive')}</p>
            ) : (
              <>
                {trialExpired ? (
                  <p className="text-sm text-red-400" data-testid="trial-expired">{t('trialExpiredMsg')}</p>
                ) : (
                  <p className="text-sm text-orange-300" data-testid="trial-days">⏳ {trialDaysLeft} {t('trialDaysLeft')}</p>
                )}
                <p className="text-xs text-purple-400">{t('payNote')}</p>
                <Button onClick={pay} disabled={busy} className="bg-orange-600 hover:bg-orange-500" data-testid="pay-button">
                  🎃 {t('payNow')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-purple-900/60 bg-[#1e1530]">
        <CardContent className="space-y-4 p-5">
          <p className="text-sm font-semibold text-purple-200">{listing ? t('editListing') : t('createListing')}</p>

          <div className="space-y-1.5">
            <Label className="text-purple-200">{t('hostName')}</Label>
            <Input className={inputCls} value={form.host_name} onChange={(e) => setForm({ ...form, host_name: e.target.value })} data-testid="host-name-input" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-purple-200">{t('address')}</Label>
            <AddressAutocomplete t={t} value={form.address} inputCls={inputCls}
              onChange={(v) => setForm({ ...form, address: v })}
              onPick={(f) => setForm({ ...form, address: f.label, lat: String(f.lat), lng: String(f.lng) })}
              onTokenMissing={() => setManualCoords(true)} />
            {manualCoords && (
              <div className="space-y-2 rounded-md border border-orange-500/30 bg-orange-500/5 p-3">
                <p className="text-xs text-orange-300">⚠️ {t('addressManualNote')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-purple-300">{t('latitude')}</Label>
                    <Input className={inputCls} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="45.5231" data-testid="lat-input" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-purple-300">{t('longitude')}</Label>
                    <Input className={inputCls} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="-73.5817" data-testid="lng-input" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-purple-800 bg-purple-950/30 p-3">
            <div>
              <p className="text-sm text-purple-100">🔒 {t('hideNumber')}</p>
              <p className="text-xs text-purple-400">{t('hideNumberDesc')}</p>
            </div>
            <Switch checked={form.hide_number} onCheckedChange={(v) => setForm({ ...form, hide_number: v })} data-testid="hide-number-switch" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-purple-200">{t('scheduleStart')}</Label>
              <Input type="time" className={inputCls} value={form.schedule_start} onChange={(e) => setForm({ ...form, schedule_start: e.target.value })} data-testid="schedule-start" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-purple-200">{t('scheduleEnd')}</Label>
              <Input type="time" className={inputCls} value={form.schedule_end} onChange={(e) => setForm({ ...form, schedule_end: e.target.value })} data-testid="schedule-end" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-purple-200">{t('candyNoteLabel')}</Label>
            <Input className={inputCls} value={form.candy_note} placeholder={t('candyNotePlaceholder')} onChange={(e) => setForm({ ...form, candy_note: e.target.value })} data-testid="candy-note-input" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-purple-200">{t('photoLabel')}</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
            {form.photo_url ? (
              <div className="flex items-center gap-3">
                <img src={form.photo_url} alt="" className="h-20 w-20 rounded-md object-cover" />
                <Button variant="outline" size="sm" className="border-purple-700 bg-transparent text-purple-200" onClick={() => setForm({ ...form, photo_url: '' })}>
                  <X className="mr-1 h-3 w-3" />{t('removePhoto')}
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="border-purple-700 bg-transparent text-purple-200 hover:bg-purple-900/50" onClick={() => fileRef.current && fileRef.current.click()} data-testid="upload-photo-btn">
                <Camera className="mr-1 h-4 w-4" />{t('uploadPhoto')}
              </Button>
            )}
            <p className="text-xs text-purple-500">{t('photoPendingNote')}</p>
          </div>

          <Button className="w-full bg-orange-600 hover:bg-orange-500" disabled={busy || !form.address || !form.lat || !form.lng} onClick={save} data-testid="save-listing-btn">
            💾 {t('save')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------- Admin view ----------
const AdminView = ({ t, api }) => {
  const [data, setData] = useState({ listings: [], reports: [] })
  const load = useCallback(async () => {
    const d = await api('GET', '/admin/overview')
    if (d && d.listings) setData(d)
  }, [api])
  useEffect(() => { load() }, [load])

  const act = async (listing_id, action) => { await api('PATCH', '/admin/listings', { listing_id, action }); load() }
  const closeReport = async (report_id, status) => { await api('PATCH', '/admin/reports', { report_id, status }); load() }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl text-orange-300" style={{ fontFamily: 'Creepster, cursive' }}>
        <ShieldCheck className="h-6 w-6" />{t('adminTitle')}
      </h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-purple-200">🚩 {t('adminReports')} ({data.reports.length})</h2>
        {data.reports.length === 0 && <p className="rounded-lg border border-purple-900/60 bg-[#1e1530] p-3 text-sm text-purple-400">{t('noReports')}</p>}
        {data.reports.map((r) => {
          const listing = data.listings.find((l) => l.id === r.listing_id)
          return (
            <Card key={r.id} className="border-red-900/50 bg-[#1e1530]" data-testid={`report-${r.id}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="text-orange-100">{listing ? listing.host_name : r.listing_id} — <span className="text-red-400">{r.reason}</span></p>
                  {r.comment && <p className="text-xs text-purple-400">“{r.comment}”</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-purple-700 bg-transparent text-purple-200" onClick={() => closeReport(r.id, 'resolved')}>{t('resolve')}</Button>
                  <Button size="sm" variant="ghost" className="text-purple-400" onClick={() => closeReport(r.id, 'dismissed')}>{t('dismissReport')}</Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-purple-200">🏚️ {t('adminListings')} ({data.listings.length})</h2>
        {data.listings.map((l) => (
          <Card key={l.id} className="border-purple-900/60 bg-[#1e1530]" data-testid={`admin-listing-${l.id}`}>
            <CardContent className="flex flex-wrap items-center gap-3 p-3">
              {l.photo_url ? <img src={l.photo_url} alt="" className="h-14 w-14 rounded object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded bg-purple-950 text-xl">🏚️</div>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-orange-100">{l.host_name}</p>
                <p className="truncate text-xs text-purple-400">{l.address}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <StatusBadge status={l.status} t={t} />
                  {l.hidden && <Badge variant="outline" className="border-red-500/40 text-red-400">{t('hiddenBadge')}</Badge>}
                  {l.paid ? <Badge variant="outline" className="border-green-500/40 text-green-400">{t('paidBadge')}</Badge>
                    : new Date(l.trial_ends_at) > new Date() ? <Badge variant="outline" className="border-orange-500/40 text-orange-400">{t('trialBadge')}</Badge>
                    : <Badge variant="outline" className="border-red-500/40 text-red-400">{t('expiredBadge')}</Badge>}
                  {l.photo_status === 'pending' && <Badge variant="outline" className="border-yellow-500/40 text-yellow-400">{t('photoPending')}</Badge>}
                  {l.photo_status === 'rejected' && <Badge variant="outline" className="border-red-500/40 text-red-400">{t('photoRejected')}</Badge>}
                  {l.reported_count > 0 && <Badge variant="outline" className="border-red-500/40 text-red-400">🚩 {l.reported_count} {t('reportsCount')}</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {l.photo_url && l.photo_status !== 'approved' && (
                  <Button size="sm" variant="outline" className="border-green-700 bg-transparent text-green-300" onClick={() => act(l.id, 'approve_photo')} data-testid={`approve-photo-${l.id}`}>{t('approvePhoto')}</Button>
                )}
                {l.photo_url && l.photo_status !== 'rejected' && (
                  <Button size="sm" variant="outline" className="border-yellow-700 bg-transparent text-yellow-300" onClick={() => act(l.id, 'reject_photo')} data-testid={`reject-photo-${l.id}`}>{t('rejectPhoto')}</Button>
                )}
                {l.hidden ? (
                  <Button size="sm" variant="outline" className="border-purple-700 bg-transparent text-purple-200" onClick={() => act(l.id, 'unhide')}>{t('unhideListing')}</Button>
                ) : (
                  <Button size="sm" variant="outline" className="border-red-700 bg-transparent text-red-300" onClick={() => act(l.id, 'hide')} data-testid={`hide-${l.id}`}>{t('hideListing')}</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}

// ---------- App ----------
const App = () => {
  const [lang, setLangState] = useState('en')
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [view, setView] = useState('map')
  const [houses, setHouses] = useState([])
  const [paymentSessionId, setPaymentSessionId] = useState(null)
  const t = useMemo(() => getT(lang), [lang])

  const setLang = (l) => { setLangState(l); try { localStorage.setItem('boomap_lang', l) } catch {} }

  const api = useCallback(async (method, path, body) => {
    try {
      const res = await fetch(`/api${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      return await res.json()
    } catch {
      return null
    }
  }, [token])

  // Boot: language, token, payment redirect params
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem('boomap_lang')
      if (savedLang === 'fr' || savedLang === 'en') setLangState(savedLang)
      const savedToken = localStorage.getItem('boomap_token')
      if (savedToken) {
        setToken(savedToken)
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d && d.user) {
              setUser(d.user)
              const params = new URLSearchParams(window.location.search)
              if (params.get('payment')) setView(d.user.role === 'admin' ? 'admin' : 'dashboard')
            } else {
              localStorage.removeItem('boomap_token')
              setToken(null)
            }
          })
      }
      const params = new URLSearchParams(window.location.search)
      if (params.get('payment') === 'success' && params.get('session_id')) {
        setPaymentSessionId(params.get('session_id'))
        setView('dashboard')
      } else if (params.get('payment') === 'cancelled') {
        toast.info(getT(savedLang === 'fr' ? 'fr' : 'en')('paymentCancelled'))
        window.history.replaceState({}, '', '/')
      }
    } catch {}
  }, [])

  // Live sync: poll public listings (interim until Supabase Realtime creds are provided)
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch('/api/listings/public', { cache: 'no-store' })
        const data = await res.json()
        if (active && data && data.listings) setHouses(data.listings)
      } catch {}
    }
    load()
    const interval = setInterval(load, 10000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [])

  const onAuthed = (newToken, newUser) => {
    setToken(newToken)
    setUser(newUser)
    try { localStorage.setItem('boomap_token', newToken) } catch {}
    setView(newUser.role === 'admin' ? 'admin' : 'dashboard')
    toast.success(`${t('welcomeBack')} 👻`)
  }

  const onLogout = () => {
    setToken(null)
    setUser(null)
    try { localStorage.removeItem('boomap_token') } catch {}
    setView('map')
  }

  const onPaymentHandled = () => {
    setPaymentSessionId(null)
    try { window.history.replaceState({}, '', '/') } catch {}
  }

  return (
    <div className="min-h-screen bg-[#160f23] text-orange-50">
      <Header t={t} lang={lang} setLang={setLang} user={user} setView={setView} onLogout={onLogout} />
      {view === 'map' && <MapView t={t} houses={houses} setView={setView} user={user} />}
      {view === 'auth' && (user ? <DashboardView t={t} api={api} paymentSessionId={paymentSessionId} onPaymentHandled={onPaymentHandled} /> : <AuthView t={t} lang={lang} onAuthed={onAuthed} />)}
      {view === 'dashboard' && (user ? <DashboardView t={t} api={api} paymentSessionId={paymentSessionId} onPaymentHandled={onPaymentHandled} /> : <AuthView t={t} lang={lang} onAuthed={onAuthed} />)}
      {view === 'admin' && (user && user.role === 'admin' ? <AdminView t={t} api={api} /> : <AuthView t={t} lang={lang} onAuthed={onAuthed} />)}
      <footer className="border-t border-purple-900/50 py-6 text-center text-xs text-purple-500">
        🎃 {t('appName')} · {t('tagline')}
      </footer>
    </div>
  )
}

export default App;
