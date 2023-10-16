## Diva Governance Initiation Workflow

### Pre requisites

- Create multisig for Diva entity
- Airdrop addresses sorted in deploy-configuration/index.ts file
- Vesting addresses

### Steps

- Deploy diva token (Allocate all the total supply to the Diva Entity)
- Deploy Timelock Controller
- Deploy Governor
- Setup Governor contract
- Deploy VestingDeployer
- Deploy Airdrop contract
- The Diva Entity should:
    - Transfer tokens to Vesting Deployer
    - Transfer tokens to Airdrop contract
    - Set Vestings via Vesting Deployer

# Governor lifecycle

- Create timelock
- Create governor
- Delegate
- Create proposal
- Voting delay
- Vote
- Voting period
- Queue Timelock
- Execute


# Diva Token
It is an ERC20 token with the following extensions:
- ERC20Votes
- ERC20Pausable
- Ownable

DIVA is paused on deployment until the DAO votes to unpause when other contracts are deployed.
Once the token resumes transferability, it cannot be paused once again.
It is ownable and belongs to the DAO. 


# DivaGovernor:
It is an OpenZeppelin governor with the following extensions:
- GovernorSettings
- GovernorVotes
- GovernorVotesQuorumFraction
- GovernorTimelockControlConfigurable
- DivaTimelockController: sets different delays for the cooldown period of any proposal. The idea is to have most of the executable actions of proposals with DEFAULT and LONG cooldown period. And a few with SHORT cooldown period. So far, there is only a SHORT cooldown period proposal, the  cancel proposal which cancels other malicious proposal. With this, we get rid of guardians. We will need to add another SHORT proposal to pause divETH
- GovernorCountingThresholds: sets different thresholds for a proposal to be approved, 50%, 66% and 75%

No guardians, proposals are cancelled with other proposals

# MerkleDistributor:
- vanilla MerkleDistributor from Uniswap. Whitelisted addresses for the airdrop has a deadline to claim the airdrop.
