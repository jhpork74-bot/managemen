/** Monthly checklist progress belongs to its saved month, never another cycle. */
function monthlyInspectionProgress(source, targetMonth) {
  var items = (source.items || []).filter(function (item) { return item.frequency === 'monthly'; });
  var record = (source.monthlyChecks || {})[targetMonth] || {};
  var completed = items.filter(function (item) {
    if (record[item.id] !== true) return false;
    var actualDate = record._dates && record._dates[item.id];
    return !actualDate || String(actualDate).slice(0, 7) === targetMonth;
  }).length;
  return { done: completed, total: items.length, percent: items.length ? Math.round(completed / items.length * 100) : 0 };
}
