import { ethers } from "hardhat";
import { expect } from "chai";

import { DivaGovernor } from "../typechain-types";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BytesLike } from "ethers";

import { CONFIG } from "../deploy-configuration";

const helpers = require("@nomicfoundation/hardhat-network-helpers");

const LOGPREFIX = "\t\t";

const advanceNBlocks = async function mineBlocks(numBlocks: number) {
  for (let index = 0; index < numBlocks; index++) {
    await ethers.provider.send("evm_mine", []);
  }
};

const stateLogger = async function stateLogger(
  contract: any,
  proposalId: string
) {
  console.log(
    LOGPREFIX +
      "Proposal state: - " +
      ProposalState[await contract.state(proposalId)]
  );
};

const propose = async function propose(
  proposalFunction: string,
  proposalValue: any,
  proposalDescription: string,
  governor: DivaGovernor,
  targetContract: any,
  proposer: SignerWithAddress
) {
  const encodedFunctionCall = targetContract.interface.encodeFunctionData(
    proposalFunction,
    proposalValue
  );

  const proposeTx = await governor
    .connect(proposer)
    .propose(
      [targetContract.address],
      [0],
      [encodedFunctionCall],
      proposalDescription,
      { gasLimit: 500000 }
    );

  const proposeReceipt = await proposeTx.wait(1);
  const proposalId = proposeReceipt.events![0].args!.proposalId;

  return [encodedFunctionCall, proposalId, targetContract.address];
};

const functionHash = function functionSignature(signature: string) {
  return ethers.utils
    .keccak256(ethers.utils.toUtf8Bytes(signature))
    .slice(0, 10);
};

const functionDelay = function functionDelay(delay: string) {
  return ethers.BigNumber.from(delay);
};

const functionThreshold = function functionThreshold(threshold: string) {
  return ethers.BigNumber.from(threshold);
};

enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed,
}

const proposalVoteQueueAndExecute = async function proposeVoteQueueAndExecute(
  governor: DivaGovernor,
  targetContract: any,
  proposer: SignerWithAddress,
  delegatees: SignerWithAddress[],
  votesDirection: number[],
  votingDelay: number,
  votingPeriod: number,
  proposalFunction: string | string[],
  proposalDescription: string,
  proposalValue: number | BigNumber,
  proposalFunctionArgs?:
    | string
    | string[]
    | number
    | number[]
    | BytesLike
    | BytesLike[]
    | Uint8Array[][]
    | any[]
) {
  const encodedFunctionCall = targetContract.interface.encodeFunctionData(
    proposalFunction,
    proposalFunctionArgs
  );

  const proposeTx = await governor
    .connect(proposer)
    .propose(
      [targetContract.address],
      [proposalValue],
      [encodedFunctionCall],
      proposalDescription,
      { gasLimit: 500000 }
    );

  const proposeReceipt = await proposeTx.wait(1);
  const proposalId = proposeReceipt.events![0].args!.proposalId;

  await stateLogger(governor, proposalId);

  await helpers.mine(votingDelay);

  delegatees.forEach(async function callback(delegatee, index) {
    await governor
      .connect(delegatee)
      .castVote(proposalId, votesDirection[index], { gasLimit: 500000 });
  });

  await stateLogger(governor, proposalId);

  await helpers.mine(votingPeriod);

  await stateLogger(governor, proposalId);

  const descriptionHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(proposalDescription)
  );

  const queueTx = await governor
    .connect(proposer)
    .queue(
      [targetContract.address],
      [proposalValue],
      [encodedFunctionCall],
      descriptionHash,
      { gasLimit: 500000 }
    );
  const queueReceipt = await queueTx.wait(1);
  const queueId = queueReceipt.events![0].topics[1];

  await stateLogger(governor, proposalId);

  const proposalEta = await governor.proposalEta(proposalId);
  const currentTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const proposalDelay = proposalEta.sub(currentTimestamp);

  const signatures = CONFIG.FUNCTION_SIGNATURES;
  if (typeof proposalFunction === "string") {
    const index = signatures.findIndex((item) =>
      item.includes(proposalFunction)
    );

    const delay = functionDelay(CONFIG.FUNCTION_DELAYS[index].toString());
    if (proposalValue != 0) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY * 12
      );
    } else if (delay.toNumber() == 0) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY * 12
      );
    } else if (delay.toNumber() == 1) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY * 12
      );
    } else if (delay.toNumber() == 2) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY * 12
      );
    }
  } else {
    // @dev for proposals with multiple actions
    const matchingIndexes = signatures.reduce(
      (indexes: number[], signature, index) => {
        if (proposalFunction.some((match) => signature.includes(match))) {
          indexes.push(index);
        }
        return indexes;
      },
      []
    );
    let restrictiveDelay;
    matchingIndexes.forEach((index) => {
      const delay = functionDelay(CONFIG.FUNCTION_DELAYS[index].toString());
      if (delay.toNumber() == 0) {
        restrictiveDelay = 0;
      } else if (delay.toNumber() == 1) {
        restrictiveDelay = 1;
      } else if (delay.toNumber() == 2) {
        restrictiveDelay = 2;
        return;
      }
    });
    if (restrictiveDelay == 0) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY * 12
      );
    } else if (restrictiveDelay == 1) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY * 12
      );
    } else if (restrictiveDelay == 2) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY * 12
      );
    }
  }
  await helpers.mine(proposalDelay.toNumber() - 1);

  expect(
    await governor
      .connect(proposer)
      .execute(
        [targetContract.address],
        [proposalValue],
        [encodedFunctionCall],
        descriptionHash,
        { gasLimit: 500000 }
      )
  ).not.to.be.reverted;

  await stateLogger(governor, proposalId);

  expect(await governor.state(proposalId)).to.be.equal(ProposalState.Executed);

  expect(await governor.proposalEta(proposalId)).to.be.equal(0);
  return true;
};

