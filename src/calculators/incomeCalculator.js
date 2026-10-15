import { calculateSpecialDeduction } from '../config/specialDeductions.js'
import { CITY_META } from '../config/cityRules.js'
import {
  getAdditionalIncomeRule,
  normalizeSigningBonusSchedule,
  SIGNING_BONUS_SCHEDULES,
} from '../config/additionalIncomeRules.js'
import { calculateBonusTax } from './bonusTaxCalculator.js'
import { calculateEquityTax } from './equityTaxCalculator.js'
import { calculateHousingFund } from './housingFundCalculator.js'
import { normalizeNonNegative, roundMoney, sumMoney, toFiniteNumber } from './money.js'
import { monthDate } from './policy.js'
import { calculateSocialInsurance } from './socialInsuranceCalculator.js'
import { calculateMonthlyWithholding } from './taxCalculator.js'

function allocateSigningBonus(amount, schedule, oneTimeMonth) {
  const payments = Array(12).fill(0)
  if (amount <= 0) return payments

  const paymentMonths = schedule === 'one-time'
    ? [oneTimeMonth]
    : SIGNING_BONUS_SCHEDULES[schedule].months
  const installment = roundMoney(amount / paymentMonths.length)

  paymentMonths.forEach((month, index) => {
    payments[month - 1] = index === paymentMonths.length - 1
      ? roundMoney(amount - installment * (paymentMonths.length - 1))
      : installment
  })
  return payments
}

