import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateAnnualTax } from '../src/calculators/taxCalculator.js'
import { calculateBonusTax } from '../src/calculators/bonusTaxCalculator.js'
import { calculateSocialInsurance } from '../src/calculators/socialInsuranceCalculator.js'
import { calculateHousingFund } from '../src/calculators/housingFundCalculator.js'
import { calculateIncome, compareCities } from '../src/calculators/incomeCalculator.js'
import { calculateEquityTax } from '../src/calculators/equityTaxCalculator.js'
import { HOUSING_FUND_DEFAULT_RATES } from '../src/config/housingFundRules.js'
import { calculateSpecialDeduction } from '../src/config/specialDeductions.js'
import { getEffectiveRule } from '../src/calculators/policy.js'
import { BONUS_MONTHLY_BRACKETS } from '../src/config/taxRules.js'
import { roundMoney, sumMoney } from '../src/calculators/money.js'

const baseInput = (city, overrides = {}) => ({
  city,
  year: 2026,
  salary: 30000,
  bonus: 100000,
  housingAllowance: 0,
  signingBonus: 0,
  signingBonusSchedule: 'one-time',
  signingBonusMonth: 1,
  equityIncentiveAmount: 0,
  fundRate: HOUSING_FUND_DEFAULT_RATES[city],
  supplementaryFundRate: 0,
  otherDeduction: 0,
  customBases: {},
  deductions: {
    infantCount: 0,
    childCount: 0,
    continuingEducation: false,
    housing: 'none',
    elderCare: 'none',
  },
  ...overrides,
})

const contributionBaseSnapshot = (city, date, salary) => {
  const social = calculateSocialInsurance({ city, date, salary })
  const fund = calculateHousingFund({
    city,
    date,
    salary,
    rate: HOUSING_FUND_DEFAULT_RATES[city],
  })

  return {
    ...Object.fromEntries(social.items.map((item) => [item.key, item.actualBase])),
    fund: fund.actualBase,
  }
}

test('综合所得年度税率边界正确', () => {
  assert.equal(calculateAnnualTax(0), 0)
  assert.equal(calculateAnnualTax(36000), 1080)
  assert.equal(calculateAnnualTax(144000), 11880)
  assert.equal(calculateAnnualTax(300000), 43080)
})

test('年终奖单独计税正确处理 36000 元临界点', () => {
  const atBoundary = calculateBonusTax({ bonus: 36000, regularTaxableIncome: 0, regularTax: 0 })
  const overBoundary = calculateBonusTax({ bonus: 36001, regularTaxableIncome: 0, regularTax: 0 })
  assert.equal(atBoundary.separate.tax, 1080)
  assert.equal(overBoundary.separate.tax, 3390.1)
  assert.equal(overBoundary.recommended, 'integrated')
  assert.equal(overBoundary.integrated.rate, 0.1)
  assert.equal(overBoundary.integrated.quickDeduction, 2520)
  assert.equal(calculateBonusTax({ bonus: 0, regularTaxableIncome: 0, regularTax: 0 }).separate.tax, 0)
})

test('年终奖单独计税覆盖全部税率临界点', () => {
  const finiteBrackets = BONUS_MONTHLY_BRACKETS.filter((bracket) => Number.isFinite(bracket.max))

  finiteBrackets.forEach((bracket, index) => {
    const boundary = bracket.max * 12
    const atBoundary = calculateBonusTax({ bonus: boundary, regularTaxableIncome: 0, regularTax: 0 })
    const overBoundary = calculateBonusTax({ bonus: boundary + 0.01, regularTaxableIncome: 0, regularTax: 0 })
    assert.equal(atBoundary.separate.rate, bracket.rate)
    assert.equal(overBoundary.separate.rate, BONUS_MONTHLY_BRACKETS[index + 1].rate)
    assert.equal(
      atBoundary.separate.tax,
      roundMoney(boundary * bracket.rate - bracket.quickDeduction),
    )
  })
})

test('符合条件的上市公司股权激励单独适用年度税率表', () => {
  assert.deepEqual(calculateEquityTax(100000), {
    gross: 100000,
    tax: 7480,
    net: 92520,
    rate: 0.1,
    quickDeduction: 2520,
  })
  assert.equal(calculateEquityTax(36000).tax, 1080)
  assert.equal(calculateEquityTax(36001).tax, 1080.1)
  assert.equal(calculateEquityTax(-100).tax, 0)
})

