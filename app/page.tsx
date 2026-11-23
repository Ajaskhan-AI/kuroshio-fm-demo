import { ScreenHeader, ScreenPlaceholder } from "@/components/layout/ScreenHeader";

export default function PortfolioPage() {
  return (
    <>
      <ScreenHeader title="Portfolio overview" subtitle="Six buildings across Dubai, Abu Dhabi and Sharjah, live." />
      <ScreenPlaceholder
        step={3}
        points={[
          "KPIs: buildings online, live kW, cost today (AED), open alarms",
          "SVG map of the UAE coast with live building pins",
          "Buildings ranked worst health first",
        ]}
      />
    </>
  );
}
