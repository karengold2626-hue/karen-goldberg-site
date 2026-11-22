/* תוכן חיצוני (סרטוני YouTube ומפת Google) נטען רק אחרי שהמבקר לוחץ עליו.
   עד הלחיצה מוצגת תמונה מקומית מהאתר, בלי שום פנייה לשרתי Google או YouTube.
   אחרי הלחיצה הסרטון נטען ממצב הפרטיות המוגבר של YouTube (youtube-nocookie.com). */
(function () {
  var script = document.currentScript;
  var base = new URL('./', script ? script.src : location.href);
  var thumbs = new URL('wp-content/uploads/kg-video-thumbs/', base).href;

  var css =
    '.kg-embed{position:relative;display:block;width:100%;height:100%;padding:0;margin:0;border:0;cursor:pointer;' +
    'background:#111 center/cover no-repeat;overflow:hidden;font-family:inherit;color:#fff;text-align:center}' +
    '.kg-embed img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}' +
    '.kg-embed .kg-play{position:absolute;top:50%;left:50%;width:68px;height:48px;margin:-24px 0 0 -34px;' +
    'background:rgba(0,0,0,.72);border-radius:12px;transition:background .2s}' +
    '.kg-embed .kg-play:after{content:"";position:absolute;top:50%;left:50%;margin:-10px 0 0 -6px;' +
    'border-style:solid;border-width:10px 0 10px 17px;border-color:transparent transparent transparent #fff}' +
    '.kg-embed:hover .kg-play,.kg-embed:focus-visible .kg-play{background:#c00}' +
    '.kg-embed:focus-visible{outline:3px solid #f5c542;outline-offset:-3px}' +
    '.kg-embed .kg-note{position:absolute;left:0;right:0;bottom:0;padding:5px 8px;font-size:12px;line-height:1.4;' +
    'background:rgba(0,0,0,.6);direction:rtl}' +
    '.kg-map{background:#eef1f4;color:#002337;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px}' +
    '.kg-map strong{font-size:17px}' +
    '.kg-map .kg-map-btn{background:#002337;color:#fff;border-radius:6px;padding:10px 18px;font-weight:700;font-size:15px}' +
    '.kg-map .kg-map-note{font-size:12px;opacity:.8}' +
    '.kg-map:focus-visible{outline:3px solid #f5c542;outline-offset:-3px}';
  var st = document.createElement('style');
  st.id = 'kg-embeds-style';
  st.textContent = css;
  document.head.appendChild(st);

  function videoId(url) {
    try {
      var u = new URL(url.replace(/&amp;/g, '&'));
      if (/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1);
      return u.searchParams.get('v') || '';
    } catch (e) { return ''; }
  }

  /* סרטוני YouTube (וידג'טים של Elementor שסומנו kg-video.default) */
  document.querySelectorAll('[data-widget_type="kg-video.default"]').forEach(function (w, i) {
    var settings = {};
    try { settings = JSON.parse(w.getAttribute('data-settings') || '{}'); } catch (e) {}
    var id = videoId(settings.youtube_url || '');
    var wrap = w.querySelector('.elementor-wrapper');
    if (!id || !wrap) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kg-embed';
    btn.setAttribute('aria-label', 'הפעלת סרטון ' + (i + 1) + '. הסרטון ייטען מ-YouTube');
    btn.innerHTML = '<img src="' + thumbs + id + '.jpg" alt="" loading="lazy" decoding="async">' +
      '<span class="kg-play" aria-hidden="true"></span>' +
      '<span class="kg-note">לחיצה תטען את הסרטון מ-YouTube</span>';
    btn.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&playsinline=1';
      f.title = 'סרטון YouTube';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0';
      wrap.style.position = 'relative';
      wrap.innerHTML = '';
      wrap.appendChild(f);
      f.focus();
    });
    wrap.innerHTML = '';
    wrap.appendChild(btn);
  });

  /* מפת Google: מסגרת המפה שמורה ב-data-src ונטענת רק בלחיצה */
  document.querySelectorAll('iframe[data-kg-map-src]').forEach(function (fr) {
    var holder = fr.parentNode;
    var h = getComputedStyle(fr).height; /* אותו גובה שהעיצוב קובע למפה */
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kg-embed kg-map';
    if (h) btn.style.height = h;
    btn.setAttribute('aria-label', 'הצגת מפת המשרד. המפה תיטען מ-Google Maps');
    btn.innerHTML = '<strong>' + (fr.getAttribute('title') || 'מיקום המשרד') + '</strong>' +
      '<span class="kg-map-btn">הצגת המפה</span>' +
      '<span class="kg-map-note">לחיצה תטען את המפה מ-Google Maps</span>';
    btn.addEventListener('click', function () {
      fr.src = fr.getAttribute('data-kg-map-src');
      fr.removeAttribute('data-kg-map-src');
      fr.style.display = '';
      btn.parentNode.removeChild(btn);
    });
    fr.style.display = 'none';
    holder.insertBefore(btn, fr);
  });
})();
