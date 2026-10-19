// Hunting in Darkness 原型脚本
(() => {
  document.documentElement.classList.add("js");
  const I18n = window.I18n;
  if (!I18n) {
    console.error("[main] window.I18n is missing; load js/i18n.js before js/main.js");
    return;
  }
  const { t } = I18n;
  const ASSET_EXTENSIONS = ["webp", "png", "jpg"];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- 图片槽：assets/<ID>.<ext> 存在则替换占位，否则显示画面说明 ----------
  const loadFirst = (candidates) => new Promise((resolve) => {
    const tryNext = (index) => {
      if (index >= candidates.length)
        return resolve(null);
      const img = new Image();
      img.onload = () => resolve({ img, src: candidates[index] });
      img.onerror = () => tryNext(index + 1);
      img.src = candidates[index];
    };
    tryNext(0);
  });

  const slotLabel = (slot) => (slot.dataset.labelKey ? t(slot.dataset.labelKey) : "");

  const buildPlaceholder = (slot) => {
    const ph = document.createElement("div");
    ph.className = "slot__ph";
    ph.dataset.i18nDynamic = "";
    ph.innerHTML = `<span class="slot__label">${slotLabel(slot)}</span>`;
    slot.append(ph);
  };

  // 切换语言时刷新占位说明；图片 alt 由 data-i18n-attr 交给 I18n.apply
  const refreshSlotLabels = () => {
    document.querySelectorAll(".slot__label").forEach((label) => { label.textContent = slotLabel(label.closest(".slot")); });
  };

  document.querySelectorAll(".slot").forEach(async (slot) => {
    const { asset, ratio, src, fallback, fallbackAltKey, labelKey } = slot.dataset;
    if (ratio)
      slot.style.setProperty("--r", ratio.replace("/", " / "));
    buildPlaceholder(slot);
    const primary = src ? [src] : ASSET_EXTENSIONS.map((ext) => `assets/${asset}.${ext}`);
    const found = await loadFirst(fallback ? [...primary, fallback] : primary);
    if (!found)
      return;
    const altKey = found.src === fallback && fallbackAltKey ? fallbackAltKey : labelKey;
    found.img.alt = altKey ? t(altKey) : "";
    if (altKey)
      found.img.dataset.i18nAttr = `alt:${altKey}`;
    found.img.decoding = "async";
    slot.querySelector(".slot__ph").remove();
    slot.prepend(found.img);
    slot.classList.add("has-img");
  });

  // 扉页底纹 T-01：存在则平铺
  document.querySelectorAll("[data-pattern]").forEach(async (el) => {
    const found = await loadFirst(ASSET_EXTENSIONS.map((ext) => `assets/${el.dataset.pattern}.${ext}`));
    if (!found)
      return;
    el.style.backgroundImage = `url("${found.src}")`;
    el.classList.add("has-tile");
  });

  // ---------- 页眉：章节名与页码 ----------
  const runningChapter = document.getElementById("runningChapter");
  const runningPage = document.getElementById("runningPage");
  const tabsPage = document.getElementById("tabsPage");
  const sections = [...document.querySelectorAll("main section[data-chapter-key]")];
  let pageNumber = 0;
  let currentSection = null;
  sections.forEach((section) => {
    if (!section.hasAttribute("data-nopage"))
      section.dataset.page = String(++pageNumber).padStart(2, "0");
  });

  const renderRunning = () => {
    if (!currentSection)
      return;
    const { chapterKey, page } = currentSection.dataset;
    const pageText = page ? `— ${page} —` : "";
    runningChapter.textContent = chapterKey ? t(chapterKey) : "";
    runningPage.textContent = pageText;
    tabsPage.textContent = pageText;
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting)
        return;
      currentSection = entry.target;
      renderRunning();
    });
  }, { rootMargin: "-50% 0px -50% 0px" });
  sections.forEach((section) => sectionObserver.observe(section));

  const toggleBodyClass = (target, className, options) => {
    new IntersectionObserver(([entry]) => {
      document.body.classList.toggle(className, entry.isIntersecting);
    }, options).observe(target);
  };
  new IntersectionObserver(([entry]) => {
    document.body.classList.toggle("past-cover", !entry.isIntersecting);
  }, { threshold: 0.15 }).observe(document.querySelector(".cover"));
  toggleBodyClass(document.getElementById("prologue"), "in-prologue", { threshold: 0 });
  const chapters = document.getElementById("chapters");
  toggleBodyClass(chapters, "in-chapters", { rootMargin: "0px 0px -99% 0px" });

  // ---------- 章节页签：#/gameplay 等，一次只显示一章 ----------
  const panels = [...chapters.querySelectorAll(".chapter")];
  const tabs = [...chapters.querySelectorAll(".tabs__tab")];
  const turn = document.getElementById("turn");
  const routes = panels.map((panel) => panel.dataset.route);
  let currentRoute = routes[0];

  const routeFromHash = () => {
    const route = location.hash.replace(/^#\//, "");
    return routes.includes(route) ? route : null;
  };

  const swapPanel = (route) => {
    currentRoute = route;
    panels.forEach((panel) => { panel.hidden = panel.dataset.route !== route; });
    tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.route === route)));
  };

  const scrollToChapters = () => window.scrollTo({ top: chapters.getBoundingClientRect().top + window.scrollY, behavior: "instant" });

  const showRoute = (route, animate) => {
    if (route === currentRoute || !animate || reducedMotion) {
      swapPanel(route);
      scrollToChapters();
      return;
    }
    const target = panels.find((panel) => panel.dataset.route === route);
    turn.style.setProperty("--turn-color", getComputedStyle(target).getPropertyValue("--turn"));
    turn.classList.add("is-on");
    setTimeout(() => {
      swapPanel(route);
      scrollToChapters();
      requestAnimationFrame(() => turn.classList.remove("is-on"));
    }, 420);
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#/"]');
    if (!link)
      return;
    const route = link.getAttribute("href").slice(2);
    if (!routes.includes(route))
      return;
    event.preventDefault();
    if (route !== routeFromHash())
      history.pushState(null, "", `#/${route}`);
    showRoute(route, true);
  });
  window.addEventListener("popstate", () => {
    const route = routeFromHash();
    if (route)
      showRoute(route, true);
  });

  const initialRoute = routeFromHash();
  swapPanel(initialRoute || routes[0]);
  if (initialRoute)
    requestAnimationFrame(scrollToChapters);

  // ---------- 进场 ----------
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting)
        return;
      entry.target.classList.add("is-in");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.2 });
  document.querySelectorAll("[data-reveal]").forEach((el) => revealObserver.observe(el));

  // ---------- 电影段：滚动进度驱动遮幅 ----------
  const films = [...document.querySelectorAll(".film")];
  let ticking = false;
  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const updateFilms = () => {
    ticking = false;
    const viewport = window.innerHeight;
    const rects = films.map((film) => film.getBoundingClientRect());
    films.forEach((film, i) => {
      const rect = rects[i];
      if (rect.bottom < 0 || rect.top > viewport)
        return;
      // 黑屏滑入时文字淡入；黑屏贴顶后遮幅拉开，文字随之淡出，标题同步淡入
      const travel = rect.height - viewport;
      const textIn = clamp01((viewport * 0.75 - rect.top) / (viewport * 0.55));
      const open = clamp01((-viewport * 0.05 - rect.top) / (travel * 0.85));
      // 下一段文字从出现处（视口 75%）移向屏幕中心时，本段标题随之淡出
      const next = rects[i + 1];
      const captionOut = next ? clamp01(next.top / (viewport * 0.75)) : 1;
      film.style.setProperty("--p", open.toFixed(3));
      film.style.setProperty("--t", (textIn * clamp01(1 - open * 2)).toFixed(3));
      film.style.setProperty("--c", (clamp01(open * 2) * captionOut).toFixed(3));
    });
  };
  if (reducedMotion)
    films.forEach((film) => film.style.setProperty("--p", "1"));
  else {
    window.addEventListener("scroll", () => {
      if (ticking)
        return;
      ticking = true;
      requestAnimationFrame(updateFilms);
    }, { passive: true });
    window.addEventListener("resize", updateFilms);
    updateFilms();
  }

  // ---------- 线稿 / 成品对比 ----------
  const compare = document.getElementById("compare");
  document.getElementById("compareRange").addEventListener("input", (event) => {
    compare.style.setProperty("--x", `${event.target.value}%`);
  });

  // ---------- 横向画廊：尾声与核心机制共用 ----------
  const pad2 = (value) => String(value).padStart(2, "0");
  const setupCarousel = (track, countEl, buttons, onIndex) => {
    const total = pad2(track.children.length);
    const goTo = (index) => track.scrollTo({ left: index * track.clientWidth });
    buttons.forEach((button) => {
      button.addEventListener("click", () => track.scrollBy({ left: Number(button.dataset.dir) * track.clientWidth }));
    });
    track.addEventListener("scroll", () => {
      const index = Math.round(track.scrollLeft / track.clientWidth);
      countEl.textContent = `${pad2(index + 1)} / ${total}`;
      if (onIndex)
        onIndex(index);
    }, { passive: true });
    return goTo;
  };

  setupCarousel(document.getElementById("galleryTrack"), document.getElementById("galleryCount"), [...document.querySelectorAll(".gallery .gallery__btn")]);

  // 机制画廊：玩法的核心机制与内核的体验支柱各一组
  document.querySelectorAll(".rules").forEach((section) => {
    const rulesIndex = [...section.querySelectorAll(".rules__index button")];
    const markRule = (index) => rulesIndex.forEach((button, i) => button.setAttribute("aria-current", String(i === index)));
    const rulesButtons = [...section.querySelectorAll("[data-rules-dir]")];
    rulesButtons.forEach((button) => { button.dataset.dir = button.dataset.rulesDir; });
    const goToRule = setupCarousel(section.querySelector(".rules__track"), section.querySelector(".rules__controls .gallery__count"), rulesButtons, markRule);
    rulesIndex.forEach((button) => button.addEventListener("click", () => goToRule(Number(button.dataset.goto))));
    markRule(0);
  });

  // ---------- 机制 01：行动卡翻面与灵感 ----------
  const FLIP_TIME_LIMIT = 6;
  const MIND_CAPACITY = 4;
  const INSPIRATION_COLORS = ["red", "blue", "yellow"];
  const flipDefs = [
    { id: "attack", cost: 1, time: 2, restore: "pay" },
    { id: "move", cost: 1, time: 2, restore: "round" },
    { id: "turn", cost: 0, time: 1, restore: "linked" },
    { id: "focus", cost: 0, time: 1, restore: "round" },
  ];
  const flipCardsEl = document.getElementById("flipCards");
  const flipMindEl = document.getElementById("flipMind");
  const flipTimeEl = document.getElementById("flipTime");
  const flipRoundEl = document.getElementById("flipRound");
  const flipLog = document.getElementById("flipLog");
  const flip = {};

  const inspName = (color) => t(`demo.flip.insp.${color}`);
  const flipText = (def, field) => t(`demo.flip.card.${def.id}.${field}`);
  const joinList = (items) => items.join(t("demo.flip.listSep"));

  const resetFlip = () => {
    Object.assign(flip, { round: 1, time: 0, exhausted: false, mind: ["red", "blue"], flipped: new Set() });
    flipLog.textContent = t("demo.flip.log.intro");
    renderFlip();
  };

  const renderFlip = () => {
    flipRoundEl.textContent = flip.round;
    const pips = Math.max(FLIP_TIME_LIMIT, flip.time);
    flipTimeEl.replaceChildren(...Array.from({ length: pips }, (_, i) => {
      const pip = document.createElement("i");
      if (i < flip.time)
        pip.className = i < FLIP_TIME_LIMIT ? "is-used" : "is-over";
      return pip;
    }));
    flipTimeEl.dataset.caption = t("demo.flip.time");
    flipTimeEl.setAttribute("aria-label", t("demo.flip.timeLabel", { used: flip.time, limit: FLIP_TIME_LIMIT }));
    flipMindEl.replaceChildren(...Array.from({ length: MIND_CAPACITY }, (_, i) => {
      const slot = document.createElement("span");
      const color = flip.mind[i];
      if (color) {
        slot.dataset.color = color;
        slot.textContent = t(`demo.flip.insp.${color}.short`);
      }
      return slot;
    }));
    [...flipCardsEl.children].forEach((card) => card.classList.toggle("is-flipped", flip.flipped.has(card.dataset.id)));
  };

  const glow = (id) => {
    const card = flipCardsEl.querySelector(`[data-id="${id}"]`);
    card.classList.add("is-glow");
    setTimeout(() => card.classList.remove("is-glow"), 700);
  };

  // 「转向」的背面：其他卡发生翻转时恢复
  const applyLinkedRestore = (sourceId) => {
    if (sourceId === "turn" || !flip.flipped.has("turn"))
      return "";
    flip.flipped.delete("turn");
    glow("turn");
    return t("demo.flip.log.linked");
  };

  const useFlipCard = (def) => {
    if (flip.exhausted) {
      flipLog.textContent = t("demo.flip.log.exhausted");
      return;
    }
    const name = flipText(def, "name");
    if (flip.mind.length < def.cost) {
      flipLog.textContent = t("demo.flip.log.noInsp", { name, cost: def.cost });
      return;
    }
    const paid = flip.mind.splice(0, def.cost).map(inspName);
    flip.time += def.time;
    flip.flipped.add(def.id);
    let message = paid.length ? t("demo.flip.log.usePaid", { name, paid: joinList(paid) }) : t("demo.flip.log.use", { name });
    if (def.id === "focus") {
      const rolled = [0, 1].map(() => INSPIRATION_COLORS[Math.floor(Math.random() * INSPIRATION_COLORS.length)]);
      const kept = rolled.slice(0, MIND_CAPACITY - flip.mind.length);
      flip.mind.push(...kept);
      message += t("demo.flip.log.rolled", { colors: joinList(rolled.map(inspName)) });
      if (kept.length < rolled.length)
        message += t("demo.flip.log.mindFull");
    }
    message += applyLinkedRestore(def.id);
    if (flip.time > FLIP_TIME_LIMIT) {
      flip.exhausted = true;
      message += t("demo.flip.log.exhaust", { over: flip.time - FLIP_TIME_LIMIT });
    }
    flipLog.textContent = message;
  };

  const restoreFlipCard = (def) => {
    const name = flipText(def, "name");
    if (def.restore !== "pay") {
      flipLog.textContent = t("demo.flip.log.noManual", { name, back: flipText(def, "back") });
      return;
    }
    if (!flip.mind.length) {
      flipLog.textContent = t("demo.flip.log.noPay");
      return;
    }
    const paid = inspName(flip.mind.shift());
    flip.flipped.delete(def.id);
    flipLog.textContent = t("demo.flip.log.restore", { paid, name }) + applyLinkedRestore(def.id);
  };

  // 卡面文字随语言重绘，按钮与监听只创建一次
  const renderFlipCards = () => {
    [...flipCardsEl.children].forEach((card) => {
      const def = flipDefs.find((item) => item.id === card.dataset.id);
      const name = flipText(def, "name");
      const front = flipText(def, "front");
      const cost = def.cost ? t("demo.flip.cost", { n: def.cost }) : t("demo.flip.free");
      card.innerHTML = `<span class="acard__inner"><span class="acard__face"><span class="acard__name">${name}</span><span class="acard__meta"><span>${cost}</span><span>${t("demo.flip.cardTime", { n: def.time })}</span></span><span class="acard__effect">${front}</span></span><span class="acard__back"><span class="acard__name">${name}</span><span class="acard__meta"><span>${t("demo.flip.backFace")}</span></span><span class="acard__effect">${flipText(def, "back")}</span></span></span>`;
      card.setAttribute("aria-label", t("demo.flip.cardLabel", { name, effect: front }));
    });
  };

  flipDefs.forEach((def) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "acard";
    card.dataset.id = def.id;
    card.addEventListener("click", () => {
      if (flip.flipped.has(def.id))
        restoreFlipCard(def);
      else
        useFlipCard(def);
      renderFlip();
    });
    flipCardsEl.append(card);
  });
  renderFlipCards();

  document.getElementById("flipEnd").addEventListener("click", () => {
    const debt = Math.max(flip.time - FLIP_TIME_LIMIT, 0);
    flip.round += 1;
    flip.time = debt;
    flip.exhausted = false;
    const restored = flipDefs.filter((def) => def.restore === "round" && flip.flipped.has(def.id));
    restored.forEach((def) => flip.flipped.delete(def.id));
    const names = restored.map((def) => t("demo.flip.quoted", { name: flipText(def, "name") })).join(t("demo.flip.nameSep"));
    let message = t("demo.flip.log.round", { round: flip.round });
    if (names)
      message += t("demo.flip.log.restored", { names });
    if (debt)
      message += t("demo.flip.log.debt", { debt });
    flipLog.textContent = message;
    renderFlip();
  });
  document.getElementById("flipReset").addEventListener("click", resetFlip);
  resetFlip();

  // ---------- 机制 03：Boss 卡组 ----------
  const bossActions = [
    { id: "marrowSpit", stats: [2, 3, 1, 4] },
    { id: "trample", stats: [1, 2, 2, 5] },
    { id: "haloCollapse", stats: [3, 2, 1, 3] },
    { id: "palmGaze", time: 3 },
    { id: "fold", time: 6 },
  ];
  const bossParts = [
    { id: "amberChest", hp: 2, cond: ["success", "failure"] },
    { id: "palmSkull", hp: 2, cond: ["critical"] },
    { id: "hindLeg", hp: 1, cond: ["destroyed"] },
    { id: "tendonHalo", hp: 3, cond: ["always"] },
    { id: "boneArmor", hp: 3, cond: ["failure", "carapace"] },
  ];
  const shuffle = (items) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const STAT_KEYS = ["damage", "accuracy", "attacks", "timeLimit"];
  const renderBossAction = (card) => {
    const name = t(`demo.boss.action.${card.id}.name`);
    if (card.stats)
      return `<span class="boss__tag">${t("demo.boss.type.attack")}</span><p class="boss__name">${name}</p><dl class="boss__stats">${card.stats.map((value, i) => `<div><dt>${t(`demo.boss.stat.${STAT_KEYS[i]}`)}</dt><dd>${value}</dd></div>`).join("")}</dl><p>${t(`demo.boss.action.${card.id}.target`)}</p><p class="fineprint">${t("demo.boss.timeCap", { n: card.stats[3] })}</p>`;
    return `<span class="boss__tag boss__tag--calm">${t("demo.boss.type.other")}</span><p class="boss__name">${name}</p><p>${t(`demo.boss.action.${card.id}.text`)}</p><p class="fineprint">${t("demo.boss.timeCap", { n: card.time })}</p>`;
  };
  const renderBossPart = (card) => `<span class="boss__tag boss__tag--calm">${t("demo.boss.part")}</span><p class="boss__name">${t(`demo.boss.part.${card.id}.name`)}</p><div class="boss__hp" aria-label="${t("demo.boss.hp", { n: card.hp })}">${"<i></i>".repeat(card.hp)}</div><ul class="boss__cond">${card.cond.map((when) => `<li><b>${t(`demo.boss.when.${when}`)}</b>${t(`demo.boss.part.${card.id}.${when}`)}</li>`).join("")}</ul>`;

  // 返回重绘函数：切换语言时按当前卡牌 id 重画，牌堆计数不变
  const setupBossDeck = (defs, slotId, countId, buttonId, render) => {
    const slot = document.getElementById(slotId);
    const count = document.getElementById(countId);
    let pile = shuffle(defs);
    let shown = null;
    let reshuffled = false;
    count.textContent = pile.length;
    const renderSlot = () => {
      if (!shown)
        return;
      const note = reshuffled ? `<p class="fineprint">${t("demo.boss.reshuffled")}</p>` : "";
      slot.innerHTML = render(shown) + note;
    };
    document.getElementById(buttonId).addEventListener("click", () => {
      reshuffled = !pile.length;
      if (reshuffled)
        pile = shuffle(defs);
      shown = pile.pop();
      renderSlot();
      count.textContent = pile.length;
      slot.classList.remove("is-new");
      void slot.offsetWidth;
      slot.classList.add("is-new");
    });
    return renderSlot;
  };
  const renderBossActSlot = setupBossDeck(bossActions, "bossAct", "bossActCount", "bossActBtn", renderBossAction);
  const renderBossPartSlot = setupBossDeck(bossParts, "bossPart", "bossPartCount", "bossPartBtn", renderBossPart);

  // ---------- 机制 04：装备词条 ----------
  const GEAR_LIMIT = 4;
  const gearItems = [
    { id: "boneHammer", keywords: ["blunt", "bone"] },
    { id: "stoneScaleShield", keywords: ["stone", "heavy"] },
    { id: "rockGreaves", keywords: ["stone"] },
    { id: "petrifiedGauntlets", keywords: ["stone", "fragile"] },
    { id: "featherboneBlade", keywords: ["sharp", "light"] },
    { id: "stormCloak", keywords: ["light"] },
  ];
  const gearCombos = [
    { id: "rockWall", need: { stone: 3 } },
    { id: "swiftStrike", need: { light: 2, sharp: 1 } },
    { id: "shellBreaker", need: { blunt: 1 } },
    { id: "fragile", need: { fragile: 1 } },
  ];
  const gearGrid = document.getElementById("gearGrid");
  const gearTally = document.getElementById("gearTally");
  const gearComboList = document.getElementById("gearCombos");
  const gearCount = document.getElementById("gearCount");
  const carried = new Set(["stoneScaleShield", "rockGreaves"]);
  const keywordLabel = (keyword) => t(`demo.gear.kw.${keyword}`);

  const renderGear = () => {
    const counts = {};
    gearItems.filter((item) => carried.has(item.id)).forEach((item) => item.keywords.forEach((kw) => { counts[kw] = (counts[kw] || 0) + 1; }));
    gearCount.textContent = carried.size;
    [...gearGrid.children].forEach((button) => button.setAttribute("aria-pressed", String(carried.has(button.dataset.id))));
    gearTally.innerHTML = Object.entries(counts).map(([kw, n]) => `<span class="chip">${t("demo.gear.tally", { kw: keywordLabel(kw), n })}</span>`).join("");
    gearComboList.innerHTML = gearCombos.map((combo) => {
      const active = Object.entries(combo.need).every(([kw, n]) => (counts[kw] || 0) >= n);
      return `<li class="${active ? "is-on" : ""}"><span>${t(`demo.gear.combo.${combo.id}`)}</span></li>`;
    }).join("");
  };

  const renderGearItems = () => {
    [...gearGrid.children].forEach((button) => {
      const item = gearItems.find((gear) => gear.id === button.dataset.id);
      button.dataset.carried = t("demo.gear.carried");
      button.innerHTML = `<strong>${t(`demo.gear.item.${item.id}.name`)}</strong><span class="chips">${item.keywords.map((kw) => `<span class="chip">${keywordLabel(kw)}</span>`).join("")}</span>`;
    });
  };

  gearItems.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.id = item.id;
    button.addEventListener("click", () => {
      if (carried.has(item.id))
        carried.delete(item.id);
      else if (carried.size < GEAR_LIMIT)
        carried.add(item.id);
      renderGear();
    });
    gearGrid.append(button);
  });
  renderGearItems();
  renderGear();

  // ---------- 机制 05：事件判定（掷骰 / 抽牌） ----------
  const fate = { mode: "dice", brave: 0, will: 3, fateValue: 0, lastTier: null, lastRoll: null, tally: { bad: 0, mid: 0, good: 0 } };
  const DICE_RANGES = { bad: "1–6", mid: "7–9", good: "10+" };
  const fateToken = document.getElementById("fateToken");
  const fateRollBtn = document.getElementById("fateRoll");
  const fateRerollBtn = document.getElementById("fateReroll");
  const fateOutcomes = [...document.querySelectorAll("#fateOutcomes li")];
  const fateOdds = document.getElementById("fateOdds");
  const tierLabel = (tier) => t(`demo.fate.tier.${tier}`);

  // 胆识每 +1：一份惩罚变成奖励（掷骰与抽牌概率一致）
  const fateWeights = () => ({ bad: 6 - fate.brave, mid: 3, good: 1 + fate.brave });

  const renderFate = () => {
    const weights = fateWeights();
    const isDice = fate.mode === "dice";
    fateOdds.innerHTML = Object.entries(weights).map(([tier, w]) => `<span data-tier="${tier}" style="flex-basis: ${w * 10}%">${t("demo.fate.odds", { label: tierLabel(tier), pct: w * 10 })}</span>`).join("");
    document.getElementById("fateBrave").textContent = fate.brave;
    document.getElementById("fateWill").textContent = fate.will;
    document.getElementById("fateFate").textContent = fate.fateValue;
    ["bad", "mid", "good"].forEach((tier) => { document.getElementById(`fate${tier[0].toUpperCase()}${tier.slice(1)}`).textContent = fate.tally[tier]; });
    fateOutcomes.forEach((row) => { row.querySelector(".outcomes__range").textContent = isDice ? DICE_RANGES[row.dataset.tier] : tierLabel(row.dataset.tier); });
    fateRollBtn.textContent = isDice ? t("demo.fate.roll") : t("demo.fate.draw");
    fateRerollBtn.textContent = isDice ? t("demo.fate.reroll") : t("demo.fate.redraw");
    fateRerollBtn.disabled = fate.lastTier === null || fate.will < 1;
    fateToken.classList.toggle("is-card", fate.mode === "cards");
  };

  // 结果牌面：掷骰显示总点数，抽牌显示档位名
  const renderFateToken = () => {
    const roll = fate.lastRoll;
    if (!roll)
      return;
    if (roll.die) {
      fateToken.textContent = roll.die + roll.brave;
      fateToken.title = roll.brave ? t("demo.fate.token.dice", { die: roll.die, brave: roll.brave }) : t("demo.fate.token.diceNoBrave", { die: roll.die });
      return;
    }
    fateToken.textContent = tierLabel(fate.lastTier);
    fateToken.title = t("demo.fate.token.cards", { n: roll.deckSize });
  };

  const resolveFate = (isReroll) => {
    let tier;
    if (fate.mode === "dice") {
      const die = 1 + Math.floor(Math.random() * 10);
      const total = die + fate.brave;
      tier = "bad";
      if (total >= 7)
        tier = "mid";
      if (total >= 10)
        tier = "good";
      fate.lastRoll = { die, brave: fate.brave };
    } else {
      const weights = fateWeights();
      const deck = Object.entries(weights).flatMap(([key, w]) => Array(w).fill(key));
      tier = deck[Math.floor(Math.random() * deck.length)];
      fate.lastRoll = { deckSize: deck.length };
    }
    // 重投替换上一次结果，不重复计数
    if (isReroll && fate.lastTier)
      fate.tally[fate.lastTier] -= 1;
    fate.tally[tier] += 1;
    fate.lastTier = tier;
    renderFateToken();
    fateToken.dataset.tier = tier;
    fateOutcomes.forEach((row) => row.classList.toggle("is-hit", row.dataset.tier === tier));
    fateToken.classList.remove("is-rolling");
    void fateToken.offsetWidth;
    fateToken.classList.add("is-rolling");
    renderFate();
  };

  fateRollBtn.addEventListener("click", () => resolveFate(false));
  fateRerollBtn.addEventListener("click", () => {
    if (fate.will < 1)
      return;
    fate.will -= 1;
    fate.fateValue += 1;
    resolveFate(true);
  });
  document.querySelectorAll("#fateDemo [data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      fate.mode = button.dataset.mode;
      fate.lastTier = null;
      fate.lastRoll = null;
      fateToken.textContent = "?";
      fateToken.removeAttribute("title");
      delete fateToken.dataset.tier;
      fateOutcomes.forEach((row) => row.classList.remove("is-hit"));
      document.querySelectorAll("#fateDemo [data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      renderFate();
    });
  });
  document.querySelectorAll("#fateDemo [data-brave]").forEach((button) => {
    button.addEventListener("click", () => {
      fate.brave = Math.min(Math.max(fate.brave + Number(button.dataset.brave), 0), 3);
      renderFate();
    });
  });
  renderFate();

  // ---------- 机制 06：负面特性解锁选项 ----------
  const traitButtons = [...document.querySelectorAll("#flawDemo .trait")];
  const choiceButtons = [...document.querySelectorAll("#flawChoices button")];
  const flawLog = document.getElementById("flawLog");
  let pickedChoice = null;
  const renderFlaw = () => {
    const owned = new Set(traitButtons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.trait));
    choiceButtons.forEach((button) => {
      button.disabled = Boolean(button.dataset.need) && !owned.has(button.dataset.need);
      if (button.disabled)
        button.classList.remove("is-picked");
    });
  };
  // CSS 用 data-need-label 显示「需要特性」角标
  const renderFlawLabels = () => {
    choiceButtons.filter((button) => button.dataset.need).forEach((button) => {
      button.dataset.needLabel = t("demo.flaw.needs", { trait: t(`demo.flaw.trait.${button.dataset.need}.name`) });
    });
  };
  const renderFlawLog = () => {
    flawLog.textContent = pickedChoice ? t(pickedChoice.dataset.outKey) : t("demo.flaw.log.intro");
  };
  traitButtons.forEach((button) => button.addEventListener("click", () => {
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    renderFlaw();
  }));
  choiceButtons.forEach((button) => button.addEventListener("click", () => {
    choiceButtons.forEach((b) => b.classList.toggle("is-picked", b === button));
    pickedChoice = button;
    renderFlawLog();
  }));
  renderFlawLabels();
  renderFlawLog();
  renderFlaw();

  // ---------- 抽牌演示 ----------
  const deck = document.getElementById("deck");
  const pile = document.getElementById("deckPile");
  const hand = document.getElementById("deckHand");
  const result = document.getElementById("deckResult");
  const limits = { str: [1, 8], tough: [0, 8], hits: [1, 4] };
  const values = { str: 3, tough: 2, hits: 2 };
  const outputs = { str: "strOut", tough: "toughOut", hits: "hitsOut" };
  const deckCardLabel = (kind) => (kind === "hit" ? t("demo.deck.hit") : t("demo.deck.miss"));

  const renderPile = () => {
    deck.classList.remove("is-shuffled");
    hand.replaceChildren();
    result.innerHTML = "&nbsp;";
    const cards = [...Array(values.str).fill("hit"), ...Array(values.tough).fill("miss")];
    pile.replaceChildren(...cards.map((kind) => {
      const mini = document.createElement("span");
      mini.className = `mini mini--${kind}`;
      mini.textContent = deckCardLabel(kind);
      return mini;
    }));
  };

  deck.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.step;
      const [min, max] = limits[key];
      values[key] = Math.min(Math.max(values[key] + Number(button.dataset.d), min), max);
      document.getElementById(outputs[key]).textContent = values[key];
      renderPile();
    });
  });

  document.getElementById("drawBtn").addEventListener("click", () => {
    renderPile();
    deck.classList.add("is-shuffled");
    const minis = [...pile.children];
    const order = minis.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const drawCount = Math.min(values.hits, minis.length);
    let hitCount = 0;
    order.slice(0, drawCount).forEach((pileIndex, drawIndex) => {
      const isHit = minis[pileIndex].classList.contains("mini--hit");
      hitCount += isHit ? 1 : 0;
      minis[pileIndex].classList.add("is-taken");
      const card = document.createElement("div");
      card.className = `card card--${isHit ? "hit" : "miss"}`;
      card.style.setProperty("--delay", `${drawIndex * 0.25}s`);
      card.innerHTML = `<div class="card__face">${deckCardLabel(isHit ? "hit" : "miss")}</div><div class="card__back"></div>`;
      hand.append(card);
    });
    const total = values.str + values.tough;
    const chance = Math.round((values.str / total) * 100);
    result.textContent = t("demo.deck.result", { drawn: drawCount, hits: hitCount, chance });
  });

  renderPile();

  // ---------- 语言切换：保留各演示状态，只重绘文字 ----------
  document.getElementById("langToggle").addEventListener("click", () => I18n.setLang(I18n.lang === "zh" ? "en" : "zh"));

  I18n.onChange(() => {
    refreshSlotLabels();
    renderRunning();
    renderFlipCards();
    flipLog.textContent = t("demo.flip.log.intro");
    renderFlip();
    renderBossActSlot();
    renderBossPartSlot();
    renderGearItems();
    renderGear();
    renderFateToken();
    renderFate();
    renderFlawLabels();
    renderFlawLog();
    renderPile();
  });
})();
