import { CONFIG } from "./config";

/** Monthly bill in AED for a consumption, using the demo slab tariff plus fuel surcharge. */
export function monthlyBillAed(monthlyKwh: number): number {
  let remaining = monthlyKwh;
  let lower = 0;
  let fils = 0;
  for (const slab of CONFIG.tariff.slabs) {
    const inSlab = Math.min(remaining, slab.upToKwh - lower);
    if (inSlab <= 0) break;
    fils += inSlab * slab.fils;
    remaining -= inSlab;
    lower = slab.upToKwh;
  }
  fils += monthlyKwh * CONFIG.tariff.fuelSurchargeFils;
  return fils / 100;
}

/** Blended AED per kWh for a building's typical monthly consumption. */
export function blendedRateAedPerKwh(monthlyKwh: number): number {
  return monthlyKwh > 0 ? monthlyBillAed(monthlyKwh) / monthlyKwh : 0;
}

/** Scope 2 emissions in tCO₂e for a consumption in kWh. */
export function scope2Tco2e(kwh: number): number {
  return (kwh / 1000) * CONFIG.emissionFactor.tCo2ePerMwh;
}
