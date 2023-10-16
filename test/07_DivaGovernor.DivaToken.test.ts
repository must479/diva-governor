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
import { proposalVoteQueueAndExecute } from "../scripts/helpers";

const test = it;

describe("DivaToken - governance - pausability feature", function () {
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
        amount: ethers.utils.parseEther("0"),
      },
    ];

    const airdrop = {
      to: recipient.address,
      amount: CONFIG.INITIAL_SUPPLY,
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

  test("01 Should fail to resume diva token transferability if transaction is not trigger by governance proposal", async function () {
    await expect(
      divaToken.connect(accounts[1]).unpause({ gasLimit: 300000 })
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  test("02. Should resume diva token by governance", async function () {
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

    // transfer diva token
    await expect(
      divaToken.connect(recipient).transfer(accounts[1].address, 1000)
    ).to.emit(divaToken, "Transfer");

    // transfer from accounts[1] to accounts[2]
    await expect(
      divaToken.connect(accounts[1]).transfer(accounts[2].address, 1000)
    ).to.emit(divaToken, "Transfer");
  });
});
