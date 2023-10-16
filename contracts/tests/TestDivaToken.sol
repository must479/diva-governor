// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "../DivaToken.sol";

contract TestDivaToken is DivaToken {
    constructor() DivaToken("Diva Token", "DIVA") {
        // unpause for testing purpose
        _unpause();
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
