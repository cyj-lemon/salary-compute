import { normalizeCount } from '../calculators/money.js'

export const SPECIAL_DEDUCTION_RULES = {
  infantCarePerChild: 2000,
  childEducationPerChild: 2000,
  continuingEducation: 400,
  housingRent: 1500,
  housingLoan: 1000,
  elderCare: {
    onlyChild: 3000,
    nonOnlyChild: 1500,
  },
}

export const SPECIAL_DEDUCTION_SOURCE = {
  name: '国家税务总局：个人所得税专项附加扣除标准',
  url: 'https://www.chinatax.gov.cn/chinatax/n810356/n3255681/c5214546/content.html',
}

export function calculateSpecialDeduction(input = {}) {
  const rules = SPECIAL_DEDUCTION_RULES
  const normalizedInput = {
    infantCount: normalizeCount(input?.infantCount),
    childCount: normalizeCount(input?.childCount),
    continuingEducation: input?.continuingEducation === true,
    housing: ['rent', 'loan'].includes(input?.housing) ? input.housing : 'none',
    elderCare: ['only', 'nonOnly'].includes(input?.elderCare) ? input.elderCare : 'none',
  }
  const breakdown = {
    infantCare: normalizedInput.infantCount * rules.infantCarePerChild,
    childEducation: normalizedInput.childCount * rules.childEducationPerChild,
    continuingEducation: normalizedInput.continuingEducation ? rules.continuingEducation : 0,
    housing:
      normalizedInput.housing === 'rent'
        ? rules.housingRent
        : normalizedInput.housing === 'loan'
          ? rules.housingLoan
          : 0,
    elderCare:
      normalizedInput.elderCare === 'only'
        ? rules.elderCare.onlyChild
        : normalizedInput.elderCare === 'nonOnly'
          ? rules.elderCare.nonOnlyChild
          : 0,
  }

  return {
    monthly: Object.values(breakdown).reduce((sum, value) => sum + value, 0),
    breakdown,
    input: normalizedInput,
  }
}
