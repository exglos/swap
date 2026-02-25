import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Actions, V4Planner } from '@uniswap/v4-sdk';
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk';
import { UNIVERSAL_ROUTER_ADDRESS, UNIVERSAL_ROUTER_ABI, V4_STATE_VIEW_ADDRESS, V4_STATE_VIEW_ABI } from './constants';

/**
 * V4 Multi-Hop Swap Helper
 * 
 * Handles complex multi-hop swaps through Universal Router with V4Planner.
 * Supports routing through multiple pools for better prices and liquidity.
 */

interface PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}

interface V4MultiHopParams {
  tokens: Token[];
  fees: number[];
  amountIn: string;
  amountOutMinimum: string;
  recipient: string;
  isBuying: boolean;
}

/**
 * Execute a multi-hop V4 swap through Universal Router
 * 
 * Example: ETH → USDC → DAI (2 hops)
 * - tokens: [ETH, USDC, DAI]
 * - fees: [500, 100] (0.05% for ETH→USDC, 0.01% for USDC→DAI)
 */
export async function executeV4MultiHopSwap(
  params: V4MultiHopParams,
  signer: ethers.Signer
): Promise<ethers.ContractTransaction> {
  const {
    tokens,
    fees,
    amountIn,
    amountOutMinimum,
    recipient,
    isBuying,
  } = params;

  // Validate multi-hop parameters
  if (tokens.length < 2) {
    throw new Error('Multi-hop swap requires at least 2 tokens');
  }
  if (fees.length !== tokens.length - 1) {
    throw new Error('Fees array must have length = tokens.length - 1');
  }

  // Calculate deadline (20 minutes from now)
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  // Parse amounts
  const amountInWei = ethers.utils.parseUnits(amountIn, tokens[0].decimals);
  const amountOutMinWei = ethers.utils.parseUnits(amountOutMinimum, tokens[tokens.length - 1].decimals);

  // Create V4Planner instance
  const v4Planner = new V4Planner();

  // Build multi-hop path
  for (let i = 0; i < tokens.length - 1; i++) {
    const tokenIn = tokens[i];
    const tokenOut = tokens[i + 1];
    const fee = fees[i];

    // Create PoolKey for this hop
    const poolKey: PoolKey = {
      currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
      currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
      fee,
      tickSpacing: 60,
      hooks: ethers.constants.AddressZero,
    };

    const zeroForOne = tokenIn.address < tokenOut.address;

    // For first hop, use exact input amount
    // For subsequent hops, use output from previous hop
    const isFirstHop = i === 0;
    const isLastHop = i === tokens.length - 2;

    if (isFirstHop) {
      // First hop: exact input
      const swapConfig = {
        poolKey,
        zeroForOne,
        amountIn: amountInWei.toString(),
        amountOutMinimum: '0', // Intermediate hops don't need minimum
        hookData: '0x00',
      };
      v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);
    } else {
      // Subsequent hops: use output from previous
      const swapConfig = {
        poolKey,
        zeroForOne,
        amountIn: '0', // Will use output from previous hop
        amountOutMinimum: isLastHop ? amountOutMinWei.toString() : '0',
        hookData: '0x00',
      };
      v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapConfig]);
    }
  }

  // Add SETTLE for first token
  v4Planner.addAction(Actions.SETTLE_ALL, [tokens[0].address, amountInWei.toString()]);

  // Add TAKE for last token
  v4Planner.addAction(Actions.TAKE_ALL, [tokens[tokens.length - 1].address, amountOutMinWei.toString()]);

  // Finalize V4 plan
  const encodedV4Actions = v4Planner.finalize();

  // Create RoutePlanner for Universal Router
  const routePlanner = new RoutePlanner();
  routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions]);

  // Create Universal Router contract instance
  const universalRouter = new ethers.Contract(
    UNIVERSAL_ROUTER_ADDRESS,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  // Handle token approval for non-ETH swaps
  if (!isBuying) {
    const tokenContract = new ethers.Contract(
      tokens[0].address,
      [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function approve(address spender, uint256 amount) returns (bool)',
      ],
      signer
    );

    const allowance = await tokenContract.allowance(recipient, UNIVERSAL_ROUTER_ADDRESS);
    
    if (allowance < amountInWei) {
      const approveTx = await tokenContract.approve(UNIVERSAL_ROUTER_ADDRESS, amountInWei);
      await approveTx.wait();
    }
  }

  // Execute multi-hop swap through Universal Router
  const tx = await universalRouter.execute(
    routePlanner.commands,
    routePlanner.inputs,
    deadline,
    {
      value: isBuying ? amountInWei : 0,
    }
  );

  return tx;
}

