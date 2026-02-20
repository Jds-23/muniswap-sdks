import { describe, expect, it } from 'vitest'
import { Tick } from './tick'
import { TickListDataProvider } from './tickListDataProvider'

describe('TickListDataProvider', () => {
  const provider = new TickListDataProvider(
    [
      new Tick({ index: -1, liquidityGross: 1, liquidityNet: 1 }),
      new Tick({ index: 1, liquidityGross: 1, liquidityNet: -1 }),
    ],
    1
  )

  describe('constructor', () => {
    it('can take Tick objects', () => {
      // construction above succeeded
      expect(provider).toBeDefined()
    })

    it('can take TickConstructorArgs', () => {
      const p = new TickListDataProvider(
        [
          { index: -1, liquidityGross: 1, liquidityNet: 1 },
          { index: 1, liquidityGross: 1, liquidityNet: -1 },
        ],
        1
      )
      expect(p).toBeDefined()
    })

    it('can take an empty list of ticks', () => {
      const p = new TickListDataProvider([], 1)
      expect(p).toBeDefined()
    })

    it('throws for 0 tick spacing', () => {
      expect(() => new TickListDataProvider([], 0)).toThrow('TICK_SPACING_NONZERO')
    })

    it('throws for invalid tick spacing', () => {
      expect(
        () =>
          new TickListDataProvider(
            [
              new Tick({ index: -1, liquidityGross: 1, liquidityNet: 1 }),
              new Tick({ index: 1, liquidityGross: 1, liquidityNet: -1 }),
            ],
            2
          )
      ).toThrow('TICK_SPACING')
    })

    it('throws for uneven tick list', () => {
      expect(
        () =>
          new TickListDataProvider(
            [
              { index: -1, liquidityNet: -1, liquidityGross: 1 },
              { index: 1, liquidityNet: 2, liquidityGross: 1 },
            ],
            1
          )
      ).toThrow('ZERO_NET')
    })
  })

  describe('#getTick', () => {
    it('gets the smallest tick from the list', async () => {
      const tick = await provider.getTick(-1)
      expect(tick.liquidityNet).toBe(1n)
      expect(tick.liquidityGross).toBe(1n)
    })

    it('gets the largest tick from the list', async () => {
      const tick = await provider.getTick(1)
      expect(tick.liquidityNet).toBe(-1n)
      expect(tick.liquidityGross).toBe(1n)
    })

    it('throws if tick not in list', async () => {
      await expect(provider.getTick(0)).rejects.toThrow('NOT_CONTAINED')
    })
  })

  describe('#nextInitializedTickWithinOneWord', () => {
    it('lte=true from initialized tick returns that tick', async () => {
      const [tick, initialized] = await provider.nextInitializedTickWithinOneWord(-1, true, 1)
      expect(tick).toBe(-1)
      expect(initialized).toBe(true)
    })

    it('lte=true from 0 clamps to word boundary', async () => {
      const [tick, initialized] = await provider.nextInitializedTickWithinOneWord(0, true, 1)
      // minimum of word containing tick 0 is 0, and nearest init tick left is -1
      // Math.max(0, -1) = 0, which is not an initialized tick
      expect(tick).toBe(0)
      expect(initialized).toBe(false)
    })

    it('lte=false returns tick to the right', async () => {
      const [tick, initialized] = await provider.nextInitializedTickWithinOneWord(0, false, 1)
      expect(tick).toBe(1)
      expect(initialized).toBe(true)
    })
  })
})
