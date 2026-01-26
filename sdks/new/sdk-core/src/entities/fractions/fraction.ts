import invariant from 'tiny-invariant'
import { type BigintIsh, Rounding, toBigInt } from '../../constants'
import { divideToDecimal, formatWithSeparator, toSignificantDigits } from '../../utils/decimal'

export class Fraction {
  public readonly numerator: bigint
  public readonly denominator: bigint

  public constructor(numerator: BigintIsh, denominator: BigintIsh = 1n) {
    this.numerator = toBigInt(numerator)
    this.denominator = toBigInt(denominator)
  }

  private static tryParseFraction(fractionish: BigintIsh | Fraction): Fraction {
    if (typeof fractionish === 'bigint' || typeof fractionish === 'number' || typeof fractionish === 'string') {
      return new Fraction(fractionish)
    }

    if ('numerator' in fractionish && 'denominator' in fractionish) {
      return fractionish
    }
    throw new Error('Could not parse fraction')
  }

  /**
   * Performs floor division
   */
  public get quotient(): bigint {
    return this.numerator / this.denominator
  }

  /**
   * Remainder after floor division
   */
  public get remainder(): Fraction {
    return new Fraction(this.numerator % this.denominator, this.denominator)
  }

  public invert(): Fraction {
    return new Fraction(this.denominator, this.numerator)
  }

  public add(other: Fraction | BigintIsh): Fraction {
    const otherParsed = Fraction.tryParseFraction(other)
    if (this.denominator === otherParsed.denominator) {
      return new Fraction(this.numerator + otherParsed.numerator, this.denominator)
    }
    return new Fraction(
      this.numerator * otherParsed.denominator + otherParsed.numerator * this.denominator,
      this.denominator * otherParsed.denominator
    )
  }

  public subtract(other: Fraction | BigintIsh): Fraction {
    const otherParsed = Fraction.tryParseFraction(other)
    if (this.denominator === otherParsed.denominator) {
      return new Fraction(this.numerator - otherParsed.numerator, this.denominator)
    }
    return new Fraction(
      this.numerator * otherParsed.denominator - otherParsed.numerator * this.denominator,
      this.denominator * otherParsed.denominator
    )
  }

  public lessThan(other: Fraction | BigintIsh): boolean {
    const otherParsed = Fraction.tryParseFraction(other)
    return this.numerator * otherParsed.denominator < otherParsed.numerator * this.denominator
  }

  public equalTo(other: Fraction | BigintIsh): boolean {
    const otherParsed = Fraction.tryParseFraction(other)
    return this.numerator * otherParsed.denominator === otherParsed.numerator * this.denominator
  }

  public greaterThan(other: Fraction | BigintIsh): boolean {
    const otherParsed = Fraction.tryParseFraction(other)
    return this.numerator * otherParsed.denominator > otherParsed.numerator * this.denominator
  }

  public multiply(other: Fraction | BigintIsh): Fraction {
    const otherParsed = Fraction.tryParseFraction(other)
    return new Fraction(this.numerator * otherParsed.numerator, this.denominator * otherParsed.denominator)
  }

  public divide(other: Fraction | BigintIsh): Fraction {
    const otherParsed = Fraction.tryParseFraction(other)
    return new Fraction(this.numerator * otherParsed.denominator, this.denominator * otherParsed.numerator)
  }

  public toSignificant(
    significantDigits: number,
    format: { groupSeparator?: string } = {},
    rounding: Rounding = Rounding.ROUND_HALF_UP
  ): string {
    invariant(Number.isInteger(significantDigits), `${significantDigits} is not an integer.`)
    invariant(significantDigits > 0, `${significantDigits} is not positive.`)

    const raw = toSignificantDigits(this.numerator, this.denominator, significantDigits, rounding)
    return formatWithSeparator(raw, format.groupSeparator ?? '')
  }

  public toFixed(
    decimalPlaces: number,
    format: { groupSeparator?: string } = {},
    rounding: Rounding = Rounding.ROUND_HALF_UP
  ): string {
    invariant(Number.isInteger(decimalPlaces), `${decimalPlaces} is not an integer.`)
    invariant(decimalPlaces >= 0, `${decimalPlaces} is negative.`)

    const raw = divideToDecimal(this.numerator, this.denominator, decimalPlaces, rounding)
    return formatWithSeparator(raw, format.groupSeparator ?? '')
  }

  /**
   * Helper method for converting any super class back to a fraction
   */
  public get asFraction(): Fraction {
    return new Fraction(this.numerator, this.denominator)
  }
}
