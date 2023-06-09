// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

/// @dev Importing openzeppelin stuffs.
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Custom errors.
error InvalidAddress();
error TotalSupplyZero();
error IncorrectStringValues();
error DecimalsGreaterThan18();
error AmountShouldNotBeZero();

contract Token is ERC20, Ownable {
    /// @dev Overriding decimals as per user defined.
    uint8 private immutable __decimals;

    /**
     * @dev Checking the parameters and mint the initial supply
     * @param _name: The name of this token.
     * @param _symbol: The symbol of this token.
     * @param _decimals: The decimals of this token.
     * @param _totalSupply: The initial supply of the token.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalSupply
    ) ERC20(_name, _symbol) {
        /// @dev Validating parameters.
        _validateParams(_name, _symbol, _decimals, _totalSupply);

        /// @dev Initializing the user defined decimals.
        __decimals = _decimals;
        /// @dev Minting the initial supply to deployer.
        _mint(msg.sender, _totalSupply * (10 ** _decimals));
    }

    /**
     * @dev Minting a certain amount to an address.
     * Required: OnlyOwner
     * @param _to: The address to whom this token will mint.
     * @param _amount: The amount of token will mint.
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        /// @dev Parameters checking.
        if (_to == address(0)) revert InvalidAddress();
        if (_amount == 0) revert AmountShouldNotBeZero();

        /// @dev Minting the amount to `to`.
        _mint(_to, _amount);
    }

    /**
     * @dev Burning a certain amount from an address.
     * Required: OnlyOwner
     * @param _from: The address from whom this token will burn.
     * @param _amount: The amount of token will burn.
     */
    function burn(address _from, uint256 _amount) external onlyOwner {
        /// @dev Parameters checking.
        if (_from == address(0)) revert InvalidAddress();
        if (_amount == 0) revert AmountShouldNotBeZero();

        /// @dev Minting the amount to `to`.
        _burn(_from, _amount);
    }

    /**
     * @dev Overriding the ERC20 decimals with user defined decimals.
     * @return The user defined token decimals.
     */
    function decimals() public view override returns (uint8) {
        return __decimals;
    }

    /**
     * @dev Helper function to check if the given string is an empty string.
     * @param _string: The string you want to check.
     * @return True/False as per string length.
     */
    function _isValidString(string memory _string) private pure returns (bool) {
        return bytes(_string).length > 0;
    }

    /**
     * @dev helper function to check if the given parameters are valid.
     * @param _name: The name of this token.
     * @param _symbol: The symbol of this token.
     * @param _decimals: The decimals of this token.
     * @param _totalSupply: The initial supply of the token.
     */
    function _validateParams(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _totalSupply
    ) private pure {
        /// @dev Revert if `_name` & `_symbol` is an empty string.
        if (!_isValidString(_name) || !_isValidString(_symbol))
            revert IncorrectStringValues();
        /// @dev Revert if the given token decimals greater than 18.
        if (_decimals > 18) revert DecimalsGreaterThan18();
        /// @dev Revert if the initial supply is 0.
        if (_totalSupply == 0) revert TotalSupplyZero();
    }
}
