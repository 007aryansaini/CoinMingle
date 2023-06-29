import { ethers, network, run } from "hardhat";

const deploy = async () => {
  /// @dev Getting the contract factories.
  const WFTM =
    network.name == "ftm_test"
      ? "0x812666209b90344ec8e528375298ab9045c2bd08"
      : "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83";
  const CoinMingleLPFactory = await ethers.getContractFactory("CoinMingleLP");
  const CoinMingleRouterFactory = await ethers.getContractFactory(
    "CoinMingleRouter"
  );

  /// @dev Deploying the LP contract.
  const LPContract = await CoinMingleLPFactory.deploy();
  await LPContract.deployed();

  const Router = await CoinMingleRouterFactory.deploy(LPContract.address, WFTM);
  await Router.deployed();
  console.log(`Router deployed on '${network.name}' at: ${Router.address}`);

  /// @dev Verifying the initial Version of IQON contract.
  if (network.name !== "hardhat") {
    await LPContract.deployTransaction.wait(6);
    await Router.deployTransaction.wait(6);

    await run("verify:verify", {
      address: LPContract.address,
      constructorArguments: [],
    });

    await run("verify:verify", {
      address: Router.address,
      constructorArguments: [LPContract.address, WFTM],
    });
  }
};

deploy().catch((e) => console.log(e));
