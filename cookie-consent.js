/* מנגנון הסכמה לעוגיות.
   Meta Pixel (דרך התוסף PixelYourSite) נטען רק אחרי שהמבקר לוחץ "אישור".
   "רק הכרחיות": הפיקסל לא נטען. אפשר לשנות את הבחירה בכל עת בקישור "הגדרות עוגיות".
   הבחירה נשמרת בעוגייה הכרחית אחת (kg_consent) למשך 12 חודשים. */
(function () {
  var COOKIE = 'kg_consent';
  var MAX_AGE = 365 * 24 * 60 * 60;
  var script = document.currentScript;
  var base = new URL('./', script ? script.src : location.href);
  var privacyUrl = new URL('מדיניות-פרטיות/', base).href;
  var activated = false;

  function getChoice() {
    var m = document.cookie.match(/(?:^|;\s*)kg_consent=([^;]*)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function setChoice(value) {
    document.cookie = COOKIE + '=' + value + '; Max-Age=' + MAX_AGE + '; Path=/; SameSite=Lax' +
      (location.protocol === 'https:' ? '; Secure' : '');
  }

  /* מחיקת עוגיות הפיקסל אם המבקר חזר בו מההסכמה */
  function clearMarketingCookies() {
    var host = location.hostname;
    var domains = ['', host, '.' + host, '.' + host.replace(/^www\./, '')];
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!/^(_fbp|_fbc|pys|last_pys|pysTrafficSource)/.test(name)) return;
      domains.forEach(function (d) {
        document.cookie = name + '=; Max-Age=0; Path=/' + (d ? '; Domain=' + d : '');
      });
    });
  }

  /* הפעלת סקריפטי הפיקסל שסומנו בעמוד כממתינים להסכמה, לפי הסדר */
  function activateMarketing() {
    if (activated) return;
    activated = true;
    var pending = document.querySelectorAll('script[type="text/plain"][data-kg-consent="marketing"]');
    Array.prototype.forEach.call(pending, function (old) {
      var s = document.createElement('script');
      s.src = old.getAttribute('data-src');
      s.async = false;
      if (old.id) s.id = old.id;
      old.parentNode.replaceChild(s, old);
    });
  }

  var css =
    '#kg-cookie-banner{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;direction:rtl;' +
    'background:#002337;color:#fff;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);' +
    'padding:16px 18px;font-size:15px;line-height:1.6;max-width:760px;margin:0 auto;font-family:inherit}' +
    '#kg-cookie-banner p{margin:0 0 12px;color:#fff}' +
    '#kg-cookie-banner a{color:#fff;text-decoration:underline}' +
    '#kg-cookie-banner .kg-cc-actions{display:flex;gap:10px;flex-wrap:wrap}' +
    '#kg-cookie-banner button{flex:1 1 140px;min-height:44px;border-radius:6px;font-size:15px;font-weight:700;' +
    'cursor:pointer;font-family:inherit;padding:8px 14px}' +
    '#kg-cookie-banner .kg-cc-accept{background:#fff;color:#002337;border:2px solid #fff}' +
    '#kg-cookie-banner .kg-cc-necessary{background:transparent;color:#fff;border:2px solid #fff}' +
    '#kg-cookie-banner button:focus-visible{outline:3px solid #f5c542;outline-offset:2px}' +
    /* בנייד ההודעה בראש המסך, כדי שכפתורי הוואטסאפ והנגישות שבתחתית יישארו זמינים */
    '@media (max-width:1100px){#kg-cookie-banner{top:12px;bottom:auto}}' +
    '@media (max-width:767px){#kg-cookie-banner{font-size:14px;padding:14px}}' +
    '.kg-cookie-settings{color:inherit;text-decoration:underline;cursor:pointer;background:none;border:0;padding:0;font:inherit}';

  function addStyle() {
    if (document.getElementById('kg-cookie-style')) return;
    var st = document.createElement('style');
    st.id = 'kg-cookie-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function hideBanner() {
    var b = document.getElementById('kg-cookie-banner');
    if (b) b.parentNode.removeChild(b);
  }

  function showBanner() {
    if (document.getElementById('kg-cookie-banner')) return;
    addStyle();
    var b = document.createElement('div');
    b.id = 'kg-cookie-banner';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'הגדרות עוגיות');
    b.innerHTML =
      '<p>האתר משתמש בעוגיות הכרחיות לפעולתו. בהסכמתך נפעיל גם את Meta Pixel (פייסבוק), שמודד את יעילות הפרסום שלנו. ' +
      'אפשר לשנות את הבחירה בכל עת בקישור "הגדרות עוגיות" בתחתית האתר. ' +
      '<a href="' + privacyUrl + '">למדיניות הפרטיות</a></p>' +
      '<div class="kg-cc-actions">' +
      '<button type="button" class="kg-cc-accept">אישור</button>' +
      '<button type="button" class="kg-cc-necessary">רק הכרחיות</button>' +
      '</div>';
    b.querySelector('.kg-cc-accept').addEventListener('click', function () {
      setChoice('marketing');
      hideBanner();
      activateMarketing();
    });
    b.querySelector('.kg-cc-necessary').addEventListener('click', function () {
      var had = getChoice() === 'marketing' || activated;
      setChoice('necessary');
      clearMarketingCookies();
      hideBanner();
      if (had) location.reload(); /* עצירת פיקסל שכבר נטען בעמוד הזה */
    });
    document.body.appendChild(b);
  }

  /* קישור "הגדרות עוגיות" בשורת זכויות היוצרים בתחתית כל עמוד */
  function addSettingsLink() {
    addStyle();
    var link = document.createElement('button');
    link.type = 'button';
    link.className = 'kg-cookie-settings';
    link.textContent = 'הגדרות עוגיות';
    link.addEventListener('click', showBanner);
    var target = null;
    var nodes = document.querySelectorAll('footer p, footer div, .elementor-location-footer p, .elementor-widget-text-editor p, .elementor-heading-title, p');
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (/כל הזכויות שמורות/.test(nodes[i].textContent) && nodes[i].children.length < 6) { target = nodes[i]; break; }
    }
    if (target) {
      target.appendChild(document.createTextNode(' | '));
      target.appendChild(link);
    } else {
      var wrap = document.createElement('p');
      wrap.style.cssText = 'text-align:center;margin:12px 0;font-size:14px';
      wrap.appendChild(link);
      document.body.appendChild(wrap);
    }
  }

  function init() {
    addSettingsLink();
    var choice = getChoice();
    if (choice === 'marketing') activateMarketing();
    else if (choice !== 'necessary') showBanner();
  }

  window.kgCookieSettings = showBanner;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