test('北京社保按月切换基数，并分别执行保底和封顶', () => {
  const januaryLow = calculateSocialInsurance({ city: 'beijing', date: '2026-01-15', salary: 1000 })
  const julyLow = calculateSocialInsurance({ city: 'beijing', date: '2026-07-15', salary: 1000 })
  const julyHigh = calculateSocialInsurance({ city: 'beijing', date: '2026-07-15', salary: 100000 })
  assert.equal(januaryLow.items.find((item) => item.key === 'pension').actualBase, 7162)
  assert.equal(julyLow.items.find((item) => item.key === 'pension').actualBase, 7270)
  assert.equal(julyHigh.items.find((item) => item.key === 'pension').actualBase, 36348)
  assert.equal(julyHigh.items.find((item) => item.key === 'injury').employeeAmount, 0)
})

test('北京医保单位费率已包含生育保险，不重复计算单位生育费', () => {
  const social = calculateSocialInsurance({ city: 'beijing', date: '2026-07-15', salary: 10000 })
  const medical = social.items.find((item) => item.key === 'medical')
  const maternity = social.items.find((item) => item.key === 'maternity')
  assert.equal(medical.employerRate, 0.098)
  assert.equal(maternity.employerRate, 0)
  assert.equal(maternity.employerAmount, 0)
})

test('四城市工伤单位费率标记为行业估算且不计入个人缴费', () => {
  const expectedRanges = {
    beijing: { min: 0.002, max: 0.019 },
    shanghai: { min: 0.002, max: 0.019 },
    guangzhou: { min: 0.002, max: 0.014 },
    shenzhen: { min: 0.002, max: 0.014 },
  }

  for (const city of Object.keys(expectedRanges)) {
    const social = calculateSocialInsurance({ city, date: '2026-09-15', salary: 10000 })
    const injury = social.items.find((item) => item.key === 'injury')
    assert.equal(injury.employerRateKind, 'industry-estimate')
    assert.deepEqual(injury.employerRateRange, expectedRanges[city])
    assert.equal(injury.employeeAmount, 0)
    assert.equal(injury.employerAmountEstimated, true)
    assert.equal(social.hasEstimatedEmployerRates, true)
  }
})

test('广州失业保险 7 月起按 2025 年在岗职工平均工资更新上限', () => {
  const june = calculateSocialInsurance({ city: 'guangzhou', date: '2026-06-15', salary: 100000 })
  const july = calculateSocialInsurance({ city: 'guangzhou', date: '2026-07-15', salary: 100000 })
  const juneUnemployment = june.items.find((item) => item.key === 'unemployment')
  const julyUnemployment = july.items.find((item) => item.key === 'unemployment')
  assert.equal(juneUnemployment.actualBase, 41697)
  assert.equal(julyUnemployment.actualBase, 42933)
  assert.equal(julyUnemployment.policy.provisional, true)
})

test('深圳养老、医保、失业使用独立缴费基数', () => {
  const august = calculateSocialInsurance({ city: 'shenzhen', date: '2026-08-15', salary: 30000 })
  const september = calculateSocialInsurance({ city: 'shenzhen', date: '2026-09-15', salary: 30000 })
  assert.equal(august.items.find((item) => item.key === 'pension').actualBase, 27549)
  assert.equal(august.items.find((item) => item.key === 'medical').actualBase, 30000)
  assert.equal(august.items.find((item) => item.key === 'unemployment').actualBase, 2520)
  assert.equal(september.items.find((item) => item.key === 'unemployment').actualBase, 2700)
})

test('公积金按城市政策保底、封顶并支持年度切换', () => {
  const low = calculateHousingFund({ city: 'guangzhou', date: '2026-09-15', salary: 1000, rate: 0.12 })
  const high = calculateHousingFund({ city: 'shenzhen', date: '2026-07-15', salary: 100000, rate: 0.05 })
  assert.equal(low.actualBase, 2680)
  assert.equal(low.employeeAmount, 321.6)
  assert.equal(high.actualBase, 48471)
  assert.equal(high.employeeAmount, 2423.55)
})

