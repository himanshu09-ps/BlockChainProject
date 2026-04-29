// Shipment co-pilot endpoint.
// POST { shipments?: [...], question?: string, draftShipment?: {...} }
// Returns { stats, summary, factualSummary, perShipment, draftPrediction, answer, source }

import {
  summarize,
  predictForShipment,
  plainEnglishSummary,
} from "../../lib/stats";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    shipments = [],
    question = "",
    draftShipment = null,
  } = req.body || {};

  const stats = summarize(shipments);
  const factualSummary = plainEnglishSummary(stats);

  const perShipment = (Array.isArray(shipments) ? shipments : []).map(
    (s, idx) => {
      const p = predictForShipment(s, stats);
      return {
        index: idx,
        receiver: s.receiver,
        sender: s.sender,
        distance: s.distance,
        price: s.price,
        status: s.status,
        pickupTime: s.pickupTime,
        deliveryTime: s.deliveryTime,
        isPaid: s.isPaid,
        eta: p.eta ? p.eta.toISOString() : null,
        fair: p.fair,
        anomaly: p.anomaly,
      };
    }
  );

  const draftPrediction = draftShipment
    ? (() => {
        const p = predictForShipment(draftShipment, stats);
        return {
          eta: p.eta ? p.eta.toISOString() : null,
          fair: p.fair,
          anomaly: p.anomaly,
        };
      })()
    : null;

  const apiKey = process.env.OPENAI_API_KEY;
  let answer = null;
  let nlSummary = factualSummary;
  let source = "stats";

  if (apiKey) {
    try {
      const systemPrompt =
        "You are a shipment analytics assistant for a blockchain dapp. " +
        "Be concise. Ground every claim strictly in the provided JSON stats. " +
        "Never invent numbers. If data is insufficient, say so. " +
        "Use plain English. Round numbers reasonably.";

      const userContent = question
        ? `Stats JSON:\n${JSON.stringify(
            stats,
            null,
            2
          )}\n\nFactual summary: ${factualSummary}\n\nUser question: ${question}\n\nAnswer in 1-3 sentences.`
        : `Stats JSON:\n${JSON.stringify(
            stats,
            null,
            2
          )}\n\nFactual summary: ${factualSummary}\n\nWrite a friendly 2-3 sentence summary highlighting the most interesting pattern (e.g., delivery speed, price-per-km, or status mix). If there are zero shipments, say so.`;

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (r.ok) {
        const data = await r.json();
        const text = (data?.choices?.[0]?.message?.content || "").trim();
        if (text) {
          if (question) answer = text;
          else nlSummary = text;
          source = "llm";
        }
      } else {
        const errText = await r.text().catch(() => "");
        console.error("copilot LLM error:", r.status, errText);
      }
    } catch (err) {
      console.error("copilot LLM exception:", err);
    }
  }

  return res.status(200).json({
    stats,
    summary: nlSummary,
    factualSummary,
    perShipment,
    draftPrediction,
    answer,
    source,
  });
}
