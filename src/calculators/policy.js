export function monthDate(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`无效的年月：${year}-${month}`)
  }
  return `${year}-${String(month).padStart(2, '0')}-15`
}

function isIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (!match) return false

  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function getEffectiveRule(rules, date) {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('缺少可用的政策规则')
  }
  if (!isIsoDate(date)) {
    throw new RangeError(`无效的政策日期：${date}`)
  }
  const rule = rules.find((item) => item.effectiveFrom <= date && item.effectiveTo >= date)
  if (!rule) {
    throw new Error(`未找到 ${date} 对应的政策规则`)
  }
  return rule
}
