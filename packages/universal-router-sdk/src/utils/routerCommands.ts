import { AbiParameters } from 'ox'

type AbiParamDef = {
  name: string
  type: string
  components?: AbiParamDef[]
}

/**
 * Converts a Solidity-style tuple type string to an ox-compatible ABI parameter definition.
 * e.g. '(address token,uint160 amount)' with name 'details' becomes
 * { name: 'details', type: 'tuple', components: [{name:'token',type:'address'}, ...] }
 */
export function parseSolidityType(typeStr: string, name: string): AbiParamDef {
  const trimmed = typeStr.trim()
  if (!trimmed.startsWith('(')) {
    return { name, type: trimmed }
  }

  // Find matching closing paren
  let depth = 0
  let closeIndex = -1
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '(') depth++
    if (trimmed[i] === ')') {
      depth--
      if (depth === 0) {
        closeIndex = i
        break
      }
    }
  }

  const inner = trimmed.slice(1, closeIndex)
  const suffix = trimmed.slice(closeIndex + 1).trim()
  const isArray = suffix === '[]' || suffix.startsWith('[]')

  const components = splitTopLevelCommas(inner).map((rawComp) => {
    const comp = rawComp.trim()
    if (comp.startsWith('(')) {
      // Nested tuple: find closing paren to separate type from name
      let d = 0
      let ci = -1
      for (let i = 0; i < comp.length; i++) {
        if (comp[i] === '(') d++
        if (comp[i] === ')') {
          d--
          if (d === 0) {
            ci = i
            break
          }
        }
      }
      let after = comp.slice(ci + 1).trim()
      let arrSuffix = ''
      if (after.startsWith('[]')) {
        arrSuffix = '[]'
        after = after.slice(2).trim()
      }
      return parseSolidityType(comp.slice(0, ci + 1) + arrSuffix, after)
    }
    // Simple: "type name"
    const spaceIdx = comp.indexOf(' ')
    if (spaceIdx === -1) return { name: '', type: comp }
    return { name: comp.slice(spaceIdx + 1).trim(), type: comp.slice(0, spaceIdx).trim() }
  })

  return {
    name,
    type: isArray ? 'tuple[]' : 'tuple',
    components,
  }
}

function splitTopLevelCommas(str: string): string[] {
  const result: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++
    if (str[i] === ')') depth--
    if (str[i] === ',' && depth === 0) {
      result.push(str.slice(start, i))
      start = i + 1
    }
  }
  result.push(str.slice(start))
  return result
}

/**
 * CommandTypes
 * @description Flags that modify a command's execution
 * @enum {number}
 */
export enum CommandType {
  V3_SWAP_EXACT_IN = 0x00,
  V3_SWAP_EXACT_OUT = 0x01,
  PERMIT2_TRANSFER_FROM = 0x02,
  PERMIT2_PERMIT_BATCH = 0x03,
  SWEEP = 0x04,
  TRANSFER = 0x05,
  PAY_PORTION = 0x06,

  V2_SWAP_EXACT_IN = 0x08,
  V2_SWAP_EXACT_OUT = 0x09,
  PERMIT2_PERMIT = 0x0a,
  WRAP_ETH = 0x0b,
  UNWRAP_WETH = 0x0c,
  PERMIT2_TRANSFER_FROM_BATCH = 0x0d,
  BALANCE_CHECK_ERC20 = 0x0e,

  V4_SWAP = 0x10,
  V3_POSITION_MANAGER_PERMIT = 0x11,
  V3_POSITION_MANAGER_CALL = 0x12,
  V4_INITIALIZE_POOL = 0x13,
  V4_POSITION_MANAGER_CALL = 0x14,

  EXECUTE_SUB_PLAN = 0x21,
}

export enum Subparser {
  V3PathExactIn = 0,
  V3PathExactOut = 1,
}

export enum Parser {
  Abi = 0,
  V4Actions = 1,
  V3Actions = 2,
}

export type ParamType = {
  readonly name: string
  readonly type: string
  readonly subparser?: Subparser
}

export type CommandDefinition =
  | {
      parser: Parser.Abi
      params: ParamType[]
    }
  | {
      parser: Parser.V4Actions
    }
  | {
      parser: Parser.V3Actions
    }

const ALLOW_REVERT_FLAG = 0x80
const REVERTIBLE_COMMANDS = new Set<CommandType>([CommandType.EXECUTE_SUB_PLAN])

const PERMIT_STRUCT =
  '((address token,uint160 amount,uint48 expiration,uint48 nonce) details,address spender,uint256 sigDeadline)'

const PERMIT_BATCH_STRUCT =
  '((address token,uint160 amount,uint48 expiration,uint48 nonce)[] details,address spender,uint256 sigDeadline)'

const POOL_KEY_STRUCT = '(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)'

const PERMIT2_TRANSFER_FROM_STRUCT = '(address from,address to,uint160 amount,address token)'
const PERMIT2_TRANSFER_FROM_BATCH_STRUCT = `${PERMIT2_TRANSFER_FROM_STRUCT}[]`

