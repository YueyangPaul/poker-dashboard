// "错误复盘" sub-page of the Omaha view: hand-reviewed cases from /api/plo-review, compared with the textbook.
(function () {
  const overview = document.querySelector("#plo-overview");
  const root = document.querySelector("#plo-review");
  const tabs = document.querySelectorAll(".plo-tab");
  const KINDS = { error: "错误", leak: "漏洞", cooler: "撞牌 · 打法正确", good: "正例" };
  const SUITS = { s: "♠", h: "♥", d: "♦", c: "♣" };
  const state = { data: null, kind: "all", page: "current" };

  function el(tag, attributes = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "text") node.textContent = value;
      else if (key === "class") node.className = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    });
    [].concat(children).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(child));
    });
    return node;
  }

  function cardRow(text, extraClass = "") {
    if (!text) return null;
    return el("div", { class: `tb-cards ${extraClass}` }, text.split(/\s+/).map((card) => el("span", { class: `tb-card suit-${card[1]}` }, card[0] + SUITS[card[1]])));
  }

  function refChip(ref) {
    const [id, time] = ref.split("|");
    const video = state.data.videos.find((item) => item.id === id);
    if (!video) return el("span", { class: "tb-ref", text: ref });
    const [minutes, seconds] = time.split(":").map(Number);
    return el("a", { class: "tb-ref", href: `https://www.bilibili.com/video/${video.bv}/?t=${minutes * 60 + seconds}`, target: "_blank", rel: "noopener noreferrer", title: `${video.title} · ${time}` }, `${id} ${time}`);
  }

  function signedBb(value) {
    return `${value > 0 ? "+" : ""}${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })} BB`;
  }

  function sessionBlock(session, extra = null) {
    const stats = session.stats;
    const cases = state.data.cases.filter((item) => item.session === session.id);
    const counts = Object.keys(KINDS).map((kind) => `${KINDS[kind]} ${cases.filter((item) => item.kind === kind).length}`).join(" · ");
    const rfiRows = stats.rfi.map((row) => el("tr", {}, [
      el("td", { text: row.position }),
      el("td", { text: row.opportunities ? `${row.opens}/${row.opportunities}` : "—" }),
      el("td", {}, el("div", { class: "rv-bar" }, [
        el("span", { class: "rv-bar-mine", style: `width:${Math.min(100, row.rate || 0)}%` }),
        el("span", { class: "rv-bar-book", style: `left:${row.textbook}%`, title: `教材 ${row.textbook}%` }),
      ])),
      el("td", { class: row.rate !== null && Math.abs(row.rate - row.textbook) >= 10 ? "rv-off" : "", text: row.rate === null ? "—" : `${row.rate}%` }),
      el("td", { text: `${row.textbook}%` }),
      el("td", { text: row.limps ? `${row.limps}` : "0" }),
    ]));
    return el("article", { class: "tb-content panel rv-session" }, [
      el("p", { class: "eyebrow", text: "SESSION REVIEW" }),
      el("h2", { text: session.title }),
      el("p", { class: "tb-intro", text: session.summary }),
      el("div", { class: "rv-stats" }, [
        el("span", {}, ["手数 ", el("strong", { text: stats.hands.toLocaleString("zh-CN") })]),
        el("span", {}, ["盈亏 ", el("strong", { class: stats.net_bb < 0 ? "negative" : "positive", text: `${signedBb(stats.net_bb)}（${stats.net_usd < 0 ? "−" : "+"}$${Math.abs(stats.net_usd).toFixed(2)}）` })]),
        el("span", {}, ["VPIP ", el("strong", { text: `${stats.vpip ?? "—"}%` })]),
        el("span", {}, ["PFR ", el("strong", { text: `${stats.pfr ?? "—"}%` })]),
        el("span", {}, ["复盘案例 ", el("strong", { text: counts })]),
      ]),
      el("section", { class: "tb-block" }, [
        el("h3", { text: "无人入池时的开池率 · 对照教材" }),
        el("p", { class: "tb-muted", text: "绿色条是你这一场的开池率，橙色竖线是教材的常规桌比例；相差 10 个百分点以上标橙色。" }),
        el("div", { class: "table-wrap" }, el("table", { class: "rv-rfi" }, [
          el("thead", {}, el("tr", {}, ["位置", "开池/机会", "", "你", "教材", "平跟入池"].map((text) => el("th", { text })))),
          el("tbody", {}, rfiRows),
        ])),
      ]),
      extra,
      el("section", { class: "tb-block" }, [
        el("h3", { text: "这一场的规律" }),
        el("ul", { class: "tb-points" }, session.patterns.map((pattern) => el("li", {}, [el("strong", { text: `${pattern.title}：` }), pattern.detail, " ", ...(pattern.refs || []).map(refChip)]))),
      ]),
    ]);
  }

  function caseCard(item) {
    return el("article", { class: `rv-case rv-${item.kind}` }, [
      el("header", { class: "rv-case-head" }, [
        el("span", { class: `rv-kind rv-kind-${item.kind}`, text: KINDS[item.kind] }),
        el("span", { class: "rv-street", text: `${item.position} · ${item.street}` }),
        el("span", { class: `rv-result ${item.net_bb < 0 ? "negative" : "positive"}`, text: signedBb(item.net_bb) }),
      ]),
      el("h3", { text: item.tag }),
      el("div", { class: "rv-hand" }, [
        el("div", {}, [el("small", { text: "底牌" }), cardRow(item.cards)]),
        item.board ? el("div", {}, [el("small", { text: "公共牌" }), cardRow(item.board, "rv-board")]) : null,
      ]),
      el("p", { class: "rv-line", text: item.line }),
      el("div", { class: "rv-book" }, [el("strong", { text: "教材怎么说" }), el("p", { text: item.textbook }), el("div", {}, item.refs.map(refChip))]),
      el("div", { class: "rv-better" }, [el("strong", { text: item.kind === "cooler" || item.kind === "good" ? "结论" : "更好的打法" }), el("p", { text: item.better })]),
      el("small", { class: "rv-meta", text: `${item.played_at} · #${item.hand_id}` }),
    ]);
  }

  function comparisonBlock(session) {
    const comparison = session.comparison;
    if (!comparison) return null;
    const previous = state.data.sessions.find((item) => item.id === comparison.vs);
    const column = (title, cls, items) => el("div", { class: `rv-compare-col ${cls}` }, [
      el("h4", { text: `${title}（${items.length}）` }),
      el("ul", {}, items.map((item) => el("li", {}, [el("strong", { text: item.title }), el("p", { text: item.detail })]))),
    ]);
    const rows = previous ? session.stats.rfi.map((row) => {
      const old = previous.stats.rfi.find((item) => item.position === row.position) || {};
      const moved = row.rate !== null && old.rate !== null && old.rate !== undefined
        ? Math.abs(row.textbook - row.rate) < Math.abs(row.textbook - old.rate) ? "rv-better-text" : Math.abs(row.textbook - row.rate) > Math.abs(row.textbook - old.rate) ? "rv-off" : "" : "";
      return el("tr", {}, [el("td", { text: row.position }), el("td", { text: old.rate === null || old.rate === undefined ? "—" : `${old.rate}%` }), el("td", { class: moved, text: row.rate === null ? "—" : `${row.rate}%` }), el("td", { text: `${row.textbook}%` })]);
    }) : [];
    return el("section", { class: "tb-block" }, [
      el("h3", { text: `和上一场（${previous ? previous.title : comparison.vs}）相比` }),
      el("div", { class: "rv-compare" }, [column("进步了", "rv-improved", comparison.improved), column("还没改", "rv-unchanged", comparison.unchanged), column("新出现的问题", "rv-new", comparison.new || [])]),
      rows.length ? el("div", { class: "table-wrap" }, el("table", { class: "rv-rfi-compare" }, [
        el("thead", {}, el("tr", {}, ["开池率", "上一场", "这一场", "教材"].map((text) => el("th", { text })))),
        el("tbody", {}, rows),
      ])) : null,
    ]);
  }

  function casesBlock(sessionId) {
    const all = state.data.cases.filter((item) => item.session === sessionId);
    const filters = [["all", "全部"], ...Object.entries(KINDS)];
    const cases = all.filter((item) => state.kind === "all" || item.kind === state.kind);
    const order = { error: 0, leak: 1, cooler: 2, good: 3 };
    cases.sort((a, b) => order[a.kind] - order[b.kind] || a.net_bb - b.net_bb);
    return [
      el("div", { class: "tb-segment rv-filters" }, filters.map(([kind, label]) => el("button", {
        type: "button", class: state.kind === kind ? "active" : "", "aria-pressed": String(state.kind === kind),
        onclick: () => { state.kind = kind; render(); },
      }, `${label}（${kind === "all" ? all.length : all.filter((item) => item.kind === kind).length}）`))),
      cases.length ? el("div", { class: "rv-grid" }, cases.map(caseCard)) : el("p", { class: "tb-muted", text: "这一类还没有案例。" }),
    ];
  }

  function archiveBlock(sessions) {
    if (!sessions.length) return el("p", { class: "tb-muted", text: "还没有更早的场次。" });
    return el("div", { class: "rv-archive" }, sessions.slice().reverse().map((session) => {
      const cases = state.data.cases.filter((item) => item.session === session.id);
      const errors = cases.filter((item) => item.kind === "error").length;
      const leaks = cases.filter((item) => item.kind === "leak").length;
      const details = el("details", { class: "rv-archive-item" }, [
        el("summary", {}, [el("strong", { text: session.title }), ` · ${session.stats.hands.toLocaleString("zh-CN")} 手 · ${signedBb(session.stats.net_bb)} · 错误 ${errors} · 漏洞 ${leaks}（点开查看）`]),
      ]);
      details.addEventListener("toggle", () => {
        if (details.open && details.children.length === 1) {
          details.append(sessionBlock(session), el("div", { class: "rv-grid" }, cases.slice().sort((a, b) => a.net_bb - b.net_bb).map(caseCard)));
        }
      });
      return details;
    }));
  }

  function render() {
    const { data } = state;
    const latest = data.sessions[data.sessions.length - 1];
    const earlier = data.sessions.slice(0, -1);
    const pages = [["current", `本场复盘${latest ? ` · ${latest.title}` : ""}`], ["history", `历史场次（${earlier.length}）`]];
    const body = state.page === "history" ? [archiveBlock(earlier)]
      : latest ? [sessionBlock(latest, comparisonBlock(latest)), ...casesBlock(latest.id)] : [el("p", { class: "tb-muted", text: "还没有复盘场次。" })];
    root.replaceChildren(
      el("header", { class: "tb-header" }, [
        el("div", {}, [el("p", { class: "eyebrow", text: "PLO MISTAKE LOG" }), el("h2", { text: "奥马哈错误复盘" }), el("p", { class: "subhead", text: "按摆教练的教材逐手核对的案例；每条都附教材出处。" })]),
        el("p", { class: "tb-disclaimer" }, ["只记录我逐手看过的牌例，不按输赢判对错：没到摊牌、但明显违背教材的也会列出来；撞牌输掉但打法正确的列作对照。", " ", el("a", { href: "#plo-textbook", onclick: (event) => { event.preventDefault(); openTextbook(); } }, "打开奥马哈教材 →")]),
      ]),
      el("div", { class: "tb-segment rv-pages" }, pages.map(([page, label]) => el("button", {
        type: "button", class: state.page === page ? "active" : "", "aria-pressed": String(state.page === page),
        onclick: () => { state.page = page; state.kind = "all"; render(); },
      }, label))),
      ...body,
    );
  }

  function openTextbook() {
    if (typeof switchView === "function") switchView("knowledge");
    const tab = document.querySelector('[data-kpage="plo-textbook"]');
    if (tab) tab.click();
  }

  async function load() {
    if (state.data) return;
    try {
      const response = await fetch("/api/plo-review");
      if (!response.ok) throw new Error("无法读取复盘案例");
      state.data = await response.json();
      render();
    } catch (error) {
      root.replaceChildren(el("p", { class: "tb-warn", text: error.message }));
    }
  }

  function showPage(page) {
    const reviewing = page === "review";
    overview.hidden = reviewing;
    root.hidden = !reviewing;
    tabs.forEach((tab) => {
      const active = tab.dataset.plopage === page;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    if (reviewing) load();
    history.replaceState(null, "", reviewing ? "#plo-review" : location.pathname);
  }

  tabs.forEach((tab) => tab.addEventListener("click", () => showPage(tab.dataset.plopage)));
  if (location.hash === "#plo-review") {
    if (typeof switchView === "function") switchView("plo");
    showPage("review");
  }
})();
