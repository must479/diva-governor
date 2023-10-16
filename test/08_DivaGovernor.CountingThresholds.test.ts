import { expect } from "chai";
import { deployments, ethers, getNamedAccounts, network } from "hardhat";

import {
  DivaGovernor,
  DivaGovernor__factory,
  DivaToken,
  DivaToken__factory,
} from "../typechain-types";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { CONFIG } from "../deploy-configuration";

import { propose } from "../scripts/helpers";
import { BigNumber } from "ethers";

const test = it;

const helpers = require("@nomicfoundation/hardhat-network-helpers");

describe("DivaGovernor counting thresholds extension", function () {
  let governor: DivaGovernor;
  let divaToken: DivaToken;
  let accounts: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let recipient: SignerWithAddress;

  let encodedFunctionCall: any;
  let proposalId: any;
  let proposalTargetContract: any;

  let proposalFunction: string;
  let proposalValue: any;
  let proposalDescription: string;

  let accountsToDistribute: SignerWithAddress[];
  let amountToDistribute: BigNumber;
  let edgeVoter: SignerWithAddress;

  enum Vote {
    Against,
    For,
    Abstain,
  }

  enum ThresholdType {
    DEFAULT,
    MODERATE,
    LARGE,
  }

  before(
    "Add different function signature for each threshold configuration",
    async () => {
      await network.provider.send("hardhat_reset", []);
      [deployer, recipient, ...accounts] = await ethers.getSigners();

      await deployments.fixture(["all"]);
      const governorDeployment = await deployments.get("DivaGovernor");
      governor = DivaGovernor__factory.connect(
        governorDeployment.address,
        deployer
      );

      const divaTokenDeployment = await deployments.get("DivaToken");

      divaToken = DivaToken__factory.connect(
        divaTokenDeployment.address,
        recipient
      );

      const divaTimelockController = await deployments.get(
        "DivaTimelockController"
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

      expect(await governor.COUNTING_MODE()).to.equal(
        "support=bravo&quorum=for,abstain"
      );

      // 0. Delegate
      await expect(
        divaToken.connect(recipient).delegate(recipient.address)
      ).to.emit(divaToken, "DelegateChanged");

      const functionHashLong = governor.interface.getSighash(
        "updateLongDelay(uint256)"
      );

      const functionHashDefault = governor.interface.getSighash(
        "updateDefaultDelay(uint256)"
      );

      const functionHashShort = governor.interface.getSighash(
        "updateShortDelay(uint256)"
      );

      // 1. Propose
      const proposalFunction = "addThresholdConfiguration";
      const proposalValue = [
        [ethers.utils.arrayify(functionHashLong)],
        [ethers.utils.arrayify(functionHashDefault)],
        [ethers.utils.arrayify(functionHashShort)],
      ];
      const proposalDescription = "test add thresholds configuration";

      const [encodedFunctionCall, proposalId, proposalTargetContract] =
        await propose(
          proposalFunction,
          proposalValue,
          proposalDescription,
          governor,
          governor,
          recipient
        );

      // 2.a Vote
      await expect(
        governor
          .connect(recipient)
          .castVote(proposalId, 1, { gasLimit: 500000 })
      ).to.be.revertedWith("Governor: vote not currently active");

      // 2b. Vote to active proposal
      await helpers.mine(CONFIG.VOTING_DELAY);

      await expect(
        governor
          .connect(recipient)
          .castVote(proposalId, 1, { gasLimit: 500000 })
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

      const proposalEta = await governor.proposalEta(proposalId);
      const currentTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;

      await helpers.mine(proposalEta.sub(currentTimestamp).toNumber() + 1);

      await expect(
        governor
          .connect(deployer)
          .execute(
            [proposalTargetContract],
            [0],
            [encodedFunctionCall],
            descriptionHash,
            { gasLimit: 500000 }
          )
      ).not.to.be.reverted;

      // Distribute tokens to several accounts and delegate
      accountsToDistribute = accounts.slice(0, 5);
      edgeVoter = accounts[5];
      amountToDistribute = ethers.utils.parseEther("100000000");

      await expect(
        divaToken.connect(recipient).delegate(recipient.address)
      ).to.emit(divaToken, "DelegateChanged");

      for (let index = 0; index < accountsToDistribute.length; index++) {
        const account = accountsToDistribute[index];
        await divaToken
          .connect(recipient)
          .transfer(account.address, amountToDistribute);

        await expect(
          divaToken.connect(account).delegate(account.address)
        ).to.emit(divaToken, "DelegateChanged");
      }

      await divaToken
        .connect(recipient)
        .transfer(edgeVoter.address, ethers.utils.parseEther("1"));

      await expect(
        divaToken.connect(edgeVoter).delegate(edgeVoter.address)
      ).to.emit(divaToken, "DelegateChanged");
    }
  );

  test("01. Should propose, wait, vote, queue and execute proposal - DEFAULT threshold", async function () {
    // 1. Propose
    proposalFunction = "updateShortDelay";
    proposalValue = [50];
    proposalDescription = "Update short delay to 50 ";

    [encodedFunctionCall, proposalId, proposalTargetContract] = await propose(
      proposalFunction,
      proposalValue,
      proposalDescription,
      governor,
      governor,
      recipient
    );

    expect(await governor.getSuccessThreshold(proposalId)).to.equal(
      ThresholdType.DEFAULT
    );

    await expect(
      governor
        .connect(recipient)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).to.be.revertedWith("Governor: vote not currently active");

    // 2b. Vote to active proposal
    await helpers.mine(CONFIG.VOTING_DELAY);

    // default threshold is 50% + 1 vote
    await expect(
      governor
        .connect(accounts[0])
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    await expect(
      governor
        .connect(accounts[1])
        .castVote(proposalId, ethers.BigNumber.from(Vote.Against.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    expect(await governor.voteSucceeded(proposalId)).to.be.false;

    await expect(
      governor
        .connect(edgeVoter)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    expect(await governor.voteSucceeded(proposalId)).to.be.true;

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

    // 4. Wait timelock cooldown
    const proposalEta = await governor.proposalEta(proposalId);
    const currentTimestamp = (await ethers.provider.getBlock("latest"))
      .timestamp;

    await helpers.mine(proposalEta.sub(currentTimestamp).toNumber() + 1);

    // 5. Execute
    await expect(
      governor
        .connect(deployer)
        .execute(
          [proposalTargetContract],
          [0],
          [encodedFunctionCall],
          descriptionHash,
          { gasLimit: 500000 }
        )
    ).not.to.be.reverted;
  });

  test("02. Should propose, wait, vote, queue and execute proposal - LARGE threshold", async function () {
    // 1. Propose
    proposalFunction = "updateLongDelay";
    proposalValue = [CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY * 3];
    proposalDescription = "Update short delayt to 50 ";

    [encodedFunctionCall, proposalId, proposalTargetContract] = await propose(
      proposalFunction,
      proposalValue,
      proposalDescription,
      governor,
      governor,
      recipient
    );

    expect(await governor.getSuccessThreshold(proposalId)).to.equal(
      ThresholdType.LARGE
    );

    await expect(
      governor
        .connect(recipient)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).to.be.revertedWith("Governor: vote not currently active");

    // 2b. Vote to active proposal
    await helpers.mine(CONFIG.VOTING_DELAY);

    // LARGE threshold is 75% + 1 vote
    await expect(
      governor
        .connect(accounts[0])
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    await expect(
      governor
        .connect(accounts[1])
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    await expect(
      governor
        .connect(accounts[2])
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    await expect(
      governor
        .connect(accounts[3])
        .castVote(proposalId, ethers.BigNumber.from(Vote.Against.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    expect(await governor.voteSucceeded(proposalId)).to.be.false;
    // @dev abstain votes does not count for success only for quorum
    await expect(
      governor
        .connect(accounts[4])
        .castVote(proposalId, ethers.BigNumber.from(Vote.Abstain.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    expect(await governor.voteSucceeded(proposalId)).to.be.false;

    await expect(
      governor
        .connect(edgeVoter)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    // @dev cannot vote twice
    await expect(
      governor
        .connect(edgeVoter)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).to.be.revertedWith("GovernorVotingSimple: vote already cast");

    expect(await governor.voteSucceeded(proposalId)).to.be.true;

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

    // 4. Wait timelock cooldown
    const proposalEta = await governor.proposalEta(proposalId);
    const currentTimestamp = (await ethers.provider.getBlock("latest"))
      .timestamp;

    await helpers.mine(proposalEta.sub(currentTimestamp).toNumber() + 1);

    // 5. Execute
    await expect(
      governor
        .connect(deployer)
        .execute(
          [proposalTargetContract],
          [0],
          [encodedFunctionCall],
          descriptionHash,
          { gasLimit: 500000 }
        )
    ).not.to.be.reverted;
  });

  test("03. Should propose, wait, vote, queue and execute proposal - MODERATE threshold", async function () {
    // 1. Propose
    proposalFunction = "updateDefaultDelay";
    proposalValue = [CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY + 2];
    proposalDescription = "Update short delayt to 50 ";

    [encodedFunctionCall, proposalId, proposalTargetContract] = await propose(
      proposalFunction,
      proposalValue,
      proposalDescription,
      governor,
      governor,
      recipient
    );

    expect(await governor.getSuccessThreshold(proposalId)).to.equal(
      ThresholdType.MODERATE
    );

    await expect(
      governor
        .connect(recipient)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).to.be.revertedWith("Governor: vote not currently active");

    // 2b. Vote to active proposal
    await helpers.mine(CONFIG.VOTING_DELAY);

    // LARGE threshold is 75% + 1 vote
    await expect(
      governor
        .connect(accounts[0])
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    await expect(
      governor
        .connect(accounts[1])
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    await expect(
      governor
        .connect(accounts[2])
        .castVote(proposalId, ethers.BigNumber.from(Vote.Against.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    expect(await governor.voteSucceeded(proposalId)).to.be.false;
    // @dev abstain votes does not count for success only for quorum
    await expect(
      governor
        .connect(accounts[3])
        .castVote(proposalId, ethers.BigNumber.from(Vote.Abstain.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    expect(await governor.voteSucceeded(proposalId)).to.be.false;

    await expect(
      governor
        .connect(edgeVoter)
        .castVote(proposalId, ethers.BigNumber.from("4"), {
          gasLimit: 500000,
        })
    ).to.be.revertedWith(
      "GovernorVotingSimple: invalid value for enum VoteType"
    );

    await expect(
      governor
        .connect(edgeVoter)
        .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
          gasLimit: 500000,
        })
    ).not.to.be.reverted;

    expect(await governor.voteSucceeded(proposalId)).to.be.true;

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

    await expect(
      governor
        .connect(deployer)
        .execute(
          [proposalTargetContract],
          [0],
          [encodedFunctionCall],
          descriptionHash,
          { gasLimit: 500000 }
        )
    ).to.be.revertedWith("TimelockController: operation is not ready");

    // 4. Wait timelock cooldown
    const proposalEta = await governor.proposalEta(proposalId);
    const currentTimestamp = (await ethers.provider.getBlock("latest"))
      .timestamp;

    await helpers.mine(proposalEta.sub(currentTimestamp).toNumber() + 1);

    // 5. Execute
    await expect(
      governor
        .connect(deployer)
        .execute(
          [proposalTargetContract],
          [0],
          [encodedFunctionCall],
          descriptionHash,
          { gasLimit: 500000 }
        )
    ).not.to.be.reverted;
  });
});

describe("Governor - Proposal Thresholds", function () {
  let governor: DivaGovernor;
  let divaToken: DivaToken;
  let accounts: SignerWithAddress[];
  let deployer: SignerWithAddress;
  let recipient: SignerWithAddress;

  let encodedFunctionCall: any;
  let proposalId: any;
  let proposalTargetContract: any;

  let proposalFunction: string;
  let proposalValue: any;
  let proposalDescription: string;

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

  enum Vote {
    Against,
    For,
    Abstain,
  }

  enum ThresholdType {
    DEFAULT,
    MODERATE,
    LARGE,
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

    const divaTokenDeployment = await deployments.get("DivaToken");

    divaToken = DivaToken__factory.connect(
      divaTokenDeployment.address,
      recipient
    );

    const divaTimelockController = await deployments.get(
      "DivaTimelockController"
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

    {
      // 0. Delegate
      await expect(
        divaToken.connect(recipient).delegate(recipient.address)
      ).to.emit(divaToken, "DelegateChanged");

      const functionHashLong = governor.interface.getSighash(
        "updateLongDelay(uint256)"
      );

      const functionHashDefault = governor.interface.getSighash(
        "updateDefaultDelay(uint256)"
      );

      const functionHashShort = governor.interface.getSighash(
        "updateShortDelay(uint256)"
      );

      // 1. Propose
      const proposalFunction = "addThresholdConfiguration";
      const proposalValue = [
        [ethers.utils.arrayify(functionHashLong)],
        [ethers.utils.arrayify(functionHashDefault)],
        [ethers.utils.arrayify(functionHashShort)],
      ];
      const proposalDescription = "test add thresholds configuration";

      const [encodedFunctionCall, proposalId, proposalTargetContract] =
        await propose(
          proposalFunction,
          proposalValue,
          proposalDescription,
          governor,
          governor,
          recipient
        );

      // 2.a Vote
      await expect(
        governor
          .connect(recipient)
          .castVote(proposalId, 1, { gasLimit: 500000 })
      ).to.be.revertedWith("Governor: vote not currently active");

      // 2b. Vote to active proposal
      await helpers.mine(CONFIG.VOTING_DELAY);

      await expect(
        governor
          .connect(recipient)
          .castVote(proposalId, 1, { gasLimit: 500000 })
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

      const proposalEta = await governor.proposalEta(proposalId);
      const currentTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;

      await helpers.mine(proposalEta.sub(currentTimestamp).toNumber() + 1);
      // 4. Execute
      await expect(
        governor
          .connect(deployer)
          .execute(
            [proposalTargetContract],
            [0],
            [encodedFunctionCall],
            descriptionHash,
            { gasLimit: 500000 }
          )
      ).not.to.be.reverted;
    }
  });

  describe("Proposal Thresholds set properly", function () {
    it("01. Should set DEFAULT thresholds if signature is not in the list", async function () {
      const proposalFunction = "balanceOf(address)";
      const proposalValue = [deployer.address];
      const proposalDescription = "Dummy method to check that DEFAULT is set";

      const [encodedFunctionCall, proposalId, proposalTargetContract] =
        await propose(
          proposalFunction,
          proposalValue,
          proposalDescription,
          governor,
          divaToken,
          recipient
        );
      expect(await governor.getSuccessThreshold(proposalId)).to.equal(
        ThresholdType.DEFAULT
      );
    });

    it("02. Should set LARGE thresholds if signature is set to have it so", async function () {
      const proposalFunction = "updateLongDelay(uint256)";
      const proposalValue = [6];
      const proposalDescription = "Increase updateLongDelay";

      const [encodedFunctionCall, proposalId, proposalTargetContract] =
        await propose(
          proposalFunction,
          proposalValue,
          proposalDescription,
          governor,
          governor,
          recipient
        );
      expect(await governor.getSuccessThreshold(proposalId)).to.equal(
        ThresholdType.LARGE
      );
    });

    it("03. Should set MODERATE thresholds if signature is set to have it so", async function () {
      const proposalFunction = "updateDefaultDelay(uint256)";
      const proposalValue = [6];
      const proposalDescription = "Increase updateDefaultDelay";

      const [encodedFunctionCall, proposalId, proposalTargetContract] =
        await propose(
          proposalFunction,
          proposalValue,
          proposalDescription,
          governor,
          governor,
          recipient
        );
      expect(await governor.getSuccessThreshold(proposalId)).to.equal(
        ThresholdType.MODERATE
      );
    });

    it("04. Should set DEFAULT thresholds if signature is set to have it so", async function () {
      const proposalFunction = "updateShortDelay(uint256)";
      const proposalValue = [6];
      const proposalDescription = "Increase updateShortDelay";

      const [encodedFunctionCall, proposalId, proposalTargetContract] =
        await propose(
          proposalFunction,
          proposalValue,
          proposalDescription,
          governor,
          governor,
          recipient
        );
      expect(await governor.getSuccessThreshold(proposalId)).to.equal(
        ThresholdType.DEFAULT
      );
    });

    it("05. Should to access addThresholdConfiguration without governance process", async function () {
      await expect(
        governor
          .connect(deployer)
          .addThresholdConfiguration([], [], [], { gasLimit: 500000 })
      ).to.be.revertedWith("Governor: onlyGovernance");
    });
  });

  describe("Proposal Thresholds DEFAULT - check votes computation", function () {
    let accountsToDistribute: SignerWithAddress[];
    let amountToDistribute: any;

    beforeEach(
      "DEFAULT Threshold >50% of votes for + quorum reached",
      async function () {
        // 0. Distribute tokens to several accounts and delegate
        [deployer, recipient, ...accounts] = await ethers.getSigners();

        accountsToDistribute = accounts.slice(0, 5);
        amountToDistribute = ethers.utils.parseEther("200000000");

        for (let index = 0; index < accountsToDistribute.length; index++) {
          const account = accountsToDistribute[index];
          if (index === 4) {
            await divaToken
              .connect(recipient)
              .transfer(
                accounts[4].address,
                ethers.utils.parseUnits("1", "wei")
              );
          } else {
            await divaToken
              .connect(recipient)
              .transfer(account.address, amountToDistribute);
          }
          await expect(
            divaToken.connect(account).delegate(account.address)
          ).to.emit(divaToken, "DelegateChanged");
        }

        // recipient vote will decide the outcome of the proposal
        await expect(
          divaToken.connect(recipient).delegate(recipient.address)
        ).to.emit(divaToken, "DelegateChanged");

        const proposalFunction = "balanceOf(address)";
        const proposalValue = [deployer.address];
        const proposalDescription = "Dummy method to check that DEFAULT is set";
        [encodedFunctionCall, proposalId, proposalTargetContract] =
          await propose(
            proposalFunction,
            proposalValue,
            proposalDescription,
            governor,
            divaToken,
            accountsToDistribute[0]
          );
        expect(await governor.getSuccessThreshold(proposalId)).to.equal(
          ThresholdType.DEFAULT
        );
      }
    );

    it("01. Should pass if >50% of votes for + quorum reached", async function () {
      await helpers.mine(CONFIG.VOTING_DELAY);

      expect(await governor.voteSucceeded(proposalId)).to.be.false;

      await expect(
        governor
          .connect(accountsToDistribute[0])
          .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
            gasLimit: 500000,
          })
      ).not.to.be.reverted;
      expect(await governor.voteSucceeded(proposalId)).to.be.true;

      await expect(
        governor
          .connect(accountsToDistribute[1])
          .castVote(
            proposalId,
            ethers.BigNumber.from(Vote.Against.toString()),
            {
              gasLimit: 500000,
            }
          )
      ).not.to.be.reverted;
      expect(await governor.voteSucceeded(proposalId)).to.be.false;

      await expect(
        governor
          .connect(recipient)
          .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
            gasLimit: 500000,
          })
      ).not.to.be.reverted;
      expect(await governor.voteSucceeded(proposalId)).to.be.true;
    });
  });

  describe("Proposal Thresholds LARGE - check votes computation", function () {
    let accountsToDistribute: SignerWithAddress[];
    let amountToDistribute: any;

    beforeEach(
      "LARGE Threshold >75% of votes for + quorum reached",
      async function () {
        // 0. Distribute tokens to several accounts and delegate
        [deployer, recipient, ...accounts] = await ethers.getSigners();

        accountsToDistribute = accounts.slice(0, 5);
        amountToDistribute = ethers.utils.parseEther("200000000");

        for (let index = 0; index < accountsToDistribute.length; index++) {
          const account = accountsToDistribute[index];
          if (index === 4) {
            await divaToken
              .connect(recipient)
              .transfer(
                accounts[4].address,
                ethers.utils.parseUnits("1", "wei")
              );
          } else {
            await divaToken
              .connect(recipient)
              .transfer(account.address, amountToDistribute);
          }
          await expect(
            divaToken.connect(account).delegate(account.address)
          ).to.emit(divaToken, "DelegateChanged");
        }

        // await divaToken.connect(accounts[4]).transfer(recipient.address, 1);
        await expect(
          divaToken.connect(recipient).delegate(recipient.address)
        ).to.emit(divaToken, "DelegateChanged");

        const proposalFunction = "updateLongDelay";
        const proposalValue = [6];
        const proposalDescription = "Increase updateLongDelay";
        [encodedFunctionCall, proposalId, proposalTargetContract] =
          await propose(
            proposalFunction,
            proposalValue,
            proposalDescription,
            governor,
            governor,
            accountsToDistribute[0]
          );
        expect(await governor.getSuccessThreshold(proposalId)).to.equal(
          ThresholdType.LARGE
        );
      }
    );

    it("01. Should pass if >75% of votes for + quorum reached", async function () {
      await helpers.mine(CONFIG.VOTING_DELAY);

      await expect(
        governor
          .connect(accountsToDistribute[0])
          .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
            gasLimit: 500000,
          })
      ).not.to.be.reverted;

      await expect(
        governor
          .connect(accountsToDistribute[1])
          .castVote(
            proposalId,
            ethers.BigNumber.from(Vote.Against.toString()),
            {
              gasLimit: 500000,
            }
          )
      ).not.to.be.reverted;

      await expect(
        governor
          .connect(accountsToDistribute[2])
          .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
            gasLimit: 500000,
          })
      ).not.to.be.reverted;

      expect(await governor.voteSucceeded(proposalId)).to.be.false; // @dev 2 / 3 so far

      await expect(
        governor
          .connect(accountsToDistribute[3])
          .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
            gasLimit: 500000,
          })
      ).not.to.be.reverted;

      expect(await governor.voteSucceeded(proposalId)).to.be.false; // @dev 3 / 4 so far, it is still needed 1 more vote

      await expect(
        governor
          .connect(recipient)
          .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
            gasLimit: 500000,
          })
      ).not.to.be.reverted;

      expect(await governor.voteSucceeded(proposalId)).to.be.true; // @dev 3 / 4 so far, it is still needed 1 more vote
    });
  });

  describe("Proposal Thresholds MODERATE - check votes computation", function () {
    let accountsToDistribute: SignerWithAddress[];
    let amountToDistribute: any;

    beforeEach(
      "MODERATE Threshold >66% of votes for + quorum reached",
      async function () {
        // 0. Distribute tokens to several accounts and delegate
        [deployer, recipient, ...accounts] = await ethers.getSigners();

        accountsToDistribute = accounts.slice(0, 5);
        amountToDistribute = ethers.utils.parseEther("200000000");

        for (let index = 0; index < accountsToDistribute.length; index++) {
          const account = accountsToDistribute[index];
          if (index === 4) {
            await divaToken
              .connect(recipient)
              .transfer(
                accounts[4].address,
                ethers.utils.parseUnits("1", "wei")
              );
          } else {
            await divaToken
              .connect(recipient)
              .transfer(account.address, amountToDistribute);
          }
          await expect(
            divaToken.connect(account).delegate(account.address)
          ).to.emit(divaToken, "DelegateChanged");
        }

        await expect(
          divaToken.connect(recipient).delegate(recipient.address)
        ).to.emit(divaToken, "DelegateChanged");

        const proposalFunction = "updateDefaultDelay";
        const proposalValue = [6];
        const proposalDescription = "Increase updateDefaultDelay";
        [encodedFunctionCall, proposalId, proposalTargetContract] =
          await propose(
            proposalFunction,
            proposalValue,
            proposalDescription,
            governor,
            governor,
            accountsToDistribute[0]
          );
        expect(await governor.getSuccessThreshold(proposalId)).to.equal(
          ThresholdType.MODERATE
        );
      }
    );

    it("01. Should pass if >66% of votes for + quorum reached", async function () {
      await helpers.mine(CONFIG.VOTING_DELAY);

      await expect(
        governor
          .connect(accountsToDistribute[0])
          .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
            gasLimit: 500000,
          })
      ).not.to.be.reverted;

      await expect(
        governor
          .connect(accountsToDistribute[1])
          .castVote(
            proposalId,
            ethers.BigNumber.from(Vote.Against.toString()),
            {
              gasLimit: 500000,
            }
          )
      ).not.to.be.reverted;

      await expect(
        governor
          .connect(accountsToDistribute[2])
          .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
            gasLimit: 500000,
          })
      ).not.to.be.reverted;

      expect(await governor.voteSucceeded(proposalId)).to.be.false; // @dev 2 / 3 so far

      await expect(
        governor
          .connect(recipient)
          .castVote(proposalId, ethers.BigNumber.from(Vote.For.toString()), {
            gasLimit: 500000,
          })
      ).not.to.be.reverted;

      expect(await governor.voteSucceeded(proposalId)).to.be.true; // @dev 3 / 4 so far, it is still needed 1 more vote
    });
  });
});
