// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

/// @dev Importing openzeppelin stuffs.
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Custom errors.
error InvalidAddress();
error AccessForbidden();
error InsufficientLiquidity();
error InsufficientTokenBalanceToTransfer();

contract CoinMingleLP is Initializable, ERC20Upgradeable {
    /// @dev Tracking the coinMingleRouter address.
    address public CoinMingleRouter;
    /// @dev Tracking the tokenA address.
    address public tokenA;
    /// @dev Tracking the tokenB address.
    address public tokenB;

    /// @dev Tracking the reserveA of tokenA.
    uint256 private _reserveA;
    /// @dev Tracking the reserveB of tokenB.
    uint256 private _reserveB;
    /// @dev The algorithmic constant (K = _reserveA * _reserveB)
    uint256 public K;
    /// @dev The minimum amount of LP blocked.
    uint16 private MINIMUM_LIQUIDITY;

    /// @dev Modifier to forbid the access.
    modifier onlyRouter() {
        /// @dev Revert if caller is not the CoinMingleRouter
        if (msg.sender != CoinMingleRouter) revert AccessForbidden();
        _;
    }

    /// @dev Events
    /**
     * @dev event LiquidityMinted: will be emitted when the liquidity is minted to liquidity provider
     * @param liquidityProvider: The person who is adding liquidity to the pool
     * @param tokenAAmount : The amount of token A added by liquidity provider in the pool
     * @param tokenBAmount : The amount of token B added by liquidity provider in the pool
     */

    event LiquidityMinted(
        address indexed liquidityProvider,
        uint256 indexed tokenAAmount,
        uint256 indexed tokenBAmount
    );

    /// @dev Events
    /**
     * @dev event LiquidityBurned: will be emitted when the liquidity is burned
     * @param liquidityProvider: The person who is adding liquidity to the pool
     * @param tokenAAmount : The amount of token A added taken back by liquidity provider
     * @param tokenBAmount : The amount of token B added taken back by liquidity provider
     */

    event LiquidityBurned(
        address indexed liquidityProvider,
        uint256 indexed tokenAAmount,
        uint256 indexed tokenBAmount
    );

    /// @dev Events
    /**
     * @dev event LiquidityBurned: will be emitted when the liquidity is burned
     * @param _to: The person to whom swapped tokens are minted
     * @param tokenAAmount : The amount of token A given
     * @param tokenBAmount : The amount of token B received
     */

    event TokensSwapped(
        address indexed _to,
        uint256 indexed tokenAAmount,
        uint256 indexed tokenBAmount
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializing the coinMingleRouter, ERC20 token and Pair tokens (tokenA & tokenB).
     * @param _tokenA: The first token for pair.
     * @param _tokenB: The second token for pair
     */
    function initialize(address _tokenA, address _tokenB) external initializer {
        /// @dev Token address checking.
        if (_tokenA == address(0) || _tokenB == address(0))
            revert InvalidAddress();
        /// @dev Initializing the ERC20.
        __ERC20_init("CoinMingle Liquidity Provider", "CMLP");

        /// @dev Initializing the coinMingleRouter.
        CoinMingleRouter = msg.sender;
        /// @dev Initializing the tokenA & tokenB for the pool.
        tokenA = _tokenA;
        tokenB = _tokenB;
        MINIMUM_LIQUIDITY = 1e3;
    }

    /**
     * @dev Minting liquidity tokens as per share alloted.
     * @param _to: The address to whom the CoinMingleLP share will mint.
     * @return liquidity The amount of CoinMingleLP token minted.
     */
    function mint(address _to) external onlyRouter returns (uint256 liquidity) {
        /// @dev Getting the new amount of tokens in pool
        uint256 _newReserveA = IERC20(tokenA).balanceOf(address(this));
        uint256 _newReserveB = IERC20(tokenB).balanceOf(address(this));

        /// @dev Calculating the amount of both token added by the user
        uint256 tokenAAmountAdded = _newReserveA - _reserveA;
        uint256 tokenBAmountAdded = _newReserveA - _reserveB;

        /// @dev getting the total supply of the pair token
        uint256 _totalSupply = totalSupply();

        /// @dev Calculating the Amount of liquidity to be minted
        uint256 product = tokenAAmountAdded * tokenBAmountAdded;
        liquidity = sqrt(product);

        /// @dev Checking if the liquidity is added for the first time.
        if (_totalSupply == 0) {
            // then lock liquidity == MINIMUM_LIQUIDITY permanently
            liquidity -= MINIMUM_LIQUIDITY;
            _mint(address(0), MINIMUM_LIQUIDITY);
        }

        /// @dev Checking if the liquidity minted is more than 0
        if (liquidity == 0) revert InsufficientLiquidity();

        /// @dev Minting the liquidity to _to address
        _mint(_to, liquidity);

        /// @dev Updating the reserve & K
        _reserveA = _newReserveA;
        _reserveB = _newReserveB;
        K = _newReserveA * _newReserveB;

        /// @dev emitting the event
        emit LiquidityMinted(_to, tokenAAmountAdded, tokenBAmountAdded);
    }

    /**
     * @dev Removing liquidity tokens as per share given.
     * @param _to: The address to whom the tokens will transferred.
     * @return _amountA The amount of tokenA removed from pool.
     * @return _amountB The amount of tokenB removed from pool
     */
    function burn(
        address _to
    ) external onlyRouter returns (uint256 _amountA, uint256 _amountB) {
        /// @dev getting the amount of liquidity send by the provider to this contract.
        uint256 liquidity = balanceOf(address(this));
        /// @dev getting totalSupply ( Save gas )
        uint256 _totalSupply = totalSupply();

        /// @dev Calculating the amount to refund back to the provider based on the share of the provider in the pool.
        _amountA = (liquidity * _reserveA) / _totalSupply;
        _amountB = (liquidity * _reserveB) / _totalSupply;

        /// @dev Checking if the amount is greater than 0.
        if (_amountA == 0 || _amountB == 0)
            revert InsufficientTokenBalanceToTransfer();

        /// @dev burning the liquidity provided by the provider to this lp contract
        _burn(address(this), liquidity);

        /// @dev Updating the reserve & K
        _reserveA -= _amountA;
        _reserveB -= _amountB;
        K = _reserveA * _reserveB;

        /// @dev transferring both the tokens to the provider
        IERC20(tokenA).transfer(_to, _amountA);
        IERC20(tokenB).transfer(_to, _amountB);

        /// @dev Emitting the event
        emit LiquidityBurned(_to, _amountA, _amountB);
    }

    /**
     * @dev Swap tokens for other tokens
     * @param _to: The address to whom the tokens will transferred.
     * @return _amountOut The amount of token user got after swapping.
     */
    function swap(
        address _to
    ) external onlyRouter returns (uint256 _amountOut) {
        /// @dev Getting the current balance of both tokenA & tokenB
        uint256 _balanceOfTokenA = IERC20(tokenA).balanceOf(address(this));
        uint256 _balanceOfTokenB = IERC20(tokenB).balanceOf(address(this));

        /// @dev Getting the reserves (gas saving)
        (uint256 reserveA, uint256 reserveB) = getReserves();

        /// @dev Getting the token which user wants to swap.
        address _tokenSwapping = _balanceOfTokenA > reserveA ? tokenA : tokenB;

        //// @dev Getting the actual amount of token user wants to swap.
        uint256 _amountIn;
        /// @dev Swapping the tokenA for tokenB
        if (_tokenSwapping == tokenA) {
            /// @dev Getting the actual balance trader deposited.
            _amountIn = _balanceOfTokenA - reserveA;
            /// @dev Calculating the actual amount out as per tokenA
            _amountOut = getAmountOut(tokenA, _amountIn);
            /// @dev Updating the both reserve.
            _reserveA += _amountIn;
            _reserveB -= _amountOut;
        }
        /// @dev Swapping the tokenB for tokenA
        else {
            /// @dev Getting the actual balance trader deposited.
            _amountIn = _balanceOfTokenB - reserveB;
            /// @dev Calculating the actual amount out as per tokenB
            _amountOut = getAmountOut(tokenB, _amountIn);
            /// @dev Updating the both reserve.
            _reserveB += _amountIn;
            _reserveA -= _amountOut;
        }

        /// @dev transferring the tokens to the address.
        IERC20(_tokenSwapping).transfer(_to, _amountOut);
        /// @dev Emitting the event
        emit TokensSwapped(_to, _amountIn, _amountOut);
    }

    /**
     * @dev Getting the actual amount of token you will get on the behalf of amountIn & tokenIn.
     * @param _tokenIn: The token you want to swap.
     * @param _amountIn: The amount of token you want to swap.
     */
    function getAmountOut(
        address _tokenIn,
        uint256 _amountIn
    ) public view returns (uint256 _amountOut) {
        /// @dev Token Address checking.
        if (_tokenIn != tokenA || _tokenIn != tokenB) revert InvalidAddress();

        /// @dev Getting the reserves (gas saving)
        (uint256 reserveA, uint256 reserveB) = getReserves();

        /// @Estimating the tokenB for tokenA
        if (_tokenIn == tokenA) {
            /// @dev Calculating the token after.
            uint256 tokenA_After = reserveA + _amountIn;
            uint256 tokenB_After = K / tokenA_After;
            /// @dev Calculating the actual amountOut.
            _amountOut = reserveB - tokenB_After;
        }
        /// @dev Swapping the tokenA for tokenB
        else {
            /// @dev Calculating the token after.
            uint256 tokenB_After = reserveB + _amountIn;
            uint256 tokenA_After = K / tokenB_After;
            /// @dev Calculating the actual amountOut.
            _amountOut = reserveA - tokenA_After;
        }
    }

    /**
     * @dev Returns tha actual amount of reserves available for tokenA & tokenB.
     * @return reserveA The tokenA amount.
     * @return reserveB The tokenB amount.
     */
    function getReserves()
        public
        view
        returns (uint256 reserveA, uint256 reserveB)
    {
        reserveA = _reserveA;
        reserveB = _reserveB;
    }

    /**
     * @dev Helper function to calculate square root of a number
     */
    function sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
