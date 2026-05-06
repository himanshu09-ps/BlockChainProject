import { useState, useEffect, useMemo } from "react";
import {
  summarize,
  predictForShipment,
  formatDate,
} from "../lib/stats";

export default ({
  setCreateShipmentModel,
  createShipmentModel,
  createShipment,
  initialShipment,
  allShipmentsdata,
}) => {
  const [shipment, setShipment] = useState({
    receiver: "",
    pickupTime: "",
    distance: "",
    price: "",
  });

  useEffect(() => {
    if (!createShipmentModel) return;
    if (initialShipment) {
      setShipment({
        receiver: initialShipment.receiver || "",
        pickupTime: initialShipment.pickupTime || "",
        distance:
          initialShipment.distance != null
            ? String(initialShipment.distance)
            : "",
        price:
          initialShipment.price != null ? String(initialShipment.price) : "",
      });
    } else {
      setShipment({ receiver: "", pickupTime: "", distance: "", price: "" });
    }
  }, [createShipmentModel, initialShipment]);

  const stats = useMemo(
    () => summarize(Array.isArray(allShipmentsdata) ? allShipmentsdata : []),
    [allShipmentsdata]
  );

  const livePrediction = useMemo(() => {
    const distance = parseFloat(shipment.distance);
    const price = parseFloat(shipment.price);
    const pickupSeconds = shipment.pickupTime
      ? Math.floor(new Date(shipment.pickupTime).getTime() / 1000)
      : 0;
    if (!distance) return null;
    return predictForShipment(
      {
        receiver: shipment.receiver,
        distance,
        price: Number.isFinite(price) ? price : 0,
        pickupTime: pickupSeconds,
      },
      stats
    );
  }, [shipment, stats]);

  const createItem = async () => {
    try {
      await createShipment(shipment);
    } catch (error) {
      console.log("Wrong creating item");
    }
  };
  return createShipmentModel ? (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div
        className="fixed inset-0 w-full h-full bg-black opacity-40"
        onClick={() => setCreateShipmentModel(false)}
      ></div>
      <div className="flex items-center min-h-screen px-4 py-8">
        <div className="relative w-full max-w-lg p-4 mx-auto bg-white rounded-md shadow-lg">
          <div className="flex justify-end">
            <button
              className="p-2 text-gray-400 rounded-md hover:bg-gray-100"
              onClick={() => setCreateShipmentModel(false)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 mx-auto"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
          <div className="max-w-sm mx-auto py-3 space-y-3 text-center">
            <h4 className="text-lg font-medium text-gray-800">
              Track product, Create Shipment
            </h4>
            <p className="text-[15px] text-gray-600">
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat.
            </p>
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="relative mt-3">
                <input
                  type="text"
                  placeholder="receiver"
                  value={shipment.receiver}
                  className="w-full pl-5 pr-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg"
                  onChange={(e) =>
                    setShipment({
                      ...shipment,
                      receiver: e.target.value,
                    })
                  }
                />
              </div>
              <div className="relative mt-3">
                <input
                  type="date"
                  placeholder="pickupTime"
                  value={shipment.pickupTime}
                  className="w-full pl-5 pr-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg"
                  onChange={(e) =>
                    setShipment({
                      ...shipment,
                      pickupTime: e.target.value,
                    })
                  }
                />
              </div>
              <div className="relative mt-3">
                <input
                  type="text"
                  placeholder="distance"
                  value={shipment.distance}
                  className="w-full pl-5 pr-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg"
                  onChange={(e) =>
                    setShipment({
                      ...shipment,
                      distance: e.target.value,
                    })
                  }
                />
              </div>
              <div className="relative mt-3">
                <input
                  type="text"
                  placeholder="price"
                  value={shipment.price}
                  className="w-full pl-5 pr-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg"
                  onChange={(e) =>
                    setShipment({
                      ...shipment,
                      price: e.target.value,
                    })
                  }
                />
              </div>

              {livePrediction &&
                (livePrediction.eta ||
                  livePrediction.fair ||
                  livePrediction.anomaly?.reasons?.length) && (
                  <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-left text-xs text-gray-700">
                    <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-medium mb-1">
                      AI prediction
                    </div>
                    {livePrediction.eta && (
                      <div>
                        Predicted delivery:{" "}
                        <span className="font-medium">
                          {formatDate(livePrediction.eta)}
                        </span>{" "}
                        <span className="text-gray-400">
                          (n={stats.sampleSize})
                        </span>
                      </div>
                    )}
                    {livePrediction.fair && (
                      <div>
                        Fair price range:{" "}
                        <span className="font-medium">
                          {livePrediction.fair.lo.toFixed(4)} –{" "}
                          {livePrediction.fair.hi.toFixed(4)} ETH
                        </span>
                      </div>
                    )}
                    {livePrediction.anomaly?.reasons?.length > 0 && (
                      <div className="text-amber-700 mt-1">
                        ⚠ {livePrediction.anomaly.reasons.join("; ")}
                      </div>
                    )}
                  </div>
                )}

              <button
                onClick={() => createItem()}
                className="block w-full mt-3 py-3 px-4 font-medium text-sm text-center text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg ring-offset-2 ring-indigo-600 focus:ring-2"
              >
                Create Shipment
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  ) : (
    ""
  );
};
