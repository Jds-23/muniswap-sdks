/**
 * Determines if a list is sorted according to a comparator.
 *
 * @param list - The list to check
 * @param comparator - The comparator function that returns negative if a < b, positive if a > b, 0 if equal
 * @returns True if the list is sorted in ascending order according to the comparator
 */
export function isSorted<T>(list: Array<T>, comparator: (a: T, b: T) => number): boolean {
  for (let i = 0; i < list.length - 1; i++) {
    if (comparator(list[i]!, list[i + 1]!) > 0) {
      return false
    }
  }
  return true
}
