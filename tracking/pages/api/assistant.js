// Natural-language -> shipment draft.
// POST { text: string } -> { draft: { receiver, pickupTime, distance, price }, source }
//
// Set OPENAI_API_KEY (and optionally OPENAI_MODEL, default: gpt-4o-mini) in .env.local
// to enable the LLM. Without a key, a deterministic regex fallback is used so the
// feature still works in development.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing 'text' string in body." });
  }

  const today = new Date().toISOString().slice(0, 10);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res
      .status(200)
      .json({ draft: heuristicExtract(text, today), source: "heuristic" });
  }

  const systemPrompt = `You extract structured shipment fields from a user's natural-language request.
Return ONLY a compact JSON object with exactly these keys: receiver, pickupTime, distance, price.
Rules:
- receiver: a string Ethereum address matching ^0x[a-fA-F0-9]{40}$. If none is present, use null.
- pickupTime: an ISO calendar date "YYYY-MM-DD". Resolve relative dates (e.g., "next Friday", "tomorrow") using today's date ${today}. If unspecified, use null.
- distance: an integer number of kilometers. If the user gives miles, convert to km and round. If unspecified, use null.
- price: a string representing the ETH amount (e.g., "0.025"). Numbers only, no currency symbols. If unspecified, use null.
Do not invent addresses. Do not include any other keys, comments, or prose. Output strictly valid JSON.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("OpenAI error:", r.status, errText);
      return res.status(200).json({
        draft: heuristicExtract(text, today),
        source: "heuristic-fallback",
      });
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }
    return res
      .status(200)
      .json({ draft: normalize(parsed, today), source: "llm" });
  } catch (err) {
    console.error("assistant route error:", err);
    return res
      .status(200)
      .json({ draft: heuristicExtract(text, today), source: "heuristic-error" });
  }
}

function normalize(d, _today) {
  const out = { receiver: null, pickupTime: null, distance: null, price: null };
  if (!d || typeof d !== "object") return out;

  if (
    typeof d.receiver === "string" &&
    /^0x[a-fA-F0-9]{40}$/.test(d.receiver.trim())
  ) {
    out.receiver = d.receiver.trim();
  }
  if (
    typeof d.pickupTime === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(d.pickupTime)
  ) {
    out.pickupTime = d.pickupTime;
  }
  if (typeof d.distance === "number" && Number.isFinite(d.distance)) {
    out.distance = Math.max(0, Math.round(d.distance));
  } else if (
    typeof d.distance === "string" &&
    /^\d+(\.\d+)?$/.test(d.distance.trim())
  ) {
    out.distance = Math.max(0, Math.round(parseFloat(d.distance)));
  }
  if (typeof d.price === "number" && Number.isFinite(d.price)) {
    out.price = String(d.price);
  } else if (
    typeof d.price === "string" &&
    /^\d+(\.\d+)?$/.test(d.price.trim())
  ) {
    out.price = d.price.trim();
  }
  return out;
}

function heuristicExtract(text, today) {
  const out = { receiver: null, pickupTime: null, distance: null, price: null };

  const addrMatch = text.match(/0x[a-fA-F0-9]{40}/);
  if (addrMatch) out.receiver = addrMatch[0];

  const kmMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:km|kilometers?|kms)\b/i);
  const milesMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:mi|miles?)\b/i);
  if (kmMatch) {
    out.distance = Math.round(parseFloat(kmMatch[1]));
  } else if (milesMatch) {
    out.distance = Math.round(parseFloat(milesMatch[1]) * 1.60934);
  }

  const ethMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:eth|ether)\b/i) ||
    text.match(/(?:budget|price|for)\s*(?:of\s*)?(\d+(?:\.\d+)?)/i);
  if (ethMatch) out.price = ethMatch[1];

  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    out.pickupTime = isoMatch[1];
  } else {
    const lower = text.toLowerCase();
    const base = new Date(today + "T00:00:00");
    if (lower.includes("today")) {
      out.pickupTime = today;
    } else if (lower.includes("tomorrow")) {
      const d = new Date(base);
      d.setDate(d.getDate() + 1);
      out.pickupTime = d.toISOString().slice(0, 10);
    } else {
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      for (let i = 0; i < days.length; i++) {
        if (lower.includes(days[i])) {
          const d = new Date(base);
          let diff = (i - d.getDay() + 7) % 7;
          if (diff === 0) diff = 7;
          d.setDate(d.getDate() + diff);
          out.pickupTime = d.toISOString().slice(0, 10);
          break;
        }
      }
    }
  }
  return out;
}
