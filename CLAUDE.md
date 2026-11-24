# CLAUDE.md — Kuroshio FM Command Center (demo app)

## 1. What this is
A **client-facing demo web app** for **Kuroshio AI**, shown to facility management (FM) companies at **Future FM, Dubai (DWTC, 23–26 Nov 2026)** and in follow-up meetings.

It shows how Kuroshio's FacilityIQ platform lets FM teams monitor SMDBs, BMS and assets remotely, catch faults early, meet SLAs and auto-generate owner reports.

- **Audience:** FM directors, facility managers, FM engineers, chief engineers, building owners.
- **Deployed on:** Vercel (from GitHub repo `Ajaskhan-AI/kuroshio-fm-demo`).
- **Data:** 100% simulated in the browser. No backend required to run the demo.

## 2. Hard rules (never break these)
1. **No real client names** anywhere (no Four Seasons, AlMansoori, DP World, etc.). Use fictional buildings only (see §7).
2. **Show a small "Demo data" label** in the top bar on every screen.
3. **Must work offline / on bad Wi-Fi.** No runtime calls to external APIs, map tile servers or CDNs. Fonts and assets are bundled locally (use `next/font`).
4. **Never overclaim.** BMS integration is labelled "Pilot-ready". Roadmap items appear only in a "Coming next" strip, never as live features.
5. **BMS is read-only** in all UI copy — no buttons that write setpoints or control equipment.
6. **Mobile and tablet must work** — tablet is the primary device.
7. Keep it fast: no screen should show a loading spinner during the demo.

## 3. Tech stack
- **Next.js (App Router) + TypeScript**, scaffolded in the repo root (`.`), not a subfolder
- **Tailwind CSS + shadcn/ui** components
- **Recharts** for charts
- **Zustand** for the single simulation store
- **Framer Motion** for subtle animation (number transitions, alarm toasts)
- **Lucide** icons
- **@react-pdf/renderer** (or jsPDF) for the monthly report PDF, generated client-side
- Font: **Plus Jakarta Sans** via `next/font/google` (self-hosted at build time)
- Optional later: Supabase for the "Book a pilot" lead form. Until then, store leads in localStorage and show a success message.

## 4. Brand and theme (Kuroshio blue)
Light mode is the default. Dark mode toggle available.

| Token | Light | Dark |
|---|---|---|
| Brand blue (logo) | `#004DC3` | `#004DC3` |
| Primary (buttons, links, active nav, main chart series) | `#1F54CC` | `#4A7BE0` |
| Primary light (secondary chart series, hover tints) | `#8FB0F0` | `#2A4A8F` |
| Background | `#F4F4F4` | `#0F1A30` |
| Card / surface | `#FFFFFF` | `#16233F` |
| Text primary | `#0F1A30` | `#F1F4FA` |
| Text secondary | `#45526B` | `#A3B0C7` |
| Border | `#E1E6EF` | `#24345A` |
| Success | `#16A34A` (tint `#E6FAF6`) | `#22C55E` |
| Warning | `#F59E0B` | `#FBBF24` |
| Danger / alarm | `#DC2626` | `#F87171` |
| Offline | `#94A3B8` | `#64748B` |

- Define these as CSS variables in `globals.css` and map them into the Tailwind / shadcn theme.
- Status colours are **only** for status. Never use red/green decoratively.
- Status is never shown by colour alone — always icon + text too.
- Logo: `public/kuroshio-logo.jpg` (blue wordmark "KUROSHIO AI" on white) at top of sidebar. In dark mode, show it on a white rounded chip or render the wordmark as text in `#FFFFFF`.

## 5. UI/UX rules
- **Status first:** every screen opens with the single most important number or alert at the top.
- **3-second rule:** a visitor should get each screen's point in 3 seconds.
- **Plain FM language:** "Panel overheating", not "thermal anomaly". Always show units (kW, kWh, AED, °C, V, A, tCO₂e).
- **Tabular numbers** (`font-variant-numeric: tabular-nums`) on all live values.
- **Card anatomy everywhere:** title → big number → small trend/sparkline → status chip.
- Live values animate smoothly; alarm pins pulse; new alarms slide in as toasts. Motion stays subtle.
- Every live card shows "Updated Xs ago".
- Filters are chips, not dropdowns.
- Touch targets ≥ 44px.
- Sentence case for all labels and buttons.

### Navigation
- **Desktop/tablet:** collapsible left sidebar (logo + 8 screens) and top bar (building switcher, live clock, alarm bell with count, "Demo data" label, theme toggle).
- **Phone:** bottom tab bar — Overview, Live, Alarms, Energy, More.
- **Breadcrumbs:** Portfolio › Building › Panel/Asset.
- Clicking anything red navigates to its cause.

