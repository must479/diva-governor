import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ADDRESS_ZERO } from "../constants";
import { ethers } from "hardhat";

const setupContracts: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments } = hre;

  const divaTimelockController = await deployments.get(
    "DivaTimelockController"
  );

  const divaTimelockContract = await ethers.getContractAt(
    "DivaTimelockController",
    divaTimelockController.address
  );

  const governor = await deployments.get("DivaGovernor");

  await divaTimelockContract.initialiseAndRevokeAdminRole(governor.address);
};

setupContracts.tags = ["all", "setup"];

export default setupContracts;
