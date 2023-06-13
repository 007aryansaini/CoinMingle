import { ethers } from "hardhat";
import { expect } from "chai";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import {
  CoinMingleLP,
  CoinMingleRouter,
  ERC20,
  Token,
} from "../typechain-types";
console.clear();

const zeroAddress = "0x0000000000000000000000000000000000000000";
const WFTM_address = "0xf1277d1Ed8AD466beddF92ef448A132661956621";

describe("CoinMingle", () => {
  let CoinMingleRouter: CoinMingleRouter;
  let CoinMingleLP: CoinMingleLP;
  let Pair: CoinMingleLP;
  let WFTM: ERC20;

  let tokenA: Token;
  let tokenB: Token;

  const tokenA_decimals = 4;
  const tokenB_decimals = 4;

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

  describe("Deployments", () => {
    describe("___CoinMingleRouter___", () => {
      it("Should return the correct WFTM address", async () => {
        const address = await CoinMingleRouter.WrappedFTM();
        expect(address).to.be.equal(WFTM.address);
      });

      it("Should return the correct CoinMingleLP address", async () => {
        const address = await CoinMingleRouter.CoinMingleImplementation();
        expect(address).to.be.equal(CoinMingleLP.address);
      });

      it("Should return the allPairs length is 0 initially.", async () => {
        const length = await CoinMingleRouter.allPairsLength();
        expect(length).to.be.equal(0);
      });
    });
  });

  describe("___Create Pair___", () => {
    describe("Success", () => {
      it("Should return the allPairs length is 0 initially.", async () => {
        const length = await CoinMingleRouter.allPairsLength();
        expect(length).to.be.equal(0);
      });

      it("Should create a pair with tokenA & tokenB.", async () => {
        const tx = await CoinMingleRouter.createPair(
          tokenA.address,
          tokenB.address
        );
        expect(await tx.wait());
      });

      it("Should print the tokenA & tokenB pair address.", async () => {
        const pair = await CoinMingleRouter.getPair(
          tokenA.address,
          tokenB.address
        );
        Pair = await ethers.getContractAt("CoinMingleLP", pair);
        console.log("\t", `Pair: ${pair}`);
      });

      it("Should return the allPairs length is 1.", async () => {
        const length = await CoinMingleRouter.allPairsLength();
        expect(length).to.be.equal(1);
      });
    });

    describe("Failure", () => {
      it("Should revert creating pair while tokenA is 0 address.", async () => {
        await expect(
          CoinMingleRouter.createPair(zeroAddress, tokenB.address)
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InvalidAddress");
      });

      it("Should revert creating pair while tokenA & tokenB address are same.", async () => {
        await expect(
          CoinMingleRouter.createPair(tokenB.address, tokenB.address)
        ).to.be.revertedWithCustomError(CoinMingleRouter, "IdenticalAddress");
      });

      it("Should revert creating pair while pair of tokenA & tokenB already created.", async () => {
        await expect(
          CoinMingleRouter.createPair(tokenB.address, tokenA.address)
        ).to.be.revertedWithCustomError(CoinMingleRouter, "PairExists");
      });
    });
  });

  describe("___Add Liquidity___", () => {
    describe("Success", () => {
      const tokenAAmount = ethers.utils.parseUnits("5", tokenA_decimals);
      const tokenBAmount = ethers.utils.parseUnits("20", tokenB_decimals);

      it("Should return the tokenA & tokenB balance of pair is 0.", async () => {
        expect(await tokenA.balanceOf(Pair.address)).to.be.equal(0);
        expect(await tokenB.balanceOf(Pair.address)).to.be.equal(0);
      });

      it("Should return the balance of LP is 0 of deployer.", async () => {
        const [deployer] = await ethers.getSigners();
        expect(await CoinMingleLP.balanceOf(deployer.address)).to.be.equal(0);
      });

      it("Should return the pairs reserves as 0 initially.", async () => {
        const { reserveA, reserveB } = await Pair.getReserves();
        expect(reserveA).to.be.equal(0);
        expect(reserveB).to.be.equal(0);
      });

      it("Should approve to spend the tokenA & tokenB.", async () => {
        await tokenA.approve(
          CoinMingleRouter.address,
          ethers.utils.parseUnits("100000", tokenA_decimals)
        );
        await tokenB.approve(
          CoinMingleRouter.address,
          ethers.utils.parseUnits("100000", tokenB_decimals)
        );
      });

      it("Should add liquidity of 5tokenA & 20tokenB pair", async () => {
        const [deployer] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 1000;
        const tx = await CoinMingleRouter.addLiquidity(
          tokenA.address,
          tokenB.address,
          tokenAAmount,
          tokenBAmount,
          deployer.address,
          deadLine
        );

        expect(tx.wait());
      });

      it("Should return the balance of LP of deployer.", async () => {
        const [deployer] = await ethers.getSigners();
        const lpMinted = await Pair.balanceOf(deployer.address);
        console.log("\t", `LP Minted: ${lpMinted.toString()}`);
      });

      it("Should return the 5tokenA & 20tokenB balance of pair.", async () => {
        expect(await tokenA.balanceOf(Pair.address)).to.be.equal(tokenAAmount);
        expect(await tokenB.balanceOf(Pair.address)).to.be.equal(tokenBAmount);
      });

      it("Should print the amount of tokenB for 1tokenA", async () => {
        const amount = await Pair.getAmountOut(
          tokenA.address,
          ethers.utils.parseUnits("1", tokenA_decimals)
        );
        console.log("\t", `tokenB amount: ${amount.toString()}`);
      });

      it("Should print the amount of tokenB for 1tokenA with PATH.", async () => {
        const amount = await CoinMingleRouter.getAmountOut(
          ethers.utils.parseUnits("1", tokenA_decimals),
          [tokenA.address, tokenB.address]
        );
        console.log("\t", `tokenB amount (Path): ${amount.toString()}`);
      });

      it("Should return the pairs reserves as 5reserveA 20reserveB.", async () => {
        const { reserveA, reserveB } = await Pair.getReserves();
        expect(reserveA).to.be.equal(tokenAAmount);
        expect(reserveB).to.be.equal(tokenBAmount);
      });

      it("Should add liquidity of 50tokenA & 200tokenB pair", async () => {
        const [, second] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 1000;
        const tx = await CoinMingleRouter.addLiquidity(
          tokenA.address,
          tokenB.address,
          ethers.utils.parseUnits("50", tokenA_decimals),
          ethers.utils.parseUnits("200", tokenB_decimals),
          second.address,
          deadLine
        );
        expect(tx.wait());
      });

      it("Should return the 55tokenA & 220tokenB balance of pair.", async () => {
        expect(await tokenA.balanceOf(Pair.address)).to.be.equal(
          ethers.utils.parseUnits("55", tokenA_decimals)
        );
        expect(await tokenB.balanceOf(Pair.address)).to.be.equal(
          ethers.utils.parseUnits("220", tokenB_decimals)
        );
      });

      it("Should return the balance of LP of second.", async () => {
        const [, second] = await ethers.getSigners();
        const lpMinted = await Pair.balanceOf(second.address);
        console.log("\t", `LP Minted: ${lpMinted.toString()}`);
      });
    });
  });
});
