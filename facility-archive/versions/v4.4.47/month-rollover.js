(function () {
  'use strict';
  function checkCalendarDate() {
    var current = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
    if (current === TODAY) return;
    if (document.querySelector('dialog[open]') || (document.activeElement && document.activeElement.matches('input,textarea,select'))) return;
    var previousMonth = TODAY.slice(0, 7);
    var followedToday = selected === TODAY;
    TODAY = current;
    if (month === previousMonth && month !== current.slice(0, 7)) {
      month = current.slice(0, 7);
      selected = current;
    } else if (followedToday) selected = current;
    render();
  }
  setInterval(checkCalendarDate, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkCalendarDate(); });
  document.addEventListener('focusout', function () { setTimeout(checkCalendarDate, 0); });
})();
