import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { Actions, V4Planner } from '@uniswap/v4-sdk';
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk';
import {
  UNIVERSAL_ROUTER_ADDRESS,
  UNIVERSAL_ROUTER_ABI,
  V4_STATE_VIEW_ADDRESS,
  V4_STATE_VIEW_ABI,
  V4_POOL_MANAGER_ADDRESS,
} from './constants';
import {
  calculateFeeGrowthInside,
  calculateTokensOwed,
  getTokenAmountsFromLiquidity,
  getSqrtRatioAtTick,
  calculateDynamicSlippage,
} from './v4Math';
import {
  simulateTransaction,
  checkAndApproveToken,
  calculateSafeDeadline,
  validateTransactionParams,
  retryTransaction,
} from './v4Security';

/**
 * Production-Ready V4 Position Manager
 * 
 * Implements robust position management with:
 * - Accurate Q128 fee growth calculations
 * - Transaction simulation and error handling
 * - Permit2 integration support
 * - Dynamic slippage protection
 * - Retry logic with exponential backoff
 * - Real position data queries
 */

export interface PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}

export interface V4Position {
  positionId: string;
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  token0Amount: string;
  token1Amount: string;
  feesOwed0: string;
  feesOwed1: string;
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
}

export interface MintPositionParams {
  token0: Token;
  token1: Token;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: string;
  amount1Desired: string;
  amount0Min: string;
  amount1Min: string;
  recipient: string;
  slippageBps?: number;
  deadlineMinutes?: number;
}

/**
 * V4 Pool Manager ABI for position queries
 */
const POSITION_MANAGER_ABI = [
  'function getPosition(bytes32 poolId, address owner, int24 tickLower, int24 tickUpper) view returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128)',
  'function getFeeGrowthGlobals(bytes32 poolId) view returns (uint256 feeGrowthGlobal0X128, uint256 feeGrowthGlobal1X128)',
];

/**
 * Get complete position data with accurate fee calculations
 * All data queried from contracts
 */
export async function getV4Position(
  positionId: string,
  poolKey: PoolKey,
  owner: string,
  tickLower: number,
  tickUpper: number,
  provider: ethers.providers.Provider
): Promise<V4Position | null> {
  try {
    const stateView = new ethers.Contract(
      V4_STATE_VIEW_ADDRESS,
      V4_STATE_VIEW_ABI,
      provider
    );

    const poolManager = new ethers.Contract(
      V4_POOL_MANAGER_ADDRESS,
      POSITION_MANAGER_ABI,
      provider
    );

    // Create pool ID from pool key
    const poolId = ethers.utils.keccak256(ethers.utils.solidityPack(['address', 'address', 'uint24', 'int24', 'address'], [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]));

    // Query all data in parallel for efficiency
    const [slot0, tickLowerInfo, tickUpperInfo, positionData, feeGrowthGlobals] = await Promise.all([
      stateView.getSlot0(poolId),
      stateView.getTickInfo(poolId, tickLower),
      stateView.getTickInfo(poolId, tickUpper),
      poolManager.getPosition(poolId, owner, tickLower, tickUpper),
      poolManager.getFeeGrowthGlobals(poolId),
    ]);

    const sqrtPriceX96 = slot0[0];
    const currentTick = Number(slot0[1]);

    // Extract position data from contract
    const positionLiquidity = positionData[0];
    const feeGrowthInside0LastX128 = positionData[1];
    const feeGrowthInside1LastX128 = positionData[2];

    // Extract fee growth data from ticks
    const feeGrowthOutside0Lower = tickLowerInfo[1] || 0n;
    const feeGrowthOutside1Lower = tickLowerInfo[2] || 0n;
    const feeGrowthOutside0Upper = tickUpperInfo[1] || 0n;
    const feeGrowthOutside1Upper = tickUpperInfo[2] || 0n;

    // Get global fee growth from pool
    const feeGrowthGlobal0X128 = feeGrowthGlobals[0];
    const feeGrowthGlobal1X128 = feeGrowthGlobals[1];

    // Calculate fee growth inside the position's range using Q128 math
    const feeGrowthInside0 = calculateFeeGrowthInside(
      feeGrowthGlobal0X128,
      feeGrowthOutside0Lower,
      feeGrowthOutside0Upper,
      tickLower,
      tickUpper,
      currentTick
    );

    const feeGrowthInside1 = calculateFeeGrowthInside(
      feeGrowthGlobal1X128,
      feeGrowthOutside1Lower,
      feeGrowthOutside1Upper,
      tickLower,
      tickUpper,
      currentTick
    );

    // Calculate fees owed using accurate Q128 math
    const feesOwed0 = calculateTokensOwed(
      feeGrowthInside0,
      feeGrowthInside0LastX128,
      positionLiquidity
    );

    const feesOwed1 = calculateTokensOwed(
      feeGrowthInside1,
      feeGrowthInside1LastX128,
      positionLiquidity
    );

    // Calculate token amounts from liquidity using accurate math
    const sqrtPriceAX96 = getSqrtRatioAtTick(tickLower);
    const sqrtPriceBX96 = getSqrtRatioAtTick(tickUpper);

    const { amount0, amount1 } = getTokenAmountsFromLiquidity(
      sqrtPriceX96,
      sqrtPriceAX96,
      sqrtPriceBX96,
      positionLiquidity
    );

    return {
      positionId,
      poolKey,
      tickLower,
      tickUpper,
      liquidity: positionLiquidity.toString(),
      token0Amount: amount0.toString(),
      token1Amount: amount1.toString(),
      feesOwed0: feesOwed0.toString(),
      feesOwed1: feesOwed1.toString(),
      feeGrowthInside0LastX128: feeGrowthInside0LastX128.toString(),
      feeGrowthInside1LastX128: feeGrowthInside1LastX128.toString(),
    };
  } catch (error) {
    console.error('Error fetching V4 position:', error);
    return null;
  }
}

