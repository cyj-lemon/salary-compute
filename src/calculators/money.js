export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value)
  if (Number.isFinite(number)) return number

  const fallbackNumber = Number(fallback)
  return Number.isFinite(fallbackNumber) ? fallbackNumber : 0
}

export function normalizeNonNegative(value, fallback = 0) {
  return Math.max(0, toFiniteNumber(value, fallback))
}

export function normalizeCount(value, max = 10) {
  return Math.min(max, Math.floor(normalizeNonNegative(value)))
}

export function roundMoney(value) {
  return Math.round((toFiniteNumber(value) + Number.EPSILON) * 100) / 100
}

export function sumMoney(values) {
  return roundMoney(values.reduce((sum, value) => sum + toFiniteNumber(value), 0))
}

export function clampBase(userBase, lowerLimit, upperLimit) {
  const lower = normalizeNonNegative(lowerLimit)
  const upper = upperLimit == null ? Infinity : normalizeNonNegative(upperLimit)
  if (upper < lower) throw new RangeError(`缴费基数上限 ${upper} 不能低于下限 ${lower}`)
  return Math.max(lower, Math.min(normalizeNonNegative(userBase), upper))
}
