# Kuroshio FM Command Center (demo)

Client-facing demo of Kuroshio FacilityIQ for facility-management teams: live SMDB monitoring, BMS cross-check,
energy waste, alarms → work orders → SLA, predictive maintenance, carbon and the monthly owner report, and ROI.

**All data is simulated in the browser.** Six fictional buildings, no backend, no external calls: after the first
load it keeps working with the network unplugged. Full spec: [CLAUDE.md](CLAUDE.md).

## Run

```powershell
npm install
npm run dev      # http://localhost:3000
npm run build    # must pass before pushing; Vercel deploys main automatically
npm run lint
```

## Running the demo

| Key | Action |
|---|---|
| `1`–`9` | Jump to a screen (menu order) |
| `I` | Start the Marina Tower A incident |
| `K` | Start the K-Sense cold-chain incident |
| `R` | Reset the simulation |
| `D` | Dark mode on / off |
| `?` | Presenter panel (same actions as buttons, for tablets) |

On a tablet, open the panel from **Presenter** at the bottom of the sidebar (or **More → Presenter** on a phone).

**The incident (about 40 s):** SMDB-04 heats 41 → 63 °C (P1 alarm and work order with a 30-minute SLA), AHU-3 keeps
drawing 18.4 kW while the BMS says it is off (cross-check and energy waste), and CHW Pump-2 health falls to 58
(predictive alarm). The monthly report picks all of it up. A suggested 3-minute walk-through:
Portfolio → press `I` → SMDB (`2`) → BMS (`3`) → Alarms (`5`) → Maintenance (`6`) → Reports (`7`, preview the PDF) → ROI (`8`).

**Kiosk:** open the site with `?kiosk=1` (remembered for the browser session; `?kiosk=0` turns it off). After 60 s
without a touch it tours every screen, 12 s each, replaying the incident each lap. Any tap hands control back.

**K-Sense cold chain (`9`, then `K`, about 60 s):** the Jebel Ali FR-02 dock door is left open and the freezer climbs
−21 → −12 °C (P1 excursion, stock at risk), the door closes and it recovers into the excursion log. Meanwhile KIZAD PH-02
suction pressure falls 3.9 → 2.7 bar: a refrigerant leak flagged while the room is still in range.

## Where things live

- `lib/config.ts` — every demo assumption: tariff, emission factor, SLA targets, thresholds, ROI prices.
- `lib/sim/` — the simulation: seeded portfolio, 2 s tick, alarm rules, scripted incident.
- `lib/ksense/` — K-Sense cold-chain simulation: fictional cold stores, bands, pressures, scripted incident.
- `components/` — one folder per screen; `app/` — routes.
