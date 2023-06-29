# CoinMingleRouter

**CoinMingle** - the ultimate decentralized platform powered by the FANTOM blockchain. With its cutting-edge **Automated Market Maker (AMM)** smart contract, **CoinMingle** empowers users to effortlessly create their own ERC20 tokens, seamlessly swap tokens, boost liquidity, and withdraw liquidity.

## Prerequisites

Make sure you have the following dependencies installed in your project:

- Solidity version 0.8.10
- OpenZeppelin Contracts library

## Usage

To use the CoinMingleRouter, follow the steps below:

1. rename `.env.example` file to `.env` and paste your `FTMSCAN_API` and `DEPLOYER_PRIVATE_KEY`

2. Deploy the contract by compiling and deploying the Solidity code using a hardhat by running `scripts/deploy.ts` file.

3. Once deployed, you can interact with the contract by calling its functions with the required parameters.

## Functions

### `WrappedFTM`

This function allows you to get the Wrapped FTM contract address.

### `CoinMingleImplementation`

This function allows you to get the actual cloneable pair contract address.

### `getPair`

This function allows you to get the pair address as per `tokenA` and `tokenB` address.

#### Parameters

- `address`: The address of the first pair token.
- `address`: The address of the second pair token.

#### Returns

- `address`: The pair address based on first and second pair token.

### `allPairs`

This function allows you to get the pair address as per index.

#### Parameters

- `index`: The array index.

#### Returns

- `address`: The pair address based on the index.

### `allPairsLength`

This function allows you to get the no of pairs available in the router.

### `createPair`

This function allows you to create a pair between two ERC20 tokens.

#### Parameters

- `tokenA`: The address of first token.
- `tokenB`: The address of second token.

#### Returns

- `address`: The newly created pair address as per `tokenA` and `tokenB`.

### `addLiquidity`

This function allows you to provide liquidity for a **ERC20/ERC20** token pair. If no pair available for these two token, then it will create pair first.

#### Parameters

- `_tokenA`: The first token address.
- `_tokenB`: The second token address.
- `_amountADesired`: The amount of first token to add to liquidity.
- `_amountBDesired`: The amount of second token to add to liquidity.
- `_to`: The address to whom CoinMingleLP tokens will be minted.
- `_deadline`: The deadline for executing the transaction.

#### Returns

- `amountA`: The amount of tokenA added to liquidity.
- `amountB`: The amount of tokenB added to liquidity.
- `liquidity`: The amount of CoinMingleLP tokens minted.

### `addLiquidityFTM`

This function allows you to provide liquidity for a **FTM/ERC20** token pair. If no pair available for these two token, then it will create pair first between WFTM/ERC20.

#### Parameters

- `_token`: The pair token contract address.
- `_amountDesired`: The amount of pair token to add to liquidity.
- `_to`: The address to whom CoinMingleLP tokens will be minted.
- `_deadline`: The deadline for executing the transaction.

#### Returns

- `amountToken`: The amount of token added to liquidity.
- `amountFTM`: The amount of FTM added to liquidity.
- `liquidity`: The amount of CoinMingleLP tokens minted.

### `removeLiquidity`

This function allows you to remove liquidity for a **ERC20/ERC20** token pair.

#### Parameters

- `_tokenA`: The first token address.
- `_tokenB`: The second token address.
- `_liquidity`: The amount of **CoinMingleLP** tokens to remove.
- `_to`: The address to whom the tokens will be transferred.
- `_deadline`: The deadline for executing the transaction.

#### Returns

- `amountA`: The amount of **tokenA** received.
- `amountB`: The amount of **tokenB** received.

### `removeLiquidityFTM`

This function allows you to remove liquidity for a **FTM/ERC20** token pair and vice-versa.

#### Parameters

- `_token`: The pair token contract address.
- `_liquidity`: The amount of **CoinMingleLP** tokens to remove.
- `_to`: The address to whom the tokens will be transferred.
- `_deadline`: The deadline for executing the transaction.

#### Returns

- `amountToken`: The amount of token received.
- `amountFTM`: The amount of FTM received.

### `swapTokensForTokens`

This function allows you to swap tokens for an amount of input tokens.

#### Parameters

- `_amountIn`: The amount of \_path[0] token trader wants to swap.
- `_amountOutMin`: The Minimum amount of token trader expected to get.
- `_path`: The pair address path. path[0] will be main tokenIn and path[length - 1] will be main output token.
- `_to`: The address to whom output token will send.
- `_deadline`: The timestamp till user wait for execution to success.

#### Returns

- `_amountOut`: The amount of token received on the behalf of `_amountIn`.

### `swapFTMForTokens`

This function allows you to swap ERC20 for an amount of input FTM.

#### Parameters

- `_amountOutMin`: The Minimum amount of token trader expected to get.
- `_path`: The pair address path. The pair address path. Path[0] should be WETH and Path[length - 1] will be main output token.
- `_to`: The address to whom output token will send.
- `_deadline`: The timestamp till user wait for execution to success.

#### Returns

- `_amountOut`: The amount of token received on the behalf of `msg.value`.

### `swapTokensForFTM`

This function allows you to swap FTM for an amount of input ERC20 token.

#### Parameters

- `_amountIn`: The amount of \_path[0] token trader wants to swap.
- `_amountOutMin`: The Minimum amount of token trader expected to get.
- `_path`: The pair address path. Path[0] will be tokenIn and Path[length - 1] will be main output token (WFTM).
- `_to`: The address to whom output token will send.
- `_deadline`: The timestamp till user wait for execution to success.

#### Returns

- `_amountOut`: The amount of token received on the behalf of `_amountIn`.

### `getAmountsOutForLiquidity`

This function allows you to get the estimated `tokenA` and `tokenB` output as per liquidity amount.

#### Parameters

- `_liquidity`: The amount of liquidity being removed.
- `_tokenA`: The Address of tokenA.
- `_tokenB`: The Address of tokenB.

#### Returns

- `_amountA` : The amount of tokenA received after removing `_liquidity` amount of liquidity.
- `_amountB` : The amount of tokenB received after removing `_liquidity` amount of liquidity.

### `getTokenInFor`

This function allows you to get the estimated `tokenA` and `tokenB` needed to add liquidity.

#### Parameters

- `_tokenInAddress`: The address of tokenIn ( the token whose amount is entered)
- `_tokenOutAddress`: The Address of tokenOut (the token whose amount is to obtain)
- `_tokenInAmount`: The amount of tokenIn

#### Returns

- `_tokenOutAmount` : The amount of tokenOut required based on amount of `tokenIn`.
