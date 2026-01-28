import { type BigintIsh, type Token, validateAndParseAddress } from '@muniswap/sdk-core'
import IUniswapV3Staker from '@uniswap/v3-staker/artifacts/contracts/UniswapV3Staker.sol/UniswapV3Staker.json' with {
  type: 'json',
}
import { AbiFunction, AbiParameters, type Address, type Hex } from 'ox'
import { Pool } from './entities'
import { encodeMulticall } from './multicall'
import { type MethodParameters, toHex } from './utils'

const stakerAbi = IUniswapV3Staker.abi as readonly {
  inputs: readonly {
    internalType: string
    name: string
    type: string
    components?: readonly { internalType: string; name: string; type: string }[]
  }[]
  name: string
  outputs: readonly { internalType: string; name: string; type: string }[]
  stateMutability: string
  type: string
}[]

// Extract function ABIs
const unstakeTokenAbi = stakerAbi.find((item) => item.name === 'unstakeToken')!
const claimRewardAbi = stakerAbi.find((item) => item.name === 'claimReward')!
const stakeTokenAbi = stakerAbi.find((item) => item.name === 'stakeToken')!
const withdrawTokenAbi = stakerAbi.find((item) => item.name === 'withdrawToken')!

/**
 * Represents a unique staking program.
 */
export interface IncentiveKey {
  /**
   * The token rewarded for participating in the staking program.
   */
  rewardToken: Token

  /**
   * The pool that the staked positions must provide in.
   */
  pool: Pool

  /**
   * The time when the incentive program begins.
   */
  startTime: BigintIsh

  /**
   * The time that the incentive program ends.
   */
  endTime: BigintIsh

  /**
   * The address which receives any remaining reward tokens at `endTime`.
   */
  refundee: string
}

/**
 * Options to specify when claiming rewards.
 */
export interface ClaimOptions {
  /**
   * The id of the NFT.
   */
  tokenId: BigintIsh

  /**
   * Address to send rewards to.
   */
  recipient: string

  /**
   * The amount of `rewardToken` to claim. 0 claims all.
   */
  amount?: BigintIsh
}

/**
 * Options to specify when withdrawing a position.
 */
export interface WithdrawOptions {
  /**
   * Set when withdrawing. The position will be sent to `owner` on withdraw.
   */
  owner: string

  /**
   * Set when withdrawing. `data` is passed to `safeTransferFrom` when transferring the position from contract back to owner.
   */
  data?: Hex.Hex
}

export type FullWithdrawOptions = ClaimOptions & WithdrawOptions

/**
 * Encodes an incentive key for use in staking calls.
 */
function encodeIncentiveKey(incentiveKey: IncentiveKey): {
  rewardToken: Address.Address
  pool: Address.Address
  startTime: bigint
  endTime: bigint
  refundee: Address.Address
} {
  const { token0, token1, fee } = incentiveKey.pool
  const refundee = validateAndParseAddress(incentiveKey.refundee)

  return {
    rewardToken: incentiveKey.rewardToken.address as Address.Address,
    pool: Pool.getAddress(token0, token1, fee),
    startTime: BigInt(incentiveKey.startTime),
    endTime: BigInt(incentiveKey.endTime),
    refundee: refundee as Address.Address,
  }
}

/**
 * Encodes the claim calls (unstake + claim reward).
 */
function encodeClaim(incentiveKey: IncentiveKey, options: ClaimOptions): Hex.Hex[] {
  const calldatas: Hex.Hex[] = []
  const key = encodeIncentiveKey(incentiveKey)

  // Unstake
  calldatas.push(
    AbiFunction.encodeData(unstakeTokenAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      key,
      BigInt(options.tokenId),
    ]) as Hex.Hex
  )

  // Claim reward
  const recipient = validateAndParseAddress(options.recipient)
  const amount = options.amount ?? 0n
  calldatas.push(
    AbiFunction.encodeData(claimRewardAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      incentiveKey.rewardToken.address as Address.Address,
      recipient as Address.Address,
      BigInt(amount),
    ]) as Hex.Hex
  )

  return calldatas
}

