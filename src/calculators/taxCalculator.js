import { ANNUAL_TAX_BRACKETS, BASIC_DEDUCTION_MONTHLY } from '../config/taxRules.js'
import { normalizeNonNegative, roundMoney, sumMoney } from './money.js'

export function findAnnualBracket(taxableIncome) {
  const value = normalizeNonNegative(taxableIncome)
  return ANNUAL_TAX_BRACKETS.find((item) => value <= item.max)
}

export function calculateAnnualTax(taxableIncome) {
  const taxable = normalizeNonNegative(taxableIncome)
  const bracket = findAnnualBracket(taxable)
  return roundMoney(Math.max(0, taxable * bracket.rate - bracket.quickDeduction))
}

export function calculateMonthlyWithholding(months) {
  if (!Array.isArray(months)) throw new TypeError('月度收入明细必须是数组')

  let cumulativeIncome = 0
  let cumulativeSocial = 0
  let cumulativeFund = 0
  let cumulativeSpecial = 0
  let cumulativeOther = 0
  let paidTax = 0

  return months.map((month, index) => {
    const grossSalary = normalizeNonNegative(month.grossSalary)
    const socialTotal = normalizeNonNegative(month.social?.employeeTotal)
    const fundTotal = normalizeNonNegative(month.fund?.employeeAmount)
    const specialDeduction = normalizeNonNegative(month.specialDeduction)
    const otherDeduction = normalizeNonNegative(month.otherDeduction)
    cumulativeIncome = sumMoney([cumulativeIncome, grossSalary])
    cumulativeSocial = sumMoney([cumulativeSocial, socialTotal])
    cumulativeFund = sumMoney([cumulativeFund, fundTotal])
    cumulativeSpecial = sumMoney([cumulativeSpecial, specialDeduction])
    cumulativeOther = sumMoney([cumulativeOther, otherDeduction])
    const cumulativeBasicDeduction = BASIC_DEDUCTION_MONTHLY * (index + 1)
    const cumulativeTaxable = roundMoney(
      Math.max(
        0,
        cumulativeIncome -
          cumulativeBasicDeduction -
          cumulativeSocial -
          cumulativeFund -
          cumulativeSpecial -
          cumulativeOther,
      ),
    )
    const bracket = findAnnualBracket(cumulativeTaxable)
    const cumulativeTax = calculateAnnualTax(cumulativeTaxable)
    const currentTax = roundMoney(Math.max(0, cumulativeTax - paidTax))
    const previousPaidTax = paidTax
    paidTax = sumMoney([paidTax, currentTax])

    return {
      ...month,
      grossSalary,
      specialDeduction,
      otherDeduction,
      cumulativeIncome,
      cumulativeBasicDeduction,
      cumulativeSocial,
      cumulativeFund,
      cumulativeSpecial,
      cumulativeOther,
      cumulativeTaxable,
      taxRate: bracket.rate,
      quickDeduction: bracket.quickDeduction,
      cumulativeTax,
      previousPaidTax,
      currentTax,
    }
  })
}