## 6. Screens and features

### 6.1 Portfolio overview (`/`)
- KPI row: buildings online, live kW (portfolio), cost today (AED), open alarms.
- **Custom SVG map of the UAE coast** (Abu Dhabi → Dubai → Sharjah), hand-drawn path, no map library, no tiles. Building pins placed from lat/long via a simple projection. Pin colour = status, pin size = load. Hover = tooltip (name, kW, alarms). Click = open building.
- Building list on the right, ranked worst health first; each card shows health score, kW, alarm count, top issue.
- Pin ↔ card highlight linked.
- Mobile: map on top, list below.

### 6.2 Live SMDB monitor (`/buildings/[id]/smdb`)
- Panel selector (SMDB-01 … SMDB-08 per building).
- Single-line style panel visual: incomer + outgoing feeders, each with live V, I per phase, PF, kW, kWh.
- Panel status: Online / Offline / Tripped.
- **Panel temperature** gauge with thresholds (normal < 45 °C, warning 45–60 °C, alarm > 60 °C).
- Alarms: overload, phase imbalance (> 10%), low PF (< 0.85), voltage high/low (±10% of 230 V L-N), feeder trip, panel offline, overheating.
- "Manual readings avoided this month" counter.
- History chart per feeder (last 24 h).

### 6.3 BMS cloud (`/buildings/[id]/bms`) — label "Pilot-ready"
- Connection card: protocol BACnet/IP, devices discovered (e.g. 42), points mapped (e.g. 318), last sync "3 s ago", status Online. Badges: **Read-only · Outbound-only · UAE-hosted**.
- Live points table: AHU supply/return air temp, fan status, filter ΔP; chiller on/off, CHW supply/return temp; FCU status; pump status; zone temps and setpoints. Filter chips by system.
- BMS alarms appear in the same global alarm feed.
- 24 h trend chart: CHW supply vs return temperature.
- **Cross-check panel (hero of this screen):** compares BMS status with Kuroshio meter kW, e.g. "BMS shows AHU-3 OFF (schedule) but meter shows 18.4 kW since 22:00. Possible override or failed relay. Est. waste AED 1,950/month." Button: "Create work order".
- Small architecture diagram: BMS → Kuroshio edge gateway → MQTT (cellular/VPN) → Kuroshio cloud (Azure UAE North) → Dashboard.

### 6.4 Energy and waste (`/buildings/[id]/energy`)
- Load profile (24 h and 30 days), peak demand and time.
- Cost in AED using configurable tariff (see §8).
- **After-hours waste finder:** list of loads running outside schedule with AED lost/month.
- Power factor trend and penalty risk.
- Breakdown by floor / SMDB.
- Comparison vs last week / last month.

### 6.5 Alarms → work orders → SLA (`/alarms`)
- Global alarm feed (meter + BMS + predictive), filter by building / priority / source.
- Each alarm can auto-create a work order: priority P1/P2/P3, SLA timer counting down (P1 30 min, P2 4 h, P3 24 h), assigned technician, status Open → In progress → Closed.
- SLA compliance % per site, average response time.
- Technician list is fictional.

### 6.6 Predictive maintenance (`/maintenance`)
- Asset list (chilled water pumps, AHU fans, condenser pumps) with health score 0–100.
- Asset detail: trend of motor current signature indicator degrading over 30 days, estimated days to failure, recommendation ("Inspect pump bearing within 10 days"), button to create work order.
- Copy mentions non-invasive CT-clamp monitoring (MCSA). Don't claim accuracy figures.

### 6.7 Carbon and monthly report (`/reports`)
- Scope 2 tCO₂e = metered kWh × grid emission factor (configurable, §8). Monthly and yearly trends per building.
- **One-click monthly owner report (PDF):** cover with Kuroshio logo and building name, uptime, alarms handled, SLA %, energy and cost, carbon, top 3 recommendations. Preview before download.
- CSV export of the month's data.

### 6.8 ROI and book a pilot (`/roi`)
- Sliders/inputs: number of buildings, SMDBs per building, technicians doing manual rounds, hourly technician cost (AED), monthly energy bill (AED).
- Live output (no submit button): technician hours saved/year, AED saved from rounds, AED saved from waste (assume 5–10% energy saving, shown as an editable assumption), payback period.
- "Book a 30-day pilot" form: name, company, role, email, phone, number of buildings. Validate inputs inline.
- QR code linking to the deployed URL.
- "Coming next" strip: Chiller kW/TR, Indoor air quality, Water leak detection, Generator readiness, Lift uptime, CAFM integration.

