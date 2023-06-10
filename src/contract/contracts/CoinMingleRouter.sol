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
error InvalidRatio();
error DeadlinePassed();
error InvalidAddress();
error IdenticalAddress();
error InsufficientAmount();
error ExcessiveLiquidity();
error InsufficientLiquidity();
error TokenZeroAmount();
error InvalidPath();
error PairDoesNotExist();
error InsufficientPoolAmount();
error HighSlippage();

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
        if (_amountDesired == 0 || msg.value == 0) revert InsufficientAmount();

        /// @dev Adding liquidity.
        (amountToken, amountFTM) = _addLiquidity(
            _token,
            address(WrappedFTM),
            _amountDesired,
            msg.value
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
        if (msg.value > amountFTM) {
            (bool success, ) = msg.sender.call{value: msg.value - amountFTM}(
                ""
            );
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
        public
        nonReentrant
        ensure(_deadline)
        returns (uint amountA, uint amountB)
    {
        (amountA, amountB) = _removeLiquidity(
            _tokenA,
            _tokenB,
            _liquidity,
            _to,
            _deadline
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
            address(this),
            _deadline
        );

        /// @dev Converting WFTM to FTM.
        WrappedFTM.withdraw(amountFTM);
        /// @dev Sending the amounts to `_to`.
        IERC20(_token).transfer(_to, amountToken);
        (bool success, ) = _to.call{value: amountFTM}("");
        require(success);
    }

    /**
     * @dev Function to calculate the amount of tokenB required when tokenA is given for swap with tokenB
     * @param _tokenAAmount : The amount of tokenA in at path[0] that a person is swapping for tokenB
     * @param _path: Address array of the two tokens. path[0]= The address of token that will be swapped (input) path[1] = The address of token that will be returned after  swap (output)
     * @return _tokenBAmount : The amount of tokenB received after swapping tokenA
     */

    function getAmountOut(
        uint256 _tokenAAmount,
        address[] memory _path
    ) public view returns (uint256 _tokenBAmount) {
        /// @dev validating input fields
        if (_tokenAAmount == 0) revert TokenZeroAmount();
        if (_path.length != 2) revert InvalidPath();

        /// @dev getting the pair address based on address of two tokens
        address pair = getPair[_path[0]][_path[1]];
        if (pair == address(0)) revert PairDoesNotExist();

        /// @dev getting the reserves of two tokens in pool
        uint256 _reserveA;
        uint256 _reserveB;
        (_reserveA, _reserveB) = ICoinMingle(pair).getReserves();

        /// @dev calculating tokenB based on tokenA using p*q=k

        uint256 tokenAAfter = _reserveA + _tokenAAmount;
        uint256 tokenBAfter = (_reserveA * _reserveB) / tokenAAfter;

        _tokenBAmount = _reserveB - tokenBAfter;

        /// @dev We cannot make the amount of tokenB zero in the pool
        if (_tokenBAmount == _reserveB) _tokenBAmount--;
    }

    /**
     * @dev Function to calculate the amount of input token required when output tokens are given
     * @param _tokenBAmount : The amount of tokenB required
     * @param _path: Address array of the two tokens. path[0]= The address of token that will be swapped (input) path[1] = The address of token that will be returned after  swap (output)
     * @return _tokenAAmount : The amount of tokenA required to get input amount of B
     */

    function getAmountIn(
        uint256 _tokenBAmount,
        address[] memory _path
    ) public view returns (uint256 _tokenAAmount) {
        /// @dev validating input fields
        if (_tokenBAmount == 0) revert TokenZeroAmount();
        if (_path.length != 2) revert InvalidPath();

        /// @dev getting the pair address based on address of two tokens
        address pair = getPair[_path[0]][_path[1]];
        if (pair == address(0)) revert PairDoesNotExist();

        /// @dev getting the reserves of two tokens in pool
        uint256 _reserveA;
        uint256 _reserveB;
        (_reserveA, _reserveB) = ICoinMingle(pair).getReserves();

        /// @dev Checking the pool have more tokenB as required by the user
        if (_tokenBAmount >= _reserveB) revert InsufficientPoolAmount();

        /// @dev calculating tokenA required to get input amout of tokenB based on p*q=k

        uint256 tokenBAfter = _reserveB - _tokenBAmount;
        uint256 tokenAafter = (_reserveA * _reserveB) / tokenBAfter;
        _tokenAAmount = tokenAafter - _reserveA;
    }

    function swapExactTokensForTokens(
        uint256 _amountIn,
        uint256 _amountOutMin,
        address[] calldata _path,
        address _to,
        uint256 _deadline
    ) external nonReentrant ensure(deadline) returns (uint256 _amountOut) {
        if (_to == address(0)) revert InvalidAddress();
        _amountOut = getAmountOut(_amountIn, _path);

        if (_amountOut < _amountOutMin) revert HighSlippage();

        address pair = getPair[_path[0]][_path[1]];

        IERC20(_path[0]).transferFrom(msg.sender, pair, _amountIn);
        _swap(_amountIn, amountOut, to);
        ICoinMingle(pair).swap(_amountIn, amountOut, _to);
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
            uint256 amountBOptimal = (_amountADesired * reserveB) / reserveA;
            // Checking if the desired amount of token B is less than or equal to the optimal amount
            if (amountBOptimal <= _amountBDesired) {
                if (amountBOptimal == 0) revert InsufficientLiquidity();
                /// @dev Returns the actual amount will be added into liquidity.
                (amountA, amountB) = (_amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = (_amountBDesired * reserveA) /
                    reserveB;

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
     * @param _deadline: The unix last timestamp to execute the transaction.
     */
    function _removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _liquidity,
        address _to,
        uint256 _deadline
    ) private ensure(_deadline) returns (uint amountA, uint amountB) {
        /// @dev Validations.
        if (_liquidity == 0) revert InsufficientLiquidity();

        /// @dev Getting the pair address for tokenA & tokenB.
        address pair = getPair[_tokenA][_tokenB];
        /// @dev Sending CoinMingleLP tokens to CoinMingleLP contract.
        ICoinMingle(pair).transferFrom(msg.sender, pair, _liquidity);
        /// @dev Burning tokens and remove liquidity.
        (amountA, amountB) = ICoinMingle(pair).burn(_to);

        /// @dev Emitting event.
        emit LiquidityRemoved(amountA, amountB, pair);
    }
}
