import { expect } from "chai";
import { deployments, ethers, network } from "hardhat";

import { Contract } from "ethers";

import {
  DivaToken,
  DivaToken__factory,
  MerkleDistributorWithDelegation,
  MerkleDistributorWithDelegation__factory,
} from "../typechain-types";

import { CONFIG } from "../deploy-configuration";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const test = it;

describe("DivaToken - ERC20", function () {
  let divaInstance: DivaToken;
  let airdropInstance: MerkleDistributorWithDelegation;
  let deployer: SignerWithAddress;
  let recipientAccount: SignerWithAddress;
  let regularAccount1: SignerWithAddress;
  let regularAccount2: SignerWithAddress;
  let accounts: SignerWithAddress[];

  before("DivaToken features", async function () {
    await network.provider.send("hardhat_reset", []);

    await deployments.fixture([
      "DivaToken",
      "MerkleDistributorWithDelegation",
      "DivaTimelockController",
    ]);
    const divaTokenDeployment = await deployments.get("DivaToken");

    [
      deployer,
      recipientAccount,
      regularAccount1,
      regularAccount2,
      ...accounts
    ] = await ethers.getSigners();

    divaInstance = DivaToken__factory.connect(
      divaTokenDeployment.address,
      ethers.provider
    );

    const distributorDeployment = await deployments.get(
      "MerkleDistributorWithDelegation"
    );

    const divaTimelockController = await deployments.get(
      "DivaTimelockController"
    );

    airdropInstance = MerkleDistributorWithDelegation__factory.connect(
      distributorDeployment.address,
      ethers.provider
    );

    // send all divatoken to recipient account
    const distro = [
      {
        to: recipientAccount.address,
        amount: ethers.utils.parseEther("0"),
      },
    ];

    // using airdrop variable as a way to whitelist address for transfers
    const whitelisted = {
      to: recipientAccount.address,
      amount: CONFIG.INITIAL_SUPPLY,
    };

    // distribute diva tokens and transfer ownership to timelock controller
    await divaInstance
      .connect(deployer)
      .distributeAndTransferOwnership(
        distro,
        whitelisted,
        divaTimelockController.address,
        {
          gasLimit: 1500000,
        }
      );
  });

  test("01. Should check custom properties", async function () {
    expect(await divaInstance.name()).to.equal(CONFIG.DIVA_TOKEN_NAME);
    expect(await divaInstance.symbol()).to.equal(CONFIG.DIVA_TOKEN_SYMBOL);
    expect(await divaInstance.totalSupply()).to.equal(CONFIG.INITIAL_SUPPLY);
  });

  test("02. Should allow transfers from recipient account", async function () {
    await expect(
      divaInstance
        .connect(recipientAccount)
        .transfer(regularAccount1.address, ethers.utils.parseEther("100"))
    ).to.emit(divaInstance, "Transfer");

    await expect(
      divaInstance
        .connect(recipientAccount)
        .transfer(regularAccount2.address, ethers.utils.parseEther("100"))
    ).to.emit(divaInstance, "Transfer");
  });

  test("03. Should not allow transfers from/to regular accounts", async function () {
    expect(await divaInstance.balanceOf(regularAccount1.address)).to.equal(
      ethers.utils.parseEther("100")
    );

    await expect(
      divaInstance
        .connect(regularAccount1)
        .transfer(regularAccount2.address, ethers.utils.parseEther("50"))
    ).to.be.revertedWithCustomError(divaInstance, "ProtocolPaused");
    // .withArgs(
    //   regularAccount1.address,
    //   regularAccount2.address,
    //   ethers.utils.parseEther("50")
    // );

    expect(await divaInstance.balanceOf(regularAccount1.address)).to.equal(
      ethers.utils.parseEther("100")
    );

    await expect(
      divaInstance
        .connect(regularAccount2)
        .transfer(regularAccount1.address, ethers.utils.parseEther("50"))
    ).to.be.revertedWithCustomError(divaInstance, "ProtocolPaused");
    // .withArgs(
    //   regularAccount2.address,
    //   regularAccount1.address,
    //   ethers.utils.parseEther("50")
    // );
  });

  test("04. Should when a regular accounts uses delegateFromMerkleDistributor", async function () {
    await expect(
      divaInstance
        .connect(regularAccount1)
        .delegateFromMerkleDistributor(regularAccount1.address, {
          gasLimit: 1500000,
        })
    ).to.be.revertedWithCustomError(
      divaInstance,
      "OnlyMerkleDistributorCanCallThisMethod"
    );
  });
});