test('公积金缴存比例按城市范围收敛', () => {
  const shanghai = calculateHousingFund({ city: 'shanghai', date: '2026-09-15', salary: 30000, rate: 0.12 })
  const beijing = calculateHousingFund({ city: 'beijing', date: '2026-09-15', salary: 30000, rate: 0.01 })
  assert.equal(shanghai.employeeRate, 0.07)
  assert.equal(shanghai.employeeAmount, 2100)
  assert.equal(beijing.employeeRate, 0.05)
  assert.equal(beijing.employeeAmount, 1500)
})

test('上海补充公积金按个人和单位各 5% 计入公积金合计', () => {
  const fund = calculateHousingFund({
    city: 'shanghai',
    date: '2026-09-15',
    salary: 30000,
    rate: 0.07,
    supplementaryRate: 0.05,
  })
  assert.equal(fund.basicEmployeeAmount, 2100)
  assert.equal(fund.supplementaryEmployeeRate, 0.05)
  assert.equal(fund.supplementaryEmployeeAmount, 1500)
  assert.equal(fund.employeeAmount, 3600)
  assert.equal(fund.employerAmount, 3600)

  const clampedSupplement = calculateHousingFund({
    city: 'shanghai',
    date: '2026-09-15',
    salary: 30000,
    rate: 0.07,
    supplementaryRate: 1,
  })
  assert.equal(clampedSupplement.supplementaryEmployeeRate, 0.05)

  const ignoredOutsideShanghai = calculateHousingFund({
    city: 'beijing',
    date: '2026-09-15',
    salary: 30000,
    rate: 0.12,
    supplementaryRate: 0.05,
  })
  assert.equal(ignoredOutsideShanghai.supplementaryEmployeeRate, 0)
  assert.equal(ignoredOutsideShanghai.employeeAmount, 3600)
})

test('上海补充公积金同步进入个税扣除、现金到手与双边公积金', () => {
  const withoutSupplement = calculateIncome(baseInput('shanghai'))
  const withSupplement = calculateIncome(baseInput('shanghai', { supplementaryFundRate: 0.05 }))

  assert.equal(withSupplement.summary.annualSupplementaryFund, 18000)
  assert.equal(withSupplement.summary.annualEmployerSupplementaryFund, 18000)
  assert.equal(withSupplement.summary.annualTotalSupplementaryFund, 36000)
  assert.equal(withSupplement.summary.annualFund, withoutSupplement.summary.annualFund + 18000)
  assert.equal(withSupplement.summary.annualEmployerFund, withoutSupplement.summary.annualEmployerFund + 18000)
  assert.equal(withSupplement.summary.annualTotalFund, withoutSupplement.summary.annualTotalFund + 36000)
  assert.ok(withSupplement.summary.regularTax < withoutSupplement.summary.regularTax)

  const comparison = compareCities(baseInput('beijing', { supplementaryFundRate: 0.05 }))
  assert.equal(comparison.find((item) => item.city === 'shanghai').annualTotalSupplementaryFund, 36000)
  assert.ok(comparison.filter((item) => item.city !== 'shanghai').every(
    (item) => item.annualTotalSupplementaryFund === 0,
  ))
  assert.equal(
    withSupplement.summary.annualFinalIncome,
    sumMoney([
      withSupplement.summary.annualSalaryTakeHome,
      withSupplement.summary.annualTotalFund,
      withSupplement.summary.annualBonusNet,
      withSupplement.summary.annualEquityNet,
    ]),
  )
})

test('深圳公积金区分存量职工与 9 月后新入职或调入职工', () => {
  const augustNew = calculateHousingFund({
    city: 'shenzhen',
    date: '2026-08-15',
    salary: 1000,
    rate: 0.05,
    employeeType: 'new',
  })
  const septemberExisting = calculateHousingFund({
    city: 'shenzhen',
    date: '2026-09-15',
    salary: 1000,
    rate: 0.05,
  })
  const septemberNew = calculateHousingFund({
    city: 'shenzhen',
    date: '2026-09-15',
    salary: 1000,
    rate: 0.05,
    employeeType: 'new',
  })
  assert.equal(augustNew.actualBase, 2520)
  assert.equal(septemberExisting.actualBase, 2520)
  assert.equal(septemberNew.actualBase, 2700)
})

