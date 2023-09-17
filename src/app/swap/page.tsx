"use client";
import {
  ACTIVE_CHAIN,
  CoinMingleRouter,
  NULL_ADDRESS,
  EXPLORER,
  WFTM,
} from "@config";
import { formatToken, parseToken } from "@utils";
import { ChangeEvent, FormEvent, useState, memo, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { TransactionReceipt, parseUnits, formatEther, parseEther } from "viem";
import {
  erc20ABI,
  useAccount,
  useContractReads,
  useContractRead,
  useToken,
  useNetwork,
  useSwitchNetwork,
  useContractWrite,
  useWaitForTransaction,
  useBalance,
} from "wagmi";
import CM_ROUTER from "@abis/Router.json";
import Image from "next/image";
import { CgArrowLongDownC } from "react-icons/cg";
import { BiDownArrow } from "react-icons/bi";
import { IToken } from "@types";
import { getAllTokens, getRoutePath } from "@db";

const Swap = () => {
  const [allTokens, setAllTokens] = useState<IToken[]>([]);
  const [routePath, setRoutePath] = useState<string[]>();
  const [routeContent, setRouteContent] = useState<IToken[]>();
  const [openModal, setOpenModal] = useState(false);
  const [tokenAOpened, setTokenAOpened] = useState(false);
  const [pairAvailable, setPairAvailable] = useState(false);

  const [tokenInput, setTokenInput] = useState({
    tokenA: "",
    tokenB: "",
    fetch: false,
  });

  const [activeToken, setActiveToken] = useState<{
    tokenA?: string;
    tokenB?: string;
  }>({
    tokenA: WFTM,
  });

  const { address, isConnected } = useAccount();
  const { data: balanceOfFTM } = useBalance({
    address: address ? address : undefined,
  });
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

  const { data: pairAddressA } = useContractRead({
    address: CoinMingleRouter as `0x`,
    abi: CM_ROUTER.abi,
    functionName: "getPair",
    args: routePath ? [routePath[0], routePath[1]] : undefined,
    watch: pairAvailable,
    enabled: isConnected && routePath && routePath.length >= 2,
    onSuccess(data) {
      if (data === NULL_ADDRESS) {
        toast.error("No pair available");
        setPairAvailable(false);
      } else {
        setPairAvailable(true);
      }
    },
  });

  const { data: pairAddressB } = useContractRead({
    address: CoinMingleRouter as `0x`,
    abi: CM_ROUTER.abi,
    functionName: "getPair",
    args: routePath
      ? [routePath[routePath.length - 2], routePath[routePath.length - 1]]
      : undefined,
    watch: pairAvailable,
    enabled: isConnected && routePath && routePath.length >= 2,
    onSuccess(data) {
      if (data === NULL_ADDRESS) {
        toast.error("No pair available");
        setPairAvailable(false);
      } else {
        setPairAvailable(true);
      }
    },
  });

  /** @dev Fetching the balances of selected token */
  const {
    data: balanceOf,
    isFetched: isBalanceFetched,
    refetch: refetchBalances,
  } = useContractReads({
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
      {
        address: activeToken?.tokenA as `0x`,
        abi: erc20ABI,
        functionName: "balanceOf",
        args: [pairAddressA as `0x`],
      },
      {
        address: activeToken?.tokenB as `0x`,
        abi: erc20ABI,
        functionName: "balanceOf",
        args: [pairAddressB as `0x`],
      },
    ],
    watch: true,
  });

  const { data: perTokenOut, refetch: refetchPerTokenOut } = useContractRead({
    address: CoinMingleRouter as `0x`,
    abi: CM_ROUTER.abi,
    functionName: "getAmountOut",
    args: [parseToken("1", tokenA_data?.decimals), routePath],
    enabled: routePath && routePath?.length >= 2,
    watch: true,
  });

  const {
    data: amountOut,
    isFetched: isAmountOutFetched,
    isFetching: isFetchingAmountOut,
  } = useContractRead({
    address: CoinMingleRouter as `0x`,
    abi: CM_ROUTER.abi,
    functionName: "getAmountOut",
    args: [
      parseUnits(
        (tokenInput.tokenA as "0") ?? "0",
        tokenA_data?.decimals || 18
      ),
      routePath,
    ],
    enabled: routePath && tokenInput.fetch ? true : false,
    watch: true,
    onSuccess(data) {
      setTokenInput((prev) => ({
        ...prev,
        tokenB: formatToken(data as BigInt, tokenB_data?.decimals) as string,
      }));
    },
  });

  const {
    data: swapHash,
    writeAsync: swap,
    isLoading: isSwapping,
    reset: resetSwap,
  } = useContractWrite({
    address: CoinMingleRouter,
    abi: CM_ROUTER.abi,
    functionName: "swapTokensForTokens",
    args: [
      parseUnits(
        (tokenInput.tokenA as "0") ?? "0",
        tokenA_data?.decimals || 18
      ),
      amountOut,
      routePath,
      address,
      Math.round(+new Date() / 1000) + 300,
    ],
  });

  const {
    data: swapFTMForTokensHash,
    writeAsync: swapFTMForTokens,
    isLoading: isSwappingFTM,
    reset: resetSwapFTMForTokens,
  } = useContractWrite({
    address: CoinMingleRouter,
    abi: CM_ROUTER.abi,
    functionName: "swapFTMForTokens",
    args: [amountOut, routePath, address, Math.round(+new Date() / 1000) + 300],
    value: parseEther(tokenInput.tokenA as "0"),
  });

  const {
    data: swapTokensForFTMHash,
    writeAsync: swapTokensForFTM,
    isLoading: isSwappingTokens,
    reset: resetSwapTokensForFTM,
  } = useContractWrite({
    address: CoinMingleRouter,
    abi: CM_ROUTER.abi,
    functionName: "swapTokensForFTM",
    args: [
      parseUnits(
        (tokenInput.tokenA as "0") ?? "0",
        tokenA_data?.decimals || 18
      ),
      amountOut,
      routePath,
      address,
      Math.round(+new Date() / 1000) + 300,
    ],
  });

  /** @dev Getting Approvals */
  const { data: approvalA } = useContractRead({
    address: activeToken.tokenA as "0x",
    abi: erc20ABI,
    functionName: "allowance",
    args: [address as "0x", CoinMingleRouter],
    enabled: isConnected && activeToken.tokenA ? true : false,
    watch: true,
  });

  /** @dev Give approval if not available */
  const {
    data: approvalData,
    isLoading: isApprove,
    writeAsync: giveApproval,
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

  useEffect(() => {
    (async () => {
      if (activeToken.tokenA && activeToken.tokenB) {
        try {
          //@ts-ignore
          const { path, content } = await getRoutePath(activeToken);
          setRoutePath(path);
          setRouteContent(content);
        } catch (e: any) {
          setRoutePath(undefined);
          setRouteContent(undefined);
          setTokenInput({
            tokenA: "",
            tokenB: "",
            fetch: false,
          });
          toast.error(e);
        }
      }
    })();
  }, [activeToken]);

  useEffect(() => {
    (async () => {
      try {
        const loading = toast.loading("Hold On! Fetching tokens");
        const tokens = await getAllTokens();
        setAllTokens(tokens);
        toast.dismiss(loading);
      } catch (e: any) {
        toast.error(e);
      }
    })();
  }, []);

  /** @dev Handling onTransactionError */
  const onError = async (err: Error) => {
    toast.error(err.name);
    console.log(err);
  };

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
        duration: 5000,
      }
    );

    resetSwap();
    resetSwapFTMForTokens();
    resetSwapTokensForFTM();
  };

  /** @dev Waiting for tx to mine */
  const { isFetching } = useWaitForTransaction({
    hash:
      swapHash?.hash ||
      swapFTMForTokensHash?.hash ||
      swapTokensForFTMHash?.hash ||
      approvalData?.hash,
    onSuccess: onReceipt,
    onError,
  });

  /** @dev Handling form changing event */
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const match = /^\d*\.?\d*$/.test(e.target.value);
    if (match && e.target.value.length <= 21) {
      setTokenInput((prev) => {
        if (!e.target.value) {
          return {
            tokenA: "",
            tokenB: "",
            fetch: false,
          };
        }
        return {
          ...prev,
          fetch: true,
          [e.target.name]: e.target.value && e.target.value,
        };
      });
    }
  };

  const reverseSwap = () => {
    setActiveToken((prev) => ({
      tokenA: prev?.tokenB,
      tokenB: prev?.tokenA,
    }));

    setTokenInput((prev) => ({
      ...prev,
      tokenA: prev.tokenB,
      tokenB: prev.tokenA,
    }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.stopPropagation();
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
    if (tokenA_data && tokenInput.tokenA) {
      if (
        activeToken.tokenA !== WFTM &&
        // @ts-ignore
        approvalA < parseUnits(tokenInput.tokenA as "0", tokenA_data.decimals)
      ) {
        const loadingToast = toast.loading("Approving...");
        try {
          await giveApproval();
          toast.success("Approved");
        } catch (e: any) {
          onError(e);
        } finally {
          toast.dismiss(loadingToast);
        }
        return;
      }
    }

    const loadingToast = toast.loading("Swapping...");
    try {
      if (activeToken.tokenA === WFTM) {
        await swapFTMForTokens();
      } else if (activeToken.tokenB === WFTM) {
        await swapTokensForFTM();
      } else {
        await swap();
      }
      toast.success("Swapped");
    } catch (e: any) {
      onError(e);
    } finally {
      toast.dismiss(loadingToast);
      setTokenInput(() => ({
        tokenA: "",
        tokenB: "",
        fetch: false,
      }));

      refetchBalances();
      refetchPerTokenOut();
    }
  };

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

  return (
    <div className="w-[90%] items-center flex flex-col gap-10 py-20">
      <header className="text-center flex flex-col gap-4">
        <h1 className="text-xl">Swap</h1>
        <p className="text-sm text-slate-300 max-w-xl text-center">
          Exchange one token for another directly through the smart contract.
          The swap feature calculates the conversion rate based on the available
          liquidity in the pool.
        </p>
      </header>

      <form
        className="w-full md:w-[35rem] flex justify-center flex-col gap-2"
        onSubmit={onSubmit}
      >
        <div
          className={`flex flex-col items-center justify-center gap-2 h-28 px-4 transition-all ${
            isFetchingAmountOut ? "bg-slate-600 border-red-500" : "bg-slate-100"
          } bg-opacity-5 backdrop-blur-3xl rounded-2xl border transition-[5s]`}
        >
          <div className="flex w-full items-center justify-between">
            <input
              type="text"
              placeholder="0"
              name="tokenA"
              value={tokenInput.tokenA}
              onChange={onChange}
              // disabled={isFetchingAmountOut}
              className="w-full h-8 px-4 bg-transparent outline-none text-2xl"
              required
              autoFocus
            />
            <div
              className="flex gap-1 justify-center items-center px-5 py-2 cursor-pointer border border-slate-100 rounded-2xl"
              onClick={() => open(true)}
            >
              <Image src="/ftm-logo.svg" alt="" width={20} height={20} />
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">
                  {activeToken.tokenA === WFTM ? "MATIC" : tokenA_data?.symbol}
                </p>
                <BiDownArrow />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-between items-center px-4 mt-1">
            <div>
              {pairAddressA &&
              typeof balanceOf !== "undefined" &&
              pairAddressA !== NULL_ADDRESS ? (
                <p className="text-sm text-slate-300">
                  Reserve :{" "}
                  {formatToken(balanceOf?.[2].result, tokenA_data?.decimals)}
                </p>
              ) : null}
            </div>
            {isBalanceFetched && typeof balanceOf !== "undefined" && (
              <p className="text-sm text-slate-300">
                Balance :{" "}
                {activeToken.tokenA === WFTM
                  ? parseFloat(
                      formatToken(balanceOfFTM?.value, 18)!.toString()
                    ).toFixed(5)
                  : formatToken(balanceOf?.[0].result, tokenA_data?.decimals)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center cursor-pointer">
          <CgArrowLongDownC
            className="text-5xl hover:rotate-180 transition-all"
            onClick={reverseSwap}
          />
        </div>

        <div
          className={`flex flex-col items-center justify-center gap-2 h-28 px-4 transition-all ${
            isFetchingAmountOut ? "bg-slate-600 border-red-500" : "bg-slate-100"
          } bg-opacity-5 backdrop-blur-3xl rounded-2xl border transition-[5s]`}
        >
          <div className="flex w-full gap-3 items-center justify-between">
            <input
              type="text"
              placeholder="0"
              name="tokenB"
              value={tokenInput.tokenB}
              readOnly
              className="w-full h-12 px-4 bg-transparent outline-none text-2xl"
            />
            <div
              className="flex gap-1 justify-center items-center px-7 py-2 cursor-pointer border border-slate-100 rounded-2xl"
              onClick={() => open(false)}
            >
              <Image src="/ftm-logo.svg" alt="" width={20} height={20} />
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm">
                  {activeToken.tokenB === WFTM ? "MATIC" : tokenB_data?.symbol}
                </p>
                <BiDownArrow />
              </div>
            </div>
          </div>
          <div className="flex w-full justify-between items-center px-4 mt-1">
            <div>
              {routePath && typeof balanceOf !== "undefined" && (
                <p className="text-sm text-slate-300">
                  Reserve :{" "}
                  {formatToken(balanceOf?.[3].result, tokenB_data?.decimals)}
                </p>
              )}
            </div>
            {isBalanceFetched && typeof balanceOf !== "undefined" && (
              <p className="text-sm text-slate-300">
                Balance :{" "}
                {activeToken.tokenB === WFTM
                  ? parseFloat(
                      formatToken(balanceOfFTM?.value, 18)!.toString()
                    ).toFixed(5)
                  : formatToken(balanceOf?.[1].result, tokenB_data?.decimals)}
              </p>
            )}
          </div>
        </div>

        {activeToken?.tokenA && activeToken.tokenB && (
          <>
            <div className="flex items-center justify-between mt-2 text-sm">
              <p className="flex items-center justify-center text-slate-300">
                1 {activeToken.tokenA === WFTM ? "MATIC" : tokenA_data?.symbol} ={" "}
                {formatToken(perTokenOut as BigInt, tokenB_data?.decimals)}{" "}
                {activeToken.tokenB === WFTM ? "MATIC" : tokenB_data?.symbol}
              </p>
              <p className="flex items-center justify-center text-slate-300">
                Expected Output :{" "}
                {formatToken(amountOut as BigInt, tokenB_data?.decimals)}{" "}
                {activeToken.tokenB === WFTM ? "MATIC" : tokenB_data?.symbol}
              </p>
            </div>

            <div className="mt-1 text-sm flex justify-between items-center">
              {routeContent ? (
                <p>
                  Route :{" "}
                  {activeToken.tokenA === WFTM ? "MATIC" : tokenA_data?.symbol}
                  {routeContent.map((content, i) =>
                    i !== routeContent.length ? (
                      <span key={i}>
                        {" "}
                        &#8674;{" "}
                        {content.address === WFTM ? "MATIC" : content.symbol}
                      </span>
                    ) : (
                      <span key={i}>
                        {" "}
                        {content.address === WFTM ? "MATIC" : content.symbol}
                      </span>
                    )
                  )}
                </p>
              ) : (
                <p>No route available</p>
              )}
              <p>Fee 0.3%</p>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={
            !isConnected ||
            !isAmountOutFetched ||
            isSwitchingChain ||
            isApprove ||
            isSwapping ||
            isSwappingFTM ||
            isSwappingTokens ||
            isFetching ||
            /// In case of FTM
            (activeToken.tokenA === WFTM && // @ts-ignore
              balanceOfFTM?.value < parseEther(tokenInput.tokenA as "0")) ||
            /// In case of ERC20
            (activeToken.tokenA !== WFTM &&
              typeof balanceOf !== "undefined" &&
              // @ts-ignore
              balanceOf[0].result <
                // @ts-ignore
                parseUnits(tokenInput.tokenA as "0", tokenA_data.decimals))
          }
          className="btn w-full h-14 mt-10 text-sm"
        >
          {!isConnected
            ? "Connect Wallet First"
            : isSwitchingChain
            ? "Switching Chain..."
            : isSwapping || isSwappingFTM || isSwappingTokens
            ? "Swapping..."
            : isFetching
            ? "Waiting for receipt..."
            : isApprove
            ? "Approving..."
            : !activeToken.tokenB
            ? "Select token"
            : !pairAddressA || (pairAddressA && pairAddressA === NULL_ADDRESS)
            ? "No Pair Available"
            : connectedChain?.id != ACTIVE_CHAIN.id && isConnected
            ? "Switch to FTM"
            : /// In case of FTM
            (activeToken.tokenA === WFTM && // @ts-ignore
                balanceOfFTM?.value < parseEther(tokenInput.tokenA as "0")) ||
              /// In case of ERC20
              (activeToken.tokenA !== WFTM &&
                isBalanceFetched &&
                typeof balanceOf !== "undefined" &&
                // @ts-ignore
                balanceOf[0].result <
                  // @ts-ignore
                  parseUnits(tokenInput.tokenA as "0", tokenA_data.decimals))
            ? "Insufficient Balance"
            : tokenA_data &&
              activeToken.tokenA !== WFTM &&
              // @ts-ignore
              approvalA <
                parseUnits(tokenInput.tokenA as "0", tokenA_data.decimals)
            ? `Approve ${
                activeToken.tokenA === WFTM ? "MATIC" : tokenA_data.symbol
              }`
            : "Swap"}
        </button>
      </form>

      {openModal && (
        <div
          className="fixed inset-0 w-full max-h-full flex justify-center items-center bg-black bg-opacity-70 backdrop-blur-sm rounded-2xl"
          onClick={() => setOpenModal(false)}
        >
          <div className="w-[18rem] h-[80%] pb-4 bg-slate-200 bg-opacity-30 backdrop-blur-xl rounded-xl text-white flex flex-col gap-4">
            <div className="overflow-x-scroll h-full flex py-2 px-4 hide-scroll">
              <div className="flex flex-col gap-5 w-full mt-4">
                {allTokens.map((token) =>
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
                            <p>{token.address === WFTM ? "MATIC" : token.name}</p>
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
                            <p>{token.address === WFTM ? "MATIC" : token.name}</p>
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
export default memo(Swap);
