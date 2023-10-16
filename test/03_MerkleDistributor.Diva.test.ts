import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { deployments, ethers, network } from "hardhat";

import {
  DivaToken,
  DivaToken__factory,
  MerkleDistributorWithDelegation,
  MerkleDistributorWithDelegation__factory,
} from "../typechain-types";

import {
  setBalance,
  impersonateAccount,
} from "@nomicfoundation/hardhat-network-helpers";

import { parseBalanceMap } from "../src/parse-balance-map";
import { CONFIG } from "../deploy-configuration";
import { ONE_YEAR_SECONDS } from "../constants";

chai.use(solidity);

const overrides = {
  gasLimit: 9999999,
};

const test = it;

describe("Diva's MerkleDistributorWithDelegation Diva", () => {
  let divaToken: DivaToken;
  let deployer: SignerWithAddress;
  let recipient: SignerWithAddress;
  let wallet1: SignerWithAddress;
  let wallet2: SignerWithAddress;

  let distributor: MerkleDistributorWithDelegation;

  let claims: {
    [account: string]: {
      index: number;
      amount: string;
      proof: string[];
    };
  };
  let tokenTotal: string;
  let merkleRoot: string;

  beforeEach(async () => {
    await network.provider.send("hardhat_reset", []);

    [deployer, recipient, wallet1, wallet2] = await ethers.getSigners();

    await deployments.fixture(["all"]);

    const divaTokenDeployment = await deployments.get("DivaToken");
    const distributorDeployment = await deployments.get(
      "MerkleDistributorWithDelegation"
    );

    divaToken = DivaToken__factory.connect(
      divaTokenDeployment.address,
      recipient
    );

    distributor = MerkleDistributorWithDelegation__factory.connect(
      distributorDeployment.address,
      deployer
    );

    const divaTimelockController = await deployments.get(
      "DivaTimelockController"
    );

    const distro = [
      {
        to: recipient.address,
        amount: ethers.utils.parseEther("0"),
      },
    ];

    const airdrop = {
      to: distributorDeployment.address,
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

    const {
      claims: innerClaims,
      merkleRoot: innerMerkleRoot,
      tokenTotal: innerTokenTotal,
    } = parseBalanceMap(CONFIG.AIRDROP.RECIPIENTS_ALLOCATIONS);
    claims = innerClaims;
    merkleRoot = innerMerkleRoot;
    tokenTotal = innerTokenTotal;
  });

  it("01. Successful claim and delegation", async () => {
    const keysArray = Object.keys(claims);
    const distributorDeployment = await deployments.get(
      "MerkleDistributorWithDelegation"
    );
    const currentAddress = keysArray[0];
    const data = claims[currentAddress];
    const impersonatedWallet = currentAddress;
    await setBalance(impersonatedWallet, "0x18665977253402088");
    await impersonateAccount(impersonatedWallet);
    const currentSigner = await ethers.getSigner(impersonatedWallet);

    const merkleDistributorWithDelegationForIndex0Claimer =
      MerkleDistributorWithDelegation__factory.connect(
        distributorDeployment.address,
        currentSigner
      );
    const proof0 = data.proof;
    const index = data.index;
    const amount = data.amount;
    await expect(
      merkleDistributorWithDelegationForIndex0Claimer.claimAndDelegate(
        index,
        impersonatedWallet,
        amount,
        proof0,
        CONFIG.AIRDROP.ACCEPTANCE_HASH,
        overrides
      )
    )
      .to.emit(merkleDistributorWithDelegationForIndex0Claimer, "Claimed")
      .withArgs(index, impersonatedWallet, amount)
      .to.emit(divaToken, "DelegateChanged")
      .withArgs(
        impersonatedWallet,
        ethers.constants.AddressZero,
        impersonatedWallet
      );

    expect(await divaToken.delegates(impersonatedWallet)).to.be.equal(
      impersonatedWallet
    );

    expect(await divaToken.getVotes(impersonatedWallet)).to.be.equal(amount);
  });

  test("02. Anyone can withdraw, after claiming period expires", async () => {
    distributor = distributor.connect(wallet1);
    const owner = await distributor.nonClaimedTokensReceiver();
    const remainingAmount = await divaToken.balanceOf(distributor.address);

    await expect(distributor.withdraw(overrides)).to.be.revertedWith(
      "NoWithdrawDuringClaim"
    );

    const oneSecondAfterEndTime =
      CONFIG.AIRDROP.CLAIM_ENDTIME + ONE_YEAR_SECONDS;

    await ethers.provider.send("evm_mine", [oneSecondAfterEndTime]);
    await expect(distributor.withdraw(overrides))
      .to.emit(divaToken, "Transfer")
      .withArgs(distributor.address, owner, remainingAmount);
  });

  test("03. Cannot withdraw during claim window", async () => {
    await expect(distributor.withdraw(overrides)).to.be.revertedWith(
      "NoWithdrawDuringClaim"
    );
  });

  test("04. Cannot claim after end time", async () => {
    const oneSecondAfterEndTime =
      CONFIG.AIRDROP.CLAIM_ENDTIME + ONE_YEAR_SECONDS;
    await ethers.provider.send("evm_mine", [oneSecondAfterEndTime]);
    const keysArray = Object.keys(claims);
    const distributorDeployment = await deployments.get(
      "MerkleDistributorWithDelegation"
    );
    const currentAddress = keysArray[0];
    const data = claims[currentAddress];
    const impersonatedWallet = currentAddress;
    await setBalance(impersonatedWallet, "0x18665977253402088");
    await impersonateAccount(impersonatedWallet);
    const currentSigner = await ethers.getSigner(impersonatedWallet);

    const merkleDistributorWithDelegationForIndex0Claimer =
      MerkleDistributorWithDelegation__factory.connect(
        distributorDeployment.address,
        currentSigner
      );
    const proof0 = data.proof;
    const index = data.index;
    const amount = data.amount;
    await expect(
      merkleDistributorWithDelegationForIndex0Claimer.claimAndDelegate(
        index,
        impersonatedWallet,
        amount,
        proof0,
        CONFIG.AIRDROP.ACCEPTANCE_HASH,
        overrides
      )
    ).to.be.revertedWith("ClaimWindowFinished");
  });

  test("05. Can withdraw after end time", async () => {
    const divaTimelockControllerAddress = (
      await deployments.get("DivaTimelockController")
    ).address;
    const oneSecondAfterEndTime = CONFIG.AIRDROP.CLAIM_ENDTIME + 1;
    await ethers.provider.send("evm_mine", [oneSecondAfterEndTime]);
    const deployedBalanceBefore = await divaToken.balanceOf(
      divaTimelockControllerAddress
    );
    const balanceRemainingInAirdropContract = await divaToken.balanceOf(
      distributor.address
    );
    await distributor.withdraw(overrides);
    expect(await divaToken.balanceOf(divaTimelockControllerAddress)).to.eq(
      deployedBalanceBefore.add(balanceRemainingInAirdropContract)
    );
  });

  test("06. Anyone can withdraw after end time", async () => {
    const oneSecondAfterEndTime = CONFIG.AIRDROP.CLAIM_ENDTIME + 1;
    await ethers.provider.send("evm_mine", [oneSecondAfterEndTime]);
    const distributorConnectedWithWallet1 = distributor.connect(wallet1);
    await expect(distributorConnectedWithWallet1.withdraw(overrides)).not.to.be
      .reverted;
  });

  it("07. Wrong acceptance hash at claiming", async () => {
    const distributorDeployment = await deployments.get(
      "MerkleDistributorWithDelegation"
    );
    const keysArray = Object.keys(claims);
    const currentAddress = keysArray[0];
    const data = claims[currentAddress];
    const impersonatedWallet = currentAddress;
    await setBalance(impersonatedWallet, "0x18665977253402088");
    await impersonateAccount(impersonatedWallet);
    const currentSigner = await ethers.getSigner(impersonatedWallet);

    const merkleDistributorWithDelegationForIndex0Claimer =
      MerkleDistributorWithDelegation__factory.connect(
        distributorDeployment.address,
        currentSigner
      );
    const proof0 = data.proof;
    const index = data.index;
    const amount = data.amount;
    await expect(
      merkleDistributorWithDelegationForIndex0Claimer.claimAndDelegate(
        index,
        impersonatedWallet,
        amount,
        proof0,
        "0x1234567890123456789012345678901234567890123456789012345678900000",
        overrides
      )
    ).to.be.revertedWith("WrongAcceptanceHash");
  });

  it("08. Should not allow to only claim tokens withouth delegation", async () => {
    const distributorDeployment = await deployments.get(
      "MerkleDistributorWithDelegation"
    );
    const keysArray = Object.keys(claims);
    const currentAddress = keysArray[0];
    const data = claims[currentAddress];
    const impersonatedWallet = currentAddress;
    await setBalance(impersonatedWallet, "0x18665977253402088");
    await impersonateAccount(impersonatedWallet);
    const currentSigner = await ethers.getSigner(impersonatedWallet);

    const merkleDistributorWithDelegationForIndex0Claimer =
      MerkleDistributorWithDelegation__factory.connect(
        distributorDeployment.address,
        currentSigner
      );
    const proof0 = data.proof;
    const index = data.index;
    const amount = data.amount;
    await expect(
      merkleDistributorWithDelegationForIndex0Claimer.claim(
        index,
        impersonatedWallet,
        amount,
        proof0,
        overrides
      )
    ).to.be.revertedWith("NotUsingClaimAndDelegateMethod");
  });

  after(async () => {
    await network.provider.send("hardhat_reset", []);
  });
});

describe("Trying to deploy MerkleDistributor with deadline in a block.timestamp > endTime", () => {
  it("Should revert Trying to deploy MerkleDistributor with deadline in a block.timestamp > endTime", async () => {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp - 100;
    const Distributor = await ethers.getContractFactory(
      "MerkleDistributorWithDelegation"
    );
    await expect(
      Distributor.deploy(
        "0x0000000000000000000000000000000000000001",
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        deadline,
        CONFIG.AIRDROP.ACCEPTANCE_HASH,
        (
          await ethers.getSigners()
        )[0].address,
        { gasLimit: 600000 }
      )
    ).to.be.revertedWith("EndTimeInPast");
  });
});
