// PDF version of the owner report, rendered in the browser with @react-pdf/renderer.
// Loaded only when someone downloads (dynamic import), so it never slows the demo.
// Built-in Helvetica only: no font downloads, works offline. Avoid glyphs outside WinAnsi (e.g. "₂").

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { fmtAedEstimate, fmtDate, fmtKw, fmtKwh, fmtNum, fmtPct, fmtTime } from "@/lib/format";
import type { ReportData } from "@/lib/report";

const C = { brand: "#004DC3", primary: "#1F54CC", text: "#0F1A30", muted: "#45526B", border: "#E1E6EF", tint: "#EAF0FC" };

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: C.text, fontFamily: "Helvetica" },
  cover: { borderBottomWidth: 4, borderBottomColor: C.brand, paddingBottom: 16, marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { height: 16, width: 161 }, // logo is 716 × 71 px
  demo: { fontSize: 8, color: "#92400E", backgroundColor: "#FEF3C7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  kicker: { marginTop: 22, fontSize: 9, color: C.primary, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 4 },
  sub: { color: C.muted, marginTop: 2 },
  h: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  stat: { width: "33.33%", padding: 3 },
  statBox: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 8 },
  statLabel: { fontSize: 7, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 3 },
  statSub: { fontSize: 8, color: C.muted, marginTop: 1 },
  rec: { flexDirection: "row", backgroundColor: C.tint, borderRadius: 6, padding: 8, marginBottom: 5 },
  recNum: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.primary, color: "white", fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 3, marginRight: 8 },
  bold: { fontFamily: "Helvetica-Bold" },
  incident: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 5 },
  table: { borderTopWidth: 1, borderTopColor: C.border },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 3 },
  th: { fontSize: 8, color: C.muted, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7, color: C.muted, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
});

// The built-in fonts drop these glyphs silently (e.g. "1–23 Nov" became "123 Nov"), so swap them for ASCII.
const plain = (t: string) => t.replace(/₂/g, "2").replace(/[–—]/g, "-").replace(/≈/g, "~").replace(/→/g, "->");

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.stat}>
      <View style={s.statBox}>
        <Text style={s.statLabel}>{label}</Text>
        <Text style={s.statValue}>{plain(value)}</Text>
        {sub ? <Text style={s.statSub}>{plain(sub)}</Text> : null}
      </View>
    </View>
  );
}

const cols = [
  { w: "22%", label: "Date" },
  { w: "20%", label: "Energy (kWh)" },
  { w: "20%", label: "Cost (AED)" },
  { w: "20%", label: "tCO2e" },
  { w: "18%", label: "Peak (kW)" },
];

export function ReportPdf({ r, logo }: { r: ReportData; logo?: string }) {
  const footer = `Prepared by Kuroshio FacilityIQ - generated ${fmtDate(r.generatedAt)} ${fmtTime(r.generatedAt)} GST. DEMO DATA: tariff and emission factor are demo assumptions.`;
  return (
    <Document title={`${r.buildingName} - monthly facility report`} author="Kuroshio AI" subject={r.periodLabel}>
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <View style={s.row}>
            {/* react-pdf Image, not an HTML img: no alt attribute exists here. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo ? <Image src={logo} style={s.logo} /> : <Text style={[s.bold, { color: C.brand, fontSize: 14 }]}>KUROSHIO AI</Text>}
            <Text style={s.demo}>Demo data</Text>
          </View>
          <Text style={s.kicker}>Monthly facility report</Text>
          <Text style={s.title}>{r.buildingName}</Text>
          <Text style={s.sub}>
            {r.area} - {r.type}
          </Text>
          <Text style={s.sub}>{plain(r.periodLabel)}</Text>
        </View>

        <Text style={s.h}>The month at a glance</Text>
        <View style={s.grid}>
          <Stat label="Monitoring uptime" value={fmtPct(r.uptimePct, 2)} sub="Meter data received" />
          <Stat label="Alarms handled" value={fmtNum(r.alarmsHandled)} sub={`${r.alarmsOpen} still open`} />
          <Stat
            label="SLA met"
            value={r.slaPct === null ? "-" : fmtPct(r.slaPct, 1)}
            sub={r.p1AvgResponseMin === null ? undefined : `P1 response ${fmtNum(r.p1AvgResponseMin)} min avg`}
          />
          <Stat
            label="Energy"
            value={fmtKwh(r.energyKwh)}
            sub={`${r.energyVsLastMonthPct < 0 ? "Down" : "Up"} ${fmtPct(Math.abs(r.energyVsLastMonthPct), 1)} vs last month`}
          />
          <Stat label="Cost" value={fmtAedEstimate(r.costAed)} sub="Demo tariff" />
          <Stat label="Scope 2 carbon" value={`${fmtNum(r.tco2e, 1)} tCO2e`} sub={`Factor ${r.factor} tCO2e/MWh`} />
        </View>
        <Text style={[s.sub, { fontSize: 8 }]}>
          Peak demand {fmtKw(r.peakKw)} - power factor {r.pf.toFixed(2)}
        </Text>

        <Text style={s.h}>Top 3 recommendations</Text>
        {r.recommendations.map((rec, i) => (
          <View key={rec.title} style={s.rec} wrap={false}>
            <Text style={s.recNum}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.bold}>{plain(rec.title)}</Text>
              <Text style={{ color: C.muted, marginTop: 2 }}>{plain(rec.detail)}</Text>
            </View>
          </View>
        ))}
        {!r.recommendations.length && <Text style={s.sub}>Nothing urgent this month.</Text>}

        <Text style={s.h}>Notable alarms this month</Text>
        {r.incidents.length ? (
          r.incidents.map((a) => (
            <View key={`${a.title}-${a.raisedAt}`} style={s.incident} wrap={false}>
              <Text style={[s.bold, { width: 24 }]}>{a.priority}</Text>
              <Text style={{ flex: 1 }}>
                <Text style={s.bold}>{plain(a.title)}</Text>
                <Text style={{ color: C.muted }}> - {plain(a.detail.replace(/·/g, "-"))}</Text>
              </Text>
              <Text style={{ width: 80, textAlign: "right", color: C.muted, fontSize: 8 }}>
                {fmtDate(a.raisedAt)} {fmtTime(a.raisedAt)}
                {"\n"}
                {a.status === "cleared" ? "Resolved" : "Open"}
              </Text>
            </View>
          ))
        ) : (
          <Text style={s.sub}>No critical or high-priority alarms this month.</Text>
        )}

        <Text style={s.footer} fixed>
          {footer}
        </Text>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={[s.h, { marginTop: 0 }]}>Daily data</Text>
        <View style={s.table}>
          <View style={s.tr}>
            {cols.map((c) => (
              <Text key={c.label} style={[s.th, { width: c.w }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {r.daily.map((d) => (
            <View key={d.day} style={s.tr} wrap={false}>
              <Text style={{ width: cols[0].w }}>
                {fmtDate(d.day)}
                {d.partial ? " (so far)" : ""}
              </Text>
              <Text style={{ width: cols[1].w }}>{fmtNum(d.kwh)}</Text>
              <Text style={{ width: cols[2].w }}>{fmtNum(d.costAed)}</Text>
              <Text style={{ width: cols[3].w }}>{fmtNum(d.tco2e, 2)}</Text>
              <Text style={{ width: cols[4].w }}>{fmtNum(d.peakKw)}</Text>
            </View>
          ))}
        </View>
        <Text style={s.footer} fixed>
          {footer}
        </Text>
      </Page>
    </Document>
  );
}
