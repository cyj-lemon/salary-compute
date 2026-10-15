<script setup>
import { computed, reactive, ref, toRaw, watch } from 'vue'
import {
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Info,
  Landmark,
  Settings2,
} from 'lucide-vue-next'
import { CITY_META, DATA_UPDATED_AT } from './config/cityRules.js'
import {
  HOUSING_FUND_DEFAULT_RATES,
  HOUSING_FUND_RATE_LIMITS,
  HOUSING_FUND_RULES,
} from './config/housingFundRules.js'
import { SOCIAL_INSURANCE_RULES } from './config/socialInsuranceRules.js'
import { BONUS_SOURCE, TAX_SOURCE } from './config/taxRules.js'
import { SPECIAL_DEDUCTION_SOURCE } from './config/specialDeductions.js'
import {
  ADDITIONAL_INCOME_RULES,
  isSigningBonusIncludedInBase,
  SIGNING_BONUS_SCHEDULES,
} from './config/additionalIncomeRules.js'
import {
  EQUITY_INCENTIVE_SOURCE,
  EQUITY_INCENTIVE_TIMING_SOURCE,
} from './config/equityIncentiveRules.js'
import { calculateBonusTax } from './calculators/bonusTaxCalculator.js'
import { calculateIncome, compareCities } from './calculators/incomeCalculator.js'

const cities = Object.keys(CITY_META)
const insuranceFields = [
  ['pension', '养老缴费基数'],
  ['medical', '医疗缴费基数'],
  ['unemployment', '失业缴费基数'],
  ['injury', '工伤缴费基数'],
  ['maternity', '生育缴费基数'],
  ['fund', '公积金缴存基数'],
]

const form = reactive({
  city: 'beijing',
  year: 2026,
  salary: 30000,
  bonus: 100000,
  hasHousingAllowance: false,
  housingAllowance: 0,
  hasSigningBonus: false,
  signingBonus: 0,
  signingBonusSchedule: 'one-time',
  signingBonusMonth: 1,
  hasEquityIncentive: false,
  equityIncentiveAmount: 0,
  hasShanghaiSupplementaryFund: true,
  fundRate: HOUSING_FUND_DEFAULT_RATES.beijing,
  fundEmployeeType: 'existing',
  otherDeduction: 0,
  customBases: {
    pension: '',
    medical: '',
    unemployment: '',
    injury: '',
    maternity: '',
    fund: '',
  },
  deductions: {
    infantCount: 0,
    childCount: 0,
    continuingEducation: false,
    housing: 'none',
    elderCare: 'none',
  },
})

const advancedOpen = ref(false)
const deductionsOpen = ref(false)
const activeTab = ref('details')
const expandedMonth = ref(null)
const justCalculated = ref(false)

function createCalculationInput() {
  const cleanInput = structuredClone(toRaw(form))
  cleanInput.salary = Math.max(0, Number(cleanInput.salary || 0))
  cleanInput.bonus = Math.max(0, Number(cleanInput.bonus || 0))
  cleanInput.housingAllowance = cleanInput.hasHousingAllowance
    ? Math.max(0, Number(cleanInput.housingAllowance || 0))
    : 0
  cleanInput.signingBonus = cleanInput.hasSigningBonus
    ? Math.max(0, Number(cleanInput.signingBonus || 0))
    : 0
  cleanInput.equityIncentiveAmount = cleanInput.hasEquityIncentive
    ? Math.max(0, Number(cleanInput.equityIncentiveAmount || 0))
    : 0
  cleanInput.supplementaryFundRate = cleanInput.hasShanghaiSupplementaryFund ? 0.05 : 0
  return cleanInput
}

const calculationInput = ref(createCalculationInput())
const result = ref(calculateIncome(calculationInput.value))

watch(
  () => form.city,
  (city) => {
    form.fundRate = HOUSING_FUND_DEFAULT_RATES[city]
  },
)

function runCalculation() {
  const cleanInput = createCalculationInput()
  calculationInput.value = cleanInput
  result.value = calculateIncome(cleanInput)
  justCalculated.value = true
  window.setTimeout(() => (justCalculated.value = false), 700)
}

function toggleMonth(month) {
  expandedMonth.value = expandedMonth.value === month ? null : month
}

const money = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const compactMoney = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
})

