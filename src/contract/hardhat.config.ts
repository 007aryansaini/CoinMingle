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
      ftmTestnet: process.env.FTMSCAN_API as string,
      opera: process.env.FTMSCAN_API as string,
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: "https://rpcapi.fantom.network",
      },
    },

    ftm_test: {
      url: `https://rpc.testnet.fantom.network/`,
      chainId: 4002,
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
    },

    ftm: {
      url: "https://rpcapi.fantom.network",
      chainId: 250,
      accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
    },
  },
};

export default config;
