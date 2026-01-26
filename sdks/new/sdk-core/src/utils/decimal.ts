import { Rounding } from '../constants'

/**
 * Divides two bigints and returns a decimal string with specified precision
 * @param numerator The numerator
 * @param denominator The denominator
 * @param decimalPlaces Number of decimal places in the result
 * @param rounding Rounding mode to apply
 * @returns A decimal string representation
 */
export function divideToDecimal(
  numerator: bigint,
  denominator: bigint,
  decimalPlaces: number,
  rounding: Rounding = Rounding.ROUND_HALF_UP
): string {
  if (denominator === 0n) {
    throw new Error('Division by zero')
  }

  const negative = numerator < 0n !== denominator < 0n
  const absNum = numerator < 0n ? -numerator : numerator
  const absDen = denominator < 0n ? -denominator : denominator

  // Scale up for precision
  const scale = 10n ** BigInt(decimalPlaces)
  const scaled = (absNum * scale) / absDen
  const scaledRemainder = (absNum * scale) % absDen

  // Apply rounding
  let rounded: bigint
  if (scaledRemainder === 0n) {
    rounded = scaled
  } else {
    switch (rounding) {
      case Rounding.ROUND_DOWN:
        rounded = scaled
        break
      case Rounding.ROUND_UP:
        rounded = scaled + 1n
        break
      case Rounding.ROUND_HALF_UP: {
        const isHalfOrMore = scaledRemainder * 2n >= absDen
        rounded = isHalfOrMore ? scaled + 1n : scaled
        break
      }
      default:
        rounded = scaled
    }
  }

  // Convert to string
  if (decimalPlaces === 0) {
    const result = rounded.toString()
    return negative ? `-${result}` : result
  }

  let str = rounded.toString()

  // Pad with leading zeros if needed
  while (str.length <= decimalPlaces) {
    str = `0${str}`
  }

  const intPart = str.slice(0, -decimalPlaces)
  const decPart = str.slice(-decimalPlaces)
  const result = `${intPart}.${decPart}`

  return negative ? `-${result}` : result
}

/**
 * Formats a decimal string with group separators
 * @param value The decimal string to format
 * @param groupSeparator The separator to use (e.g., ',')
 * @returns The formatted string
 */
export function formatWithSeparator(value: string, groupSeparator: string): string {
  if (!groupSeparator) return value

  const [intPart, decPart] = value.split('.')
  const negative = intPart?.startsWith('-')
  const absIntPart = negative ? intPart?.slice(1) : intPart
  const grouped = absIntPart?.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator)
  const formattedInt = negative ? `-${grouped}` : grouped

  return decPart !== undefined ? `${formattedInt}.${decPart}` : (formattedInt ?? value)
}

/**
 * Converts a fraction to a string with the specified number of significant digits
 * @param numerator The numerator
 * @param denominator The denominator
 * @param significantDigits Number of significant digits
 * @param rounding Rounding mode
 * @returns A string representation with the specified significant digits
 */
export function toSignificantDigits(
  numerator: bigint,
  denominator: bigint,
  significantDigits: number,
  rounding: Rounding
): string {
  if (denominator === 0n) {
    throw new Error('Division by zero')
  }

  if (numerator === 0n) {
    return '0'
  }

  const negative = numerator < 0n !== denominator < 0n
  const absNum = numerator < 0n ? -numerator : numerator
  const absDen = denominator < 0n ? -denominator : denominator

  // Calculate the integer part to determine magnitude
  const intPart = absNum / absDen

  if (intPart > 0n) {
    // Value >= 1, calculate required decimal places
    const intStr = intPart.toString()
    const intDigits = intStr.length

    if (intDigits >= significantDigits) {
      // Round the integer part to significant digits
      const scaleFactor = 10n ** BigInt(intDigits - significantDigits)
      const scaledDown = intPart / scaleFactor
      const remainder = intPart % scaleFactor

      let rounded: bigint
      if (remainder === 0n) {
        rounded = scaledDown
      } else {
        switch (rounding) {
          case Rounding.ROUND_DOWN:
            rounded = scaledDown
            break
          case Rounding.ROUND_UP:
            rounded = scaledDown + 1n
            break
          case Rounding.ROUND_HALF_UP: {
            const halfScale = scaleFactor / 2n
            const isHalfOrMore = scaleFactor % 2n === 0n ? remainder >= halfScale : remainder * 2n >= scaleFactor
            rounded = isHalfOrMore ? scaledDown + 1n : scaledDown
            break
          }
          default:
            rounded = scaledDown
        }
      }

      const result = (rounded * scaleFactor).toString()
      return negative ? `-${result}` : result
    }

    // Need decimal places
    const decimalPlaces = significantDigits - intDigits
    const raw = divideToDecimal(absNum, absDen, decimalPlaces, rounding)
    // Trim trailing zeros
    const trimmed = trimTrailingZeros(raw)
    return negative ? `-${trimmed}` : trimmed
  }

  // Value < 1, need to find leading zeros
  // Multiply numerator by powers of 10 until we exceed denominator
  let leadingZeros = 0
  let scaled = absNum * 10n
  while (scaled < absDen) {
    leadingZeros++
    scaled *= 10n
  }

  // Calculate with enough precision
  const totalDecimalPlaces = leadingZeros + significantDigits
  const raw = divideToDecimal(absNum, absDen, totalDecimalPlaces, rounding)

  // Trim trailing zeros but keep significant digits
  const trimmed = trimToSignificant(raw, significantDigits)
  return negative ? `-${trimmed}` : trimmed
}

/**
 * Removes trailing zeros from a decimal string
 */
function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) return value
  return value.replace(/\.?0+$/, '')
}

/**
 * Trims a decimal string to the specified number of significant digits
 */
function trimToSignificant(value: string, sigDigits: number): string {
  // Remove negative sign temporarily
  const negative = value.startsWith('-')
  const absValue = negative ? value.slice(1) : value

  const [intPart = '0', decPart = ''] = absValue.split('.')

  // Count significant digits
  let sigCount = 0
  let result = ''
  let foundNonZero = false
  let decimalAdded = false

  // Process integer part
  for (const char of intPart) {
    if (char !== '0') foundNonZero = true
    if (foundNonZero) {
      if (sigCount < sigDigits) {
        result += char
        sigCount++
      } else {
        result += '0' // Pad with zeros
      }
    } else if (intPart === '0') {
      result = '0'
    }
  }

  // If we have significant digits left and there's a decimal part
  if (sigCount < sigDigits && decPart) {
    if (!result || result === '0') {
      result = '0.'
      decimalAdded = true
    } else if (result && result !== '0') {
      result += '.'
      decimalAdded = true
    }

    for (const char of decPart) {
      if (char !== '0') foundNonZero = true
      if (foundNonZero) {
        if (sigCount < sigDigits) {
          if (!decimalAdded && result !== '0') {
            result += '.'
            decimalAdded = true
          } else if (!decimalAdded && result === '0') {
            result = '0.'
            decimalAdded = true
          }
          result += char
          sigCount++
        }
      } else {
        // Leading zeros after decimal point
        if (!decimalAdded) {
          result = '0.'
          decimalAdded = true
        }
        result += char
      }
    }
  }

  // Remove trailing zeros after decimal point (but keep at least the significant part)
  if (result.includes('.')) {
    result = result.replace(/\.?0+$/, '')
  }

  // Ensure we have at least '0' for zero values
  if (result === '' || result === '.') {
    result = '0'
  }

  return negative ? `-${result}` : result
}