### 6.9 K-Sense cold chain (`/ksense`) — 9th menu item, key `9`
K-Sense is Kuroshio's own sensor product, shown as a **live module** (no "Pilot-ready" label). Audience: **operators who run cold stores as a business** and want every chamber at every site on one dashboard. It has its own fictional portfolio of cold stores (not the six buildings) and its own alarms, so the FM screens are untouched.
- **Measured per chamber:** temperature, humidity, door open/closed, room differential pressure (Pa; freezers pull a vacuum after the door closes, a stuck vacuum means an iced relief port).
- **Measured per refrigeration unit:** suction pressure and discharge pressure (bar g), compressor power (kW). Low suction drifting down = possible refrigerant leak; high discharge = dirty condenser / condenser fan fault (UAE summers).
- **Chamber types and bands (demo assumptions, `lib/ksense/config.ts`):** frozen −25 to −18 °C, chilled 0–4 °C, pharma 2–8 °C, fresh produce 10–14 °C. Defrost cycles are recognised and never raise a temperature alarm.
- **Screen:** status-first banner → KPI row (chambers in range, open alarms, stock at risk AED, refrigeration kW) → site and status filter chips → chamber tiles grouped by site → chamber detail (24 h temperature chart with band shaded and defrost marked, live readings, refrigeration unit card, sensor battery/signal, alarms) → excursion log with CSV temperature certificate.
- **Alarms:** temperature excursion (P1 frozen/pharma, P2 others), door open too long (P2), possible refrigerant leak (P2, predictive), high discharge pressure (P2), relief port iced (P3), sensor low battery (P3).
- **Scripted incident (key `K`, presenter panel):** (1) Jebel Ali FR-02 dock door left open: −21 → −12 °C, P1 excursion with stock at risk, door closes at 35 s, recovers, excursion lands in the log with peak and duration; (2) in parallel, KIZAD PH-02 suction pressure falls 3.9 → 2.7 bar while the room is still in range: leak caught before the temperature moves.

### 6.10 K-Pulse rotating assets (`/kpulse`) — 10th menu item, key `0`
K-Pulse is vibration condition monitoring for **pumps, compressors, motors and fans** in the six FM buildings. Four sensor points per machine (motor NDE/DE, machine DE/NDE). All values simulated; zone limits follow the shape of ISO 10816-3 (velocity RMS, rigid foundation), every other threshold is a demo assumption in `lib/kpulse/config.ts`.
- **Measured per point:** velocity RMS X/Y/Z (mm/s), acceleration RMS (g), HF / envelope acceleration (gE), kurtosis, crest factor, bearing temperature. Per machine: kW, current, PF. Pumps add flow (meter or **virtual flow meter**, labelled as an AI estimate), suction/discharge pressure, head, efficiency, NPSH available/required. Compressors add specific power, load, surge margin (centrifugal) or load/unload cycles (air).
- **Fleet (14 machines, `lib/kpulse/assets.ts`):** health ring, ISO zone (letter + words), 24 h velocity sparkline, top AI observation; filters by building, type, status; latest observations panel.
- **Asset detail tabs:** Overview (machine drawing with clickable sensor points, readings, days to alert limit, AI cards) · Vibration (velocity over ISO zone bands, HF + acceleration, kurtosis + crest, temperature; 24 h/7 d/30 d) · Pump curves (H–Q with factory curve, curve at VFD speed, 30-day trail and pulsing live point; NPSH margin; efficiency; power; vibration vs flow; kWh/m³) or Performance for compressors and fans · Spectrum (FFT with fault-frequency markers, healthy baseline overlay, markers the AI used highlighted) · AI observations (cards + timeline incl. closed ones).
- **AI observations (`lib/kpulse/rules.ts`):** cavitation, off-BEP, impeller wear, bearing wear (early / damage), lubrication, unbalance, misalignment, motor electrical (100 Hz), belt, surge, danger zone, unexpected stop. Each lists its evidence, a next step, what is at stake (AED), and a confidence. New P1/P2 observations open a work order in the shared FM list; the monthly report lists them.
- **Scripted incident (key `P`, presenter panel, about 30 s):** Marina Tower A stand-by pump CHW-P4 trips, CHW-P3 runs out to 135 % of BEP flow at full speed; NPSH margin falls from about 2.6 m to 0.3 m, cavitation follows from the margin (not scripted), HF and broadband noise rise, P2 cavitation observation + work order.

## 7. Simulated data

### Fictional portfolio (6 buildings)
| id | Name | Area | Type |
|---|---|---|---|
| marina-a | Marina Tower A | Dubai Marina | Residential tower |
| bb-plaza | Business Bay Plaza | Business Bay | Office |
| deira-annex | Deira Mall Annex | Deira | Retail |
| jlt-one | JLT Cluster One | JLT | Mixed use |
| reem-res | Reem Island Residences | Abu Dhabi | Residential |
| sharjah-hub | Al Nahda Business Hub | Sharjah | Office |

