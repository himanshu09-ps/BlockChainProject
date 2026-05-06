import React, { useState } from "react";
import Web3Modal from "web3modal";
import { ethers } from "ethers";

//INTERNAL IMPORT
import tracking from "../Conetxt/Tracking.json";
// //HARDHAT ADDRESS
//  const ContractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ContractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
//holesky ADDRESS
//const ContractAddress = "0xf9a8D1CB9763d9452998B3f89FF016Bac168f824";
const ContractABI = tracking.abi;

//---FETCHING SMART CONTRACT
const fetchContract = (signerOrProvider) =>
  new ethers.Contract(ContractAddress, ContractABI, signerOrProvider);

//NETWORK----

//NETWORK
const networks = {
  holesky: {
    chainId: `0x${Number(17000).toString(16)}`,
    chainName: "Holesky",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.ankr.com/eth_holesky"],
    blockExplorerUrls: ["https://holesky.etherscan.io/"],
  },
  polygon_amoy: {
    chainId: `0x${Number(80002).toString(16)}`,
    chainName: "Polygon Amoy",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.ankr.com/polygon_amoy"],
    blockExplorerUrls: ["https://www.oklink.com/amoy"],
  },
  polygon_mumbai: {
    chainId: `0x${Number(80001).toString(16)}`,
    chainName: "Polygon Mumbai",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.ankr.com/polygon_mumbai"],
    blockExplorerUrls: ["https://mumbai.polygonscan.com/"],
  },
  polygon: {
    chainId: `0x${Number(137).toString(16)}`,
    chainName: "Polygon Mainnet",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.ankr.com/polygon"],
    blockExplorerUrls: ["https://polygonscan.com/"],
  },
  bsc: {
    chainId: `0x${Number(56).toString(16)}`,
    chainName: "Binance Smart Chain Mainnet",
    nativeCurrency: {
      name: "Binance Chain Native Token",
      symbol: "BNB",
      decimals: 18,
    },
    rpcUrls: ["https://rpc.ankr.com/bsc"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
  base_mainnet: {
    chainId: `0x${Number(8453).toString(16)}`,
    chainName: "Base Mainnet",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://mainnet.base.org/"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
  base_sepolia: {
    chainId: `0x${Number(84532).toString(16)}`,
    chainName: "Base Sepolia",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
  localhost: {
    chainId: `0x${Number(1337).toString(16)}`,
    chainName: "localhost",
    nativeCurrency: {
      name: "ETH",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: ["http://127.0.0.1:8545/"],
    blockExplorerUrls: ["https://bscscan.com"],
  },
};

const changeNetwork = async ({ networkName }) => {
  if (!window.ethereum) throw new Error("No crypto wallet found");
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        ...networks[networkName],
      },
    ],
  });
};

export const handleNetworkSwitch = async () => {
  const networkName = "localhost";
  try {
    await changeNetwork({ networkName });
    return true;
  } catch (err) {
    console.error("[network] switch failed:", err);
    return false;
  }
};
//END  OF NETWORK-------

export const TrackingContext = React.createContext();

export const TrackingProvider = ({ children }) => {
  //STATE VARIABLE
  const DappName = "Product Tracking Dapp";
  const [currentUser, setCurrentUser] = useState("");

  // Returns the connected account address, or null if anything is off.
  const checkIfWalletConnected = async () => {
    try {
      if (typeof window === "undefined" || !window.ethereum) {
        console.warn("[wallet] MetaMask not installed");
        return null;
      }
      await handleNetworkSwitch();
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts && accounts.length) {
        setCurrentUser(accounts[0]);
        return accounts[0];
      }
      return null;
    } catch (error) {
      console.error("[wallet] checkIfWalletConnected failed:", error);
      return null;
    }
  };

  const getSignerContract = async () => {
    const web3Modal = new Web3Modal();
    const connection = await web3Modal.connect();
    const provider = new ethers.providers.Web3Provider(connection);
    const signer = provider.getSigner();
    return fetchContract(signer);
  };

  const getReadOnlyContract = async () => {
    const web3Modal = new Web3Modal();
    const connection = await web3Modal.connect();
    const provider = new ethers.providers.Web3Provider(connection);
    return fetchContract(provider);
  };

  const createShipment = async (items) => {
    const { receiver, pickupTime, distance, price } = items || {};

    if (!receiver || !ethers.utils.isAddress(receiver)) {
      throw new Error("Invalid receiver address");
    }
    if (!pickupTime) {
      throw new Error("Pickup time is required");
    }
    const distanceNum = Number(distance);
    if (!Number.isFinite(distanceNum) || distanceNum <= 0) {
      throw new Error("Distance must be a positive number");
    }
    const priceStr = String(price ?? "").trim();
    if (!priceStr || Number.isNaN(Number(priceStr)) || Number(priceStr) <= 0) {
      throw new Error("Price must be a positive number (in ETH)");
    }

    const address = await checkIfWalletConnected();
    if (!address) throw new Error("Wallet not connected");

    const contract = await getSignerContract();
    const priceWei = ethers.utils.parseUnits(priceStr, 18);

    const tx = await contract.createShipment(
      receiver,
      Math.floor(new Date(pickupTime).getTime() / 1000),
      Math.floor(distanceNum),
      priceWei,
      { value: priceWei }
    );
    const receipt = await tx.wait();
    console.log("[createShipment] mined", receipt.transactionHash);
    return receipt;
  };

  const getAllShipment = async () => {
    try {
      const address = await checkIfWalletConnected();
      if (!address) return [];

      const contract = await getReadOnlyContract();
      const shipments = await contract.getAllTransactions();

      return shipments.map((shipment) => ({
        sender: shipment.sender,
        receiver: shipment.receiver,
        price: ethers.utils.formatEther(shipment.price.toString()),
        pickupTime: shipment.pickupTime.toNumber() * 1000,
        deliveryTime: shipment.deliveryTime.toNumber() * 1000,
        distance: shipment.distance.toNumber(),
        isPaid: shipment.isPaid,
        status: shipment.status,
      }));
    } catch (error) {
      console.error("[getAllShipment] failed:", error);
      return [];
    }
  };

  const getShipmentsCount = async () => {
    try {
      const address = await checkIfWalletConnected();
      if (!address) return 0;

      const contract = await getReadOnlyContract();
      const shipmentsCount = await contract.getShipmentsCount(address);
      return shipmentsCount.toNumber();
    } catch (error) {
      console.error("[getShipmentsCount] failed:", error);
      return 0;
    }
  };

  const completeShipment = async (completeShip) => {
    const { recevier, index } = completeShip || {};

    if (!recevier || !ethers.utils.isAddress(recevier)) {
      throw new Error("Invalid receiver address");
    }
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0) {
      throw new Error("Invalid shipment index");
    }

    const address = await checkIfWalletConnected();
    if (!address) throw new Error("Wallet not connected");

    const contract = await getSignerContract();
    const tx = await contract.completeShipment(address, recevier, idx, {
      gasLimit: 300000,
    });
    const receipt = await tx.wait();
    console.log("[completeShipment] mined", receipt.transactionHash);
    return receipt;
  };

  const getShipment = async (index) => {
    try {
      const address = await checkIfWalletConnected();
      if (!address) return null;

      const contract = await getReadOnlyContract();
      const shipment = await contract.getShipment(address, Number(index));

      return {
        sender: shipment[0],
        receiver: shipment[1],
        pickupTime: shipment[2].toNumber() * 1000,
        deliveryTime: shipment[3].toNumber() * 1000,
        distance: shipment[4].toNumber(),
        price: ethers.utils.formatEther(shipment[5].toString()),
        status: shipment[6],
        isPaid: shipment[7],
      };
    } catch (error) {
      console.error("[getShipment] failed:", error);
      return null;
    }
  };

  const startShipment = async (getProduct) => {
    const { reveiver, index } = getProduct || {};

    if (!reveiver || !ethers.utils.isAddress(reveiver)) {
      throw new Error("Invalid receiver address");
    }
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0) {
      throw new Error("Invalid shipment index");
    }

    const address = await checkIfWalletConnected();
    if (!address) throw new Error("Wallet not connected");

    const contract = await getSignerContract();
    const tx = await contract.startShipment(address, reveiver, idx, {
      gasLimit: 300000,
    });
    const receipt = await tx.wait();
    console.log("[startShipment] mined", receipt.transactionHash);
    return receipt;
  };

  //---CONNET WALLET FUNCTION
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Install MetaMask");
        return null;
      }
      await handleNetworkSwitch();
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts.length) {
        setCurrentUser(accounts[0]);
        return accounts[0];
      }
      return null;
    } catch (error) {
      console.error("[connectWallet] failed:", error);
      return null;
    }
  };

  return (
    <TrackingContext.Provider
      value={{
        connectWallet,
        createShipment,
        getAllShipment,
        completeShipment,
        getShipment,
        startShipment,
        getShipmentsCount,
        DappName,
        currentUser,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
};
