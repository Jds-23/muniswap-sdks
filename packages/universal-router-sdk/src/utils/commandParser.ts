import { V4BaseActionsParser } from '@muniswap/v4-sdk'
import type { V4RouterAction } from '@muniswap/v4-sdk'
import { AbiFunction, AbiParameters, Address, type Hex } from 'ox'
import {
  COMMAND_DEFINITION,
  type CommandDefinition,
  CommandType,
  Parser,
  Subparser,
  parseSolidityType,
} from '../utils/routerCommands'

export type Param = {
  readonly name: string
  // biome-ignore lint/suspicious/noExplicitAny: ABI decoded values are heterogeneous
  readonly value: any
}

export type UniversalRouterCommand = {
  readonly commandName: string
  readonly commandType: CommandType
  readonly params: readonly Param[]
}

export type UniversalRouterCall = {
  readonly commands: readonly UniversalRouterCommand[]
}

export type V3PathItem = {
  readonly tokenIn: string
  readonly tokenOut: string
  readonly fee: number
}

export interface CommandsDefinition {
  [key: number]: CommandDefinition
}

const executeWithDeadlineAbi = AbiFunction.from('function execute(bytes commands, bytes[] inputs, uint256 deadline)')
const executeAbi = AbiFunction.from('function execute(bytes commands, bytes[] inputs)')

// Parses UniversalRouter V2 commands
export abstract class CommandParser {
  public static parseCalldata(calldata: string): UniversalRouterCall {
    const genericParser = new GenericCommandParser(COMMAND_DEFINITION)
    const hex = calldata as Hex.Hex
    const selector = hex.slice(0, 10)

    let commands: string
    let inputs: string[]

    // Try to decode with deadline variant first, then without
    if (selector === AbiFunction.getSelector(executeWithDeadlineAbi)) {
      const decoded = AbiFunction.decodeData(executeWithDeadlineAbi, hex)
      commands = decoded[0]
      inputs = [...decoded[1]]
    } else {
      const decoded = AbiFunction.decodeData(executeAbi, hex)
      commands = decoded[0]
      inputs = [...decoded[1]]
    }

    return genericParser.parse(commands, inputs)
  }
}

// Parses commands based on given command definition
export class GenericCommandParser {
  constructor(private readonly commandDefinition: CommandsDefinition) {}

  public parse(commands: string, inputs: string[]): UniversalRouterCall {
    const commandTypes = GenericCommandParser.getCommands(commands)

    return {
      commands: commandTypes.map((commandType: CommandType, i: number) => {
        const commandDef = this.commandDefinition[commandType]!

        if (commandDef.parser === Parser.V4Actions) {
          const { actions } = V4BaseActionsParser.parseCalldata(inputs[i]!)
          return {
            commandName: CommandType[commandType],
            commandType,
            params: v4RouterCallToParams(actions),
          }
        }
        if (commandDef.parser === Parser.Abi) {
          const abiDef = commandDef.params
          const abiParams = abiDef.map((command) => parseSolidityType(command.type, command.name))
          // biome-ignore lint/suspicious/noExplicitAny: ox ABI parameter types are complex
          const rawParams = AbiParameters.decode(abiParams as any, inputs[i]! as Hex.Hex)

          const params = rawParams.map((param, j: number) => {
            switch (abiDef[j]!.subparser) {
              case Subparser.V3PathExactIn:
                return {
                  name: abiDef[j]!.name,
                  value: parseV3PathExactIn(param as string),
                }
              case Subparser.V3PathExactOut:
                return {
                  name: abiDef[j]!.name,
                  value: parseV3PathExactOut(param as string),
                }
              default:
                return {
                  name: abiDef[j]!.name,
                  value: param,
                }
            }
          })
          return {
            commandName: CommandType[commandType],
            commandType,
            params,
          }
        }
        if (commandDef.parser === Parser.V3Actions) {
          // TODO: implement better parsing here
          return {
            commandName: CommandType[commandType],
            commandType,
            params: inputs.map((input) => ({ name: 'command', value: input })),
          }
        }
        throw new Error(`Unsupported parser: ${commandDef}`)
      }),
    }
  }

  // parse command types from bytes string
  private static getCommands(commands: string): CommandType[] {
    const commandTypes: CommandType[] = []

    for (let i = 2; i < commands.length; i += 2) {
      const byte = commands.substring(i, i + 2)
      commandTypes.push(Number.parseInt(byte, 16) as CommandType)
    }

    return commandTypes
  }
}

export function parseV3PathExactIn(path: string): readonly V3PathItem[] {
  const strippedPath = path.replace('0x', '')
  let tokenIn = Address.checksum(`0x${strippedPath.substring(0, 40)}` as Hex.Hex)
  let loc = 40
  const res: V3PathItem[] = []
  while (loc < strippedPath.length) {
    const feeAndTokenOut = strippedPath.substring(loc, loc + 46)
    const fee = Number.parseInt(feeAndTokenOut.substring(0, 6), 16)
    const tokenOut = Address.checksum(`0x${feeAndTokenOut.substring(6, 46)}` as Hex.Hex)

    res.push({
      tokenIn,
      tokenOut,
      fee,
    })
    tokenIn = tokenOut
    loc += 46
  }

  return res
}

export function parseV3PathExactOut(path: string): readonly V3PathItem[] {
  const strippedPath = path.replace('0x', '')
  let tokenIn = Address.checksum(`0x${strippedPath.substring(strippedPath.length - 40)}` as Hex.Hex)
  let loc = strippedPath.length - 86 // 86 = (20 addr + 3 fee + 20 addr) * 2 (for hex characters)
  const res: V3PathItem[] = []
  while (loc >= 0) {
    const feeAndTokenOut = strippedPath.substring(loc, loc + 46)
    const tokenOut = Address.checksum(`0x${feeAndTokenOut.substring(0, 40)}` as Hex.Hex)
    const fee = Number.parseInt(feeAndTokenOut.substring(40, 46), 16)

    res.push({
      tokenIn,
      tokenOut,
      fee,
    })
    tokenIn = tokenOut

    loc -= 46
  }

  return res
}

function v4RouterCallToParams(actions: readonly V4RouterAction[]): readonly Param[] {
  return actions.map((action) => {
    return {
      name: action.actionName,
      value: action.params.map((param) => {
        return {
          name: param.name,
          value: param.value,
        }
      }),
    }
  })
}
