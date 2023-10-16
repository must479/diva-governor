import { expect } from "chai";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";

import {
  DivaGovernor,
  DivaGovernor__factory,
  DivaToken,
  DivaToken__factory,
  DivaTimelockController,
  DivaTimelockController__factory,
} from "../typechain-types";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { CONFIG } from "../deploy-configuration";

import {
  propose,
  proposalVoteQueueAndExecute,
  ProposalState,
} from "../scripts/helpers";

const test = it;
const helpers = require("@nomicfoundation/hardhat-network-helpers");

describe("DivaGovernor check deployment parameters", function () {
  let governor: DivaGovernor;
  let governanceToken: DivaToken;
  let divaTimelockController: DivaTimelockController;

  beforeEach(async () => {
    await network.provider.send("hardhat_reset", []);

    await deployments.fixture(["all"]);
    governor = await ethers.getContract("DivaGovernor");
    divaTimelockController = await ethers.getContract("DivaTimelockController");
    governanceToken = await ethers.getContract("DivaToken");
  });

  test("01. Should check governor's voting delay", async function () {
    expect(await governor.votingDelay()).to.equal(CONFIG.VOTING_DELAY);
  });

  test("02. Should check governor's voting period", async function () {
    expect(await governor.votingPeriod()).to.equal(CONFIG.VOTING_PERIOD);
  });

  test("03. Should check governor's proposal threshold", async function () {
    expect(await governor.proposalThreshold()).to.equal(
      CONFIG.PROPOSAL_THRESHOLD
    );
  });

  test("04. Should check governor's timelock controller", async function () {
    expect(await governor.timelock()).to.equal(divaTimelockController.address);
  });
});

