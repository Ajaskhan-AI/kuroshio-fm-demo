import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { PortfolioView } from "@/components/portfolio/PortfolioView";

export default function PortfolioPage() {
  return (
    <>
      <ScreenHeader title="Portfolio overview" subtitle="Six buildings across Dubai, Abu Dhabi and Sharjah, monitored live." />
      <PortfolioView />
    </>
  );
}
