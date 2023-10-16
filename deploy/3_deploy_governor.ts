import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONFIG } from "../deploy-configuration";
import {
  functionHash,
  functionDelay,
  functionThreshold,
} from "../scripts/helpers";
import { BigNumber } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const divaToken = await deployments.get("DivaToken");
  const divaTimelockController = await deployments.get(
    "DivaTimelockController"
  );

  // @dev functionSignatures and delayValues have to match in length. Needs to review all function in Governor, Timelock and divatoken to configure this properly
  const functionSignatures: string[] = [];
  CONFIG.FUNCTION_SIGNATURES.forEach((element) => {
    functionSignatures.push(functionHash(element));
  });

  const delayValues: BigNumber[] = [];
  CONFIG.FUNCTION_DELAYS.forEach((element) => {
    delayValues.push(functionDelay(element.toString()));
  });

  const thresholdValues: BigNumber[] = [];
  CONFIG.FUNCTION_THRESHOLDS.forEach((element) => {
    thresholdValues.push(functionThreshold(element.toString()));
  });

  const governorParameters = {
    votingDelay: CONFIG.VOTING_DELAY,
    governorName: CONFIG.GOVERNOR_NAME,
    votingPeriod: CONFIG.VOTING_PERIOD,
    quorumAbsolute: CONFIG.QUORUM_ABSOLUTE,
    proposalThreshold: CONFIG.PROPOSAL_THRESHOLD,
    defaultDelay: CONFIG.CONFIGURABLE_DELAYS.DEFAULT_DELAY,
    shortDelay: CONFIG.CONFIGURABLE_DELAYS.SHORT_DELAY,
    longDelay: CONFIG.CONFIGURABLE_DELAYS.LONG_DELAY,
    functionSignatures: functionSignatures,
    functionDelays: delayValues,
    functionThresholds: thresholdValues,
  };

  await deploy("DivaGovernor", {
    from: deployer,
    log: true,
    gasLimit: 12000000,
    args: [
      divaToken.address,
      divaTimelockController.address,
      governorParameters,
    ],
  });
};

func.tags = ["all", "DivaGovernor"];

export default func;
