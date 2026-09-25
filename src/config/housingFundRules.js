const source = (name, url) => ({ name, url })

const beijing = source(
  '北京住房公积金管理委员会：2026 住房公积金年度缴存通知',
  'https://banshi.beijing.gov.cn/zcjd/202608/t20260831_428685.html',
)
const shanghai2025 = source(
  '上海市住房公积金管理委员会：2025 年度缴存基数和比例通知',
  'https://www.shzfgjj.cn/html/newxxgk/zcwj/gfxwj/228051.html',
)
const shanghai2026 = source(
  '上海市住房公积金管理委员会：2026 年度缴存基数和比例通知',
  'https://www.shzfgjj.cn/html/newxxgk/zcwj/gfxwj/228478.html',
)
const guangzhou = source(
  '广州住房公积金管理中心：2026 年度缴存调整通知',
  'https://gjj.gz.gov.cn/gg/tzgg/content/post_10879601.html',
)
const guangzhouMinimum = source(
  '广州住房公积金管理中心：2026 年 9 月最低缴存基数调整',
  'https://gjj.gz.gov.cn/gkmlpt/content/10/10983/post_10983424.html',
)
const shenzhen = source(
  '深圳市住房公积金管理中心：2026 年度缴存基数',
  'https://www.sz.gov.cn/hdjl/ywzsk/jsj/zfgjj/content/post_12893587.html',
)
const shenzhenNewEmployee = source(
  '深圳市住房公积金管理中心：2026 年 9 月后新入职人员缴存下限',
  'https://zjj.sz.gov.cn/csml/zfgjjtlzx/zmhd/cjwtjd_236/jcyw/content/post_12977412.html',
)

export const HOUSING_FUND_DEFAULT_RATES = {
  beijing: 0.12,
  shanghai: 0.07,
  guangzhou: 0.12,
  shenzhen: 0.05,
}

export const HOUSING_FUND_RATE_LIMITS = {
  beijing: { min: 0.05, max: 0.12, step: 0.01 },
  shanghai: { min: 0.05, max: 0.07, step: 0.01 },
  guangzhou: { min: 0.05, max: 0.12, step: 0.01 },
  shenzhen: { min: 0.05, max: 0.12, step: 0.01 },
}

export const HOUSING_FUND_SUPPLEMENTARY_RATE_LIMITS = {
  shanghai: { min: 0.01, max: 0.05, step: 0.01 },
}

const rule = (effectiveFrom, effectiveTo, lowerLimit, upperLimit, sourceValue, extra = {}) => ({
  effectiveFrom,
  effectiveTo,
  lowerLimit,
  upperLimit,
  source: sourceValue,
  ...extra,
})

export const HOUSING_FUND_RULES = {
  beijing: [
    rule('2026-01-01', '2026-06-30', 2540, 35811, beijing),
    rule('2026-07-01', '2026-12-31', 2540, 36348, beijing),
  ],
  shanghai: [
    rule('2026-01-01', '2026-06-30', 2690, 37302, shanghai2025),
    rule('2026-07-01', '2026-12-31', 2740, 37731, shanghai2026),
  ],
  guangzhou: [
    rule('2026-01-01', '2026-06-30', 2500, 39579, guangzhou),
    rule('2026-07-01', '2026-08-31', 2500, 41697, guangzhou),
    rule('2026-09-01', '2026-12-31', 2680, 41697, guangzhouMinimum),
  ],
  shenzhen: [
    rule('2026-01-01', '2026-06-30', 2520, 44940, shenzhen),
    rule('2026-07-01', '2026-08-31', 2520, 48471, shenzhen),
    rule('2026-09-01', '2026-12-31', 2520, 48471, shenzhen, {
      newEmployeeLowerLimit: 2700,
      newEmployeeSource: shenzhenNewEmployee,
    }),
  ],
}
