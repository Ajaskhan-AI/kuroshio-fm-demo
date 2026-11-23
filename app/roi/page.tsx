import { ScreenHeader, ScreenPlaceholder } from "@/components/layout/ScreenHeader";

export default function Page() {
  return (
    <>
      <ScreenHeader title="ROI and book a pilot" subtitle="See the payback for your portfolio." />
      <ScreenPlaceholder
        step={10}
        points={[
    "Live ROI calculator",
    "Book a 30-day pilot form",
    "QR code and coming-next strip",
        ]}
      />
    </>
  );
}