test('四城市各险种个人缴费金额与实际基数精确匹配', () => {
  const expected = {
    beijing: {
      pension: { actualBase: 10000, employeeAmount: 800 },
      medical: { actualBase: 10000, employeeAmount: 203 },
      unemployment: { actualBase: 10000, employeeAmount: 50 },
      injury: { actualBase: 10000, employeeAmount: 0 },
      maternity: { actualBase: 10000, employeeAmount: 0 },
      employeeTotal: 1053,
    },
    shanghai: {
      pension: { actualBase: 10000, employeeAmount: 800 },
      medical: { actualBase: 10000, employeeAmount: 200 },
      unemployment: { actualBase: 10000, employeeAmount: 50 },
      injury: { actualBase: 10000, employeeAmount: 0 },
      maternity: { actualBase: 10000, employeeAmount: 0 },
      employeeTotal: 1050,
    },
    guangzhou: {
      pension: { actualBase: 10000, employeeAmount: 800 },
      medical: { actualBase: 10000, employeeAmount: 200 },
      unemployment: { actualBase: 10000, employeeAmount: 20 },
      injury: { actualBase: 10000, employeeAmount: 0 },
      maternity: { actualBase: 10000, employeeAmount: 0 },
      employeeTotal: 1020,
    },
    shenzhen: {
      pension: { actualBase: 10000, employeeAmount: 800 },
      medical: { actualBase: 10000, employeeAmount: 200 },
      unemployment: { actualBase: 2700, employeeAmount: 5.4 },
      injury: { actualBase: 10000, employeeAmount: 0 },
      maternity: { actualBase: 10000, employeeAmount: 0 },
      employeeTotal: 1005.4,
    },
  }

  for (const [city, cityExpected] of Object.entries(expected)) {
    const social = calculateSocialInsurance({ city, date: '2026-09-15', salary: 10000 })
    const actual = Object.fromEntries(social.items.map((item) => [item.key, {
      actualBase: item.actualBase,
      employeeAmount: item.employeeAmount,
    }]))
    assert.deepEqual(actual, Object.fromEntries(
      Object.entries(cityExpected).filter(([key]) => key !== 'employeeTotal'),
    ))
    assert.equal(social.employeeTotal, cityExpected.employeeTotal)
  }
})

test('四城市 6 月到 7 月及 8 月到 9 月政策切换基数完整回归', () => {
  const upperLimitCases = {
    beijing: {
      june: { pension: 35811, medical: 35811, unemployment: 35811, injury: 35811, maternity: 35811, fund: 35811 },
      july: { pension: 36348, medical: 36348, unemployment: 36348, injury: 36348, maternity: 36348, fund: 36348 },
    },
    shanghai: {
      june: { pension: 37302, medical: 37302, unemployment: 37302, injury: 37302, maternity: 37302, fund: 37302 },
      july: { pension: 37731, medical: 37731, unemployment: 37731, injury: 37731, maternity: 37731, fund: 37731 },
    },
    guangzhou: {
      june: { pension: 27549, medical: 31170, unemployment: 41697, injury: 100000, maternity: 31170, fund: 39579 },
      july: { pension: 27549, medical: 31170, unemployment: 42933, injury: 100000, maternity: 31170, fund: 41697 },
    },
    shenzhen: {
      june: { pension: 27549, medical: 33633, unemployment: 2520, injury: 100000, maternity: 33633, fund: 44940 },
      july: { pension: 27549, medical: 33633, unemployment: 2520, injury: 100000, maternity: 33633, fund: 48471 },
    },
  }
  const lowerLimitCases = {
    beijing: {
      august: { pension: 7270, medical: 7270, unemployment: 7270, injury: 7270, maternity: 7270, fund: 2540 },
      september: { pension: 7270, medical: 7270, unemployment: 7270, injury: 7270, maternity: 7270, fund: 2540 },
    },
    shanghai: {
      august: { pension: 7546, medical: 7546, unemployment: 7546, injury: 7546, maternity: 7546, fund: 2740 },
      september: { pension: 7546, medical: 7546, unemployment: 7546, injury: 7546, maternity: 7546, fund: 2740 },
    },
    guangzhou: {
      august: { pension: 5510, medical: 6234, unemployment: 2500, injury: 2500, maternity: 6234, fund: 2500 },
      september: { pension: 5510, medical: 6234, unemployment: 2680, injury: 2680, maternity: 6234, fund: 2680 },
    },
    shenzhen: {
      august: { pension: 4775, medical: 6727, unemployment: 2520, injury: 2520, maternity: 6727, fund: 2520 },
      september: { pension: 4775, medical: 6727, unemployment: 2700, injury: 2700, maternity: 6727, fund: 2520 },
    },
  }

  for (const city of Object.keys(upperLimitCases)) {
    assert.deepEqual(contributionBaseSnapshot(city, '2026-06-30', 100000), upperLimitCases[city].june)
    assert.deepEqual(contributionBaseSnapshot(city, '2026-07-01', 100000), upperLimitCases[city].july)
    assert.deepEqual(contributionBaseSnapshot(city, '2026-08-31', 1000), lowerLimitCases[city].august)
    assert.deepEqual(contributionBaseSnapshot(city, '2026-09-01', 1000), lowerLimitCases[city].september)
  }
})

