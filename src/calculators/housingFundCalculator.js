import {
  HOUSING_FUND_DEFAULT_RATES,
  HOUSING_FUND_RATE_LIMITS,
  HOUSING_FUND_RULES,
  HOUSING_FUND_SUPPLEMENTARY_RATE_LIMITS,
} from '../config/housingFundRules.js'
import { clampBase, normalizeNonNegative, roundMoney, sumMoney, toFiniteNumber } from './money.js'
import { getEffectiveRule } from './policy.js'

export function calculateHousingFund({
  city,
  date,
  salary,
  customBase,
  rate,
  supplementaryRate = 0,
  employeeType = 'existing',
} = {}) {
  const cityRules = HOUSING_FUND_RULES[city]
  const rateLimits = HOUSING_FUND_RATE_LIMITS[city]
  if (!cityRules || !rateLimits) throw new Error(`不支持的城市：${city}`)

  const policy = getEffectiveRule(cityRules, date)
  const normalizedSalary = normalizeNonNegative(salary)
  const normalizedCustomBase = toFiniteNumber(customBase)
  const declaredBase = normalizedCustomBase > 0 ? normalizedCustomBase : normalizedSalary
  const normalizedEmployeeType = employeeType === 'new' ? 'new' : 'existing'
  const appliedLowerLimit =
    normalizedEmployeeType === 'new' && policy.newEmployeeLowerLimit
      ? policy.newEmployeeLowerLimit
      : policy.lowerLimit
  const actualBase = declaredBase > 0 ? clampBase(declaredBase, appliedLowerLimit, policy.upperLimit) : 0
  const requestedRate = toFiniteNumber(rate, HOUSING_FUND_DEFAULT_RATES[city])
  const normalizedRate = Math.max(
    rateLimits.min,
    Math.min(requestedRate, rateLimits.max),
  )
  const supplementaryLimits = HOUSING_FUND_SUPPLEMENTARY_RATE_LIMITS[city]
  const requestedSupplementaryRate = normalizeNonNegative(supplementaryRate)
  const normalizedSupplementaryRate = supplementaryLimits && requestedSupplementaryRate > 0
    ? Math.max(
      supplementaryLimits.min,
      Math.min(requestedSupplementaryRate, supplementaryLimits.max),
    )
    : 0
  const basicEmployeeAmount = roundMoney(actualBase * normalizedRate)
  const basicEmployerAmount = basicEmployeeAmount
  const supplementaryEmployeeAmount = roundMoney(actualBase * normalizedSupplementaryRate)
  const supplementaryEmployerAmount = supplementaryEmployeeAmount
  const employeeAmount = sumMoney([basicEmployeeAmount, supplementaryEmployeeAmount])
  const employerAmount = sumMoney([basicEmployerAmount, supplementaryEmployerAmount])

  return {
    declaredBase,
    actualBase,
    appliedLowerLimit,
    employeeType: normalizedEmployeeType,
    employeeRate: normalizedRate,
    employerRate: normalizedRate,
    basicEmployeeAmount,
    basicEmployerAmount,
    supplementaryEmployeeRate: normalizedSupplementaryRate,
    supplementaryEmployerRate: normalizedSupplementaryRate,
    supplementaryEmployeeAmount,
    supplementaryEmployerAmount,
    employeeAmount,
    employerAmount,
    policy,
    provisional: Boolean(policy.provisional),
  }
}
