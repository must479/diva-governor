import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { CONFIG } from "../deploy-configuration";

import {
  DivaTimelockController,
  DivaTimelockController__factory,
} from "../typechain-types";

const test = it;

describe("DivaTimeLockController tests", function () {
  let instance: DivaTimelockController;

  test("01. Checks timelock controller properties", async function () {
    await deployments.fixture(["DivaTimelockController"]);
    const deployment = await deployments.get("DivaTimelockController");

    instance = DivaTimelockController__factory.connect(
      deployment.address,
      ethers.provider
    );
    expect(await instance.getMinDelay()).to.be.equal(CONFIG.MIN_DELAY);
  });

  test("02. Should revert when trying to initialize from a non admin account", async function () {
    const [deployer, ...accounts] = await ethers.getSigners();
    const DivaTimelockController = await ethers.getContractFactory(
      "DivaTimelockController"
    );
    const divaTimelockController = await DivaTimelockController.deploy(
      CONFIG.MIN_DELAY
    );
    await divaTimelockController.deployed();

    const adminRole = await divaTimelockController.TIMELOCK_ADMIN_ROLE();

    const revertMessage =
      "AccessControl: account " +
      accounts[1].address.toLowerCase() +
      " is missing role " +
      adminRole;

    await expect(
      divaTimelockController
        .connect(accounts[1])
        .initialiseAndRevokeAdminRole(accounts[2].address)
    ).to.be.revertedWith(revertMessage);
  });

  test("03. Should only update ONCE with a governor different from ZERO ADDRESS ", async function () {
    const [...accounts] = await ethers.getSigners();
    const DivaTimelockController = await ethers.getContractFactory(
      "DivaTimelockController"
    );
    const divaTimelockController = await DivaTimelockController.deploy(
      CONFIG.MIN_DELAY
    );
    await divaTimelockController.deployed();

    await expect(
      divaTimelockController.initialiseAndRevokeAdminRole(
        ethers.constants.AddressZero
      )
    ).to.be.revertedWithCustomError(
      divaTimelockController,
      "FailToInitialiseTimelockController"
    );

    await expect(
      divaTimelockController.initialiseAndRevokeAdminRole(accounts[1].address)
    ).not.to.be.reverted;
  });
});
