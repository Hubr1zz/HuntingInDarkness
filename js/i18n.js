// 双语文案：按键查表、切换语言、把文案写入 [data-i18n] / [data-i18n-attr]
(() => {
  const LANGS = ["zh", "en"];
  const STORAGE_KEY = "hid-lang";
  const HTML_LANG = { zh: "zh-CN", en: "en" };
  const AUDITED_ATTRS = ["aria-label", "alt", "title"];
  const strings = window.I18N_STRINGS || {};
  const listeners = [];
  const warnedKeys = new Set();
  const isDev = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  let current = "zh";

  const readStored = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  };

  const store = (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // 隐私模式等情况下无法持久化，忽略
    }
  };

  // 初始语言：URL ?lang= > 本地记录 > 浏览器语言
  const detectLang = () => {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(fromUrl))
      return fromUrl;
    const stored = readStored();
    if (LANGS.includes(stored))
      return stored;
    return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
  };

  const hasKey = (lang, key) => Object.prototype.hasOwnProperty.call(strings[lang] || {}, key);

  // 缺键：每个键只警告一次，依次回退到中文、键名本身
  const lookup = (key) => {
    if (hasKey(current, key))
      return strings[current][key];
    if (!warnedKeys.has(key)) {
      warnedKeys.add(key);
      console.warn(`[i18n] missing key "${key}" in "${current}"`);
    }
    return hasKey("zh", key) ? strings.zh[key] : key;
  };

  const t = (key, vars) => {
    const text = lookup(key);
    if (!vars)
      return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
  };

  // 开发环境：列出没有被字典覆盖的文本与可读属性
  const audit = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue.trim();
      const parent = node.parentElement;
      if (!text || !parent || parent.closest("script, style, [data-i18n], [data-i18n-dynamic]"))
        continue;
      console.warn("[i18n] untranslated text:", text, parent);
    }
    document.body.querySelectorAll(AUDITED_ATTRS.map((attr) => `[${attr}]`).join(", ")).forEach((el) => {
      if (el.closest("[data-i18n-dynamic]"))
        return;
      const covered = (el.dataset.i18nAttr || "").split(";").map((pair) => pair.split(":")[0].trim());
      AUDITED_ATTRS.forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value && value.trim() && !covered.includes(attr))
          console.warn(`[i18n] untranslated ${attr}:`, value, el);
      });
    });
  };

  const apply = (root = document) => {
    root.querySelectorAll("[data-i18n]").forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((part) => part.trim());
        if (attr && key)
          el.setAttribute(attr, t(key));
      });
    });
    // 延后一帧，等 main.js 渲染完动态内容再检查
    if (isDev)
      requestAnimationFrame(audit);
  };

  const syncDocument = () => {
    document.documentElement.lang = HTML_LANG[current];
    document.title = t("meta.title");
    const description = document.querySelector('meta[name="description"]');
    if (description)
      description.setAttribute("content", t("meta.description"));
  };

  const setLang = (lang) => {
    if (!LANGS.includes(lang)) {
      console.warn(`[i18n] unsupported language "${lang}"`);
      return;
    }
    current = lang;
    syncDocument();
    apply();
    store(lang);
    listeners.forEach((fn) => fn(lang));
  };

  window.I18n = {
    LANGS,
    get lang() { return current; },
    t,
    setLang,
    onChange: (fn) => { listeners.push(fn); },
    apply,
  };

  // 脚本加载时同步初始化，main.js 运行前文案已就位
  current = detectLang();
  syncDocument();
  apply();
})();