/**
 * Encode V4 multi-hop path
 * 
 * Creates the path encoding for multi-hop swaps
 */
export function encodeV4MultiHopPath(
  tokens: Token[],
  fees: number[]
): { path: string; poolKeys: PoolKey[] } {
  if (tokens.length !== fees.length + 1) {
    throw new Error('Invalid path: tokens length must be fees length + 1');
  }

  const poolKeys: PoolKey[] = [];
  const pathSegments: string[] = [];

  for (let i = 0; i < fees.length; i++) {
    const tokenIn = tokens[i];
    const tokenOut = tokens[i + 1];
    const fee = fees[i];

    const poolKey: PoolKey = {
      currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
      currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
      fee,
      tickSpacing: 60,
      hooks: ethers.constants.AddressZero,
    };

    poolKeys.push(poolKey);
    pathSegments.push(tokenIn.address, fee.toString());
  }
  pathSegments.push(tokens[tokens.length - 1].address);

  return {
    path: pathSegments.join(' → '),
    poolKeys,
  };
}

/**
 * Calculate expected output for multi-hop swap
 * 
 * Estimates the output amount by querying each pool in the path
 */
export async function quoteV4MultiHop(
  tokens: Token[],
  fees: number[],
  amountIn: string,
  provider: ethers.providers.Provider
): Promise<string> {
  if (tokens.length < 2 || fees.length !== tokens.length - 1) {
    throw new Error('Invalid multi-hop path configuration');
  }

  const stateView = new ethers.Contract(
    V4_STATE_VIEW_ADDRESS,
    V4_STATE_VIEW_ABI,
    provider
  );

  let currentAmount = ethers.utils.parseUnits(amountIn, tokens[0].decimals);

  // Calculate output for each hop in the path
  for (let i = 0; i < tokens.length - 1; i++) {
    const tokenIn = tokens[i];
    const tokenOut = tokens[i + 1];
    const fee = fees[i];

    // Create pool key hash for this hop
    const poolKey = ethers.utils.keccak256(ethers.utils.solidityPack(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [
        tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
        tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
        fee,
        60, // tick spacing
        ethers.constants.AddressZero, // no hooks
      ]
    ));

    try {
      // Get pool state from StateView
      const slot0 = await stateView.getSlot0(poolKey);
      const sqrtPriceX96 = slot0[0];

      // Calculate price from sqrtPriceX96
      const price = (Number(sqrtPriceX96) / (2 ** 96)) ** 2;

      // Calculate output for this hop
      const currentAmountFloat = Number(ethers.utils.formatUnits(currentAmount, tokenIn.decimals));
      const zeroForOne = tokenIn.address < tokenOut.address;
      
      const outputAmount = zeroForOne 
        ? currentAmountFloat * price 
        : currentAmountFloat / price;

      // Update current amount for next hop
      currentAmount = ethers.utils.parseUnits(outputAmount.toFixed(tokenOut.decimals), tokenOut.decimals);
    } catch (error) {
      console.error(`Error querying pool for hop ${i}:`, error);
      return '0';
    }
  }

  // Return final output amount
  return ethers.utils.formatUnits(currentAmount, tokens[tokens.length - 1].decimals);
}
