import { ScreenHeader, ScreenPlaceholder } from "@/components/layout/ScreenHeader";

export default function Page() {
  return (
    <>
      <ScreenHeader title="Predictive maintenance" subtitle="Non-invasive CT-clamp monitoring of pumps and fans." />
      <ScreenPlaceholder
        step={8}
        points={[
    "Asset health scores 0–100",
    "Degradation trend and days to failure",
    "Recommendation and work order",
        ]}
      />
    </>
  );
}
