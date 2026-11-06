(function () {
  'use strict';
  if (window.FacilityThemeApplied) return;
  window.FacilityThemeApplied = true;
  var grid = document.getElementById('calGrid');
  if (!grid) return;
  var scheduled = false;

  function updateTodayColumn() {
    scheduled = false;
    if (!grid.getClientRects().length) return;
    var headers = Array.from(grid.querySelectorAll('.dow')).filter(function (node) {
      return getComputedStyle(node).display !== 'none';
    });
    var today = grid.querySelector('.day.today');
    if (!today || getComputedStyle(today).display === 'none' || headers.length < 2) {
      grid.style.removeProperty('grid-template-columns');
      return;
    }
    var firstHeaders = Array.from(grid.querySelectorAll('.dow'));
    var visibleToday = Array.from(grid.children).indexOf(today) % firstHeaders.length;
    var column = headers.indexOf(firstHeaders[visibleToday]);
    if (column < 0) {
      grid.style.removeProperty('grid-template-columns');
      return;
    }
    var gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    var count = headers.length;
    var columns = headers.map(function (_, index) {
      var delta = index === column ? 4 : -4 / (count - 1);
      return 'minmax(0,calc((100% - ' + (count - 1) * gap + 'px) / ' + count + (delta >= 0 ? ' + ' : ' - ') + Math.abs(delta) + 'px))';
    }).join(' ');
    if (grid.style.getPropertyValue('grid-template-columns') !== columns) {
      grid.style.setProperty('grid-template-columns', columns, 'important');
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateTodayColumn);
  }
  new MutationObserver(schedule).observe(grid, { childList: true, subtree: true });
  if (window.ResizeObserver) new ResizeObserver(schedule).observe(grid);
  window.addEventListener('resize', schedule);
  window.addEventListener('beforeprint', function () { grid.style.removeProperty('grid-template-columns'); });
  window.addEventListener('afterprint', schedule);
  document.addEventListener('visibilitychange', schedule);
  schedule();
})();
