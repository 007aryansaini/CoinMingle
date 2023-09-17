"use client";
import { memo, useState, ChangeEvent, FormEvent, useEffect } from "react";
import Image from "next/image";
import { BiDownArrow } from "react-icons/bi";
import { FaPlus } from "react-icons/fa";
import CM_ROUTER from "@abis/Router.json";
import CM_LP from "@abis/LP.json";
import { ILiquidities, IToken } from "@types";
import {
  WFTM,
  ACTIVE_CHAIN,
  CoinMingleRouter,
  NULL_ADDRESS,
  EXPLORER,
} from "@config";
import {
  useToken,
  useAccount,
  useNetwork,
  useSwitchNetwork,
  useContractRead,
  useContractWrite,
  erc20ABI,
  useWaitForTransaction,
  useContractReads,
  useBalance,
} from "wagmi";
import { formatToken, parseToken } from "@utils";
import { Toaster, toast } from "react-hot-toast";
import { TransactionReceipt, parseUnits, formatUnits, isAddress } from "viem";
import {
  getAllTokens,
  getUserPositions,
  updateTokens,
  updateUserPosition,
} from "@db";
import { ILiquidity, ITokens } from "@types";
import LPView from "@components/client/LPView";

const Liquidity = () => {
  const [allTokens, setAllTokens] = useState<IToken[]>([]);
  const [allPositions, setAllPositions] = useState<ILiquidities>();
  const [activeAdd, setActiveAdd] = useState(false);
  const [pairAvailable, setPairAvailable] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [tokenAOpened, setTokenAOpened] = useState(false);

  const [tokenInput, setTokenInput] = useState({
    tokenA: "",
    tokenB: "",
  });

  const [activeToken, setActiveToken] = useState<{
    tokenA?: string;
    tokenB?: string;
  }>({
    tokenA: WFTM,
  });

  useEffect(() => {
    (async () => {
      try {
        const tokens = await getAllTokens();
        setAllTokens(tokens);
      } catch (e: any) {
        toast.error(e);
      }
    })();
  }, []);

  const { address, isConnected } = useAccount();
  useEffect(() => {
    (async () => {
      if (address) {
        try {
          toast.dismiss();
          const loading = toast.loading("Hold On! Fetching positions...");
          const positions = await getUserPositions(address);
          setAllPositions(() => positions);
          toast.dismiss(loading);
        } catch (e: any) {
          toast.error(e);
        }
      } else {
        toast.error("Connect your wallet");
      }
    })();
  }, [address, activeAdd == false]);

  const { data: balanceFTM } = useBalance({ address: address && address });
  /** @dev switching chain if not connected to ftm */
  const { chain: connectedChain } = useNetwork();
  const { isLoading: isSwitchingChain, switchNetworkAsync } = useSwitchNetwork({
    chainId: ACTIVE_CHAIN.id,
  });
  /** @dev Read tokenA data */
  const { data: tokenA_data } = useToken({
    address: activeToken?.tokenA as `0x`,
    chainId: ACTIVE_CHAIN.id,
    enabled: isConnected && activeToken?.tokenA ? true : false,
  });
  /** @dev Read tokenB data */
  const { data: tokenB_data } = useToken({
    address: activeToken?.tokenB as `0x`,
    chainId: ACTIVE_CHAIN.id,
    enabled: isConnected && activeToken?.tokenB ? true : false,
  });

  /** @dev Fetching the balances of selected token */
  const { data: balanceOf } = useContractReads({
    contracts: [
      {
        address: activeToken?.tokenA as `0x`,
        abi: erc20ABI,
        functionName: "balanceOf",
        args: [address as `0x`],
      },
      {
        address: activeToken?.tokenB as `0x`,
        abi: erc20ABI,
        functionName: "balanceOf",
        args: [address as `0x`],
      },
    ],
    enabled: activeToken.tokenA && activeToken.tokenB ? true : false,
    watch: true,
  });

  /** @dev Getting the pair address */
  const { data: pairAddress, refetch: refetchPair } = useContractRead({
    address: CoinMingleRouter as `0x`,
    abi: CM_ROUTER.abi,
    functionName: "getPair",
    args: [activeToken?.tokenA, activeToken?.tokenB],
    watch: pairAvailable,
    enabled:
      isConnected && activeAdd && activeToken?.tokenA && activeToken?.tokenB
        ? true
        : false,
    onSuccess(data) {
      if (data === NULL_ADDRESS) {
        setPairAvailable(false);
      } else {
        setPairAvailable(true);
      }
    },
  });

  /** @dev Getting the reserves */
  const { data: reservesAmounts, isFetched: reservesFetched } = useContractRead(
    {
      address: pairAddress as `0x`,
      abi: CM_LP.abi,
      functionName: "getReserves",
      watch: true,
      enabled: isConnected && activeAdd && pairAvailable,
    }
  );

  /** @dev Fetching the balances of selected token */
  const { data: tokenARead } = useContractRead({
    address: pairAddress as `0x`,
    // @ts-ignore
    abi: CM_LP.abi,
    functionName: "tokenA",
    enabled: pairAddress ? true : false,
  });

  /** @dev Getting Per token Out */
  const { data: perTokenOut } = useContractRead({
    address: CoinMingleRouter as `0x`,
    abi: CM_ROUTER.abi,
    functionName: "getAmountOut",
    args: [
      parseToken("1", tokenA_data?.decimals),
      [activeToken?.tokenA, activeToken?.tokenB],
    ],
    enabled: activeAdd && pairAddress !== NULL_ADDRESS,
    watch: true,
  });

  /** @dev Getting Per token Out */
  const { isFetching: isFetchingAmountIn } = useContractRead({
    address: CoinMingleRouter as `0x`,
    abi: CM_ROUTER.abi,
    functionName: "getTokenInFor",
    args: [
      activeToken.tokenA,
      activeToken.tokenB,
      parseToken(tokenInput.tokenA, tokenA_data?.decimals),
    ],
    enabled:
      activeAdd && pairAddress !== NULL_ADDRESS && tokenInput.tokenA
        ? true
        : false,
    watch: true,
    onSuccess(data) {
      setTokenInput((prev) => ({
        ...prev,
        // @ts-ignore
        tokenB: formatUnits(data, tokenB_data?.decimals),
      }));
    },
  });

  /** @dev Getting Approvals */
  const { data: approvalA } = useContractRead({
    address: activeToken.tokenA as "0x",
    abi: erc20ABI,
    functionName: "allowance",
    args: [address as "0x", CoinMingleRouter],
    enabled: isConnected && activeAdd && activeToken.tokenA ? true : false,
    watch: true,
  });

  const { data: approvalB } = useContractRead({
    address: activeToken.tokenB as "0x",
    abi: erc20ABI,
    functionName: "allowance",
    args: [address as "0x", CoinMingleRouter],
    enabled: isConnected && activeAdd && activeToken.tokenA ? true : false,
    watch: true,
  });

  /** @dev Give approval if not available */
  const {
    data: approvalDataA,
    isLoading: isApproveA,
    writeAsync: giveApprovalA,
  } = useContractWrite({
    address: activeToken.tokenA as "0x",
    abi: erc20ABI,
    functionName: "approve",
    args: [
      CoinMingleRouter,
      // @ts-ignore
      tokenA_data?.totalSupply.value,
    ],
  });

  /** @dev Give approval if not available */
  const {
    data: approvalDataB,
    isLoading: isApproveB,
    writeAsync: giveApprovalB,
  } = useContractWrite({
    address: activeToken.tokenB as "0x",
    abi: erc20ABI,
    functionName: "approve",
    args: [
      CoinMingleRouter,
      // @ts-ignore
      tokenB_data?.totalSupply.value,
    ],
  });

  /** @dev Adding liquidity for both ERC20 tokens */
  const {
    data: liquidityHash,
    writeAsync: addLiquidity,
    isLoading: isAddingLiquidity,
  } = useContractWrite({
    address: CoinMingleRouter,
    abi: CM_ROUTER.abi,
    functionName: "addLiquidity",
    args: [
      activeToken.tokenA,
      activeToken.tokenB,
      parseToken(tokenInput.tokenA, tokenA_data?.decimals),
      parseToken(tokenInput.tokenB, tokenB_data?.decimals),
      address,
      Math.round(+new Date() / 1000) + 300,
    ],
  });

  /** @dev Adding liquidity for FTM */
  const {
    data: liquidityFTMHash,
    writeAsync: addLiquidityFTM,
    isLoading: isAddingLiquidityFTM,
  } = useContractWrite({
    address: CoinMingleRouter,
    abi: CM_ROUTER.abi,
    functionName: "addLiquidityFTM",
    args: [
      activeToken.tokenA === WFTM ? activeToken.tokenB : activeToken.tokenA,
      activeToken.tokenA === WFTM
        ? parseToken(tokenInput.tokenB, tokenB_data?.decimals)
        : parseToken(tokenInput.tokenA, tokenA_data?.decimals),
      address,
      Math.round(+new Date() / 1000) + 300,
    ],
    // @ts-ignore
    value:
      activeToken.tokenA === WFTM
        ? parseToken(tokenInput.tokenA, tokenA_data?.decimals)
        : parseToken(tokenInput.tokenB, tokenB_data?.decimals),
  });

  /** @dev Handling onTransactionReceipt (MINE) */
  const onReceipt = async (data: TransactionReceipt) => {
    toast.success(
      <a
        target="_blank"
        href={`${EXPLORER}/tx/${data.transactionHash}`}
        className="underline"
      >
        View Transaction
      </a>,
      {
        duration: 10000,
      }
    );
  };

  /** @dev Handling onTransactionError */
  const onError = async (err: Error) => {
    toast.error(err.name);
    console.log(err);
  };

  /** @dev Waiting for tx to mine */
  const { isFetching } = useWaitForTransaction({
    hash:
      liquidityHash?.hash ||
      liquidityFTMHash?.hash ||
      approvalDataA?.hash ||
      approvalDataB?.hash,
    onSuccess: onReceipt,
    onError,
  });

  const close = (address: string) => {
    if (tokenAOpened) {
      setActiveToken((prev) => ({
        ...prev,
        tokenA: address,
      }));
    } else {
      setActiveToken((prev) => ({
        ...prev,
        tokenB: address,
      }));
    }
    setOpenModal(false);
  };

  const open = (isTokenA: boolean) => {
    if (isTokenA) {
      setTokenAOpened(true);
    } else {
      setTokenAOpened(false);
    }
    setOpenModal(true);
  };

  /** @dev Handling form changing event */
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const match = /^\d*\.?\d*$/.test(e.target.value);
    if (match && e.target.value.length <= 21) {
      setTokenInput((prev) => {
        if (!e.target.value) {
          return {
            ...prev,
            [e.target.name]: "",
          };
        }
        return {
          ...prev,
          [e.target.name]: e.target.value && e.target.value,
        };
      });
    }
  };

  /** @dev Handling token input */
  const onAdditionalAddress = (e: ChangeEvent<HTMLInputElement>) => {
    const match = isAddress(e.target.value);
    if (match) {
      if (
        e.target.value === activeToken.tokenA ||
        e.target.value === activeToken.tokenA
      ) {
        toast.error("Already Added");
      } else {
        close(e.target.value);
        toast.success("Token Added");
      }
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    /** @dev If wallet is not connected then return with error */
    if (!isConnected) {
      toast.error(`Connect wallet first.`);
      return;
    }

    /** @dev Switching chain if correct chain is not connected */
    if (connectedChain?.id != ACTIVE_CHAIN.id) {
      const loadingToast = toast.loading("Switching to FTM...");
      try {
        switchNetworkAsync && (await switchNetworkAsync());
        toast.success("Switched");
      } catch (e: any) {
        onError(e);
      } finally {
        toast.dismiss(loadingToast);
      }
      return;
    }

    /** @dev Taking approvals if not available */
    if (tokenA_data && tokenB_data && tokenInput.tokenA) {
      if (
        activeToken.tokenA !== WFTM &&
        // @ts-ignore
        approvalA < parseUnits(tokenInput.tokenA as "0", tokenA_data.decimals)
      ) {
        const loadingToast = toast.loading("Approving...");
        try {
          await giveApprovalA();
          toast.success("Approved");
        } catch (e: any) {
          onError(e);
        } finally {
          toast.dismiss(loadingToast);
        }
        return;
      }

      if (
        activeToken.tokenB !== WFTM &&
        // @ts-ignore
        approvalB < parseUnits(tokenInput.tokenB as "0", tokenB_data.decimals)
      ) {
        const loadingToast = toast.loading("Approving...");
        try {
          await giveApprovalB();
          toast.success("Approved");
        } catch (e: any) {
          onError(e);
        } finally {
          toast.dismiss(loadingToast);
        }
        return;
      }
    }

    /** @dev */
    const loadingToast = toast.loading("Adding Liquidity...");
    try {
      if (activeToken.tokenA === WFTM || activeToken.tokenB === WFTM) {
        await addLiquidityFTM();
      } else {
        await addLiquidity();
      }
      const newTokens: ITokens = {
        tokenA: {
          address: activeToken.tokenA!,
          name: tokenA_data?.name!,
          symbol: tokenA_data?.symbol!,
        },
        tokenB: {
          address: activeToken.tokenB!,
          name: tokenB_data?.name!,
          symbol: tokenB_data?.symbol!,
        },
      };
      const newPosition: ILiquidity = {
        tokens: {
          tokenA: activeToken.tokenA!,
          tokenB: activeToken.tokenB!,
        },
        amounts: {
          tokenA: Number(tokenInput.tokenA),
          tokenB: Number(tokenInput.tokenB),
        },
      };
      await updateUserPosition(address as "0x", newPosition);
      await updateTokens(newTokens);
      const tokens = await getAllTokens();
      setAllTokens(tokens);
      toast.success("Liquidity Added");
    } catch (e: any) {
      onError(e);
    } finally {
      toast.dismiss(loadingToast);
      setTokenInput(() => ({
        tokenA: "",
        tokenB: "",
      }));
      refetchPair();
    }
  };

  return (
    <div className="flex flex-col justify-evenly w-[90%] lg:w-[60%] py-20">
      <header className="text-center flex flex-col gap-3 items-center">
        <h1 className="text-xl font-medium">Pool</h1>
      </header>

      <div className="flex justify-evenly items-center pt-6 pb-10">
        <p
          onClick={() => setActiveAdd(false)}
          className={`${!activeAdd && "underline"} cursor-pointer text-sm`}
        >
          My Positions
        </p>
        <p
          onClick={() => setActiveAdd(true)}
          className={`${activeAdd && "underline"} cursor-pointer text-sm`}
        >
          Add Liquidity
        </p>
      </div>

      {activeAdd ? (
        <div className="flex items-center gap-5">
          <form className="md:w-3/4 flex flex-col gap-5" onSubmit={onSubmit}>
            <h1 className="text-sm">Deposit Amounts</h1>

            <div
              className={`border transition-all ${
                isFetchingAmountIn
                  ? "bg-slate-600 border-red-500"
                  : "bg-slate-900"
              } bg-opacity-5 backdrop-blur-xl rounded-xl flex flex-col gap-3 items-center justify-center h-28 px-4`}
            >
              <div className="flex gap-3 items-center justify-center">
                <input
                  type="text"
                  placeholder="0"
                  name="tokenA"
                  onChange={onChange}
                  value={tokenInput.tokenA}
                  className="w-full h-12 px-4 bg-transparent outline-none text-2xl"
                  required
                  autoFocus
                />
                <div
                  className="flex gap-1 justify-center items-center px-7 py-2 cursor-pointer border border-slate-100 rounded-xl"
                  onClick={() => open(true)}
                >
                  <Image src="/ftm-logo.svg" alt="" width={20} height={20} />
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">
                      {activeToken.tokenA === WFTM
                        ? "MATIC"
                        : tokenA_data?.symbol}
                    </p>
                    <BiDownArrow />
                  </div>
                </div>
              </div>

              <div className="flex w-full justify-between items-center px-4">
                <div></div>
                <p className="text-sm text-slate-300">
                  Balance :{" "}
                  {activeToken.tokenA === WFTM
                    ? parseFloat(balanceFTM?.formatted as string).toFixed(4)
                    : formatToken(balanceOf?.[0].result, tokenA_data?.decimals)}
                </p>
              </div>
            </div>
            <div
              className={`border transition-all ${
                isFetchingAmountIn
                  ? "bg-slate-600 border-red-500"
                  : "bg-slate-900"
              } bg-opacity-5 backdrop-blur-xl rounded-xl flex flex-col gap-3 items-center justify-center h-28 px-4`}
            >
              <div className="flex gap-3 items-center justify-center">
                {pairAddress !== NULL_ADDRESS ? (
                  <input
                    type="text"
                    placeholder="0"
                    readOnly
                    value={tokenInput.tokenB}
                    className="w-full h-12 px-4 bg-transparent outline-none text-2xl"
                  />
                ) : (
                  <input
                    type="text"
                    placeholder="0"
                    name="tokenB"
                    onChange={onChange}
                    value={tokenInput.tokenB}
                    className="w-full h-12 px-4 bg-transparent outline-none text-2xl"
                    required
                    autoFocus
                  />
                )}
                <div
                  className="flex gap-1 justify-center items-center px-7 py-2 cursor-pointer border border-slate-100 rounded-xl"
                  onClick={() => open(false)}
                >
                  <Image src="/ftm-logo.svg" alt="" width={20} height={20} />
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">
                      {activeToken.tokenB === WFTM
                        ? "MATIC"
                        : tokenB_data?.symbol}
                    </p>
                    <BiDownArrow />
                  </div>
                </div>
              </div>

              <div className="flex w-full justify-between items-center px-4">
                <div></div>
                <p className="text-sm text-slate-300">
                  Balance :{" "}
                  {activeToken.tokenB === WFTM
                    ? parseFloat(balanceFTM?.formatted as string).toFixed(4)
                    : formatToken(balanceOf?.[1].result, tokenB_data?.decimals)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              className="btn w-full h-14 mt-10 text-sm"
              disabled={
                !isConnected ||
                isSwitchingChain ||
                isFetching ||
                isApproveA ||
                isApproveB ||
                isAddingLiquidity ||
                isAddingLiquidityFTM
              }
            >
              {!isConnected
                ? "Connect Wallet first"
                : isSwitchingChain
                ? "Switching Chain..."
                : isFetching
                ? "Waiting for receipt..."
                : isApproveA || isApproveB
                ? "Approving..."
                : connectedChain?.id != ACTIVE_CHAIN.id && isConnected
                ? "Switch to FTM"
                : tokenA_data &&
                  activeToken.tokenA !== WFTM &&
                  // @ts-ignore
                  approvalA <
                    parseUnits(tokenInput.tokenA as "0", tokenA_data.decimals)
                ? `Approve ${
                    activeToken.tokenA === WFTM ? "MATIC" : tokenA_data.symbol
                  }`
                : tokenB_data &&
                  activeToken.tokenB !== WFTM &&
                  // @ts-ignore
                  approvalB <
                    parseUnits(tokenInput.tokenB as "0", tokenB_data.decimals)
                ? `Approve ${
                    activeToken.tokenB === WFTM ? "FTM" : tokenB_data.symbol
                  }`
                : "Provide"}
            </button>
          </form>
          <div className="w-2/4 md:flex flex-col gap-5 hidden text-sm">
            <h1 className="">Pool Status</h1>

            <div className="p-4 py-6 bg-slate-200 bg-opacity-10 backdrop-blur-xl rounded-xl flex items-center justify-between text-sm text-slate-300">
              <p>Current rate</p>
              <p>
                {pairAddress === NULL_ADDRESS
                  ? `0 ${
                      activeToken.tokenB === WFTM ? "MATIC" : tokenB_data?.symbol
                    } / ${
                      activeToken.tokenA === WFTM ? "MATIC" : tokenA_data?.symbol
                    }`
                  : `${formatToken(
                      perTokenOut as BigInt,
                      tokenB_data?.decimals
                    )} ${
                      activeToken.tokenB === WFTM ? "MATIC" : tokenB_data?.symbol
                    } / ${
                      activeToken.tokenA === WFTM ? "MATIC" : tokenA_data?.symbol
                    }`}
              </p>
            </div>

            <div className="p-4 py-6 bg-slate-200 bg-opacity-10 backdrop-blur-xl rounded-xl flex items-center justify-between text-sm text-slate-300">
              <p>
                Reserve{" "}
                {activeToken.tokenA === WFTM ? "MATIC" : tokenA_data?.symbol}
              </p>
              {reservesFetched && typeof reservesAmounts !== "undefined" && (
                <p>
                  {pairAddress === NULL_ADDRESS
                    ? "0"
                    : formatToken(
                        tokenARead === activeToken.tokenA
                          ? // @ts-ignore
                            reservesAmounts[0]
                          : // @ts-ignore
                            reservesAmounts[1],
                        tokenA_data?.decimals
                      )}
                </p>
              )}
            </div>

            <div className="p-4 py-6 bg-slate-200 bg-opacity-10 backdrop-blur-xl rounded-xl flex items-center justify-between text-sm text-slate-300">
              <p>
                Reserve{" "}
                {activeToken.tokenB === WFTM ? "MATIC" : tokenB_data?.symbol}
              </p>
              {reservesFetched && typeof reservesAmounts !== "undefined" && (
                <p>
                  {pairAddress === NULL_ADDRESS
                    ? "0"
                    : formatToken(
                        // @ts-ignore
                        tokenARead === activeToken.tokenA
                          ? // @ts-ignore
                            reservesAmounts[1]
                          : // @ts-ignore
                            reservesAmounts[0],
                        tokenB_data?.decimals
                      )}
                </p>
              )}
            </div>

            <div className="flex flex-col items-center gap-2 p-4 py-3 bg-slate-200 bg-opacity-10 backdrop-blur-xl rounded-xl">
              <p>
                {tokenInput.tokenA}{" "}
                {activeToken.tokenA === WFTM ? "MATIC" : tokenA_data?.symbol}
              </p>
              <FaPlus />
              <p>
                {tokenInput.tokenB}{" "}
                {activeToken.tokenB === WFTM ? "MATIC" : tokenB_data?.symbol}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-[32rem] overflow-y-scroll flex flex-col items-center gap-5 hide-scroll">
          {allPositions ? (
            allPositions.liquidities.map((position, i) => (
              <LPView
                key={i}
                tokens={position.tokens}
                amounts={position.amounts}
              />
            ))
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <h1>No Position available.</h1>
            </div>
          )}
        </div>
      )}

      {openModal && (
        <div
          className="fixed inset-0 w-full h-full flex justify-center items-center bg-black bg-opacity-70 backdrop-blur-sm rounded-2xl"
          onClick={() => setOpenModal(false)}
        >
          <div className="w-[23rem] h-[80%] pb-4 bg-slate-200 bg-opacity-30 backdrop-blur-xl rounded-xl text-white flex flex-col gap-4">
            <div className="w-full border-b border-white border-opacity-10 py-6 px-5">
              <input
                type="text"
                placeholder="Paste address"
                onChange={onAdditionalAddress}
                className="w-full bg-transparent border rounded-2xl py-3 px-5 outline-none text-sm"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
            <div className="overflow-x-scroll h-[97%] flex px-4 hide-scroll">
              <div className="flex flex-col gap-5 w-full">
                {typeof allTokens !== "undefined" &&
                  allTokens.map((token) =>
                    tokenAOpened
                      ? token.address !== activeToken.tokenB && (
                          <div
                            className="w-full cursor-pointer border rounded-xl border-slate-100 border-opacity-40 py-2 px-1 flex items-center gap-3 hover:border-green-500 transition-[5s]"
                            key={token.address}
                            onClick={() => close(token.address)}
                          >
                            <Image
                              src="/ftm-logo.svg"
                              alt=""
                              width={30}
                              height={30}
                            />
                            <div className="text-sm">
                              <p>
                                {token.address === WFTM ? "MATIC" : token.name}
                              </p>
                              <p>
                                {token.address === WFTM ? "MATIC" : token.symbol}
                              </p>
                            </div>
                          </div>
                        )
                      : token.address !== activeToken.tokenA && (
                          <div
                            className="w-full cursor-pointer border rounded-xl border-slate-100 border-opacity-40 py-2 px-1 flex items-center gap-3 hover:border-green-500 transition-[5s]"
                            key={token.address}
                            onClick={() => close(token.address)}
                          >
                            <Image
                              src="/ftm-logo.svg"
                              alt=""
                              width={30}
                              height={30}
                            />
                            <div className="text-sm">
                              <p>
                                {token.address === WFTM ? "MATIC" : token.name}
                              </p>
                              <p>
                                {token.address === WFTM ? "MATIC" : token.symbol}
                              </p>
                            </div>
                          </div>
                        )
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
      <Toaster containerClassName="text-sm" />
    </div>
  );
};

export default memo(Liquidity);
