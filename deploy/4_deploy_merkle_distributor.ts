import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { CONFIG } from "../deploy-configuration";
import { parseBalanceMap } from "../src/parse-balance-map";
import fs from "fs";
import path from "path";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const divaToken = await deployments.get("DivaToken");
  const divaTimelockController = await deployments.get(
    "DivaTimelockController"
  );

  // @dev generate airdrop claiming data.
  const { merkleRoot, claims } = parseBalanceMap(
    CONFIG.AIRDROP.RECIPIENTS_ALLOCATIONS
  );

  // @dev save claims data to file.
  const claimsData = JSON.stringify(claims, null, 2);
  fs.writeFileSync(path.join("files", `claims.json`), claimsData);

  await deploy("MerkleDistributorWithDelegation", {
    from: deployer,
    log: true,
    gasLimit: 6000000,
    args: [
      divaToken.address,
      merkleRoot,
      CONFIG.AIRDROP.CLAIM_ENDTIME,
      CONFIG.AIRDROP.ACCEPTANCE_HASH,
      divaTimelockController.address,
    ],
  });
};

func.tags = ["all", "MerkleDistributorWithDelegation"];

export default func;
