"use client";

import { useState } from "react";
import { ISO_ZONES, KPULSE } from "@/lib/kpulse/config";
import { RANGES, type RangeKey } from "@/lib/kpulse/history";
import { pointLabel } from "@/lib/kpulse/selectors";
import type { RotatingAsset, SensorPoint } from "@/lib/kpulse/types";
import { ChipGroup } from "@/components/cards/ChipGroup";
import { ChartFrame, LegendLine, LegendSwatch, SERIES, TrendChart } from "./charts";
import { useTrend } from "./useTrend";

const T = KPULSE.thresholds;

export function VibrationTab({ asset: a, point, now, anchor }: { asset: RotatingAsset; point: SensorPoint; now: number; anchor: number }) {
  const [range, setRange] = useState<RangeKey>("7d");
  const data = useTrend(a, point, range, now, anchor);
  const z = ISO_ZONES[a.iso];
  const multiDay = range !== "24h";
  const where = pointLabel(a, point);

  return (
    <div className="flex flex-col gap-4">
      <ChipGroup label="Range" value={range} onChange={setRange} options={(Object.keys(RANGES) as RangeKey[]).map((k) => ({ value: k, label: RANGES[k].label }))} />

      <ChartFrame
        title={`Velocity RMS · ${where}`}
        sub="Overall machine condition. Shaded by ISO 10816-3 zone for this machine's size class."
        legend={
          <>
            <LegendLine color={SERIES[0]} label="Horizontal (X)" />
            <LegendLine color={SERIES[1]} label="Vertical (Y)" />
            <LegendLine color={SERIES[0]} label="Axial (Z)" dashed />
            <LegendSwatch fill="var(--success)" label={`A/B good–acceptable < ${z.bc} mm/s`} opacity={0.15} />
            <LegendSwatch fill="var(--warning)" label={`C alert ${z.bc}–${z.cd}`} />
            <LegendSwatch fill="var(--danger)" label={`D danger > ${z.cd}`} />
          </>
        }
      >
        <TrendChart
          data={data}
          series={[
            { key: "vx", label: "Horizontal", color: SERIES[0] },
            { key: "vy", label: "Vertical", color: SERIES[1] },
            { key: "vz", label: "Axial", color: SERIES[0], dashed: true },
          ]}
          unit="mm/s"
          yMax={z.cd * 1.15}
          bands={[
            { from: 0, to: z.ab, fill: "var(--success)", opacity: 0.12 },
            { from: z.ab, to: z.bc, fill: "var(--success)", opacity: 0.05 },
            { from: z.bc, to: z.cd, fill: "var(--warning)", opacity: 0.14 },
            { from: z.cd, to: 99, fill: "var(--danger)", opacity: 0.12 },
          ]}
          multiDay={multiDay}
          height={260}
          ariaLabel={`Velocity at ${where} over ${RANGES[range].label}, against ISO zones`}
        />
      </ChartFrame>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Bearing condition: HF and acceleration"
          sub="High-frequency (envelope) energy rises first when a bearing starts to fail."
          legend={
            <>
              <LegendLine color={SERIES[0]} label="HF / envelope, gE" />
              <LegendLine color={SERIES[1]} label="Acceleration RMS, g" />
            </>
          }
        >
          <TrendChart
            data={data}
            series={[
              { key: "hf", label: "HF / envelope", color: SERIES[0] },
              { key: "accel", label: "Acceleration", color: SERIES[1] },
            ]}
            unit="g"
            decimals={2}
            limits={[
              { y: T.hfWarn, label: "HF warning", color: "var(--warning)" },
              { y: T.hfAlarm, label: "HF alarm", color: "var(--danger)" },
            ]}
            multiDay={multiDay}
            ariaLabel="High-frequency and acceleration trend"
          />
        </ChartFrame>
        <ChartFrame
          title="Impacts: kurtosis and crest factor"
          sub="About 3 is a healthy bearing. Higher means sharp impacts inside it."
          legend={
            <>
              <LegendLine color={SERIES[0]} label="Kurtosis" />
              <LegendLine color={SERIES[1]} label="Crest factor" />
            </>
          }
        >
          <TrendChart
            data={data}
            series={[
              { key: "kurt", label: "Kurtosis", color: SERIES[0] },
              { key: "crest", label: "Crest factor", color: SERIES[1] },
            ]}
            unit=""
            yMin={2}
            limits={[{ y: T.kurtosisWarn, label: "Kurtosis warning", color: "var(--warning)" }]}
            multiDay={multiDay}
            ariaLabel="Kurtosis and crest factor trend"
          />
        </ChartFrame>
      </div>

      <ChartFrame title={`Bearing temperature · ${where}`} legend={<LegendLine color={SERIES[0]} label="Housing temperature, °C" />}>
        <TrendChart
          data={data}
          series={[{ key: "temp", label: "Temperature", color: SERIES[0] }]}
          unit="°C"
          yMin="auto"
          limits={[
            { y: T.tempWarnC, label: "Warning", color: "var(--warning)" },
            { y: T.tempAlarmC, label: "Alarm", color: "var(--danger)" },
          ]}
          multiDay={multiDay}
          height={180}
          ariaLabel="Bearing temperature trend"
        />
      </ChartFrame>
    </div>
  );
}