describe("DivaGovernor change initial parameters and test cancelling feature", function () {
  let governor: DivaGovernor;
  let divaToken: DivaToken;
  let divaTimelockController: DivaTimelockController;
  let accounts: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let recipient: SignerWithAddress;

  enum Vote {
    Against,
    For,
    Abstain,
  }

  beforeEach(async () => {
    await network.provider.send("hardhat_reset", []);
    [deployer, recipient, ...accounts] = await ethers.getSigners();

    await deployments.fixture(["all"]);
    const governorDeployment = await deployments.get("DivaGovernor");
    governor = DivaGovernor__factory.connect(
      governorDeployment.address,
      deployer
    );
    const divaTimelockControllerDeployment = await deployments.get(
      "DivaTimelockController"
    );
    divaTimelockController = DivaTimelockController__factory.connect(
      divaTimelockControllerDeployment.address,
      deployer
    );

    const divaTokenDeployment = await deployments.get("DivaToken");

    divaToken = DivaToken__factory.connect(
      divaTokenDeployment.address,
      recipient
    );

    // send all to recipient
    const distro = [
      {
        to: recipient.address,
        amount: CONFIG.INITIAL_SUPPLY,
      },
    ];

    const airdrop = {
      to: recipient.address,
      amount: ethers.utils.parseEther("0"),
    };

    await divaToken
      .connect(deployer)
      .distributeAndTransferOwnership(
        distro,
        airdrop,
        divaTimelockController.address,
        {
          gasLimit: 1500000,
        }
      );
  });

  test("01. Should propose, wait, vote, queue and execute proposal - governor parameter - update quorum", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Generate a proposal
    const proposalFunction = "updateQuorum";
    const proposalValue = ["10000001000000000000000000"];
    const proposalDescription = "Increase quorum absolute value";

    expect(
      await proposalVoteQueueAndExecute(
        governor,
        governor,
        deployer,
        [deployer],
        [1],
        CONFIG.VOTING_DELAY,
        CONFIG.VOTING_PERIOD,
        proposalFunction,
        proposalDescription,
        0,
        proposalValue
      )
    ).to.be.true;
  });

  test("02. Should propose, wait, vote, queue and execute proposal - governor parameter - new timelock controller", async function () {
    const TimelockController = await ethers.getContractFactory(
      "DivaTimelockController"
    );
    const timelockController = await TimelockController.deploy(1);

    await timelockController.deployed();

    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    const proposalFunction = "updateTimelock";
    const proposalValue = [timelockController.address];
    const proposalDescription = "Update timelock controller";

    expect(
      await proposalVoteQueueAndExecute(
        governor,
        governor,
        deployer,
        [deployer],
        [1],
        CONFIG.VOTING_DELAY,
        CONFIG.VOTING_PERIOD,
        proposalFunction,
        proposalDescription,
        0,
        proposalValue
      )
    ).to.be.true;
  });

  test("03. Should propose, wait, vote, queue and FAIL TO CANCEL proposal from guardian - governor parameter", async function () {
    // 0. Delegate
    expect(
      await divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "setVotingDelay";
    const proposalValue = [1000];
    const proposalDescription = "Update voting delay (governor) to 1000 blocks";

    const [encodedFunctionCall, proposalId, proposalTargetContract] =
      await propose(
        proposalFunction,
        proposalValue,
        proposalDescription,
        governor,
        governor,
        deployer
      );

    // 2. Vote to active proposal
    await helpers.mine(CONFIG.VOTING_DELAY);

    await expect(
      governor
        .connect(deployer)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    const proposalVotes = await governor.proposalVotes(proposalId);
    const deployerVotingPower = await divaToken.getVotes(deployer.address);
    expect(proposalVotes.forVotes).to.be.equal(deployerVotingPower);
    expect(await governor.hasVoted(proposalId, deployer.address)).to.be.true;

    // 3. Queue
    await helpers.mine(CONFIG.VOTING_PERIOD);

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposalDescription)
    );
    const queueTx = await governor
      .connect(deployer)
      .queue(
        [proposalTargetContract],
        [0],
        [encodedFunctionCall],
        descriptionHash,
        { gasLimit: 500000 }
      );

    const queueReceipt = await queueTx.wait(1);
    const queueId = queueReceipt.events![0].topics[1];

    // 4. Wait timelock cooldown
    await helpers.mine(CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY);

    const cancellerRole = await divaTimelockController.CANCELLER_ROLE();
    const accessControlMessage =
      "AccessControl: account " +
      deployer.address.toLowerCase() +
      " is missing role " +
      cancellerRole;

    // 5. Cancel
    await expect(
      divaTimelockController.connect(deployer).cancel(queueId, {
        gasLimit: 500000,
      })
    ).to.be.revertedWith(accessControlMessage);
  });

  test("04. Should propose, wait, vote, queue a malicious proposal - short cancellation proposal should be submitted and cancel it", async function () {
    // 0. Delegate
    expect(
      await divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "setVotingDelay";
    const proposalValue = [10];
    const proposalDescription =
      "voting delay very short not allowing voting power delegation can be malicious...";

    const [encodedFunctionCall, proposalId, proposalTargetContract] =
      await propose(
        proposalFunction,
        proposalValue,
        proposalDescription,
        governor,
        governor,
        deployer
      );

    // 2. Vote to active proposal
    await helpers.mine(CONFIG.VOTING_DELAY);

    await expect(
      governor
        .connect(deployer)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    // 3. Queue
    await helpers.mine(CONFIG.VOTING_PERIOD);

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposalDescription)
    );

    const queueTx = await governor
      .connect(deployer)
      .queue(
        [proposalTargetContract],
        [0],
        [encodedFunctionCall],
        descriptionHash,
        { gasLimit: 500000 }
      );

    const queueReceipt = await queueTx.wait(1);
    const queueId = queueReceipt.events![0].topics[1];

    await helpers.mine(1);

    // 1. Propose
    const cancellationProposalFunction = "cancel";
    const cancellationProposalValue = [queueId];
    const cancellationProposalDescription = "Cancel malicious proposal";

    await expect(
      proposalVoteQueueAndExecute(
        governor,
        divaTimelockController,
        deployer,
        [deployer],
        [1],
        CONFIG.VOTING_DELAY,
        CONFIG.VOTING_PERIOD,
        cancellationProposalFunction,
        cancellationProposalDescription,
        1,
        cancellationProposalValue
      )
    ).to.be.revertedWithCustomError(
      governor,
      "CancellationProposalCannotHaveValue"
    );

    expect(
      await proposalVoteQueueAndExecute(
        governor,
        divaTimelockController,
        deployer,
        [deployer],
        [1],
        CONFIG.VOTING_DELAY,
        CONFIG.VOTING_PERIOD,
        cancellationProposalFunction,
        cancellationProposalDescription,
        0,
        cancellationProposalValue
      )
    ).to.be.true;
  });

  test("05. Should propose, wait, vote, queue a malicious proposal - short cancellation proposal should be submitted and cancel it. \
        A proposal cannot be queued twice", async function () {
    // 0. Delegate
    expect(
      await divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "setVotingDelay";
    const proposalValue = [10];
    const proposalDescription =
      "voting delay very short not allowing voting power delegation can be malicious...";

    const [encodedFunctionCall, proposalId, proposalTargetContract] =
      await propose(
        proposalFunction,
        proposalValue,
        proposalDescription,
        governor,
        governor,
        deployer
      );

    // 2. Vote to active proposal
    await helpers.mine(CONFIG.VOTING_DELAY);

    await expect(
      governor
        .connect(deployer)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    // 3. Queue
    await helpers.mine(CONFIG.VOTING_PERIOD);

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposalDescription)
    );

    const queueTx = await governor
      .connect(deployer)
      .queue(
        [proposalTargetContract],
        [0],
        [encodedFunctionCall],
        descriptionHash,
        { gasLimit: 500000 }
      );

    const queueReceipt = await queueTx.wait(1);
    const queueId = queueReceipt.events![0].topics[1];

    await helpers.mine(1);

    // 1. Propose
    const cancellationProposalFunction = "cancel";
    const cancellationProposalValue = [queueId];
    const cancellationProposalDescription = "Cancel malicious proposal";

    expect(
      await proposalVoteQueueAndExecute(
        governor,
        divaTimelockController,
        deployer,
        [deployer],
        [1],
        CONFIG.VOTING_DELAY,
        CONFIG.VOTING_PERIOD,
        cancellationProposalFunction,
        cancellationProposalDescription,
        0,
        cancellationProposalValue
      )
    ).to.be.true;

    await governor.state(proposalId).then((state) => {
      console.log("\t\t" + "Proposal state: - " + ProposalState[state]);
    });

    await expect(
      governor
        .connect(deployer)
        .queue(
          [proposalTargetContract],
          [0],
          [encodedFunctionCall],
          descriptionHash,
          { gasLimit: 500000 }
        )
    ).to.be.revertedWith("Governor: proposal not successful");
  });

  test("06. Proposer can cancel its own proposal in pending state", async function () {
    // 0. Delegate
    expect(
      await divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "setVotingDelay";
    const proposalValue = [10];
    const proposalDescription =
      "voting delay very short not allowing voting power delegation can be malicious...";

    const [encodedFunctionCall, proposalId, proposalTargetContract] =
      await propose(
        proposalFunction,
        proposalValue,
        proposalDescription,
        governor,
        governor,
        deployer
      );

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposalDescription)
    );

    // 2. Cancel
    await expect(
      governor
        .connect(deployer)
        .cancel(
          [governor.address],
          [0],
          [encodedFunctionCall],
          descriptionHash,
          {
            gasLimit: 500000,
          }
        )
    ).not.to.be.reverted;
  });

  test("07. Should NOT cancel a proposal in governor", async function () {
    // 0. Delegate
    expect(
      await divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "setVotingDelay";
    const proposalValue = [10];
    const proposalDescription =
      "voting delay very short not allowing voting power delegation can be malicious...";

    const [encodedFunctionCall, proposalId, proposalTargetContract] =
      await propose(
        proposalFunction,
        proposalValue,
        proposalDescription,
        governor,
        governor,
        deployer
      );

    await helpers.mine(CONFIG.VOTING_DELAY);

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposalDescription)
    );

    // 2. Cancel by random account is not allowed
    await expect(
      governor
        .connect(accounts[1])
        .cancel(
          [governor.address],
          [0],
          [encodedFunctionCall],
          descriptionHash,
          {
            gasLimit: 500000,
          }
        )
    ).to.be.revertedWith("Governor: too late to cancel");

    // 2. Cancel by proposer is not allowed
    await expect(
      governor
        .connect(deployer)
        .cancel(
          [governor.address],
          [0],
          [encodedFunctionCall],
          descriptionHash,
          {
            gasLimit: 500000,
          }
        )
    ).to.be.revertedWith("Governor: too late to cancel");

    await expect(
      governor
        .connect(deployer)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    // 3. Queue
    await helpers.mine(CONFIG.VOTING_PERIOD);

    const queueTx = await governor
      .connect(deployer)
      .queue(
        [proposalTargetContract],
        [0],
        [encodedFunctionCall],
        descriptionHash,
        { gasLimit: 500000 }
      );

    const queueReceipt = await queueTx.wait(1);
    const queueId = queueReceipt.events![0].topics[1];

    await helpers.mine(1);
  });

  test("08. Should not allow to change quorum without governance process", async function () {
    await expect(
      governor.updateQuorum(ethers.utils.parseEther("5000001"))
    ).to.be.revertedWith("Governor: onlyGovernance");
  });

  test("09. Should get interface hash", async function () {
    expect(await governor.supportsInterface("0x01ffc9a7")).to.be.true;
  });
});

