import React, { useState, useEffect, useContext, useCallback } from "react";

//INTERNAL IMPORT
import {
  Table,
  Form,
  Services,
  Profile,
  CompleteShipment,
  GetShipment,
  StartShipment,
  Assistant,
  AIInsights,
} from "../Components/index";
import { TrackingContext } from "../Conetxt/TrackingContext";

const index = () => {
  const {
    currentUser,
    createShipment,
    getAllShipment,
    completeShipment,
    getShipment,
    startShipment,
    getShipmentsCount,
  } = useContext(TrackingContext);

  //STATE VARIABLE
  const [createShipmentModel, setCreateShipmentModel] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const [startModal, setStartModal] = useState(false);
  const [completeModal, setCompleteModal] = useState(false);
  const [getModel, setGetModel] = useState(false);
  //DATA STATE VARIABLE
  const [allShipmentsdata, setallShipmentsdata] = useState([]);
  const [aiDraft, setAiDraft] = useState(null);
  const [txError, setTxError] = useState(null);
  const [txBusy, setTxBusy] = useState(false);

  const loadShipments = useCallback(async () => {
    try {
      const data = await getAllShipment();
      setallShipmentsdata(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("loadShipments failed", err);
      setallShipmentsdata([]);
    }
  }, [getAllShipment]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadShipments();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadShipments]);

  const runTx = useCallback(
    async (label, fn) => {
      setTxError(null);
      setTxBusy(true);
      try {
        await fn();
        await loadShipments();
        return true;
      } catch (err) {
        console.error(`[${label}] failed`, err);
        const reason =
          err?.reason ||
          err?.data?.message ||
          err?.message ||
          "Transaction failed";
        setTxError(`${label}: ${reason}`);
        return false;
      } finally {
        setTxBusy(false);
      }
    },
    [loadShipments]
  );

  const handleCreate = useCallback(
    async (items) => {
      const ok = await runTx("Create shipment", () => createShipment(items));
      if (ok) setCreateShipmentModel(false);
    },
    [runTx, createShipment]
  );

  const handleStart = useCallback(
    async (getProduct) => {
      const ok = await runTx("Start shipment", () =>
        startShipment(getProduct)
      );
      if (ok) setStartModal(false);
    },
    [runTx, startShipment]
  );

  const handleComplete = useCallback(
    async (completeShip) => {
      const ok = await runTx("Complete shipment", () =>
        completeShipment(completeShip)
      );
      if (ok) setCompleteModal(false);
    },
    [runTx, completeShipment]
  );

  return (
    <>
      <Services
        setOpenProfile={setOpenProfile}
        setCompleteModal={setCompleteModal}
        setGetModel={setGetModel}
        setStartModal={setStartModal}
      />

      {txError && (
        <div className="max-w-screen-xl mx-auto mt-4 px-4 md:px-8">
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-3"
          >
            <span>{txError}</span>
            <button
              onClick={() => setTxError(null)}
              className="text-red-500 hover:text-red-700"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {txBusy && (
        <div className="max-w-screen-xl mx-auto mt-4 px-4 md:px-8">
          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
            Transaction in progress… please confirm in MetaMask.
          </div>
        </div>
      )}

      <AIInsights allShipmentsdata={allShipmentsdata} />

      <Table
        setCreateShipmentModel={setCreateShipmentModel}
        allShipmentsdata={allShipmentsdata}
      />
      <Form
        createShipmentModel={createShipmentModel}
        createShipment={handleCreate}
        setCreateShipmentModel={setCreateShipmentModel}
        initialShipment={aiDraft}
        allShipmentsdata={allShipmentsdata}
      />
      <Profile
        openProfile={openProfile}
        setOpenProfile={setOpenProfile}
        currentUser={currentUser}
        getShipmentsCount={getShipmentsCount}
      />
      <CompleteShipment
        completeModal={completeModal}
        setCompleteModal={setCompleteModal}
        completeShipment={handleComplete}
      />
      <GetShipment
        getModel={getModel}
        setGetModel={setGetModel}
        getShipment={getShipment}
      />
      <StartShipment
        startModal={startModal}
        setStartModal={setStartModal}
        startShipment={handleStart}
      />
      <Assistant
        allShipmentsdata={allShipmentsdata}
        onDraft={(draft) => {
          setAiDraft(draft);
          setCreateShipmentModel(true);
        }}
      />
    </>
  );
};

export default index;