### Realistic values
- Electrical: 400 V L-L / 230 V L-N, 50 Hz. Normal PF 0.88–0.97.
- Building loads 300–1,200 kW; cooling ≈ 60–70% of load; daily profile peaks 13:00–16:00, lowest 03:00–05:00.
- Feeder currents 20–400 A. Panel temps 30–42 °C normally.
- CHW supply ~6–7 °C, return ~12–13 °C; AHU supply air ~13–15 °C; zones 22–24 °C.
- Values jitter ±1–3% every 2–3 s; history generated from a seeded random function so it's stable across reloads.

### Simulation engine
- One Zustand store (`lib/sim/store.ts`) owns all buildings, panels, feeders, BMS points, assets, alarms and work orders.
- A single `setInterval` tick (2 s) updates live values. All screens read from this store so one event updates everywhere.
- **Scripted incident** (`lib/sim/scenario.ts`) on Marina Tower A:
  1. SMDB-04 temperature climbs 41 → 63 °C over ~40 s → overheating alarm.
  2. Alarm auto-creates a P1 work order with SLA timer.
  3. BMS cross-check flags AHU-3 "OFF" but drawing 18.4 kW.
  4. Energy screen shows the after-hours waste.
  5. Predictive maintenance shows CHW Pump-2 health dropping to 58.
  6. Monthly report includes all of the above.
- Random minor alarms elsewhere every 30–60 s so the portfolio never looks static.

## 8. Config (`lib/config.ts`) — all demo assumptions in one place
- DEWA-style commercial tariff slabs (fils/kWh) + fuel surcharge — **marked as demo assumptions**, editable.
- Grid emission factor (tCO₂e/MWh) — **demo assumption**, editable, shown on the carbon screen as "Factor used: X (configurable)".
- SLA targets per priority.
- Alarm thresholds (temp, PF, imbalance, voltage).
- Tick interval.

## 9. Event modes
- **Presenter mode** (keyboard): `1`–`9` and `0` jump to screens, `I` trigger the incident, `K` trigger the K-Sense cold-chain incident, `P` trigger the K-Pulse pump cavitation incident, `R` reset simulation, `D` toggle dark mode. Show a tiny hint overlay on `?`.
- **Kiosk mode:** `?kiosk=1` in URL. After 60 s with no input, auto-cycle screens every 12 s with the incident running. Any touch/click stops it.

## 10. Folder structure
```
app/
  layout.tsx            # sidebar, top bar, theme, fonts
  page.tsx              # 6.1 portfolio
  buildings/[id]/smdb/page.tsx
  buildings/[id]/bms/page.tsx
  buildings/[id]/energy/page.tsx
  alarms/page.tsx
  maintenance/page.tsx
  reports/page.tsx
  roi/page.tsx
components/
  layout/  (Sidebar, TopBar, MobileTabBar, Breadcrumbs)
  cards/   (KpiCard, StatusChip, LiveValue, Sparkline)
  map/     (UaeMap.tsx, BuildingPin.tsx)
  smdb/  bms/  energy/  alarms/  maintenance/  reports/  roi/
lib/
  sim/  (store.ts, generators.ts, scenario.ts, seed.ts)
  config.ts
  format.ts  (units, AED, numbers)
  types.ts
public/
  kuroshio-logo.jpg
```

## 11. Build order
1. Scaffold Next.js in `.`, add Tailwind, shadcn/ui, theme tokens, font, layout (sidebar, top bar, mobile tab bar).
2. Types + seeded data + simulation store + tick.
3. Portfolio overview with SVG map.
4. Live SMDB monitor.
5. Alarms → work orders → SLA.
6. BMS cloud with cross-check.
7. Energy and waste.
8. Predictive maintenance.
9. Carbon + PDF report.
10. ROI + pilot form + QR.
11. Scripted incident, presenter mode, kiosk mode.
12. Polish: responsive pass, dark mode, empty/edge states, performance.

Commit after each step with a clear message. Run `npm run build` before every push — Vercel must build cleanly.

## 12. Definition of done
- `npm run build` passes with no type errors.
- Works on iPad, Android phone and laptop; readable from 2 m on a large screen.
- Works with network disconnected after first load.
- Full demo story runs in ~3 minutes with presenter mode.
- No real client names; "Demo data" label visible on every screen.
- Deployed on Vercel; QR code points to the live URL.

## 13. Commands
```
npm run dev     # local
npm run build   # must pass before push
npm run lint
```
Deploy: push to `main` → Vercel auto-deploys.
