import { HardhatUserConfig } from "hardhat/config";

import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";

import "solidity-coverage";

import dotenv from "dotenv";

dotenv.config();

const DEFAULT_MNEMONIC =
  "test test test test test test test test test test test test";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: 0,
    recipient: 1,
  },
  networks: {
    ropsten: {
      url: `https://ropsten.infura.io/v3/${
        process.env.INFURA_PROJECT_ID || ""
      }`,
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 1,
      },
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_PROJECT_ID}` || "",
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${
        process.env.INFURA_PROJECT_ID || ""
      }`,
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${
        process.env.INFURA_PROJECT_ID || ""
      }`,
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 20,
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: {
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 40,
      },
    },
    ganache: {
      url: "http://127.0.0.1:7545",
      accounts: {
        mnemonic: DEFAULT_MNEMONIC,
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 25,
      },
    },
    hardhat: {
      forking: {
        url: `https://mainnet.infura.io/v3/${
          process.env.INFURA_PROJECT_ID || ""
        }`,
        enabled: process.env.FORKING === "true",
        blockNumber: 17572623,
      },
      accounts: {
        count: 10,
        initialIndex: 0,
        mnemonic: process.env.MNEMONIC || DEFAULT_MNEMONIC,
      },
    },
  },
};

export default config;
