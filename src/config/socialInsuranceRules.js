const source = (name, url) => ({ name, url })

export const INSURANCE_LABELS = {
  pension: '养老',
  medical: '医疗',
  unemployment: '失业',
  injury: '工伤',
  maternity: '生育',
}

const beijing2025 = source(
  '北京市人社局：2025 年度社保缴费工资基数',
  'https://rsj.beijing.gov.cn/xxgk/2024zcwj/2025/202509/t20250918_4206011.html',
)
const beijing2026 = source(
  '北京市人社局：2026 年度社保缴费工资基数',
  'https://rsj.beijing.gov.cn/xxgk/2024zcwj/202608/t20260821_4831461.html',
)
const beijingMedical = source(
  '北京市医保局：职工医保与生育保险合并实施费率',
  'https://ybj.beijing.gov.cn/zwgk/2024zcjd/202406/t20240617_3717056.html',
)
const beijingRates = source(
  '北京市人社局：养老、失业和工伤保险缴费比例',
  'https://rsj.beijing.gov.cn/bm/ywml/202308/t20230804_3214781.html',
)
const beijingInjury = source(
  '北京市人社局：工伤保险行业基准费率说明',
  'https://rsj.beijing.gov.cn/xxgk/2024zcjd/202406/t20240617_3717641.html',
)
const shanghai2026 = source(
  '上海市政府：2026 年度社保缴费基数',
  'https://www.shanghai.gov.cn/nw17239/20260907/5b1efa2a9f004fb0897103bd4f75f559.html',
)
const shanghaiRates = source(
  '上海市政府：企业职工个人缴费比例',
  'https://www.shanghai.gov.cn/nw17239/20260913/37398bbb63ad4fffa64e0b9deb0f6afc.html',
)
const shanghaiEmployerRates = source(
  '上海市政府：企业职工社会保险单位缴费比例',
  "https://english.shanghai.gov.cn/en-wisEditor'spick/20240830/e046c380607a46ad896daf1c8cd46230.html",
)
const shanghaiInjury = source(
  '上海市政府：2026 年工伤保险行业基准费率',
  'https://www.shanghai.gov.cn/gwk/search/content/t0035_1438097',
)
const guangzhouPension = source(
  '广州市人社局：企业职工养老保险基数',
  'https://rsj.gz.gov.cn/zzzq/shbz/sbfw/gzdt/content/post_10680902.html',
)
const guangzhouMedical = source(
  '广州市政府：职工医保与生育保险筹资标准',
  'https://www.gz.gov.cn/gfxwj/sbmgfxwj/gzsylbzj/content/post_8689834.html',
)
const guangzhouMinimum = source(
  '广州市人社局：2026 年最低工资标准',
  'https://rsj.gz.gov.cn/zzzq/tzgg/content/post_10981804.html',
)
const guangzhouWageStats = source(
  '广州市统计局：2025 年在岗职工平均工资',
  'https://tjj.gz.gov.cn/stats_newtjyw/tjsj/tjgb/qtgb/content/post_10894378.html',
)
const shenzhenPension = source(
  '深圳市政府：企业职工养老保险缴费基数答复',
  'https://www.sz.gov.cn/hdjlpt/detail?pid=3303489',
)
const shenzhenMedical = source(
  '深圳市医保局：2026 年职工医保与生育保险基数',
  'https://hsa.sz.gov.cn/szsylbzjwzgkml/szsylbzjwzgkml/qt/tzgg/content/post_12574511.html',
)
const shenzhenMinimum = source(
  '深圳市人社局：2026 年最低工资标准',
  'https://hrss.sz.gov.cn/gkmlpt/content/12/12954/post_12954870.html',
)
const shenzhenMedicalRates = source(
  '深圳市医保局：职工医保与生育保险缴费比例',
  'https://hsa.sz.gov.cn/szsylbzjwzgkml/szsylbzjwzgkml/seztfw/shbz/wyk/content/post_10983691.html',
)
const guangdongPensionRates = source(
  '广东省税务局：企业职工养老保险单位缴费比例',
  'https://guangdong.chinatax.gov.cn/gdsw/zqsw_tzgg/2024-12/30/content_018b45af0f1947eb81918886a2d9dfd2.shtml',
)
const guangdongUnemploymentRates = source(
  '广东省税务局：失业保险阶段性费率（公布执行至 2025 年末）',
  'https://guangdong.chinatax.gov.cn/gdsw/ssfggds/2025-03/27/content_35c3b0d4c031493ab5ba813f454e2608.shtml',
)
const guangdongInjury = source(
  '广东省人社厅：工伤保险行业基准费率',
  'https://hrss.gd.gov.cn/zcfg/zcfgk/content/post_3269010.html',
)

