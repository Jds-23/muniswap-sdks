import { type FeeOptions, MixedRouteSDK, MixedRouteTrade } from '@muniswap/router-sdk'
import {
  CHAIN_TO_ADDRESSES_MAP,
  ChainId,
  type Currency,
  CurrencyAmount,
  Ether,
  NONFUNGIBLE_POSITION_MANAGER_ADDRESSES,
  Percent,
  type Token,
  TradeType,
} from '@muniswap/sdk-core'
import { type Pair, Route as RouteV2, Trade as V2Trade } from '@muniswap/v2-sdk'
import {
  FeeAmount,
  MAX_TICK,
  MIN_TICK,
  Position,
  type Pool as V3Pool,
  Route as V3Route,
  Trade as V3Trade,
  encodeSqrtRatioX96,
  nearestUsableTick,
} from '@muniswap/v3-sdk'
import { Pool as V4Pool, Position as V4Position, Route as V4Route, Trade as V4Trade } from '@muniswap/v4-sdk'
import { Hex, Secp256k1, Signature, TypedData } from 'ox'
import { beforeAll, describe, expect, it } from 'vitest'
import { type FlatFeeOptions, SwapRouter, UniswapTrade } from '../index'
import {
  ETH_ADDRESS,
  E_ETH_ADDRESS,
  MAX_UINT160,
  UNIVERSAL_ROUTER_ADDRESS,
  UniversalRouterVersion,
  ZERO_ADDRESS,
} from '../utils/constants'
import { expandTo18Decimals } from '../utils/numbers'
import {
  type PartialClassicQuote,
  PoolType,
  RouterTradeAdapter,
  type V2PoolInRoute,
  type V3PoolInRoute,
  type V4PoolInRoute,
} from '../utils/routerTradeAdapter'
import {
  FORGE_V4_POSITION_MANAGER,
  PERMIT2_ADDRESS,
  TEST_FEE_RECIPIENT_ADDRESS,
  TEST_RECIPIENT_ADDRESS,
} from './utils/addresses'
import { generateEip2098PermitSignature, generatePermitSignature, makePermit, toInputPermit } from './utils/permit2'
import {
  DAI,
  ETHER,
  USDC,
  USDC_DAI_V2,
  USDC_DAI_V3,
  WETH,
  WETH_USDC_V2,
  WETH_USDC_V3,
  WETH_USDC_V3_LOW_FEE,
  buildTrade,
  swapOptions,
} from './utils/uniswapData'

// Private key for test signing (padded to 32 bytes)
const TEST_PRIVATE_KEY = Hex.padLeft('0x1234', 32)

