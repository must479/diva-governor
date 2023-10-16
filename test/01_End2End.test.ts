import { expect } from "chai";
import { deployments, ethers, getNamedAccounts } from "hardhat";
import { CONFIG } from "../deploy-configuration";
import { parseBalanceMap } from "../src/parse-balance-map";

import { MerkleDistributorWithDelegation__factory } from "../typechain-types";

import {
  setBalance,
  impersonateAccount,
} from "@nomicfoundation/hardhat-network-helpers";

const testOnlyWithHardhatForking =
  process.env.FORKING === "true" ? it : it.skip;

describe("E2E test", () => {
  testOnlyWithHardhatForking("check the whole setup", async () => {
    // @dev load deployed contracts from goerli
    const merkleDistributorAddress =
      require("../deployments/goerli/MerkleDistributorWithDelegation").address;
    const divaTokenAddress = require("../deployments/goerli/DivaToken").address;
    const divaGovernorAddress =
      require("../deployments/goerli/DivaGovernor").address;

    console.log("merkleDistributorAddress: ", merkleDistributorAddress);
    console.log("divaTokenAddress: ", divaTokenAddress);
    console.log("divaGovernorAddress: ", divaGovernorAddress);

    const total = CONFIG.AIRDROP.TOTAL_AMOUNT;
    const claimEndTime = CONFIG.AIRDROP.CLAIM_ENDTIME;

    const { claims } = parseBalanceMap(CONFIG.AIRDROP.RECIPIENTS_ALLOCATIONS);
    console.log("claims: ", claims);

    const allAllocations = CONFIG.AIRDROP.RECIPIENTS_ALLOCATIONS;

    const helpers = require("@nomicfoundation/hardhat-network-helpers");

    const impersonatedDiva = CONFIG.DIVA_ENTITY_ADDRESS;
    const impersonatedDivaSigner = await ethers.getSigner(impersonatedDiva);
    await helpers.setBalance(
      impersonatedDiva,
      ethers.utils.parseEther("100.0")
    );

    const divaTokenInstanceForDivaIssuer = await ethers.getContractAt(
      "DivaToken",
      divaTokenAddress,
      impersonatedDivaSigner
    );

    // @dev check distro
    const allDistros = CONFIG.TOKEN_DISTRIBUTION;
    for (let i = 0; i < allDistros.length; i++) {
      const userAddress = allDistros[i].to;
      const amount = allDistros[i].amount;

      expect(
        await divaTokenInstanceForDivaIssuer.balanceOf(userAddress)
      ).to.equal(amount);
    }
    console.log("all tokens have been distributed to investors");

    // @dev mint foundation tokens
    const { deployer } = await getNamedAccounts();
    const impersonatedDeployerSigner = await ethers.getSigner(deployer);
    const divaTokenInstanceForDivaDeployer = await ethers.getContractAt(
      "DivaToken",
      divaTokenAddress,
      impersonatedDeployerSigner
    );
    await divaTokenInstanceForDivaDeployer.mintFoundationDistribution(
      "0x4444444449444444444944444444494444444449"
    );

    expect(
      await divaTokenInstanceForDivaIssuer.balanceOf(
        "0x4444444449444444444944444444494444444449"
      )
    ).to.equal(
      ethers.utils
        .parseUnits(CONFIG.TOTAL_SUPPLY, "wei")
        .sub(ethers.utils.parseUnits(CONFIG.INITIAL_SUPPLY, "wei"))
    );
    console.log("foundation tokens have been minted");

    const keysArray = Object.keys(claims);

    // @dev impersonate randoms users and claim airdrop
    for (let i = 7; i < allAllocations.length; i += 100) {
      const userAddress = allAllocations[i].address;
      const userEarnings = allAllocations[i].earnings;

      console.log("userAddress: ", userAddress);
      console.log("userEarnings: ", userEarnings);

      const currentAddress = keysArray[i];
      const data = claims[currentAddress];
      const impersonatedWallet = currentAddress;
      await setBalance(impersonatedWallet, "0x18665977253402088");
      await impersonateAccount(impersonatedWallet);
      const currentSigner = await ethers.getSigner(impersonatedWallet);

      const merkleDistributorWithDelegationForIndex0Claimer =
        MerkleDistributorWithDelegation__factory.connect(
          merkleDistributorAddress,
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
          { gasLimit: 1000000 }
        )
      )
        .to.emit(merkleDistributorWithDelegationForIndex0Claimer, "Claimed")
        .withArgs(index, impersonatedWallet, amount)
        .to.emit(divaTokenInstanceForDivaIssuer, "DelegateChanged")
        .withArgs(
          impersonatedWallet,
          ethers.constants.AddressZero,
          impersonatedWallet
        );

      expect(
        await divaTokenInstanceForDivaIssuer.delegates(impersonatedWallet)
      ).to.be.equal(impersonatedWallet);

      expect(
        await divaTokenInstanceForDivaIssuer.getVotes(impersonatedWallet)
      ).to.be.equal(amount);
      console.log("user has claimed the airdrop", currentAddress);
    }

    // @dev anyone can withdraw remaining tokens after claimEndTime. Tokens are sent to DAO treasury -> divaTimelockController
    const impersonatedDelegatee = await ethers.getSigner(impersonatedDiva);
    const merkleDistributorImpersonated = await ethers.getContractAt(
      "MerkleDistributorWithDelegation",
      merkleDistributorAddress,
      impersonatedDelegatee
    );

    expect(await merkleDistributorImpersonated.endTime()).to.equal(
      claimEndTime
    );

    console.log("withdraw before the end time");
    await expect(
      merkleDistributorImpersonated.withdraw({
        gasLimit: 200000,
      })
    ).to.be.revertedWithCustomError(
      merkleDistributorImpersonated,
      "NoWithdrawDuringClaim"
    );

    let oneSecondAfterEndTime = claimEndTime + 1;
    console.log("oneSecondAfterEndTime: ", oneSecondAfterEndTime);

    await helpers.mine(
      oneSecondAfterEndTime -
        (
          await ethers.provider.getBlock("latest")
        ).timestamp
    );

    console.log(
      "timestamp after claiming period expires",
      (await ethers.provider.getBlock("latest")).timestamp
    );

    await expect(
      merkleDistributorImpersonated.withdraw({
        gasLimit: 200000,
      })
    ).not.to.be.reverted;

    console.log("withdraw after the end time");

    // @dev distribute tokens from Diva Entity to investors
    const delegatee = "0x0000000000000000000000000000000000000020";

    // @dev investors delegate their voting power
    for (let i = 0; i < allDistros.length; i++) {
      const userAddress = allDistros[i].to;
      console.log("investor", userAddress);

      await helpers.impersonateAccount(userAddress);
      await helpers.setBalance(userAddress, ethers.utils.parseEther("100.0"));

      const impersonatedSigner = await ethers.getSigner(userAddress);
      const contract = await ethers.getContractAt(
        "DivaToken",
        divaTokenAddress,
        impersonatedSigner
      );

      const tx = await contract.delegate(delegatee, { gasLimit: 10000000 });
      await tx.wait();
    }
    console.log("all investors have delegated their voting power");

    // @dev delegatee has enough voting power to create and approve proposals.
    await helpers.impersonateAccount(delegatee);
    await helpers.setBalance(delegatee, ethers.utils.parseEther("1000.0"));

    const impersonatedSigner = await ethers.getSigner(delegatee);
    const divaGovernorImpersonated = await ethers.getContractAt(
      "DivaGovernor",
      divaGovernorAddress,
      impersonatedSigner
    );
    // 1. Propose
    const proposalFunction = "unpause";
    const proposalDescription = "Resume diva token transferability";
    const proposalTargetContract = divaTokenAddress;

    const encodedFunctionCall =
      divaTokenInstanceForDivaIssuer.interface.encodeFunctionData(
        proposalFunction
      );

    const proposeTx = await divaGovernorImpersonated.propose(
      [proposalTargetContract],
      [0],
      [encodedFunctionCall],
      proposalDescription
    );
    const proposalBlock = await helpers.time.latestBlock();
    console.log("proposalBlock: ", proposalBlock.toString());
    const proposeReceipt = await proposeTx.wait(1);
    console.log("proposal events", proposeReceipt);
    const proposalId = proposeReceipt.events![1].args!.proposalId;
    console.log("proposalId: ", proposalId.toString());
    // 2.a Vote
    await expect(
      divaGovernorImpersonated.castVote(proposalId, 1, { gasLimit: 500000 })
    ).to.be.revertedWith("Governor: vote not currently active");
    console.log("not active");

    // 2b. Vote to active proposal
    let proposalBlockCounter = proposalBlock + CONFIG.VOTING_DELAY + 25;
    console.log("initial voting block : ", proposalBlockCounter);
    await helpers.mine(CONFIG.VOTING_DELAY);

    console.log("voting block : ", await helpers.time.latestBlock());
    await expect(
      divaGovernorImpersonated.castVote(proposalId, 1, { gasLimit: 500000 })
    ).not.to.be.reverted;

    // 3. Queue
    proposalBlockCounter = proposalBlockCounter + CONFIG.VOTING_PERIOD;
    await helpers.mine(proposalBlockCounter);

    const descriptionHash = ethers.utils.keccak256(
      ethers.utils.toUtf8Bytes(proposalDescription)
    );

    const queueTx = await divaGovernorImpersonated.queue(
      [proposalTargetContract],
      [0],
      [encodedFunctionCall],
      descriptionHash,
      { gasLimit: 500000 }
    );

    // 4. Wait timelock cooldown
    proposalBlockCounter = proposalBlockCounter + CONFIG.MIN_DELAY;
    await helpers.mine(proposalBlockCounter);
    // 5. Execute
    await expect(
      divaGovernorImpersonated.execute(
        [proposalTargetContract],
        [0],
        [encodedFunctionCall],
        descriptionHash,
        { gasLimit: 500000 }
      )
    ).not.to.be.reverted;
  }).timeout(10000000000);
});