const industryRateEstimate = (min, max, rateSource, note) => ({
  employerRateKind: 'industry-estimate',
  employerRateRange: { min, max },
  employerRateNote: note,
  rateSource,
})

const rule = (effectiveFrom, effectiveTo, lowerLimit, upperLimit, employeeRate, employerRate, ruleSource, extra = {}) => ({
  effectiveFrom,
  effectiveTo,
  lowerLimit,
  upperLimit,
  employeeRate,
  employerRate,
  source: ruleSource,
  ...extra,
})

export const SOCIAL_INSURANCE_RULES = {
  beijing: {
    pension: [
      rule('2026-01-01', '2026-06-30', 7162, 35811, 0.08, 0.16, beijing2025, { rateSource: beijingRates }),
      rule('2026-07-01', '2026-12-31', 7270, 36348, 0.08, 0.16, beijing2026, { rateSource: beijingRates }),
    ],
    medical: [
      rule('2026-01-01', '2026-06-30', 7162, 35811, 0.02, 0.098, beijing2025, {
        employeeFixed: 3,
        rateSource: beijingMedical,
      }),
      rule('2026-07-01', '2026-12-31', 7270, 36348, 0.02, 0.098, beijing2026, {
        employeeFixed: 3,
        rateSource: beijingMedical,
      }),
    ],
    unemployment: [
      rule('2026-01-01', '2026-06-30', 7162, 35811, 0.005, 0.005, beijing2025, { rateSource: beijingRates }),
      rule('2026-07-01', '2026-12-31', 7270, 36348, 0.005, 0.005, beijing2026, { rateSource: beijingRates }),
    ],
    injury: [
      rule('2026-01-01', '2026-06-30', 7162, 35811, 0, 0.004, beijing2025, industryRateEstimate(
        0.002,
        0.019,
        beijingInjury,
        '按二类行业 0.4% 估算，实际按行业类别及浮动费率核定。',
      )),
      rule('2026-07-01', '2026-12-31', 7270, 36348, 0, 0.004, beijing2026, industryRateEstimate(
        0.002,
        0.019,
        beijingInjury,
        '按二类行业 0.4% 估算，实际按行业类别及浮动费率核定。',
      )),
    ],
    maternity: [
      rule('2026-01-01', '2026-06-30', 7162, 35811, 0, 0, beijingMedical),
      rule('2026-07-01', '2026-12-31', 7270, 36348, 0, 0, beijingMedical),
    ],
  },
  shanghai: {
    pension: [
      rule('2026-01-01', '2026-06-30', 7460, 37302, 0.08, 0.16, shanghaiRates, { rateSource: shanghaiEmployerRates }),
      rule('2026-07-01', '2026-12-31', 7546, 37731, 0.08, 0.16, shanghai2026, { rateSource: shanghaiEmployerRates }),
    ],
    medical: [
      rule('2026-01-01', '2026-06-30', 7460, 37302, 0.02, 0.09, shanghaiRates, { rateSource: shanghaiEmployerRates }),
      rule('2026-07-01', '2026-12-31', 7546, 37731, 0.02, 0.09, shanghai2026, { rateSource: shanghaiEmployerRates }),
    ],
    unemployment: [
      rule('2026-01-01', '2026-06-30', 7460, 37302, 0.005, 0.005, shanghaiRates, { rateSource: shanghaiEmployerRates }),
      rule('2026-07-01', '2026-12-31', 7546, 37731, 0.005, 0.005, shanghai2026, { rateSource: shanghaiEmployerRates }),
    ],
    injury: [
      rule('2026-01-01', '2026-06-30', 7460, 37302, 0, 0.004, shanghaiRates, industryRateEstimate(
        0.002,
        0.019,
        shanghaiInjury,
        '按二类行业 0.4% 估算，实际按行业类别及浮动费率核定。',
      )),
      rule('2026-07-01', '2026-12-31', 7546, 37731, 0, 0.004, shanghai2026, industryRateEstimate(
        0.002,
        0.019,
        shanghaiInjury,
        '按二类行业 0.4% 估算，实际按行业类别及浮动费率核定。',
      )),
    ],
    maternity: [
      rule('2026-01-01', '2026-06-30', 7460, 37302, 0, 0, shanghaiRates),
      rule('2026-07-01', '2026-12-31', 7546, 37731, 0, 0, shanghai2026),
    ],
  },
  guangzhou: {
    pension: [rule('2026-01-01', '2026-12-31', 5510, 27549, 0.08, 0.16, guangzhouPension, {
      provisional: true,
      rateSource: guangdongPensionRates,
    })],
    medical: [rule('2026-01-01', '2026-12-31', 6234, 31170, 0.02, 0.06, guangzhouMedical)],
    unemployment: [
      rule('2026-01-01', '2026-06-30', 2500, 41697, 0.002, 0.008, guangzhouPension, {
        provisional: true,
        rateSource: guangdongUnemploymentRates,
      }),
      rule('2026-07-01', '2026-08-31', 2500, 42933, 0.002, 0.008, guangzhouWageStats, {
        provisional: true,
        rateSource: guangdongUnemploymentRates,
      }),
      rule('2026-09-01', '2026-12-31', 2680, 42933, 0.002, 0.008, guangzhouMinimum, {
        provisional: true,
        rateSource: guangdongUnemploymentRates,
        upperLimitSource: guangzhouWageStats,
      }),
    ],
    injury: [
      rule('2026-01-01', '2026-08-31', 2500, null, 0, 0.004, guangzhouPension, industryRateEstimate(
        0.002,
        0.014,
        guangdongInjury,
        '按二类行业 0.4% 估算，实际按行业类别及浮动费率核定。',
      )),
      rule('2026-09-01', '2026-12-31', 2680, null, 0, 0.004, guangzhouMinimum, industryRateEstimate(
        0.002,
        0.014,
        guangdongInjury,
        '按二类行业 0.4% 估算，实际按行业类别及浮动费率核定。',
      )),
    ],
    maternity: [rule('2026-01-01', '2026-12-31', 6234, 31170, 0, 0.0085, guangzhouMedical)],
  },
  shenzhen: {
    pension: [rule('2026-01-01', '2026-12-31', 4775, 27549, 0.08, 0.16, shenzhenPension, {
      provisional: true,
      rateSource: guangdongPensionRates,
    })],
    medical: [rule('2026-01-01', '2026-12-31', 6727, 33633, 0.02, 0.06, shenzhenMedical, {
      rateSource: shenzhenMedicalRates,
    })],
    unemployment: [
      rule('2026-01-01', '2026-08-31', 2520, 2520, 0.002, 0.008, shenzhenMinimum, {
        provisional: true,
        rateSource: guangdongUnemploymentRates,
      }),
      rule('2026-09-01', '2026-12-31', 2700, 2700, 0.002, 0.008, shenzhenMinimum, {
        provisional: true,
        rateSource: guangdongUnemploymentRates,
      }),
    ],
    injury: [
      rule('2026-01-01', '2026-08-31', 2520, null, 0, 0.004, shenzhenPension, industryRateEstimate(
        0.002,
        0.014,
        guangdongInjury,
        '按二类行业 0.4% 估算，实际按行业类别及浮动费率核定。',
      )),
      rule('2026-09-01', '2026-12-31', 2700, null, 0, 0.004, shenzhenMinimum, industryRateEstimate(
        0.002,
        0.014,
        guangdongInjury,
        '按二类行业 0.4% 估算，实际按行业类别及浮动费率核定。',
      )),
    ],
    maternity: [rule('2026-01-01', '2026-12-31', 6727, 33633, 0, 0.005, shenzhenMedical, {
      rateSource: shenzhenMedicalRates,
    })],
  },
}