// EIP-712 permit data for NFT position manager (replaces NonfungiblePositionManager.getPermitData)
const NFT_PERMIT_TYPES = {
  Permit: [
    { name: 'spender', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

function getNftPermitData(
  permit: { spender: string; tokenId: number; deadline: string; nonce: number },
  positionManagerAddress: string,
  chainId: number
) {
  return {
    domain: {
      name: 'Uniswap V3 Positions NFT-V1',
      chainId,
      version: '1',
      verifyingContract: positionManagerAddress as `0x${string}`,
    },
    types: NFT_PERMIT_TYPES,
    values: permit,
  }
}

function signNftPermit(
  permit: { spender: string; tokenId: number; deadline: string; nonce: number },
  positionManagerAddress: string,
  chainId: number,
  privateKey: Hex.Hex
): { v: number; r: string; s: string } {
  const { domain, types, values } = getNftPermitData(permit, positionManagerAddress, chainId)
  const payload = TypedData.getSignPayload({
    // biome-ignore lint/suspicious/noExplicitAny: EIP-712 domain types don't match ox exactly
    domain: domain as any,
    // biome-ignore lint/suspicious/noExplicitAny: EIP-712 types don't match ox exactly
    types: types as any,
    primaryType: 'Permit',
    // biome-ignore lint/suspicious/noExplicitAny: EIP-712 values don't match ox exactly
    message: values as any,
  })
  const sig = Secp256k1.sign({ payload, privateKey })
  const legacy = Signature.toLegacy(sig)
  return {
    v: legacy.v,
    r: `0x${legacy.r.toString(16).padStart(64, '0')}`,
    s: `0x${legacy.s.toString(16).padStart(64, '0')}`,
  }
}

describe('Uniswap', () => {
  let ETH_DAI_V4: V4Pool
  let ETH_USDC_V4: V4Pool
  let WETH_USDC_V4: V4Pool
  let WETH_USDC_V4_LOW_FEE: V4Pool
  let ETH_USDC_V4_LOW_FEE: V4Pool
  let USDC_DAI_V4: V4Pool
  let ETH_WETH_V4: V4Pool

  beforeAll(() => {
    const liquidity = 1000000n * 10n ** 18n
    const tickSpacing = 60
    const tickProviderMock = [
      {
        index: nearestUsableTick(MIN_TICK, tickSpacing),
        liquidityNet: liquidity,
        liquidityGross: liquidity,
      },
      {
        index: nearestUsableTick(MAX_TICK, tickSpacing),
        liquidityNet: -liquidity,
        liquidityGross: liquidity,
      },
    ]

    WETH_USDC_V4 = new V4Pool(
      WETH,
      USDC,
      FeeAmount.MEDIUM,
      tickSpacing,
      ZERO_ADDRESS,
      encodeSqrtRatioX96(1, 1),
      liquidity,
      0,
      tickProviderMock
    )

    WETH_USDC_V4_LOW_FEE = new V4Pool(
      WETH,
      USDC,
      FeeAmount.LOW,
      tickSpacing,
      ZERO_ADDRESS,
      encodeSqrtRatioX96(1, 1),
      liquidity,
      0,
      tickProviderMock
    )

    ETH_USDC_V4_LOW_FEE = new V4Pool(
      ETHER,
      USDC,
      FeeAmount.LOW,
      tickSpacing,
      ZERO_ADDRESS,
      encodeSqrtRatioX96(1, 1),
      liquidity,
      0,
      tickProviderMock
    )

    ETH_USDC_V4 = new V4Pool(
      ETHER,
      USDC,
      FeeAmount.MEDIUM,
      tickSpacing,
      ZERO_ADDRESS,
      encodeSqrtRatioX96(1, 1),
      liquidity,
      0,
      tickProviderMock
    )

    USDC_DAI_V4 = new V4Pool(
      DAI,
      USDC,
      FeeAmount.MEDIUM,
      tickSpacing,
      ZERO_ADDRESS,
      encodeSqrtRatioX96(1, 1),
      liquidity,
      0,
      tickProviderMock
    )

    ETH_DAI_V4 = new V4Pool(
      DAI,
      ETHER,
      FeeAmount.MEDIUM,
      tickSpacing,
      ZERO_ADDRESS,
      encodeSqrtRatioX96(1, 1),
      liquidity,
      0,
      tickProviderMock
    )

    ETH_WETH_V4 = new V4Pool(
      ETHER,
      WETH,
      FeeAmount.MEDIUM,
      tickSpacing,
      ZERO_ADDRESS,
      encodeSqrtRatioX96(1, 1),
      liquidity,
      0,
      tickProviderMock
    )
  })

  describe('v2', () => {
    it('encodes a single exactInput ETH->USDC swap', () => {
      const inputEther = (10n ** 18n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput ETH->USDC swap, with a fee', () => {
      const inputEther = (10n ** 18n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const feeOptions: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes an exactInput ETH->USDC->DAI swap', () => {
      const inputEther = (10n ** 18n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2, USDC_DAI_V2], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes an exactInput ETH->USDC->DAI swap, with a fee', () => {
      const inputEther = (10n ** 18n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2, USDC_DAI_V2], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const feeOptions: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput USDC->ETH swap', () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput USDC->ETH swap, with WETH fee', () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const feeOptions: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput USDC->ETH swap with permit', () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const permit = makePermit(
        USDC.address,
        inputUSDC,
        undefined,
        UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, 1)
      )
      const signature = generatePermitSignature(permit, TEST_PRIVATE_KEY, trade.route.chainId, PERMIT2_ADDRESS)
      const opts = swapOptions({ inputTokenPermit: toInputPermit(signature, permit) })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput USDC->ETH swap with EIP-2098 permit', () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const permit = makePermit(
        USDC.address,
        inputUSDC,
        undefined,
        UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, 1)
      )
      const signature = generateEip2098PermitSignature(permit, TEST_PRIVATE_KEY, trade.route.chainId)
      const opts = swapOptions({ inputTokenPermit: toInputPermit(signature, permit) })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput USDC->ETH swap with permit with v recovery id', () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const permit = makePermit(
        USDC.address,
        inputUSDC,
        undefined,
        UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, 1)
      )
      const originalSignature = generatePermitSignature(permit, TEST_PRIVATE_KEY, trade.route.chainId, PERMIT2_ADDRESS)
      const parsed = Signature.from(originalSignature as Hex.Hex)
      const recoveryParam = parsed.yParity
      // slice off current v byte
      let signature = originalSignature.substring(0, originalSignature.length - 2)
      // append recoveryParam as v (0 or 1 instead of 27 or 28)
      signature += recoveryParam.toString(16).padStart(2, '0')
      // assert sanitization technique works
      const reparsed = Signature.from(signature as Hex.Hex)
      expect(Signature.toHex(reparsed)).toBe(originalSignature)
      const opts = swapOptions({ inputTokenPermit: toInputPermit(signature, permit) })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes an exactInput DAI->USDC->ETH swap', () => {
      const inputDAI = (10n * 10n ** 18n).toString()
      const trade = new V2Trade(
        new RouteV2([USDC_DAI_V2, WETH_USDC_V2], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactOutput ETH->USDC swap', () => {
      const outputUSDC = (1000n * 10n ** 6n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).not.toBe('0')
    })

    it('encodes a single exactOutput ETH->USDC swap, with a fee', () => {
      const outputUSDC = 1000n * 10n ** 6n
      const adjustedOutputUSDC = ((outputUSDC * 10000n) / (10000n - 500n)).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, adjustedOutputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const feeOptions: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).not.toBe('0')
    })

    it('encodes a single exactOutput ETH->USDC swap, with a flat fee', () => {
      const outputUSDC = (1050n * 10n ** 6n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const feeOptions: FlatFeeOptions = { amount: 50n * 10n ** 6n, recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ flatFee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).not.toBe('0')
    })

    it('encodes a single exactOutput USDC->ETH swap, with a flat fee', () => {
      const outputETH = (15n * 10n ** 18n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], USDC, ETHER),
        CurrencyAmount.fromRawAmount(ETHER, outputETH),
        TradeType.EXACT_OUTPUT
      )
      const feeOptions: FlatFeeOptions = { amount: 5n * 10n ** 18n, recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ flatFee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactOutput USDC->ETH swap', () => {
      const outputETH = (10n ** 18n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], USDC, ETHER),
        CurrencyAmount.fromRawAmount(ETHER, outputETH),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })
  })

  describe('v3', () => {
    it('encodes a single exactInput ETH->USDC swap', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput ETH->USDC swap, with a fee', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const feeOptions: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput ETH->USDC swap, with a flat fee', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const feeOptions: FlatFeeOptions = { amount: 50n * 10n ** 6n, recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ flatFee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput USDC->ETH swap', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput USDC->ETH swap, with WETH fee', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const feeOptions: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput USDC->ETH swap with permit', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const permit = makePermit(
        USDC.address,
        inputUSDC,
        undefined,
        UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, 1)
      )
      const signature = generatePermitSignature(
        permit,
        TEST_PRIVATE_KEY,
        trade.swaps[0]!.route.chainId,
        PERMIT2_ADDRESS
      )
      const opts = swapOptions({ inputTokenPermit: toInputPermit(signature, permit) })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput ETH->USDC->DAI swap', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3, USDC_DAI_V3], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput ETH->USDC->DAI swap in safemode', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3, USDC_DAI_V3], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({ safeMode: true })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactOutput ETH->USDC swap', async () => {
      const outputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).not.toBe('0')
    })

    it('encodes a single exactOutput USDC->ETH swap', async () => {
      const outputEther = (10n ** 18n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], USDC, ETHER),
        CurrencyAmount.fromRawAmount(ETHER, outputEther),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes an exactOutput ETH->USDC->DAI swap', async () => {
      const outputDai = (1000n * 10n ** 18n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3, USDC_DAI_V3], ETHER, DAI),
        CurrencyAmount.fromRawAmount(DAI, outputDai),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).not.toBe('0')
    })

    it('encodes an exactOutput DAI->USDC->ETH swap', async () => {
      const outputEther = (10n ** 18n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([USDC_DAI_V3, WETH_USDC_V3], DAI, ETHER),
        CurrencyAmount.fromRawAmount(ETHER, outputEther),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes an exactOutput DAI->USDC->ETH swap, with WETH fee', async () => {
      const outputEther = 10n ** 18n
      const adjustedOutputEther = ((outputEther * 10000n) / (10000n - 500n)).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([USDC_DAI_V3, WETH_USDC_V3], DAI, ETHER),
        CurrencyAmount.fromRawAmount(ETHER, adjustedOutputEther),
        TradeType.EXACT_OUTPUT
      )
      const feeOptions: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })
  })

  describe('v4', () => {
    it('encodes a single exactInput ETH->USDC swap', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput ETH->USDC swap, via WETH', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([WETH_USDC_V4], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput ETH->USDC swap, with a fee', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const feeOptions: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput ETH->USDC swap, with a flat fee', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const feeOptions: FlatFeeOptions = { amount: 50n * 10n ** 6n, recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ flatFee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a single exactInput USDC->ETH swap', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput USDC->ETH swap with wrap', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput USDC->DAI->ETH swap with wrap', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, ETH_DAI_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a single exactInput ETH->USDC->DAI swap', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4, USDC_DAI_V4], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({ safeMode: true })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes an exactOutput DAI->USDC->ETH swap', async () => {
      const outputEther = (10n ** 18n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, ETH_USDC_V4], DAI, ETHER),
        CurrencyAmount.fromRawAmount(ETHER, outputEther),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes an exactOutput DAI->USDC->ETH swap, with ETH fee', async () => {
      const outputEther = 10n ** 18n
      const adjustedOutputEther = ((outputEther * 10000n) / (10000n - 500n)).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, ETH_DAI_V4], USDC, ETHER),
        CurrencyAmount.fromRawAmount(ETHER, adjustedOutputEther),
        TradeType.EXACT_OUTPUT
      )
      const feeOptions: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes an exactOutput USDC->DAI->ETH swap with wrap to receive WETH', async () => {
      const outputEther = 10n ** 18n
      const trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, ETH_DAI_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(WETH, outputEther),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes an exactOutput USDC->DAI->ETH swap with fee that wraps to WETH', async () => {
      const outputEther = 10n ** 18n
      const flatFee = (outputEther * 5n) / 100n
      const trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, ETH_DAI_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(WETH, (outputEther + flatFee).toString()),
        TradeType.EXACT_OUTPUT
      )
      const feeOptions: FlatFeeOptions = { amount: flatFee, recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ flatFee: feeOptions })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes an exactOutput ETH->DAI->USDC swap', async () => {
      const outputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([ETH_DAI_V4, USDC_DAI_V4], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).not.toBe('0')
    })

    it('encodes an exactOutput ETH->DAI->USDC swap that must first unwrap WETH', async () => {
      const outputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await V4Trade.fromRoute(
        new V4Route([ETH_DAI_V4, USDC_DAI_V4], WETH, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes an exactOutput WETH->DAI->USDC swap that must first wrap ETH', async () => {
      const outputDAI = 10n ** 18n
      const trade = await V4Trade.fromRoute(
        new V4Route([WETH_USDC_V4, USDC_DAI_V4], ETHER, DAI),
        CurrencyAmount.fromRawAmount(DAI, outputDAI),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).not.toBe('0')
    })
  })

  describe('mixed (interleaved)', () => {
    it('encodes a mixed exactInput v3ETH->v2USDC->DAI swap', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([WETH_USDC_V3, USDC_DAI_V2], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a mixed exactInput v2ETH->v3USDC->DAI swap', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([WETH_USDC_V2, USDC_DAI_V3], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a mixed exactInput v2ETH->v2USDC->DAI swap', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([WETH_USDC_V2, USDC_DAI_V2], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a mixed exactInput v3ETH->v3USDC->DAI swap', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([WETH_USDC_V3, USDC_DAI_V3], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a mixed exactInput v2DAI->v3USDC->ETH swap', async () => {
      const inputDai = (1000n * 10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([USDC_DAI_V2, WETH_USDC_V3], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDai),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a mixed exactInput v3USDC-WETH->v4ETH->DAI', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([WETH_USDC_V3, ETH_DAI_V4], USDC, DAI),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a mixed exactInput v2USDC-WETH->v4ETH->DAI', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([WETH_USDC_V2, ETH_DAI_V4], USDC, DAI),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({ slippageTolerance: new Percent(5, 100) })
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a mixed exactInput v4DAI->ETH->V3WETH->USDC', async () => {
      const inputDAI = (1000n * 10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([ETH_DAI_V4, WETH_USDC_V3], DAI, USDC),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a mixed exactInput v4DAI->ETH->V2WETH->USDC', async () => {
      const inputDAI = (1000n * 10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([ETH_DAI_V4, WETH_USDC_V2], DAI, USDC),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a mixed exactInput v4ETH->DAI->V3DAI->USDC', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([ETH_DAI_V4, USDC_DAI_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a mixed exactInput v4ETH->WETH->V3USDC->USDC', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([ETH_WETH_V4, WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a mixed exactInput v4wrapWETH->USDC->V3USDC->DAI', async () => {
      const inputEther = (3000n * 10n ** 6n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([WETH_USDC_V4, USDC_DAI_V3], ETHER, DAI),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe(inputEther)
    })

    it('encodes a mixed exactInput v4unwrapETH->USDC->V3USDC->DAI', async () => {
      const inputWeth = (3000n * 10n ** 6n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([ETH_USDC_V4, USDC_DAI_V3], WETH, DAI),
        CurrencyAmount.fromRawAmount(WETH, inputWeth),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a mixed exactInput v4WETH->USDC->V3USDC->DAI', async () => {
      const inputWeth = (3000n * 10n ** 6n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([WETH_USDC_V4, USDC_DAI_V3], WETH, DAI),
        CurrencyAmount.fromRawAmount(WETH, inputWeth),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a mixed exactInput v2DAI->v4USDC->ETH swap unwrap', async () => {
      const inputDai = (1000n * 10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([USDC_DAI_V2, WETH_USDC_V4], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDai),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a mixed exactInput v2DAI->v4USDC->WETH swap wrap', async () => {
      const inputDai = (1000n * 10n ** 18n).toString()
      const trade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([USDC_DAI_V2, ETH_USDC_V4], DAI, WETH),
        CurrencyAmount.fromRawAmount(DAI, inputDai),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })
  })

  describe('multi-route', () => {
    it('encodes a split exactInput with 2 routes v3ETH->v3USDC & v2ETH->v2USDC swap', async () => {
      const inputEther = expandTo18Decimals(1)
      const v2Trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const v3Trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v2Trade, v3Trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe((inputEther * 2n).toString())
    })

    it('encodes a split exactInput with 3 routes v3ETH->v3USDC & v2ETH->v2USDC swap', async () => {
      const inputEther = expandTo18Decimals(1)
      const v2Trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const v3Trade1 = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const v3Trade2 = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3_LOW_FEE], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v2Trade, v3Trade1, v3Trade2]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe((inputEther * 3n).toString())
    })

    it('encodes a split exactOutput with 3 routes v3ETH->v3USDC & v2ETH->v2USDC swap', async () => {
      const outputUSDC = (1000n * 10n ** 6n).toString()
      const v2Trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const v3Trade1 = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const v3Trade2 = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3_LOW_FEE], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      SwapRouter.swapCallParameters(buildTrade([v2Trade, v3Trade1, v3Trade2]), opts)
    })

    it('encodes a split exactOutput with v2+v3+v4 routes', async () => {
      const outputUSDC = (1000n * 10n ** 6n).toString()
      const v2Trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const v3Trade1 = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const v4Trade = await V4Trade.fromRoute(
        new V4Route([ETH_WETH_V4, ETH_USDC_V4], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const opts = swapOptions({})
      SwapRouter.swapCallParameters(buildTrade([v2Trade, v3Trade1, v4Trade]), opts)
    })

    // Split routes with ETH output
    it('encodes a split exactInput with 2 routes v3USDC->v3ETH & v4USDC->v4ETH swap', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const v4Trade = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4, ETH_WETH_V4], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const v3Trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v4Trade, v3Trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a split exactInput with mixed + v4 routes ending in ETH', async () => {
      const inputDAI = (1000n * 10n ** 18n).toString()
      const mixedTrade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([USDC_DAI_V2, WETH_USDC_V3], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const v4Trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, ETH_USDC_V4, ETH_WETH_V4], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([mixedTrade, v4Trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a split exactInput with mixed v2->v4 ETH routes', async () => {
      const inputDAI = (1000n * 10n ** 18n).toString()
      const mixedTrade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([USDC_DAI_V2, ETH_USDC_V4_LOW_FEE], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const v4Trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, ETH_USDC_V4], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([mixedTrade, v4Trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a split exactInput with mixed v2->v4 WETH routes', async () => {
      const inputDAI = (1000n * 10n ** 18n).toString()
      const mixedTrade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([USDC_DAI_V2, WETH_USDC_V4_LOW_FEE], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const v4Trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, WETH_USDC_V4], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([mixedTrade, v4Trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a split exactInput with 2 v4 routes eth-weth & weth', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const v4Trade1 = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4, ETH_WETH_V4], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const v4Trade2 = await V4Trade.fromRoute(
        new V4Route([WETH_USDC_V4], USDC, ETHER),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v4Trade1, v4Trade2]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a split exactInput with v4 eth-weth & mixed weth', async () => {
      const inputDAI = (1000n * 10n ** 18n).toString()
      const v4Trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, ETH_USDC_V4, ETH_WETH_V4], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const mixedTrade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([USDC_DAI_V2, WETH_USDC_V4_LOW_FEE], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v4Trade, mixedTrade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a split exactInput with v4 weth & mixed eth-weth', async () => {
      const inputDAI = (1000n * 10n ** 18n).toString()
      const v4Trade = await V4Trade.fromRoute(
        new V4Route([USDC_DAI_V4, WETH_USDC_V4], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const mixedTrade = await MixedRouteTrade.fromRoute(
        new MixedRouteSDK([USDC_DAI_V2, ETH_USDC_V4, ETH_WETH_V4], DAI, ETHER),
        CurrencyAmount.fromRawAmount(DAI, inputDAI),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v4Trade, mixedTrade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    // Split routes with WETH output
    it('encodes a split exactInput v3+v4 ending in WETH', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const v3Trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const v4Trade = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4, ETH_WETH_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v3Trade, v4Trade]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a split exactInput 2 v4 routes ending in weth & eth-weth', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const v4Trade1 = await V4Trade.fromRoute(
        new V4Route([WETH_USDC_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const v4Trade2 = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4, ETH_WETH_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v4Trade1, v4Trade2]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a split exactInput 2 v4 routes eth & eth-weth ending in weth', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const v4Trade1 = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const v4Trade2 = await V4Trade.fromRoute(
        new V4Route([WETH_USDC_V4, ETH_WETH_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v4Trade1, v4Trade2]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a split exactInput 2 v4 routes both ending in eth', async () => {
      const inputUSDC = (1000n * 10n ** 6n).toString()
      const v4Trade1 = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const v4Trade2 = await V4Trade.fromRoute(
        new V4Route([ETH_USDC_V4_LOW_FEE], USDC, WETH),
        CurrencyAmount.fromRawAmount(USDC, inputUSDC),
        TradeType.EXACT_INPUT
      )
      const opts = swapOptions({})
      const methodParameters = SwapRouter.swapCallParameters(buildTrade([v4Trade1, v4Trade2]), opts)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })
  })

  describe('fees', () => {
    it('throws if instantiated with a proportional fee and a flat fee', () => {
      const outputUSDC = (1050n * 10n ** 6n).toString()
      const trade = new V2Trade(
        new RouteV2([WETH_USDC_V2], ETHER, USDC),
        CurrencyAmount.fromRawAmount(USDC, outputUSDC),
        TradeType.EXACT_OUTPUT
      )
      const proportionalFee: FeeOptions = { fee: new Percent(5, 100), recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const feeOptions: FlatFeeOptions = { amount: 50n * 10n ** 6n, recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ fee: proportionalFee, flatFee: feeOptions })
      expect(() => {
        SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      }).toThrow('Only one fee option permitted')
    })

    it('throws if flat fee amount is larger than minimumAmountOut', async () => {
      const inputEther = (10n ** 18n).toString()
      const trade = await V3Trade.fromRoute(
        new V3Route([WETH_USDC_V3], ETHER, USDC),
        CurrencyAmount.fromRawAmount(ETHER, inputEther),
        TradeType.EXACT_INPUT
      )
      // Fee must exceed the trade output (mock pool is 1:1 so output is ~1e18)
      const feeOptions: FlatFeeOptions = { amount: 10n ** 24n, recipient: TEST_FEE_RECIPIENT_ADDRESS }
      const opts = swapOptions({ flatFee: feeOptions })
      expect(() => {
        SwapRouter.swapCallParameters(buildTrade([trade]), opts)
      }).toThrow('Flat fee amount greater than minimumAmountOut')
    })
  })

  const mockV2PoolInRoute = (
    pair: Pair,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string,
    amountOut: string
  ): V2PoolInRoute => {
    const token0 = tokenIn.sortsBefore(tokenOut) ? tokenIn : tokenOut
    const token1 = tokenIn.sortsBefore(tokenOut) ? tokenOut : tokenIn
    return {
      type: PoolType.V2Pool,
      tokenIn: { address: tokenIn.address, chainId: 1, symbol: tokenIn.symbol!, decimals: String(tokenIn.decimals) },
      tokenOut: {
        address: tokenOut.address,
        chainId: 1,
        symbol: tokenOut.symbol!,
        decimals: String(tokenOut.decimals),
      },
      reserve0: {
        token: { address: token0.address, chainId: 1, symbol: token0.symbol!, decimals: String(token0.decimals) },
        quotient: pair.reserve0.quotient.toString(),
      },
      reserve1: {
        token: { address: token1.address, chainId: 1, symbol: token1.symbol!, decimals: String(token1.decimals) },
        quotient: pair.reserve1.quotient.toString(),
      },
      amountIn,
      amountOut,
    }
  }

  const mockV3PoolInRoute = (
    pool: V3Pool,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: string,
    amountOut: string
  ): V3PoolInRoute => {
    return {
      type: PoolType.V3Pool,
      tokenIn: { address: tokenIn.address, chainId: 1, symbol: tokenIn.symbol!, decimals: String(tokenIn.decimals) },
      tokenOut: {
        address: tokenOut.address,
        chainId: 1,
        symbol: tokenOut.symbol!,
        decimals: String(tokenOut.decimals),
      },
      sqrtRatioX96: pool.sqrtRatioX96.toString(),
      liquidity: pool.liquidity.toString(),
      tickCurrent: pool.tickCurrent.toString(),
      fee: pool.fee.toString(),
      amountIn,
      amountOut,
    }
  }

  const mockV4PoolInRoute = (
    pool: V4Pool,
    tokenIn: Currency,
    tokenOut: Currency,
    amountIn: string,
    amountOut: string
  ): V4PoolInRoute => {
    return {
      type: PoolType.V4Pool,
      tokenIn: {
        address: tokenIn.isNative ? ETH_ADDRESS : tokenIn.address,
        chainId: 1,
        symbol: tokenIn.symbol!,
        decimals: String(tokenIn.decimals),
      },
      tokenOut: {
        address: tokenOut.isNative ? ETH_ADDRESS : tokenOut.address,
        chainId: 1,
        symbol: tokenOut.symbol!,
        decimals: String(tokenOut.decimals),
      },
      fee: pool.fee.toString(),
      tickSpacing: pool.tickSpacing.toString(),
      hooks: pool.hooks,
      sqrtRatioX96: pool.sqrtRatioX96.toString(),
      liquidity: pool.liquidity.toString(),
      tickCurrent: pool.tickCurrent.toString(),
      amountIn,
      amountOut,
    }
  }

  for (const tradeType of [TradeType.EXACT_INPUT, TradeType.EXACT_OUTPUT]) {
    describe(`RouterTradeAdapter ${tradeType}`, () => {
      const getAmountToken = (tokenIn: Token | Ether, tokenOut: Token | Ether, tt: TradeType): Token | Ether => {
        return tt === TradeType.EXACT_INPUT ? tokenIn : tokenOut
      }
      const getAmount = (
        tokenIn: Token | Ether,
        tokenOut: Token | Ether,
        amount: string,
        tt: TradeType
      ): CurrencyAmount<Token | Ether> => {
        return tt === TradeType.EXACT_INPUT
          ? CurrencyAmount.fromRawAmount(tokenIn, amount)
          : CurrencyAmount.fromRawAmount(tokenOut, amount)
      }

      function compareUniswapTrades(_left: UniswapTrade, _right: UniswapTrade): void {}

      it('v2 - erc20 <> erc20', () => {
        const [tokenIn, tokenOut] = [DAI, USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals) * 1000n).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = new V2Trade(new RouteV2([USDC_DAI_V2], DAI, USDC), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: DAI.address,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV2PoolInRoute(
                USDC_DAI_V2,
                tokenIn,
                tokenOut,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v3 - erc20 <> erc20', async () => {
        const [tokenIn, tokenOut] = [DAI, USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals) * 1000n).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = await V3Trade.fromRoute(new V3Route([USDC_DAI_V3], tokenIn, tokenOut), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: DAI.address,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV3PoolInRoute(
                USDC_DAI_V3,
                tokenIn,
                tokenOut,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v4 - erc20 <> erc20', async () => {
        const [tokenIn, tokenOut] = [DAI, USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals) * 1000n).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = await V4Trade.fromRoute(new V4Route([USDC_DAI_V4], tokenIn, tokenOut), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: DAI.address,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV4PoolInRoute(
                USDC_DAI_V4,
                tokenIn,
                tokenOut,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v2 - handles weth input properly', () => {
        const [tokenIn, tokenOut] = [WETH, USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = new V2Trade(new RouteV2([WETH_USDC_V2], tokenIn, tokenOut), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: WETH.address,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV2PoolInRoute(
                WETH_USDC_V2,
                WETH,
                USDC,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v3 - handles weth input properly', async () => {
        const [tokenIn, tokenOut] = [WETH, USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = await V3Trade.fromRoute(new V3Route([WETH_USDC_V3], WETH, USDC), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: WETH.address,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV3PoolInRoute(
                WETH_USDC_V3,
                WETH,
                USDC,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v4 - handles weth input properly', async () => {
        const [tokenIn, tokenOut] = [WETH, USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = await V4Trade.fromRoute(new V4Route([WETH_USDC_V4], WETH, USDC), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: WETH.address,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV4PoolInRoute(
                WETH_USDC_V4,
                WETH,
                USDC,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v2 - handles eth input properly', () => {
        const [tokenIn, tokenOut] = [Ether.onChain(1), USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = new V2Trade(new RouteV2([WETH_USDC_V2], Ether.onChain(1), USDC), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: ETH_ADDRESS,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV2PoolInRoute(
                WETH_USDC_V2,
                WETH,
                USDC,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v2 - handles eth input properly - 0xeeee address', () => {
        const [tokenIn, tokenOut] = [Ether.onChain(1), USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = new V2Trade(new RouteV2([WETH_USDC_V2], Ether.onChain(1), USDC), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: E_ETH_ADDRESS,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV2PoolInRoute(
                WETH_USDC_V2,
                WETH,
                USDC,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v3 - handles eth input properly', async () => {
        const [tokenIn, tokenOut] = [Ether.onChain(1), USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = await V3Trade.fromRoute(
          new V3Route([WETH_USDC_V3], Ether.onChain(1), USDC),
          rawInputAmount,
          tradeType
        )
        const classicQuote: PartialClassicQuote = {
          tokenIn: ETH_ADDRESS,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV3PoolInRoute(
                WETH_USDC_V3,
                WETH,
                USDC,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v4 - handles eth input properly', async () => {
        const [tokenIn, tokenOut] = [Ether.onChain(1), USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = await V4Trade.fromRoute(
          new V4Route([ETH_USDC_V4], Ether.onChain(1), USDC),
          rawInputAmount,
          tradeType
        )
        const classicQuote: PartialClassicQuote = {
          tokenIn: ETH_ADDRESS,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV4PoolInRoute(
                ETH_USDC_V4,
                ETHER,
                USDC,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v2 - handles eth output properly', () => {
        const [tokenIn, tokenOut] = [USDC, Ether.onChain(1)]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = new V2Trade(new RouteV2([WETH_USDC_V2], tokenIn, tokenOut), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: USDC.address,
          tokenOut: ETH_ADDRESS,
          tradeType,
          route: [
            [
              mockV2PoolInRoute(
                WETH_USDC_V2,
                USDC,
                WETH,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v3 - handles eth output properly', async () => {
        const [tokenIn, tokenOut] = [USDC, Ether.onChain(1)]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = await V3Trade.fromRoute(new V3Route([WETH_USDC_V3], tokenIn, tokenOut), rawInputAmount, tradeType)
        const classicQuote: PartialClassicQuote = {
          tokenIn: USDC.address,
          tokenOut: ETH_ADDRESS,
          tradeType,
          route: [
            [
              mockV3PoolInRoute(
                WETH_USDC_V3,
                USDC,
                WETH,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v3 - multi pool erc20 <> erc20', async () => {
        const [tokenIn, tokenOut] = [DAI, WETH]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = await V3Trade.fromRoute(
          new V3Route([USDC_DAI_V3, WETH_USDC_V3], tokenIn, tokenOut),
          rawInputAmount,
          tradeType
        )
        const classicQuote: PartialClassicQuote = {
          tokenIn: DAI.address,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [
              mockV3PoolInRoute(
                USDC_DAI_V3,
                DAI,
                USDC,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
              mockV3PoolInRoute(
                WETH_USDC_V3,
                USDC,
                WETH,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      it('v4 - multi pool erc20 <> erc20', async () => {
        const [tokenIn, tokenOut] = [DAI, WETH]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade = await V4Trade.fromRoute(
          new V4Route([USDC_DAI_V4, WETH_USDC_V4], tokenIn, tokenOut),
          rawInputAmount,
          tradeType
        )
        const classicQuote: PartialClassicQuote = {
          tokenIn: DAI.address,
          tokenOut: WETH.address,
          tradeType,
          route: [
            [
              mockV4PoolInRoute(
                USDC_DAI_V4,
                DAI,
                USDC,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
              mockV4PoolInRoute(
                WETH_USDC_V4,
                USDC,
                WETH,
                trade.inputAmount.quotient.toString(),
                trade.outputAmount.quotient.toString()
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
      })

      if (tradeType === TradeType.EXACT_INPUT) {
        it('v2/v3 - mixed route erc20 <> erc20', async () => {
          const [tokenIn, tokenOut] = [DAI, WETH]
          const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
          const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
          const opts = swapOptions({})
          const trade = await MixedRouteTrade.fromRoute(
            new MixedRouteSDK([USDC_DAI_V3, WETH_USDC_V2], tokenIn, tokenOut),
            rawInputAmount,
            tradeType
          )
          const classicQuote: PartialClassicQuote = {
            tokenIn: DAI.address,
            tokenOut: USDC.address,
            tradeType,
            route: [
              [
                mockV3PoolInRoute(
                  USDC_DAI_V3,
                  DAI,
                  USDC,
                  trade.inputAmount.quotient.toString(),
                  trade.outputAmount.quotient.toString()
                ),
                mockV2PoolInRoute(
                  WETH_USDC_V2,
                  USDC,
                  WETH,
                  trade.inputAmount.quotient.toString(),
                  trade.outputAmount.quotient.toString()
                ),
              ],
            ],
          }
          const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
          compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
        })

        it('v2/v3/v4 - mixed route erc20 <> erc20', async () => {
          const [tokenIn, tokenOut] = [DAI, WETH]
          const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
          const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
          const opts = swapOptions({})
          const trade = await MixedRouteTrade.fromRoute(
            new MixedRouteSDK([USDC_DAI_V2, WETH_USDC_V3, WETH_USDC_V4], tokenIn, tokenOut),
            rawInputAmount,
            tradeType
          )
          const classicQuote: PartialClassicQuote = {
            tokenIn: DAI.address,
            tokenOut: WETH.address,
            tradeType,
            route: [
              [
                mockV2PoolInRoute(
                  USDC_DAI_V2,
                  DAI,
                  USDC,
                  trade.inputAmount.quotient.toString(),
                  trade.outputAmount.quotient.toString()
                ),
                mockV3PoolInRoute(
                  WETH_USDC_V3,
                  USDC,
                  WETH,
                  trade.inputAmount.quotient.toString(),
                  trade.outputAmount.quotient.toString()
                ),
                mockV4PoolInRoute(
                  WETH_USDC_V4,
                  WETH,
                  USDC,
                  trade.inputAmount.quotient.toString(),
                  trade.outputAmount.quotient.toString()
                ),
              ],
            ],
          }
          const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
          compareUniswapTrades(new UniswapTrade(buildTrade([trade]), opts), new UniswapTrade(routerTrade, opts))
        })
      }

      it('v3 - handles split routes properly', async () => {
        const [tokenIn, tokenOut] = [WETH, USDC]
        const inputAmount = (10n ** BigInt(getAmountToken(tokenIn, tokenOut, tradeType).decimals)).toString()
        const rawInputAmount = getAmount(tokenIn, tokenOut, inputAmount, tradeType)
        const opts = swapOptions({})
        const trade1 = await V3Trade.fromRoute(
          new V3Route([WETH_USDC_V3], tokenIn, tokenOut),
          rawInputAmount.divide(2),
          tradeType
        )
        const trade2 = await V3Trade.fromRoute(
          new V3Route([WETH_USDC_V3_LOW_FEE], tokenIn, tokenOut),
          rawInputAmount.divide(2),
          tradeType
        )
        const splitRouteInputAmounts = [trade1.inputAmount.quotient.toString(), trade2.inputAmount.quotient.toString()]
        const splitRouteOutputAmounts = [
          trade1.outputAmount.quotient.toString(),
          trade2.outputAmount.quotient.toString(),
        ]
        const classicQuote: PartialClassicQuote = {
          tokenIn: WETH.address,
          tokenOut: USDC.address,
          tradeType,
          route: [
            [mockV3PoolInRoute(WETH_USDC_V3, WETH, USDC, splitRouteInputAmounts[0]!, splitRouteOutputAmounts[0]!)],
            [
              mockV3PoolInRoute(
                WETH_USDC_V3_LOW_FEE,
                WETH,
                USDC,
                splitRouteInputAmounts[1]!,
                splitRouteOutputAmounts[1]!
              ),
            ],
          ],
        }
        const routerTrade = RouterTradeAdapter.fromClassicQuote(classicQuote)
        compareUniswapTrades(new UniswapTrade(buildTrade([trade1, trade2]), opts), new UniswapTrade(routerTrade, opts))
      })
    })
  }

  describe('RouterTradeAdapter handles malformed classic quote', () => {
    it('throws on missing route', () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing malformed input
      const classicQuote: any = { tokenIn: WETH.address, tokenOut: USDC.address, tradeType: TradeType.EXACT_INPUT }
      expect(() => RouterTradeAdapter.fromClassicQuote(classicQuote)).toThrow('Expected route to be present')
    })
    it('throws on no route', () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing malformed input
      const classicQuote: any = {
        tokenIn: WETH.address,
        tokenOut: USDC.address,
        tradeType: TradeType.EXACT_INPUT,
        route: [],
      }
      expect(() => RouterTradeAdapter.fromClassicQuote(classicQuote)).toThrow('Expected there to be at least one route')
    })
    it('throws on route with no pools', () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing malformed input
      const classicQuote: any = {
        tokenIn: WETH.address,
        tokenOut: USDC.address,
        tradeType: TradeType.EXACT_INPUT,
        route: [[]],
      }
      expect(() => RouterTradeAdapter.fromClassicQuote(classicQuote)).toThrow(
        'Expected all routes to have at least one pool'
      )
    })
    it('throws on quote missing tokenIn/Out', () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing malformed input
      const classicQuote: any = {
        tokenIn: WETH.address,
        tokenOut: USDC.address,
        tradeType: TradeType.EXACT_INPUT,
        route: [[{ ...mockV2PoolInRoute(USDC_DAI_V2, DAI, USDC, '1000', '1000'), tokenIn: undefined }]],
      }
      expect(() => RouterTradeAdapter.fromClassicQuote(classicQuote)).toThrow(
        'Expected both tokenIn and tokenOut to be present'
      )
    })
    it('throws on route with mismatched chainIds', () => {
      const classicQuote: PartialClassicQuote = {
        tokenIn: DAI.address,
        tokenOut: USDC.address,
        tradeType: TradeType.EXACT_INPUT,
        route: [
          [
            {
              ...mockV2PoolInRoute(USDC_DAI_V2, DAI, USDC, '1000', '1000'),
              tokenIn: { address: DAI.address, chainId: 2, symbol: DAI.symbol!, decimals: String(DAI.decimals) },
            },
          ],
        ],
      }
      expect(() => RouterTradeAdapter.fromClassicQuote(classicQuote)).toThrow(
        'Expected tokenIn and tokenOut to be have same chainId'
      )
    })
    it('throws on route with missing amountIn/Out', () => {
      // biome-ignore lint/suspicious/noExplicitAny: testing malformed input
      const classicQuote: any = {
        tokenIn: WETH.address,
        tokenOut: USDC.address,
        tradeType: TradeType.EXACT_INPUT,
        route: [[{ ...mockV2PoolInRoute(USDC_DAI_V2, DAI, USDC, '1000', '1000'), amountIn: undefined }]],
      }
      expect(() => RouterTradeAdapter.fromClassicQuote(classicQuote)).toThrow(
        'Expected both raw amountIn and raw amountOut to be present'
      )
    })
  })

  describe('migrate', () => {
    it('encodes a migration to eth', () => {
      const tokenId = 377972
      const permit = {
        spender: UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, 1),
        tokenId,
        deadline: MAX_UINT160.toString(),
        nonce: 0,
      }
      const signature = signNftPermit(
        permit,
        NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[ChainId.MAINNET]!,
        ChainId.MAINNET,
        TEST_PRIVATE_KEY
      )
      const opts = Object.assign({
        inputPosition: new Position({
          pool: WETH_USDC_V3,
          liquidity: 72249373570746,
          tickLower: 200040,
          tickUpper: 300000,
        }),
        outputPosition: new V4Position({
          pool: ETH_USDC_V4,
          liquidity: 100000,
          tickLower: -200040,
          tickUpper: 300000,
        }),
        v3RemoveLiquidityOptions: {
          tokenId,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: MAX_UINT160,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: FORGE_V4_POSITION_MANAGER,
          },
          permit: {
            v: signature.v,
            r: signature.r,
            s: signature.s,
            deadline: permit.deadline,
            spender: permit.spender,
          },
        },
        v4AddLiquidityOptions: {
          deadline: MAX_UINT160,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
          useNative: ETHER,
        },
      })
      const methodParameters = SwapRouter.migrateV3ToV4CallParameters(opts, FORGE_V4_POSITION_MANAGER)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a migration from erc20 to erc20', () => {
      const tokenId = 377972
      const permit = {
        spender: UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, 1),
        tokenId,
        deadline: MAX_UINT160.toString(),
        nonce: 0,
      }
      const signature = signNftPermit(
        permit,
        NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[ChainId.MAINNET]!,
        ChainId.MAINNET,
        TEST_PRIVATE_KEY
      )
      const opts = Object.assign({
        inputPosition: new Position({
          pool: WETH_USDC_V3,
          liquidity: 72249373570746,
          tickLower: 200040,
          tickUpper: 300000,
        }),
        outputPosition: new V4Position({
          pool: WETH_USDC_V4,
          liquidity: 100000,
          tickLower: -200040,
          tickUpper: 300000,
        }),
        v3RemoveLiquidityOptions: {
          tokenId,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: MAX_UINT160,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: FORGE_V4_POSITION_MANAGER,
          },
          permit: {
            v: signature.v,
            r: signature.r,
            s: signature.s,
            deadline: permit.deadline,
            spender: permit.spender,
          },
        },
        v4AddLiquidityOptions: {
          deadline: MAX_UINT160,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
        },
      })
      const methodParameters = SwapRouter.migrateV3ToV4CallParameters(opts, FORGE_V4_POSITION_MANAGER)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a migration from erc20 to eth if no v3 permit', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: WETH_USDC_V3,
          liquidity: 72249373570746,
          tickLower: 200040,
          tickUpper: 300000,
        }),
        outputPosition: new V4Position({
          pool: ETH_USDC_V4,
          liquidity: 100000,
          tickLower: -200040,
          tickUpper: 300000,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 377972,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: MAX_UINT160,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: FORGE_V4_POSITION_MANAGER,
          },
        },
        v4AddLiquidityOptions: {
          deadline: MAX_UINT160,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
          useNative: ETHER,
        },
      })
      const methodParameters = SwapRouter.migrateV3ToV4CallParameters(opts, FORGE_V4_POSITION_MANAGER)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a migration from erc20 to erc20 if no v3 permit', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: WETH_USDC_V3,
          liquidity: 72249373570746,
          tickLower: 200040,
          tickUpper: 300000,
        }),
        outputPosition: new V4Position({
          pool: WETH_USDC_V4,
          liquidity: 100000,
          tickLower: -200040,
          tickUpper: 300000,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 377972,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: MAX_UINT160,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: FORGE_V4_POSITION_MANAGER,
          },
        },
        v4AddLiquidityOptions: {
          deadline: MAX_UINT160,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
        },
      })
      const methodParameters = SwapRouter.migrateV3ToV4CallParameters(opts, FORGE_V4_POSITION_MANAGER)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a migration including pool initialization to eth', () => {
      const tokenId = 377972
      const permit = {
        spender: UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, 1),
        tokenId,
        deadline: MAX_UINT160.toString(),
        nonce: 0,
      }
      const signature = signNftPermit(
        permit,
        NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[ChainId.MAINNET]!,
        ChainId.MAINNET,
        TEST_PRIVATE_KEY
      )
      const superLowFeePool = new V4Pool(ETHER, USDC, 100, 10, ZERO_ADDRESS, encodeSqrtRatioX96(1, 1), 100000, 0)
      const opts = Object.assign({
        inputPosition: new Position({
          pool: WETH_USDC_V3,
          liquidity: 72249373570746,
          tickLower: 200040,
          tickUpper: 300000,
        }),
        outputPosition: new V4Position({
          pool: superLowFeePool,
          liquidity: 100000,
          tickLower: -200040,
          tickUpper: 300000,
        }),
        v3RemoveLiquidityOptions: {
          tokenId,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: MAX_UINT160,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: FORGE_V4_POSITION_MANAGER,
          },
          permit: {
            v: signature.v,
            r: signature.r,
            s: signature.s,
            deadline: permit.deadline,
            spender: permit.spender,
          },
        },
        v4AddLiquidityOptions: {
          deadline: MAX_UINT160,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
          createPool: true,
          useNative: ETHER,
        },
      })
      const methodParameters = SwapRouter.migrateV3ToV4CallParameters(opts, FORGE_V4_POSITION_MANAGER)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('encodes a migration including pool initialization to erc20', () => {
      const tokenId = 377972
      const permit = {
        spender: UNIVERSAL_ROUTER_ADDRESS(UniversalRouterVersion.V2_0, 1),
        tokenId,
        deadline: MAX_UINT160.toString(),
        nonce: 0,
      }
      const signature = signNftPermit(
        permit,
        NONFUNGIBLE_POSITION_MANAGER_ADDRESSES[ChainId.MAINNET]!,
        ChainId.MAINNET,
        TEST_PRIVATE_KEY
      )
      const superLowFeePool = new V4Pool(USDC, WETH, 100, 10, ZERO_ADDRESS, encodeSqrtRatioX96(1, 1), 100000, 0)
      const opts = Object.assign({
        inputPosition: new Position({
          pool: WETH_USDC_V3,
          liquidity: 72249373570746,
          tickLower: 200040,
          tickUpper: 300000,
        }),
        outputPosition: new V4Position({
          pool: superLowFeePool,
          liquidity: 100000,
          tickLower: -200040,
          tickUpper: 300000,
        }),
        v3RemoveLiquidityOptions: {
          tokenId,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: MAX_UINT160,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: FORGE_V4_POSITION_MANAGER,
          },
          permit: {
            v: signature.v,
            r: signature.r,
            s: signature.s,
            deadline: permit.deadline,
            spender: permit.spender,
          },
        },
        v4AddLiquidityOptions: {
          deadline: MAX_UINT160,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
          createPool: true,
        },
      })
      const methodParameters = SwapRouter.migrateV3ToV4CallParameters(opts, FORGE_V4_POSITION_MANAGER)
      expect(BigInt(methodParameters.value).toString()).toBe('0')
    })

    it('throws if token0s are different', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: USDC_DAI_V3,
          liquidity: 1,
          tickLower: -USDC_DAI_V3.tickSpacing,
          tickUpper: USDC_DAI_V3.tickSpacing,
        }),
        outputPosition: new V4Position({
          pool: WETH_USDC_V4,
          liquidity: 1,
          tickLower: -WETH_USDC_V4.tickSpacing,
          tickUpper: WETH_USDC_V4.tickSpacing,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 1,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: 1,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(DAI, 0),
            recipient: TEST_RECIPIENT_ADDRESS,
          },
        },
        v4AddLiquidityOptions: {
          deadline: 1,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
        },
      })
      expect(() => SwapRouter.migrateV3ToV4CallParameters(opts)).toThrow('TOKEN0_MISMATCH')
    })

    it('throws if token1s are different', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: USDC_DAI_V3,
          liquidity: 1,
          tickLower: -USDC_DAI_V3.tickSpacing,
          tickUpper: USDC_DAI_V3.tickSpacing,
        }),
        outputPosition: new V4Position({
          pool: new V4Pool(
            DAI,
            WETH,
            FeeAmount.LOW,
            10,
            '0x0000000000000000000000000000000000000000',
            encodeSqrtRatioX96(1, 1),
            0,
            0
          ),
          liquidity: 1,
          tickLower: -10,
          tickUpper: 10,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 1,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: 1,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(DAI, 0),
            recipient: TEST_RECIPIENT_ADDRESS,
          },
        },
        v4AddLiquidityOptions: {
          deadline: 1,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
        },
      })
      expect(() => SwapRouter.migrateV3ToV4CallParameters(opts)).toThrow('TOKEN1_MISMATCH')
    })

    it('throws if not migrating 100%', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: USDC_DAI_V3,
          liquidity: 1,
          tickLower: -USDC_DAI_V3.tickSpacing,
          tickUpper: USDC_DAI_V3.tickSpacing,
        }),
        outputPosition: new V4Position({
          pool: USDC_DAI_V4,
          liquidity: 1,
          tickLower: -USDC_DAI_V4.tickSpacing,
          tickUpper: USDC_DAI_V4.tickSpacing,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 1,
          liquidityPercentage: new Percent(90),
          slippageTolerance: new Percent(5, 100),
          deadline: 1,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(DAI, 0),
            recipient: TEST_RECIPIENT_ADDRESS,
          },
        },
        v4AddLiquidityOptions: {
          deadline: 1,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
        },
      })
      expect(() => SwapRouter.migrateV3ToV4CallParameters(opts)).toThrow('FULL_REMOVAL_REQUIRED')
    })

    it('burn required for v3', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: USDC_DAI_V3,
          liquidity: 1,
          tickLower: -USDC_DAI_V3.tickSpacing,
          tickUpper: USDC_DAI_V3.tickSpacing,
        }),
        outputPosition: new V4Position({
          pool: USDC_DAI_V4,
          liquidity: 1,
          tickLower: -USDC_DAI_V4.tickSpacing,
          tickUpper: USDC_DAI_V4.tickSpacing,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 1,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: 1,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(DAI, 0),
            recipient: TEST_RECIPIENT_ADDRESS,
          },
        },
        v4AddLiquidityOptions: {
          deadline: 1,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
        },
      })
      expect(() => SwapRouter.migrateV3ToV4CallParameters(opts)).toThrow('BURN_TOKEN_REQUIRED')
    })

    it('throws if not minting when migrating', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: USDC_DAI_V3,
          liquidity: 1,
          tickLower: -USDC_DAI_V3.tickSpacing,
          tickUpper: USDC_DAI_V3.tickSpacing,
        }),
        outputPosition: new V4Position({
          pool: USDC_DAI_V4,
          liquidity: 1,
          tickLower: -USDC_DAI_V4.tickSpacing,
          tickUpper: USDC_DAI_V4.tickSpacing,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 1,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: 1,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: CHAIN_TO_ADDRESSES_MAP[ChainId.MAINNET]!.v4PositionManagerAddress,
          },
        },
        v4AddLiquidityOptions: {
          migrate: true,
          deadline: 1,
          slippageTolerance: new Percent(5, 100),
          sqrtPriceX96: encodeSqrtRatioX96(1, 1),
        },
      })
      expect(() => SwapRouter.migrateV3ToV4CallParameters(opts)).toThrow('MINT_REQUIRED')
    })

    it('throws if migrating weth to eth with token mismatch', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: WETH_USDC_V3,
          liquidity: 1,
          tickLower: -WETH_USDC_V3.tickSpacing,
          tickUpper: WETH_USDC_V3.tickSpacing,
        }),
        outputPosition: new V4Position({
          pool: ETH_DAI_V4,
          liquidity: 1,
          tickLower: -ETH_DAI_V4.tickSpacing,
          tickUpper: ETH_DAI_V4.tickSpacing,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 1,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: 1,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: CHAIN_TO_ADDRESSES_MAP[ChainId.MAINNET]!.v4PositionManagerAddress,
          },
        },
        v4AddLiquidityOptions: {
          migrate: true,
          deadline: 1,
          slippageTolerance: new Percent(5, 100),
          sqrtPriceX96: encodeSqrtRatioX96(1, 1),
          useNative: ETHER,
          recipient: TEST_RECIPIENT_ADDRESS,
        },
      })
      expect(() => SwapRouter.migrateV3ToV4CallParameters(opts)).toThrow('TOKEN_MISMATCH')
    })

    it('throws if migrating flag not set', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: USDC_DAI_V3,
          liquidity: 1,
          tickLower: -USDC_DAI_V3.tickSpacing,
          tickUpper: USDC_DAI_V3.tickSpacing,
        }),
        outputPosition: new V4Position({
          pool: USDC_DAI_V4,
          liquidity: 1,
          tickLower: -USDC_DAI_V4.tickSpacing,
          tickUpper: USDC_DAI_V4.tickSpacing,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 1,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: 1,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: CHAIN_TO_ADDRESSES_MAP[ChainId.MAINNET]!.v4PositionManagerAddress,
          },
        },
        v4AddLiquidityOptions: {
          deadline: 1,
          migrate: false,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
        },
      })
      expect(() => SwapRouter.migrateV3ToV4CallParameters(opts)).toThrow('MIGRATE_REQUIRED')
    })

    it('throws if not permitting the Universal router', () => {
      const opts = Object.assign({
        inputPosition: new Position({
          pool: USDC_DAI_V3,
          liquidity: 1,
          tickLower: -USDC_DAI_V3.tickSpacing,
          tickUpper: USDC_DAI_V3.tickSpacing,
        }),
        outputPosition: new V4Position({
          pool: USDC_DAI_V4,
          liquidity: 1,
          tickLower: -USDC_DAI_V4.tickSpacing,
          tickUpper: USDC_DAI_V4.tickSpacing,
        }),
        v3RemoveLiquidityOptions: {
          tokenId: 1,
          liquidityPercentage: new Percent(100, 100),
          slippageTolerance: new Percent(5, 100),
          deadline: 1,
          burnToken: true,
          collectOptions: {
            expectedCurrencyOwed0: CurrencyAmount.fromRawAmount(USDC, 0),
            expectedCurrencyOwed1: CurrencyAmount.fromRawAmount(WETH, 0),
            recipient: CHAIN_TO_ADDRESSES_MAP[ChainId.MAINNET]!.v4PositionManagerAddress,
          },
          permit: {
            v: 0,
            r: '0x0000000000000000000000000000000000000000000000000000000000000001',
            s: '0x0000000000000000000000000000000000000000000000000000000000000002',
            deadline: 1,
            spender: TEST_RECIPIENT_ADDRESS,
          },
        },
        v4AddLiquidityOptions: {
          deadline: 1,
          migrate: true,
          slippageTolerance: new Percent(5, 100),
          recipient: TEST_RECIPIENT_ADDRESS,
        },
      })
      expect(() => SwapRouter.migrateV3ToV4CallParameters(opts)).toThrow('INVALID_SPENDER')
    })
  })
})