const formatMoney = (value) => money.format(Number(value || 0))
const formatCompact = (value) => compactMoney.format(Number(value || 0))
const formatPercent = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`
const formatRate = (value) => `${(Number(value || 0) * 100).toFixed(2).replace(/\.00$/, '')}%`

const recommendedName = computed(() =>
  result.value.bonus.recommended === 'separate' ? '年终奖单独计税' : '年终奖并入综合所得',
)
const selectedBonus = computed(() => result.value.bonus[result.value.bonus.recommended])

const cityComparison = computed(() => compareCities(calculationInput.value))
const comparisonMax = computed(() => Math.max(
  ...cityComparison.value.map((item) => item.annualFinalIncome),
  1,
))
const fundRateLimits = computed(() => HOUSING_FUND_RATE_LIMITS[form.city])
const signingScheduleOptions = Object.entries(SIGNING_BONUS_SCHEDULES)

function signingBaseScope(city, schedule) {
  const rule = ADDITIONAL_INCOME_RULES[city]
  const scopes = []
  if (isSigningBonusIncludedInBase(rule, 'social', schedule)) scopes.push('社保')
  if (isSigningBonusIncludedInBase(rule, 'fund', schedule)) scopes.push('公积金')
  return scopes.length ? scopes.join('、') : '均不计入'
}

const currentSigningBaseScope = computed(() =>
  signingBaseScope(form.city, form.signingBonusSchedule),
)

const maxMonthlyGross = computed(() =>
  Math.max(...result.value.months.map((month) => month.grossSalary), 1),
)
const maxMonthlyTax = computed(() =>
  Math.max(...result.value.months.map((month) => month.currentTax), 1),
)

const composition = computed(() => {
  const summary = result.value.summary
  const finalIncome = Math.max(summary.annualFinalIncome, 1)
  const items = [
    { key: 'salaryCash', label: '工资性现金到手', value: summary.annualSalaryTakeHome, percent: summary.annualSalaryTakeHome / finalIncome },
    { key: 'fund', label: '双边公积金', value: summary.annualTotalFund, percent: summary.annualTotalFund / finalIncome },
    { key: 'bonus', label: '税后年终奖', value: summary.annualBonusNet, percent: summary.annualBonusNet / finalIncome },
    { key: 'equity', label: '税后股权价值', value: summary.annualEquityNet, percent: summary.annualEquityNet / finalIncome },
  ]
  const visibleItems = items.filter((item) => item.value > 0)
  return visibleItems.length ? visibleItems : [items[0]]
})

const taxLinePoints = computed(() => {
  const width = 720
  const height = 170
  return result.value.months
    .map((month, index) => {
      const x = 18 + (index / 11) * (width - 36)
      const y = height - 20 - (month.currentTax / maxMonthlyTax.value) * (height - 46)
      return `${x},${y}`
    })
    .join(' ')
})

const bonusCurve = computed(() => {
  const base = result.value
  const maxBonus = Math.max(Number(calculationInput.value.bonus) * 1.5, 120000)
  const points = Array.from({ length: 25 }, (_, index) => {
    const bonus = (maxBonus * index) / 24
    const comparison = calculateBonusTax({
      bonus,
      regularTaxableIncome: base.months.at(-1).cumulativeTaxable,
      regularTax: base.summary.regularTax,
    })
    return { bonus, separate: comparison.separate.tax, integrated: comparison.integrated.tax }
  })
  const maxTax = Math.max(...points.flatMap((point) => [point.separate, point.integrated]), 1)
  const makePoints = (key) =>
    points
      .map((point, index) => {
        const x = 20 + (index / 24) * 680
        const y = 160 - (point[key] / maxTax) * 128
        return `${x},${y}`
      })
      .join(' ')
  return { maxBonus, maxTax, separate: makePoints('separate'), integrated: makePoints('integrated') }
})

const policySources = computed(() => {
  const city = calculationInput.value.city
  const sources = [
    TAX_SOURCE,
    BONUS_SOURCE,
    SPECIAL_DEDUCTION_SOURCE,
    EQUITY_INCENTIVE_SOURCE,
    EQUITY_INCENTIVE_TIMING_SOURCE,
  ]
  Object.values(SOCIAL_INSURANCE_RULES[city]).forEach((rules) => {
    rules.forEach((rule) => sources.push(rule.source, rule.rateSource, rule.upperLimitSource))
  })
  HOUSING_FUND_RULES[city].forEach((rule) => sources.push(rule.source, rule.newEmployeeSource))
  sources.push(...ADDITIONAL_INCOME_RULES[city].sources)
  return sources.filter(
    (item, index, array) => item && array.findIndex((candidate) => candidate?.url === item.url) === index,
  )
})

const tabs = [
  { id: 'details', label: '月度明细' },
  { id: 'charts', label: '收入图表' },
  { id: 'bonus', label: '年终奖分析' },
  { id: 'cities', label: '城市对比' },
  { id: 'policy', label: '政策依据' },
]
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand-block">
        <div class="brand-mark"><Calculator :size="22" /></div>
        <div>
          <p class="eyebrow">2026 PERSONAL INCOME</p>
          <h1>税后工资计算器</h1>
          <p class="subtitle">输入工资，看看每个月真正到手多少钱</p>
        </div>
      </div>
      <div class="policy-stamp">
        <span class="status-dot"></span>
        政策数据更新于 {{ DATA_UPDATED_AT }}
      </div>
    </header>

    <main>
      <section class="calculator-layout" aria-label="收入计算器">
        <aside class="input-panel">
          <div class="panel-heading">
            <div>
              <span class="step-label">01 / INPUT</span>
              <h2>收入与参保信息</h2>
            </div>
            <span class="year-chip">2026 年</span>
          </div>

          <div class="field-group">
            <label>工作城市</label>
            <div class="city-switch" role="group" aria-label="选择工作城市">
              <button
                v-for="city in cities"
                :key="city"
                type="button"
                :class="{ active: form.city === city }"
                :aria-pressed="form.city === city"
                @click="form.city = city"
              >
                <span>{{ CITY_META[city].short }}</span>{{ CITY_META[city].name }}
              </button>
            </div>
          </div>

          <div class="field-row">
            <div class="field-group">
              <label for="salary">月薪</label>
              <div class="amount-input">
                <span>¥</span>
                <input id="salary" v-model.number="form.salary" type="number" min="0" step="500" />
                <small>元/月</small>
              </div>
            </div>
            <div class="field-group">
              <label for="bonus">年终奖</label>
              <div class="amount-input">
                <span>¥</span>
                <input id="bonus" v-model.number="form.bonus" type="number" min="0" step="1000" />
                <small>元</small>
              </div>
            </div>
          </div>

          <div class="additional-income-options" aria-label="额外收入">
            <div class="income-option">
              <label class="check-row income-option-toggle">
                <input v-model="form.hasHousingAllowance" type="checkbox" />
                <span><Check :size="14" /></span><strong>每月额外房补</strong>
              </label>
              <label v-if="form.hasHousingAllowance" class="compact-income-field" for="housing-allowance">
                <span>每月金额</span>
                <div class="amount-input compact">
                  <span>¥</span>
                  <input id="housing-allowance" v-model.number="form.housingAllowance" type="number" min="0" step="100" />
                  <small>元/月</small>
                </div>
              </label>
            </div>

            <div class="income-option">
              <label class="check-row income-option-toggle">
                <input v-model="form.hasSigningBonus" type="checkbox" />
                <span><Check :size="14" /></span><strong>签字费</strong>
              </label>
              <div v-if="form.hasSigningBonus" class="income-option-fields">
                <label class="compact-income-field" for="signing-bonus">
                  <span>签字费总额</span>
                  <div class="amount-input compact">
                    <span>¥</span>
                    <input id="signing-bonus" v-model.number="form.signingBonus" type="number" min="0" step="1000" />
                    <small>元</small>
                  </div>
                </label>
                <label class="compact-income-field" for="signing-schedule">
                  <span>发放方式</span>
                  <select id="signing-schedule" v-model="form.signingBonusSchedule">
                    <option v-for="([key, item]) in signingScheduleOptions" :key="key" :value="key">{{ item.label }}</option>
                  </select>
                </label>
                <label v-if="form.signingBonusSchedule === 'one-time'" class="compact-income-field" for="signing-month">
                  <span>发放月份</span>
                  <select id="signing-month" v-model.number="form.signingBonusMonth">
                    <option v-for="month in 12" :key="month" :value="month">{{ month }} 月</option>
                  </select>
                </label>
                <p v-else-if="form.signingBonusSchedule === 'semiannual'" class="schedule-note">6 月、12 月各发一半</p>
              </div>
            </div>

            <div class="income-option">
              <label class="check-row income-option-toggle">
                <input v-model="form.hasEquityIncentive" type="checkbox" />
                <span><Check :size="14" /></span><strong>股票 / 期权归属</strong>
              </label>
              <label v-if="form.hasEquityIncentive" class="compact-income-field" for="equity-incentive">
                <span>年度归属计税价值</span>
                <div class="amount-input compact">
                  <span>¥</span>
                  <input id="equity-incentive" v-model.number="form.equityIncentiveAmount" type="number" min="0" step="1000" />
                  <small>元/年</small>
                </div>
              </label>
            </div>

            <p v-if="form.hasHousingAllowance || form.hasSigningBonus" class="base-rule-note">
              <strong>{{ CITY_META[form.city].name }}缴费基数</strong>
              <span v-if="form.hasHousingAllowance">房补：社保、公积金</span>
              <span v-if="form.hasSigningBonus">签字费：不改变本年度默认缴费基数；以后核定口径：{{ currentSigningBaseScope }}</span>
            </p>
          </div>

          <div class="setting-summary">
            <div>
              <span class="setting-icon"><Landmark :size="17" /></span>
              <div>
                <strong>五险一金</strong>
                <small>按 {{ CITY_META[form.city].name }} 政策自动计算</small>
              </div>
            </div>
            <button type="button" class="icon-text-button" @click="advancedOpen = !advancedOpen">
              <Settings2 :size="16" />自定义
              <ChevronDown :size="15" :class="{ rotated: advancedOpen }" />
            </button>
          </div>

          <label v-if="form.city === 'shanghai'" class="check-row supplementary-fund-toggle">
            <input v-model="form.hasShanghaiSupplementaryFund" type="checkbox" />
            <span><Check :size="14" /></span>
            <strong>补充公积金 5%</strong>
            <small>个人 5% + 公司 5%，与基本公积金使用同一基数</small>
          </label>

          <div v-if="advancedOpen" class="expand-area">
            <p class="form-hint">留空时按本市工资总额口径估算月均基数，并自动应用各项上下限；已申报基数请直接填写。</p>
            <div class="base-grid">
              <label v-for="[key, label] in insuranceFields" :key="key">
                <span>{{ label }}</span>
                <input v-model.number="form.customBases[key]" type="number" min="0" placeholder="自动估算" />
              </label>
            </div>
            <label class="range-field">
              <span>基本公积金个人 / 公司缴存比例 <strong>{{ formatRate(form.fundRate) }}</strong></span>
              <input
                v-model.number="form.fundRate"
                type="range"
                :min="fundRateLimits.min"
                :max="fundRateLimits.max"
                :step="fundRateLimits.step"
              />
              <small><span>{{ formatRate(fundRateLimits.min) }}</span><span>{{ formatRate(fundRateLimits.max) }}</span></small>
            </label>
            <div v-if="form.city === 'shenzhen'" class="choice-field fund-employee-type">
              <label>深圳公积金人员类型</label>
              <div class="segmented-control">
                <button
                  type="button"
                  :class="{ active: form.fundEmployeeType === 'existing' }"
                  :aria-pressed="form.fundEmployeeType === 'existing'"
                  @click="form.fundEmployeeType = 'existing'"
                >存量职工</button>
                <button
                  type="button"
                  :class="{ active: form.fundEmployeeType === 'new' }"
                  :aria-pressed="form.fundEmployeeType === 'new'"
                  @click="form.fundEmployeeType = 'new'"
                >9 月后新入职 / 调入</button>
              </div>
            </div>
            <label class="simple-field">
              <span>其他依法确定的扣除</span>
              <div><input v-model.number="form.otherDeduction" type="number" min="0" /><small>元/月</small></div>
            </label>
          </div>

          <div class="setting-summary deduction-summary">
            <div>
              <span class="setting-icon coral"><Calculator :size="17" /></span>
              <div>
                <strong>专项附加扣除</strong>
                <small>当前 {{ formatMoney(result.special.monthly) }} / 月</small>
              </div>
            </div>
            <button type="button" class="icon-text-button" @click="deductionsOpen = !deductionsOpen">
              设置<ChevronDown :size="15" :class="{ rotated: deductionsOpen }" />
            </button>
          </div>

          <div v-if="deductionsOpen" class="expand-area deduction-form">
            <div class="counter-row">
              <label>3 岁以下婴幼儿</label>
              <input v-model.number="form.deductions.infantCount" type="number" min="0" max="10" />
              <span>名</span>
            </div>
            <div class="counter-row">
              <label>接受教育子女</label>
              <input v-model.number="form.deductions.childCount" type="number" min="0" max="10" />
              <span>名</span>
            </div>
            <label class="check-row">
              <input v-model="form.deductions.continuingEducation" type="checkbox" />
              <span><Check :size="14" /></span>学历（学位）继续教育
            </label>
            <div class="choice-field">
              <label>住房情况</label>
              <div class="segmented-control">
                <button
                  v-for="item in [
                    { value: 'none', label: '无' },
                    { value: 'rent', label: '租房' },
                    { value: 'loan', label: '首套房贷' },
                  ]"
                  :key="item.value"
                  type="button"
                  :class="{ active: form.deductions.housing === item.value }"
                  :aria-pressed="form.deductions.housing === item.value"
                  @click="form.deductions.housing = item.value"
                >{{ item.label }}</button>
              </div>
            </div>
            <div class="choice-field">
              <label>赡养老人</label>
              <div class="segmented-control">
                <button
                  v-for="item in [
                    { value: 'none', label: '无' },
                    { value: 'only', label: '独生子女' },
                    { value: 'nonOnly', label: '非独生' },
                  ]"
                  :key="item.value"
                  type="button"
                  :class="{ active: form.deductions.elderCare === item.value }"
                  :aria-pressed="form.deductions.elderCare === item.value"
                  @click="form.deductions.elderCare = item.value"
                >{{ item.label }}</button>
              </div>
            </div>
            <p class="form-hint">子女数量按由本人 100% 申报的份数计算；非独生子女赡养老人按每月上限 1,500 元估算。</p>
          </div>

          <button type="button" class="calculate-button" @click="runCalculation">
            <Calculator :size="19" />开始计算
          </button>
        </aside>

        <section class="summary-panel" :class="{ pulse: justCalculated }">
          <div class="summary-head">
            <div>
              <span class="step-label light">02 / RESULT</span>
              <p>最终全年所得</p>
              <h2>{{ formatMoney(result.summary.annualFinalIncome) }}</h2>
              <div class="summary-meta">
                <span class="plan-badge"><Check :size="14" />已采用：{{ recommendedName }}</span>
                <span>工资性现金 + 双边公积金 + 税后年终奖<span v-if="result.summary.annualEquityGross > 0"> + 税后股权</span></span>
              </div>
            </div>
            <div class="average-block">
              <span>最终所得月均</span>
              <strong>{{ formatMoney(result.summary.averageMonthlyFinalIncome) }}</strong>
              <small>年度所得按 12 个月平均</small>
            </div>
          </div>

          <div class="income-breakdown" aria-label="最终全年所得构成">
            <div>
              <span>工资性现金到手</span>
              <strong>{{ formatMoney(result.summary.annualSalaryTakeHome) }}</strong>
              <small>基础工资、房补与签字费税后现金</small>
            </div>
            <div>
              <span>双边公积金</span>
              <strong>{{ formatMoney(result.summary.annualTotalFund) }}</strong>
              <small>个人 {{ formatMoney(result.summary.annualFund) }} + 公司 {{ formatMoney(result.summary.annualEmployerFund) }}</small>
              <small v-if="result.summary.annualTotalSupplementaryFund > 0">其中补充双边 {{ formatMoney(result.summary.annualTotalSupplementaryFund) }}</small>
            </div>
            <div>
              <span>税后年终奖</span>
              <strong>{{ formatMoney(result.summary.annualBonusNet) }}</strong>
              <small>税前 {{ formatMoney(result.summary.annualBonusGross) }} − 个税 {{ formatMoney(result.summary.annualBonusTax) }}</small>
            </div>
            <div v-if="result.summary.annualEquityGross > 0">
              <span>税后股权价值</span>
              <strong>{{ formatMoney(result.summary.annualEquityNet) }}</strong>
              <small>计税价值 {{ formatMoney(result.summary.annualEquityGross) }} − 个税 {{ formatMoney(result.summary.annualEquityTax) }}</small>
            </div>
          </div>

          <div class="result-metrics">
            <div>
              <span>全年税前收入</span>
              <strong>{{ formatMoney(result.summary.annualGross) }}</strong>
              <small>工资性收入 + 年终奖<span v-if="result.summary.annualEquityGross > 0"> + 股权</span></small>
            </div>
            <div>
              <span>基础工资</span>
              <strong>{{ formatMoney(result.summary.annualBaseSalaryGross) }}</strong>
              <small>月薪 × 12</small>
            </div>
            <div>
              <span>现金房补</span>
              <strong>{{ formatMoney(result.summary.annualHousingAllowance) }}</strong>
              <small>每月房补 × 12</small>
            </div>
            <div>
              <span>签字费</span>
              <strong>{{ formatMoney(result.summary.annualSigningBonus) }}</strong>
              <small>{{ SIGNING_BONUS_SCHEDULES[result.input.signingBonusSchedule].label }}</small>
            </div>
            <div>
              <span>个人社保</span>
              <strong>{{ formatMoney(result.summary.annualSocial) }}</strong>
              <small>养老、医疗、失业</small>
            </div>
            <div>
              <span>全年个人所得税</span>
              <strong>{{ formatMoney(result.summary.annualTax) }}</strong>
              <small>综合税负 {{ formatPercent(result.summary.taxRate) }}</small>
            </div>
          </div>

          <div v-if="result.hasProvisionalPolicy" class="policy-warning">
            <CircleAlert :size="17" />
            <span>当前城市有尚未发布新年度标准的项目，已沿用最近有效官方参数，结果适合测算参考。</span>
          </div>
        </section>
      </section>

      <section class="analysis-section">
        <nav class="analysis-tabs" aria-label="结果详情">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            :class="{ active: activeTab === tab.id }"
            :aria-pressed="activeTab === tab.id"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </nav>

        <div v-if="activeTab === 'details'" class="tab-content table-view">
          <div class="section-heading">
            <div><span class="step-label">MONTHLY LEDGER</span><h2>2026 年月度工资明细</h2></div>
            <p>工资性收入按累计预扣法计税；年终奖和股权激励的年度计税明细位于表格下方。</p>
          </div>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th aria-label="展开"></th><th>月份</th><th>税前收入</th><th>养老</th><th>医疗</th><th>失业</th><th>个人公积金</th><th>个人社保合计</th><th>累计应纳税所得额</th><th>当月个税</th><th>现金到手</th><th>含双边公积金所得</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="month in result.months" :key="month.month">
                  <tr class="data-row" :class="{ expanded: expandedMonth === month.month }" @click="toggleMonth(month.month)">
                    <td><button type="button" class="row-toggle" :aria-label="`展开 ${month.month} 月计算过程`" :aria-expanded="expandedMonth === month.month" @click.stop="toggleMonth(month.month)"><ChevronDown v-if="expandedMonth === month.month" :size="15" /><ChevronRight v-else :size="15" /></button></td>
                    <td><strong>{{ month.month }} 月</strong></td>
                    <td>{{ formatMoney(month.grossSalary) }}</td>
                    <td>{{ formatMoney(month.social.items.find((item) => item.key === 'pension').employeeAmount) }}</td>
                    <td>{{ formatMoney(month.social.items.find((item) => item.key === 'medical').employeeAmount) }}</td>
                    <td>{{ formatMoney(month.social.items.find((item) => item.key === 'unemployment').employeeAmount) }}</td>
                    <td>{{ formatMoney(month.fund.employeeAmount) }}</td>
                    <td>{{ formatMoney(month.social.employeeTotal) }}</td>
                    <td>{{ formatMoney(month.cumulativeTaxable) }}</td>
                    <td class="tax-cell">{{ formatMoney(month.currentTax) }}</td>
                    <td class="takehome-cell">{{ formatMoney(month.takeHome) }}</td>
                    <td class="income-with-fund-cell">{{ formatMoney(month.incomeWithFund) }}</td>
                  </tr>
                  <tr v-if="expandedMonth === month.month" class="detail-row">
                    <td colspan="12">
                      <div class="calculation-detail">
                        <div class="formula-block">
                          <span>累计应纳税所得额</span>
                          <strong>{{ formatMoney(month.cumulativeTaxable) }}</strong>
                          <p>{{ formatCompact(month.cumulativeIncome) }} 累计收入 − {{ formatCompact(month.cumulativeBasicDeduction) }} 基本减除 − {{ formatCompact(month.cumulativeSocial + month.cumulativeFund) }} 专项扣除 − {{ formatCompact(month.cumulativeSpecial + month.cumulativeOther) }} 其他扣除</p>
                          <p class="income-formula">当月：{{ formatCompact(month.baseSalary) }} 基础工资<span v-if="month.housingAllowance"> + {{ formatCompact(month.housingAllowance) }} 房补</span><span v-if="month.signingBonus"> + {{ formatCompact(month.signingBonus) }} 签字费</span></p>
                        </div>
                        <dl>
                          <div><dt>累计收入</dt><dd>{{ formatMoney(month.cumulativeIncome) }}</dd></div>
                          <div><dt>累计基本减除</dt><dd>{{ formatMoney(month.cumulativeBasicDeduction) }}</dd></div>
                          <div><dt>累计专项扣除</dt><dd>{{ formatMoney(month.cumulativeSocial + month.cumulativeFund) }}</dd></div>
                          <div><dt>累计附加扣除</dt><dd>{{ formatMoney(month.cumulativeSpecial) }}</dd></div>
                          <div><dt>适用税率</dt><dd>{{ formatRate(month.taxRate) }}</dd></div>
                          <div><dt>速算扣除数</dt><dd>{{ formatMoney(month.quickDeduction) }}</dd></div>
                          <div><dt>累计应缴税额</dt><dd>{{ formatMoney(month.cumulativeTax) }}</dd></div>
                          <div><dt>前期已缴税额</dt><dd>{{ formatMoney(month.previousPaidTax) }}</dd></div>
                        </dl>
                        <div class="base-detail">
                          <span>当月实际缴费基数</span>
                          <p v-for="item in month.social.items" :key="item.key">{{ item.label }} {{ formatCompact(item.actualBase) }} <small>个人 {{ formatRate(item.employeeRate) }}</small></p>
                          <p>基本公积金 {{ formatCompact(month.fund.actualBase) }} <small>个人 {{ formatRate(month.fund.employeeRate) }} + 公司 {{ formatRate(month.fund.employerRate) }}</small></p>
                          <p v-if="month.fund.supplementaryEmployeeRate > 0">补充公积金 {{ formatCompact(month.fund.actualBase) }} <small>个人 {{ formatRate(month.fund.supplementaryEmployeeRate) }} + 公司 {{ formatRate(month.fund.supplementaryEmployerRate) }}</small></p>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
              <tfoot>
                <tr><td></td><td>全年工资性收入</td><td>{{ formatMoney(result.summary.annualSalaryGross) }}</td><td colspan="4"></td><td>{{ formatMoney(result.summary.annualSocial) }}</td><td></td><td>{{ formatMoney(result.summary.regularTax) }}</td><td>{{ formatMoney(result.summary.annualSalaryTakeHome) }}</td><td>{{ formatMoney(result.summary.annualSalaryTakeHome + result.summary.annualTotalFund) }}</td></tr>
              </tfoot>
            </table>
          </div>
          <section class="bonus-ledger" aria-label="年终奖计税明细">
            <div class="bonus-ledger-head">
              <div><span>YEAR-END BONUS</span><strong>年终奖计税明细</strong></div>
              <span class="plan-badge"><Check :size="14" />{{ recommendedName }}</span>
            </div>
            <dl>
              <div><dt>税前年终奖</dt><dd>{{ formatMoney(result.summary.annualBonusGross) }}</dd></div>
              <div><dt>{{ result.bonus.recommended === 'separate' ? '月度换算额' : '并入后应纳税所得额' }}</dt><dd>{{ formatMoney(result.bonus.recommended === 'separate' ? result.bonus.monthlyEquivalent : result.months.at(-1).cumulativeTaxable + result.bonus.bonus) }}</dd></div>
              <div><dt>{{ result.bonus.recommended === 'separate' ? '适用税率' : '合并后边际税率' }}</dt><dd>{{ formatRate(selectedBonus.rate) }}</dd></div>
              <div><dt>{{ result.bonus.recommended === 'separate' ? '速算扣除数' : '合并后速算扣除数' }}</dt><dd>{{ formatMoney(selectedBonus.quickDeduction) }}</dd></div>
              <div><dt>年终奖个税</dt><dd>{{ formatMoney(result.summary.annualBonusTax) }}</dd></div>
              <div><dt>税后年终奖</dt><dd>{{ formatMoney(result.summary.annualBonusNet) }}</dd></div>
            </dl>
            <p>{{ result.bonus.recommended === 'separate' ? '税额 = 税前年终奖 × 适用税率 − 速算扣除数。' : '奖金增加税额 = 并入奖金后的综合所得税额 − 工资部分个税。' }}</p>
          </section>
          <section v-if="result.summary.annualEquityGross > 0" class="bonus-ledger equity-ledger" aria-label="股权激励计税明细">
            <div class="bonus-ledger-head">
              <div><span>EQUITY INCENTIVE</span><strong>股票 / 期权计税明细</strong></div>
              <span class="plan-badge"><Check :size="14" />单独计税</span>
            </div>
            <dl>
              <div><dt>年度归属计税价值</dt><dd>{{ formatMoney(result.summary.annualEquityGross) }}</dd></div>
              <div><dt>适用税率</dt><dd>{{ formatRate(result.equity.rate) }}</dd></div>
              <div><dt>速算扣除数</dt><dd>{{ formatMoney(result.equity.quickDeduction) }}</dd></div>
              <div><dt>股权激励个税</dt><dd>{{ formatMoney(result.summary.annualEquityTax) }}</dd></div>
              <div><dt>税后股权价值</dt><dd>{{ formatMoney(result.summary.annualEquityNet) }}</dd></div>
            </dl>
            <p>按符合条件的上市公司股权激励估算，年度内多次取得需合并；输入值应为行权、解禁或取得奖励时确认的应税收入。</p>
          </section>
          <p class="table-note"><Info :size="15" />“含双边公积金所得”= 现金到手 + 个人公积金 + 公司公积金；公积金进入个人账户，但不是当月可自由支配现金。工伤与生育保险由单位缴纳，个人金额为 0。</p>
        </div>

        <div v-else-if="activeTab === 'charts'" class="tab-content charts-view">
          <div class="section-heading">
            <div><span class="step-label">INCOME VIEW</span><h2>全年收入变化</h2></div>
            <p>税率随累计应纳税所得额提升，当月个税可能出现阶梯变化。</p>
          </div>
          <div class="chart-grid">
            <figure class="chart-block salary-chart">
              <figcaption><strong>每月税前与税后</strong><span><i class="gross"></i>税前 <i class="net"></i>到手</span></figcaption>
              <div class="bar-chart">
                <div v-for="month in result.months" :key="month.month" class="bar-column">
                  <div class="bar-stack">
                    <span class="gross-bar" :style="{ height: `${(month.grossSalary / maxMonthlyGross) * 100}%` }"></span>
                    <span class="net-bar" :style="{ height: `${(month.takeHome / maxMonthlyGross) * 100}%` }"></span>
                  </div>
                  <small>{{ month.month }}月</small>
                </div>
              </div>
            </figure>
            <figure class="chart-block tax-chart">
              <figcaption><strong>每月个人所得税</strong><span>峰值 {{ formatCompact(maxMonthlyTax) }}</span></figcaption>
              <svg viewBox="0 0 720 170" role="img" aria-label="每月个人所得税折线图">
                <line x1="18" y1="150" x2="702" y2="150" class="axis-line" />
                <line x1="18" y1="86" x2="702" y2="86" class="grid-line" />
                <polyline :points="taxLinePoints" class="tax-line" />
                <circle
                  v-for="(month, index) in result.months"
                  :key="month.month"
                  :cx="18 + (index / 11) * 684"
                  :cy="150 - (month.currentTax / maxMonthlyTax) * 124"
                  r="4"
                  class="tax-dot"
                ><title>{{ month.month }} 月：{{ formatMoney(month.currentTax) }}</title></circle>
              </svg>
              <div class="chart-axis"><span v-for="month in result.months" :key="month.month">{{ month.month }}月</span></div>
            </figure>
          </div>
          <figure class="flow-chart">
            <figcaption><strong>最终全年所得构成</strong><span>工资性现金、个人账户权益与年度收入</span></figcaption>
            <div class="flow-items">
              <template v-for="(item, index) in composition" :key="item.key">
                <div class="flow-item" :class="item.key"><span>{{ item.label }}</span><strong>{{ formatMoney(item.value) }}</strong><small>{{ formatPercent(item.percent) }}</small></div>
                <ChevronRight v-if="index < composition.length - 1" :size="20" />
              </template>
            </div>
          </figure>
        </div>

        <div v-else-if="activeTab === 'bonus'" class="tab-content bonus-view">
          <div class="section-heading">
            <div><span class="step-label">BONUS TAX</span><h2>{{ formatMoney(result.bonus.bonus) }} 年终奖怎么计税</h2></div>
            <p>全年一次性奖金单独计税政策执行至 2027 年 12 月 31 日。</p>
          </div>
          <div class="bonus-layout">
            <div class="plan-comparison">
              <article class="plan-card" :class="{ recommended: result.bonus.recommended === 'separate' }">
                <div class="plan-title"><span>方案 A</span><strong>单独计税</strong><em v-if="result.bonus.recommended === 'separate'"><Check :size="13" />本次更省</em></div>
                <dl><div><dt>应缴个税</dt><dd>{{ formatMoney(result.bonus.separate.tax) }}</dd></div><div><dt>税后奖金</dt><dd>{{ formatMoney(result.bonus.separate.net) }}</dd></div><div><dt>月度换算额</dt><dd>{{ formatMoney(result.bonus.monthlyEquivalent) }}</dd></div><div><dt>适用税率</dt><dd>{{ formatRate(result.bonus.separate.rate) }}</dd></div></dl>
              </article>
              <article class="plan-card" :class="{ recommended: result.bonus.recommended === 'integrated' }">
                <div class="plan-title"><span>方案 B</span><strong>并入综合所得</strong><em v-if="result.bonus.recommended === 'integrated'"><Check :size="13" />本次更省</em></div>
                <dl><div><dt>奖金增加税额</dt><dd>{{ formatMoney(result.bonus.integrated.tax) }}</dd></div><div><dt>税后奖金</dt><dd>{{ formatMoney(result.bonus.integrated.net) }}</dd></div><div><dt>并入后总个税</dt><dd>{{ formatMoney(result.bonus.integrated.totalTax) }}</dd></div><div><dt>与另一方案差额</dt><dd>{{ formatMoney(result.bonus.difference) }}</dd></div></dl>
              </article>
              <div class="savings-callout">选择 <strong>{{ recommendedName }}</strong>，预计少缴 <strong>{{ formatMoney(result.bonus.difference) }}</strong></div>
            </div>
            <figure class="chart-block bonus-curve">
              <figcaption><strong>奖金金额与税额变化</strong><span><i class="separate"></i>单独计税 <i class="integrated"></i>并入综合所得</span></figcaption>
              <svg viewBox="0 0 720 180" role="img" aria-label="年终奖税额变化曲线">
                <line x1="20" y1="160" x2="700" y2="160" class="axis-line" />
                <line x1="20" y1="96" x2="700" y2="96" class="grid-line" />
                <polyline :points="bonusCurve.separate" class="bonus-line separate" />
                <polyline :points="bonusCurve.integrated" class="bonus-line integrated" />
              </svg>
              <div class="curve-axis"><span>¥0</span><span>{{ formatCompact(bonusCurve.maxBonus / 2) }}</span><span>{{ formatCompact(bonusCurve.maxBonus) }}</span></div>
              <p>曲线用于观察临界区间；实际方案以左侧当前奖金金额的精确计算为准。</p>
            </figure>
          </div>
        </div>

        <div v-else-if="activeTab === 'cities'" class="tab-content cities-view">
          <div class="section-heading">
            <div><span class="step-label">CITY COMPARE</span><h2>相同收入条件下的城市对比</h2></div>
            <p>均使用当前表单中的工资、扣除与自定义基数，仅替换参保城市。</p>
          </div>
          <div class="city-comparison">
            <article v-for="item in cityComparison" :key="item.city" :class="{ current: calculationInput.city === item.city }">
              <div class="city-name"><span :style="{ background: CITY_META[item.city].accent }">{{ CITY_META[item.city].short }}</span><strong>{{ CITY_META[item.city].name }}</strong><small v-if="calculationInput.city === item.city">当前</small></div>
              <div class="comparison-bar"><span :style="{ width: `${Math.max(0, (item.annualFinalIncome / comparisonMax) * 100)}%`, background: CITY_META[item.city].accent }"></span></div>
              <strong class="city-net">{{ formatMoney(item.annualFinalIncome) }}</strong>
              <span class="city-net-label">最终全年所得</span>
              <dl><div><dt>工资性现金到手</dt><dd>{{ formatMoney(item.annualSalaryTakeHome) }}</dd></div><div><dt>双边公积金</dt><dd>{{ formatMoney(item.annualTotalFund) }}</dd></div><div v-if="item.annualTotalSupplementaryFund > 0"><dt>其中补充公积金</dt><dd>{{ formatMoney(item.annualTotalSupplementaryFund) }}</dd></div><div><dt>税后年终奖</dt><dd>{{ formatMoney(item.annualBonusNet) }}</dd></div><div v-if="item.annualEquityGross > 0"><dt>税后股权价值</dt><dd>{{ formatMoney(item.annualEquityNet) }}</dd></div></dl>
              <p v-if="calculationInput.housingAllowance > 0 || calculationInput.signingBonus > 0" class="city-base-rule"><span v-if="calculationInput.housingAllowance > 0">房补计社保、公积金</span><span v-if="calculationInput.signingBonus > 0">签字费不改变当年默认基数；以后核定口径：{{ signingBaseScope(item.city, calculationInput.signingBonusSchedule) }}</span></p>
            </article>
          </div>
          <p class="neutral-note"><Info :size="16" />最终所得包含双边公积金及税后股权价值，不等同于当年可自由支配现金；股权激励税额不因参保城市变化。</p>
        </div>

        <div v-else class="tab-content policy-view">
          <div class="section-heading">
            <div><span class="step-label">POLICY BASIS</span><h2>{{ CITY_META[calculationInput.city].name }}政策依据</h2></div>
            <p>计算年度 2026 · 数据核验日期 {{ DATA_UPDATED_AT }}</p>
          </div>
          <div class="policy-layout">
            <div class="timeline-block">
              <h3>政策时间轴</h3>
              <div v-for="(month, index) in [result.months[0], result.months[6], result.months[8]]" :key="month.date" class="timeline-item">
                <span>{{ index === 0 ? '1 月' : index === 1 ? '7 月' : '9 月' }}</span>
                <div>
                  <strong>{{ month.date.slice(0, 7) }} 使用中的主要参数</strong>
                  <p>养老基数 {{ formatCompact(month.social.items.find((item) => item.key === 'pension').policy.lowerLimit) }} – {{ formatCompact(month.social.items.find((item) => item.key === 'pension').policy.upperLimit) }}；医保基数 {{ formatCompact(month.social.items.find((item) => item.key === 'medical').policy.lowerLimit) }} – {{ formatCompact(month.social.items.find((item) => item.key === 'medical').policy.upperLimit) }}</p>
                  <p>公积金基数 {{ formatCompact(month.fund.appliedLowerLimit) }} – {{ formatCompact(month.fund.policy.upperLimit) }}；基本个人 / 公司各 {{ formatRate(month.fund.employeeRate) }}<span v-if="month.fund.supplementaryEmployeeRate > 0">，补充个人 / 公司各 {{ formatRate(month.fund.supplementaryEmployeeRate) }}</span></p>
                </div>
              </div>
            </div>
            <div class="source-list">
              <h3>官方来源</h3>
              <a v-for="source in policySources" :key="source.url" :href="source.url" target="_blank" rel="noreferrer">
                <span>{{ source.name }}</span><ExternalLink :size="15" />
              </a>
            </div>
          </div>
          <div class="method-note">
            <CircleAlert :size="19" />
            <p><strong>测算口径说明</strong> 签字费在实际发放月份并入工资薪金累计预扣个税，本年度默认缴费基数不因这笔签字费上调；实际在缴基数以已申报值为准，可在高级设置填写。默认基数仍按月薪及当地应计入的房补估算。以后重新核定基数时，任职相关签字费可能按工资总额口径计入：北京、上海、广州的社保及四城公积金通常计入；深圳社保仅按月发放的部分可能计入。上海补充公积金为自愿参加，本工具默认按个人和公司各 5%、与基本公积金相同基数估算。股权部分按符合条件的上市公司激励单独计税；非上市公司递延纳税、转让所得及境外抵免不在本测算内。广东养老和失业的未决 2026 参数沿用最近有效值并标记为暂行；工伤单位费按二类行业 0.4% 估算，不影响个人到手。</p>
          </div>
        </div>
      </section>
    </main>

    <footer>
      <div><Landmark :size="18" /><span>2026 个人税前税后收入计算器</span></div>
      <p>本计算器结果仅供个人测算参考，实际缴税和缴费金额以税务、社保、公积金等官方系统核定结果为准。</p>
    </footer>
  </div>
</template>
