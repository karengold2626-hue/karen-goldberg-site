/* העוזר הדיגיטלי של משרד עו"ד קארן גולדברג.
   פועל כולו בדפדפן של המבקר, לפי מאגר תשובות קבוע שאושר למשרד. אין שירות חיצוני, אין בינה מלאכותית,
   ותוכן השיחה לא נשלח לשום מקום ולא נשמר (גם לא בעוגיות או באחסון הדפדפן).
   מעבר לוואטסאפ: נפתחת טיוטה שהמבקר עורך ושולח בעצמו, ובה רק תחום הפנייה – בלי תמליל השיחה. */
(function () {
  'use strict';
  if (window.__kgAssistant) return;
  window.__kgAssistant = true;

  var WA_PHONE = '972542626426';
  var MOBILE_TEXT = '054-2626426';
  var MOBILE_TEL = '0542626426';
  var OFFICE_TEXT = '09-8626688';
  var OFFICE_TEL = '098626688';
  var ADDRESS = 'רחוב פתח תקווה 6, נתניה, מגדל החלוצים, קומה 7, חדר 706B';

  var script = document.currentScript;
  var base = new URL('./', script ? script.src : location.href);

  /* ---------- תחומים ---------- */
  var AREAS = {
    insolvency: 'חדלות פירעון והסדרי חובות',
    enforcement: 'הוצאה לפועל',
    family: 'דיני משפחה',
    inheritance: 'ירושה, צוואות וייפוי כוח מתמשך',
    criminal: 'משפט פלילי'
  };
  var AREA_PAGES = {
    insolvency: 'חדלות-פירעון-והצאה-לפועל/',
    enforcement: 'הוצאה-לפועל/',
    family: 'דיני-משפחה/',
    inheritance: 'ייפוי-כח-מתמשך/',
    criminal: 'משפט-פלילי/'
  };
  var PAGE_AREA = {
    'חדלות-פירעון-והצאה-לפועל': 'insolvency',
    'הוצאה-לפועל': 'enforcement',
    'דיני-משפחה': 'family',
    'lp-גירושין': 'family',
    'ייפוי-כח-מתמשך': 'inheritance',
    'משפט-פלילי': 'criminal'
  };

  function pageSlug() {
    var path = location.pathname;
    try { path = decodeURIComponent(path); } catch (e) {}
    var b = base.pathname;
    try { b = decodeURIComponent(b); } catch (e) {}
    return path.slice(b.length).replace(/index\.html$/, '').replace(/\/+$/, '').split('/')[0] || '';
  }

  var state = {
    area: PAGE_AREA[pageSlug()] || null, /* ברירת מחדל: התחום של העמוד שבו המבקר נמצא */
    pending: null,      /* שאלת המשך שממתינה לתשובה */
    hasFile: null,      /* האם נפתח תיק בהוצאה לפועל */
    started: false,
    misses: 0
  };

  /* ---------- עיבוד טקסט בעברית ---------- */
  var FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[֑-ׇ]/g, '')
      .replace(/[״"׳'`]/g, '')
      .replace(/[ךםןףץ]/g, function (c) { return FINALS[c]; })
      .replace(/[^א-תa-z0-9]+/g, ' ')
      .trim();
  }
  var PREFIX = 'והבלמשכ';
  function variants(tok) {
    var out = [tok];
    var t = tok;
    for (var i = 0; i < 3 && t.length > 3 && PREFIX.indexOf(t[0]) >= 0; i++) {
      t = t.slice(1);
      out.push(t);
    }
    return out;
  }
  function analyze(text) {
    var n = norm(text);
    var toks = n ? n.split(' ') : [];
    var vs = [];
    toks.forEach(function (t) { vs = vs.concat(variants(t)); });
    return { text: ' ' + n + ' ', vars: vs };
  }
  /* מילת מפתח: "חוב*" = מתחיל ב, "חוב" = מילה מדויקת, ביטוי עם רווח = רצף בטקסט */
  function has(a, kw) {
    var k = norm(kw.replace(/\*$/, ''));
    var prefix = /\*$/.test(kw);
    if (k.indexOf(' ') >= 0) return a.text.indexOf(k) >= 0;
    for (var i = 0; i < a.vars.length; i++) {
      var v = a.vars[i];
      if (prefix ? v.indexOf(k) === 0 : v === k) return true;
    }
    return false;
  }
  function score(a, list) {
    var s = 0;
    for (var i = 0; i < list.length; i++) if (has(a, list[i][0])) s += list[i][1];
    return s;
  }
  function any(a, list) {
    for (var i = 0; i < list.length; i++) if (has(a, list[i])) return true;
    return false;
  }

  /* ---------- מאגר התשובות ---------- */
  var R = '<br>';
  var REVIEW_NOTE = 'שאלה כזו תלויה בפרטים של המקרה, ולכן היא מצריכה בדיקה של המסמכים או של ההחלטה עצמה. ' +
    'כשמדובר במועד להגשה, חשוב לבדוק את זה בהקדם, כי לחלק מהמועדים יש מגבלת זמן. ' +
    'אפשר לשוחח עם עו״ד קארן גולדברג, והיא תבדוק את הפרטים.';

  var OUTCOME_NOTE = 'חשוב לדעת: אי אפשר לדעת מראש מה תהיה התוצאה או כמה זמן ייקח ההליך. זה תלוי בנסיבות ובהחלטות של הגורמים המוסמכים, ולכן גם המשרד לא מבטיח תוצאה.';

  /* כל נושא: תחום, מילות מפתח עם משקל, תשובה */
  var TOPICS = [
    /* --- חדלות פירעון --- */
    { id: 'insolvency', area: 'insolvency', kw: [['חדלות',4], ['חדלות פרעונ*',4], ['פשיטת רגל',4], ['פשיטת',3], ['פושט',2], ['שיקומ*',1], ['מחיקת חוב*',4], ['למחוק',2], ['למחוק חוב*',4], ['מחיקה',2]],
      a: 'הליך חדלות פירעון ושיקום כלכלי (שבעבר נקרא פשיטת רגל) מיועד למי שאינו יכול לפרוע את חובותיו. ' +
        'ההליך מוסדר בחוק חדלות פירעון ושיקום כלכלי, ובדרך כלל כולל תקופה שבה החייב משלם תשלום חודשי ומדווח על הכנסותיו והוצאותיו. ' +
        'בסופו אפשר לבקש הפטר, כלומר מחיקה של יתרת החובות, בכפוף לתנאים ולהחלטה של הגורם המוסמך.' + R +
        'השאלה אם ההליך מתאים לך תלויה במצב הכלכלי ובסוג החובות, ונבדקת בשיחה אישית.' },
    { id: 'hefter', area: 'insolvency', kw: [['הפטר',5], ['הפטר לאלתר',6], ['לאלתר',4]],
      a: 'הפטר הוא ההחלטה שבסוף הליך חדלות הפירעון, שלפיה יתרת החובות נמחקת. ' +
        'יש חובות שהחוק לא מאפשר למחוק בהפטר, למשל חוב מזונות וקנס פלילי. ' +
        'במקרים מסוימים אפשר לבקש הפטר בלי לעבור את כל תקופת ההליך (הפטר לאלתר), בתנאים שקבועים בחוק.' + R +
        'אם יינתן הפטר, ומתי, נקבע לפי נסיבות המקרה, ולכן אי אפשר להבטיח תוצאה מראש.' },
    { id: 'payorder', area: 'insolvency', kw: [['צו תשלומים',6], ['תשלום חודשי',3], ['כמה אשלמ*',3], ['צו פתיחת הליכ*',6], ['צו פתיחה',5], ['פתיחת הליכ*',4]],
      a: 'אחרי הגשת הבקשה, הגורם המוסמך מחליט אם לתת צו לפתיחת הליכים. ' +
        'במהלך ההליך נקבע בדרך כלל צו תשלומים, כלומר סכום חודשי שהחייב מעביר לקופת ההליך. ' +
        'גובה התשלום נקבע לפי ההכנסות, ההוצאות והנסיבות של כל אחד, ולכן אי אפשר לדעת אותו מראש בלי בדיקה.' },
    { id: 'stay', area: 'insolvency', kw: [['עיכוב הליכ*',6], ['לעצור את ההליכ*',4], ['להקפיא',3], ['הקפאת',3], ['לעצור עיקול*',3]],
      a: 'עיכוב הליכים פירושו שבמהלך הליך חדלות הפירעון, ככלל, הנושים לא יכולים להמשיך בהליכי גבייה נגד החייב, ותיקי ההוצאה לפועל מעוכבים. ' +
        'יש לזה חריגים, והתמונה המלאה תלויה בצווים שניתנים בתיק הספציפי.' },
    { id: 'trustee', area: 'insolvency', kw: [['נאמנ*',4], ['ממונה',4], ['הממונה',4], ['דוח דו חודשי',5], ['דוחות דו חודשי*',5], ['דוח חודשי',3]],
      a: 'בהליך חדלות פירעון של יחיד, ההליך מתנהל מול הממונה על הליכי חדלות פירעון ו/או בית המשפט, ובדרך כלל מתמנה נאמן שבודק את מצבו הכלכלי של החייב ומדווח עליו. ' +
        'החייב מגיש דוחות על הכנסותיו והוצאותיו, בדרך כלל אחת לחודשיים.' + R +
        'אם קיבלת דרישה מהנאמן או מהממונה, כדאי שעורכת הדין תעבור עליה, כי לחלק מהדרישות יש מועד למענה.' },
    { id: 'arrangement', area: 'insolvency', kw: [['הסדר נושימ*',6], ['הסדר חוב*',5], ['הסדר עם הנושימ*',5], ['פריסת חוב*',4], ['לפרוס',3], ['פשרה',3], ['הסדר תשלומימ*',4]],
      a: 'הסדר חובות או הסדר נושים הוא הסכמה עם הנושים על פריסה של החוב או על הפחתה של חלק ממנו. ' +
        'לפעמים אפשר להגיע להסדר כזה מחוץ לבית המשפט, ולפעמים במסגרת הליך חדלות פירעון. ' +
        'ההסדר תלוי בהסכמת הנושים ובמצב הכלכלי, ולכן לא תמיד אפשר לדעת מראש מה יושג.' },
    { id: 'interest', area: 'enforcement', kw: [['ריבית',4], ['ריביות',4], ['הצמדה',4], ['הפרשי הצמדה',5], ['ריבית פיגורימ*',5], ['להפחית',3], ['הפחתת',3], ['החוב גדל',4], ['תפח',3]],
      a: 'חוב יכול לגדול עם הזמן בגלל ריבית, הפרשי הצמדה והוצאות גבייה. ' +
        'אפשר לבדוק את חישוב החוב ואת הרכיבים שנוספו לו, ולעיתים יש מקום לבקשה מתאימה או למשא ומתן מול הנושה.' + R +
        'אם החישוב נכון ומה אפשר לעשות לגביו נבדק לפי המסמכים של התיק עצמו.' },

    /* --- הוצאה לפועל --- */
    { id: 'enforcement', area: 'enforcement', kw: [['הוצאה לפועל',5], ['הוצאל*',5], ['הוצלפ',5], ['הוצל',4], ['לשכת ההוצאה',4], ['רשות האכיפה',4], ['תיק בהוצאה',5], ['תיקימ*',1], ['נושה',2], ['זוכה',2]],
      a: 'בהוצאה לפועל אוכפים פסקי דין, שטרות וחובות אחרים. מי שנפתח נגדו תיק יכול לפעול בכמה דרכים, לפי המצב: ' +
        'בקשה לאיחוד תיקים, בקשה לקביעת תשלומים לפי היכולת, בקשות לביטול או לצמצום עיקולים והגבלות, משא ומתן להסדר עם הנושה, ' +
        'ולעיתים גם הגשת התנגדות או בדיקה אם הליך חדלות פירעון מתאים יותר.' + R +
        'איזו דרך מתאימה למקרה שלך נבדק לפי התיקים והמסמכים.' },
    { id: 'lien', area: 'enforcement', kw: [['עיקול*',5], ['עקלו',5], ['מעוקל',4], ['עיקלו',5], ['עיקל*',5], ['מעקל*',4], ['עקל',4], ['עוקל*',4], ['חשבון הבנק',2], ['משכורת',2], ['רכב',1]],
      a: 'עיקול יכול להיות על חשבון בנק, על משכורת, על רכב או על נכסים אחרים. ' +
        'החוק מגן על חלק מהשכר ועל חלק מהכספים מפני עיקול, ובמקרים מסוימים אפשר לבקש לבטל עיקול או לצמצם אותו, למשל כשהוא פוגע בפרנסה או כשהוטל בטעות.' + R +
        'כדי לדעת מה אפשר לעשות, צריך לבדוק את ההחלטה על העיקול ואת התיק.' },
    { id: 'limits', area: 'enforcement', kw: [['עיכוב יציאה',6], ['יציאה מהארצ',5], ['לטוס',3], ['טיסה',2], ['רישיונ*',2], ['רשיונ*',2], ['רישיון נהיגה',5], ['מוגבל באמצעימ*',6], ['כרטיס אשראי',3], ['הגבלה',3], ['הגבלות',3]],
      a: 'בהוצאה לפועל אפשר להטיל על חייב הגבלות, למשל עיכוב יציאה מהארץ, הגבלה על רישיון נהיגה והגבלות על כרטיסי אשראי וחשבון הבנק. ' +
        'לפעמים אפשר לבקש לבטל הגבלה או לקבל היתר, למשל לנסיעה מסוימת לחו״ל, ולפעמים ההגבלה מעוכבת כשנפתח הליך חדלות פירעון.' + R +
        'זה תלוי בסוג ההגבלה ובמצב התיק, ולכן כדאי לבדוק את הפרטים.' },
    { id: 'consolidate', area: 'enforcement', kw: [['איחוד תיקימ*',6], ['לאחד',4], ['איחוד',4], ['צו חיוב בתשלומימ*',6], ['חקירת יכולת',5], ['תשלום אחד',3]],
      a: 'איחוד תיקים מאפשר לחייב שיש לו כמה תיקים בהוצאה לפועל לרכז אותם לתיק אחד, עם תשלום חודשי אחד שנקבע לפי היכולת שלו. ' +
        'יש לזה תנאים, ובקשה כזו נבחנת על ידי רשם ההוצאה לפועל. גם בלי איחוד, אפשר לבקש שייקבעו תשלומים לפי היכולת אחרי בירור של המצב הכלכלי.' },
    { id: 'objection', area: 'enforcement', kw: [['התנגדות',4], ['שיק',6], ['שיקימ*',6], ['צק',6], ['שטר',5], ['אזהרה',3], ['קיבלתי אזהרה',5], ['לא חתמתי',3]],
      a: 'כשנפתח תיק על שיק או שטר, החייב מקבל אזהרה, ואפשר להגיש התנגדות אם יש טענות נגד החוב. ' +
        'יש מועד קצר להגשת התנגדות, ולכן חשוב לפנות מהר ולא לחכות.' + R +
        'אם יש לך אזהרה או החלטה, עדיף שעורכת הדין תבדוק אותה בהקדם.' },
    { id: 'alimonydebt', area: 'enforcement', kw: [['חוב מזונות',6], ['חובות מזונות',6], ['מזונות',3], ['ביטוח לאומי',4], ['המוסד לביטוח לאומי',5], ['חוב עבר',4]],
      a: 'חוב מזונות נגבה דרך ההוצאה לפועל, ולעיתים דרך המוסד לביטוח לאומי, שמשלם את המזונות ואחר כך גובה אותם מהחייב. ' +
        'חשוב לדעת שחוב מזונות לא נמחק בהפטר בהליך חדלות פירעון. יש מצבים שבהם אפשר לפעול לגבי חוב העבר או לגבי אופן הגבייה, וזה נבדק לפי התיק.' },

    /* --- משפחה --- */
    { id: 'family', area: 'family', kw: [['גירושינ*',5], ['גרושימ*',3], ['להתגרש',5], ['גט',4], ['פרידה',4], ['להיפרד',4], ['בן הזוג',2], ['בת הזוג',2], ['בעלי',2], ['אשתי',2], ['ידועימ*',4], ['ידועה בציבור',5], ['ישוב סכסוכ*',5], ['יישוב סכסוכ*',5], ['גישור',4], ['מהות',4]],
      a: 'בסכסוך משפחתי, לפני שמגישים תביעה, מגישים בדרך כלל בקשה ליישוב סכסוך, ואחריה יש פגישות מידע, היכרות ותיאום (מהו״ת) שמטרתן לבדוק אפשרות להגיע להסכמות. ' +
        'בהליך עצמו עולים בדרך כלל נושאי הילדים (הסדרי שהות ואחריות הורית), המזונות וחלוקת הרכוש.' + R +
        'איזו דרך מתאימה, הסכם או הליך משפטי, תלוי בנסיבות ובמידת ההסכמה בין בני הזוג.' },
    { id: 'alimony', area: 'family', kw: [['מזונות',4], ['מזונות ילדימ*',6], ['מזונות אישה',6], ['מזונות אשה',6]],
      a: 'מזונות ילדים נקבעים לפי צורכי הילדים, ההכנסות של ההורים, חלוקת זמני השהות ונסיבות נוספות. ' +
        'מזונות אישה נבחנים לפי דין אחר וכללים אחרים. אפשר להגיע להסכמה ולאשר אותה, או לפנות לערכאה המוסמכת.' + R +
        'כשיש פסק דין או הסכם מאושר למזונות והם לא משולמים, אפשר לפעול לגבייתם, למשל דרך ההוצאה לפועל או המוסד לביטוח לאומי.' + R +
        'סכום המזונות במקרה מסוים לא נקבע לפי טבלה אחת, ולכן אי אפשר להעריך אותו בלי לבדוק את הפרטים.' },
    { id: 'custody', area: 'family', kw: [['משמורת',5], ['הסדרי שהות',6], ['הסדרי ראייה',6], ['זמני שהות',6], ['אחריות הורית',5], ['הילדימ*',2], ['ילדימ*',1]],
      a: 'בהחלטות על הילדים, כמו זמני שהות ואחריות הורית, השיקול המרכזי הוא טובת הילד. ' +
        'אפשר להגיע להסכמות בין ההורים ולאשר אותן, ואם אין הסכמה, הנושא מוכרע בהליך משפטי.' },
    { id: 'prenup', area: 'family', kw: [['הסכם ממונ*',6], ['הסכם חיימ* משותפימ*',6], ['חלוקת רכוש',5], ['איזון משאבימ*',6], ['רכוש',2], ['הדירה',1]],
      a: 'הסכם ממון מסדיר מראש איך יחולק הרכוש בין בני הזוג, וכדי שיהיה לו תוקף צריך לאשר אותו לפי החוק. ' +
        'כשאין הסכם, חלוקת הרכוש נעשית לפי הדין החל על בני הזוג, למשל איזון משאבים.' + R +
        'מה חל במקרה שלך תלוי, בין היתר, במועד הנישואין ובנכסים, ולכן זה נבדק אישית.' },
    { id: 'violence', area: 'family', kw: [['אלימות',5], ['צו הגנה',6], ['מאיימ*',4], ['איומימ*',4], ['מפחדת',3], ['מפחד',3], ['מכה',4], ['הרביצ*',5], ['הטרדה',3]],
      urgent: true,
      a: 'אם יש סכנה מיידית, התקשרו מיד למשטרה במספר 100.' + R +
        'במצבים של אלימות או איומים במשפחה אפשר לבקש צו הגנה, ולעיתים אפשר לקבל אותו במהירות. ' +
        'אפשר להתקשר למשרד ישירות: ' + MOBILE_TEXT + '.' },

    /* --- ירושה וייפוי כוח --- */
    { id: 'will', area: 'inheritance', kw: [['צוואה',5], ['צוואות',5], ['לכתוב צוואה',6], ['קיום צוואה',6], ['התנגדות לצוואה',7], ['לערער על צוואה',6]],
      a: 'צוואה מאפשרת לקבוע מה ייעשה ברכוש אחרי הפטירה. כדי שתהיה תקפה, היא צריכה לעמוד בדרישות הצורה שבחוק. ' +
        'אחרי הפטירה מגישים בקשה לצו קיום צוואה, ומי שיש לו טענות נגד הצוואה יכול להגיש התנגדות.' + R +
        'אם יש מסמך או מועד מסוים, כדאי לבדוק אותו בהקדם.' },
    { id: 'inheritance', area: 'inheritance', kw: [['ירושה',5], ['ירושות',5], ['צו ירושה',7], ['ללא צוואה',7], ['בלי צוואה',7], ['לא השאיר צוואה',8], ['לא השאירה צוואה',8], ['אינ צוואה',7], ['יורשימ*',5], ['נפטר',3], ['נפטרה',3], ['עזבונ*',5], ['רשמ* לענייני ירושה',6]],
      a: 'כשאדם נפטר בלי צוואה, הרכוש עובר ליורשים לפי חוק הירושה, וכדי לקבל אותו מגישים בקשה לצו ירושה. ' +
        'כשיש צוואה, מגישים בקשה לצו קיום צוואה. הבקשות מוגשות בדרך כלל לרשם לענייני ירושה.' + R +
        'מי היורשים ובאיזה חלק תלוי בנסיבות המשפחתיות ובמסמכים, ולכן זה נבדק אישית.' },
    { id: 'poa', area: 'inheritance', kw: [['ייפוי כוח מתמשכ*',7], ['יפוי כוח מתמשכ*',7], ['ייפוי כח מתמשכ*',7], ['יפוי כח מתמשכ*',7], ['ייפוי כוח',4], ['יפוי כוח',4], ['ייפוי כח',4], ['יפוי כח',4], ['מתמשכ*',3], ['אפוטרופוס*',4], ['אפוטרופסות',4], ['הורה מבוגר',3], ['דמנציה',3]],
      a: 'ייפוי כוח מתמשך מאפשר לאדם לקבוע מראש מי יחליט בשמו בעניינים אישיים, רפואיים או רכושיים, אם בעתיד לא יוכל להחליט בעצמו. ' +
        'את המסמך עורך רק עורך דין שהוסמך לכך מטעם האפוטרופוס הכללי, והוא מופקד אצל האפוטרופוס הכללי. ' +
        'עו״ד קארן גולדברג הוסמכה לערוך ייפוי כוח מתמשך.' + R +
        'אפשר לשנות או לבטל אותו כל עוד הממנה כשיר.' },

    /* --- פלילי --- */
    { id: 'criminal', area: 'criminal', kw: [['פלילי*',4], ['משטרה',3], ['חקירה',4], ['חקירה במשטרה',5], ['זימונ*',4], ['זומנ*',4], ['חשוד',4], ['חשודה',4], ['כתב אישומ*',6], ['נאשמ*',4], ['תיק פלילי',5], ['תלונה',2], ['רישומ* פלילי',6], ['עבר פלילי',5]],
      a: 'מי שזומן לחקירה או נחשד בעבירה זכאי להיוועץ בעורך דין, וכדאי לעשות זאת לפני החקירה. ' +
        'כל אדם נחשב חף מפשע כל עוד לא הוכחה אשמתו. ' +
        'איך לנהוג בחקירה עצמה תלוי בפרטים, ולכן חשוב לדבר עם עורכת הדין לפני שמוסרים גרסה.' + R +
        'אם הוגש כתב אישום, יש שלבים ומועדים בהליך, וכדאי לפנות בהקדם.' },
    { id: 'arrest', area: 'criminal', kw: [['מעצר',5], ['נעצר',6], ['נעצרתי',6], ['נעצרה',6], ['עצרו',6], ['עצור',5], ['בתחנה',3]],
      urgent: true,
      a: 'אם מישהו נעצר עכשיו, התקשרו מיד למשרד: ' + MOBILE_TEXT + '. ' +
        'לעצור יש זכות להיוועץ בעורך דין. בשלב המעצר יש דיונים שנקבעים בזמנים קצרים, ולכן לא כדאי לחכות.' },
    { id: 'minor', area: 'criminal', kw: [['קטינ*',5], ['הבנ שלי',5], ['הבת שלי',5], ['בנ 1',4], ['בת 1',4], ['בני נוער',5], ['נער',3], ['נערה',3], ['בנ* נחקר',5]],
      a: 'לקטינים שנחקרים במשטרה יש הגנות מיוחדות בחוק, למשל בנוגע להודעה להורים ולנוכחות של בגיר בחקירה. ' +
        'המשרד מייצג גם קטינים ובני נוער. במקרה של זימון לחקירה, כדאי לפנות לפני מועד החקירה.' },
    { id: 'victim', area: 'criminal', kw: [['נפגע עבירה',6], ['נפגעת עבירה',6], ['נפגעי עבירה',6], ['להגיש תלונה',5], ['נגדי עבירה',3], ['הותקפתי',5]],
      a: 'לנפגעי עבירה יש זכויות בחוק, למשל לקבל מידע על התיק ובחלק מהמקרים להביע עמדה בשלבים מסוימים. ' +
        'המשרד מלווה גם נפגעי עבירה, בהגשת תלונה ובמימוש הזכויות מול הרשויות.' + R +
        'אם יש סכנה מיידית, התקשרו למשטרה במספר 100.' }
  ];

  /* זיהוי כוונות כלליות */
  var K = {
    meeting: [['פגישה',5], ['פגישת ייעוצ*',6], ['לקבוע',4], ['לתאמ*',4], ['תור',3], ['להיפגש',5], ['להגיע למשרד',5], ['ייעוצ*',2], ['יעוצ*',2], ['ייעוץ ראשוני',4]],
    phone: [['טלפונ*',5], ['מספר',3], ['להתקשר',5], ['לדבר עם',3], ['ליצור קשר',5], ['קשר',2], ['מייל',4], ['אימייל',4], ['נייד',4]],
    address: [['כתובת',5], ['איפה המשרד',6], ['איפה אתמ*',5], ['איפה אתה',5], ['מיקומ*',4], ['חניה',4], ['להגיע',2], ['נתניה',2]],
    hours: [['שעות',4], ['שעות פעילות',6], ['פתוח',4], ['פתוחימ*',4], ['שישי',3], ['שבת',3], ['ערב',2], ['עכשיו',1]],
    price: [['מחיר',5], ['מחירימ*',5], ['עלות',5], ['עולה',4], ['כמה זה',3], ['שכר טרחה',6], ['שכט',5], ['לשלמ*',2], ['תשלומ*',1], ['חינמ*',4], ['בחינמ*',4], ['בתשלומ*',3], ['זול',3], ['יקר',3], ['כסף',1]],
    human: [['נציג*',5], ['בן אדמ*',5], ['עורכת הדינ*',3], ['קארנ*',3], ['אנושי',4], ['לדבר עם מישהו',6]],
    whatsapp: [['וואטסאפ',6], ['ואטסאפ',6], ['וטסאפ',6], ['ווטסאפ',6], ['whatsapp',6], ['wa',3]],
    thanks: [['תודה',5], ['תודה רבה',6], ['תנקס',5], ['מעולה',2], ['סבבה',2]],
    greet: [['שלומ*',3], ['היי',4], ['הי',4], ['הלו',4], ['בוקר טוב',4], ['ערב טוב',4], ['אהלנ*',4]],
    debtStart: [['יש לי חוב*',5], ['חובות',3], ['חוב',3], ['נכנסתי לחוב*',5], ['מאיפה להתחיל',5], ['לא יודע מה לעשות',3], ['לא יודעת מה לעשות',3], ['תקוע',2], ['מינוס',3], ['הלוואות',3], ['הלוואה',3], ['לא מצליח לשלמ*',5], ['לא מצליחה לשלמ*',5], ['הבנק',2]],
    yes: ['כנ', 'כן', 'נכון', 'בטח', 'כמובן', 'נפתח', 'יש', 'אכן', 'נפתחו', 'יש תיק', 'יש לי תיק'],
    no: ['לא', 'עדיין לא', 'אין', 'אין תיק', 'לא נפתח', 'ממש לא'],
    notsure: ['לא בטוח', 'לא בטוחה', 'לא יודע', 'לא יודעת', 'אולי', 'איך בודקימ*', 'איך אדע']
  };

  /* שאלות שמצריכות בדיקה אישית */
  var NEEDS_REVIEW = ['קיבלתי החלטה', 'קיבלתי מכתב', 'קיבלתי הודעה', 'החלטה', 'פסק דינ*', 'פסק הדינ*', 'מועד', 'עד מתי', 'תוך כמה ימימ*', 'כמה זמנ* יש לי', 'דדליינ*', 'להגיש ערעור',
    'ערעור', 'לערער*', 'דיונ*', 'הדיונ*', 'במקרה שלי', 'המקרה שלי', 'בתיק שלי', 'מה אני צריכ*', 'מה כדאי לי', 'כדאי לי', 'האמ* אני זכאי*', 'אני זכאי*', 'אני זכאית', 'האמ* יש לי סיכוי', 'סיכוי',
    'סיכויימ*', 'מה הסיכויימ*', 'מה לעשות', 'מה עליי לעשות', 'צרפתי', 'מסמכ*', 'המסמכימ*', 'חתמתי', 'לחתומ*', 'הסכמ* שקיבלתי'];
  var OUTCOME = ['כמה זמנ* לוקח', 'כמה זמנ* זה', 'תוך כמה זמנ*', 'יימחק', 'ימחקו', 'ימחק לי', 'מבטיח*', 'בטוח שזה', 'מה הסיכוי', 'יצליח', 'אצליח', 'אנצח', 'נזכה', 'אזכה'];
  var FILE_SAID = ['תיק בהוצאה', 'תיק בהוצל', 'תיק הוצאה לפועל', 'תיקימ* בהוצאה', 'נפתח לי תיק', 'נפתח נגדי', 'נפתחו נגדי', 'פתחו לי תיק', 'פתחו נגדי', 'עיקול*', 'עיקל*', 'עיקלו', 'עקלו', 'מעוקל', 'הוצאה לפועל', 'הוצלפ', 'הוצל', 'הגבלות', 'עיכוב יציאה'];
  var NO_FILE_SAID = ['אין תיק', 'אין לי תיק', 'לא נפתח', 'עוד לא נפתח', 'עדיין לא נפתח', 'בלי תיק', 'אינ* תיק'];
  var AREA_WORDS = {
    insolvency: ['חדלות', 'חובות', 'חוב', 'פשיטת', 'הפטר'],
    enforcement: ['הוצאה לפועל', 'הוצל', 'עיקול', 'הגבלות'],
    family: ['משפחה', 'גירושינ', 'מזונות', 'משמורת'],
    inheritance: ['ירושה', 'צוואה', 'ייפוי', 'יפוי'],
    criminal: ['פלילי', 'משטרה', 'חקירה']
  };

  /* ---------- סגנונות ---------- */
  var css = [
    '#kg-bot,#kg-bot *{box-sizing:border-box;font-family:Rubik,Assistant,Arial,sans-serif}',
    /* איפוס סגנונות הכפתורים של תבנית האתר, כדי שלא ישנו את מראה העוזר */
    '#kg-bot button{margin:0!important;padding:0;font:inherit;letter-spacing:normal!important;text-transform:none!important;box-shadow:none;min-height:0;white-space:normal}',
    '#kg-bot .kgb-icon{padding:0!important;border:0!important;background:transparent!important;color:#e8dcc0!important;border-radius:50%!important;width:44px!important;height:44px!important}',
    '#kg-bot .kgb-icon:hover{background:rgba(255,255,255,.08)!important}',
    '#kg-bot .kgb-send{padding:0!important;border:0!important;background:#D4AF37!important;color:#141414!important;border-radius:12px!important}',
    '#kg-bot .kgb-chip{padding:8px 14px!important;border:1px solid #D4AF37!important;border-radius:20px!important;background:transparent!important;color:#f3e7c4!important}',
    '#kg-bot .kgb-chip:hover{background:rgba(212,175,55,.14)!important}',
    '#kg-bot .kgb-chip.kgb-solid{background:#D4AF37!important;color:#141414!important}',
    '#kg-bot #kg-bot-launch{padding:0 18px 0 14px!important;border:1.5px solid #D4AF37!important;border-radius:28px!important;background:#0d0e10!important;color:#f3e7c4!important}',
    '#kg-bot #kg-bot-launch:hover{background:#17181c!important}',
    '@media (max-width:600px){#kg-bot #kg-bot-launch{padding:0 14px 0 12px!important}}',
    '#kg-bot-launch{position:fixed;left:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:8px;height:56px;padding:0 18px 0 14px;border-radius:28px;',
    'background:#0d0e10;color:#f3e7c4;border:1.5px solid #D4AF37;box-shadow:0 6px 22px rgba(0,0,0,.45);cursor:pointer;font-size:16px;font-weight:500;direction:rtl;line-height:1}',
    '#kg-bot-launch:hover{background:#17181c}',
    '#kg-bot-launch:focus-visible,#kg-bot button:focus-visible,#kg-bot a:focus-visible,#kg-bot textarea:focus-visible{outline:3px solid #f3d77a;outline-offset:2px}',
    '#kg-bot-launch svg{flex:none}',
    '#kg-bot-launch[hidden]{display:none}',
    '#kg-bot-panel{position:fixed;left:20px;bottom:86px;z-index:2147483001;width:380px;height:min(600px,calc(100vh - 120px));display:flex;flex-direction:column;',
    'background:#111215;color:#f4f1ea;border:1px solid rgba(212,175,55,.55);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.55);overflow:hidden;direction:rtl;text-align:right}',
    '#kg-bot-panel[hidden]{display:none}',
    '.kgb-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(180deg,#1b1c21,#121317);border-bottom:1px solid rgba(212,175,55,.35)}',
    '.kgb-mark{flex:none;width:38px;height:38px;border-radius:50%;border:1px solid #D4AF37;display:flex;align-items:center;justify-content:center;font-family:"Frank Ruhl Libre",Rubik,serif!important;color:#D4AF37;font-size:19px;font-weight:700}',
    '.kgb-title{flex:1;min-width:0}',
    '.kgb-title b{display:block;font-family:"Frank Ruhl Libre",Rubik,serif!important;font-size:17px;color:#f3e7c4;font-weight:700;line-height:1.2}',
    '.kgb-title span{display:block;font-size:12.5px;color:#bbaf9a;line-height:1.3}',
    '.kgb-icon{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:transparent;color:#e8dcc0;display:flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none}',
    '.kgb-icon:hover{background:rgba(255,255,255,.08)}',
    '.kgb-log{flex:1;overflow-y:auto;padding:14px 12px 6px;scroll-behavior:smooth;overscroll-behavior:contain}',
    '.kgb-msg{max-width:84%;margin:0 0 10px;padding:10px 13px;border-radius:14px;font-size:15px;line-height:1.6;white-space:normal;overflow-wrap:anywhere}',
    '.kgb-bot{background:#1d1e23;border:1px solid rgba(212,175,55,.22);border-top-right-radius:4px;margin-left:auto}',
    '.kgb-user{background:#D4AF37;color:#141414;border-top-left-radius:4px;margin-right:auto}',
    '.kgb-msg a{color:#f3d77a}',
    '.kgb-note{font-size:12px;color:#a59c8a;margin:-4px 2px 10px;line-height:1.5}',
    '.kgb-chips{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 12px}',
    '.kgb-chip{min-height:40px;padding:8px 14px;border-radius:20px;border:1px solid #D4AF37;background:transparent;color:#f3e7c4;font-size:14.5px;cursor:pointer;line-height:1.3;text-decoration:none;display:inline-flex;align-items:center}',
    '.kgb-chip:hover{background:rgba(212,175,55,.14)}',
    '.kgb-chip.kgb-solid{background:#D4AF37;color:#141414;font-weight:600}',
    '.kgb-typing{display:inline-flex;gap:4px;padding:12px 14px}',
    '.kgb-typing i{width:7px;height:7px;border-radius:50%;background:#D4AF37;opacity:.4;animation:kgbDot 1s infinite}',
    '.kgb-typing i:nth-child(2){animation-delay:.15s}.kgb-typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes kgbDot{50%{opacity:1}}',
    '.kgb-foot{border-top:1px solid rgba(212,175,55,.3);padding:10px 12px 12px;background:#141518}',
    '.kgb-form{display:flex;gap:8px;align-items:flex-end}',
    '.kgb-form textarea{flex:1;resize:none;min-height:46px;max-height:120px;padding:11px 13px;border-radius:12px;border:1px solid #4a4334;background:#0b0c0e;color:#f4f1ea;font-size:16px;line-height:1.45;direction:rtl}',
    '.kgb-form textarea::placeholder{color:#8d8574}',
    '.kgb-send{flex:none;width:46px;height:46px;border-radius:12px;border:0;background:#D4AF37;color:#141414;display:flex;align-items:center;justify-content:center;cursor:pointer}',
    '.kgb-send:disabled{opacity:.45;cursor:default}',
    '.kgb-wa{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:9px;min-height:44px;border-radius:12px;background:#1f8b4c;color:#fff!important;text-decoration:none!important;font-size:15px;font-weight:600}',
    '.kgb-wa:hover{background:#23a057}',
    '.kgb-legal{font-size:11.5px;color:#8d8574;text-align:center;margin-top:7px;line-height:1.4}',
    '@media (max-width:600px){',
    '#kg-bot-launch{left:12px;bottom:14px;height:52px;padding:0 14px 0 12px;font-size:15px}',
    /* בנייד החלון נגמר מעל שורת הכפתורים הצפים (וואטסאפ, נגישות, העוזר), כך שהם נשארים גלויים */
    '#kg-bot-panel{left:8px;right:8px;width:auto;bottom:78px;height:min(560px,calc(100vh - 160px));height:min(560px,calc(100dvh - 160px));border-radius:14px}',
    '#kg-bot-panel.kgb-kb{bottom:auto;height:auto}',
    '.kgb-msg{font-size:15.5px}',
    '}',
    '@media (prefers-reduced-motion:reduce){.kgb-log{scroll-behavior:auto}.kgb-typing i{animation:none;opacity:1}}'
  ].join('');

  /* ---------- בניית הממשק ---------- */
  var ICON_CHAT = '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#D4AF37" stroke-width="1.8" stroke-linejoin="round" d="M4 5.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16.5H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path stroke="#D4AF37" stroke-width="1.8" stroke-linecap="round" d="M7.5 10h9M7.5 13h6"/></svg>';
  var ICON_CLOSE = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_PHONE = '<svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>';
  var ICON_SEND = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" transform="matrix(-1 0 0 1 24 0)"/></svg>';
  var ICON_WA = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z"/></svg>';

  var root, launch, panel, log, input, sendBtn, waBtn, lastFocus;

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function waText(topic) {
    return 'שלום עו״ד קארן גולדברג, הגעתי דרך האתר ואשמח לשוחח בנושא ' + (topic || '___');
  }
  function waUrl(topic) {
    return 'https://wa.me/' + WA_PHONE + '?text=' + encodeURIComponent(waText(topic));
  }
  function currentTopic() { return state.area ? AREAS[state.area] : ''; }
  function refreshWa() { if (waBtn) waBtn.href = waUrl(currentTopic()); }

  function build() {
    var style = el('style', { id: 'kg-bot-style' }, css);
    document.head.appendChild(style);

    root = el('div', { id: 'kg-bot' });
    launch = el('button', { id: 'kg-bot-launch', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'kg-bot-panel' },
      ICON_CHAT + '<span>שאלה? כתבו לנו</span>');
    panel = el('div', { id: 'kg-bot-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'kgb-t', hidden: '' });
    panel.innerHTML =
      '<div class="kgb-head">' +
        '<div class="kgb-mark" aria-hidden="true">ק</div>' +
        '<div class="kgb-title"><b id="kgb-t">העוזר הדיגיטלי</b><span>משרד עו״ד קארן גולדברג</span></div>' +
        '<a class="kgb-icon" href="tel:' + MOBILE_TEL + '" aria-label="חיוג למשרד ' + MOBILE_TEXT + '" title="חיוג ' + MOBILE_TEXT + '">' + ICON_PHONE + '</a>' +
        '<button class="kgb-icon kgb-close" type="button" aria-label="סגירת חלון השיחה">' + ICON_CLOSE + '</button>' +
      '</div>' +
      '<div class="kgb-log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<div class="kgb-foot">' +
        '<form class="kgb-form" novalidate>' +
          '<label for="kgb-in" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">כתבו כאן את השאלה שלכם</label>' +
          '<textarea id="kgb-in" rows="1" maxlength="600" placeholder="כתבו כאן את השאלה שלכם" autocomplete="off" enterkeyhint="send"></textarea>' +
          '<button class="kgb-send" type="submit" aria-label="שליחת השאלה" disabled>' + ICON_SEND + '</button>' +
        '</form>' +
        '<a class="kgb-wa" target="_blank" rel="noopener">' + ICON_WA + '<span>המשך בוואטסאפ עם המשרד</span></a>' +
        '<div class="kgb-legal">המידע כאן כללי ואינו ייעוץ משפטי. השיחה לא נשמרת.</div>' +
      '</div>';
    root.appendChild(panel);
    root.appendChild(launch);
    document.body.appendChild(root);

    log = panel.querySelector('.kgb-log');
    input = panel.querySelector('textarea');
    sendBtn = panel.querySelector('.kgb-send');
    waBtn = panel.querySelector('.kgb-wa');
    refreshWa();

    launch.addEventListener('click', function () { if (panel.hidden) open(); else close(); });
    panel.querySelector('.kgb-close').addEventListener('click', close);
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    panel.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    input.addEventListener('input', function () {
      sendBtn.disabled = !input.value.trim();
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    });
    waBtn.addEventListener('click', function () { refreshWa(); });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', fitKeyboard);
      window.visualViewport.addEventListener('scroll', fitKeyboard);
    }
  }

  /* בנייד, כשהמקלדת פתוחה: החלון ממלא את החלק הגלוי של המסך כדי ששדה הכתיבה לא יוסתר */
  function fitKeyboard() {
    if (!panel || panel.hidden) return;
    var vv = window.visualViewport;
    var small = window.matchMedia('(max-width:600px)').matches;
    if (small && vv && vv.height < window.innerHeight - 120) {
      panel.classList.add('kgb-kb');
      panel.style.top = (vv.offsetTop + 8) + 'px';
      panel.style.height = (vv.height - 16) + 'px';
    } else {
      panel.classList.remove('kgb-kb');
      panel.style.top = '';
      panel.style.height = '';
    }
  }

  function open() {
    lastFocus = document.activeElement;
    panel.hidden = false;
    launch.setAttribute('aria-expanded', 'true');
    if (!state.started) { state.started = true; welcome(); }
    refreshWa();
    setTimeout(function () {
      /* בנייד לא פותחים מקלדת אוטומטית, כדי שהמבקר יראה קודם את ההודעה והאפשרויות */
      if (!window.matchMedia('(pointer:coarse)').matches) input.focus();
      else panel.querySelector('.kgb-close').focus();
    }, 30);
    fitKeyboard();
  }
  function close() {
    panel.hidden = true;
    panel.classList.remove('kgb-kb');
    panel.style.top = ''; panel.style.height = '';
    launch.setAttribute('aria-expanded', 'false');
    if (input) input.blur();
    (lastFocus && lastFocus.focus ? lastFocus : launch).focus();
  }

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  function addMsg(who, html) {
    var m = el('div', { 'class': 'kgb-msg ' + (who === 'user' ? 'kgb-user' : 'kgb-bot') });
    if (who === 'user') m.textContent = html; else m.innerHTML = html;
    log.appendChild(m);
    scrollDown();
    return m;
  }
  function addNote(text) {
    var n = el('div', { 'class': 'kgb-note' }); n.textContent = text; log.appendChild(n); scrollDown();
  }
  /* כפתורי בחירה מהירה. אחרי בחירה הם מוסרים, כדי שלא יישארו כפתורים ישנים בשיחה */
  function addChips(items) {
    var wrap = el('div', { 'class': 'kgb-chips' });
    items.forEach(function (it) {
      var c;
      if (it.href) {
        c = el('a', { 'class': 'kgb-chip' + (it.solid ? ' kgb-solid' : ''), href: it.href });
        if (/^https?:/.test(it.href) && it.newTab !== false) { c.target = '_blank'; c.rel = 'noopener'; }
        if (it.onClick) c.addEventListener('click', it.onClick);
      } else {
        c = el('button', { 'class': 'kgb-chip' + (it.solid ? ' kgb-solid' : ''), type: 'button' });
        c.addEventListener('click', function () {
          wrap.remove();
          if (it.echo !== false) addMsg('user', it.label);
          it.run();
        });
      }
      c.textContent = it.label;
      wrap.appendChild(c);
    });
    log.appendChild(wrap);
    scrollDown();
    return wrap;
  }
  function clearOldChips() {
    Array.prototype.forEach.call(log.querySelectorAll('.kgb-chips[data-temp]'), function (c) { c.remove(); });
  }
  function reply(html, chips) {
    var t = el('div', { 'class': 'kgb-msg kgb-bot kgb-typing', 'aria-hidden': 'true' }, '<i></i><i></i><i></i>');
    log.appendChild(t); scrollDown();
    var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    setTimeout(function () {
      t.remove();
      addMsg('bot', html);
      if (chips && chips.length) addChips(chips).setAttribute('data-temp', '');
    }, reduce ? 0 : 450);
  }

  /* ---------- כפתורים חוזרים ---------- */
  function waChip(label, topic) {
    return { label: label || 'המשך בוואטסאפ', href: waUrl(topic != null ? topic : currentTopic()), solid: true };
  }
  function callChip() { return { label: 'חיוג ' + MOBILE_TEXT, href: 'tel:' + MOBILE_TEL }; }
  function formChip() {
    var form = document.querySelector('form.elementor-form');
    if (form) {
      return { label: 'השארת פרטים בטופס באתר', echo: false, run: function () {
        close();
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var f = form.querySelector('input:not([type=hidden])');
        if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 500);
      } };
    }
    return { label: 'השארת פרטים בטופס באתר', href: new URL('#contact', base).href, newTab: false };
  }
  function areaChips(after) {
    return Object.keys(AREAS).map(function (k) {
      return { label: AREAS[k], run: function () { state.area = k; refreshWa(); after(k); } };
    }).concat([{ label: 'נושא אחר', run: function () { state.area = null; refreshWa(); reply('אפשר לכתוב במילים שלכם במה מדובר, ואנסה לכוון.'); focusInput(); } }]);
  }
  function focusInput() { setTimeout(function () { input.focus(); }, 500); }

  /* ---------- פתיחה ---------- */
  function welcome() {
    addMsg('bot', 'שלום, הגעתם למשרד עו״ד קארן גולדברג. אני העוזר הדיגיטלי של המשרד. איך אפשר לעזור?');
    var chips = addChips([
      { label: 'יש לי שאלה', run: askQuestion },
      { label: 'אני רוצה לקבוע פגישה', run: meeting },
      { label: 'מעבר לוואטסאפ', href: waUrl(currentTopic()), solid: true, onClick: function () { this.href = waUrl(currentTopic()); } }
    ]);
    chips.setAttribute('data-temp', '');
  }
  function askQuestion() {
    reply('בשמחה. אפשר לכתוב את השאלה במילים שלכם בשדה למטה, או לבחור תחום:', areaChips(areaIntro));
    focusInput();
  }
  function areaIntro(k) {
    var intro = {
      insolvency: 'מה תרצו לדעת על חובות וחדלות פירעון? למשל: איך ההליך עובד, מה זה הפטר, או מה קורה עם תיקים קיימים.',
      enforcement: 'מה תרצו לדעת על הוצאה לפועל? למשל: עיקולים, הגבלות, איחוד תיקים או התנגדות לשיק.',
      family: 'מה תרצו לדעת בדיני משפחה? למשל: גירושין, מזונות, זמני שהות או הסכם ממון.',
      inheritance: 'מה תרצו לדעת? למשל: צוואה, צו ירושה או ייפוי כוח מתמשך.',
      criminal: 'מה תרצו לדעת בתחום הפלילי? למשל: זימון לחקירה, כתב אישום, ייצוג קטינים או נפגעי עבירה.'
    }[k];
    if (k === 'insolvency' || k === 'enforcement') {
      reply(intro);
      if (state.hasFile === null) askFile();
    } else {
      reply(intro);
    }
    focusInput();
  }

  function meeting() {
    var topic = currentTopic();
    reply('אפשר לתאם פגישה ישירות מול המשרד, בוואטסאפ, בטלפון ' + MOBILE_TEXT + ' או ' + OFFICE_TEXT + ', או להשאיר פרטים בטופס באתר ונחזור אליכם.' + R +
      'המשרד נמצא ב' + ADDRESS + '.',
      [waChip('תיאום בוואטסאפ', topic || 'תיאום פגישה'), callChip(), formChip()]);
    if (!state.area) {
      setTimeout(function () {
        reply('אם תרצו, בחרו את תחום הפנייה, והוא יופיע בהודעת הוואטסאפ:', Object.keys(AREAS).map(function (k) {
          return { label: AREAS[k], run: function () {
            state.area = k; refreshWa();
            reply('מעולה. ההודעה תציין את התחום ' + AREAS[k] + '.', [waChip('תיאום בוואטסאפ'), callChip()]);
          } };
        }));
      }, 700);
    }
  }

  function askFile() {
    state.pending = 'file';
    setTimeout(function () {
      reply('האם כבר נפתח נגדך תיק בהוצאה לפועל?', [
        { label: 'כן', run: function () { answerFile('yes'); } },
        { label: 'לא', run: function () { answerFile('no'); } },
        { label: 'לא בטוח/ה', run: function () { answerFile('notsure'); } }
      ]);
    }, 650);
  }
  function answerFile(v) {
    state.pending = null;
    clearOldChips();
    if (v === 'yes') {
      state.hasFile = true;
      if (!state.area) state.area = 'enforcement';
      refreshWa();
      reply('תודה. כשיש תיק בהוצאה לפועל, יש כמה כיוונים אפשריים: בקשה לקביעת תשלומים לפי היכולת, איחוד תיקים כשיש כמה תיקים, בקשות לגבי עיקולים והגבלות, ומשא ומתן עם הנושה. ' +
        'כשהחובות גדולים מהיכולת לשלם, בודקים גם אם הליך חדלות פירעון מתאים.' + R +
        'כדי להתאים את הדרך, עורכת הדין תצטרך לראות את פירוט התיקים. אפשר להמשיך כאן בשאלות, או לפנות למשרד.',
        [waChip(), callChip()]);
    } else if (v === 'no') {
      state.hasFile = false;
      if (!state.area) state.area = 'insolvency';
      refreshWa();
      reply('תודה. כשעוד לא נפתח תיק, לפעמים אפשר לפעול מוקדם יותר: לבדוק את החובות, לנסות להגיע להסדר עם הנושים, ובמקרים המתאימים לבדוק הליך חדלות פירעון.' + R +
        'פנייה בשלב הזה יכולה לעזור לבחור את הדרך לפני שהמצב מסתבך. אפשר להמשיך כאן בשאלות, או לפנות למשרד.',
        [waChip(), callChip()]);
    } else {
      reply('אפשר לבדוק אם יש תיקים על שמך באתר רשות האכיפה והגבייה, באזור האישי. אם קיבלת בעבר אזהרה או הודעה מההוצאה לפועל, זה סימן שנפתח תיק.' + R +
        'אפשר גם לפנות למשרד, ועורכת הדין תעזור לבדוק.', [waChip(), callChip()]);
    }
  }

  /* ---------- מענה לטקסט חופשי ---------- */
  function submit() {
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    clearOldChips();
    addMsg('user', text);
    respond(text);
  }

  function detectArea(a) {
    for (var k in AREA_WORDS) if (any(a, AREA_WORDS[k].map(function (w) { return w + '*'; }))) return k;
    return null;
  }

  function respond(text) {
    var a = analyze(text);
    var short = norm(text).split(' ').length <= 5;

    if (/\d{9}/.test(text.replace(/[\s-]/g, '')) && !/^0\d{8,9}$/.test(text.replace(/[\s-]/g, ''))) {
      addNote('אין צורך לשתף כאן מספר זהות, פרטי צדדים או מסמכים. השיחה כאן לא נשמרת, ואת הפרטים תמסרו ישירות לעורכת הדין.');
    }

    /* תשובה לשאלה שנשאלה ("האם נפתח תיק?") */
    if (state.pending === 'file' && short) {
      if (any(a, K.notsure)) return answerFile('notsure');
      if (any(a, K.no)) return answerFile('no');
      if (any(a, K.yes)) return answerFile('yes');
    }

    var s = {};
    for (var k in K) if (k !== 'yes' && k !== 'no' && k !== 'notsure') s[k] = score(a, K[k]);
    var best = null, bestScore = 0;
    TOPICS.forEach(function (t) {
      var sc = score(a, t.kw);
      if (state.area && t.area === state.area) sc += sc ? 1 : 0;
      if (sc > bestScore) { best = t; bestScore = sc; }
    });
    var review = any(a, NEEDS_REVIEW);
    var outcome = any(a, OUTCOME);
    var fileSaid = any(a, FILE_SAID);
    var noFileSaid = any(a, NO_FILE_SAID);
    if (noFileSaid) state.hasFile = false; else if (fileSaid) state.hasFile = true;
    var area = (best && bestScore >= 3) ? best.area : detectArea(a);
    if (area) { state.area = area; refreshWa(); }

    /* דחוף */
    if (best && best.urgent && bestScore >= 4) {
      return reply(best.a, [callChip(), waChip()]);
    }
    /* וואטסאפ / נציג / טלפון / פגישה: מיד דרך לפנות */
    if (s.whatsapp >= 6) {
      return reply('אפשר להמשיך בוואטסאפ עם המשרד. ייפתח חלון עם הודעה מוכנה, ואפשר לערוך אותה לפני השליחה.', [waChip('פתיחת וואטסאפ')]);
    }
    if (s.price >= 4 && s.price >= bestScore - 1) {
      return reply('אין לי אפשרות למסור כאן מידע על עלויות. כל פנייה נבחנת לפי סוג ההליך ומורכבותו, והפרטים נמסרים ישירות מהמשרד.', [waChip(), callChip()]);
    }
    if (s.meeting >= 4 && s.meeting >= bestScore) return meeting();
    if (s.address >= 5 && s.address >= bestScore) {
      return reply('המשרד נמצא ב' + ADDRESS + '. מומלץ לתאם פגישה מראש.', [waChip('תיאום בוואטסאפ', currentTopic() || 'תיאום פגישה'), callChip()]);
    }
    if ((s.phone >= 5 || s.human >= 5) && s.phone + s.human >= bestScore) {
      return reply('אפשר לפנות ישירות למשרד:' + R + 'נייד: <a href="tel:' + MOBILE_TEL + '">' + MOBILE_TEXT + '</a>' + R +
        'משרד: <a href="tel:' + OFFICE_TEL + '">' + OFFICE_TEXT + '</a>' + R + 'מייל: <a href="mailto:karen@kareng-law.co.il">karen@kareng-law.co.il</a>',
        [callChip(), waChip()]);
    }
    if (s.hours >= 4 && s.hours >= bestScore) {
      return reply('אין לי כאן מידע מעודכן על שעות הפעילות. אפשר לפנות בוואטסאפ או בטלפון, והמשרד יחזור אליכם לתיאום.', [waChip(), callChip()]);
    }

    /* "יש לי חובות ואני לא יודע מאיפה להתחיל" */
    if (s.debtStart >= 3 && !outcome && (!best || bestScore < 5 || best.id === 'insolvency')) {
      if (!state.area) { state.area = 'insolvency'; refreshWa(); }
      if (state.hasFile === null) {
        reply('אני מבין. יש כמה דרכים להתמודד עם חובות, למשל הסדר עם הנושים, טיפול בתיקים בהוצאה לפועל, ובמקרים המתאימים הליך חדלות פירעון. הדרך הנכונה תלויה במצב שלך.');
        return askFile();
      }
      return answerFile(state.hasFile ? 'yes' : 'no');
    }

    if (best && bestScore >= 3) {
      var html = best.a;
      if (outcome) html += R + R + OUTCOME_NOTE;
      if (review) html += R + R + REVIEW_NOTE;
      state.misses = 0;
      reply(html, review ? [waChip(), callChip()] : [waChip('לשיחה עם המשרד בוואטסאפ')]);
      /* שאלת המשך אחת, רק אם עוד לא ידוע ורלוונטי */
      var personal = any(a, ['לי', 'שלי', 'אני', 'נגדי', 'עליי', 'עלי']);
      if (personal && (best.id === 'insolvency' || best.id === 'enforcement' || best.id === 'arrangement') &&
          state.hasFile === null && !fileSaid && !noFileSaid) {
        askFile();
      }
      return;
    }

    if (outcome) {
      return reply(OUTCOME_NOTE + R + R + REVIEW_NOTE, [waChip(), callChip()]);
    }
    if (review) {
      return reply(REVIEW_NOTE, [waChip(), callChip()]);
    }
    if (s.thanks >= 5) return reply('בשמחה. אם תרצו לשוחח עם המשרד, הכפתור לוואטסאפ זמין למטה.');
    if (s.greet >= 3 && short) return reply('שלום. אפשר לכתוב את השאלה במילים שלכם, או לבחור תחום:', areaChips(areaIntro));

    /* לא הובן */
    state.misses++;
    if (state.misses >= 2) {
      return reply('אני לא בטוח שאני יכול לענות על זה כאן. כדאי לשאול את המשרד ישירות, ועורכת הדין תשמח לעזור.', [waChip(), callChip()]);
    }
    reply('לא בטוח שהבנתי. אפשר לנסח אחרת, או לבחור את התחום הקרוב לשאלה:', areaChips(areaIntro));
  }

  function init() { if (!document.getElementById('kg-bot')) build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