describe("DivaToken - Foundation minting", function () {
  let divaInstance: DivaToken;
  let airdropInstance: MerkleDistributorWithDelegation;
  let deployer: SignerWithAddress;
  let recipientAccount: SignerWithAddress;
  let regularAccount1: SignerWithAddress;
  let regularAccount2: SignerWithAddress;
  let accounts: SignerWithAddress[];

  beforeEach("DivaToken foundation tokens", async function () {
    await network.provider.send("hardhat_reset", []);

    await deployments.fixture([
      "DivaToken",
      "MerkleDistributorWithDelegation",
      "DivaTimelockController",
    ]);
    const divaTokenDeployment = await deployments.get("DivaToken");

    [
      deployer,
      recipientAccount,
      regularAccount1,
      regularAccount2,
      ...accounts
    ] = await ethers.getSigners();

    divaInstance = DivaToken__factory.connect(
      divaTokenDeployment.address,
      ethers.provider
    );

    const distributorDeployment = await deployments.get(
      "MerkleDistributorWithDelegation"
    );

    const divaTimelockController = await deployments.get(
      "DivaTimelockController"
    );

    airdropInstance = MerkleDistributorWithDelegation__factory.connect(
      distributorDeployment.address,
      ethers.provider
    );

    // send all divatoken to recipient account
    const distro = [
      {
        to: recipientAccount.address,
        amount: ethers.utils.parseEther("0"),
      },
    ];

    // using airdrop variable as a way to whitelist address for transfers
    const whitelisted = {
      to: recipientAccount.address,
      amount: CONFIG.INITIAL_SUPPLY,
    };

    // distribute diva tokens and transfer ownership to timelock controller
    await divaInstance
      .connect(deployer)
      .distributeAndTransferOwnership(
        distro,
        whitelisted,
        divaTimelockController.address,
        {
          gasLimit: 1500000,
        }
      );
  });

  test("01. Should allow deployer to mint for the foundation", async function () {
    await expect(
      divaInstance
        .connect(deployer)
        .mintFoundationDistribution(
          "0x4444444449444444444944444444494444444449",
          {
            gasLimit: 1500000,
          }
        )
    ).not.to.be.reverted;

    expect(await divaInstance.totalSupply()).to.equal(CONFIG.TOTAL_SUPPLY);
  });

  test("02. Should FAIL if deployer tries to mint it twice", async function () {
    await expect(
      divaInstance
        .connect(deployer)
        .mintFoundationDistribution(
          "0x4444444449444444444944444444494444444449",
          {
            gasLimit: 1500000,
          }
        )
    ).not.to.be.reverted;

    expect(await divaInstance.totalSupply()).to.equal(CONFIG.TOTAL_SUPPLY);

    await expect(
      divaInstance
        .connect(deployer)
        .mintFoundationDistribution(
          "0x4444444449444444444944444444494444444449",
          {
            gasLimit: 1500000,
          }
        )
    ).to.be.revertedWithCustomError(divaInstance, "InvalidTotalSupply");

    expect(await divaInstance.totalSupply()).to.equal(CONFIG.TOTAL_SUPPLY);
  });

  test("03. Should FAIL if someone else tries to mint foundation tokens", async function () {
    await expect(
      divaInstance
        .connect(regularAccount1)
        .mintFoundationDistribution(
          "0x4444444449444444444944444444494444444449",
          {
            gasLimit: 1500000,
          }
        )
    ).to.be.revertedWithCustomError(
      divaInstance,
      "OnlyFoundationMinterCanCallThis"
    );

    expect(await divaInstance.totalSupply()).to.equal(CONFIG.INITIAL_SUPPLY);
  });
});

