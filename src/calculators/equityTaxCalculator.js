import { findAnnualBracket } from './taxCalculator.js'
import { normalizeNonNegative, roundMoney } from './money.js'

export function calculateEquityTax(amount) {
  const gross = roundMoney(normalizeNonNegative(amount))
  const bracket = findAnnualBracket(gross)
  const tax = roundMoney(Math.max(0, gross * bracket.rate - bracket.quickDeduction))

  return {
    gross,
    tax,
    net: roundMoney(gross - tax),
    rate: bracket.rate,
    quickDeduction: bracket.quickDeduction,
  }
}