/**
 * Mint a new V4 liquidity position with production-ready features
 */
export async function mintV4Position(
  params: MintPositionParams,
  signer: ethers.Signer,
  priceVolatility: number = 0
): Promise<ethers.ContractTransaction> {
  const {
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    amount0Desired,
    amount1Desired,
    amount0Min,
    amount1Min,
    recipient,
    slippageBps,
    deadlineMinutes,
  } = params;

  // Validate parameters for both tokens
  const validation0 = validateTransactionParams({
    amount: amount0Desired,
    minAmount: amount0Min,
    deadline: Math.floor(Date.now() / 1000) + ((deadlineMinutes || 20) * 60),
    recipient,
  });

  const validation1 = validateTransactionParams({
    amount: amount1Desired,
    minAmount: amount1Min,
    deadline: Math.floor(Date.now() / 1000) + ((deadlineMinutes || 20) * 60),
    recipient,
  });

  if (!validation0.valid) {
    throw new Error(`Token0 validation failed: ${validation0.error}`);
  }

  if (!validation1.valid) {
    throw new Error(`Token1 validation failed: ${validation1.error}`);
  }

  // Create PoolKey
  const poolKey: PoolKey = {
    currency0: token0.address < token1.address ? token0.address : token1.address,
    currency1: token0.address < token1.address ? token1.address : token0.address,
    fee,
    tickSpacing: 60,
    hooks: ethers.constants.AddressZero,
  };

  // Parse amounts (convert BigNumber to bigint for v5)
  const amount0Wei = BigInt(ethers.utils.parseUnits(amount0Desired, token0.decimals).toString());
  const amount1Wei = BigInt(ethers.utils.parseUnits(amount1Desired, token1.decimals).toString());

  // Calculate dynamic slippage if not provided
  const effectiveSlippage = slippageBps || calculateDynamicSlippage(priceVolatility);
  const slippageFactor = BigInt(10000 - effectiveSlippage);

  const amount0MinWei = (amount0Wei * slippageFactor) / 10000n;
  const amount1MinWei = (amount1Wei * slippageFactor) / 10000n;

  // Check and approve tokens
  const [approval0, approval1] = await Promise.all([
    checkAndApproveToken(token0.address, await signer.getAddress(), amount0Wei, signer),
    checkAndApproveToken(token1.address, await signer.getAddress(), amount1Wei, signer),
  ]);

  // Wait for approvals if needed
  if (approval0) await approval0.wait();
  if (approval1) await approval1.wait();

  // Create V4Planner instance
  const v4Planner = new V4Planner();

  // Add mint position action
  const mintConfig = {
    poolKey,
    tickLower,
    tickUpper,
    liquidity: '0',
    amount0Max: amount0Wei.toString(),
    amount1Max: amount1Wei.toString(),
    amount0Min: amount0MinWei.toString(),
    amount1Min: amount1MinWei.toString(),
    recipient,
    hookData: '0x00',
  };

  v4Planner.addAction(Actions.MINT_POSITION, [mintConfig]);
  v4Planner.addAction(Actions.SETTLE_ALL, [poolKey.currency0, amount0Wei.toString()]);
  v4Planner.addAction(Actions.SETTLE_ALL, [poolKey.currency1, amount1Wei.toString()]);

  const encodedV4Actions = v4Planner.finalize();

  const routePlanner = new RoutePlanner();
  routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions]);

  const universalRouter = new ethers.Contract(
    UNIVERSAL_ROUTER_ADDRESS,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  const deadline = calculateSafeDeadline(deadlineMinutes || 20);

  // Simulate transaction before sending
  const simulation = await simulateTransaction(
    universalRouter,
    'execute',
    [routePlanner.commands, routePlanner.inputs, deadline],
    {}
  );

  if (!simulation.success) {
    throw new Error(`Transaction simulation failed: ${simulation.error}`);
  }

  // Execute with retry logic
  return retryTransaction(async () => {
    return await universalRouter.execute(
      routePlanner.commands,
      routePlanner.inputs,
      deadline,
      {
        gasLimit: simulation.gasEstimate,
      }
    );
  });
}

