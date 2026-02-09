export function formatMetric(value, decimals = 0) {
  if (value == null || Number.isNaN(value)) return "--";
  return Number(value).toFixed(decimals);
}
