// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

/// @dev Importing openzeppelin stuffs.
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @dev Importing the custom stuffs.
import "./interfaces/IWFTM.sol";
import "./interfaces/ICoinMingleLP.sol";

/// @dev Custom errors.
error PairExists();
error InvalidPath();
error HighSlippage();
error InvalidWFTMPath();
error DeadlinePassed();
error InvalidAddress();
error TokenZeroAmount();
error PairDoesNotExist();
error IdenticalAddress();
error InsufficientAmount();
error ExcessiveLiquidity();
error InsufficientLiquidity();
error InvalidLiquidity();
error InvalidAmount();

contract CoinMingleRouter is Ownable, ReentrancyGuard {
    /// @dev Tracking the Wrapped FTM contract address.
    IWFTM public immutable WrappedFTM;
    /// @dev Tracking the cloneable CoinMingle ERC20.
    address public immutable CoinMingleImplementation;
    /// @dev Tracking the pair address mapping
    mapping(address => mapping(address => address)) public getPair;
    /// @dev Tracking all the pair addresses into list.
    address[] public allPairs;

    /// @dev Modifier to check deadline.
    modifier ensure(uint256 _deadline) {
        /// @dev Revert if caller is not the CoinMingleRouter
        if (_deadline < block.timestamp) revert DeadlinePassed();
        _;
    }

    /**
     * `PairCreated` will be fired when a new pair is created.
     * @param tokenA: The address of the tokenA.
     * @param tokenB: The address of the tokenB.
     * @param pair: The pair address created from tokenA & tokenB.
     */
    event PairCreated(
        address indexed tokenA,
        address indexed tokenB,
        address indexed pair
    );

    /**
     * `LiquidityAdded` will be fired when liquidity added into a pool.
     * @param amountA: The amount of the tokenA.
     * @param amountB: The amount of the tokenB.
     * @param pair: The pair address created from tokenA & tokenB.
     */
    event LiquidityAdded(
        uint256 indexed amountA,
        uint256 indexed amountB,
        address indexed pair
    );

    /**
     * `LiquidityRemoved` will be fired when liquidity removed from a pool.
     * @param amountA: The amount of the tokenA.
     * @param amountB: The amount of the tokenB.
     * @param pair: The pair address created from tokenA & tokenB.
     */
    event LiquidityRemoved(
        uint256 indexed amountA,
        uint256 indexed amountB,
        address indexed pair
    );

    /// @dev Events
    /**
     * @dev event TokensSwapped: will be emitted when tokens swapped
     * @param _to: The person to whom swapped tokens are minted
     * @param tokenIN : Address of the token being swapped
     * @param tokenInAmount : The amount of input token given
     * @param tokenOut : Address of the token user will get after swapped
     * @param tokenOutAmount : The amount of output token received
     */

    event TokensSwapped(
        address indexed _to,
        address indexed tokenIN,
        uint256 tokenInAmount,
        address indexed tokenOut,
        uint256 tokenOutAmount
    );

    /**
     * @dev Fallback function to receive FTM from WrappedFTM contract.
     * Only Receive FTM from Wrapped FTM contract.
     */
    receive() external payable {
        /// @dev Revert if other than WFTM contract sending FTM to this contract.
        if (msg.sender != address(WrappedFTM)) revert InvalidAddress();
    }

    /**
     * @dev Initializing the CoinMingleLP implementation.
     * @param _coinMingleLPImplementation: The deployed CoinMingleLP implementation contract address.
     * @param _wrappedFTM: The deployed wrapped FTM contract address.
     */
    constructor(address _coinMingleLPImplementation, address _wrappedFTM) {
        /// @dev Validations.
        if (
            _coinMingleLPImplementation == address(0) ||
            _wrappedFTM == address(0)
        ) revert InvalidAddress();
        /// @dev Initializing the implementation & WrappedFTM.
        CoinMingleImplementation = _coinMingleLPImplementation;
        WrappedFTM = IWFTM(_wrappedFTM);
    }

    /// @dev Returns the length of the allPairs array length.
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    /**
     * @dev Creating a new pair of tokens (tokenA & tokenB).
     * @param tokenA: The address of tokenA.
     * @param tokenB: The address of tokenB.
     * @return pair The created pair address.
     */
    function createPair(
        address tokenA,
        address tokenB
    ) public nonReentrant returns (address pair) {
        pair = _createPair(tokenA, tokenB);
    }

    /**
     * @dev Adding Liquidity into pool contact.
     * @param _tokenA: The first token address.
     * @param _tokenB: The second token address.
     * @param _amountADesired: The amount of first token should add into liquidity.
     * @param _amountBDesired: The amount of second token should add into liquidity.
     * @param _to: The address to whom CoinMingleLP tokens will mint.
     * @param _deadline: The unix last timestamp to execute the transaction.
     * @return amountA The amount of tokenA added into liquidity.
     * @return amountB The amount of tokenB added into liquidity.
     * @return liquidity The amount of CoinMingleLP token minted.
     */
    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired,
        address _to,
        uint256 _deadline
    )
        external
        nonReentrant
        ensure(_deadline)
        returns (uint256 amountA, uint256 amountB, uint256 liquidity)
    {
        /// @dev Validations.
        if (_tokenA == address(0) || _tokenB == address(0))
            revert InvalidAddress();
        if (_amountADesired == 0 || _amountBDesired == 0)
            revert InsufficientAmount();
        (
            /// @dev Adding liquidity.
            amountA,
            amountB
        ) = _addLiquidity(_tokenA, _tokenB, _amountADesired, _amountBDesired);

        /// @dev Getting the pair address for tokenA & tokenB.
        address pair = getPair[_tokenA][_tokenB];
        /// @dev Transferring both tokens to pair contract.
        IERC20(_tokenA).transferFrom(msg.sender, pair, amountA);
        IERC20(_tokenB).transferFrom(msg.sender, pair, amountB);

        /// @dev Minting the CoinMingleLP tokens.
        liquidity = ICoinMingle(pair).mint(_to);

        /// @dev Emitting event.
        emit LiquidityAdded(amountA, amountB, pair);
    }

    /**
     * @dev Adding Liquidity into pool contact with FTM as pair with address.
     * @param _token: The pair token contract address.
     * @param _amountDesired: The amount of pair token should add into liquidity.
     * @param _to: The address to whom CoinMingleLP tokens will mint.
     * @param _deadline: The unix last timestamp to execute the transaction.
     * @return amountToken The amount of token added into liquidity.
     * @return amountFTM The amount of FTM added into liquidity.
     * @return liquidity The amount of CoinMingleLP token minted.
     */
    function addLiquidityFTM(
        address _token,
        uint256 _amountDesired,
        address _to,
        uint256 _deadline
    )
        external
        payable
        nonReentrant
        ensure(_deadline)
        returns (uint256 amountToken, uint256 amountFTM, uint256 liquidity)
    {
        /// @dev Validations.
        if (_token == address(0)) revert InvalidAddress();
        uint256 _ftmAmountSentByUser = msg.value;
        if (_amountDesired == 0 || _ftmAmountSentByUser == 0)
            revert InsufficientAmount();

        /// @dev Adding liquidity.
        (amountToken, amountFTM) = _addLiquidity(
            _token,
            address(WrappedFTM),
            _amountDesired,
            _ftmAmountSentByUser
        );
        /// @dev Getting the pair address for tokenA & tokenB.
        address pair = getPair[_token][address(WrappedFTM)];
        /// @dev Converting FTM to WrappedFTM.
        WrappedFTM.deposit{value: amountFTM}();
        /// @dev Transferring both tokens to pair contract.
        IERC20(_token).transferFrom(msg.sender, pair, amountToken);
        WrappedFTM.transfer(pair, amountFTM);

        /// @dev Minting the CoinMingleLP tokens.
        liquidity = ICoinMingle(pair).mint(_to);

        /// @dev Refund dust ftm, if any
        if (_ftmAmountSentByUser > amountFTM) {
            (bool success, ) = msg.sender.call{
                value: _ftmAmountSentByUser - amountFTM
            }("");
            require(success);
        }

        /// @dev Emitting event.
        emit LiquidityAdded(amountToken, amountFTM, pair);
    }

    /**
     * @dev Removing Liquidity from the pool contact with FTM as pair with address.
     * @param _tokenA: The first token address.
     * @param _tokenB: The second token address.
     * @param _liquidity: The amount of CoinMingleLP tokens.
     * @param _to: The address to whom CoinMingleLP tokens will mint.
     * @param _deadline: The unix last timestamp to execute the transaction.
     */
    function removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _liquidity,
        address _to,
        uint256 _deadline
    )
        external
        nonReentrant
        ensure(_deadline)
        returns (uint amountA, uint amountB)
    {
        (amountA, amountB) = _removeLiquidity(
            _tokenA,
            _tokenB,
            _liquidity,
            _to
        );
    }

    /**
     * @dev Removing Liquidity from the pool contact with FTM as pair with address.
     * @param _token: The pair token contract address.
     * @param _liquidity: The amount of CoinMingleLP tokens.
     * @param _to: The address to whom CoinMingleLP tokens will mint.
     * @param _deadline: The unix last timestamp to execute the transaction.
     */
    function removeLiquidityFTM(
        address _token,
        uint256 _liquidity,
        address _to,
        uint256 _deadline
    )
        external
        nonReentrant
        ensure(_deadline)
        returns (uint amountToken, uint amountFTM)
    {
        /// @dev First removing liquidity.
        (amountToken, amountFTM) = _removeLiquidity(
            _token,
            address(WrappedFTM),
            _liquidity,
            address(this)
        );

        /// @dev Converting WFTM to FTM.
        WrappedFTM.withdraw(amountFTM);
        /// @dev Sending the amounts to `_to`.
        IERC20(_token).transfer(_to, amountToken);
        (bool success, ) = _to.call{value: amountFTM}("");
        require(success);
    }

    /**
     * @dev Calculate the amount of tokenB required when tokenA is given for swap with tokenB
     * @param _amountIn : The amount of tokenA in at path[0] that a person is swapping for tokenB
     * @param _path: Address array of the two tokens.
     * path[0]= The address of token that will be swapped (input)
     * path[length - 1] = The address of token that will be returned after  swap (output)
     * @return _amountOut : The amount of tokenB received after swapping tokenA
     */

    function getAmountOut(
        uint256 _amountIn,
        address[] calldata _path
    ) public view returns (uint256 _amountOut) {
        /// @dev validating input fields
        if (_amountIn == 0) revert TokenZeroAmount();
        if (_path.length < 2) revert InvalidPath();

        /// @dev Loop though all the paths.
        for (uint256 i; i < (_path.length - 1); i++) {
            /// @dev Getting the pair address based on address of two tokens
            address pair = getPair[_path[i]][_path[i + 1]];
            if (pair == address(0)) revert PairDoesNotExist();

            /// @dev If iterator on first index
            if (i == 0) {
                /// @dev Getting the amountOut from pair based on `_amountIn`.
                _amountOut = ICoinMingle(pair).getAmountOut(
                    _path[i],
                    _amountIn
                );
            } else {
                /// @dev Getting the amountOut from pair based on previous pair `_amountOut`.
                _amountOut = ICoinMingle(pair).getAmountOut(
                    _path[i],
                    _amountOut
                );
            }
        }
    }

    /**
     * @dev Swapping one token for another token.
     * @param _amountIn: The amount of _path[0] token trader wants to swap.
     * @param _amountOutMin: The Minimum amount of token trader expected to get.
     * @param _path: The pair address path. path[0] will be main tokenIn and path[length - 1] will be main output token.
     * @param _to: The address to whom output token will send.
     * @param _deadline: The timestamp till user wait for execution to success.
     */
    function swapTokensForTokens(
        uint256 _amountIn,
        uint256 _amountOutMin,
        address[] calldata _path,
        address _to,
        uint256 _deadline
    ) external nonReentrant ensure(_deadline) returns (uint256 _amountOut) {
        _amountOut = _swapTokensForTokens(_amountIn, _amountOutMin, _path, _to);
    }

    /**
     * @dev Swapping FTM for another token.
     * @param _amountOutMin: The Minimum amount of token trader expected to get.
     * @param _path: The pair address path. Path[0] will be WETH and Path[length - 1] will be main output token.
     * @param _to: The address to whom output token will send.
     * @param _deadline: The timestamp till user wait for execution to success.
     */
    function swapFTMForTokens(
        uint256 _amountOutMin,
        address[] calldata _path,
        address _to,
        uint256 _deadline
    )
        external
        payable
        nonReentrant
        ensure(_deadline)
        returns (uint256 _amountOut)
    {
        /// @dev Checking if the first address is WFTM.
        if (_path[0] != address(WrappedFTM)) revert InvalidWFTMPath();

        /// @dev Converting FTM to WrappedFTM.
        uint256 _amountIn = msg.value;
        WrappedFTM.deposit{value: _amountIn}();

        /// Swapping.
        _amountOut = _swapTokensForTokens(_amountIn, _amountOutMin, _path, _to);
    }

    /**
     * @dev Swapping tokens for FTM.
     * @param _amountIn: The amount of _path[0] token trader wants to swap.
     * @param _amountOutMin: The Minimum amount of token trader expected to get.
     * @param _path: The pair address path. Path[0] will be WETH and Path[length - 1] will be main output token.
     * @param _to: The address to whom output token will send.
     * @param _deadline: The timestamp till user wait for execution.
     */
    function swapTokensForFTM(
        uint256 _amountIn,
        uint256 _amountOutMin,
        address[] calldata _path,
        address _to,
        uint256 _deadline
    ) external nonReentrant ensure(_deadline) returns (uint256 _amountOut) {
        /// @dev Checking if the last address is WFTM.
        if (_path[_path.length - 1] != address(WrappedFTM))
            revert InvalidWFTMPath();

        /// Swapping.
        _amountOut = _swapTokensForTokens(
            _amountIn,
            _amountOutMin,
            _path,
            address(this)
        );

        /// @dev Converting WrappedFTM to FTM.
        WrappedFTM.withdraw(_amountOut);

        (bool success, ) = _to.call{value: _amountOut}("");
        require(success);
    }

    /**
     * @dev To get an estimate how many tokenA and TokenB will be received when particular amount of liquidity is removed.
     * @param _liquidity: The amount of liquidity being removed.
     * @param _tokenA: The Address of tokenA.
     * @param _tokenB: The Address of tokenB.
     * @return _amountA : The amount of tokenA received after removing _liquidity amount of liquidity
     * @return _amountB : The amount of tokenB received after removing _liquidity amount of liquidity
     */

    function getAmountsOutForLiquidity(
        uint256 _liquidity,
        address _tokenA,
        address _tokenB
    ) external view returns (uint256 _amountA, uint256 _amountB) {
        /// @dev returning if 0 liquidity is passed as input parameter
        if (_liquidity == 0) return (_amountA, _amountB);

        /// @dev getting the pair based on addresses of two tokens
        address pair = getPair[_tokenA][_tokenB];

        /// @dev validating if pair address exist
        if (pair == address(0)) revert PairDoesNotExist();

        /// @dev getting totalSupply ( Save gas)
        uint256 _totalSupply = ICoinMingle(pair).totalSupply();

        /// @dev validation liquidity entered should be less than equal to total Supply
        if (_liquidity > _totalSupply) revert InvalidLiquidity();

        /// @dev getting both tokens reserves
        (uint256 _reserveA, uint256 _reserveB) = ICoinMingle(pair)
            .getReserves();

        /// @dev Calculating both tokens amounts
        _amountA = (_liquidity * _reserveA) / _totalSupply;
        _amountB = (_liquidity * _reserveB) / _totalSupply;
    }

    /**
     * @dev To get an estimate how many tokenOut required to add liquidity when certain amount of tokenIn added.
     * @param _tokenInAddress: The address of tokenIn ( the token whose amount is entered)
     * @param _tokenOutAddress: The Address of tokenOut (the token whose amount is to obtain)
     * @param _tokenInAmount: The amount of tokenIn
     * @return _tokenOutAmount : The amount of tokenOut required based on amount of tokenIn.
     */

    function getTokenInFor(
        address _tokenInAddress,
        address _tokenOutAddress,
        uint256 _tokenInAmount
    ) public view returns (uint256 _tokenOutAmount) {
        /// @dev Validating 0 amount
        if (_tokenInAmount == 0) revert InvalidAmount();

        /// @dev getting and validating pair
        address pair = getPair[_tokenInAddress][_tokenOutAddress];
        if (pair == address(0)) revert PairDoesNotExist();

        /// @dev initializing LP instance
        ICoinMingle _coinMingle = ICoinMingle(pair);

        /// @dev getting reserves
        (uint256 _reserveA, uint256 _reserveB) = _coinMingle.getReserves();

        /// @dev Calculating tokenOut amount
        if (_coinMingle.tokenA() == _tokenInAddress) {
            _tokenOutAmount = (_tokenInAmount * _reserveB) / _reserveA;
        } else {
            _tokenOutAmount = (_tokenInAmount * _reserveA) / _reserveB;
        }
    }

    /**
     * @dev Creating a new pair of tokens (tokenA & tokenB).
     * @param tokenA: The address of tokenA.
     * @param tokenB: The address of tokenB.
     * @return pair The created pair address.
     */
    function _createPair(
        address tokenA,
        address tokenB
    ) private returns (address pair) {
        /// @dev Validations.
        if (tokenA == tokenB) revert IdenticalAddress();
        if (tokenA == address(0) || tokenB == address(0))
            revert InvalidAddress();
        if (getPair[tokenA][tokenB] != address(0)) revert PairExists();

        /// @dev Cloning the CoinMingleLP contract.
        bytes32 salt = keccak256(abi.encodePacked(tokenA, tokenB));
        pair = Clones.cloneDeterministic(CoinMingleImplementation, salt);

        /// @dev Initializing the CoinMingleLP contact.
        ICoinMingle(pair).initialize(tokenA, tokenB);

        /// @dev Updating the mapping.
        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair;
        /// @dev Adding the pair into list.
        allPairs.push(pair);
        /// @dev Emitting event.
        emit PairCreated(tokenA, tokenB, pair);
    }

    /**
     * @dev Adding Liquidity into pool contact.
     * @param _tokenA: The first token address.
     * @param _tokenB: The second token address.
     * @param _amountADesired: The amount of first token should add into liquidity.
     * @param _amountBDesired: The amount of second token should add into liquidity.
     * @return amountA The amount of tokenA added into liquidity.
     * @return amountB The amount of tokenB added into Liquidity.
     */
    function _addLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired
    ) private returns (uint256 amountA, uint256 amountB) {
        /// @dev Getting the pair for this two tokens.
        address pair = getPair[_tokenA][_tokenB];
        /// @dev If no Pair exists for these two tokens then create one.
        if (pair == address(0)) {
            pair = _createPair(_tokenA, _tokenB);
        }
        /// @dev Getting the initial reserves.
        (uint256 reserveA, uint256 reserveB) = ICoinMingle(pair).getReserves();

        /// @dev If both reserves are 0 then total amount will be added.
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (_amountADesired, _amountBDesired);
        }
        /// @dev Else checking the correct amount given.
        else {
            uint256 amountBOptimal = getTokenInFor(
                _tokenA,
                _tokenB,
                _amountADesired
            );
            // Checking if the desired amount of token B is less than or equal to the optimal amount
            if (amountBOptimal <= _amountBDesired) {
                if (amountBOptimal == 0) revert InsufficientLiquidity();
                /// @dev Returns the actual amount will be added into liquidity.
                (amountA, amountB) = (_amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = getTokenInFor(
                    _tokenB,
                    _tokenA,
                    _amountBDesired
                );

                if (amountAOptimal == 0) revert InsufficientLiquidity();
                if (amountAOptimal > _amountADesired)
                    revert ExcessiveLiquidity();
                /// @dev Returns the actual amount will be added into liquidity.
                (amountA, amountB) = (amountAOptimal, _amountBDesired);
            }
        }
    }

    /**
     * @dev Removing Liquidity from the pool contact with FTM as pair with address.
     * @param _tokenA: The first token address.
     * @param _tokenB: The second token address.
     * @param _liquidity: The amount of CoinMingleLP tokens.
     * @param _to: The address to whom CoinMingleLP tokens will mint.
     */
    function _removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _liquidity,
        address _to
    ) private returns (uint amountA, uint amountB) {
        /// @dev Validations.
        if (_liquidity == 0) revert InsufficientLiquidity();

        /// @dev Getting the pair address for tokenA & tokenB.
        address pair = getPair[_tokenA][_tokenB];
        if (pair == address(0)) revert PairDoesNotExist();
        /// @dev Sending CoinMingleLP tokens to CoinMingleLP contract.
        ICoinMingle(pair).transferFrom(msg.sender, pair, _liquidity);
        /// @dev Burning tokens and remove liquidity.
        (amountA, amountB) = ICoinMingle(pair).burn(_to);

        /// @dev Emitting event.
        emit LiquidityRemoved(amountA, amountB, pair);
    }

    /**
     * @dev Swapping one token from another token.
     * @param _amountIn: The amount of _path[0] token trader wants to swap.
     * @param _amountOutMin: The Minimum amount of token trader expected to get.
     * @param _path: The pair address path. Path[0] will be main tokenIn and Path[length - 1] will be main output token.
     * @param _to: The address to whom output token will send.
     */
    function _swapTokensForTokens(
        uint256 _amountIn,
        uint256 _amountOutMin,
        address[] calldata _path,
        address _to
    ) private returns (uint256 _amountOut) {
        /// @dev Token validation
        if (_path.length < 2) revert InvalidPath();
        if (_to == address(0)) revert InvalidAddress();

        /// @dev Loop through all the paths and swapping in each pair
        for (uint256 i; i < (_path.length - 1); i++) {
            /// @dev Getting the pair
            address pair = getPair[_path[i]][_path[i + 1]];
            if (pair == address(0)) revert PairDoesNotExist();

            /// @dev If iterator on first index
            if (i == 0) {
                if (_path[i] == address(WrappedFTM)) {
                    IERC20(_path[i]).transfer(pair, _amountIn);
                    _amountOut = ICoinMingle(pair).swap(address(this));
                } else {
                    /// @dev Then transfer from trader to first pair.
                    IERC20(_path[i]).transferFrom(msg.sender, pair, _amountIn);
                    _amountOut = ICoinMingle(pair).swap(address(this));
                }
            } else {
                /// @dev Then transfer from CoinMingleRouter to next pair.
                IERC20(_path[i]).transfer(pair, _amountOut);
                _amountOut = ICoinMingle(pair).swap(address(this));
            }
        }
        /// @dev Minimum tokenOut validation.
        if (_amountOut < _amountOutMin) revert HighSlippage();

        /// @dev Transferring the amountOut of path[_path.length-1] token.
        if (_to != address(this)) {
            IERC20(_path[_path.length - 1]).transfer(_to, _amountOut);
        }

        emit TokensSwapped(
            _to,
            _path[0],
            _amountIn,
            _path[_path.length - 1],
            _amountOut
        );
    }
}
