// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

interface IWFTM {
    function deposit() external payable;

    function transfer(address to, uint value) external returns (bool);

    function withdraw(uint256) external;
}