const proposalVoteAndQueue = async function proposalVoteAndQueue(
  governor: DivaGovernor,
  targetContract: any,
  proposer: SignerWithAddress,
  delegatees: SignerWithAddress[],
  votesDirection: number[],
  votingDelay: number,
  votingPeriod: number,
  proposalFunction: string | string[],
  proposalDescription: string,
  proposalValue: number | BigNumber,
  proposalFunctionArgs?:
    | string
    | string[]
    | number
    | number[]
    | BytesLike
    | BytesLike[]
    | Uint8Array[][]
    | any[]
) {
  const encodedFunctionCall = targetContract.interface.encodeFunctionData(
    proposalFunction,
    proposalFunctionArgs
  );

  const proposeTx = await governor
    .connect(proposer)
    .propose(
      [targetContract.address],
      [proposalValue],
      [encodedFunctionCall],
      proposalDescription,
      { gasLimit: 500000 }
    );

  const proposeReceipt = await proposeTx.wait(1);
  const proposalId = proposeReceipt.events![0].args!.proposalId;

  await stateLogger(governor, proposalId);

  await helpers.mine(votingDelay);

  delegatees.forEach(async function callback(delegatee, index) {
    await governor
      .connect(delegatee)
      .castVote(proposalId, votesDirection[index], { gasLimit: 500000 });
  });

  await stateLogger(governor, proposalId);

  await helpers.mine(votingPeriod);

  await stateLogger(governor, proposalId);

  const descriptionHash = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(proposalDescription)
  );

  const queueTx = await governor
    .connect(proposer)
    .queue(
      [targetContract.address],
      [proposalValue],
      [encodedFunctionCall],
      descriptionHash,
      { gasLimit: 500000 }
    );
  const queueReceipt = await queueTx.wait(1);
  const queueId = queueReceipt.events![0].topics[1];

  await stateLogger(governor, proposalId);

  const proposalEta = await governor.proposalEta(proposalId);
  const currentTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
  const proposalDelay = proposalEta.sub(currentTimestamp);

  const signatures = CONFIG.FUNCTION_SIGNATURES;
  if (typeof proposalFunction === "string") {
    const index = signatures.findIndex((item) =>
      item.includes(proposalFunction)
    );

    const delay = functionDelay(CONFIG.FUNCTION_DELAYS[index].toString());
    if (proposalValue != 0) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY * 12
      );
    } else if (delay.toNumber() == 0) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY * 12
      );
    } else if (delay.toNumber() == 1) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY * 12
      );
    } else if (delay.toNumber() == 2) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY * 12
      );
    }
  } else {
    // @dev for proposals with multiple actions
    const matchingIndexes = signatures.reduce(
      (indexes: number[], signature, index) => {
        if (proposalFunction.some((match) => signature.includes(match))) {
          indexes.push(index);
        }
        return indexes;
      },
      []
    );
    let restrictiveDelay;
    matchingIndexes.forEach((index) => {
      const delay = functionDelay(CONFIG.FUNCTION_DELAYS[index].toString());
      if (delay.toNumber() == 0) {
        restrictiveDelay = 0;
      } else if (delay.toNumber() == 1) {
        restrictiveDelay = 1;
      } else if (delay.toNumber() == 2) {
        restrictiveDelay = 2;
        return;
      }
    });
    if (restrictiveDelay == 0) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY * 12
      );
    } else if (restrictiveDelay == 1) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY * 12
      );
    } else if (restrictiveDelay == 2) {
      expect(proposalDelay).to.be.equal(
        CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY * 12
      );
    }
  }

  return true;
};

export { propose };
export { advanceNBlocks };
export { stateLogger };
export { functionHash };
export { functionDelay };
export { functionThreshold };
export { proposalVoteQueueAndExecute };
export { proposalVoteAndQueue };
export { ProposalState };
