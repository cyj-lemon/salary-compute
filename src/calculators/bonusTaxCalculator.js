import { BONUS_MONTHLY_BRACKETS } from '../config/taxRules.js'
import { calculateAnnualTax, findAnnualBracket } from './taxCalculator.js'
import { normalizeNonNegative, roundMoney } from './money.js'

export function calculateBonusTax({ bonus, regularTaxableIncome, regularTax } = {}) {
  const amount = normalizeNonNegative(bonus)
  const taxableIncome = normalizeNonNegative(regularTaxableIncome)
  const paidRegularTax = normalizeNonNegative(regularTax)
  const monthlyEquivalent = amount / 12
  const bracket = BONUS_MONTHLY_BRACKETS.find((item) => monthlyEquivalent <= item.max)
  const separateTax = amount === 0 ? 0 : roundMoney(Math.max(0, amount * bracket.rate - bracket.quickDeduction))
  const integratedTaxableIncome = taxableIncome + amount
  const integratedBracket = findAnnualBracket(integratedTaxableIncome)
  const integratedTotalTax = calculateAnnualTax(integratedTaxableIncome)
  const integratedTax = roundMoney(Math.max(0, integratedTotalTax - paidRegularTax))
  const separateNet = roundMoney(amount - separateTax)
  const integratedNet = roundMoney(amount - integratedTax)
  const recommended = separateTax <= integratedTax ? 'separate' : 'integrated'

  return {
    bonus: amount,
    monthlyEquivalent: roundMoney(monthlyEquivalent),
    separate: {
      tax: separateTax,
      net: separateNet,
      rate: bracket.rate,
      quickDeduction: bracket.quickDeduction,
    },
    integrated: {
      tax: integratedTax,
      net: integratedNet,
      totalTax: integratedTotalTax,
      rate: integratedBracket.rate,
      quickDeduction: integratedBracket.quickDeduction,
    },
    recommended,
    difference: roundMoney(Math.abs(separateTax - integratedTax)),
  }
}