/**
 * Produces the calldata for collecting rewards and re-staking.
 *
 * @param incentiveKeys - An IncentiveKey or array of IncentiveKeys that `tokenId` is staked in
 * @param options - ClaimOptions to specify tokenId, recipient, and amount
 * @returns The method parameters
 */
export function collectRewards(
  incentiveKeysInput: IncentiveKey | IncentiveKey[],
  options: ClaimOptions
): MethodParameters {
  const incentiveKeys = Array.isArray(incentiveKeysInput) ? incentiveKeysInput : [incentiveKeysInput]
  let calldatas: Hex.Hex[] = []

  for (const incentiveKey of incentiveKeys) {
    // Unstakes and claims for the unique program
    calldatas = calldatas.concat(encodeClaim(incentiveKey, options))

    // Re-stakes the position for the unique program
    const key = encodeIncentiveKey(incentiveKey)
    calldatas.push(
      AbiFunction.encodeData(stakeTokenAbi as Parameters<typeof AbiFunction.encodeData>[0], [
        key,
        BigInt(options.tokenId),
      ]) as Hex.Hex
    )
  }

  return {
    calldata: encodeMulticall(calldatas),
    value: toHex(0),
  }
}

/**
 * Produces the calldata for withdrawing a staked position.
 *
 * @param incentiveKeys - A list of incentiveKeys to unstake from
 * @param withdrawOptions - Options for producing claim calldata and withdraw calldata
 * @returns The method parameters
 */
export function withdrawToken(
  incentiveKeysInput: IncentiveKey | IncentiveKey[],
  withdrawOptions: FullWithdrawOptions
): MethodParameters {
  let calldatas: Hex.Hex[] = []

  const incentiveKeys = Array.isArray(incentiveKeysInput) ? incentiveKeysInput : [incentiveKeysInput]

  const claimOptions: ClaimOptions = {
    tokenId: withdrawOptions.tokenId,
    recipient: withdrawOptions.recipient,
    ...(withdrawOptions.amount !== undefined && { amount: withdrawOptions.amount }),
  }

  for (const incentiveKey of incentiveKeys) {
    calldatas = calldatas.concat(encodeClaim(incentiveKey, claimOptions))
  }

  // Withdraw the NFT
  const owner = validateAndParseAddress(withdrawOptions.owner)
  calldatas.push(
    AbiFunction.encodeData(withdrawTokenAbi as Parameters<typeof AbiFunction.encodeData>[0], [
      BigInt(withdrawOptions.tokenId),
      owner as Address.Address,
      withdrawOptions.data ?? '0x',
    ]) as Hex.Hex
  )

  return {
    calldata: encodeMulticall(calldatas),
    value: toHex(0),
  }
}

/**
 * Encodes the data for depositing and staking a position.
 *
 * @param incentiveKeys - A single IncentiveKey or array of IncentiveKeys to be encoded
 * @returns The encoded data for the deposit
 */
export function encodeDeposit(incentiveKeysInput: IncentiveKey | IncentiveKey[]): Hex.Hex {
  const incentiveKeys = Array.isArray(incentiveKeysInput) ? incentiveKeysInput : [incentiveKeysInput]

  if (incentiveKeys.length > 1) {
    const keys = incentiveKeys.map(encodeIncentiveKey)
    return AbiParameters.encode(
      [
        {
          type: 'tuple[]',
          components: [
            { type: 'address', name: 'rewardToken' },
            { type: 'address', name: 'pool' },
            { type: 'uint256', name: 'startTime' },
            { type: 'uint256', name: 'endTime' },
            { type: 'address', name: 'refundee' },
          ],
        },
      ],
      [keys]
    ) as Hex.Hex
  }
  const key = encodeIncentiveKey(incentiveKeys[0]!)
  return AbiParameters.encode(
    [
      {
        type: 'tuple',
        components: [
          { type: 'address', name: 'rewardToken' },
          { type: 'address', name: 'pool' },
          { type: 'uint256', name: 'startTime' },
          { type: 'uint256', name: 'endTime' },
          { type: 'address', name: 'refundee' },
        ],
      },
    ],
    [key]
  ) as Hex.Hex
}
