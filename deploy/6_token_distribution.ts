import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONFIG } from "../deploy-configuration";
import { ethers } from "hardhat";

const setupContracts: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments } = hre;

  const divaTimelockController = await deployments.get(
    "DivaTimelockController"
  );

  const divaToken = await deployments.get("DivaToken");
  const divaTokenContract = await ethers.getContractAt(
    "DivaToken",
    divaToken.address
  );

  const merkleDistributor = await deployments.get(
    "MerkleDistributorWithDelegation"
  );

  console.log("merkle distributor address: ", merkleDistributor.address);

  const [deployer, ...accounts] = await ethers.getSigners();

  const allDistros = CONFIG.TOKEN_DISTRIBUTION;
  const airdropAmount = CONFIG.AIRDROP.TOTAL_AMOUNT;
  const daoAmount = CONFIG.DAO_TREASURY;

  allDistros.push({
    to: divaTimelockController.address,
    amount: daoAmount,
  });

  const airdrop: any = {
    to: merkleDistributor.address,
    amount: airdropAmount,
  };

  const tx = await divaTokenContract
    .connect(deployer)
    .distributeAndTransferOwnership(
      allDistros,
      airdrop,
      divaTimelockController.address,
      {
        gasLimit: 10000000,
      }
    );

  await tx.wait();
  console.log("DivaToken distribution tx: ", tx.hash);
};

setupContracts.tags = ["distro"];

export default setupContracts;
