import invariant from 'tiny-invariant'
import { ROUTER_AS_RECIPIENT, WETH_ADDRESS } from '../../utils/constants'
import { type Permit2Permit, encodeInputTokenOptions } from '../../utils/inputTokens'
import { CommandType, type RoutePlanner } from '../../utils/routerCommands'
import { type Command, RouterActionType, type TradeConfig } from '../Command'

export class UnwrapWETH implements Command {
  readonly tradeType: RouterActionType = RouterActionType.UnwrapWETH
  readonly permit2Data?: Permit2Permit
  readonly wethAddress: string
  readonly amount: bigint

  constructor(amount: bigint, chainId: number, permit2?: Permit2Permit) {
    this.wethAddress = WETH_ADDRESS(chainId)
    this.amount = amount

    if (permit2) {
      invariant(
        permit2.details.token.toLowerCase() === this.wethAddress.toLowerCase(),
        `must be permitting WETH address: ${this.wethAddress}`
      )
      invariant(permit2.details.amount >= amount, 'Did not permit enough WETH for unwrapWETH transaction')
      this.permit2Data = permit2
    }
  }

  encode(planner: RoutePlanner, _: TradeConfig): void {
    encodeInputTokenOptions(planner, {
      permit2Permit: this.permit2Data,
      permit2TransferFrom: {
        token: this.wethAddress,
        amount: this.amount.toString(),
      },
    })
    planner.addCommand(CommandType.UNWRAP_WETH, [ROUTER_AS_RECIPIENT, this.amount])
  }
}