test('城市对比会遵守各城市公积金比例上限', () => {
  const shanghai = compareCities(baseInput('beijing')).find((item) => item.city === 'shanghai')
  assert.equal(shanghai.annualFund, 25200)
  assert.equal(shanghai.annualTotalFund, 50400)
  assert.equal(shanghai.annualIncomeWithFund, 407130)
})

test('现金到手与含双边公积金所得分别汇总', () => {
  const result = calculateIncome(baseInput('beijing'))
  const january = result.months[0]

  assert.equal(january.totalFundContribution, 7200)
  assert.equal(
    january.incomeWithFund,
    sumMoney([january.takeHome, january.fund.employeeAmount, january.fund.employerAmount]),
  )
  assert.equal(result.summary.annualEmployerFund, 43200)
  assert.equal(result.summary.annualTotalFund, 86400)
  assert.equal(result.summary.annualSalaryTakeHome, 252091.2)
  assert.equal(result.summary.annualBonusGross, 100000)
  assert.equal(result.summary.annualBonusTax, 9790)
  assert.equal(result.summary.annualBonusNet, 90210)
  assert.equal(result.summary.annualTakeHome, 342301.2)
  assert.equal(result.summary.annualFinalIncome, 428701.2)
  assert.equal(result.summary.annualIncomeWithFund, 428701.2)
  assert.equal(result.summary.averageMonthlySalaryTakeHome, 21007.6)
  assert.equal(result.summary.averageMonthlyFinalIncome, 35725.1)
  assert.equal(result.summary.averageMonthlyIncomeWithFund, 35725.1)
  assert.equal(
    result.summary.annualFinalIncome,
    sumMoney([
      result.summary.annualSalaryTakeHome,
      result.summary.annualTotalFund,
      result.summary.annualBonusNet,
    ]),
  )
})

test('房补和签字费按发放月份进入工资薪金与累计预扣', () => {
  const result = calculateIncome(baseInput('beijing', {
    bonus: 0,
    housingAllowance: 3000,
    signingBonus: 60000,
    signingBonusMonth: 3,
  }))

  assert.equal(result.months[0].grossSalary, 33000)
  assert.equal(result.months[2].grossSalary, 93000)
  assert.equal(result.months[2].signingBonus, 60000)
  assert.equal(result.months.filter((month) => month.signingBonus > 0).length, 1)
  assert.equal(result.summary.annualBaseSalaryGross, 360000)
  assert.equal(result.summary.annualHousingAllowance, 36000)
  assert.equal(result.summary.annualSigningBonus, 60000)
  assert.equal(result.summary.annualSalaryGross, 456000)
  assert.equal(result.summary.annualGross, 456000)
})