describe("DivaToken - ERC20: pausability", function () {
  let testDivaToken: Contract;
  let deployer: SignerWithAddress;
  let recipientAccount: SignerWithAddress;
  let accounts: SignerWithAddress[];

  beforeEach(async function () {
    [deployer, recipientAccount, ...accounts] = await ethers.getSigners();

    const TestDivaToken = await ethers.getContractFactory("DivaToken");
    testDivaToken = await TestDivaToken.deploy("Diva Token", "DIVA");

    await testDivaToken.deployed();

    // send all divatoken to recipient account
    const distro = [
      {
        to: recipientAccount.address,
        amount: ethers.utils.parseEther("0"),
      },
    ];

    // using airdrop variable as a way to whitelist address for transfers
    const whitelisted = {
      to: recipientAccount.address,
      amount: CONFIG.INITIAL_SUPPLY,
    };

    // distribute diva tokens and transfer ownership to timelock controller
    await testDivaToken
      .connect(deployer)
      .distributeAndTransferOwnership(distro, whitelisted, deployer.address, {
        gasLimit: 1500000,
      });
  });

  test("01. Should not allow to mint a different total supply", async function () {
    const distro = [
      {
        to: recipientAccount.address,
        amount: CONFIG.INITIAL_SUPPLY,
      },
    ];

    const airdrop = {
      to: recipientAccount.address,
      amount: ethers.utils.parseEther("0"),
    };

    await expect(
      testDivaToken
        .connect(deployer)
        .distributeAndTransferOwnership(distro, airdrop, accounts[0].address, {
          gasLimit: 1500000,
        })
    ).to.be.revertedWithCustomError(testDivaToken, "InvalidTotalSupply");
    // .withArgs(ethers.utils.parseEther("2000000000"), CONFIG.TOTAL_SUPPLY);
  });

  test("02. Should not allow to mint to anyone who does not own this contract", async function () {
    const distro = [
      {
        to: recipientAccount.address,
        amount: CONFIG.INITIAL_SUPPLY,
      },
    ];

    const airdrop = {
      to: recipientAccount.address,
      amount: ethers.utils.parseEther("0"),
    };

    await expect(
      testDivaToken
        .connect(accounts[0])
        .distributeAndTransferOwnership(distro, airdrop, accounts[0].address, {
          gasLimit: 1500000,
        })
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  test("03. Should unpause token transferability", async function () {
    await expect(
      testDivaToken.connect(accounts[0]).unpause({ gasLimit: 1500000 })
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
      testDivaToken.connect(deployer).unpause({ gasLimit: 1500000 })
    ).to.be.revertedWithCustomError(
      testDivaToken,
      "TransferabilityCannotBeEnabled"
    );

    const TEN_WEEKS_SECONDS = 604800 * 10;
    const oneSecondAfterEndTime =
      (await ethers.provider.getBlock("latest")).timestamp +
      TEN_WEEKS_SECONDS +
      1;
    await ethers.provider.send("evm_mine", [oneSecondAfterEndTime]);

    await expect(testDivaToken.connect(deployer).unpause({ gasLimit: 1500000 }))
      .not.to.be.reverted;
  });
});

describe("DivaToken - ERC20: mock burn function", function () {
  let testDivaToken: Contract;
  let deployer: SignerWithAddress;
  let recipientAccount: SignerWithAddress;
  let accounts: SignerWithAddress[];

  beforeEach(async function () {
    [deployer, recipientAccount, ...accounts] = await ethers.getSigners();

    const TestDivaToken = await ethers.getContractFactory("TestDivaToken");
    testDivaToken = await TestDivaToken.deploy();

    await testDivaToken.deployed();

    // send all to recipient
    const distro = [
      {
        to: recipientAccount.address,
        amount: CONFIG.INITIAL_SUPPLY,
      },
    ];

    const airdrop = {
      to: recipientAccount.address,
      amount: ethers.utils.parseEther("0"),
    };

    await testDivaToken
      .connect(deployer)
      .distributeAndTransferOwnership(distro, airdrop, deployer.address, {
        gasLimit: 1500000,
      });
  });

  test("01. Should allow to burn tokens", async function () {
    const [deployer, recipientAccount, regularAccount, ...accounts] =
      await ethers.getSigners();

    await testDivaToken
      .connect(recipientAccount)
      .transfer(regularAccount.address, ethers.utils.parseEther("100"));

    await testDivaToken
      .connect(regularAccount)
      .burn(ethers.utils.parseEther("15"));

    expect(await testDivaToken.balanceOf(regularAccount.address)).to.equal(
      ethers.utils.parseEther("85")
    );

    await testDivaToken
      .connect(recipientAccount)
      .transfer(accounts[3].address, ethers.utils.parseEther("50"));

    await testDivaToken.connect(accounts[3]).burn(ethers.utils.parseEther("5"));

    expect(await testDivaToken.balanceOf(accounts[3].address)).to.equal(
      ethers.utils.parseEther("45")
    );

    expect(await testDivaToken.totalSupply()).to.equal(
      ethers.utils
        .parseUnits(CONFIG.INITIAL_SUPPLY, "wei")
        .sub(ethers.utils.parseEther("20"))
    );
  });
});
