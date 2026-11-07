// Detailed cash course, with source-page diagrams and offline study tools.
(function () {
  const root = document.querySelector("#cash-textbook");
  if (!root) return;
  const state = { book: null, chapter: "eq-ev", query: "", answers: {}, read: new Set() };
  try { state.read = new Set(JSON.parse(localStorage.getItem("cash-textbook-read") || "[]")); } catch (_) { /* Reading works without storage. */ }
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null) return;
      if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    });
    [].concat(children).filter((child) => child !== null).forEach((child) => node.append(child instanceof Node ? child : String(child)));
    return node;
  }
  const ref = (pages) => el("button", { type: "button", class: "tb-ref cash-ref", title: "打开对应原页，查看牌面和图表", onclick: () => sourceModal(pages) }, `原页 ${pages[0] === pages[1] ? pages[0] : `${pages[0]}–${pages[1]}`} ↗`);
  const block = (title, children) => el("section", { class: "tb-block" }, [el("h3", { text: title }), ...[].concat(children)]);
  const imageURL = (page) => new URL(`static/cash-source/page-${String(page).padStart(3, "0")}.jpg`, document.baseURI).href;
  function sourceReader(range, start = range[0]) {
    let page = start;
    const image = el("img", { class: "cash-source-image", alt: "", loading: "lazy" });
    const caption = el("p", { class: "tb-note", "aria-live": "polite" });
    const input = el("input", { type: "number", min: range[0], max: range[1], value: page, "aria-label": "原页页码" });
    const bigger = el("a", { target: "_blank", rel: "noopener noreferrer", text: "单独打开大图 ↗" });
    const previous = el("button", { type: "button", onclick: () => draw(page - 1) }, "← 原页");
    const next = el("button", { type: "button", onclick: () => draw(page + 1) }, "原页 →");
    function draw(value) {
      if (!Number.isInteger(Number(value)) || Number(value) < range[0] || Number(value) > range[1]) { input.value = page; return; }
      page = Number(value); input.value = page;
      image.src = imageURL(page); image.alt = `胡萝卜学校笔记上，PDF第${page}页`;
      bigger.href = image.src;
      caption.textContent = `PDF 第 ${page} 页${page > 3 ? ` · 印刷页 ${page - 3}` : ""} · 可浏览 ${range[0]}–${range[1]} 页；精确花色与图表以原页为准。`;
      previous.disabled = page === range[0]; next.disabled = page === range[1];
    }
    input.addEventListener("change", () => draw(input.value));
    draw(page);
    return el("div", { class: "cash-source-reader" }, [el("div", { class: "cash-source-controls" }, [previous, el("label", {}, ["PDF页码 ", input]), next, bigger]), caption, image]);
  }
  function sourceModal(pages) {
    const course = state.book.chapters.find((c) => c.sourcePages && c.sourcePages[0] <= pages[0] && c.sourcePages[1] >= pages[1]);
    const dialog = el("dialog", { class: "cash-source-dialog", "aria-label": "教材原页对照" });
    dialog.append(el("button", { type: "button", class: "cash-source-close", onclick: () => dialog.close() }, "关闭原页 ✕"), sourceReader(course ? course.sourcePages : pages, pages[0]));
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog); dialog.showModal();
  }
  function teachingTable(table) {
    return block(table.title, [el("div", { class: "table-wrap" }, el("table", { class: "cash-teaching-table" }, [
      el("thead", {}, el("tr", {}, table.columns.map((title) => el("th", { scope: "col", text: title })))),
      el("tbody", {}, table.rows.map((row) => el("tr", {}, row.map((text) => el("td", { text }))))),
    ])), el("p", { class: "tb-note", text: table.note }), ref(table.pages)]);
  }
  function caseStudy(item) {
    return block(`牌例精读 · ${item.title}`, [
      el("p", { class: "cash-case-scene", text: item.situation }), el("p", { class: "tb-answer", text: `先想一想：${item.question}` }),
      el("details", { class: "cash-case-analysis" }, [el("summary", { text: "展开推理与改法" }), el("ol", {}, item.analysis.map((text) => el("li", { text }))), el("p", { class: "tb-note", text: `迁移到实战：${item.transfer}` })]), ref(item.pages),
    ]);
  }
  function open(id) {
    state.chapter = id; state.query = ""; render();
    root.querySelector(".tb-content").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function tools() {
    const output = el("div", { class: "cash-math-output", "aria-live": "polite" });
    const field = (label, value, max) => {
      const input = el("input", { type: "number", value, min: "0", step: "any", "aria-label": label, ...(max ? { max } : {}) });
      return [el("label", {}, [label, input]), input];
    };
    const [pLabel, p] = field("下注前底池", 100);
    const [bLabel, b] = field("下注金额", 50);
    const [fLabel, f] = field("估计对手弃牌率 %", 40, 100);
    const [sLabel, s] = field("过牌后赢池概率 %", 25, 100);
    const [eLabel, e] = field("剩余有效筹码", 300);
    const run = () => {
      try {
        if ([p,b,f,s,e].some((input) => input.value.trim() === "")) throw new Error("请填完整再计算");
        const m = CashMath.calculate(p.value, b.value, f.value, s.value, e.value);
        const pct = (v) => `${(v * 100).toFixed(1)}%`;
        output.replaceChildren(...[
          ["跟注所需权益", pct(m.callEquity), "跟注额 ÷（原底池 + 双方下注）；只适用于跟注后行动结束。"],
          ["纯诈唬零收益弃牌率", pct(m.bluffFolds), "下注额 ÷（原底池 + 下注额）；假设被跟必输。"],
          ["MDF 参考坐标", pct(m.mdf), "不是每个节点的强制防守频率。"],
          ["纯诈唬 EV", m.bluffEV.toFixed(2), "弃牌率 × 原底池 − 被跟率 × 下注额。"],
          ["过牌 EV", m.checkEV.toFixed(2), "只用于有利位置河牌过牌直接摊牌，未计平分。"],
          ["SPR", m.spr.toFixed(2), "剩余有效筹码 ÷ 当前底池；与对手范围共同判断投入需求。"],
        ].map(([title, value, note]) => el("article", {}, [el("small", { text: title }), el("strong", { text: value }), el("p", { text: note })])));
        output.append(el("p", { class: "tb-note", text: `在被跟必输模型下，下注 EV 与过牌 EV 仍须比较。当前差值 ${(m.bluffEV - m.checkEV).toFixed(2)}；不是自动行动建议，估计输入是否合理更重要。` }));
      } catch (error) { output.replaceChildren(el("p", { class: "tb-warn", text: error.message })); }
    };
    [p,b,f,s,e].forEach((input) => input.addEventListener("input", run));
    queueMicrotask(run);
    return block("改变价格，看决策门槛", [
      el("p", { class: "tb-note", text: "同一单位输入。无抽水、无加注、无后续下注；纯诈唬被跟时权益为零。过牌模型仅适用于 IP 河牌直接摊牌。" }),
      el("div", { class: "cash-inputs" }, [pLabel, bLabel, fLabel, sLabel, eLabel]),
      el("div", { class: "tb-samples" }, [33.333333, 50, 75, 100, 150].map((size) => el("button", { type: "button", class: "tb-chip", onclick: () => { b.value = Number(p.value) * size / 100; run(); } }, `${Math.round(size)}% 底池`))),
      output, el("p", { class: "tb-source" }, ["公式对应教材：", ref([12,14]), " ", ref([196,198]), " ", ref([280,283]), " ", ref([309,310])]),
    ]);
  }
  function quiz(drills) {
    const tally = el("p", { class: "tb-answer", "aria-live": "polite" });
    const update = () => {
      const done = drills.filter((d) => state.answers[d.id] !== undefined);
      tally.textContent = `已答 ${done.length}/${drills.length} · 答对 ${done.filter((d) => state.answers[d.id] === d.answer).length} 题`;
    };
    const cards = drills.map((d) => {
      const feedback = el("p", { class: "tb-note", "aria-live": "polite" });
      const choices = el("div", { class: "tb-samples" });
      const draw = () => {
        choices.replaceChildren(...d.options.map((text, index) => el("button", { type: "button", class: "tb-chip", "aria-pressed": String(state.answers[d.id] === index), onclick: () => { state.answers[d.id] = index; draw(); update(); } }, text)));
        feedback.textContent = state.answers[d.id] === undefined ? "选择后查看解析。" : `${state.answers[d.id] === d.answer ? "答对了。" : `再看一下：较佳答案是“${d.options[d.answer]}”。`} ${d.explanation}`;
      };
      draw();
      return el("section", { class: "tb-block cash-quiz" }, [el("h3", { text: `${d.id} · ${d.question}` }), choices, feedback, ref(d.pages)]);
    });
    update();
    return [tally, ...cards, el("button", { type: "button", class: "quiet-button", onclick: () => { state.answers = {}; render(); } }, "重新练习")];
  }
  function ruleCard(rule) {
    return el("details", { class: "cash-rule" }, [
      el("summary", { text: `${rule.id} · ${rule.title}` }),
      el("p", {}, [el("strong", { text: "候选问题：" }), rule.signal]),
      el("p", {}, [el("strong", { text: "所需证据：" }), rule.evidence]),
      el("p", { class: "tb-note", text: `${rule.scope}。${rule.verdict}。` }), ref(rule.pages),
      el("button", { type: "button", class: "quiet-button", onclick: () => open(rule.chapter) }, "回到本课"),
    ]);
  }
  function renderBody(body) {
    const book = state.book;
    if (state.query) {
      const q = state.query.toLowerCase();
      const hits = book.chapters.filter((c) => JSON.stringify(c).toLowerCase().includes(q));
      body.replaceChildren(el("h2", { text: `查找“${state.query}” · ${hits.length} 章` }), ...hits.map((c) => block(c.title, [
        el("p", { text: c.intro }), ...c.sections.flatMap((s) => s.points.filter((p) => p.text.toLowerCase().includes(q)).map((p) => el("p", {}, [p.text, " ", ref(p.pages)]))),
        el("button", { type: "button", class: "quiet-button", onclick: () => open(c.id) }, "阅读本章"),
      ])));
      if (!hits.length) body.append(el("p", { text: "没有匹配章节，可试试“阻挡”“紧缩”或“跟注”。" }));
      return;
    }
    const index = book.chapters.findIndex((c) => c.id === state.chapter);
    const c = book.chapters[index];
    body.replaceChildren(el("p", { class: "eyebrow", text: c.grade ? `YEAR ${c.grade} / CASH STUDY` : "STUDY DESK" }), el("h2", { text: c.title }), el("p", { class: "tb-intro", text: c.intro }));
    if (c.grade) {
      body.append(el("p", { class: "cash-course-length", text: `本课 ${c.sections.length} 章 · ${c.readingChars.toLocaleString("zh-CN")} 字正文 · 配套牌例与原页图表` }));
      body.append(block("本课内容", el("nav", { class: "cash-course-toc", "aria-label": "本课章节" }, c.sections.map((section, i) => el("button", { type: "button", class: "quiet-button", onclick: () => body.querySelector(`#cash-unit-${i}`).scrollIntoView({ behavior: "smooth", block: "start" }) }, section.title)))));
    }
    c.sections.forEach((section, i) => {
      const content = c.grade ? section.points.map((p) => p.kind === "heading"
        ? el("h4", { text: p.text }) : el("p", {}, [p.text, " ", ref(p.pages)]))
        : [el("ul", { class: "tb-points" }, section.points.map((p) => el("li", {}, [p.text, " ", ref(p.pages)])))];
      const node = block(section.title, content); node.id = `cash-unit-${i}`;
      if (c.grade) node.classList.add("cash-prose");
      body.append(node);
    });
    if (c.grade) {
      (c.tables || []).forEach((table) => body.append(teachingTable(table)));
      (c.caseStudies || []).forEach((item) => body.append(caseStudy(item)));
      const original = el("details", { class: "cash-original-pages" }, [el("summary", { text: `本课原页与全部图表 · PDF ${c.sourcePages[0]}–${c.sourcePages[1]} 页` })]);
      original.addEventListener("toggle", () => { if (original.open && original.children.length === 1) original.append(sourceReader(c.sourcePages)); });
      body.append(original);
    }
    if (c.id === "guide") body.append(block("按问题找课", el("div", { class: "cash-route-grid" }, [
      ["下注还是过牌？", "value"], ["转牌还要开火吗？", "barrel"], ["河牌到底跟不跟？", "river"], ["面对小注如何反击？", "checkraise"], ["先算价格与收益", "tools"], ["检查自己的推理", "practice"],
    ].map(([title, id]) => el("button", { type: "button", class: "quiet-button", onclick: () => open(id) }, title)))), block("课程内容与原页对照", [el("p", { text: book.meta.coverage }), el("p", { class: "cash-course-length", text: `${book.meta.section_count} 个课程章 · 20 个牌例精读 · ${book.meta.table_count} 张教学表 · 约 ${(book.meta.prose_characters / 10000).toFixed(1)} 万字正文` }), el("p", { class: "tb-note", text: `来源：${book.meta.source}，${book.meta.pdf_pages} 页。各课正文直接展开阅读；点击页码可查看原页、精确花色和图表，课末还可逐页翻阅。` })]));
    if (c.id === "tools") body.append(tools());
    if (c.id === "practice") body.append(...quiz(book.drills));
    if (c.id === "review") body.append(block("复盘步骤", [el("p", { text: "核对完整牌谱 → 匹配位置、筹码、抽水与行动线 → 引用规则及页码 → 解释更好的替代行动 → 按重复模式聚合。" }), el("p", { class: "tb-note", text: "标签使用：符合教材原则 / 候选漏洞 / 有依据的剥削偏离 / 证据不足。数据库不保留完整翻后牌谱，翻后判断需要原始记录；未摊牌也可评估决策理由，不能编造对手底牌。" })]), ...book.rules.map(ruleCard));
    if (c.grade) {
      const button = el("button", { type: "button", class: "quiet-button", "aria-pressed": String(state.read.has(c.id)), onclick: () => {
        if (state.read.has(c.id)) state.read.delete(c.id); else state.read.add(c.id);
        try { localStorage.setItem("cash-textbook-read", JSON.stringify([...state.read])); } catch (_) { /* Optional local progress. */ }
        render();
      } }, state.read.has(c.id) ? "✓ 已读 · 点击取消" : "标记本课已读");
      body.append(button, ...quiz(book.drills.filter((d) => d.chapter === c.id)));
    }
    body.append(el("div", { class: "tb-pager" }, [index > 0 ? el("button", { type: "button", class: "quiet-button", onclick: () => open(book.chapters[index - 1].id) }, "← 上一章") : el("span"), index < book.chapters.length - 1 ? el("button", { type: "button", onclick: () => open(book.chapters[index + 1].id) }, "下一章 →") : el("span")]));
  }
  function render() {
    const book = state.book;
    const body = el("article", { class: "tb-content panel" });
    const search = el("input", { type: "search", placeholder: "搜索章节与原则，例如：阻挡、超池、跟注", "aria-label": "搜索现金桌教材", value: state.query, oninput: (event) => { state.query = event.target.value.trim(); renderBody(body); } });
    const count = book.chapters.filter((c) => c.grade && state.read.has(c.id)).length;
    root.replaceChildren(el("header", { class: "tb-header" }, [el("div", {}, [el("p", { class: "eyebrow", text: "NLHE CASH / CARROT STUDY NOTES" }), el("h2", { text: book.meta.title }), el("p", { class: "subhead", text: book.meta.subtitle })]), el("p", { class: "tb-disclaimer", text: book.meta.disclaimer })]), el("div", { class: "cash-study-toolbar" }, [search, el("span", { text: `已读 ${count}/20 课 · 进度保存在此浏览器` })]), el("div", { class: "tb-layout" }, [el("nav", { class: "tb-nav", "aria-label": "现金桌教材章节" }, book.chapters.map((c) => el("button", { type: "button", class: c.id === state.chapter ? "active" : "", "aria-current": c.id === state.chapter ? "page" : "false", onclick: () => open(c.id) }, `${state.read.has(c.id) ? "✓ " : ""}${c.title}`))), body]));
    renderBody(body);
  }
  async function load() {
    if (state.book) return;
    try {
      const response = await fetch("/api/cash-textbook");
      if (!response.ok) throw new Error("无法读取现金桌教材，请稍后重试");
      state.book = await response.json(); render();
    } catch (error) { root.replaceChildren(el("p", { class: "tb-warn", text: error.message }), el("button", { type: "button", onclick: load }, "重试")); }
  }
  document.querySelector('[data-kpage="cash-textbook"]').addEventListener("click", load);
  if (location.hash === "#cash-textbook") {
    if (typeof switchView === "function") switchView("knowledge");
    document.querySelector('[data-kpage="cash-textbook"]').click();
  }
})();
