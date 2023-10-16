import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONFIG } from "../deploy-configuration";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("DivaToken", {
    from: deployer,
    log: true,
    args: [CONFIG.DIVA_TOKEN_NAME, CONFIG.DIVA_TOKEN_SYMBOL],
  });
};

func.tags = ["all", "DivaToken"];

export default func;
