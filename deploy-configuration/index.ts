import { DelayType, ThresholdType } from "../constants";
import RECIPIENTS_ALLOCATION from "../distro/airdrop.json";
import TOKEN_DISTRIBUTION from "../distro/investors.json";
import { DAO_TREASURY, AIRDROP_AMOUNT } from "../distro";

export const CONFIG = {
  // Token values
  DIVA_ENTITY_ADDRESS: "0x45638A9E2d3fC7f977142D9A9Ee630497023b78E",
  DIVA_TOKEN_NAME: "Diva Token",
  DIVA_TOKEN_SYMBOL: "DIVA",
  TOTAL_SUPPLY: "1000000000000000000000000000", // 1 billion
  INITIAL_SUPPLY: "884150000000000000000000000", // 100 million
  // Governor values
  GOVERNOR_NAME: "Diva Governor",
  PROPOSAL_THRESHOLD: "1000000000000000000000000", // 0.1% of total supply -> 1 million DIVA tokens
  QUORUM_ABSOLUTE: "10000000000000000000000000", // 10 millions DIVA tokens - absolute value
  // @dev in blocks
  VOTING_DELAY: 7200 * 2, // 7200 blocks  * 2 days
  VOTING_PERIOD: 7200 * 3, // 7200 blocks per day * 3 days
  MIN_DELAY: 600, // minimum delay that can be set up in timelock controller
  CONFIGURABLE_DELAYS: {
    SHORT_DELAY: 600, // 2 hours
    DEFAULT_DELAY: 7200 * 6, // 6 days
    LONG_DELAY: 7200 * 10, // 10 days
  },
  FUNCTION_SIGNATURES: [
    "setVotingDelay(uint256)",
    "setVotingPeriod(uint256)",
    "setProposalThreshold(uint256)",
    "addDelayConfiguration(bytes4[],bytes4[],bytes4[])",
    "updateShortDelay(uint256)",
    "updateDefaultDelay(uint256)",
    "updateLongDelay(uint256)",
    "updateTimelock(address)",
    "updateQuorum(uint256)",
    "addThresholdConfiguration(bytes4[],bytes4[],bytes4[])",
    "unpause()",
    "transfer(address,uint256)",
    "approve(address,uint256)",
    "transferFrom(address,address,uint256)",
    "increaseAllowance(address,uint256)",
    "decreaseAllowance(address,uint256)",
    "cancel(bytes32)",
  ],
  FUNCTION_DELAYS: [
    DelayType.LONG, // @dev "setVotingDelay(uint256)",
    DelayType.LONG, // @dev "setVotingPeriod(uint256)",
    DelayType.LONG, // @dev "setProposalThreshold(uint256)",
    DelayType.DEFAULT, // @dev "addDelayConfiguration(bytes4[],bytes4[],bytes4[]) ",
    DelayType.LONG, // @dev "updateShortDelay(uint256) ",
    DelayType.LONG, // @dev "updateDefaultDelay(uint256)",
    DelayType.LONG, // @dev "updateLongDelay(uint256)",
    DelayType.LONG, // @dev "updateTimelock(address)",
    DelayType.LONG, // @dev "updateQuorum(uint256)",
    DelayType.DEFAULT, // @dev "addThresholdConfiguration(bytes4[],bytes4[],bytes4[])",
    DelayType.DEFAULT, // @dev "unpause()",
    DelayType.DEFAULT, // @dev "transfer(address,uint256)",
    DelayType.DEFAULT, // @dev "approve(address,uint256)",
    DelayType.DEFAULT, // @dev "transferFrom(address,address,uint256)",
    DelayType.DEFAULT, // @dev "increaseAllowance(address,uint256)",
    DelayType.DEFAULT, // @dev "decreaseAllowance(address,uint256)",
    DelayType.SHORT, // @dev "cancel(bytes32)",
  ],
  FUNCTION_THRESHOLDS: [
    ThresholdType.LARGE, // @dev "setVotingDelay(uint256)",
    ThresholdType.LARGE, // @dev "setVotingPeriod(uint256)",
    ThresholdType.MODERATE, // @dev "setProposalThreshold(uint256)",
    ThresholdType.LARGE, // @dev "addDelayConfiguration(bytes4[],bytes4[],bytes4[]) ",
    ThresholdType.LARGE, // @dev "updateShortDelay(uint256) ",
    ThresholdType.MODERATE, // @dev "updateDefaultDelay(uint256)",
    ThresholdType.LARGE, // @dev "updateLongDelay(uint256)",
    ThresholdType.LARGE, // @dev "updateTimelock(address)",
    ThresholdType.LARGE, // @dev "updateQuorum(uint256)",
    ThresholdType.LARGE, // @dev "addThresholdConfiguration(bytes4[],bytes4[],bytes4[])",
    ThresholdType.DEFAULT, // @dev "unpause()",
    ThresholdType.LARGE, // @dev "transfer(address,uint256)",
    ThresholdType.LARGE, // @dev "approve(address,uint256)",
    ThresholdType.LARGE, // @dev "transferFrom(address,address,uint256)",
    ThresholdType.LARGE, // @dev "increaseAllowance(address,uint256)",
    ThresholdType.LARGE, // @dev "decreaseAllowance(address,uint256)",
    ThresholdType.LARGE, // @dev "cancel(bytes32)",
  ],
  AIRDROP: {
    // @dev Ensure total is equal to the sum of all the recipients
    TOTAL_AMOUNT: AIRDROP_AMOUNT,
    CLAIM_ENDTIME: 1692165599, // @dev in seconds - 15/08/2023 23:59:59
    ACCEPTANCE_TERMS:
      "I understand that by claiming and delegating my allocated tokens, I commit to becoming a participating member of the Diva DAO and helping shape Diva as a public good. I also understand that the DIVA token is valueless and non-transferable.",
    ACCEPTANCE_HASH:
      "0x3ad9409f26bbaad530dc91737f4d8c348e658391b754681c65e69f4a4687c1df",
    RECIPIENTS_ALLOCATIONS:
      // @dev These addresses have to be ordered, check src/parse-balance-map.ts line 61
      RECIPIENTS_ALLOCATION,
  },
  TOKEN_DISTRIBUTION: TOKEN_DISTRIBUTION,
  DAO_TREASURY: DAO_TREASURY,
};