/**
 * Add liquidity to an existing V4 position
 */
export async function addV4Liquidity(
  positionId: string,
  liquidityDelta: string,
  amount0Max: string,
  amount1Max: string,
  signer: ethers.Signer
): Promise<ethers.ContractTransaction> {
  const v4Planner = new V4Planner();

  const addLiquidityConfig = {
    positionId,
    liquidityDelta,
    amount0Max,
    amount1Max,
    hookData: '0x00',
  };

  v4Planner.addAction(Actions.INCREASE_LIQUIDITY, [addLiquidityConfig]);

  const encodedV4Actions = v4Planner.finalize();

  const routePlanner = new RoutePlanner();
  routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions]);

  const universalRouter = new ethers.Contract(
    UNIVERSAL_ROUTER_ADDRESS,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  const deadline = calculateSafeDeadline();

  const simulation = await simulateTransaction(
    universalRouter,
    'execute',
    [routePlanner.commands, routePlanner.inputs, deadline],
    {}
  );

  if (!simulation.success) {
    throw new Error(`Add liquidity simulation failed: ${simulation.error}`);
  }

  return retryTransaction(async () => {
    return await universalRouter.execute(
      routePlanner.commands,
      routePlanner.inputs,
      deadline,
      {
        gasLimit: simulation.gasEstimate,
      }
    );
  });
}

/**
 * Remove liquidity from a V4 position
 */
export async function removeV4Liquidity(
  positionId: string,
  liquidityDelta: string,
  amount0Min: string,
  amount1Min: string,
  signer: ethers.Signer
): Promise<ethers.ContractTransaction> {
  const v4Planner = new V4Planner();

  const removeLiquidityConfig = {
    positionId,
    liquidityDelta,
    amount0Min,
    amount1Min,
    hookData: '0x00',
  };

  v4Planner.addAction(Actions.DECREASE_LIQUIDITY, [removeLiquidityConfig]);

  const encodedV4Actions = v4Planner.finalize();

  const routePlanner = new RoutePlanner();
  routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions]);

  const universalRouter = new ethers.Contract(
    UNIVERSAL_ROUTER_ADDRESS,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  const deadline = calculateSafeDeadline();

  const simulation = await simulateTransaction(
    universalRouter,
    'execute',
    [routePlanner.commands, routePlanner.inputs, deadline],
    {}
  );

  if (!simulation.success) {
    throw new Error(`Remove liquidity simulation failed: ${simulation.error}`);
  }

  return retryTransaction(async () => {
    return await universalRouter.execute(
      routePlanner.commands,
      routePlanner.inputs,
      deadline,
      {
        gasLimit: simulation.gasEstimate,
      }
    );
  });
}

/**
 * Collect fees from a V4 position with production-ready features
 */
export async function collectV4Fees(
  positionId: string,
  recipient: string,
  poolKey: PoolKey,
  signer: ethers.Signer
): Promise<ethers.ContractTransaction> {
  const v4Planner = new V4Planner();

  const collectConfig = {
    positionId,
    liquidityDelta: '0',
    amount0Min: '0',
    amount1Min: '0',
    hookData: '0x00',
  };

  v4Planner.addAction(Actions.DECREASE_LIQUIDITY, [collectConfig]);
  v4Planner.addAction(Actions.TAKE_ALL, [poolKey.currency0, recipient]);
  v4Planner.addAction(Actions.TAKE_ALL, [poolKey.currency1, recipient]);

  const encodedV4Actions = v4Planner.finalize();

  const routePlanner = new RoutePlanner();
  routePlanner.addCommand(CommandType.V4_SWAP, [encodedV4Actions]);

  const universalRouter = new ethers.Contract(
    UNIVERSAL_ROUTER_ADDRESS,
    UNIVERSAL_ROUTER_ABI,
    signer
  );

  const deadline = calculateSafeDeadline();

  const simulation = await simulateTransaction(
    universalRouter,
    'execute',
    [routePlanner.commands, routePlanner.inputs, deadline],
    {}
  );

  if (!simulation.success) {
    throw new Error(`Fee collection simulation failed: ${simulation.error}`);
  }

  return retryTransaction(async () => {
    return await universalRouter.execute(
      routePlanner.commands,
      routePlanner.inputs,
      deadline,
      {
        gasLimit: simulation.gasEstimate,
      }
    );
  });
}

/**
 * Calculate fees owed for a position with accurate Q128 math
 */
export async function calculateV4FeesOwed(
  poolKey: PoolKey,
  owner: string,
  tickLower: number,
  tickUpper: number,
  provider: ethers.providers.Provider
): Promise<{ fees0: string; fees1: string } | null> {
  const position = await getV4Position(
    '', // positionId not needed for fee calculation
    poolKey,
    owner,
    tickLower,
    tickUpper,
    provider
  );

  if (!position) {
    return null;
  }

  return {
    fees0: position.feesOwed0,
    fees1: position.feesOwed1,
  };
}
