/* טפסי יצירת קשר באתר (דף הבית ודפי התחומים).
   הפרטים נשלחים למערכת הפניות של המשרד (Lead.im), ודף התודה מוצג רק אחרי ש-Lead.im מאשר שהפנייה נקלטה.
   אם השליחה נכשלת: הודעת שגיאה, הפרטים נשארים בטופס, ואפשר לנסות שוב או לפנות בטלפון או בוואטסאפ.
   וואטסאפ הוא אפשרות נוספת בלבד, ופתיחת וואטסאפ אף פעם לא נחשבת כאישור קליטה. */
(function () {
  var ENDPOINT = 'https://api.lead.im/v2/submit?lm_form=90425&lm_key=f5f1c5dfb5';
  var WA_PHONE = '972542626426';
  var OFFICE_TEL = '098626688';
  var OFFICE_TEL_TEXT = '09-8626688';
  var TIMEOUT_MS = 15000;
  var DEDUPE_MS = 10 * 60 * 1000;
  var PHONE_RE = /^0\d{8,9}$/;

  var script = document.currentScript;
  var base = new URL('./', script ? script.src : location.href);
  var thanksUrl = new URL('tnx/', base).href;
  var privacyUrl = new URL('מדיניות-פרטיות/', base).href;

  /* נושא הפנייה לפי העמוד שממנו נשלח הטופס */
  var TOPICS = {
    '': 'פנייה כללית (דף הבית)',
    'דיני-משפחה': 'דיני משפחה',
    'הוצאה-לפועל': 'הוצאה לפועל',
    'חדלות-פירעון-והצאה-לפועל': 'חדלות פירעון והסדרי חובות',
    'ייפוי-כח-מתמשך': 'ייפוי כוח מתמשך',
    'משפט-פלילי': 'משפט פלילי'
  };

  function pageSlug() {
    var path = location.pathname;
    try { path = decodeURIComponent(path); } catch (e) {}
    var rel = path.slice(decodeURIComponent(base.pathname).length);
    return rel.replace(/index\.html$/, '').replace(/\/+$/, '').split('/')[0] || '';
  }

  var slug = pageSlug();
  var topic = TOPICS[slug] || ('פנייה מהאתר (' + (slug || 'דף הבית') + ')');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function labelFor(el) {
    var group = el.closest('.elementor-field-group');
    var label = group && group.querySelector('label');
    var text = (label && label.textContent.trim()) || el.getAttribute('placeholder') || '';
    return text.replace(/\(רשות\)/, '').replace(/[*:\s]+$/, '').trim();
  }

  function store(key, value) {
    try {
      if (value === undefined) return sessionStorage.getItem(key);
      sessionStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  var css = '.kg-form-notice{font-size:13px;line-height:1.6;margin:10px 0 0;opacity:.85;text-align:center}' +
    '.kg-form-notice a{color:inherit;text-decoration:underline}' +
    '.kg-form-status{font-size:15px;font-weight:600;line-height:1.6;margin:8px 0 0;text-align:center;color:#b3261e;background:#fff;border:1px solid #e8b4b0;border-radius:6px;padding:6px 10px}' +
    '.kg-form-status:empty{display:none}' +
    '.kg-form-status a{color:inherit;text-decoration:underline}' +
    '.elementor-form .elementor-select-wrapper select option{color:#222;background:#fff}';
  var style = document.createElement('style');
  style.id = 'kg-form-style';
  style.textContent = css;
  document.head.appendChild(style);

  var NOTICE_HTML = 'מסירת הפרטים נעשית מרצון ואינה חובה לפי דין. הפרטים יישמרו במאגר של משרד עו״ד קארן גולדברג ' +
    '(פתח תקווה 6, מגדל החלוצים, נתניה · <a href="tel:' + OFFICE_TEL + '">' + OFFICE_TEL_TEXT + '</a> · ' +
    '<a href="mailto:karen@kareng-law.co.il">karen@kareng-law.co.il</a>) וישמשו לטיפול בפנייתך ולחזרה אליך בלבד (וכן לזיהוי העמוד וערוץ הפרסום שמהם הגעת), ' +
    'ולשם כך יועברו למערכת ניהול הפניות Lead.im. ללא מסירת הפרטים לא נוכל לחזור אליך. ' +
    'ניתן לעיין במידע ולבקש את תיקונו בהתאם לדין. <a href="' + privacyUrl + '">למדיניות הפרטיות המלאה</a>';

  var forms = Array.prototype.slice.call(document.querySelectorAll('form.elementor-form'));

  forms.forEach(function (form, index) {
    /* מלכודת לבוטים: שדה מוסתר שאנשים לא רואים ולא ממלאים */
    var hp = document.createElement('input');
    hp.type = 'text'; hp.name = 'company_site'; hp.tabIndex = -1; hp.autocomplete = 'off';
    hp.setAttribute('aria-hidden', 'true');
    hp.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;clip-path:inset(50%)';
    form.appendChild(hp);

    var notice = document.createElement('p');
    notice.className = 'kg-form-notice';
    /* בטופס שיש בו שדה על החוב, ההודעה מציינת במפורש שגם פרטי החוב ועיר המגורים נשמרים */
    var hasDebt = Array.prototype.some.call(form.querySelectorAll('label'), function (l) { return /חוב/.test(l.textContent); });
    notice.innerHTML = hasDebt
      ? NOTICE_HTML.replace('הפרטים יישמרו במאגר', 'הפרטים, לרבות עיר המגורים וטווח גובה החוב אם נבחר, יישמרו במאגר')
      : NOTICE_HTML;
    /* צבע הטקסט כמו כותרות השדות בטופס, כדי שיהיה קריא גם על רקע כהה וגם על רקע בהיר */
    var ref = form.querySelector('.elementor-field-label:not(.elementor-screen-only)');
    if (!ref) {
      /* אין כותרות שדות גלויות: לוקחים את צבע הכותרת הקרובה מעל הטופס באותו אזור */
      var area = form.closest('.elementor-top-section, .e-parent') || document.body;
      area.querySelectorAll('.elementor-heading-title').forEach(function (h) {
        if (h.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING) ref = h;
      });
    }
    if (ref) {
      var color = getComputedStyle(ref).color;
      notice.style.color = color;
      var rgb = (color.match(/\d+/g) || []).map(Number);
      if (rgb.length >= 3 && rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 160) {
        notice.style.textShadow = '0 1px 2px rgba(0,0,0,.6)';
      }
    }
    form.insertAdjacentElement('afterend', notice);

    var status = document.createElement('p');
    status.className = 'kg-form-status';
    status.setAttribute('role', 'alert');
    status.setAttribute('aria-live', 'assertive');
    notice.insertAdjacentElement('afterend', status);

    form._kg = { hp: hp, status: status, index: index + 1, sending: false };
  });

  function collect(form) {
    var nameEl = form.querySelector('input[name="form_fields[name]"]') || form.querySelector('input[type="text"]');
    var telEl = form.querySelector('input[type="tel"]');
    var emailEl = form.querySelector('input[type="email"]');
    var extras = [];
    form.querySelectorAll('input[name^="form_fields"], textarea[name^="form_fields"], select[name^="form_fields"]').forEach(function (el) {
      if (el === nameEl || el === telEl || el === emailEl) return;
      if (el.type === 'hidden' || el.type === 'submit') return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      var value = (el.value || '').trim();
      if (!value) return;
      var label = labelFor(el);
      extras.push((label && el.tagName !== 'TEXTAREA' ? label + ': ' : '') + value);
    });
    var phone = ((telEl && telEl.value) || '').replace(/[\s\-().]/g, '').replace(/^\+?972/, '0');
    return {
      nameEl: nameEl, telEl: telEl,
      name: ((nameEl && nameEl.value) || '').trim(),
      phone: phone,
      email: ((emailEl && emailEl.value) || '').trim(),
      extras: extras
    };
  }

  function waLink(d) {
    var lines = ['שלום, ניסיתי לשלוח פנייה מהאתר והשליחה לא הצליחה.', '', 'שם: ' + d.name, 'טלפון: ' + d.phone, 'נושא: ' + topic];
    if (d.extras.length) lines = lines.concat(d.extras);
    return 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  function failMessage(d) {
    return 'הפנייה לא נשלחה בגלל תקלה זמנית, והפרטים שמילאת נשארו בטופס. ' +
      'אפשר ללחוץ שוב על "שליחה", או לפנות אלינו ישירות: ' +
      '<a href="tel:' + OFFICE_TEL + '">' + OFFICE_TEL_TEXT + '</a> · ' +
      '<a href="' + esc(waLink(d)) + '" target="_blank" rel="noopener">וואטסאפ</a>';
  }

  function setBusy(form, busy) {
    var btn = form.querySelector('button[type="submit"], .elementor-button');
    if (!btn) return;
    var text = btn.querySelector('.elementor-button-text') || btn;
    if (busy) {
      if (!btn.dataset.kgLabel) btn.dataset.kgLabel = text.textContent;
      text.textContent = 'שולח...';
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    } else {
      text.textContent = btn.dataset.kgLabel || text.textContent;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  }

  function send(body) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(ENDPOINT, { method: 'POST', body: body, signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { return !!(data && Number(data.result) > 0); })
      .catch(function () { return false; })
      .then(function (ok) { if (timer) clearTimeout(timer); return ok; });
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.classList || !form.classList.contains('elementor-form') || !form._kg) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    var kg = form._kg;
    if (kg.sending) return; /* מניעת שליחה כפולה בלחיצה חוזרת */
    kg.status.textContent = '';
    if (kg.hp.value) return;
    if (form.reportValidity && !form.reportValidity()) return;

    var d = collect(form);
    if (d.name.length < 2) { if (d.nameEl) d.nameEl.focus(); kg.status.textContent = 'נא למלא שם מלא.'; return; }
    if (!PHONE_RE.test(d.phone)) { if (d.telEl) d.telEl.focus(); kg.status.textContent = 'נא למלא מספר טלפון תקין (לדוגמה 050-1234567).'; return; }

    var params = new URLSearchParams(location.search);
    var source = 'מקור: ' + document.title + ' | ' + decodeURIComponent(location.pathname) +
      (forms.length > 1 ? ' | טופס ' + kg.index + ' מתוך ' + forms.length : '');
    var utm = [];
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      if (params.get(k)) utm.push(k + '=' + params.get(k));
    });
    var message = d.extras.concat([source]).concat(utm.length ? ['קמפיין: ' + utm.join(', ')] : []).join('\n');

    var body = new URLSearchParams({
      contact_name: d.name,
      contact_phone: d.phone,
      contact_email: d.email,
      subj: 'אתר – ' + topic,
      contact_message: message
    });
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      if (params.get(k)) body.set(k, params.get(k));
    });

    /* אותה פנייה בדיוק שכבר נקלטה בדקות האחרונות: לא שולחים שוב */
    var key = 'kg-lead:' + [d.phone, topic, d.name, d.extras.join('|')].join('#');
    var last = Number(store(key) || 0);
    if (last && Date.now() - last < DEDUPE_MS) { location.href = thanksUrl; return; }

    kg.sending = true;
    setBusy(form, true);
    send(body).then(function (ok) {
      if (ok) {
        store(key, String(Date.now()));
        form.reset();
        location.href = thanksUrl;
        return;
      }
      kg.sending = false;
      setBusy(form, false);
      kg.status.innerHTML = failMessage(d);
    });
  }, true);
})();
