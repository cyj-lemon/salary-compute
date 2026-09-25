export const BASIC_DEDUCTION_MONTHLY = 5000

export const ANNUAL_TAX_BRACKETS = [
  { max: 36000, rate: 0.03, quickDeduction: 0 },
  { max: 144000, rate: 0.1, quickDeduction: 2520 },
  { max: 300000, rate: 0.2, quickDeduction: 16920 },
  { max: 420000, rate: 0.25, quickDeduction: 31920 },
  { max: 660000, rate: 0.3, quickDeduction: 52920 },
  { max: 960000, rate: 0.35, quickDeduction: 85920 },
  { max: Infinity, rate: 0.45, quickDeduction: 181920 },
]

export const BONUS_MONTHLY_BRACKETS = [
  { max: 3000, rate: 0.03, quickDeduction: 0 },
  { max: 12000, rate: 0.1, quickDeduction: 210 },
  { max: 25000, rate: 0.2, quickDeduction: 1410 },
  { max: 35000, rate: 0.25, quickDeduction: 2660 },
  { max: 55000, rate: 0.3, quickDeduction: 4410 },
  { max: 80000, rate: 0.35, quickDeduction: 7160 },
  { max: Infinity, rate: 0.45, quickDeduction: 15160 },
]

export const TAX_SOURCE = {
  name: '国家税务总局：累计预扣法与综合所得税率表',
  url: 'https://guangdong.chinatax.gov.cn/gdsw/stsw_zsfwpt_zczy_sszy/2024-04/22/744540c3bf1046e3a8e6f332877b2650/files/218a5a30f56e4a16ad4bbae64449d626.pdf',
}

export const BONUS_SOURCE = {
  name: '财政部 税务总局：全年一次性奖金政策延续至 2027 年末',
  url: 'https://fgk.chinatax.gov.cn/zcfgk/c102416/c5211524/content.html',
}
