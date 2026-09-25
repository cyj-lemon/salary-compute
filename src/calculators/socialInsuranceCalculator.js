import { INSURANCE_LABELS, SOCIAL_INSURANCE_RULES } from '../config/socialInsuranceRules.js'
import { clampBase, normalizeNonNegative, roundMoney, sumMoney, toFiniteNumber } from './money.js'
import { getEffectiveRule } from './policy.js'

export function calculateSocialInsurance({ city, date, salary, customBases = {} } = {}) {
  const cityRules = SOCIAL_INSURANCE_RULES[city]
  if (!cityRules) throw new Error(`不支持的城市：${city}`)
  const normalizedSalary = normalizeNonNegative(salary)
  const normalizedBases = customBases && typeof customBases === 'object' ? customBases : {}

  const items = Object.entries(cityRules).map(([key, rules]) => {
    const policy = getEffectiveRule(rules, date)
    const customBase = toFiniteNumber(normalizedBases[key])
    const declaredBase = customBase > 0 ? customBase : normalizedSalary
    const isContributing = declaredBase > 0
    const actualBase = isContributing ? clampBase(declaredBase, policy.lowerLimit, policy.upperLimit) : 0
    const employeeAmount = isContributing
      ? roundMoney(actualBase * policy.employeeRate + Number(policy.employeeFixed || 0))
      : 0
    const employerAmount = isContributing
      ? roundMoney(actualBase * policy.employerRate + Number(policy.employerFixed || 0))
      : 0

    return {
      key,
      label: INSURANCE_LABELS[key],
      declaredBase,
      actualBase,
      employeeRate: policy.employeeRate,
      employerRate: policy.employerRate,
      employerRateKind: policy.employerRateKind || 'fixed',
      employerRateRange: policy.employerRateRange || null,
      employerRateNote: policy.employerRateNote || '',
      employeeAmount,
      employerAmount,
      employerAmountEstimated: policy.employerRateKind === 'industry-estimate',
      policy,
    }
  })

  return {
    items,
    employeeTotal: sumMoney(items.map((item) => item.employeeAmount)),
    employerTotal: sumMoney(items.map((item) => item.employerAmount)),
    hasEstimatedEmployerRates: items.some((item) => item.employerAmountEstimated),
    provisional: items.some((item) => item.policy.provisional),
  }
}
