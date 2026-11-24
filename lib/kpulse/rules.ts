// K-Pulse diagnosis rules: readings and spectrum peaks in, plain-language observations out. Each
// observation lists the evidence it used, so the "AI" is always explainable on the stand.

import type { Priority } from "../config";
import { fmtAedEstimate, fmtNum } from "../format";
import { clamp } from "../sim/random";
import { KPULSE, ZONE_TEXT } from "./config";
import { headOnCurve, maxOf, maxVelocity, partLoadFactor, pointVelocity, spectrumPeaks, zoneOf } from "./physics";
import type { AssetTemplate, Observation, ObservationKind, Operating, Readings, Severities } from "./types";

export interface RuleInput {
  asset: AssetTemplate;
  sev: Severities;
  op: Operating;
  readings: Readings;
  tripped: boolean;
  /** The stand-by pump that should be sharing this one's duty has tripped. */
  partnerTripped?: string;
  /** Tag of the pump that took over from this one. */
  takenOverBy?: string;
}

export type Finding = Omit<Observation, "id" | "raisedAt" | "status" | "clearedAt" | "workOrderId" | "resolution">;

const T = KPULSE.thresholds;
const R = KPULSE.repairAed;
const n1 = (v: number) => fmtNum(v, 1);
const n2 = (v: number) => fmtNum(v, 2);

/** AED per month of energy lost against running at design efficiency. */
export function energyLostAedMonth(a: AssetTemplate, r: Readings, op: Operating, sev: Severities): number {
  if (!op.running || r.kw <= 0) return 0;
  let lostKw = 0;
  if (a.pump && r.pump) lostKw = r.kw * Math.max(0, 1 - r.pump.eta / a.pump.etaBep);
  // Compressors: only the loss a fault causes, against what a healthy machine needs at this load.
  else if (a.compressor && r.compressor) lostKw = r.kw * Math.max(0, 1 - (a.compressor.designSpecificPower * partLoadFactor(op.duty)) / r.compressor.specificPower);
  // A slipping belt wastes a few percent of the fan's power (demo assumption: up to 6 %).
  else if (a.fan?.beltDriven) lostKw = r.kw * 0.06 * sev.belt;
  return lostKw * KPULSE.runHoursPerMonth * KPULSE.aedPerKwh;
}

