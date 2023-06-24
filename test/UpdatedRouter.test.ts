import { time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import {
  CoinMingleLP,
  CoinMingleRouter,
  ERC20,
  Token,
} from "../typechain-types";
import { describe } from "node:test";
import { BigNumber } from "ethers";
console.clear();

const zeroAddress = "0x0000000000000000000000000000000000000000";
const WFTM_address = "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";

describe("CoinMingle", () => {
  let CoinMingleRouter: CoinMingleRouter;
  let CoinMingleLP: CoinMingleLP;
  let Pair: CoinMingleLP;
  let WFTM: ERC20;

  let tokenA: Token;
  let tokenB: Token;

  const tokenA_decimals = 4;
  const tokenB_decimals = 4;

  const tokenALiquidity = ethers.utils.parseUnits("50", tokenA_decimals);
  const tokenBLiquidity = ethers.utils.parseUnits("200", tokenB_decimals);
  const ftmLiquidityAmount = ethers.utils.parseEther("50");

  /// Deploying Router & LP contract.
  before(async () => {
    const lpFactory = await ethers.getContractFactory("CoinMingleLP");
    const routerFactory = await ethers.getContractFactory("CoinMingleRouter");

    WFTM = await ethers.getContractAt("ERC20", WFTM_address);

    CoinMingleLP = await lpFactory.deploy();
    await CoinMingleLP.deployed();

    CoinMingleRouter = await routerFactory.deploy(
      CoinMingleLP.address,
      WFTM.address
    );
    await CoinMingleRouter.deployed();
  });

  /// Deploying TokenA & tokenB.
  before(async () => {
    const tokenFactory = await ethers.getContractFactory("Token");

    tokenA = await tokenFactory.deploy("TokenA", "TA", tokenA_decimals, 100000);
    await tokenA.deployed();

    tokenB = await tokenFactory.deploy("tokenB", "TB", tokenB_decimals, 100000);
    await tokenB.deployed();
  });

  before(async () => {
    await CoinMingleRouter.createPair(tokenA.address, tokenB.address);
  });

  describe("__CreatePair__", () => {
    it("Should create a pair of two tokens", async () => {
      const pairAddress = await CoinMingleRouter.getPair(
        tokenA.address,
        tokenB.address
      );
      Pair = await ethers.getContractAt("CoinMingleLP", pairAddress);
      expect(Pair.address);
    });
  });

  describe("__addLiquidity__", () => {
    it("Should add liquidity for both the tokens in the pair", async () => {
      const [, sec] = await ethers.getSigners();

      const deadLine = (await time.latest()) + 1000;

      await tokenA.approve(CoinMingleRouter.address, tokenALiquidity);
      await tokenB.approve(CoinMingleRouter.address, tokenBLiquidity);
      await CoinMingleRouter.addLiquidity(
        tokenA.address,
        tokenB.address,
        tokenALiquidity,
        tokenBLiquidity,
        sec.address,
        deadLine
      );
    });
    it("Should lock the first liquidity of 1000", async () => {
      const liquidity = await Pair.balanceOf(Pair.address);
      expect(liquidity).to.be.equal(1000);
    });

    it("Should mint the LP tokens that represents the share of the pool", async () => {
      const [, sec] = await ethers.getSigners();
      const resultedLiquidity =
        Math.sqrt(50 * 200 * 10 ** (tokenA_decimals + tokenB_decimals)) - 1000;
      const liquidity = await Pair.balanceOf(sec.address);

      expect(liquidity).to.be.equal(resultedLiquidity);
    });

    it("Should update the reserve with the liquidity amount of both tokens", async () => {
      const reserves = await Pair.getReserves();
      expect(reserves[0]).to.be.equal(50 * 10 ** tokenA_decimals);
      expect(reserves[1]).to.be.equal(200 * 10 ** tokenB_decimals);
    });

    it("Should have the correct balance of tokenA and tokenB of LP pair as of reserves", async () => {
      const reserves = await Pair.getReserves();
      const resultedBalanceOfTokenA = await tokenA.balanceOf(Pair.address);
      const resultedBalanceOfTokenB = await tokenB.balanceOf(Pair.address);

      expect(reserves[0]).to.be.equal(resultedBalanceOfTokenA);
      expect(reserves[1]).to.be.equal(resultedBalanceOfTokenB);
    });
  });

  describe("__addLiquidityFTM__", () => {
    describe("Success", () => {
      it("Should create the token pair with WFTM", async () => {
        const [, sec, third] = await ethers.getSigners();
        const tokenALiquidityAmount = ethers.utils.parseUnits(
          "200",
          tokenA_decimals
        );

        const deadLine = (await time.latest()) + 1000;
        await tokenA.approve(CoinMingleRouter.address, tokenALiquidityAmount);
        await CoinMingleRouter.addLiquidityFTM(
          tokenA.address,
          tokenALiquidityAmount,
          third.address,
          deadLine,
          { value: ftmLiquidityAmount }
        );

        const _pair = await CoinMingleRouter.getPair(
          tokenA.address,
          WFTM_address
        );

        const result = _pair != zeroAddress ? true : false;
        expect(result).to.be.equal(true);
      });

      it("Should update the reserve correctly", async () => {
        const _pair = await CoinMingleRouter.getPair(
          tokenA.address,
          WFTM_address
        );
        const ftmPair = await ethers.getContractAt("CoinMingleLP", _pair);

        const reserve = await ftmPair.getReserves();
        const tokenALiquidityAmount = ethers.utils.parseUnits(
          "200",
          tokenA_decimals
        );
        const ftmLiquidityAmount = ethers.utils.parseEther("50");
        expect(reserve[0]).to.be.equal(tokenALiquidityAmount);
        expect(reserve[1]).to.be.equal(ftmLiquidityAmount);
      });
    });
    describe("Failure", () => {});
  });

  describe("__getAmountOut__", () => {
    describe("Success", () => {
      it("Should return the correct amount of second tokens after swapping from token first after taking 0.3% trading fees", async () => {
        const tokenASwappingAmount = ethers.utils.parseUnits(
          "25",
          tokenA_decimals
        );
        const _tokensBAfterSwap = await CoinMingleRouter.getAmountOut(
          tokenASwappingAmount,
          [tokenA.address, tokenB.address]
        );

        expect(_tokensBAfterSwap).to.be.equal(665332);
      });
    });
    describe("Failure", () => {});
  });

  describe("__removeLiquidity__", () => {
    describe("Success", () => {
      let liquidityMinted: BigNumber;
      let totalSupply: BigNumber;
      let TokenAReceived: BigNumber;
      let TokenBReceived: BigNumber;
      let k: BigNumber;
      it("Should remove liquidity when all the required conditions are met", async () => {
        const [, sec] = await ethers.getSigners();
        totalSupply = await Pair.totalSupply();
        liquidityMinted = await Pair.balanceOf(sec.address);
        k = await Pair.K();
        const deadLine = (await time.latest()) + 1000;
        await Pair.connect(sec).approve(
          CoinMingleRouter.address,
          liquidityMinted
        );
        await CoinMingleRouter.connect(sec).removeLiquidity(
          tokenA.address,
          tokenB.address,
          liquidityMinted,
          sec.address,
          deadLine
        );
      });

      it("Should burn the LP shares of the user after removing liquidity", async () => {
        const [, sec] = await ethers.getSigners();
        expect(await Pair.balanceOf(sec.address)).to.be.equal(0);
      });

      it("Should return the correct amount of tokenA to the user", async () => {
        const [, sec] = await ethers.getSigners();
        const resultedTokenA = liquidityMinted
          .mul(tokenALiquidity)
          .div(totalSupply);
        TokenAReceived = await tokenA.balanceOf(sec.address);

        expect(TokenAReceived).to.be.equal(resultedTokenA);
      });

      it("Should return the correct amount of tokenB to the user", async () => {
        const [, sec] = await ethers.getSigners();
        const resultedTokenB = liquidityMinted
          .mul(tokenBLiquidity)
          .div(totalSupply);
        TokenBReceived = await tokenB.balanceOf(sec.address);

        expect(TokenBReceived).to.be.equal(resultedTokenB);
      });

      it("Should update the remaining reserves after removing correctly", async () => {
        const resultedTokenBEx = BigNumber.from("1000")
          .mul(tokenBLiquidity)
          .div(totalSupply);
        const resultedTokenAEx = BigNumber.from("1000")
          .mul(tokenALiquidity)
          .div(totalSupply);

        const reserve = await Pair.getReserves();
        expect(reserve[0]).to.be.equal(resultedTokenAEx);
        expect(reserve[1]).to.be.equal(resultedTokenBEx);
      });

      it("Should update the K value according to the new Reserves", async () => {
        const _newK = await Pair.K();
        const reserve = await Pair.getReserves();

        const resultedK = reserve[0].mul(reserve[1]);

        expect(_newK).to.be.equal(resultedK);
      });
    });
    describe("Failure", () => {});
  });

  describe("__removeLiquidityFTM__", () => {
    describe("Success", () => {
      let liquidityMinted: BigNumber;
      let totalSupply: BigNumber;

      let k: BigNumber;
      let ftmLPPair: CoinMingleLP;
      let frthInitialFTMBalance: BigNumber;
      let InitialReserve: BigNumber[];
      it("Should remove liquidity when all the required conditions are met", async () => {
        const [, sec, third, frth] = await ethers.getSigners();

        frthInitialFTMBalance = await ethers.provider.getBalance(frth.address);

        const ftmLPPairAddress = await CoinMingleRouter.getPair(
          tokenA.address,
          WFTM_address
        );
        ftmLPPair = await ethers.getContractAt(
          "CoinMingleLP",
          ftmLPPairAddress
        );

        InitialReserve = await ftmLPPair.getReserves();
        totalSupply = await ftmLPPair.totalSupply();
        liquidityMinted = await ftmLPPair.balanceOf(third.address);
        k = await ftmLPPair.K();
        const deadLine = (await time.latest()) + 1000;
        await ftmLPPair
          .connect(third)
          .approve(CoinMingleRouter.address, liquidityMinted);
        await CoinMingleRouter.connect(third).removeLiquidityFTM(
          tokenA.address,
          liquidityMinted,
          frth.address,
          deadLine
        );
      });

      it("Should burn the LP shares of the user after removing liquidity", async () => {
        const [, , third] = await ethers.getSigners();
        expect(await ftmLPPair.balanceOf(third.address)).to.be.equal(0);
      });

      it("Should return the correct amount of tokenA to the user", async () => {
        const [, sec, third, frth] = await ethers.getSigners();
      });

      it("Should return the correct amount of FTM to the user", async () => {
        const [, sec, third, frth] = await ethers.getSigners();
        const _reserve = await ftmLPPair.getReserves();

        expect(await tokenA.balanceOf(frth.address)).to.be.equal(
          InitialReserve[0].sub(_reserve[0])
        );
      });

      it("Should update the remaining reserves after removing correctly", async () => {
        const resultedFTMEx = BigNumber.from("1000")
          .mul(InitialReserve[1])
          .div(totalSupply);

        const reserve = await ftmLPPair.getReserves();
        // expect(reserve[0]).to.be.equal(1);
        expect(reserve[1]).to.be.equal(resultedFTMEx);
      });

      it("Should update the K value according to the new Reserves", async () => {
        const _newK = await ftmLPPair.K();
        const reserve = await ftmLPPair.getReserves();

        const resultedK = reserve[0].mul(reserve[1]);
        expect(_newK).to.be.equal(resultedK);
      });
    });
    describe("Failure", () => {});
  });

  describe("__swapTokensForTokens__", () => {
    let reserve: BigNumber[];
    let afterSwapTokenB: BigNumber;
    describe("Success", () => {
      it("Should increase the liquidity in the tokenA and tokenB pool", async () => {
        const [, , third] = await ethers.getSigners();
        /// Adding Liquidity to tokenA and tokenB LP
        const deadline = (await time.latest()) + 100;

        const InitialReserve = await Pair.getReserves();

        const tokenALiquidity = 100 * 10 ** tokenA_decimals;
        const tokenBLiquidity = 400 * 10 ** tokenA_decimals;
        tokenA.approve(CoinMingleRouter.address, tokenALiquidity);
        tokenB.approve(CoinMingleRouter.address, tokenBLiquidity);
        await CoinMingleRouter.addLiquidity(
          tokenA.address,
          tokenB.address,
          tokenALiquidity,
          tokenBLiquidity,
          third.address,
          deadline
        );

        reserve = await Pair.getReserves();

        expect(reserve[0]).to.be.equal(InitialReserve[0].add(tokenALiquidity));
        expect(reserve[1]).to.be.equal(InitialReserve[1].add(tokenBLiquidity));
      });

      it("Should swap the tokenA -> tokenB after taking 0.3% trading fees and provide swapped token to the provided address", async () => {
        const amountOfTokenBAfterSwap = await CoinMingleRouter.getAmountOut(
          500,
          [tokenA.address, tokenB.address]
        );

        const [first] = await ethers.getSigners();

        const deadline = (await time.latest()) + 100;
        tokenA.approve(CoinMingleRouter.address, 500);

        const initialAmount = await tokenB.balanceOf(first.address);
        afterSwapTokenB = await CoinMingleRouter.getAmountOut(500, [
          tokenA.address,
          tokenB.address,
        ]);
        await CoinMingleRouter.swapTokensForTokens(
          500,
          0,
          [tokenA.address, tokenB.address],
          first.address,
          deadline
        );

        const afterSwapTokenBBalance = await tokenB.balanceOf(first.address);
        expect(afterSwapTokenBBalance).to.equal(
          initialAmount.add(amountOfTokenBAfterSwap)
        );
      });

      it("Should update the reserve of both tokens in the pool", async () => {
        const reserveAfterSwap = await Pair.getReserves();

        expect(reserveAfterSwap[0]).to.be.equal(reserve[0].add(500));
        expect(reserveAfterSwap[1]).to.be.equal(
          reserve[1].sub(afterSwapTokenB)
        );
      });
    });
    describe("Failure", () => {});
  });

  describe("__swapFTMForTokens__", () => {
    let reserve: BigNumber[];
    let afterSwapTokenB: BigNumber;
    let wftmPair: CoinMingleLP;
    let requiredToken: BigNumber;
    describe("Success", () => {
      it("Should increase the liquidity in the tokenA and tokenB pool", async () => {
        const [, , third, frth] = await ethers.getSigners();
        /// Adding Liquidity to tokenA and tokenB LP
        const deadline = (await time.latest()) + 100;

        const _pairAddress = await CoinMingleRouter.getPair(
          tokenA.address,
          WFTM_address
        );
        wftmPair = await ethers.getContractAt("CoinMingleLP", _pairAddress);

        tokenA.approve(CoinMingleRouter.address, 500);
        const requiredFTM = await CoinMingleRouter.getTokenInFor(
          tokenA.address,
          WFTM_address,
          500
        );

        await CoinMingleRouter.addLiquidityFTM(
          tokenA.address,
          500,
          frth.address,
          deadline,
          { value: requiredFTM }
        );

        reserve = await wftmPair.getReserves();
      });

      it("Should swap the FTM -> tokenA after taking 0.3% trading fees and provide swapped token to the provided address", async () => {
        const [, , third, frth] = await ethers.getSigners();
        const deadline = (await time.latest()) + 100;
        const ethersToSwap = ethers.utils.parseUnits("50000000000", "wei");

        const _balanceBeforeSwap = await tokenA.balanceOf(frth.address);
        requiredToken = await CoinMingleRouter.getTokenInFor(
          WFTM_address,
          tokenA.address,
          ethersToSwap
        );

        await CoinMingleRouter.swapFTMForTokens(
          0,
          [WFTM_address, tokenA.address],
          frth.address,
          deadline,
          { value: ethersToSwap }
        );
        const _balanceAfterSwap = await tokenA.balanceOf(frth.address);

        expect(_balanceAfterSwap.sub(_balanceBeforeSwap)).to.be.equal(
          requiredToken
        );
      });

      it("Should update the reserves of both tokens in the pool ", async () => {
        const newReserve = await wftmPair.getReserves();

        expect(reserve[0].sub(requiredToken)).to.be.equal(newReserve[0]);
        expect(reserve[1].add("50000000000")).to.be.equal(newReserve[1]);
      });
    });
    describe("Failure", () => {});
  });

  describe("__swapTokensForFTM__", () => {
    let reserve: BigNumber[];
    let afterSwapTokenB: BigNumber;
    let wftmPair: CoinMingleLP;
    let requiredToken: BigNumber;
    let FTM_afterSwap: BigNumber;
    let tokenAToBeSwapped: BigNumber;
    describe("Success", () => {
      it("Should swap tokensA -> FTM fter taking 0.3% trading fees and provide swapped FM to the provided address", async () => {
        const [, , third, frth] = await ethers.getSigners();
        const deadline = (await time.latest()) + 100;
        const frthInitialFTMBalance = await ethers.provider.getBalance(
          frth.address
        );
        const pairAddress = await CoinMingleRouter.getPair(
          WFTM_address,
          tokenA.address
        );
        wftmPair = await ethers.getContractAt("CoinMingleLP", pairAddress);
        reserve = await wftmPair.getReserves();
        const K = await wftmPair.K();

        tokenAToBeSwapped = ethers.utils.parseUnits("1998", "wei");
        FTM_afterSwap = await CoinMingleRouter.getAmountOut(tokenAToBeSwapped, [
          tokenA.address,
          WFTM_address,
        ]);

        tokenA.approve(CoinMingleRouter.address, tokenAToBeSwapped);
        await CoinMingleRouter.swapTokensForFTM(
          tokenAToBeSwapped,
          0,
          [tokenA.address, WFTM_address],
          frth.address,
          deadline
        );

        const frthAfterFTMBalance = await ethers.provider.getBalance(
          frth.address
        );

        expect(frthAfterFTMBalance.sub(frthInitialFTMBalance)).to.be.equal(
          FTM_afterSwap
        );
      });

      it("Should update the reserves of both the WFTM and TokenA after swap correctly ", async () => {
        const updatedReserve = await wftmPair.getReserves();

        expect(reserve[0].add(tokenAToBeSwapped)).to.be.equal(
          updatedReserve[0]
        );
        expect(reserve[1].sub(FTM_afterSwap)).to.be.equal(updatedReserve[1]);
      });

      it("Should swap tokenB with FTM successfuly as there is no pair between tokenB and WFM", async () => {
        const A_B_Reserve = await Pair.getReserves();
        const WFTM_A_Reserve = await wftmPair.getReserves();
        // console.log("k1", await Pair.K());
        // console.log("k2", await wftmPair.K());

        const FTM_afterSwap = await CoinMingleRouter.getAmountOut(4876, [
          tokenB.address,
          tokenA.address,
          WFTM_address,
        ]);
        // console.log(FTM_afterSwap);
        // console.log("A B", A_B_Reserve);
        // console.log(" WFTM A", WFTM_A_Reserve);
      });
    });
    describe("Failure", () => {});
  });
});