describe("DivaToken - governance - proposal threshold", function () {
  let governor: DivaGovernor;
  let divaToken: DivaToken;
  let divaTimelockController: DivaTimelockController;
  let accounts: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let recipient: SignerWithAddress;

  beforeEach(async () => {
    await network.provider.send("hardhat_reset", []);
    [deployer, recipient, ...accounts] = await ethers.getSigners();

    await deployments.fixture(["all"]);
    const governorDeployment = await deployments.get("DivaGovernor");

    governor = DivaGovernor__factory.connect(
      governorDeployment.address,
      deployer
    );

    const divaTimelockControllerDeployment = await deployments.get(
      "DivaTimelockController"
    );

    divaTimelockController = DivaTimelockController__factory.connect(
      divaTimelockControllerDeployment.address,
      deployer
    );

    const divaTokenDeployment = await deployments.get("DivaToken");

    divaToken = DivaToken__factory.connect(
      divaTokenDeployment.address,
      recipient
    );

    const distro = [
      {
        to: recipient.address,
        amount: CONFIG.INITIAL_SUPPLY,
      },
    ];

    const airdrop = {
      to: recipient.address,
      amount: ethers.utils.parseEther("0"),
    };

    await divaToken
      .connect(deployer)
      .distributeAndTransferOwnership(
        distro,
        airdrop,
        divaTimelockController.address,
        {
          gasLimit: 1500000,
        }
      );

    const TEN_WEEKS_SECONDS = 60 * 60 * 24 * 7 * 10;
    const oneSecondAfterEndTime =
      CONFIG.AIRDROP.CLAIM_ENDTIME + TEN_WEEKS_SECONDS;

    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    const proposalFunction = "unpause";
    const proposalDescription = "Resume diva token transferability";

    await expect(
      proposalVoteQueueAndExecute(
        governor,
        divaToken,
        deployer,
        [deployer],
        [1],
        CONFIG.VOTING_DELAY,
        CONFIG.VOTING_PERIOD,
        proposalFunction,
        proposalDescription,
        0
      )
    ).to.be.revertedWith("TimelockController: underlying transaction reverted");
    await ethers.provider.send("evm_mine", [oneSecondAfterEndTime]);

    const encodedFunctionCall =
      divaToken.interface.encodeFunctionData(proposalFunction);

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposalDescription)
    );

    await expect(
      governor
        .connect(deployer)
        .execute(
          [divaToken.address],
          [0],
          [encodedFunctionCall],
          descriptionHash,
          { gasLimit: 500000 }
        )
    ).not.to.be.reverted;
    expect(await divaToken.paused()).to.be.false;

    // distribute diva tokens looking for the proposal threshold
    await divaToken
      .connect(recipient)
      .transfer(accounts[0].address, ethers.utils.parseEther("100000"));

    await divaToken
      .connect(recipient)
      .transfer(accounts[1].address, ethers.utils.parseEther("999999"));

    await divaToken
      .connect(recipient)
      .transfer(accounts[2].address, ethers.utils.parseEther("1000000"));

    await divaToken.connect(accounts[0]).delegate(accounts[0].address);

    await divaToken.connect(accounts[1]).delegate(accounts[1].address);

    await divaToken.connect(accounts[2]).delegate(accounts[2].address);
  });

  test("01. Should not allow to propose with less than 1M voting power", async function () {
    // 0. Delegate
    expect(
      await divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "setVotingDelay";
    const proposalValue = [1000];
    const proposalDescription = "Update voting delay (governor) to 1000 blocks";

    await expect(
      propose(
        proposalFunction,
        proposalValue,
        proposalDescription,
        governor,
        governor,
        accounts[0]
      )
    ).to.be.revertedWith("Governor: proposer votes below proposal threshold");

    await expect(
      propose(
        proposalFunction,
        proposalValue,
        proposalDescription,
        governor,
        governor,
        accounts[1]
      )
    ).to.be.revertedWith("Governor: proposer votes below proposal threshold");

    await expect(
      propose(
        proposalFunction,
        proposalValue,
        proposalDescription,
        governor,
        governor,
        accounts[2]
      )
    ).not.to.be.reverted;
  });
});