export function diagnose(input: RuleInput): Finding[] {
  const { asset: a, sev, op, readings: r } = input;
  const out: Finding[] = [];
  const add = (kind: ObservationKind, priority: Priority, f: Omit<Finding, "key" | "assetId" | "buildingId" | "kind" | "priority">) =>
    out.push({ key: `${a.id}:${kind}`, assetId: a.id, buildingId: a.buildingId, kind, priority, ...f });

  if (input.tripped) {
    add("stopped", "P2", {
      title: "Stopped unexpectedly",
      summary: `${a.tag} has gone quiet while the plant needs it: no vibration, no current.${input.takenOverBy ? ` ${input.takenOverBy} is carrying its duty alone.` : ""}`,
      evidence: ["Vibration dropped to 0.05 mm/s on all four points", "Motor current 0 A while scheduled to run", "Partner pump flow rose at the same moment"],
      action: "Check the starter and overload relay, then reset and restart it to share the load again.",
      confidence: 97,
      impact: "No energy lost yet, but the other pump is now running past its best-efficiency point.",
      markers: [],
    });
    return out;
  }
  if (!op.running) return out;

  const peaks = spectrumPeaks(a, sev, op);
  const peak = (key: string) => peaks.find((p) => p.key === key)?.amp ?? 0;
  const v = maxVelocity(r);
  const zone = zoneOf(v, a.iso);
  const kurt = maxOf(r, "kurtosis");
  const hf = maxOf(r, "hfG");
  const temp = maxOf(r, "tempC");
  const lost = energyLostAedMonth(a, r, op, sev);
  const lostText = lost >= 50 ? `About ${fmtAedEstimate(lost)}/month of electricity wasted.` : "";
  const zonePriority = (base: Priority): Priority => (zone === "D" ? "P1" : zone === "C" && base === "P3" ? "P2" : base);

  // ---- Pumps: hydraulics first ------------------------------------------------------------
  let cavitating = false;
  if (a.pump && r.pump) {
    const p = r.pump;
    const margin = p.npshaM - p.npshrM;
    if (margin < T.npshMarginWarnM && hf > T.hfWarn * 0.8) {
      cavitating = true;
      add("cavitation", margin < T.npshMarginAlarmM ? "P2" : "P3", {
        title: "Cavitation",
        summary: "The pump is starving at the suction: vapour bubbles form and collapse on the impeller. Noisy now, and it eats the impeller within weeks.",
        evidence: [
          `Flow ${fmtNum(p.bepPct)} % of best-efficiency flow (${fmtNum(p.flowM3h)} m³/h${a.pump.flowSource === "virtual" ? ", virtual flow meter" : ""})`,
          `NPSH margin ${n1(margin)} m: available ${n1(p.npshaM)} m, required ${n1(p.npshrM)} m (alarm below ${T.npshMarginAlarmM} m)`,
          `HF acceleration ${n1(hf)} gE (normal under ${T.hfWarn} gE)`,
          "Broadband noise rising across the upper spectrum, not at one frequency",
        ],
        action: input.partnerTripped
          ? `Restart ${input.partnerTripped} to share the flow, or throttle the discharge valve until flow is under ${T.bepHighPct} % of BEP. Then check the suction strainer.`
          : `Bring flow back under ${T.bepHighPct} % of BEP (throttle or stage a second pump) and check the suction strainer.`,
        confidence: Math.round(clamp(58 + 34 * sev.cavitation, 55, 94)),
        impact: `Impeller erosion: about ${fmtAedEstimate(R.impeller)} to replace. ${lostText}`.trim(),
        markers: ["vane", "broadband"],
      });
    }
    const bepPct = p.bepPct;
    if (bepPct < T.bepLowPct || bepPct > T.bepHighPct) {
      const low = bepPct < T.bepLowPct;
      add("off-bep", "P3", {
        title: low ? "Running far below best efficiency" : "Running past best efficiency",
        summary: low
          ? "Oversized for today's load: throttled far back on its curve. It wastes energy and low-flow recirculation wears the impeller."
          : "Pushed out to the right of its curve: high flow, low efficiency and a falling NPSH margin.",
        evidence: [
          `Flow ${fmtNum(bepPct)} % of best-efficiency flow (healthy band ${T.bepLowPct}–${T.bepHighPct} %)`,
          `Pump efficiency ${fmtNum(p.eta * 100)} % against ${fmtNum(a.pump.etaBep * 100)} % at BEP`,
          `Vane-pass peak ${n2(peak("vane"))} mm/s at ${fmtNum(a.pump.vanes * (a.rpm * op.speed) / 60)} Hz`,
        ],
        action: low
          ? "Trim the impeller or fit a VFD so it runs near its BEP; at low load stage a smaller pump."
          : input.partnerTripped
            ? `Restart ${input.partnerTripped} so the two pumps share the flow.`
            : "Stage a second pump or reset the differential-pressure setpoint.",
        confidence: 93,
        impact: lostText || "Efficiency loss is small so far.",
        markers: ["vane"],
      });
    }
    const curveHead = headOnCurve(a.pump, p.flowM3h, op.speed);
    const shortfall = curveHead > 0 ? (1 - p.headM / curveHead) * 100 : 0;
    if (shortfall > 4) {
      add("wear", "P3", {
        title: "Impeller or wear-ring wear",
        summary: "The pump makes less pressure than when new at the same flow and speed: internal clearances have opened up.",
        evidence: [`Head ${n1(p.headM)} m against ${n1(curveHead)} m on the factory curve (${n1(shortfall)} % short)`, `Efficiency ${fmtNum(p.eta * 100)} % against ${fmtNum(a.pump.etaBep * 100)} % new`],
        action: "Check wear-ring clearance and impeller condition at the next planned overhaul.",
        confidence: 84,
        impact: lostText || "Small energy loss today; grows as wear continues.",
        markers: [],
      });
    }
  }

  // ---- Mechanical faults from vibration -----------------------------------------------------
  if (!cavitating && kurt > T.kurtosisWarn && hf > T.hfWarn * 0.8) {
    const bpfo = peak("bpfo");
    const early = zone === "A" || zone === "B";
    add("bearing", zonePriority(kurt > T.kurtosisAlarm ? "P2" : "P3"), {
      title: early ? "Early bearing wear" : "Bearing damage",
      summary: early
        ? "Impacts are starting inside a bearing. Overall vibration still looks fine, so a route-based check would miss it today."
        : "Bearing damage is now raising overall vibration. Plan the change before it seizes.",
      evidence: [
        `Kurtosis ${n1(kurt)} (healthy about 3, warning above ${T.kurtosisWarn})`,
        `HF acceleration ${n1(hf)} gE (normal under ${T.hfWarn} gE)`,
        `Crest factor ${n1(maxOf(r, "crest"))}`,
        ...(bpfo > 0.25 ? [`Peak at BPFO (${fmtNum(a.bearing.bpfo * (a.rpm * op.speed) / 60)} Hz, the outer-race defect frequency) with ±1× sidebands`] : []),
        `Overall velocity ${n1(v)} mm/s, ${ZONE_TEXT[zone]}`,
      ],
      action: early ? "Order the replacement bearing now and change it at the next planned stop, within about 3 weeks." : "Change the bearing within 7 days; check the seal and shaft at the same time.",
      confidence: Math.round(clamp(62 + 9 * (kurt - T.kurtosisWarn) + (bpfo > 0.25 ? 10 : 0), 60, 95)),
      impact: `Planned bearing change about ${fmtAedEstimate(R.bearing)}. A run-to-failure usually also takes the seal and shaft, plus downtime.`,
      markers: ["bpfo", "bpfi"],
    });
  }
  if (!cavitating && temp > T.tempWarnC && kurt <= T.kurtosisWarn && hf > T.hfWarn * 0.8) {
    const comp = a.kind === "compressor";
    add("lubrication", temp > T.tempAlarmC ? "P2" : "P3", {
      title: comp ? "Lubrication problem" : "Bearing needs grease",
      summary: comp
        ? "The bearings are running hot with rising friction noise, but no impacts yet: the oil isn't doing its job. Catch it now and the bearings survive."
        : "The bearing runs hot with friction noise, but no impacts yet: it is short of grease.",
      evidence: [`Bearing temperature ${fmtNum(temp)} °C (warning above ${T.tempWarnC} °C)`, `HF acceleration ${n1(hf)} gE, rising for ${fmtNum(a.faults.find((f) => f.kind === "lubrication")?.startDaysAgo ?? 7)} days`, `Kurtosis ${n1(kurt)}: normal, so no bearing damage yet`],
      action: comp ? "Change the oil filter, check oil level and oil pressure, and take an oil sample." : "Grease the bearing to the OEM quantity and recheck in 48 h.",
      confidence: 81,
      impact: comp ? `Avoids a compressor overhaul (about ${fmtAedEstimate(R.compressorOverhaul)}). ${lostText}`.trim() : `Avoids a bearing change (about ${fmtAedEstimate(R.bearing)}).`,
      markers: [],
    });
  }

  const p1x = peak("1x");
  const p2x = peak("2x");
  const radial = Math.max(...Object.values(r.points).map((p) => Math.max(p.vx, p.vy)));
  if (p1x > T.peak1xWarn && p1x > 2 * p2x) {
    const ct = a.typeLabel === "Cooling tower fan";
    add("unbalance", zonePriority("P3"), {
      title: "Unbalance",
      summary: ct ? "Scale and dirt on the fan blades have thrown the rotor out of balance. Vibration is climbing steadily." : "The rotor is out of balance: one strong peak at running speed, mostly radial.",
      evidence: [`Radial velocity ${n1(radial)} mm/s, ${ZONE_TEXT[zone]}`, `1× peak ${n2(p1x)} mm/s at ${n1((a.rpm * op.speed) / 60)} Hz, ${fmtNum(p1x / Math.max(p2x, 0.05), 0)}× the 2× peak`, "Axial vibration low: points away from misalignment"],
      action: ct ? "Clean the blades, check for a cracked or loose blade, then field-balance." : "Clean the impeller or fan wheel and field-balance it.",
      confidence: 90,
      impact: `Left alone it loosens bolts and wears bearings; blade work at failure about ${fmtAedEstimate(R.fanBlades)}.`,
      markers: ["1x"],
    });
  }
  const axial = Math.max(r.points["motor-de"].vz, r.points["machine-de"].vz);
  const couplingRadial = Math.max(r.points["motor-de"].vx, r.points["machine-de"].vx);
  if (p2x > T.peak2xWarn && axial > 0.6 * couplingRadial) {
    add("misalignment", zonePriority("P3"), {
      title: "Misalignment",
      summary: "Motor and driven shaft are not in line. Both bearings and the coupling take extra load and wear out early.",
      evidence: [`Axial velocity ${n1(axial)} mm/s at the coupling, ${fmtNum((axial / couplingRadial) * 100)} % of radial`, `2× peak ${n2(p2x)} mm/s, above the 1× peak (${n2(p1x)} mm/s)`, `Coupling-side bearings ${fmtNum(Math.max(r.points["motor-de"].tempC, r.points["machine-de"].tempC))} °C, warmer than the far end`],
      action: "Laser-align motor and pump; check for soft foot and a worn coupling insert.",
      confidence: 87,
      impact: `Avoids early bearing and coupling changes (about ${fmtAedEstimate(R.bearing * 2)}).`,
      markers: ["1x", "2x", "3x"],
    });
  }
  const p100 = peak("100hz");
  if (p100 > T.electrical100HzWarn) {
    add("electrical", "P3", {
      title: "Motor electrical fault",
      summary: "A strong peak at twice line frequency on the motor: a stator winding or air-gap problem, not a mechanical one.",
      evidence: [`100 Hz peak ${n2(p100)} mm/s (2 × 50 Hz line frequency)`, `Motor drive-end temperature ${fmtNum(r.points["motor-de"].tempC)} °C`, `Current ${fmtNum(r.currentA)} A at power factor ${n2(r.pf)}`],
      action: "Electrical test at the next stop: insulation resistance, winding resistance and current balance.",
      confidence: 78,
      impact: `Caught early it is a repair; a burnt-out winding is a rewind (about ${fmtAedEstimate(R.motorRewind)}) plus downtime.`,
      markers: ["100hz"],
    });
  }
  const belt = peak("belt");
  if (belt > T.beltWarn) {
    add("belt", "P3", {
      title: "Belt wear or slip",
      summary: "The drive belts are worn or loose: a peak below running speed at the belt frequency.",
      evidence: [`Belt-frequency peak ${n2(belt)} mm/s at ${n1((a.fan?.beltRatio ?? 0) * (a.rpm * op.speed) / 60)} Hz`, `Velocity ${n1(v)} mm/s, ${ZONE_TEXT[zone]}`],
      action: "Re-tension or replace the belt set and check pulley alignment.",
      confidence: 85,
      impact: `${lostText} A snapped belt stops the AHU; a belt set is about ${fmtAedEstimate(R.belt)}.`.trim(),
      markers: ["belt"],
    });
  }
  const surge = r.compressor?.surgeMarginPct;
  if (surge !== undefined && surge < T.surgeMarginWarnPct) {
    add("surge", "P2", {
      title: "Close to surge",
      summary: "The compressor is running near its surge line, where flow can reverse and hammer the impeller.",
      evidence: [`Surge margin ${n1(surge)} % (warning below ${T.surgeMarginWarnPct} %)`, `Sub-synchronous peak ${n2(peak("subsync"))} mm/s`],
      action: "Check condenser water temperature and the guide-vane control; raise the minimum load.",
      confidence: 80,
      impact: `A surge event can damage the compressor (overhaul about ${fmtAedEstimate(R.compressorOverhaul)}).`,
      markers: ["subsync"],
    });
  }
  if (zone === "D" && !out.some((o) => o.priority === "P1")) {
    add("zone", "P1", {
      title: "Vibration in the danger zone",
      summary: "Vibration is high enough to damage the machine. Stop it if a stand-by is available.",
      evidence: [`Velocity ${n1(v)} mm/s, ${ZONE_TEXT[zone]}`],
      action: "Switch to the stand-by unit and inspect.",
      confidence: 95,
      impact: "Risk of a breakdown within days.",
      markers: ["1x", "2x"],
    });
  }
  return out;
}

/** Velocity at the worst point, for one-line status text. */
export const worstVelocity = (r: Readings) => Math.max(...Object.values(r.points).map(pointVelocity));
