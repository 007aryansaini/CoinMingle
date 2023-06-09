// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

/// @dev Importing openzeppelin stuffs.
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/// @dev Custom errors.
error InvalidAddress();
error AccessForbidden();

contract CoinMingleLP is Initializable, ERC20Upgradeable {
    /// @dev Tracking the CoinMingleRouter address.
    address public CoinMingleRouter;
    /// @dev Tracking the tokenA address.
    address public tokenA;
    /// @dev Tracking the tokenB address.
    address public tokenB;

    /// @dev Tracking the reserveA of tokenA.
    uint256 private _reserveA;
    /// @dev Tracking the reserveB of tokenB.
    uint256 private _reserveB;

    /// @dev Modifier to forbid the access.
    modifier onlyRouter() {
        /// @dev Revert if caller is not the CoinMingleRouter
        if (msg.sender != CoinMingleRouter) revert AccessForbidden();
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializing the CoinMingleRouter, ERC20 token and Pair tokens (tokenA & tokenB).
     * @param _tokenA: The first token for pair.
     * @param _tokenB: The second token for pair
     */
    function initialize(address _tokenA, address _tokenB) external initializer {
        /// @dev Token address checking.
        if (_tokenA == address(0) || _tokenB == address(0))
            revert InvalidAddress();
        /// @dev Initializing the ERC20.
        __ERC20_init("CoinMingleSwap Liquidity Provider", "CMLP");

        /// @dev Initializing the CoinMingleRouter.
        CoinMingleRouter = msg.sender;
        /// @dev Initializing the tokenA & tokenB for the pool.
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    /**
     * @dev Minting liquidity tokens as per share alloted.
     * @param _to: The address to whom the CoinMingleLP share will mint.
     * @return liquidity The amount of CoinMingleLP token minted.
     */
    function mint(
        address _to
    ) external onlyRouter returns (uint256 liquidity) {}

    /**
     * @dev Removing liquidity tokens as per share given.
     * @param _to: The address to whom the tokens will transferred.
     * @return amountA The amount of tokenA removed from pool.
     * @return amountB The amount of tokenB removed from pool
     */
    function burn(
        address _to
    ) external onlyRouter returns (uint256 amountA, uint256 amountB) {}

    /**
     * @dev Returns tha actual amount of reserves available for tokenA & tokenB.
     * @return reserveA The tokenA amount.
     * @return reserveB The tokenB amount.
     */
    function getReserves()
        external
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        reserveA = _reserveA;
        reserveB = _reserveB;
    }
}
