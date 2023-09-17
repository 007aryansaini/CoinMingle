/// Mainnet Chain
import { polygonMumbai } from "wagmi/chains";

export const chains = [
  {
    ...polygonMumbai,
    
  },
];
// export const chains = [
//   {
//     ...fantom,
//     rpcUrls: {
//       default: {
//         http: ["https://rpc.ftm.tools/"],
//       },
//       public: {
//         http: ["https://rpc.ftm.tools/"],
//       },
//     },
//   },
// ];
export const ACTIVE_CHAIN = polygonMumbai;
export const EXPLORER = "https://mumbai.polygonscan.com/";
export const CoinMingleRouter = "0x66CB8d9209990A8021bF8Fd6d9812EF1746a0c38";
export const WFTM = "0x9c3c9283d3e44854697cd22d3faa240cfb032889";

/// Testnet Chain
// import { fantomTestnet } from "wagmi/chains";
// export const chains = [fantomTestnet];
// export const ACTIVE_CHAIN = fantomTestnet;
// export const EXPLORER = "https://testnet.ftmscan.com";
// export const CoinMingleRouter = "0x6B37410133cDC3365fFd80008b6C1040Db83a04f";
// export const WFTM = "0x812666209b90344ec8e528375298ab9045c2bd08";

/// OTHER CONFIG
export const PROJECT_ID = "ab3bbfc86a151e76c8aac6bbaea9ccf8";
export const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";
export const POOL_PATH = "/api/pool";

/// Walletconnect theme
export const themeVariables = {
  "--w3m-accent-color": "#fff",
  "--w3m-accent-fill-color": "#000",
  "--w3m-text-medium-regular-size": "0.8rem",
};
