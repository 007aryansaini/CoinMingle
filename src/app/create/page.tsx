"use client";
import {
  useAccount,
  useNetwork,
  useSwitchNetwork,
  useWaitForTransaction,
  useWalletClient,
} from "wagmi";
import { ChangeEvent, FormEvent, useState, memo } from "react";
import { Interface, concat, hexlify } from "ethers/lib/utils";
import { Toaster, toast } from "react-hot-toast";
import { TransactionReceipt } from "viem";
import { ACTIVE_CHAIN, EXPLORER } from "@config";
import Token from "@abis/token.json";

const CreateERC20 = () => {
  const [deployedData, setDeployedData] = useState<`0x${string}`>();
  const [contractAddress, setContractAddress] = useState<`0x${string}` | null>(
    null
  );
  const [isDeploying, setIsDeploying] = useState(false);
  const [tokenData, setTokenData] = useState({
    name: "",
    symbol: "",
    decimals: 18,
    supply: 10000,
  });

  /** @dev Wagmi hooks to check wallet connected and get signer */
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  /** @dev switching chain if not connected to ftm */
  const { chain: connectedChain } = useNetwork();
  const { isLoading: isSwitchingChain, switchNetworkAsync } = useSwitchNetwork({
    chainId: ACTIVE_CHAIN.id,
  });

  /** @dev Handling form changing event */
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTokenData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  /** @dev Handling onTransactionReceipt (MINE) */
  const onReceipt = async (data: TransactionReceipt) => {
    setContractAddress(data.contractAddress);
    toast.success(`Deployed :)`);
    toast.success(
      <a
        target="_blank"
        href={`${EXPLORER}/address/${data.contractAddress}`}
        className="underline"
      >
        View Transaction
      </a>
    );
  };

  /** @dev Handling onTransactionError */
  const onError = async (err: Error) => {
    toast.error(err.name);
    console.log(err);
  };

  /** @dev Handling form submission */
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    /** @dev If wallet is not connected then return with error */
    if (!isConnected) {
      toast.error(`Connect wallet first :(`);
      return;
    }

    /** @dev Switching chain if correct chain is not connected */
    if (connectedChain?.id != ACTIVE_CHAIN.id) {
      try {
        switchNetworkAsync && (await switchNetworkAsync());
      } catch (e: any) {
        onError(e);
      }
      return;
    }

    /** @dev If wallet is connected then processed deployment */
    setIsDeploying(true);
    const loadingTost = toast.loading(`Creating ${tokenData.name} ...`);

    try {
      const params = new Interface(Token.abi).encodeDeploy([
        tokenData.name,
        tokenData.symbol,
        tokenData.decimals || 18,
        tokenData.supply || 10000,
      ]);
      const tx = await walletClient?.sendTransaction({
        // @ts-ignore
        data: hexlify(concat([Token.bytecode, params])),
        chain: ACTIVE_CHAIN,
      });
      setDeployedData(tx);
    } catch (e: any) {
      onError(e);
    } finally {
      setIsDeploying(false);
      toast.dismiss(loadingTost);
      setTokenData({
        name: "",
        symbol: "",
        decimals: 18,
        supply: 10000,
      });
    }
  };

  /** @dev Waiting for tx to mine */
  const { isFetching } = useWaitForTransaction({
    hash: deployedData,
    onSuccess: onReceipt,
    onError,
  });

  return (
    <div className="flex flex-col h-full justify-center text-center text-white">
      <header>
        <h1 className="text-2xl font-medium">Create ERC20 Token</h1>
        <p className="text-md text-slate-300 mt-4 w-[85%] md:w-[70%] lg:w-[60%] m-auto">
          Create our own ERC20 tokens on the FANTOM network. This feature can be
          valuable for launching new projects or enhancing liquidity by
          introducing new tokens.
        </p>
        <div className="pt-5">
          {contractAddress && (
            <a
              target="_blank"
              href={`${EXPLORER}/address/${contractAddress}`}
              className="underline"
            >
              Contract: {contractAddress}
            </a>
          )}
        </div>
      </header>
      <div className="pt-2 p-12 md:w-[85%] lg:w-[75%] md:self-center">
        <form onSubmit={onSubmit} className="flex flex-col gap-12 text-sm">
          <div className="flex flex-col justify-center items-start">
            <label htmlFor="#name" className="font-medium text-md">
              Name
            </label>
            <input
              type="text"
              placeholder="Coin Mingle"
              id="name"
              name="name"
              className="w-full h-10 px-4 bg-transparent border-b-2 transition-all focus:border-b-green-500 outline-none"
              onChange={(e) => onChange(e)}
              value={tokenData.name}
              required
            />
          </div>

          <div className="flex flex-col justify-center items-start">
            <label htmlFor="#symbol" className="font-medium text-md">
              Symbol
            </label>
            <input
              type="text"
              id="symbol"
              placeholder="COM"
              className="w-full h-10 px-4 bg-transparent border-b-2 transition-all focus:border-b-green-500 outline-none"
              onChange={(e) => onChange(e)}
              name="symbol"
              value={tokenData.symbol}
              required
            />
          </div>
          <div className="flex flex-col justify-center items-start">
            <label htmlFor="#decimals" className="font-medium text-md">
              Decimals
            </label>
            <input
              type="number"
              id="decimals"
              placeholder="18"
              min={1}
              max={18}
              className="w-full h-10 px-4 bg-transparent border-b-2 transition-all focus:border-b-green-500 outline-none"
              onChange={(e) => onChange(e)}
              name="decimals"
              value={tokenData.decimals}
              required
            />
          </div>
          <div className="flex flex-col justify-center items-start">
            <label htmlFor="#supply" className="font-medium text-md">
              Initial Supply
            </label>
            <input
              type="number"
              id="supply"
              placeholder="10000"
              min={10000}
              className="w-full h-10 px-4 bg-transparent border-b-2 transition-all focus:border-b-green-500 outline-none"
              onChange={(e) => onChange(e)}
              name="supply"
              value={tokenData.supply}
              required
            />
          </div>
          <div className="w-full">
            <button
              disabled={isDeploying || isFetching || isSwitchingChain}
              type="submit"
              className="btn w-64 h-16"
            >
              {isSwitchingChain
                ? "Switching Chain..."
                : isDeploying
                ? "Deploying.."
                : isSwitchingChain
                ? "Switching chain.."
                : connectedChain?.id != ACTIVE_CHAIN.id && isConnected
                ? "Switch to FTM"
                : "Create"}
            </button>
          </div>
        </form>
      </div>
      <Toaster />
    </div>
  );
};
export default memo(CreateERC20);