const source = (name, url) => ({ name, url })

const wageTotalSource = source(
  '国家统计局：工资总额包括奖金、津贴和补贴',
  'https://www.stats.gov.cn/sj/zbjs/202302/t20230202_1897107.html',
)

const housingAllowanceSource = source(
  '国家统计局：按月发放的住房补贴计入工资总额',
  'https://www.stats.gov.cn/hd/cjwtjd/202302/t20230207_1902273.html',
)

const citySources = {
  beijing: source(
    '北京市人社局：社保缴费工资基数为本人上年度月平均工资',
    'https://rsj.beijing.gov.cn/xxgk/2024zcjd/202608/t20260821_4831476.html',
  ),
  shanghai: source(
    '上海市人社局：社保基数包含奖金、津贴和补贴',
    'https://rsj.sh.gov.cn/trdhy_17355/20210517/t0035_1399389.html',
  ),
  guangzhou: source(
    '广东省人社厅：企业养老按本人上年度月平均工资收入计征',
    'https://hrss.gd.gov.cn/gkmlpt/content/4/4034/post_4034586.html',
  ),
  shenzhen: source(
    '深圳市人社局：非按月发放的奖金等不计入养老缴费基数',
    'https://www.sz.gov.cn/hdjlpt/detail?pid=3081560',
  ),
}

const fundSources = {
  beijing: source(
    '北京公积金中心：缴存基数按上年度工资总额计算',
    'https://gjj.beijing.gov.cn/web/zwgk61/_300662/436172351/index.html',
  ),
  shanghai: source(
    '上海公积金中心：月平均工资包括奖金、津贴和补贴',
    'https://www.shzfgjj.cn/app/wap/jccalc/tools_paid_web.html',
  ),
  guangzhou: source(
    '广州公积金中心：月平均工资总额包括奖金、津贴和补贴',
    'https://gjj.gz.gov.cn/gkmlpt/content/1/1334/post_1334075.html',
  ),
  shenzhen: source(
    '深圳公积金中心：工资构成按国家统计局规定确定',
    'https://www.sz.gov.cn/hdjlpt/detail?pid=3395214&via=pc',
  ),
}

const annualAverageRule = (city) => ({
  housingAllowance: { socialBase: true, fundBase: true },
  signingBonus: {
    socialBaseSchedules: ['monthly', 'semiannual', 'one-time'],
    fundBaseSchedules: ['monthly', 'semiannual', 'one-time'],
  },
  socialBaseMethod: 'annual-average',
  fundBaseMethod: 'annual-average',
  sources: [wageTotalSource, housingAllowanceSource, citySources[city], fundSources[city]],
})

export const ADDITIONAL_INCOME_RULES = {
  beijing: annualAverageRule('beijing'),
  shanghai: annualAverageRule('shanghai'),
  guangzhou: annualAverageRule('guangzhou'),
  shenzhen: {
    housingAllowance: { socialBase: true, fundBase: true },
    signingBonus: {
      socialBaseSchedules: ['monthly'],
      fundBaseSchedules: ['monthly', 'semiannual', 'one-time'],
    },
    socialBaseMethod: 'monthly-wage',
    fundBaseMethod: 'annual-average',
    sources: [wageTotalSource, housingAllowanceSource, citySources.shenzhen, fundSources.shenzhen],
  },
}

export const SIGNING_BONUS_SCHEDULES = {
  monthly: { label: '按月均发', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  semiannual: { label: '半年发', months: [6, 12] },
  'one-time': { label: '一次性', months: null },
}

export function normalizeSigningBonusSchedule(schedule) {
  return SIGNING_BONUS_SCHEDULES[schedule] ? schedule : 'one-time'
}

export function isSigningBonusIncludedInBase(rule, baseType, schedule) {
  const normalizedSchedule = normalizeSigningBonusSchedule(schedule)
  return rule.signingBonus[`${baseType}BaseSchedules`].includes(normalizedSchedule)
}

export function getAdditionalIncomeRule(city) {
  const rule = ADDITIONAL_INCOME_RULES[city]
  if (!rule) throw new Error(`不支持的城市：${city}`)
  return rule
}