test('签字费支持按月、半年和一次性三种发放方式', () => {
  const monthly = calculateIncome(baseInput('beijing', {
    bonus: 0,
    signingBonus: 120000,
    signingBonusSchedule: 'monthly',
  }))
  assert.ok(monthly.months.every((month) => month.signingBonus === 10000))

  const semiannual = calculateIncome(baseInput('beijing', {
    bonus: 0,
    signingBonus: 120000,
    signingBonusSchedule: 'semiannual',
  }))
  assert.deepEqual(
    semiannual.months.filter((month) => month.signingBonus > 0).map((month) => [month.month, month.signingBonus]),
    [[6, 60000], [12, 60000]],
  )

  const oneTime = calculateIncome(baseInput('beijing', {
    bonus: 0,
    signingBonus: 120000,
    signingBonusSchedule: 'one-time',
    signingBonusMonth: 9,
  }))
  assert.deepEqual(
    oneTime.months.filter((month) => month.signingBonus > 0).map((month) => [month.month, month.signingBonus]),
    [[9, 120000]],
  )
  assert.equal(sumMoney(monthly.months.map((month) => month.signingBonus)), 120000)
  assert.equal(sumMoney(semiannual.months.map((month) => month.signingBonus)), 120000)
  assert.equal(sumMoney(oneTime.months.map((month) => month.signingBonus)), 120000)
})

test('签字费累计预扣个税，但不改变当年缴费基数', () => {
  for (const city of ['beijing', 'shanghai', 'guangzhou', 'shenzhen']) {
    const baseline = calculateIncome(baseInput(city, { bonus: 0, housingAllowance: 3000 }))
    for (const schedule of ['monthly', 'semiannual', 'one-time']) {
      const result = calculateIncome(baseInput(city, {
        bonus: 0,
        housingAllowance: 3000,
        signingBonus: 60000,
        signingBonusSchedule: schedule,
      }))
      assert.equal(result.contributionBasis.estimatedSocialBase, 33000)
      assert.equal(result.contributionBasis.estimatedFundBase, 33000)
      assert.ok(result.months.every((month, index) =>
        month.social.employeeTotal === baseline.months[index].social.employeeTotal &&
        month.fund.employeeAmount === baseline.months[index].fund.employeeAmount,
      ))
      assert.ok(result.summary.annualTax > baseline.summary.annualTax)
    }
  }
})

test('自定义申报基数覆盖默认估算基数', () => {
  const result = calculateIncome(baseInput('beijing', {
    housingAllowance: 3000,
    signingBonus: 60000,
    customBases: { pension: 10000, fund: 12000 },
  }))
  assert.equal(result.months[0].social.items.find((item) => item.key === 'pension').declaredBase, 10000)
  assert.equal(result.months[0].fund.declaredBase, 12000)
  assert.equal(result.months[0].social.items.find((item) => item.key === 'medical').declaredBase, 33000)
})

test('额外收入非法值与签字费月份会被规范化', () => {
  const result = calculateIncome(baseInput('beijing', {
    housingAllowance: -100,
    signingBonus: Infinity,
    signingBonusSchedule: 'unexpected',
    signingBonusMonth: 99,
    equityIncentiveAmount: -1000,
  }))
  assert.equal(result.input.housingAllowance, 0)
  assert.equal(result.input.signingBonus, 0)
  assert.equal(result.input.signingBonusSchedule, 'one-time')
  assert.equal(result.input.signingBonusMonth, 12)
  assert.equal(result.input.equityIncentiveAmount, 0)
})

test('税后股权价值作为独立部分计入最终全年所得', () => {
  const baseline = calculateIncome(baseInput('beijing'))
  const result = calculateIncome(baseInput('beijing', { equityIncentiveAmount: 100000 }))

  assert.equal(result.summary.annualEquityGross, 100000)
  assert.equal(result.summary.annualEquityTax, 7480)
  assert.equal(result.summary.annualEquityNet, 92520)
  assert.equal(result.summary.annualGross, baseline.summary.annualGross + 100000)
  assert.equal(result.summary.annualTax, baseline.summary.annualTax + 7480)
  assert.equal(result.summary.annualFinalIncome, baseline.summary.annualFinalIncome + 92520)
  assert.equal(
    result.summary.annualFinalIncome,
    sumMoney([
      result.summary.annualSalaryTakeHome,
      result.summary.annualTotalFund,
      result.summary.annualBonusNet,
      result.summary.annualEquityNet,
    ]),
  )
})

test('自定义基数只影响对应险种', () => {
  const social = calculateSocialInsurance({
    city: 'shenzhen',
    date: '2026-05-15',
    salary: 30000,
    customBases: { pension: 10000, medical: 20000 },
  })
  assert.equal(social.items.find((item) => item.key === 'pension').actualBase, 10000)
  assert.equal(social.items.find((item) => item.key === 'medical').actualBase, 20000)
  assert.equal(social.items.find((item) => item.key === 'unemployment').actualBase, 2520)
})

