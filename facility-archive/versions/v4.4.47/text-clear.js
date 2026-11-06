(function () {
  'use strict';
  if (window.FacilityTextClear) return;
  window.FacilityTextClear = true;
  var fields = new Map();
  var selector = 'textarea,input:not([type]),input[type="text"],input[type="search"],input[type="email"],input[type="url"],input[type="tel"]';

  function sync() {
    fields.forEach(function (button, input) {
      if (!input.isConnected) {
        fields.delete(input);
        return;
      }
      var unavailable = input.disabled || input.readOnly || !!input.closest('[aria-busy="true"]');
      button.hidden = !input.value || unavailable;
      if (button.disabled !== unavailable) button.disabled = unavailable;
    });
  }

  function attach(input) {
    if (fields.has(input)) return;
    var wrapper = input.parentElement;
    if (!wrapper.classList.contains('facility-voice-field')) {
      wrapper = document.createElement('span');
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }
    wrapper.classList.add('facility-clear-field');
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'facility-text-clear';
    button.textContent = '×';
    button.title = '입력 내용 지우기';
    button.setAttribute('aria-label', '입력 내용 지우기');
    button.hidden = true;
    wrapper.appendChild(button);
    fields.set(input, button);
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (input.disabled || input.readOnly || input.closest('[aria-busy="true"]')) return;
      document.dispatchEvent(new CustomEvent('facility-clear-input', { detail: { input: input } }));
      // End the editor connection so a late native dictation result cannot refill it.
      input.blur();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
    });
  }

  function scan() {
    document.querySelectorAll(selector).forEach(attach);
    sync();
  }
  document.addEventListener('input', sync, true);
  document.addEventListener('change', sync, true);
  document.addEventListener('reset', function () { setTimeout(sync, 0); }, true);
  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    queueMicrotask(function () { queued = false; scan(); });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'readonly', 'value', 'aria-busy'] });
  // Existing forms also set .value directly when loading saved records.
  setInterval(function () { if (!document.hidden) sync(); }, 600);
  scan();
})();
