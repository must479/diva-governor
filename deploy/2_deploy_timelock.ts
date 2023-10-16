import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONFIG } from "../deploy-configuration";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("DivaTimelockController", {
    from: deployer,
    log: true,
    args: [CONFIG.MIN_DELAY],
  });
};

func.tags = ["all", "DivaTimelockController"];

export default func;
