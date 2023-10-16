# Diva Staking DAO Governor
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# 1. Introduction 

The Diva Staking DAO is a trustless Decentralized Autonomous Organization that aims to curate the Diva Staking protocol.

It may interact with certain configurable parameters of the Diva Staking protocol in the future when the main Diva Staking contracts are deployed. 

This DAO uses Open Zeppelin's Governor with two custom extensions:

1. Configuring timelock delays
2. Customizing votes accounting

In order to remain fully trustless, the process of cancelling proposals does not rely on a guardian, nor does a multi-sig control it. A cancellation proposal has to be done following a governance process and has different constraints than standard proposals.


# 2. Contracts
## Diva Token

- ERC20
- Name: Diva Token
- Symbol: DIVA
- Decimals: 18
- Total supply: 1.000.000.000. 

The total supply of DIVA was minted in a 2-step process:
1. an initial supply and deployment time of 884,150,000 DIVA for early supporters, Initial Distribution DIVA claim, and DAO treasury. 
2. a second mint totaling 115,850,000 DIVA aimed to be distributed to a not-for-profit entity/organization. Finally, that deployment was triggered by the same deployment wallet and pointed to an address provided by The Staking Foundation.

The DIVA-specific customizations include:

- DIVA token smart contract sets initially the DAO Governor address as “owner”. Enabling transferability results on the DAO Governor contract address automatically renouncing ownership of the DIVA token smart contract (“renounce ownership” function being triggered by “enable transferability” function). 
- Pausable (one-shot transferability fuse). The token is paused in the deployment and can only be unpaused through a governance process once the non-transferability period expires.
  - Minimum non-transferability period 10 weeks.
  - As explained before, the ownership of Diva Token is triggered with the unpause (being dependent functions).
- ERC20Votes extension to create snapshots of the voting power.
- Custom method added to Diva Token to facilitate the delegation of Diva Token from Merkle Distributor.
- Concerning pausability, there are two exceptions:
  - transfers were enabled from address 0 (allowing the minting process).
  - transfers were enabled from the MerkleDistributorWithDelegation contract (allowing whitelisted users to claim their tokens).
- Diva token contract has a custom function that eases self-delegations from the Merkle Distributor contract.

## **DivaGovernor**

DivaGovernor is based on the Open Zeppelin governor with two in-house extensions. The main settings are:

1. *Governance token*: Delegated DIVA Token
2. *Governor name*: Diva Governor
3. *Proposal threshold*: 1M Delegated DIVA Token
4. *Voting delay*: 2 days 
5. *Voting period*: 3 days
6. *Quorum*: 10M Delegated DIVA Tokens
7. *GovernorTimelockControlConfigurable*: extension that adds different delays for the timelock controller. These delays are set up based on the function signatures of the actions within the proposal. There are three different delays:
   - *short delay*: only for cancellation proposal.
   - *default delay*: the common delay for proposals.
   - *long delay*: an extended delay for critical proposals.
8. *GovernorCountingThresholds*: extension that adds different success thresholds for a proposal to be approved. Following the GovernorTimelockControlConfigurable, these different thresholds are set up based on the function signatures of the actions within the proposal. The thresholds are:
   - *default treshold*: >50%
   - *moderate treshold*: >66%
   - *large treshold*: >75%


### **DivaTimelockController**
DivaTimelockController inherits Open Zeppelin Timelock controller and extends it with a method for a custom initialization. 

## Roles in DivaStakingDAO

- A delegate must have more voting power than the Proposal thresholds to initiate a proposal. This requirement was introduced mainly to avoid proposal spamming (enabled with the `ProposalThreshold` parameter from [Open Zeppelin GovernorSettings]([.@openzeppelin/contracts/governance/extensions/GovernorSettings.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/extensions/GovernorSettings.sol))). 
- Once a proposal is approved, anyone can queue it.
- After the queueing period, anyone can execute it.
- If a potentially malicious proposal is submitted, the proposal can only be canceled by submitting another proposal. With this solution, there is a tradeoff between trust and community.

