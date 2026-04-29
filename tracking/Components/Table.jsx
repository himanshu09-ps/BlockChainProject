import { useMemo } from "react";
import {
  summarize,
  predictForShipment,
  formatDate,
} from "../lib/stats";

export default ({ setCreateShipmentModel, allShipmentsdata }) => {
  const converTime = (time) => {
    const newTime = new Date(time);
    const dataTime = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(newTime);

    return dataTime;
  };

  const stats = useMemo(
    () => summarize(Array.isArray(allShipmentsdata) ? allShipmentsdata : []),
    [allShipmentsdata]
  );

  const riskClass = (level) =>
    ({
      ok: "bg-green-100 text-green-700",
      medium: "bg-amber-100 text-amber-700",
      high: "bg-red-100 text-red-700",
    }[level] || "bg-gray-100 text-gray-500");
  const riskText = (level) =>
    ({ ok: "OK", medium: "Review", high: "High" }[level] || "—");

  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8">
      <div className="items-start justify-between md:flex">
        <div className="max-w-lg">
          <h3 className="text-gray-800 text-xl font-bold sm:text-2xl">
            Create Tracking
          </h3>
          <p className="text-gray-600 mt-2">
            Lorem Ipsum is simply dummy text of the printing and typesetting
            industry.
          </p>
        </div>
        <div className="mt-3 md:mt-0">
          <p
            onClick={() => setCreateShipmentModel(true)}
            href="javascript:void(0)"
            className="inline-block px-4 py-2 text-white duration-150 font-medium bg-gray-800 hover:bg-gray-700 active:bg-gray-900 md:text-sm rounded-lg md:inline-flex"
          >
            Add Tracking
          </p>
        </div>
      </div>
      <div className="mt-12 shadow-sm border rounded-lg overflow-x-auto">
        <table className="w-full table-auto text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b">
            <tr>
              <th className="py-3 px-6">Sender</th>
              <th className="py-3 px-6">Recevier</th>
              <th className="py-3 px-6">PickupTime</th>
              <th className="py-3 px-6">Distance</th>
              <th className="py-3 px-6">Price</th>
              <th className="py-3 px-6">Delivery Time</th>
              <th className="py-3 px-6">Paid</th>
              <th className="py-3 px-6">Status</th>
              <th className="py-3 px-6">Predicted ETA</th>
              <th className="py-3 px-6">Risk</th>
            </tr>
          </thead>
          <tbody className="text-gray-600 divide-y">
            {allShipmentsdata?.map((shipment, idx) => {
              const pred = predictForShipment(shipment, stats);
              return (
                <tr key={idx}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {shipment.sender.slice(0, 15)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {shipment.receiver.slice(0, 15)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {converTime(shipment.pickupTime)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {shipment.distance} Km
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {shipment.price}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {shipment.deliveryTime}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {shipment.isPaid ? " Completed" : "Not Complete"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {shipment.status == 0
                      ? "Pending"
                      : shipment.status == 1
                      ? "IN_TRANSIT"
                      : "Delivered"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-indigo-700">
                    {shipment.status === 2
                      ? "—"
                      : pred.eta
                      ? formatDate(pred.eta)
                      : "Not enough data"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${riskClass(
                        pred.anomaly?.level
                      )}`}
                      title={(pred.anomaly?.reasons || []).join("; ")}
                    >
                      {riskText(pred.anomaly?.level)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