export const COMMAND_DEFINITION: { [key in CommandType]: CommandDefinition } = {
  // Batch Reverts
  [CommandType.EXECUTE_SUB_PLAN]: {
    parser: Parser.Abi,
    params: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
    ],
  },

  // Permit2 Actions
  [CommandType.PERMIT2_PERMIT]: {
    parser: Parser.Abi,
    params: [
      { name: 'permit', type: PERMIT_STRUCT },
      { name: 'signature', type: 'bytes' },
    ],
  },
  [CommandType.PERMIT2_PERMIT_BATCH]: {
    parser: Parser.Abi,
    params: [
      { name: 'permit', type: PERMIT_BATCH_STRUCT },
      { name: 'signature', type: 'bytes' },
    ],
  },
  [CommandType.PERMIT2_TRANSFER_FROM]: {
    parser: Parser.Abi,
    params: [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint160' },
    ],
  },
  [CommandType.PERMIT2_TRANSFER_FROM_BATCH]: {
    parser: Parser.Abi,
    params: [
      {
        name: 'transferFrom',
        type: PERMIT2_TRANSFER_FROM_BATCH_STRUCT,
      },
    ],
  },

  // Uniswap Actions
  [CommandType.V3_SWAP_EXACT_IN]: {
    parser: Parser.Abi,
    params: [
      { name: 'recipient', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', subparser: Subparser.V3PathExactIn, type: 'bytes' },
      { name: 'payerIsUser', type: 'bool' },
    ],
  },
  [CommandType.V3_SWAP_EXACT_OUT]: {
    parser: Parser.Abi,
    params: [
      { name: 'recipient', type: 'address' },
      { name: 'amountOut', type: 'uint256' },
      { name: 'amountInMax', type: 'uint256' },
      { name: 'path', subparser: Subparser.V3PathExactOut, type: 'bytes' },
      { name: 'payerIsUser', type: 'bool' },
    ],
  },
  [CommandType.V2_SWAP_EXACT_IN]: {
    parser: Parser.Abi,
    params: [
      { name: 'recipient', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'payerIsUser', type: 'bool' },
    ],
  },
  [CommandType.V2_SWAP_EXACT_OUT]: {
    parser: Parser.Abi,
    params: [
      { name: 'recipient', type: 'address' },
      { name: 'amountOut', type: 'uint256' },
      { name: 'amountInMax', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'payerIsUser', type: 'bool' },
    ],
  },
  [CommandType.V4_SWAP]: { parser: Parser.V4Actions },

  // Token Actions and Checks
  [CommandType.WRAP_ETH]: {
    parser: Parser.Abi,
    params: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  [CommandType.UNWRAP_WETH]: {
    parser: Parser.Abi,
    params: [
      { name: 'recipient', type: 'address' },
      { name: 'amountMin', type: 'uint256' },
    ],
  },
  [CommandType.SWEEP]: {
    parser: Parser.Abi,
    params: [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'amountMin', type: 'uint256' },
    ],
  },
  [CommandType.TRANSFER]: {
    parser: Parser.Abi,
    params: [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
  },
  [CommandType.PAY_PORTION]: {
    parser: Parser.Abi,
    params: [
      { name: 'token', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'bips', type: 'uint256' },
    ],
  },
  [CommandType.BALANCE_CHECK_ERC20]: {
    parser: Parser.Abi,
    params: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'minBalance', type: 'uint256' },
    ],
  },
  [CommandType.V4_INITIALIZE_POOL]: {
    parser: Parser.Abi,
    params: [
      { name: 'poolKey', type: POOL_KEY_STRUCT },
      { name: 'sqrtPriceX96', type: 'uint160' },
    ],
  },

  // Position Actions
  [CommandType.V3_POSITION_MANAGER_PERMIT]: { parser: Parser.V3Actions },
  [CommandType.V3_POSITION_MANAGER_CALL]: { parser: Parser.V3Actions },
  [CommandType.V4_POSITION_MANAGER_CALL]: { parser: Parser.V4Actions },
}

export class RoutePlanner {
  commands: string
  inputs: string[]

  constructor() {
    this.commands = '0x'
    this.inputs = []
  }

  addSubPlan(subplan: RoutePlanner): RoutePlanner {
    this.addCommand(CommandType.EXECUTE_SUB_PLAN, [subplan.commands, subplan.inputs], true)
    return this
  }

  // biome-ignore lint/suspicious/noExplicitAny: command parameters are heterogeneous
  addCommand(type: CommandType, parameters: any[], allowRevert = false): RoutePlanner {
    const command = createCommand(type, parameters)
    this.inputs.push(command.encodedInput)
    if (allowRevert) {
      if (!REVERTIBLE_COMMANDS.has(command.type)) {
        throw new Error(`command type: ${command.type} cannot be allowed to revert`)
      }
      command.type = command.type | ALLOW_REVERT_FLAG
    }

    this.commands = this.commands.concat(command.type.toString(16).padStart(2, '0'))
    return this
  }
}

export type RouterCommand = {
  type: CommandType
  encodedInput: string
}

// biome-ignore lint/suspicious/noExplicitAny: command parameters are heterogeneous
export function createCommand(type: CommandType, parameters: any[]): RouterCommand {
  const commandDef = COMMAND_DEFINITION[type]
  switch (commandDef.parser) {
    case Parser.Abi: {
      const abiParams = commandDef.params.map((p) => parseSolidityType(p.type, p.name))
      // biome-ignore lint/suspicious/noExplicitAny: ox ABI parameter types are complex
      const encodedInput = AbiParameters.encode(abiParams as any, parameters)
      return { type, encodedInput }
    }
    case Parser.V4Actions:
      // v4 swap data comes pre-encoded at index 0
      return { type, encodedInput: parameters[0] }
    case Parser.V3Actions:
      // v3 position data comes pre-encoded at index 0
      return { type, encodedInput: parameters[0] }
  }
}
