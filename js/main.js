// Hunting in Darkness 原型脚本
(() => {
  document.documentElement.classList.add("js");
  const ASSET_EXTENSIONS = ["webp", "png", "jpg"];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- 图片槽：assets/<ID>.<ext> 存在则替换占位，否则显示规格 ----------
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

  const buildPlaceholder = (slot) => {
    const { asset, label = "", ratio = "" } = slot.dataset;
    const ph = document.createElement("div");
    ph.className = "slot__ph";
    ph.innerHTML = `<span class="slot__id">${asset}</span><span class="slot__label">${label}</span><span class="slot__hint">${ratio.replace("/", ":")} · assets/${asset}.webp</span>`;
    slot.append(ph);
  };

  document.querySelectorAll(".slot").forEach(async (slot) => {
    const { asset, ratio, src, fallback, fallbackAlt, label = "" } = slot.dataset;
    if (ratio)
      slot.style.setProperty("--r", ratio.replace("/", " / "));
    buildPlaceholder(slot);
    const primary = src ? [src] : ASSET_EXTENSIONS.map((ext) => `assets/${asset}.${ext}`);
    const found = await loadFirst(fallback ? [...primary, fallback] : primary);
    if (!found)
      return;
    found.img.alt = found.src === fallback && fallbackAlt ? fallbackAlt : label;
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
  const sections = [...document.querySelectorAll("main section[data-chapter]")];
  let pageNumber = 0;
  sections.forEach((section) => {
    if (!section.hasAttribute("data-nopage"))
      section.dataset.page = String(++pageNumber).padStart(2, "0");
  });

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting)
        return;
      const { chapter, page } = entry.target.dataset;
      const pageText = page ? `— ${page} —` : "";
      runningChapter.textContent = chapter;
      runningPage.textContent = pageText;
      tabsPage.textContent = pageText;
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
  const updateFilms = () => {
    ticking = false;
    const viewport = window.innerHeight;
    films.forEach((film) => {
      const rect = film.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewport)
        return;
      // 黑屏滑入时文字淡入；黑屏贴顶后遮幅拉开，文字随之淡出
      const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
      const travel = rect.height - viewport;
      const textIn = clamp01((viewport * 0.75 - rect.top) / (viewport * 0.55));
      const open = clamp01((-viewport * 0.05 - rect.top) / (travel * 0.85));
      film.style.setProperty("--p", open.toFixed(3));
      film.style.setProperty("--t", (textIn * clamp01(1 - open * 2)).toFixed(3));
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

  const rulesIndex = [...document.querySelectorAll(".rules__index button")];
  const markRule = (index) => rulesIndex.forEach((button, i) => button.setAttribute("aria-current", String(i === index)));
  const rulesButtons = [...document.querySelectorAll("[data-rules-dir]")];
  rulesButtons.forEach((button) => { button.dataset.dir = button.dataset.rulesDir; });
  const goToRule = setupCarousel(document.getElementById("rulesTrack"), document.getElementById("rulesCount"), rulesButtons, markRule);
  rulesIndex.forEach((button) => button.addEventListener("click", () => goToRule(Number(button.dataset.goto))));
  markRule(0);

  // ---------- 机制 01：行动卡翻面与灵感 ----------
  const FLIP_TIME_LIMIT = 6;
  const MIND_CAPACITY = 4;
  const INSPIRATION = { red: "残暴", blue: "精湛", yellow: "速度" };
  const INSPIRATION_COLORS = Object.keys(INSPIRATION);
  const flipDefs = [
    { id: "attack", name: "攻击", cost: 1, time: 2, front: "选择一把武器进行攻击", back: "恢复：点击并支付 1 灵感", restore: "pay" },
    { id: "move", name: "移动", cost: 1, time: 2, front: "移动到合法的格子", back: "常驻：回合开始时恢复", restore: "round" },
    { id: "turn", name: "转向", cost: 0, time: 1, front: "转向 90°", back: "常驻：翻转任意卡时恢复", restore: "linked" },
    { id: "focus", name: "专注", cost: 0, time: 1, front: "掷两枚三色骰，获得对应灵感", back: "常驻：回合开始时恢复", restore: "round" },
  ];
  const flipCardsEl = document.getElementById("flipCards");
  const flipMindEl = document.getElementById("flipMind");
  const flipTimeEl = document.getElementById("flipTime");
  const flipRoundEl = document.getElementById("flipRound");
  const flipLog = document.getElementById("flipLog");
  const flip = {};

  const resetFlip = () => {
    Object.assign(flip, { round: 1, time: 0, exhausted: false, mind: ["red", "blue"], flipped: new Set() });
    flipLog.textContent = "点一张正面的卡来使用它；点背面的「攻击」支付灵感翻回。";
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
    flipTimeEl.setAttribute("aria-label", `时点 ${flip.time} / ${FLIP_TIME_LIMIT}`);
    flipMindEl.replaceChildren(...Array.from({ length: MIND_CAPACITY }, (_, i) => {
      const slot = document.createElement("span");
      const color = flip.mind[i];
      if (color) {
        slot.dataset.color = color;
        slot.textContent = INSPIRATION[color];
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
    return "「转向」因联动恢复为正面。";
  };

  const useFlipCard = (def) => {
    if (flip.exhausted) {
      flipLog.textContent = "已经耗尽，本回合无法再行动。点「结束回合」。";
      return;
    }
    if (flip.mind.length < def.cost) {
      flipLog.textContent = `灵感不足：「${def.name}」需要 ${def.cost} 灵感，先用「专注」产生灵感。`;
      return;
    }
    const paid = flip.mind.splice(0, def.cost).map((color) => INSPIRATION[color]);
    flip.time += def.time;
    flip.flipped.add(def.id);
    let message = `使用「${def.name}」${paid.length ? `，支付${paid.join("、")}灵感` : ""}，翻到背面。`;
    if (def.id === "focus") {
      const rolled = [0, 1].map(() => INSPIRATION_COLORS[Math.floor(Math.random() * INSPIRATION_COLORS.length)]);
      const kept = rolled.slice(0, MIND_CAPACITY - flip.mind.length);
      flip.mind.push(...kept);
      message += ` 掷出${rolled.map((color) => INSPIRATION[color]).join("、")}。`;
      if (kept.length < rolled.length)
        message += " 思维区已满，多出的灵感被丢弃。";
    }
    message += applyLinkedRestore(def.id);
    if (flip.time > FLIP_TIME_LIMIT) {
      flip.exhausted = true;
      message += ` 耗尽：行动照常发生，但本回合结束；超出的 ${flip.time - FLIP_TIME_LIMIT} 时点下回合偿还。`;
    }
    flipLog.textContent = message;
  };

  const restoreFlipCard = (def) => {
    if (def.restore !== "pay") {
      flipLog.textContent = `「${def.name}」不能手动翻回：${def.back}。`;
      return;
    }
    if (!flip.mind.length) {
      flipLog.textContent = "没有灵感可以支付。先结束回合，让「专注」恢复。";
      return;
    }
    const paid = INSPIRATION[flip.mind.shift()];
    flip.flipped.delete(def.id);
    flipLog.textContent = `支付${paid}灵感，「${def.name}」翻回正面。${applyLinkedRestore(def.id)}`;
  };

  flipDefs.forEach((def) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "acard";
    card.dataset.id = def.id;
    const cost = def.cost ? `任意灵感 ×${def.cost}` : "无费用";
    card.innerHTML = `<span class="acard__inner"><span class="acard__face"><span class="acard__name">${def.name}</span><span class="acard__meta"><span>${cost}</span><span>时点 ${def.time}</span></span><span class="acard__effect">${def.front}</span></span><span class="acard__back"><span class="acard__name">${def.name}</span><span class="acard__meta"><span>背面</span></span><span class="acard__effect">${def.back}</span></span></span>`;
    card.setAttribute("aria-label", `${def.name}：${def.front}`);
    card.addEventListener("click", () => {
      if (flip.flipped.has(def.id))
        restoreFlipCard(def);
      else
        useFlipCard(def);
      renderFlip();
    });
    flipCardsEl.append(card);
  });

  document.getElementById("flipEnd").addEventListener("click", () => {
    const debt = Math.max(flip.time - FLIP_TIME_LIMIT, 0);
    flip.round += 1;
    flip.time = debt;
    flip.exhausted = false;
    const restored = flipDefs.filter((def) => def.restore === "round" && flip.flipped.has(def.id));
    restored.forEach((def) => flip.flipped.delete(def.id));
    const names = restored.map((def) => `「${def.name}」`).join("");
    flipLog.textContent = `第 ${flip.round} 回合开始。${names ? `${names}恢复为正面。` : ""}${debt ? `偿还上回合欠下的 ${debt} 时点。` : ""}`;
    renderFlip();
  });
  document.getElementById("flipReset").addEventListener("click", resetFlip);
  resetFlip();

  // ---------- 机制 03：Boss 卡组 ----------
  const bossActions = [
    { type: "攻击", name: "骨髓喷吐", stats: [2, 3, 1, 4], target: "目标：最近的猎人" },
    { type: "攻击", name: "六足践踏", stats: [1, 2, 2, 5], target: "目标：正前方 3 格内所有单位" },
    { type: "攻击", name: "光环收束", stats: [3, 2, 1, 3], target: "目标：损伤最重的猎人" },
    { type: "非攻击", name: "掌颅凝视", time: 3, text: "获得 Buff「凝视」：下一次攻击精准 +1。" },
    { type: "非攻击", name: "折叠", time: 6, text: "移动 2 格，背对最近的猎人。" },
  ];
  const bossParts = [
    { name: "琥珀胸腔", hp: 2, cond: [["成功", "掉落「琥珀骨髓」"], ["失败", "反击攻击者"]] },
    { name: "掌形头颅", hp: 2, cond: [["暴击", "弃置下一张怪物行动卡"]] },
    { name: "逆关节后腿", hp: 1, cond: [["被摧毁", "Boss 移动距离 −1"]] },
    { name: "肌腱光环", hp: 3, cond: [["永远", "攻击者压抑值 −1"]] },
    { name: "骨甲", hp: 3, cond: [["失败", "攻击者武器获得「缺口」"], ["甲壳", "被「钝器」命中时额外掉落素材"]] },
  ];
  const shuffle = (items) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  const STAT_LABELS = ["伤害", "精准", "次数", "时点上限"];
  const renderBossAction = (card) => {
    if (card.stats)
      return `<span class="boss__tag">${card.type}</span><p class="boss__name">${card.name}</p><dl class="boss__stats">${card.stats.map((value, i) => `<div><dt>${STAT_LABELS[i]}</dt><dd>${value}</dd></div>`).join("")}</dl><p>${card.target}</p><p class="fineprint">本轮每位猎人最多 ${card.stats[3]} 时点</p>`;
    return `<span class="boss__tag boss__tag--calm">${card.type}</span><p class="boss__name">${card.name}</p><p>${card.text}</p><p class="fineprint">本轮每位猎人最多 ${card.time} 时点</p>`;
  };
  const renderBossPart = (card) => `<span class="boss__tag boss__tag--calm">部位</span><p class="boss__name">${card.name}</p><div class="boss__hp" aria-label="血量 ${card.hp}">${"<i></i>".repeat(card.hp)}</div><ul class="boss__cond">${card.cond.map(([when, effect]) => `<li><b>${when}</b>${effect}</li>`).join("")}</ul>`;

  const setupBossDeck = (defs, slotId, countId, buttonId, render) => {
    const slot = document.getElementById(slotId);
    const count = document.getElementById(countId);
    let pile = shuffle(defs);
    count.textContent = pile.length;
    document.getElementById(buttonId).addEventListener("click", () => {
      let note = "";
      if (!pile.length) {
        pile = shuffle(defs);
        note = '<p class="fineprint">牌堆耗尽，重新洗牌</p>';
      }
      slot.innerHTML = render(pile.pop()) + note;
      count.textContent = pile.length;
      slot.classList.remove("is-new");
      void slot.offsetWidth;
      slot.classList.add("is-new");
    });
  };
  setupBossDeck(bossActions, "bossAct", "bossActCount", "bossActBtn", renderBossAction);
  setupBossDeck(bossParts, "bossPart", "bossPartCount", "bossPartBtn", renderBossPart);

  // ---------- 机制 04：装备词条 ----------
  const GEAR_LIMIT = 4;
  const gearItems = [
    { name: "骨锤", keywords: ["钝器", "骨"] },
    { name: "石鳞盾", keywords: ["岩石", "重"] },
    { name: "岩甲胫甲", keywords: ["岩石"] },
    { name: "石化护手", keywords: ["岩石", "易碎"] },
    { name: "羽骨短刃", keywords: ["锋利", "轻盈"] },
    { name: "风暴斗篷", keywords: ["轻盈"] },
  ];
  const gearCombos = [
    { need: { 岩石: 3 }, text: "<b>岩壁</b>　3「岩石」：全身护甲 +1" },
    { need: { 轻盈: 2, 锋利: 1 }, text: "<b>疾袭</b>　2「轻盈」+ 1「锋利」：每回合第一次翻面攻击卡时获得 1 时点" },
    { need: { 钝器: 1 }, text: "<b>碎壳</b>　「钝器」：命中「甲壳」部位时额外掉落素材" },
    { need: { 易碎: 1 }, text: "<b>易碎</b>　某些事件中更容易损坏（负面词条）" },
  ];
  const gearGrid = document.getElementById("gearGrid");
  const gearTally = document.getElementById("gearTally");
  const gearComboList = document.getElementById("gearCombos");
  const gearCount = document.getElementById("gearCount");
  const carried = new Set(["石鳞盾", "岩甲胫甲"]);

  const renderGear = () => {
    const counts = {};
    gearItems.filter((item) => carried.has(item.name)).forEach((item) => item.keywords.forEach((kw) => { counts[kw] = (counts[kw] || 0) + 1; }));
    gearCount.textContent = carried.size;
    [...gearGrid.children].forEach((button) => button.setAttribute("aria-pressed", String(carried.has(button.dataset.name))));
    gearTally.innerHTML = Object.entries(counts).map(([kw, n]) => `<span class="chip">${kw} ×${n}</span>`).join("");
    gearComboList.innerHTML = gearCombos.map((combo) => {
      const active = Object.entries(combo.need).every(([kw, n]) => (counts[kw] || 0) >= n);
      return `<li class="${active ? "is-on" : ""}"><span>${combo.text}</span></li>`;
    }).join("");
  };

  gearItems.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.name = item.name;
    button.innerHTML = `<strong>${item.name}</strong><span class="chips">${item.keywords.map((kw) => `<span class="chip">${kw}</span>`).join("")}</span>`;
    button.addEventListener("click", () => {
      if (carried.has(item.name))
        carried.delete(item.name);
      else if (carried.size < GEAR_LIMIT)
        carried.add(item.name);
      renderGear();
    });
    gearGrid.append(button);
  });
  renderGear();

  // ---------- 机制 05：事件判定（掷骰 / 抽牌） ----------
  const fate = { mode: "dice", brave: 0, will: 3, fateValue: 0, lastTier: null, tally: { bad: 0, mid: 0, good: 0 } };
  const FATE_LABELS = { bad: "惩罚", mid: "平稳", good: "奖励" };
  const DICE_RANGES = { bad: "1–6", mid: "7–9", good: "10+" };
  const fateToken = document.getElementById("fateToken");
  const fateRollBtn = document.getElementById("fateRoll");
  const fateRerollBtn = document.getElementById("fateReroll");
  const fateOutcomes = [...document.querySelectorAll("#fateOutcomes li")];
  const fateOdds = document.getElementById("fateOdds");

  // 胆识每 +1：一份惩罚变成奖励（掷骰与抽牌概率一致）
  const fateWeights = () => ({ bad: 6 - fate.brave, mid: 3, good: 1 + fate.brave });

  const renderFate = () => {
    const weights = fateWeights();
    fateOdds.innerHTML = Object.entries(weights).map(([tier, w]) => `<span data-tier="${tier}" style="flex-basis: ${w * 10}%">${FATE_LABELS[tier]} ${w * 10}%</span>`).join("");
    document.getElementById("fateBrave").textContent = fate.brave;
    document.getElementById("fateWill").textContent = fate.will;
    document.getElementById("fateFate").textContent = fate.fateValue;
    ["bad", "mid", "good"].forEach((tier) => { document.getElementById(`fate${tier[0].toUpperCase()}${tier.slice(1)}`).textContent = fate.tally[tier]; });
    fateOutcomes.forEach((row) => { row.querySelector(".outcomes__range").textContent = fate.mode === "dice" ? DICE_RANGES[row.dataset.tier] : FATE_LABELS[row.dataset.tier]; });
    fateRollBtn.textContent = fate.mode === "dice" ? "掷骰" : "抽牌";
    fateRerollBtn.textContent = `花 1 意志重${fate.mode === "dice" ? "投" : "抽"}`;
    fateRerollBtn.disabled = fate.lastTier === null || fate.will < 1;
    fateToken.classList.toggle("is-card", fate.mode === "cards");
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
      fateToken.textContent = total;
      fateToken.title = fate.brave ? `d10 掷出 ${die}，胆识 +${fate.brave}` : `d10 掷出 ${die}`;
    } else {
      const weights = fateWeights();
      const deck = Object.entries(weights).flatMap(([t, w]) => Array(w).fill(t));
      tier = deck[Math.floor(Math.random() * deck.length)];
      fateToken.textContent = FATE_LABELS[tier];
      fateToken.title = `从 ${deck.length} 张牌中抽出`;
    }
    // 重投替换上一次结果，不重复计数
    if (isReroll && fate.lastTier)
      fate.tally[fate.lastTier] -= 1;
    fate.tally[tier] += 1;
    fate.lastTier = tier;
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
      fateToken.textContent = "?";
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
  const renderFlaw = () => {
    const owned = new Set(traitButtons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.trait));
    choiceButtons.forEach((button) => {
      button.disabled = Boolean(button.dataset.need) && !owned.has(button.dataset.need);
      if (button.disabled)
        button.classList.remove("is-picked");
    });
  };
  traitButtons.forEach((button) => button.addEventListener("click", () => {
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    renderFlaw();
  }));
  choiceButtons.forEach((button) => button.addEventListener("click", () => {
    choiceButtons.forEach((b) => b.classList.toggle("is-picked", b === button));
    flawLog.textContent = button.dataset.out;
  }));
  renderFlaw();

  // ---------- 抽牌演示 ----------
  const deck = document.getElementById("deck");
  const pile = document.getElementById("deckPile");
  const hand = document.getElementById("deckHand");
  const result = document.getElementById("deckResult");
  const limits = { str: [1, 8], tough: [0, 8], hits: [1, 4] };
  const values = { str: 3, tough: 2, hits: 2 };
  const outputs = { str: "strOut", tough: "toughOut", hits: "hitsOut" };

  const renderPile = () => {
    deck.classList.remove("is-shuffled");
    hand.replaceChildren();
    result.innerHTML = "&nbsp;";
    const cards = [...Array(values.str).fill("hit"), ...Array(values.tough).fill("miss")];
    pile.replaceChildren(...cards.map((kind) => {
      const mini = document.createElement("span");
      mini.className = `mini mini--${kind}`;
      mini.textContent = kind === "hit" ? "命中" : "落空";
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
      card.innerHTML = `<div class="card__face">${isHit ? "命中" : "落空"}</div><div class="card__back"></div>`;
      hand.append(card);
    });
    const total = values.str + values.tough;
    const chance = Math.round((values.str / total) * 100);
    result.textContent = `抽 ${drawCount} 张，命中 ${hitCount} 次（单张命中率 ${chance}%）`;
  });

  renderPile();
})();