## 3. Launch strategy

All the launch strategy relies on the "hardhat-deploy" plugin. There are three relevant directories for the launch strategy:
- [./deploy](./deploy) where all the scripts for the deterministic launch are in place.
- [./deploy-configuration](./deploy-configuration) where main deployment configuration parameters are set.
- [./distro](./distro) where the parameters related to the tokens distribution can be found.

### Launch transactions:

1. Diva token ([transaction](https://etherscan.io/tx/0xd81554bd7f80358a538212d25d3f46be7cc86584ffbc14f20eebf2278e9fed31))
2. DivaTimelockController ([transaction](https://etherscan.io/tx/0x81897fd575f1f75ccfe747b247d1ae46d8456e2d8dfada9188039624338ffa9c))
3. DivaGovenor ([transaction](https://etherscan.io/tx/0x7bee24a3fa4bd032d61de1fc4413ef4b5cdddd293dadc492917103eef2111341))
4. Merkle Distributor with Delegation ([transaction](https://etherscan.io/tx/0x789e0a89860cc7299ffde4995f1f4f1439d7c0f6368661f3e37dc46401f8050b))
5. DivaStakingDAO setup ([transaction](https://etherscan.io/tx/0xb20d5803457a5af85e5ec2e69b0421d7a02d609f5fc7cd1ce25144c1d9ec4337))
6. Token distribution ([transaction](https://etherscan.io/tx/0x957fb43b8e0d4f806dfad086b04ee080d0a209029e756acdbbe0eb6edde06847))

### After launch transactions
- Minting of The Staking Foundation tokens ([transaction](https://etherscan.io/tx/0x6eaaf027d8e3d9ee434a42d3ec9a7827e8d57e532c524896b8ebedabf72e328b))
- Withdraw of unclaimed Diva tokens after claiming period expired ([transaction](https://etherscan.io/tx/0x767f06f9f21c261d20f654b932b165e8431d902ad27cc1e011daa13ffe592186))

## Deployments
As DivaStakingDAO relies on "hardhat-deploy", the deployment can be done by simply running the following command:

```
npx hardhat deploy --network [NAME OF THE NETWORK]
```

### Mainnet
- Diva token: `0xBFAbdE619ed5C4311811cF422562709710DB587d`
- Merkle Distributor with Delegation: `0x777E2B2Cc7980A6bAC92910B95269895EEf0d2E8`
- DivaGovernor: `0xFb6B7C11a55C57767643F1FF65c34C8693a11A70`
- DivaTimelockController: `0x4eBB20995B6264b4b1E25f4473a4636CDB6a9790`

## 4. Tally
Tally is a web interface that eases the interaction with standard governor contracts. As DivaStakingDAO is built using Open Zeppelin's implementation of the governor, integration with Tally is straightforward.
From Tally, users can delegate, propose (having enough voting power), queue and execute proposals.
[DivaStakingDAO](https://www.tally.xyz/gov/diva)

## 5. DivaStakingDAO tokens claim
Diva's Merkle Distributor with Delegation is based on the de-facto standard contract for token distributions, the Merkle distributor from [Uniswap](https://github.com/Uniswap/merkle-distributor "Uniswap").

Diva's Merkle Distributor inherits the [Merkle distributor with deadline]([contracts/MerkleDistributorWithDeadline.sol](https://github.com/Uniswap/merkle-distributor/blob/master/contracts/MerkleDistributorWithDeadline.sol)) overriding its `claim` method and enabling a `claimAndDelegate` method to ensure that all Diva tokens claimed are for people willing to be part of DivaStakingDAO.

Diva Staking DAO tokens claim distribution criteria are described in the following [repository](https://github.com/divastaking/claim).

## License
DivaStakingDAO Contracts are released under [MIT LICENSE](./LICENSE) or GPL 3.0.
