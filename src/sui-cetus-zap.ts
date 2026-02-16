import dotenv from 'dotenv';
import { RawSigner, Ed25519Keypair, JsonRpcProvider, Connection } from '@mysten/sui.js';
import {
  SDK,
  TickMath,
  ClmmPoolUtil,
  Percentage,
} from '@cetusprotocol/cetus-sui-clmm-sdk';
import BN from 'bn.js';

// Load environment variables
dotenv.config();

// Cetus mainnet configuration - from SDK documentation
const CETUS_MAINNET_CONFIG = {
  fullRpcUrl: 'https://fullnode.mainnet.sui.io',
  faucetURL: '',
  simulationAccount: {
    address: '0x326ce9894f08dcaa337fa232641cc34db957aec9ff6614c1186bc9a7508df0bb',
  },
  token: {
    token_display: '0x481fb627bf18bc93c02c41ada3cc8b574744ef23c9d5e3136637ae3076e71562',
    config: {
      coin_registry_id: '0xe0b8cb7e56d465965cac5c5fe26cba558de35d88b9ec712c40f131f72c600151',
      pool_registry_id: '0xab40481f926e686455edf819b4c6485fbbf147a42cf3b95f72ed88c94577e67a',
      coin_list_owner: '0x1f6510ee7d8e2b39261bad012f0be0adbecfd75199450b7cbf28efab42dad083',
      pool_list_owner: '0x6de133b609ea815e1f6a4d50785b798b134f567ec1f4ee113ae73f6900b4012d',
    },
  },
  clmm: {
    clmm_display: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
    clmm_router: {
      cetus: '0x2eeaab737b37137b94bfa8f841f92e36a153641119da3456dec1926b9960d9be',
      deepbook: '',
    },
    config: {
      pools_id: '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
      global_config_id: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
      global_vault_id: '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
      admin_cap_id: '',
    },
  },
  launchpad: {
    ido_display: '',
    ido_router: '',
    config_display: '',
    config: {
      pools_id: '',
      admin_cap_id: '',
      config_cap_id: '',
      config_pools_id: '',
    },
  },
  xcetus: {
    xcetus_display: '',
    xcetus_router: '',
    dividends_display: '',
    dividends_router: '',
    cetus_faucet: '',
    config: {
      xcetus_manager_id: '',
      lock_manager_id: '',
      lock_handle_id: '',
      dividend_manager_id: '',
    },
  },
  booster: {
    booster_display: '',
    booster_router: '',
    config: {
      booster_config_id: '',
      booster_pool_handle: '',
    },
  },
  maker_bonus: {
    maker_display: '',
    maker_router: '',
    config: {
      maker_config_id: '',
      maker_pool_handle: '',
    },
  },
};

interface Config {
  suiRpcUrl: string;
  privateKey: string;
  poolId: string;
  rangePercent: number;
}

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  const suiRpcUrl = process.env.SUI_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const poolId = process.env.POOL_ID;
  const rangePercent = process.env.RANGE_PERCENT;

  if (!suiRpcUrl) {
    throw new Error('SUI_RPC_URL is required');
  }
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is required');
  }
  if (!poolId) {
    throw new Error('POOL_ID is required');
  }
  if (!rangePercent) {
    throw new Error('RANGE_PERCENT is required');
  }

  return {
    suiRpcUrl,
    privateKey,
    poolId,
    rangePercent: parseFloat(rangePercent),
  };
}

/**
 * Main ZAP execution function
 */
