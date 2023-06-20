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

  describe("___Deployments___", () => {
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

    describe("Failure", () => {
      it("Should revert adding liquidity while tokenA & tokenB is 0 address.", async () => {
        const [deployer] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 1_00_000;
        await expect(
          CoinMingleRouter.addLiquidity(
            zeroAddress,
            zeroAddress,
            0,
            0,
            deployer.address,
            deadLine
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InvalidAddress");
        await expect(
          CoinMingleRouter.addLiquidity(
            tokenA.address,
            zeroAddress,
            0,
            0,
            deployer.address,
            deadLine
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InvalidAddress");
      });

      it("Should revert adding liquidity while deadline passed.", async () => {
        const [deployer] = await ethers.getSigners();
        const deadLine = (await time.latest()) - 1_00_000;
        await expect(
          CoinMingleRouter.addLiquidity(
            zeroAddress,
            zeroAddress,
            0,
            0,
            deployer.address,
            deadLine
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "DeadlinePassed");
      });

      it("Should revert adding liquidity while tokenA & tokenB amount is 0.", async () => {
        const [deployer] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 1_00_000;
        await expect(
          CoinMingleRouter.addLiquidity(
            tokenA.address,
            tokenB.address,
            0,
            0,
            deployer.address,
            deadLine
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InsufficientAmount");
        await expect(
          CoinMingleRouter.addLiquidity(
            tokenA.address,
            tokenB.address,
            100,
            0,
            deployer.address,
            deadLine
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InsufficientAmount");
      });
    });
  });

  describe("___Swapping___", () => {
    const swapA_amount = ethers.utils.parseUnits("2", tokenA_decimals);
    const swapB_amount = ethers.utils.parseUnits("4", tokenB_decimals);

    describe("Success", () => {
      it("Should return the 55tokenA & 220tokenB balance of pair.", async () => {
        expect(await tokenA.balanceOf(Pair.address)).to.be.equal(
          ethers.utils.parseUnits("55", tokenA_decimals)
        );
        expect(await tokenB.balanceOf(Pair.address)).to.be.equal(
          ethers.utils.parseUnits("220", tokenB_decimals)
        );
      });

      it("Should calculate tokenB amountOut with 2tokenA.", async () => {
        const path = [tokenA.address, tokenB.address];
        const amount = await CoinMingleRouter.getAmountOut(swapA_amount, path);
        console.log("\t", `TokenB out: ${amount}`);
      });

      it("Should swap 2tokenA for tokenB.", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 100;
        const path = [tokenA.address, tokenB.address];

        const amountMin = await CoinMingleRouter.getAmountOut(
          swapA_amount,
          path
        );
        const tx = await CoinMingleRouter.swapTokensForTokens(
          swapA_amount,
          amountMin,
          path,
          thrdAc.address,
          deadLine
        );
        expect(await tx.wait());
      });

      it("Should return the balanceOf tokenB of thrdAc is 7.7193.", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        expect(await tokenB.balanceOf(thrdAc.address)).to.be.equal(
          ethers.utils.parseUnits("7.7193", tokenB_decimals)
        );
      });

      it("Should return the 57tokenA & 212.2807tokenB balance of pair.", async () => {
        expect(await tokenA.balanceOf(Pair.address)).to.be.equal(
          ethers.utils.parseUnits("57", tokenA_decimals)
        );
        expect(await tokenB.balanceOf(Pair.address)).to.be.equal(
          ethers.utils.parseUnits("212.2807", tokenB_decimals)
        );
      });

      it("Should calculate tokenA amountOut with 4tokenB.", async () => {
        const path = [tokenB.address, tokenA.address];
        const amount = await CoinMingleRouter.getAmountOut(swapB_amount, path);
        console.log("\t", `TokenA out: ${amount}`);
      });

      it("Should swap 4tokenB for tokenA.", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 100;
        const path = [tokenB.address, tokenA.address];

        const amountMin = await CoinMingleRouter.getAmountOut(
          swapB_amount,
          path
        );
        const tx = await CoinMingleRouter.swapTokensForTokens(
          swapB_amount,
          amountMin,
          path,
          thrdAc.address,
          deadLine
        );
        expect(await tx.wait());
      });

      it("Should return the balanceOf tokenA of thrdAc is 1.0542", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        expect(await tokenA.balanceOf(thrdAc.address)).to.be.equal(
          ethers.utils.parseUnits("1.0542", tokenB_decimals)
        );
      });

      it("Should return the 55.9458tokenA & 216.2807tokenB balance of pair.", async () => {
        expect(await tokenA.balanceOf(Pair.address)).to.be.equal(
          ethers.utils.parseUnits("55.9458", tokenA_decimals)
        );
        expect(await tokenB.balanceOf(Pair.address)).to.be.equal(
          ethers.utils.parseUnits("216.2807", tokenB_decimals)
        );
      });
    });

    describe("Failure", () => {
      it("Should revert swapping while path length is <2", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 100;
        const path = [tokenB.address];

        await expect(
          CoinMingleRouter.swapTokensForTokens(
            swapB_amount,
            0,
            path,
            thrdAc.address,
            deadLine
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InvalidPath");
      });

      it("Should revert swapping while to address is 0 address.", async () => {
        const deadLine = (await time.latest()) + 100;
        const path = [tokenB.address, tokenA.address];

        await expect(
          CoinMingleRouter.swapTokensForTokens(
            swapB_amount,
            0,
            path,
            zeroAddress,
            deadLine
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InvalidAddress");
      });

      it("Should revert swapping while pair not exists", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 100;
        const path = [tokenB.address, CoinMingleRouter.address];

        await expect(
          CoinMingleRouter.swapTokensForTokens(
            swapB_amount,
            0,
            path,
            thrdAc.address,
            deadLine
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "PairDoesNotExist");
      });
    });
  });

  describe("___Remove Liquidity___", () => {
    describe("Success", () => {
      it("Should get the balanceOf tokenA & tokenB of deployer before.", async () => {
        const [deployer] = await ethers.getSigners();

        const balanceOfA = await tokenA.balanceOf(deployer.address);
        const balanceOfB = await tokenB.balanceOf(deployer.address);

        expect(balanceOfA).to.be.equal(
          ethers.utils.parseUnits("99943", tokenA_decimals)
        );
        expect(balanceOfB).to.be.equal(
          ethers.utils.parseUnits("99776", tokenB_decimals)
        );
      });

      it("Should approve lp amount from pair.", async () => {
        const [deployer] = await ethers.getSigners();
        const tx = await Pair.approve(
          CoinMingleRouter.address,
          await Pair.balanceOf(deployer.address)
        );
        expect(await tx.wait());
      });

      it("Should remove liquidity of deployer of 9.9LP", async () => {
        const [deployer] = await ethers.getSigners();
        const lp = await Pair.balanceOf(deployer.address);
        const deadline = (await time.latest()) + 100;

        const tx = await CoinMingleRouter.removeLiquidity(
          tokenA.address,
          tokenB.address,
          lp,
          deployer.address,
          deadline
        );
        expect(await tx.wait());
      });

      it("Should get the balanceOf tokenA & tokenB of deployer after.", async () => {
        const [deployer] = await ethers.getSigners();

        const balanceOfA = await tokenA.balanceOf(deployer.address);
        const balanceOfB = await tokenB.balanceOf(deployer.address);

        expect(balanceOfA).to.be.equal(
          ethers.utils.parseUnits("99948.0351", tokenA_decimals)
        );
        expect(balanceOfB).to.be.equal(
          ethers.utils.parseUnits("99795.4652", tokenB_decimals)
        );
      });

      it("Should return the reserves 50.9107tokenA & 196.8155tokenB.", async () => {
        const reserveA_amount = ethers.utils.parseUnits(
          "50.9107",
          tokenA_decimals
        );
        const reserveB_amount = ethers.utils.parseUnits(
          "196.8155",
          tokenB_decimals
        );

        const { reserveA, reserveB } = await Pair.getReserves();

        expect(reserveA).to.be.equal(reserveA_amount);
        expect(reserveB).to.be.equal(reserveB_amount);
        expect(await tokenA.balanceOf(Pair.address)).to.be.equal(
          reserveA_amount
        );
        expect(await tokenB.balanceOf(Pair.address)).to.be.equal(
          reserveB_amount
        );
      });
    });

    describe("failure", () => {
      it("Should revert remove liquidity of deployer.", async () => {
        const [deployer] = await ethers.getSigners();
        const lp = await Pair.balanceOf(deployer.address);
        const deadline = (await time.latest()) + 100;

        await expect(
          CoinMingleRouter.removeLiquidity(
            tokenA.address,
            tokenB.address,
            lp,
            deployer.address,
            deadline
          )
        ).to.be.revertedWithCustomError(
          CoinMingleRouter,
          "InsufficientLiquidity"
        );
      });

      it("Should revert remove liquidity while pair not exists.", async () => {
        const [deployer] = await ethers.getSigners();
        const deadline = (await time.latest()) + 100;

        await expect(
          CoinMingleRouter.removeLiquidity(
            tokenA.address,
            CoinMingleRouter.address,
            1,
            deployer.address,
            deadline
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "PairDoesNotExist");
      });
    });
  });

  describe("__AddLiquidityFTM__", () => {
    describe("Success", () => {
      it("Should create a pair of tokenA and WFTM providing FTM", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 1000;
        const tokenALiquidityAmount = ethers.utils.parseUnits(
          "4500",
          tokenA_decimals
        );

        const tx = await CoinMingleRouter.addLiquidityFTM(
          tokenA.address,
          tokenALiquidityAmount,
          thrdAc.address,
          deadLine,
          { value: ethers.utils.parseUnits("1000000", "wei") }
        );

        const receipt = await tx.wait();
      });

      it("Should display the correct reserves of WFTM and TokenA .. and Allocate liquidity correctly", async () => {
        const pair = await CoinMingleRouter.allPairs(1);

        expect(await tokenA.balanceOf(pair)).to.be.equal("45000000");
        expect(await WFTM.balanceOf(pair)).to.be.equal("1000000");
        const LP_pair = await ethers.getContractAt("CoinMingleLP", pair);

        const [, , thrdAc] = await ethers.getSigners();
        const resulted_lp = Math.sqrt(45000000 * 1000000);
        expect(await LP_pair.balanceOf(thrdAc.address)).to.be.equal(
          Math.floor(resulted_lp) - 1000
        );
        expect(await LP_pair.balanceOf(LP_pair.address)).to.be.equal(1000);
        expect(await LP_pair.K()).to.equal(45000000 * 1000000);
      });

      it("Should return the extra amount of FTM if not provided in correct ratio", async () => {
        const [, , , frthAccount] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 1000;
        const tokenALiquidityAmount = ethers.utils.parseUnits(
          "4500",
          tokenA_decimals
        );

        const pair = await CoinMingleRouter.allPairs(1);
        const LP_pair = await ethers.getContractAt("CoinMingleLP", pair);
        const FTM_Amount = ethers.utils.parseUnits("10000000", "wei");

        const tx = await CoinMingleRouter.addLiquidityFTM(
          tokenA.address,
          tokenALiquidityAmount,
          frthAccount.address,
          deadLine,
          { value: FTM_Amount }
        );
        const reserves = await LP_pair.getReserves();
        expect(reserves[0]).to.be.equal("90000000");
        expect(reserves[1]).to.be.equal("2000000");
      });
    });

    describe("Failure", () => {
      it("Should revert if pairing token is Zero address", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 1000;
        const tokenALiquidityAmount = ethers.utils.parseUnits(
          "4500",
          tokenA_decimals
        );

        const FTM_Amount = ethers.utils.parseUnits("1000000", "wei");

        await expect(
          CoinMingleRouter.addLiquidityFTM(
            zeroAddress,
            tokenALiquidityAmount,
            thrdAc.address,
            deadLine,
            { value: FTM_Amount }
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InvalidAddress");
      });

      it("Should revert if token Amount is sent as 0", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 1000;

        const FTM_Amount = ethers.utils.parseUnits("1000000", "wei");

        await expect(
          CoinMingleRouter.addLiquidityFTM(
            tokenA.address,
            0,
            thrdAc.address,
            deadLine,
            { value: FTM_Amount }
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InsufficientAmount");
      });

      it("Should revert if 0 FTM is sent", async () => {
        const [, , thrdAc] = await ethers.getSigners();
        const deadLine = (await time.latest()) + 1000;

        const tokenALiquidityAmount = ethers.utils.parseUnits(
          "4500",
          tokenA_decimals
        );

        await expect(
          CoinMingleRouter.addLiquidityFTM(
            tokenA.address,
            tokenALiquidityAmount,
            thrdAc.address,
            deadLine,
            { value: 0 }
          )
        ).to.be.revertedWithCustomError(CoinMingleRouter, "InsufficientAmount");
      });
    });

    it("Should revert if liquidity after MINIMUM liquidity is 0 ", async () => {
      const [, , thrdAc] = await ethers.getSigners();
      const deadLine = (await time.latest()) + 1000;

      await expect(
        CoinMingleRouter.addLiquidityFTM(
          tokenA.address,
          10,
          thrdAc.address,
          deadLine,
          { value: 10 }
        )
      ).to.be.revertedWithCustomError(
        CoinMingleRouter,
        "InsufficientLiquidity"
      );
    });
  });
});