for (const city of ['beijing', 'shanghai', 'guangzhou', 'shenzhen']) {
  test(`${city} 标准案例生成完整且连续的累计预扣结果`, () => {
    const result = calculateIncome(baseInput(city))
    assert.equal(result.months.length, 12)
    assert.ok(result.summary.annualTakeHome > 0)
    assert.equal(result.months.at(-1).cumulativeTax, result.summary.regularTax)
    assert.ok(result.months.every((month) => month.currentTax >= 0))
    for (let index = 1; index < result.months.length; index += 1) {
      assert.ok(result.months[index].cumulativeTaxable >= result.months[index - 1].cumulativeTaxable)
    }
  })
}

test('低工资、超高工资与零奖金边界均可稳定计算', () => {
  for (const salary of [1000, 7270, 1000000]) {
    const result = calculateIncome(baseInput('beijing', { salary, bonus: 0 }))
    assert.ok(Number.isFinite(result.summary.annualTakeHome))
    assert.equal(result.bonus.separate.tax, 0)
    assert.equal(result.bonus.integrated.tax, 0)
  }
})

test('零收入且未声明缴费基数时不产生缴费、个税或负到手', () => {
  for (const city of ['beijing', 'shanghai', 'guangzhou', 'shenzhen']) {
    const result = calculateIncome(baseInput(city, { salary: 0, bonus: 0 }))
    assert.deepEqual(result.summary, {
      annualGross: 0,
      annualSalaryGross: 0,
      annualBaseSalaryGross: 0,
      annualHousingAllowance: 0,
      annualSigningBonus: 0,
      annualSocial: 0,
      annualFund: 0,
      annualEmployerFund: 0,
      annualBasicFund: 0,
      annualEmployerBasicFund: 0,
      annualSupplementaryFund: 0,
      annualEmployerSupplementaryFund: 0,
      annualTotalSupplementaryFund: 0,
      annualTotalFund: 0,
      annualSalaryTakeHome: 0,
      annualBonusGross: 0,
      annualBonusTax: 0,
      annualBonusNet: 0,
      annualEquityGross: 0,
      annualEquityTax: 0,
      annualEquityNet: 0,
      regularTax: 0,
      annualTax: 0,
      annualTakeHome: 0,
      annualFinalIncome: 0,
      annualIncomeWithFund: 0,
      averageMonthlySalaryTakeHome: 0,
      averageMonthlyTakeHome: 0,
      averageMonthlyFinalIncome: 0,
      averageMonthlyIncomeWithFund: 0,
      taxRate: 0,
      deductionRate: 0,
    })
  }
})

test('零工资但显式声明缴费基数时仍按声明基数计算', () => {
  const result = calculateIncome(baseInput('beijing', {
    salary: 0,
    bonus: 0,
    customBases: { pension: 10000, fund: 10000 },
  }))
  assert.equal(result.months[0].social.items.find((item) => item.key === 'pension').employeeAmount, 800)
  assert.equal(result.months[0].fund.employeeAmount, 1200)
})

test('非法数值输入会统一规范化且不会产生 NaN', () => {
  const result = calculateIncome(baseInput('beijing', {
    salary: 'not-a-number',
    bonus: Infinity,
    fundRate: NaN,
    otherDeduction: -500,
    fundEmployeeType: 'unexpected',
    customBases: {
      pension: Infinity,
      medical: -100,
      fund: 'invalid',
    },
    deductions: {
      infantCount: -2,
      childCount: 12.8,
      continuingEducation: 'false',
      housing: 'invalid',
      elderCare: null,
    },
  }))

  assert.equal(result.input.salary, 0)
  assert.equal(result.input.bonus, 0)
  assert.equal(result.input.otherDeduction, 0)
  assert.equal(result.input.fundRate, HOUSING_FUND_DEFAULT_RATES.beijing)
  assert.equal(result.input.fundEmployeeType, 'existing')
  assert.ok(Object.values(result.input.customBases).every((value) => value === 0))
  assert.deepEqual(result.special.input, {
    infantCount: 0,
    childCount: 10,
    continuingEducation: false,
    housing: 'none',
    elderCare: 'none',
  })
  assert.equal(result.special.monthly, 20000)
  assert.ok(Object.values(result.summary).every(Number.isFinite))
})

