import { expect } from "chai";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";
import { BigNumber } from "ethers";

import { ProposalState } from "../constants";

const helpers = require("@nomicfoundation/hardhat-network-helpers");

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
  functionThreshold,
  functionHash,
  functionDelay,
  proposalVoteQueueAndExecute,
  proposalVoteAndQueue,
  propose,
} from "../scripts/helpers";

const test = it;

describe("DivaGovernor deployed with wrong function signatures configuration", function () {
  let governor: DivaGovernor;
  let divaToken: DivaToken;
  let divaTimelockController: DivaTimelockController;
  let deployer: SignerWithAddress;
  let recipient: SignerWithAddress;
  let accounts: SignerWithAddress[];

  test("01. Should fail with wrong delays setup", async function () {
    await deployments.fixture(["all"]);
    const divaToken = await ethers.getContract("DivaToken");
    const timelock = await ethers.getContract("DivaTimelockController");
    const DivaGovernor = await ethers.getContractFactory("DivaGovernor");

    const functionSignatures: string[] = [];
    CONFIG.FUNCTION_SIGNATURES.forEach((element) => {
      functionSignatures.push(functionHash(element));
    });

    const delayValues: BigNumber[] = [];
    CONFIG.FUNCTION_DELAYS.forEach((element) => {
      delayValues.push(functionDelay(element.toString()));
    });

    const thresholdValues: BigNumber[] = [];
    CONFIG.FUNCTION_THRESHOLDS.forEach((element) => {
      thresholdValues.push(functionThreshold(element.toString()));
    });

    const governorParameters = {
      votingDelay: CONFIG.VOTING_DELAY,
      governorName: CONFIG.GOVERNOR_NAME,
      votingPeriod: CONFIG.VOTING_PERIOD,
      quorumAbsolute: CONFIG.QUORUM_ABSOLUTE,
      proposalThreshold: CONFIG.PROPOSAL_THRESHOLD,
      defaultDelay: CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY - 1,
      shortDelay: CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY,
      longDelay: CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY,
      functionSignatures: functionSignatures,
      functionDelays: delayValues,
      functionThresholds: thresholdValues,
    };

    await expect(
      DivaGovernor.deploy(
        divaToken.address,
        timelock.address,
        governorParameters,
        { gasLimit: 12000000 }
      )
    ).to.be.revertedWithCustomError(DivaGovernor, "DaoInvalidDelaysSetup");

    const governorParameters2 = {
      votingDelay: CONFIG.VOTING_DELAY,
      governorName: CONFIG.GOVERNOR_NAME,
      votingPeriod: CONFIG.VOTING_PERIOD,
      quorumAbsolute: CONFIG.QUORUM_ABSOLUTE,
      proposalThreshold: CONFIG.PROPOSAL_THRESHOLD,
      defaultDelay: CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY,
      shortDelay: CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY,
      longDelay: CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY - 1,
      functionSignatures: functionSignatures,
      functionDelays: delayValues,
      functionThresholds: thresholdValues,
    };

    await expect(
      DivaGovernor.deploy(
        divaToken.address,
        timelock.address,
        governorParameters2,
        { gasLimit: 12000000 }
      )
    ).to.be.revertedWithCustomError(DivaGovernor, "DaoInvalidDelaysSetup");
  });

  test("02. Should fail with wrong length of function signatures setup", async function () {
    await deployments.fixture(["all"]);
    const divaToken = await ethers.getContract("DivaToken");
    const timelock = await ethers.getContract("DivaTimelockController");
    const DivaGovernor = await ethers.getContractFactory("DivaGovernor");

    const functionSignatures: string[] = [];
    CONFIG.FUNCTION_SIGNATURES.forEach((element) => {
      functionSignatures.push(functionHash(element));
    });

    const delayValues: BigNumber[] = [];
    CONFIG.FUNCTION_DELAYS.forEach((element) => {
      delayValues.push(functionDelay(element.toString()));
    });

    const thresholdValues: BigNumber[] = [];

    const governorParameters = {
      votingDelay: CONFIG.VOTING_DELAY,
      governorName: CONFIG.GOVERNOR_NAME,
      votingPeriod: CONFIG.VOTING_PERIOD,
      quorumAbsolute: CONFIG.QUORUM_ABSOLUTE,
      proposalThreshold: CONFIG.PROPOSAL_THRESHOLD,
      defaultDelay: CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY,
      shortDelay: CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY,
      longDelay: CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY,
      functionSignatures: functionSignatures,
      functionDelays: delayValues,
      functionThresholds: thresholdValues,
    };

    await expect(
      DivaGovernor.deploy(
        divaToken.address,
        timelock.address,
        governorParameters,
        { gasLimit: 12000000 }
      )
    ).to.be.revertedWithCustomError(
      DivaGovernor,
      "DaoInvalidThresholdTypeConfiguration"
    );
  });

  test("03. Should fail with wrong length of function signatures setup", async function () {
    await deployments.fixture(["all"]);
    const divaToken = await ethers.getContract("DivaToken");
    const timelock = await ethers.getContract("DivaTimelockController");
    const DivaGovernor = await ethers.getContractFactory("DivaGovernor");

    const functionSignatures: string[] = [];
    CONFIG.FUNCTION_SIGNATURES.forEach((element) => {
      functionSignatures.push(functionHash(element));
    });

    const delayValues: BigNumber[] = [];

    const thresholdValues: BigNumber[] = [];
    CONFIG.FUNCTION_THRESHOLDS.forEach((element) => {
      thresholdValues.push(functionThreshold(element.toString()));
    });

    const governorParameters = {
      votingDelay: CONFIG.VOTING_DELAY,
      governorName: CONFIG.GOVERNOR_NAME,
      votingPeriod: CONFIG.VOTING_PERIOD,
      quorumAbsolute: CONFIG.QUORUM_ABSOLUTE,
      proposalThreshold: CONFIG.PROPOSAL_THRESHOLD,
      defaultDelay: CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY,
      shortDelay: CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY,
      longDelay: CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY,
      functionSignatures: functionSignatures,
      functionDelays: delayValues,
      functionThresholds: thresholdValues,
    };

    await expect(
      DivaGovernor.deploy(
        divaToken.address,
        timelock.address,
        governorParameters,
        { gasLimit: 12000000 }
      )
    ).to.be.revertedWithCustomError(
      DivaGovernor,
      "DaoInvalidDelaysConfiguration"
    );
  });
});

