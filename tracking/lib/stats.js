// Pure-JS shipment analytics. Works in browser and Node.
// Shipment shape (from getAllShipment):
//   { sender, receiver, price: string ETH, pickupTime: number (s),
//     deliveryTime: number (s), distance: number km, isPaid, status }

export const STATUS = { PENDING: 0, IN_TRANSIT: 1, DELIVERED: 2 };

export const STATUS_LABEL = ["Pending", "In transit", "Delivered"];

export function toNumber(x) {
  if (typeof x === "number") return Number.isFinite(x) ? x : 0;
  if (typeof x === "string") {
    const v = parseFloat(x);
    return Number.isFinite(v) ? v : 0;
  }
  if (x && typeof x.toNumber === "function") {
    try {
      return x.toNumber();
    } catch {
      return 0;
    }
  }
  return 0;
}

export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

export function summarize(shipments = []) {
  const list = Array.isArray(shipments) ? shipments : [];
  const total = list.length;
  const pending = list.filter((s) => s.status === STATUS.PENDING).length;
  const inTransit = list.filter((s) => s.status === STATUS.IN_TRANSIT).length;
  const delivered = list.filter((s) => s.status === STATUS.DELIVERED).length;

  const totalSpentEth = list.reduce((a, s) => a + toNumber(s.price), 0);
  const distances = list
    .map((s) => toNumber(s.distance))
    .filter((x) => x > 0);
  const prices = list.map((s) => toNumber(s.price)).filter((x) => x > 0);

  const pricePerKmArr = list
    .filter((s) => toNumber(s.distance) > 0 && toNumber(s.price) > 0)
    .map((s) => toNumber(s.price) / toNumber(s.distance));

  const deliveredOnes = list.filter(
    (s) =>
      s.status === STATUS.DELIVERED &&
      toNumber(s.deliveryTime) > 0 &&
      toNumber(s.pickupTime) > 0
  );
  const deliveryDays = deliveredOnes
    .map(
      (s) =>
        (toNumber(s.deliveryTime) - toNumber(s.pickupTime)) / 86400
    )
    .filter((x) => x > 0 && x < 365);
  const secondsPerKmArr = deliveredOnes
    .map((s) => {
      const d = toNumber(s.distance);
      const t = toNumber(s.deliveryTime) - toNumber(s.pickupTime);
      return d > 0 && t > 0 ? t / d : null;
    })
    .filter((x) => x != null && x > 0);

  const knownReceivers = Array.from(
    new Set(
      list
        .map((s) => (s.receiver || "").toLowerCase())
        .filter((r) => /^0x[a-f0-9]{40}$/.test(r))
    )
  );

  return {
    total,
    pending,
    inTransit,
    delivered,
    totalSpentEth,
    avgDistance: mean(distances),
    avgPriceEth: mean(prices),
    avgDeliveryDays: mean(deliveryDays),
    avgPricePerKm: mean(pricePerKmArr),
    pricePerKmStd: stddev(pricePerKmArr),
    avgSecondsPerKm: mean(secondsPerKmArr),
    sampleSize: deliveredOnes.length,
    knownReceivers,
  };
}

export function predictEta({ pickupTime, distance, secondsPerKm }) {
  const d = toNumber(distance);
  const sp = toNumber(secondsPerKm);
  if (d <= 0 || sp <= 0) return null;
  const startMs =
    toNumber(pickupTime) > 0 ? toNumber(pickupTime) * 1000 : Date.now();
  return new Date(startMs + d * sp * 1000);
}

export function fairPriceRange({ distance, avgPricePerKm, pricePerKmStd }) {
  const d = toNumber(distance);
  const m = toNumber(avgPricePerKm);
  const s = toNumber(pricePerKmStd);
  if (d <= 0 || m <= 0) return null;
  const lo = Math.max(0, (m - 0.5 * s) * d);
  const hi = (m + 0.5 * s) * d;
  return { lo, hi, mid: m * d };
}

export function anomalyScore(shipment, stats) {
  const reasons = [];
  let level = "ok"; // "ok" | "medium" | "high"
  const distance = toNumber(shipment.distance);
  const price = toNumber(shipment.price);

  if (stats.pricePerKmStd > 0 && distance > 0 && price > 0) {
    const x = price / distance;
    const z = (x - stats.avgPricePerKm) / stats.pricePerKmStd;
    if (Math.abs(z) >= 2) {
      level = "high";
      reasons.push(
        `Price-per-km ${z > 0 ? "well above" : "well below"} average (z=${z.toFixed(
          2
        )})`
      );
    } else if (Math.abs(z) >= 1) {
      if (level === "ok") level = "medium";
      reasons.push(
        `Price-per-km ${z > 0 ? "above" : "below"} typical for this distance`
      );
    }
  }

  const r = (shipment.receiver || "").toLowerCase();
  if (
    r &&
    /^0x[a-f0-9]{40}$/.test(r) &&
    stats.knownReceivers.length > 0 &&
    !stats.knownReceivers.includes(r)
  ) {
    if (level === "ok") level = "medium";
    reasons.push("Receiver address never used before");
  }

  return { level, reasons };
}

export function predictForShipment(shipment, stats) {
  const distance = toNumber(shipment.distance);
  return {
    eta: predictEta({
      pickupTime: shipment.pickupTime,
      distance,
      secondsPerKm: stats.avgSecondsPerKm,
    }),
    fair: fairPriceRange({
      distance,
      avgPricePerKm: stats.avgPricePerKm,
      pricePerKmStd: stats.pricePerKmStd,
    }),
    anomaly: anomalyScore(shipment, stats),
  };
}

export function plainEnglishSummary(stats) {
  if (!stats || !stats.total)
    return "No shipments yet. Create one to start collecting data.";
  const parts = [
    `You have ${stats.total} shipment${stats.total === 1 ? "" : "s"}: ` +
      `${stats.delivered} delivered, ${stats.inTransit} in transit, ${stats.pending} pending.`,
  ];
  if (stats.totalSpentEth > 0) {
    parts.push(`Total value moved: ${stats.totalSpentEth.toFixed(4)} ETH.`);
  }
  if (stats.avgDeliveryDays > 0) {
    parts.push(
      `Average delivery time: ${stats.avgDeliveryDays.toFixed(1)} days (n=${stats.sampleSize}).`
    );
  }
  if (stats.avgPricePerKm > 0) {
    parts.push(
      `Average price-per-km: ${stats.avgPricePerKm.toFixed(6)} ETH ` +
        `(±${stats.pricePerKmStd.toFixed(6)}).`
    );
  }
  return parts.join(" ");
}

export function formatEth(n) {
  const v = toNumber(n);
  if (v === 0) return "0 ETH";
  if (v < 0.0001) return `${v.toExponential(2)} ETH`;
  return `${v.toFixed(4)} ETH`;
}

export function formatDate(d) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}