test('专项附加扣除人数按非负整数和 UI 上限规范化', () => {
  const special = calculateSpecialDeduction({
    infantCount: 1.9,
    childCount: 99,
    continuingEducation: true,
    housing: 'rent',
    elderCare: 'only',
  })
  assert.deepEqual(special.input, {
    infantCount: 1,
    childCount: 10,
    continuingEducation: true,
    housing: 'rent',
    elderCare: 'only',
  })
  assert.equal(special.monthly, 26900)
})

test('专项附加扣除覆盖住房和赡养老人全部档位', () => {
  const cases = [
    [{ housing: 'none', elderCare: 'none' }, 0],
    [{ housing: 'rent', elderCare: 'none' }, 1500],
    [{ housing: 'loan', elderCare: 'none' }, 1000],
    [{ housing: 'none', elderCare: 'only' }, 3000],
    [{ housing: 'none', elderCare: 'nonOnly' }, 1500],
    [{ infantCount: 2, childCount: 1, continuingEducation: true }, 6400],
  ]

  for (const [input, expected] of cases) {
    assert.equal(calculateSpecialDeduction(input).monthly, expected)
  }
})

test('四城市月度和年度汇总满足收支恒等式', () => {
  for (const city of ['beijing', 'shanghai', 'guangzhou', 'shenzhen']) {
    const result = calculateIncome(baseInput(city, {
      housingAllowance: 2000,
      signingBonus: 60000,
      signingBonusSchedule: 'semiannual',
      equityIncentiveAmount: 80000,
      deductions: {
        infantCount: 1,
        childCount: 1,
        continuingEducation: true,
        housing: 'rent',
        elderCare: 'nonOnly',
      },
      otherDeduction: 300,
    }))

    result.months.forEach((month) => {
      assert.equal(
        month.takeHome,
        roundMoney(month.grossSalary - month.social.employeeTotal - month.fund.employeeAmount - month.currentTax),
      )
      assert.equal(
        month.incomeWithFund,
        sumMoney([month.takeHome, month.fund.employeeAmount, month.fund.employerAmount]),
      )
    })

    const summary = result.summary
    assert.equal(
      summary.annualTakeHome,
      roundMoney(summary.annualGross - summary.annualSocial - summary.annualFund - summary.annualTax),
    )
    assert.equal(
      summary.annualTakeHome,
      sumMoney([
        ...result.months.map((month) => month.takeHome),
        result.bonus[result.bonus.recommended].net,
        result.equity.net,
      ]),
    )
    assert.equal(summary.annualEmployerFund, sumMoney(
      result.months.map((month) => month.fund.employerAmount),
    ))
    assert.equal(summary.annualTotalFund, sumMoney([summary.annualFund, summary.annualEmployerFund]))
    assert.equal(
      summary.annualIncomeWithFund,
      sumMoney([summary.annualTakeHome, summary.annualTotalFund]),
    )
    assert.equal(summary.annualSalaryTakeHome, sumMoney(
      result.months.map((month) => month.takeHome),
    ))
    assert.equal(summary.annualBonusNet, result.bonus[result.bonus.recommended].net)
    assert.equal(
      summary.annualFinalIncome,
      sumMoney([
        summary.annualSalaryTakeHome,
        summary.annualTotalFund,
        summary.annualBonusNet,
        summary.annualEquityNet,
      ]),
    )
  }
})

test('不支持的城市、年份和无效政策日期会返回明确错误', () => {
  assert.throws(() => calculateIncome(baseInput('hangzhou')), /不支持的城市：hangzhou/)
  assert.throws(() => calculateIncome(baseInput('beijing', { year: 2027 })), /不支持的计算年度：2027/)
  assert.throws(
    () => calculateHousingFund({ city: 'hangzhou', date: '2026-01-15', salary: 10000, rate: 0.05 }),
    /不支持的城市：hangzhou/,
  )
  assert.throws(() => getEffectiveRule([{ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31' }], '2026-02-31'), /无效的政策日期/)
  assert.throws(() => getEffectiveRule([], '2026-01-15'), /缺少可用的政策规则/)
})
