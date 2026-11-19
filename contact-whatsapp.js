/* טפסי יצירת קשר: שולחים את הפרטים לוואטסאפ של המשרד ועוברים לדף התודה */
(function () {
  var PHONE = '972542626426';
  var script = document.currentScript;
  var base = new URL('./', script ? script.src : location.href);
  var thanksUrl = new URL('tnx/', base).href;

  function labelFor(input) {
    var group = input.closest('.elementor-field-group');
    var label = group && group.querySelector('label');
    var text = (label && label.textContent.trim()) || input.getAttribute('placeholder') || '';
    return text.replace(/[*:\s]+$/, '').trim();
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.classList || !form.classList.contains('elementor-form')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (form.reportValidity && !form.reportValidity()) return;

    var lines = ['שלום, הגעתי מהאתר ואשמח ליצור קשר.', ''];
    form.querySelectorAll('input[name^="form_fields"], textarea[name^="form_fields"], select[name^="form_fields"]').forEach(function (el) {
      if (el.type === 'hidden' || el.type === 'submit') return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      var value = (el.value || '').trim();
      if (!value) return;
      var label = labelFor(el);
      lines.push((label ? label + ': ' : '') + value);
    });
    lines.push('', 'עמוד: ' + document.title);

    var waUrl = 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(lines.join('\n'));
    var win = window.open(waUrl, '_blank');
    if (win) {
      form.reset();
      location.href = thanksUrl;
    } else {
      location.href = waUrl;
    }
  }, true);
})();