async function executeZap() {
  try {
    console.log('Starting SUI Cetus ZAP Bot...');

    // Step 1: Load configuration
    const config = loadConfig();
    console.log('Configuration loaded successfully');

    // Step 2: Connect to SUI mainnet using RPC provider
    const connection = new Connection({
      fullnode: config.suiRpcUrl,
    });
    const provider = new JsonRpcProvider(connection);
    console.log('Connected to SUI mainnet');

    // Step 3: Initialize wallet keypair
    const keypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(config.privateKey, 'hex')
    );
    const signer = new RawSigner(keypair, provider);
    const walletAddress = await signer.getAddress();
    console.log(`Wallet address: ${walletAddress}`);

    // Step 4: Initialize Cetus CLMM SDK
    const sdkOptions = {
      ...CETUS_MAINNET_CONFIG,
      fullRpcUrl: config.suiRpcUrl,
    };

    const sdk = new SDK(sdkOptions);
    sdk.senderAddress = walletAddress;
    console.log('Cetus CLMM SDK initialized');

    // Step 5: Fetch pool information
    const pool = await sdk.Pool.getPool(config.poolId);
    if (!pool) {
      throw new Error(`Pool not found: ${config.poolId}`);
    }
    console.log(`Pool fetched: ${pool.coinTypeA} / ${pool.coinTypeB}`);
    console.log(`Current tick: ${pool.current_tick_index}`);
    console.log(`Current sqrt price: ${pool.current_sqrt_price}`);

    // Step 6: Fetch wallet balances for pool token pair
    const coinTypeA = pool.coinTypeA;
    const coinTypeB = pool.coinTypeB;

    const coinsA = await provider.getCoins({
      owner: walletAddress,
      coinType: coinTypeA,
    });
    const coinsB = await provider.getCoins({
      owner: walletAddress,
      coinType: coinTypeB,
    });

    const balanceA = coinsA.data.reduce(
      (sum, coin) => sum.add(new BN(coin.balance)),
      new BN(0)
    );
    const balanceB = coinsB.data.reduce(
      (sum, coin) => sum.add(new BN(coin.balance)),
      new BN(0)
    );

    console.log(`Wallet balance A: ${balanceA.toString()}`);
    console.log(`Wallet balance B: ${balanceB.toString()}`);

    if (balanceA.isZero() && balanceB.isZero()) {
      throw new Error('No tokens available in wallet for this pool');
    }

    // Step 7: Calculate active range using RANGE_PERCENT around current price
    const currentTick = pool.current_tick_index;
    const tickSpacing = pool.tickSpacing;

    // Use TickMath to get proper tick indices based on current tick and range
    const lowerTick = TickMath.getPrevInitializableTickIndex(
      new BN(currentTick).sub(new BN(Math.floor(currentTick * (config.rangePercent / 100)))).toNumber(),
      new BN(tickSpacing).toNumber()
    );
    const upperTick = TickMath.getNextInitializableTickIndex(
      new BN(currentTick).add(new BN(Math.floor(currentTick * (config.rangePercent / 100)))).toNumber(),
      new BN(tickSpacing).toNumber()
    );

    console.log(`Calculated tick range: [${lowerTick}, ${upperTick}]`);
    console.log(`Tick spacing: ${tickSpacing}`);

    // Step 8: Calculate liquidity and amounts for ZAP
    const curSqrtPrice = new BN(pool.current_sqrt_price);
    const slippage = 0.05; // 5% slippage tolerance

    // Determine which token has a balance and calculate accordingly
    let fix_amount_a = true;
    let coinAmount = balanceA;

    if (balanceA.isZero() && !balanceB.isZero()) {
      fix_amount_a = false;
      coinAmount = balanceB;
    } else if (!balanceA.isZero() && !balanceB.isZero()) {
      // Both tokens available - use token A
      fix_amount_a = true;
      coinAmount = balanceA;
    }

    // Estimate liquidity and token amounts from the available balance
    const liquidityInput = ClmmPoolUtil.estLiquidityAndcoinAmountFromOneAmounts(
      lowerTick,
      upperTick,
      coinAmount,
      fix_amount_a,
      true,
      slippage,
      curSqrtPrice
    );

    const amount_a = fix_amount_a ? coinAmount.toNumber() : liquidityInput.tokenMaxA.toNumber();
    const amount_b = fix_amount_a ? liquidityInput.tokenMaxB.toNumber() : coinAmount.toNumber();

    console.log(`Calculated amounts - A: ${amount_a}, B: ${amount_b}`);

    // Step 9: Create add liquidity transaction payload
    console.log('Preparing ZAP transaction...');

    const addLiquidityPayloadParams = {
      coinTypeA: coinTypeA,
      coinTypeB: coinTypeB,
      pool_id: pool.poolAddress,
      tick_lower: lowerTick.toString(),
      tick_upper: upperTick.toString(),
      fix_amount_a: fix_amount_a,
      amount_a: amount_a,
      amount_b: amount_b,
      is_open: true, // Create new position
      pos_id: '', // Empty since we're opening a new position
      collect_fee: false, // Don't collect fees
      rewarder_coin_types: [], // No rewarder coins
    };

    // Create the transaction payload with slippage protection
    const createAddLiquidityTransactionPayload = await sdk.Position.createAddLiquidityTransactionPayload(
      addLiquidityPayloadParams,
      {
        slippage: slippage,
        curSqrtPrice: curSqrtPrice,
      }
    );

    // Step 10: Sign and execute the transaction on SUI
    console.log('Signing and executing transaction...');

    const result = await signer.signAndExecuteTransactionBlock({
      transactionBlock: createAddLiquidityTransactionPayload,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    // Step 11: Check transaction result
    if (result.effects?.status?.status === 'success') {
      console.log('ZAP_SUCCESS_ON_SUI_CETUS');
      console.log(`Transaction digest: ${result.digest}`);
      process.exit(0);
    } else {
      console.error('Transaction failed');
      console.error('Status:', result.effects?.status);
      process.exit(1);
    }
  } catch (error) {
    console.error('ZAP execution failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the bot
if (require.main === module) {
  executeZap();
}

export { executeZap };
