import { AbiParameters } from 'ox'
import type { PoolKey } from '../entities/pool'
import type { PathKey } from './encodeRouteToPath'
import { Actions, Subparser, V4_BASE_ACTIONS_ABI_DEFINITION } from './v4Planner'

export type Param = {
  readonly name: string
  readonly value: unknown
}

export type V4RouterAction = {
  readonly actionName: string
  readonly actionType: Actions
  readonly params: readonly Param[]
}

export type V4RouterCall = {
  readonly actions: readonly V4RouterAction[]
}

export type SwapExactInSingle = {
  readonly poolKey: PoolKey
  readonly zeroForOne: boolean
  readonly amountIn: string
  readonly amountOutMinimum: string
  readonly hookData: string
}

export type SwapExactIn = {
  readonly currencyIn: string
  readonly path: readonly PathKey[]
  readonly amountIn: string
  readonly amountOutMinimum: string
}

export type SwapExactOutSingle = {
  readonly poolKey: PoolKey
  readonly zeroForOne: boolean
  readonly amountOut: string
  readonly amountInMaximum: string
  readonly hookData: string
}

export type SwapExactOut = {
  readonly currencyOut: string
  readonly path: readonly PathKey[]
  readonly amountOut: string
  readonly amountInMaximum: string
}

function parsePoolKey(data: unknown[]): PoolKey {
  const [currency0, currency1, fee, tickSpacing, hooks] = data as [string, string, number, number, string]
  return {
    currency0,
    currency1,
    fee: Number(fee),
    tickSpacing: Number(tickSpacing),
    hooks,
  }
}

function parsePathKey(data: unknown[]): PathKey {
  const [intermediateCurrency, fee, tickSpacing, hooks, hookData] = data as [string, number, number, string, string]
  return {
    intermediateCurrency,
    fee: Number(fee),
    tickSpacing: Number(tickSpacing),
    hooks,
    hookData,
  }
}

function parseV4ExactInSingle(data: unknown[]): SwapExactInSingle {
  const [poolKey, zeroForOne, amountIn, amountOutMinimum, hookData] = data as [
    unknown[],
    boolean,
    bigint,
    bigint,
    string,
  ]
  const [currency0, currency1, fee, tickSpacing, hooks] = poolKey as [string, string, number, number, string]
  return {
    poolKey: {
      currency0,
      currency1,
      fee: Number(fee),
      tickSpacing: Number(tickSpacing),
      hooks,
    },
    zeroForOne,
    amountIn: amountIn.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
    hookData,
  }
}

function parseV4ExactIn(data: unknown[]): SwapExactIn {
  const [currencyIn, path, amountIn, amountOutMinimum] = data as [string, unknown[][], bigint, bigint]
  const paths: PathKey[] = path.map((pathKey) => parsePathKey(pathKey))
  return {
    path: paths,
    currencyIn,
    amountIn: amountIn.toString(),
    amountOutMinimum: amountOutMinimum.toString(),
  }
}

function parseV4ExactOutSingle(data: unknown[]): SwapExactOutSingle {
  const [poolKey, zeroForOne, amountOut, amountInMaximum, hookData] = data as [
    unknown[],
    boolean,
    bigint,
    bigint,
    string,
  ]
  const [currency0, currency1, fee, tickSpacing, hooks] = poolKey as [string, string, number, number, string]
  return {
    poolKey: {
      currency0,
      currency1,
      fee: Number(fee),
      tickSpacing: Number(tickSpacing),
      hooks,
    },
    zeroForOne,
    amountOut: amountOut.toString(),
    amountInMaximum: amountInMaximum.toString(),
    hookData,
  }
}

function parseV4ExactOut(data: unknown[]): SwapExactOut {
  const [currencyOut, path, amountOut, amountInMaximum] = data as [string, unknown[][], bigint, bigint]
  const paths: PathKey[] = path.map((pathKey) => parsePathKey(pathKey))
  return {
    path: paths,
    currencyOut,
    amountOut: amountOut.toString(),
    amountInMaximum: amountInMaximum.toString(),
  }
}

/**
 * V4BaseActionsParser parses encoded calldata from V4 Router operations.
 */
export abstract class V4BaseActionsParser {
  /**
   * Parse encoded calldata into structured action data
   * @param calldata The encoded calldata bytes
   * @returns Parsed V4RouterCall with all actions
   */
  public static parseCalldata(calldata: string): V4RouterCall {
    const decoded = AbiParameters.decode([{ type: 'bytes' }, { type: 'bytes[]' }], calldata as `0x${string}`)
    const [actions, inputs] = decoded as [string, string[]]

    const actionTypes = V4BaseActionsParser.getActions(actions)

    return {
      actions: actionTypes.map((actionType: Actions, i: number) => {
        const abiDef = V4_BASE_ACTIONS_ABI_DEFINITION[actionType]
        const types = abiDef.map((command) => ({ type: command.type }))
        const rawParams = AbiParameters.decode(types, inputs[i] as `0x${string}`)

        const params = rawParams.map((param, j) => {
          switch (abiDef[j]?.subparser) {
            case Subparser.V4SwapExactInSingle:
              return {
                name: abiDef[j]!.name,
                value: parseV4ExactInSingle(param as unknown[]),
              }
            case Subparser.V4SwapExactIn:
              return {
                name: abiDef[j]!.name,
                value: parseV4ExactIn(param as unknown[]),
              }
            case Subparser.V4SwapExactOutSingle:
              return {
                name: abiDef[j]!.name,
                value: parseV4ExactOutSingle(param as unknown[]),
              }
            case Subparser.V4SwapExactOut:
              return {
                name: abiDef[j]!.name,
                value: parseV4ExactOut(param as unknown[]),
              }
            case Subparser.PoolKey:
              return {
                name: abiDef[j]!.name,
                value: parsePoolKey(param as unknown[]),
              }
            default:
              return {
                name: abiDef[j]!.name,
                value: param,
              }
          }
        })

        return {
          actionName: Actions[actionType],
          actionType,
          params,
        }
      }),
    }
  }

  /**
   * Parse command types from bytes string
   */
  private static getActions(actions: string): Actions[] {
    const actionTypes: Actions[] = []

    for (let i = 2; i < actions.length; i += 2) {
      const byte = actions.substring(i, i + 2)
      actionTypes.push(Number.parseInt(byte, 16) as Actions)
    }

    return actionTypes
  }
}