export function calculateIncome(input) {
  if (!input || typeof input !== 'object') throw new TypeError('收入计算参数必须是对象')
  if (!CITY_META[input.city]) throw new Error(`不支持的城市：${input.city}`)

  const year = Number(input.year ?? 2026)
  if (!Number.isInteger(year) || year !== 2026) throw new RangeError(`不支持的计算年度：${input.year}`)

  const salary = normalizeNonNegative(input.salary)
  const bonusAmount = normalizeNonNegative(input.bonus)
  const housingAllowance = normalizeNonNegative(input.housingAllowance)
  const signingBonus = roundMoney(normalizeNonNegative(input.signingBonus))
  const equityIncentiveAmount = roundMoney(normalizeNonNegative(input.equityIncentiveAmount))
  const signingBonusSchedule = normalizeSigningBonusSchedule(input.signingBonusSchedule)
  const signingBonusMonth = Math.max(1, Math.min(12, Math.trunc(toFiniteNumber(input.signingBonusMonth, 1))))
  const otherDeduction = normalizeNonNegative(input.otherDeduction)
  const inputBases = input.customBases && typeof input.customBases === 'object' ? input.customBases : {}
  const customBases = Object.fromEntries(
    ['pension', 'medical', 'unemployment', 'injury', 'maternity', 'fund'].map((key) => {
      const value = toFiniteNumber(inputBases[key])
      return [key, value > 0 ? value : 0]
    }),
  )
  const fundEmployeeType = input.fundEmployeeType === 'new' ? 'new' : 'existing'
  const additionalIncomeRule = getAdditionalIncomeRule(input.city)
  const estimatedSocialBase = roundMoney(
    salary +
      (additionalIncomeRule.housingAllowance.socialBase ? housingAllowance : 0),
  )
  const estimatedFundBase = roundMoney(
    salary +
      (additionalIncomeRule.housingAllowance.fundBase ? housingAllowance : 0),
  )
  const signingBonusPayments = allocateSigningBonus(
    signingBonus,
    signingBonusSchedule,
    signingBonusMonth,
  )
  const special = calculateSpecialDeduction(input.deductions)
  const baseMonths = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const date = monthDate(year, month)
    const social = calculateSocialInsurance({
      city: input.city,
      date,
      salary: estimatedSocialBase,
      customBases,
    })
    const fund = calculateHousingFund({
      city: input.city,
      date,
      salary: estimatedFundBase,
      customBase: customBases.fund,
      rate: input.fundRate,
      supplementaryRate: input.supplementaryFundRate,
      employeeType: fundEmployeeType,
    })

    const signingBonusPayment = signingBonusPayments[index]

    return {
      month,
      date,
      baseSalary: salary,
      housingAllowance,
      signingBonus: signingBonusPayment,
      grossSalary: roundMoney(salary + housingAllowance + signingBonusPayment),
      social,
      fund,
      specialDeduction: special.monthly,
      otherDeduction,
    }
  })

  const months = calculateMonthlyWithholding(baseMonths).map((month) => {
    const takeHome = roundMoney(
      month.grossSalary - month.social.employeeTotal - month.fund.employeeAmount - month.currentTax,
    )
    const totalFundContribution = sumMoney([
      month.fund.employeeAmount,
      month.fund.employerAmount,
    ])

    return {
      ...month,
      takeHome,
      totalFundContribution,
      incomeWithFund: sumMoney([takeHome, totalFundContribution]),
    }
  })
  const lastMonth = months.at(-1)
  const regularTax = lastMonth.cumulativeTax
  const bonus = calculateBonusTax({
    bonus: bonusAmount,
    regularTaxableIncome: lastMonth.cumulativeTaxable,
    regularTax,
  })
  const selectedBonusTax = bonus[bonus.recommended].tax
  const selectedBonusNet = bonus[bonus.recommended].net
  const equity = calculateEquityTax(equityIncentiveAmount)
  const annualSocial = sumMoney(months.map((month) => month.social.employeeTotal))
  const annualFund = sumMoney(months.map((month) => month.fund.employeeAmount))
  const annualEmployerFund = sumMoney(months.map((month) => month.fund.employerAmount))
  const annualBasicFund = sumMoney(months.map((month) => month.fund.basicEmployeeAmount))
  const annualEmployerBasicFund = sumMoney(months.map((month) => month.fund.basicEmployerAmount))
  const annualSupplementaryFund = sumMoney(
    months.map((month) => month.fund.supplementaryEmployeeAmount),
  )
  const annualEmployerSupplementaryFund = sumMoney(
    months.map((month) => month.fund.supplementaryEmployerAmount),
  )
  const annualTotalSupplementaryFund = sumMoney([
    annualSupplementaryFund,
    annualEmployerSupplementaryFund,
  ])
  const annualTotalFund = sumMoney([annualFund, annualEmployerFund])
  const annualSalaryTakeHome = sumMoney(months.map((month) => month.takeHome))
  const annualBaseSalaryGross = roundMoney(salary * 12)
  const annualHousingAllowance = roundMoney(housingAllowance * 12)
  const annualSigningBonus = signingBonus
  const annualSalaryGross = sumMoney([
    annualBaseSalaryGross,
    annualHousingAllowance,
    annualSigningBonus,
  ])
  const annualGross = sumMoney([annualSalaryGross, bonus.bonus, equity.gross])
  const annualTax = sumMoney([regularTax, selectedBonusTax, equity.tax])
  const annualTakeHome = sumMoney([annualSalaryTakeHome, selectedBonusNet, equity.net])
  const annualFinalIncome = sumMoney([
    annualSalaryTakeHome,
    annualTotalFund,
    selectedBonusNet,
    equity.net,
  ])

  return {
    input: {
      ...input,
      year,
      salary,
      bonus: bonusAmount,
      housingAllowance,
      signingBonus,
      equityIncentiveAmount,
      signingBonusSchedule,
      signingBonusMonth,
      fundRate: months[0]?.fund.employeeRate,
      supplementaryFundRate: months[0]?.fund.supplementaryEmployeeRate,
      otherDeduction,
      customBases,
      fundEmployeeType,
      deductions: special.input,
    },
    special,
    contributionBasis: {
      estimatedSocialBase,
      estimatedFundBase,
      rule: additionalIncomeRule,
    },
    months,
    bonus,
    equity,
    summary: {
      annualGross,
      annualSalaryGross,
      annualBaseSalaryGross,
      annualHousingAllowance,
      annualSigningBonus,
      annualSocial,
      annualFund,
      annualEmployerFund,
      annualBasicFund,
      annualEmployerBasicFund,
      annualSupplementaryFund,
      annualEmployerSupplementaryFund,
      annualTotalSupplementaryFund,
      annualTotalFund,
      annualSalaryTakeHome,
      annualBonusGross: bonus.bonus,
      annualBonusTax: selectedBonusTax,
      annualBonusNet: selectedBonusNet,
      annualEquityGross: equity.gross,
      annualEquityTax: equity.tax,
      annualEquityNet: equity.net,
      regularTax,
      annualTax,
      annualTakeHome,
      annualFinalIncome,
      annualIncomeWithFund: annualFinalIncome,
      averageMonthlySalaryTakeHome: roundMoney(annualSalaryTakeHome / 12),
      averageMonthlyTakeHome: roundMoney(annualTakeHome / 12),
      averageMonthlyFinalIncome: roundMoney(annualFinalIncome / 12),
      averageMonthlyIncomeWithFund: roundMoney(annualFinalIncome / 12),
      taxRate: annualGross > 0 ? annualTax / annualGross : 0,
      deductionRate: annualGross > 0 ? (annualSocial + annualFund + annualTax) / annualGross : 0,
    },
    hasProvisionalPolicy: months.some(
      (month) => month.social.provisional || month.fund.provisional,
    ),
  }
}

export function compareCities(input, cities = ['beijing', 'shanghai', 'guangzhou', 'shenzhen']) {
  return cities.map((city) => {
    const result = calculateIncome({ ...input, city })
    return { city, ...result.summary }
  })
}