describe("DivaGovernor added configurable delays", function () {
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

  test("01. Should propose, wait, vote, queue and execute proposal - configurable long delay ", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "updateLongDelay";
    const proposalValue = [CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY * 10];
    const proposalDescription = "Update short delay to 3610 ";

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

  test("02. Should propose, wait, vote, queue and execute proposal - configurable default delay ", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "updateDefaultDelay";
    const proposalValue = [CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY + 1];
    const proposalDescription = "Update short delayt to 3610 ";

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

  test("03. Should FAIL propose, wait, vote, queue and execute proposal - configurable delay ", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "updateDefaultDelay";
    const proposalValue = [CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY - 1];
    const proposalDescription = "Update short delayt to 3610 ";

    await expect(
      proposalVoteQueueAndExecute(
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
    ).to.be.reverted;
  });

  test("04. Should FAIL propose, wait, vote, queue and execute proposal - configurable delay ", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "updateDefaultDelay";
    const proposalValue = [CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY + 1];
    const proposalDescription = "Update short delayt to 3610 ";

    await expect(
      proposalVoteQueueAndExecute(
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
    ).to.be.reverted;
  });

  test("05. Should FAIL propose, wait, vote, queue and execute proposal - configurable delay ", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "updateShortDelay";
    const proposalValue = [CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY + 1];
    const proposalDescription = "Update short delayt to 3610 ";

    await expect(
      proposalVoteQueueAndExecute(
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
    ).to.be.reverted;
  });

  test("06. Should FAIL propose, wait, vote, queue and execute proposal - configurable delay ", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "updateLongDelay";
    const proposalValue = [CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY - 1];
    const proposalDescription = "Update short delayt to 3610 ";

    await expect(
      proposalVoteQueueAndExecute(
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
    ).to.be.reverted;
  });

  test("07. Should propose, wait, vote, queue and execute proposal - configurable short delay", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "updateShortDelay";
    const proposalValue = [CONFIG.MIN_DELAY];
    const proposalDescription = "Update short delayt to 3610 ";

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

  test("08. Should propose, wait, vote, queue and execute proposal - add delays configuration", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    const functionHashLong = governor.interface.getSighash(
      "setVotingDelay(uint256)"
    );
    const functionHashDefault = governor.interface.getSighash(
      "setVotingPeriod(uint256)"
    );
    const functionHashShort = governor.interface.getSighash(
      "setProposalThreshold(uint256)"
    );

    // 1. Propose
    const proposalFunction = "addDelayConfiguration";
    const proposalValue = [
      [ethers.utils.arrayify(functionHashLong)],
      [ethers.utils.arrayify(functionHashShort)],
      [ethers.utils.arrayify(functionHashDefault)],
    ];
    const proposalDescription = "test add delay configuration";

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

  test("09. Should revert calling setters without governance process", async function () {
    await expect(governor.addDelayConfiguration([], [], [])).to.be.revertedWith(
      "Governor: onlyGovernance"
    );

    await expect(governor.updateShortDelay(10)).to.be.revertedWith(
      "Governor: onlyGovernance"
    );

    await expect(governor.updateDefaultDelay(1000)).to.be.revertedWith(
      "Governor: onlyGovernance"
    );

    await expect(governor.updateLongDelay(1000)).to.be.revertedWith(
      "Governor: onlyGovernance"
    );

    await expect(
      governor.updateTimelock(ethers.constants.AddressZero)
    ).to.be.revertedWith("Governor: onlyGovernance");
  });

  test("10. Should revert propose, wait, vote, queue and execute proposal - add delays configuration - cancel", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    const functionHashLong = governor.interface.getSighash(
      "setProposalThreshold(uint256)"
    );
    const functionHashDefault = governor.interface.getSighash(
      "setVotingPeriod(uint256)"
    );
    const functionHashShort =
      divaTimelockController.interface.getSighash("cancel(bytes32)");

    // 1. Propose
    const proposalFunction = "addDelayConfiguration";
    const proposalValue = [
      [ethers.utils.arrayify(functionHashLong)],
      [ethers.utils.arrayify(functionHashShort)],
      [ethers.utils.arrayify(functionHashDefault)],
    ];
    const proposalDescription = "test add delay configuration";

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

    await expect(
      governor.execute(
        [governor.address],
        [0],
        [encodedFunctionCall],
        descriptionHash,
        { gasLimit: 500000 }
      )
    ).to.be.reverted;
  });

  test("11. Should revert propose, wait, vote, queue and execute proposal - add delays configuration - cancel", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    const functionHashLong =
      divaTimelockController.interface.getSighash("cancel(bytes32)");
    const functionHashDefault = governor.interface.getSighash(
      "setVotingPeriod(uint256)"
    );
    const functionHashShort = governor.interface.getSighash(
      "setProposalThreshold(uint256)"
    );

    // 1. Propose
    const proposalFunction = "addDelayConfiguration";
    const proposalValue = [
      [ethers.utils.arrayify(functionHashLong)],
      [ethers.utils.arrayify(functionHashShort)],
      [ethers.utils.arrayify(functionHashDefault)],
    ];
    const proposalDescription = "test add delay configuration";

    await expect(
      proposalVoteQueueAndExecute(
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
    ).to.be.reverted;
  });

  test("12. Should revert propose, wait, vote, queue and execute proposal - add delays configuration - cancel", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    const functionHashDefault =
      divaTimelockController.interface.getSighash("cancel(bytes32)");
    const functionHashLong = governor.interface.getSighash(
      "setVotingPeriod(uint256)"
    );
    const functionHashShort = governor.interface.getSighash(
      "setProposalThreshold(uint256)"
    );

    // 1. Propose
    const proposalFunction = "addDelayConfiguration";
    const proposalValue = [
      [ethers.utils.arrayify(functionHashLong)],
      [ethers.utils.arrayify(functionHashShort)],
      [ethers.utils.arrayify(functionHashDefault)],
    ];
    const proposalDescription = "test add delay configuration";

    await expect(
      proposalVoteQueueAndExecute(
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
    ).to.be.reverted;
  });

  test("13. Should revert propose, wait, vote, queue and execute proposal - msg.value -> long delay", async function () {
    // 0. Delegate
    await expect(
      divaToken.connect(recipient).delegate(deployer.address)
    ).to.emit(divaToken, "DelegateChanged");

    // 1. Propose
    const proposalFunction = "unpause"; // @dev default delay
    const proposalDescription = "Unpause DivaToken";

    await expect(
      proposalVoteAndQueue(
        governor,
        divaToken,
        deployer,
        [deployer],
        [1],
        CONFIG.VOTING_DELAY,
        CONFIG.VOTING_PERIOD,
        proposalFunction,
        proposalDescription,
        ethers.utils.parseEther("10") // delay will be long
      )
    ).not.to.be.reverted;

    const encodedFunctionCall =
      divaToken.interface.encodeFunctionData("unpause");

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposalDescription)
    );

    const proposalId = await governor.hashProposal(
      [divaToken.address],
      [ethers.utils.parseEther("10")],
      [encodedFunctionCall],
      descriptionHash
    );

    const proposalEta = await governor.proposalEta(proposalId);
    const currentTimestamp = (await ethers.provider.getBlock("latest"))
      .timestamp;
    const proposalDelay = proposalEta.sub(currentTimestamp);

    expect(proposalDelay).to.be.equal(
      CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY * 12
    );
  });

  test("14. Should get interface hash", async function () {
    expect(await governor.supportsInterface("0x01ffc9a7")).to.be.true;
    expect(await governor.supportsInterface("0x6e665ced")).to.be.true;
  });

  test("15. Should get interface hash", async function () {
    expect(await divaTimelockController.supportsInterface("0x01ffc9a7")).to.be
      .true;
  });
});
