// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

/// @dev Importing openzeppelin stuffs.
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICoinMingle is IERC20 {
    /**
     * @dev Initializing the CoinMingle, ERC20 token and Pair tokens (tokenA & tokenB).
     * @param _tokenA: The first token for pair.
     * @param _tokenB: The second token for pair
     */
    function initialize(address _tokenA, address _tokenB) external;

    /**
     * @dev Minting liquidity tokens as per share alloted.
     * @param _to: The address to whom the CoinMingleLP share will mint.
     * @return liquidity The amount of CoinMingleLP token minted.
     */
    function mint(address _to) external returns (uint256 liquidity);

    /**
     * @dev Removing liquidity tokens as per share given.
     * @param _to: The address to whom the tokens will transferred.
     * @return amountA The amount of tokenA removed from pool.
     * @return amountB The amount of tokenB removed from pool
     */
    function burn(
        address _to
    ) external returns (uint256 amountA, uint256 amountB);

    /**
     * @dev Swap tokens for other tokens
     * @param _to: The address to whom the tokens will transferred.
     * @return _amountOut The amount of token user got after swapping.
     */
    function swap(address _to) external returns (uint256 _amountOut);

    /**
     * @dev Getting the actual amount of token you will get on the behalf of amountIn & tokenIn.
     * @param _tokenIn: The token you want to swap.
     * @param _amountIn: The amount of token you want to swap.
     */
    function getAmountOut(
        address _tokenIn,
        uint256 _amountIn
    ) external view returns (uint256 _amountOut);

    /**
     * @dev Returns tha actual amount of reserves available for tokenA & tokenB.
     * @return reserveA The tokenA amount.
     * @return reserveB The tokenB amount.
     */
    function getReserves()
        external
        view
        returns (uint256 reserveA, uint256 reserveB);

    /**
     * @dev returns the address of tokenA
     */

    function tokenA() external view returns (address _tokenA);
}
