import { useState } from "react";
import { ethers } from "ethers";

export default function Assistant({ onDraft }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [preview, setPreview] = useState(null);
  const [source, setSource] = useState("");

  const validate = (draft) => {
    const w = [];
    if (!draft.receiver) {
      w.push("No receiver address detected. Add an address starting with 0x.");
    } else if (!ethers.utils.isAddress(draft.receiver)) {
      w.push("Receiver does not look like a valid Ethereum address.");
    }
    if (!draft.pickupTime) {
      w.push("No pickup date detected.");
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const picked = new Date(draft.pickupTime + "T00:00:00");
      if (picked < today) w.push("Pickup date is in the past.");
    }
    if (draft.distance == null) w.push("No distance detected.");
    if (!draft.price) w.push("No price detected.");
    return w;
  };

  const submit = async () => {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError("");
    setWarnings([]);
    setPreview(null);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Request failed");
      const draft = data.draft || {};
      setPreview(draft);
      setWarnings(validate(draft));
      setSource(data.source || "");
    } catch (e) {
      setError(e.message || "Could not draft shipment.");
    } finally {
      setLoading(false);
    }
  };

  const useDraft = () => {
    if (!preview) return;
    onDraft?.(preview);
    setOpen(false);
    setText("");
    setPreview(null);
    setWarnings([]);
    setError("");
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-20 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg px-5 py-3 text-sm font-medium"
        aria-label="AI Draft Shipment"
      >
        AI Draft
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-30 w-[24rem] max-w-[92vw] bg-white border border-gray-200 rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-800">
              Draft a shipment
            </h4>
            <button
              className="text-gray-400 hover:text-gray-600 text-sm"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Describe it in plain English. Example:{" "}
            <em>
              "Ship to 0xAbC...123 next Friday, ~540 km, budget 0.025 ETH."
            </em>
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Describe the shipment..."
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-2 outline-none focus:border-indigo-500"
          />
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          {preview && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              <div className="font-medium text-gray-800 mb-1">
                Parsed{source ? ` (${source})` : ""}
              </div>
              <div>
                <span className="text-gray-500">Receiver:</span>{" "}
                {preview.receiver || <em className="text-gray-400">—</em>}
              </div>
              <div>
                <span className="text-gray-500">Pickup:</span>{" "}
                {preview.pickupTime || <em className="text-gray-400">—</em>}
              </div>
              <div>
                <span className="text-gray-500">Distance:</span>{" "}
                {preview.distance != null ? (
                  `${preview.distance} km`
                ) : (
                  <em className="text-gray-400">—</em>
                )}
              </div>
              <div>
                <span className="text-gray-500">Price:</span>{" "}
                {preview.price ? (
                  `${preview.price} ETH`
                ) : (
                  <em className="text-gray-400">—</em>
                )}
              </div>
              {warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-amber-700">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={loading || !text.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg"
            >
              {loading ? "Drafting..." : preview ? "Re-draft" : "Draft"}
            </button>
            <button
              onClick={useDraft}
              disabled={!preview}
              className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg"
            >
              Use in form
            </button>
          </div>
        </div>
      )}
    </>
  );
}
