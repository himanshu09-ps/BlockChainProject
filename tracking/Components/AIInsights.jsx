import { useEffect, useMemo, useState } from "react";
import {
  summarize,
  plainEnglishSummary,
  predictForShipment,
  formatEth,
  formatDate,
  STATUS_LABEL,
} from "../lib/stats";

export default function AIInsights({ allShipmentsdata }) {
  const shipments = useMemo(
    () => (Array.isArray(allShipmentsdata) ? allShipmentsdata : []),
    [allShipmentsdata]
  );

  const stats = useMemo(() => summarize(shipments), [shipments]);
  const localSummary = useMemo(() => plainEnglishSummary(stats), [stats]);
  const predictions = useMemo(
    () =>
      shipments.map((s, idx) => ({
        idx,
        ...s,
        ...predictForShipment(s, stats),
      })),
    [shipments, stats]
  );

  const [llmSummary, setLlmSummary] = useState("");
  const [llmSource, setLlmSource] = useState("stats");
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!shipments.length) {
      setLlmSummary("");
      return;
    }
    setLoadingSummary(true);
    fetch("/api/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipments }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setLlmSummary(data.summary || "");
        setLlmSource(data.source || "stats");
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoadingSummary(false));
    return () => {
      cancelled = true;
    };
  }, [shipments]);

  const ask = async () => {
    const q = question.trim();
    if (!q || chatLoading) return;
    setChatLoading(true);
    setChat((c) => [...c, { role: "user", text: q }]);
    setQuestion("");
    try {
      const r = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipments, question: q }),
      });
      const data = await r.json();
      const reply = data.answer || data.factualSummary || "No answer.";
      setChat((c) => [
        ...c,
        { role: "ai", text: reply, source: data.source || "stats" },
      ]);
    } catch (e) {
      setChat((c) => [
        ...c,
        { role: "ai", text: "Sorry, I couldn't reach the assistant.", source: "error" },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const suggestQs = [
    "Which shipments look risky?",
    "What's my average delivery time?",
    "Am I overpaying per km?",
    "Summarize my last few shipments.",
  ];

  return (
    <section className="max-w-screen-xl mx-auto px-4 md:px-8 mt-10">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-white shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-gray-800 text-lg font-semibold">
              AI Shipment Co-Pilot
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Live insights from your on-chain shipments — predictions,
              anomalies, and a chat that answers in plain English.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 font-medium">
            {llmSource === "llm" ? "LLM + stats" : "stats"}
          </span>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
          <Kpi label="Shipments" value={stats.total} />
          <Kpi label="Delivered" value={stats.delivered} />
          <Kpi label="In transit" value={stats.inTransit} />
          <Kpi
            label="Avg delivery"
            value={
              stats.avgDeliveryDays > 0
                ? `${stats.avgDeliveryDays.toFixed(1)} d`
                : "—"
            }
          />
          <Kpi
            label="Avg ETH/km"
            value={
              stats.avgPricePerKm > 0
                ? stats.avgPricePerKm.toExponential(2)
                : "—"
            }
          />
        </div>

        {/* Plain-English summary */}
        <div className="mt-5 rounded-xl bg-white border border-gray-200 p-4 text-sm text-gray-700">
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">
            Insight
          </div>
          {loadingSummary && !llmSummary ? (
            <div className="text-gray-400 text-sm">Analyzing…</div>
          ) : (
            <div>{llmSummary || localSummary}</div>
          )}
        </div>

        {/* Predictions table */}
        {predictions.length > 0 && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-xs md:text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Receiver</th>
                  <th className="py-2 px-3">Distance</th>
                  <th className="py-2 px-3">Price</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Predicted ETA</th>
                  <th className="py-2 px-3">Fair price</th>
                  <th className="py-2 px-3">Risk</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 divide-y">
                {predictions.map((p) => (
                  <tr key={p.idx}>
                    <td className="py-2 px-3 text-gray-400">{p.idx}</td>
                    <td className="py-2 px-3">
                      {(p.receiver || "—").slice(0, 10)}…
                    </td>
                    <td className="py-2 px-3">{p.distance ?? "—"} km</td>
                    <td className="py-2 px-3">{formatEth(p.price)}</td>
                    <td className="py-2 px-3">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="py-2 px-3">
                      {p.status === 2
                        ? formatDate(
                            p.deliveryTime ? new Date(p.deliveryTime) : null
                          )
                        : p.eta
                        ? formatDate(p.eta)
                        : "—"}
                    </td>
                    <td className="py-2 px-3">
                      {p.fair
                        ? `${p.fair.lo.toFixed(4)} – ${p.fair.hi.toFixed(4)}`
                        : "—"}
                    </td>
                    <td className="py-2 px-3">
                      <RiskBadge level={p.anomaly?.level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {predictions.some((p) => p.anomaly?.reasons?.length) && (
              <ul className="px-4 py-2 text-[11px] text-amber-700 list-disc pl-8 bg-amber-50 border-t">
                {predictions
                  .filter((p) => p.anomaly?.reasons?.length)
                  .slice(0, 5)
                  .map((p) => (
                    <li key={p.idx}>
                      <span className="font-medium">#{p.idx}:</span>{" "}
                      {p.anomaly.reasons.join("; ")}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {/* Chat */}
        <div className="mt-5">
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
            Ask the co-pilot
          </div>
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="max-h-56 overflow-y-auto p-3 space-y-2 text-sm">
              {chat.length === 0 && (
                <div className="text-gray-400 text-xs">
                  Try: {suggestQs.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setQuestion(q)}
                      className="ml-1 underline text-indigo-600 hover:text-indigo-800"
                    >
                      "{q}"
                    </button>
                  ))}
                </div>
              )}
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "text-gray-800"
                      : "text-indigo-800 bg-indigo-50 rounded-md p-2"
                  }
                >
                  <span className="text-[10px] uppercase tracking-wider mr-2 text-gray-400">
                    {m.role === "user" ? "You" : "AI"}
                  </span>
                  {m.text}
                </div>
              ))}
              {chatLoading && (
                <div className="text-xs text-gray-400">Thinking…</div>
              )}
            </div>
            <div className="flex items-center gap-2 border-t p-2">
              <input
                type="text"
                placeholder={
                  shipments.length
                    ? "Ask about your shipments…"
                    : "Connect wallet to load shipments first"
                }
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
                disabled={!shipments.length || chatLoading}
                className="flex-1 text-sm px-3 py-2 outline-none disabled:bg-gray-50"
              />
              <button
                onClick={ask}
                disabled={!shipments.length || chatLoading || !question.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className="text-lg font-semibold text-gray-800 mt-1">{value}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const idx = typeof status === "number" ? status : 0;
  const cls = [
    "bg-gray-100 text-gray-700",
    "bg-blue-100 text-blue-700",
    "bg-green-100 text-green-700",
  ][idx] || "bg-gray-100 text-gray-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {STATUS_LABEL[idx] || "—"}
    </span>
  );
}

function RiskBadge({ level }) {
  const map = {
    ok: "bg-green-100 text-green-700",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-red-100 text-red-700",
  };
  const text = { ok: "OK", medium: "Review", high: "High" }[level] || "—";
  const cls = map[level] || "bg-gray-100 text-gray-500";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
      {text}
    </span>
  );
}
