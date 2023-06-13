import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.10",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  mocha: {
    timeout: 100000000,
  },
  gasReporter: {
    currency: "USD",
    gasPrice: 5,
    enabled: false,
    // coinmarketcap: process.env.COINMARTKETCAP_API,
  },
  etherscan: {
    apiKey: {
      ftmTest: process.env.FTMSCAN_API as string,
      ftm: process.env.FTMSCAN_API as string,
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://rpc.ftm.tools/",
      },
    },

    ftm_test: {
      url: `https://rpc.testnet.fantom.network/`,
      chainId: 4002,
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
    },

    ftm: {
      url: "https://rpc.ftm.tools/",
      chainId: 250,
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
    },
  },
};

export default config;
