import { Token, WETH9 } from '@muniswap/sdk-core'
import { encodeSqrtRatioX96 } from '@muniswap/v3-sdk'
import { describe, expect, it } from 'vitest'
import { Pool } from '../entities/pool'
import { ADDRESS_ZERO, FEE_AMOUNT_MEDIUM, TICK_SPACING_TEN } from '../internalConstants'
import { V4BaseActionsParser } from './v4BaseActionsParser'
import { Actions, V4Planner } from './v4Planner'

describe('V4BaseActionsParser', () => {
  const DAI = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'DAI Stablecoin')
  const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin')
  const WETH = WETH9[1]!
  const recipient = '0x0000000000000000000000000000000000000003'

  const pool_DAI_USDC = new Pool(
    DAI,
    USDC,
    FEE_AMOUNT_MEDIUM,
    TICK_SPACING_TEN,
    ADDRESS_ZERO,
    encodeSqrtRatioX96(1, 1),
    0,
    0,
    []
  )

  it('parses SWEEP action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.SWEEP, [DAI.address, recipient])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('SWEEP')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.SWEEP)
    expect(parsed.actions[0]!.params[0]!.name).toEqual('currency')
    expect((parsed.actions[0]!.params[0]!.value as string).toLowerCase()).toEqual(DAI.address.toLowerCase())
    expect(parsed.actions[0]!.params[1]!.name).toEqual('recipient')
    expect((parsed.actions[0]!.params[1]!.value as string).toLowerCase()).toEqual(recipient.toLowerCase())
  })

  it('parses CLOSE_CURRENCY action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.CLOSE_CURRENCY, [DAI.address])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('CLOSE_CURRENCY')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.CLOSE_CURRENCY)
    expect(parsed.actions[0]!.params[0]!.name).toEqual('currency')
    expect((parsed.actions[0]!.params[0]!.value as string).toLowerCase()).toEqual(DAI.address.toLowerCase())
  })

  it('parses TAKE_PAIR action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.TAKE_PAIR, [DAI.address, USDC.address, recipient])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('TAKE_PAIR')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.TAKE_PAIR)
    expect(parsed.actions[0]!.params[0]!.name).toEqual('currency0')
    expect((parsed.actions[0]!.params[0]!.value as string).toLowerCase()).toEqual(DAI.address.toLowerCase())
    expect(parsed.actions[0]!.params[1]!.name).toEqual('currency1')
    expect((parsed.actions[0]!.params[1]!.value as string).toLowerCase()).toEqual(USDC.address.toLowerCase())
    expect(parsed.actions[0]!.params[2]!.name).toEqual('recipient')
    expect((parsed.actions[0]!.params[2]!.value as string).toLowerCase()).toEqual(recipient.toLowerCase())
  })

  it('parses TAKE_PORTION action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.TAKE_PORTION, [DAI.address, recipient, 5000n])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('TAKE_PORTION')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.TAKE_PORTION)
    expect(parsed.actions[0]!.params[0]!.name).toEqual('currency')
    expect(parsed.actions[0]!.params[1]!.name).toEqual('recipient')
    expect(parsed.actions[0]!.params[2]!.name).toEqual('bips')
    expect(parsed.actions[0]!.params[2]!.value).toEqual(5000n)
  })

  it('parses TAKE_ALL action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.TAKE_ALL, [DAI.address, 1000n])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('TAKE_ALL')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.TAKE_ALL)
    expect(parsed.actions[0]!.params[0]!.name).toEqual('currency')
    expect(parsed.actions[0]!.params[1]!.name).toEqual('minAmount')
    expect(parsed.actions[0]!.params[1]!.value).toEqual(1000n)
  })

  it('parses TAKE action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.TAKE, [DAI.address, recipient, 500n])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('TAKE')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.TAKE)
    expect(parsed.actions[0]!.params[0]!.name).toEqual('currency')
    expect((parsed.actions[0]!.params[0]!.value as string).toLowerCase()).toEqual(DAI.address.toLowerCase())
    expect(parsed.actions[0]!.params[1]!.name).toEqual('recipient')
    expect((parsed.actions[0]!.params[1]!.value as string).toLowerCase()).toEqual(recipient.toLowerCase())
    expect(parsed.actions[0]!.params[2]!.name).toEqual('amount')
    expect(parsed.actions[0]!.params[2]!.value).toEqual(500n)
  })

  it('parses SETTLE_PAIR action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.SETTLE_PAIR, [DAI.address, USDC.address])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('SETTLE_PAIR')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.SETTLE_PAIR)
    expect(parsed.actions[0]!.params[0]!.name).toEqual('currency0')
    expect((parsed.actions[0]!.params[0]!.value as string).toLowerCase()).toEqual(DAI.address.toLowerCase())
    expect(parsed.actions[0]!.params[1]!.name).toEqual('currency1')
    expect((parsed.actions[0]!.params[1]!.value as string).toLowerCase()).toEqual(USDC.address.toLowerCase())
  })

  it('parses SETTLE action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.SETTLE, [DAI.address, 1000n, true])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('SETTLE')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.SETTLE)
    expect(parsed.actions[0]!.params[0]!.name).toEqual('currency')
    expect((parsed.actions[0]!.params[0]!.value as string).toLowerCase()).toEqual(DAI.address.toLowerCase())
    expect(parsed.actions[0]!.params[1]!.name).toEqual('amount')
    expect(parsed.actions[0]!.params[1]!.value).toEqual(1000n)
    expect(parsed.actions[0]!.params[2]!.name).toEqual('payerIsUser')
    expect(parsed.actions[0]!.params[2]!.value).toEqual(true)
  })

  it('parses SWAP_EXACT_IN_SINGLE action', () => {
    const poolKey = pool_DAI_USDC.poolKey
    const planner = new V4Planner()
    planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
      {
        poolKey,
        zeroForOne: true,
        amountIn: 10000n,
        amountOutMinimum: 0n,
        hookData: '0x',
      },
    ])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('SWAP_EXACT_IN_SINGLE')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.SWAP_EXACT_IN_SINGLE)

    const swap = parsed.actions[0]!.params[0]!.value as {
      poolKey: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string }
      zeroForOne: boolean
      amountIn: string
      amountOutMinimum: string
      hookData: string
    }
    expect(swap.poolKey.currency0.toLowerCase()).toEqual(poolKey.currency0.toLowerCase())
    expect(swap.poolKey.currency1.toLowerCase()).toEqual(poolKey.currency1.toLowerCase())
    expect(swap.poolKey.fee).toEqual(poolKey.fee)
    expect(swap.poolKey.tickSpacing).toEqual(poolKey.tickSpacing)
    expect(swap.poolKey.hooks.toLowerCase()).toEqual(poolKey.hooks.toLowerCase())
    expect(swap.zeroForOne).toEqual(true)
    expect(swap.amountIn).toEqual('10000')
    expect(swap.amountOutMinimum).toEqual('0')
    expect(swap.hookData).toEqual('0x')
  })

  it('parses SWAP_EXACT_OUT_SINGLE action', () => {
    const poolKey = pool_DAI_USDC.poolKey
    const planner = new V4Planner()
    planner.addAction(Actions.SWAP_EXACT_OUT_SINGLE, [
      {
        poolKey,
        zeroForOne: false,
        amountOut: 5000n,
        amountInMaximum: 6000n,
        hookData: '0x',
      },
    ])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('SWAP_EXACT_OUT_SINGLE')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.SWAP_EXACT_OUT_SINGLE)

    const swap = parsed.actions[0]!.params[0]!.value as {
      poolKey: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string }
      zeroForOne: boolean
      amountOut: string
      amountInMaximum: string
      hookData: string
    }
    expect(swap.poolKey.fee).toEqual(poolKey.fee)
    expect(swap.zeroForOne).toEqual(false)
    expect(swap.amountOut).toEqual('5000')
    expect(swap.amountInMaximum).toEqual('6000')
  })

  it('parses SWAP_EXACT_IN action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.SWAP_EXACT_IN, [
      {
        currencyIn: DAI.address,
        path: [
          {
            intermediateCurrency: USDC.address,
            fee: FEE_AMOUNT_MEDIUM,
            tickSpacing: TICK_SPACING_TEN,
            hooks: ADDRESS_ZERO,
            hookData: '0x',
          },
          {
            intermediateCurrency: WETH.address,
            fee: FEE_AMOUNT_MEDIUM,
            tickSpacing: TICK_SPACING_TEN,
            hooks: ADDRESS_ZERO,
            hookData: '0x',
          },
        ],
        amountIn: 10000n,
        amountOutMinimum: 9000n,
      },
    ])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('SWAP_EXACT_IN')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.SWAP_EXACT_IN)

    const swap = parsed.actions[0]!.params[0]!.value as {
      currencyIn: string
      path: { intermediateCurrency: string; fee: number; tickSpacing: number; hooks: string; hookData: string }[]
      amountIn: string
      amountOutMinimum: string
    }
    expect(swap.currencyIn.toLowerCase()).toEqual(DAI.address.toLowerCase())
    expect(swap.path).toHaveLength(2)
    expect(swap.path[0]!.intermediateCurrency.toLowerCase()).toEqual(USDC.address.toLowerCase())
    expect(swap.path[0]!.fee).toEqual(FEE_AMOUNT_MEDIUM)
    expect(swap.path[0]!.tickSpacing).toEqual(TICK_SPACING_TEN)
    expect(swap.path[1]!.intermediateCurrency.toLowerCase()).toEqual(WETH.address.toLowerCase())
    expect(swap.amountIn).toEqual('10000')
    expect(swap.amountOutMinimum).toEqual('9000')
  })

  it('parses SWAP_EXACT_OUT action', () => {
    const planner = new V4Planner()
    planner.addAction(Actions.SWAP_EXACT_OUT, [
      {
        currencyOut: WETH.address,
        path: [
          {
            intermediateCurrency: USDC.address,
            fee: FEE_AMOUNT_MEDIUM,
            tickSpacing: TICK_SPACING_TEN,
            hooks: ADDRESS_ZERO,
            hookData: '0x',
          },
        ],
        amountOut: 5000n,
        amountInMaximum: 6000n,
      },
    ])
    const calldata = planner.finalize()

    const parsed = V4BaseActionsParser.parseCalldata(calldata)

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0]!.actionName).toEqual('SWAP_EXACT_OUT')
    expect(parsed.actions[0]!.actionType).toEqual(Actions.SWAP_EXACT_OUT)

    const swap = parsed.actions[0]!.params[0]!.value as {
      currencyOut: string
      path: { intermediateCurrency: string; fee: number; tickSpacing: number; hooks: string; hookData: string }[]
      amountOut: string
      amountInMaximum: string
    }
    expect(swap.currencyOut.toLowerCase()).toEqual(WETH.address.toLowerCase())
    expect(swap.path).toHaveLength(1)
    expect(swap.path[0]!.intermediateCurrency.toLowerCase()).toEqual(USDC.address.toLowerCase())
    expect(swap.amountOut).toEqual('5000')
    expect(swap.amountInMaximum).toEqual('6000')
  })
})
