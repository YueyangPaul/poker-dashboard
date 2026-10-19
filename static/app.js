const elements = {
  navButtons: document.querySelectorAll(".nav-button"),
  analysisView: document.querySelector("#analysis-view"),
  ploView: document.querySelector("#plo-view"),
  mttView: document.querySelector("#mtt-view"),
  knowledgeView: document.querySelector("#knowledge-view"),
  cashSyncSummary: document.querySelector("#cash-sync-summary"),
  cashStudy: document.querySelector("#cash-study"),
  ploStudy: document.querySelector("#plo-study"),
  mttStudy: document.querySelector("#mtt-study"),
  rangeForm: document.querySelector("#range-form"),
  rangeScenario: document.querySelector("#range-scenario"),
  rangeAction: document.querySelector("#range-action"),
  rangeStack: document.querySelector("#range-stack"),
  rangeOpen: document.querySelector("#range-open"),
  rangeRake: document.querySelector("#range-rake"),
  rangeSource: document.querySelector("#range-source"),
  rangeText: document.querySelector("#range-text"),
  rangeStatus: document.querySelector("#range-status"),
  rangeCount: document.querySelector("#range-count"),
  rangeList: document.querySelector("#range-list"),
  window: document.querySelector("#window-filter"),
  stake: document.querySelector("#stake-filter"),
  from: document.querySelector("#from-filter"),
  to: document.querySelector("#to-filter"),
  reset: document.querySelector("#reset-filters"),
  chart: document.querySelector("#profit-chart"),
  chartEmpty: document.querySelector("#chart-empty"),
  positions: document.querySelector("#position-body"),
  focusTitle: document.querySelector("#focus-title"),
  focusDetail: document.querySelector("#focus-detail"),
  focusLink: document.querySelector("#focus-link"),
  domainButtons: document.querySelectorAll(".domain-button"),
  knowledgeCreator: document.querySelector("#knowledge-creator"),
  knowledgeTopic: document.querySelector("#knowledge-topic"),
  knowledgeQuery: document.querySelector("#knowledge-query"),
  knowledgeSearch: document.querySelector("#knowledge-search-button"),
  knowledgeReset: document.querySelector("#knowledge-reset"),
  knowledgeStatus: document.querySelector("#knowledge-status"),
  knowledgeCards: document.querySelector("#knowledge-cards"),
  pendingSources: document.querySelector("#pending-sources"),
  knowledgeCardCount: document.querySelector("#knowledge-card-count"),
  knowledgePendingCount: document.querySelector("#knowledge-pending-count"),
  knowledgeRefresh: document.querySelector("#knowledge-refresh"),
  knowledgeRefreshStatus: document.querySelector("#knowledge-refresh-status"),
};

let knowledgeDomain = "CASH";
let knowledgeLoaded = false;
let mttLoaded = false;
let ploLoaded = false;

const metricBindings = {
  hands: ["#metric-hands", (value) => value == null ? "—" : value.toLocaleString("zh-CN")],
  net_cents: ["#metric-profit", money],
  net_bb: ["#metric-bb", bb],
  bb_per_100: ["#metric-bb100", (value) => value == null ? "—" : signed(value, " BB")],
  rake_cents: ["#metric-rake", cost],
  insurance_net_cents: ["#metric-insurance", money],
  vpip: ["#metric-vpip", percent],
  pfr: ["#metric-pfr", percent],
  threebet: ["#metric-threebet", percent],
  wtsd: ["#metric-wtsd", percent],
  wwsf: ["#metric-wwsf", percent],
  wsd: ["#metric-wsd", percent],
};

function signed(value, suffix = "") {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;
}

function money(cents) {
  if (cents == null) return "—";
  const prefix = cents > 0 ? "+$" : cents < 0 ? "-$" : "$";
  return `${prefix}${Math.abs(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function cost(cents) { return cents == null ? "—" : `-$${Math.abs(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`; }
function bb(value) { return value == null ? "—" : signed(value, " BB"); }
function percent(value) { return value == null ? "—" : `${value.toFixed(1)}%`; }

function tone(element, value) {
  element.classList.remove("positive", "negative");
  if (typeof value === "number" && value > 0) element.classList.add("positive");
  if (typeof value === "number" && value < 0) element.classList.add("negative");
}

function query() {
  const parameters = new URLSearchParams({ window: elements.window.value });
  if (elements.stake.value) parameters.set("stake", elements.stake.value);
  if (elements.from.value) parameters.set("from", elements.from.value);
  if (elements.to.value) parameters.set("to", elements.to.value);
  return parameters;
}

async function refreshDashboard() {
  try {
    const response = await fetch(`/api/dashboard?${query()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取仪表盘");
    populateStakes(data.available_stakes);
    renderSummary(data.summary);
    renderChart(data.curve);
    renderPositions(data.positions);
    renderTrainingFocus(data.positions);
  } catch (error) {
    elements.focusDetail.textContent = error.message;
  }
}

function populateStakes(stakes) {
  const current = elements.stake.value;
  elements.stake.replaceChildren(new Option("合并所有低额级别", ""));
  stakes.forEach((stake) => elements.stake.add(new Option(stake.label, stake.id)));
  elements.stake.value = current;
}

function renderSummary(summary) {
  Object.entries(metricBindings).forEach(([key, [selector, formatter]]) => {
    const metric = document.querySelector(selector);
    metric.textContent = formatter(summary[key]);
    const directionalValue = key === "rake_cents" ? -summary[key] : summary[key];
    tone(metric, ["net_cents", "net_bb", "bb_per_100", "rake_cents", "insurance_net_cents"].includes(key) ? directionalValue : null);
  });
}

function renderChart(points) {
  elements.chart.replaceChildren();
  if (!points.length) {
    elements.chart.classList.remove("visible");
    elements.chartEmpty.hidden = false;
    return;
  }
  elements.chart.classList.add("visible");
  elements.chartEmpty.hidden = true;
  const width = 920, height = 360, left = 66, right = 26, top = 22, bottom = 48;
  const values = points.flatMap((point) => [point.net_bb, point.showdown_bb, point.non_showdown_bb]);
  let low = Math.min(0, ...values), high = Math.max(0, ...values);
  const spread = Math.max(1, high - low);
  low -= spread * .1;
  high += spread * .1;
  const x = (index) => left + index * (width - left - right) / Math.max(1, points.length - 1);
  const y = (value) => top + (high - value) * (height - top - bottom) / (high - low);
  const make = (name, attributes, text = "") => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    node.textContent = text;
    return node;
  };
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = low + (high - low) * tick / 4;
    const position = y(value);
    elements.chart.append(make("line", { x1: left, x2: width - right, y1: position, y2: position, class: value === 0 ? "chart-zero" : "chart-grid" }));
    elements.chart.append(make("text", { x: left - 9, y: position + 4, "text-anchor": "end", class: "chart-label" }, `${value.toFixed(0)} BB`));
  }
  const first = points[0].hand_number, last = points[points.length - 1].hand_number;
  elements.chart.append(make("text", { x: left, y: height - 16, class: "chart-label" }, `第 ${first.toLocaleString("zh-CN")} 手`));
  elements.chart.append(make("text", { x: width - right, y: height - 16, "text-anchor": "end", class: "chart-label" }, `第 ${last.toLocaleString("zh-CN")} 手`));
  [
    ["net_bb", "#1fc9a0"],
    ["showdown_bb", "#bd90fa"],
    ["non_showdown_bb", "#6aa9f7"],
  ].forEach(([key, color]) => {
    const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point[key]).toFixed(2)}`).join(" ");
    elements.chart.append(make("path", { d: path, stroke: color, class: "chart-path" }));
  });
}

function renderPositions(positions) {
  const rows = Object.entries(positions);
  elements.positions.replaceChildren();
  if (!rows.length) {
    elements.positions.innerHTML = '<tr><td class="empty-row" colspan="9">暂无数据</td></tr>';
    return;
  }
  rows.forEach(([position, summary]) => {
    const row = document.createElement("tr");
    const cells = [
      position,
      summary.hands.toLocaleString("zh-CN"),
      bb(summary.net_bb),
      signed(summary.bb_per_100, " BB"),
      percent(summary.vpip),
      percent(summary.pfr),
      percent(summary.rfi),
      summary.rfi_opportunities.toLocaleString("zh-CN"),
      percent(summary.threebet),
    ];
    cells.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 2) tone(cell, summary.net_bb);
      row.append(cell);
    });
    elements.positions.append(row);
  });
}

function renderTrainingFocus(positions) {
  const button = positions.BTN;
  if (!button) {
    elements.focusTitle.textContent = "等待更多可识别的位置样本";
    elements.focusDetail.textContent = "导入 6-max 手牌后，这里会展示有完整动作的复盘候选。";
    elements.focusLink.disabled = true;
    return;
  }
  if (!button.rfi_opportunities) {
    elements.focusTitle.textContent = "等待原始牌谱补齐 RFI";
    elements.focusDetail.textContent = "现有数据库保留了结果与基础行动，但旧记录尚未保存“无人在前入池”机会；下次导入原始 ZIP 会原地补齐。";
    elements.focusLink.disabled = true;
    return;
  }
  const rate = percent(button.rfi);
  const attempts = button.rfi_raises.toLocaleString("zh-CN");
  const opportunities = button.rfi_opportunities.toLocaleString("zh-CN");
  elements.focusTitle.textContent = "优先练习：面对开池时避免惯性平跟";
  elements.focusDetail.textContent = `小盲、HJ、CO 的主动平跟是本轮可复查的高频模式；下方有跨月份次数、真实手牌和具体改法。BTN 表观 RFI ${rate}（${attempts}/${opportunities}）含自动弃牌，不据此判定你开池过紧。`;
  elements.focusLink.disabled = false;
}

function reviewCard(rank, title, detail, action) {
  const card = document.createElement("article");
  card.className = "review-priority";
  const marker = document.createElement("span");
  marker.className = "rank";
  marker.textContent = rank;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const evidence = document.createElement("p");
  evidence.textContent = detail;
  const next = document.createElement("small");
  next.textContent = action;
  card.append(marker, heading, evidence, next);
  return card;
}

function drillCard(number, title, prompt, answer) {
  const card = document.createElement("article");
  card.className = "drill-card";
  const marker = document.createElement("span");
  marker.textContent = `DRILL 0${number}`;
  const heading = document.createElement("h4");
  heading.textContent = title;
  const question = document.createElement("p");
  question.textContent = prompt;
  const reveal = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "查看答案与复盘思路";
  const explanation = document.createElement("p");
  explanation.textContent = answer;
  reveal.append(summary, explanation);
  card.append(marker, heading, question, reveal);
  return card;
}

function exampleCard(example) {
  const card = document.createElement("article");
  card.className = `example-card ${example.kind}`;
  const label = document.createElement("span");
  label.textContent = example.label;
  const heading = document.createElement("h4");
  heading.textContent = `${example.position} · ${example.hole_cards}`;
  const meta = document.createElement("small");
  meta.textContent = `${example.played_at} · ${example.stake} · #${example.hand_id}`;
  const action = document.createElement("p");
  action.textContent = example.action;
  const review = document.createElement("p");
  review.className = "example-review";
  review.textContent = example.review;
  const boundary = document.createElement("small");
  boundary.className = "example-boundary";
  boundary.textContent = example.boundary;
  card.append(label, heading, meta, action, review, boundary);
  return card;
}

function studySection(number, title, intro) {
  const section = document.createElement("div");
  section.className = "review-subsection";
  const heading = document.createElement("h3");
  heading.innerHTML = `<span class="study-step">${number}</span>`;
  heading.append(document.createTextNode(title));
  section.append(heading);
  if (intro) {
    const note = document.createElement("p");
    note.textContent = intro;
    section.append(note);
  }
  return section;
}

function linkList(prefix, links, suffix) {
  const note = document.createElement("div");
  note.className = "review-method";
  note.append(document.createTextNode(prefix));
  links.forEach(([label, url], index) => {
    if (index) note.append(document.createTextNode(" · "));
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    note.append(link);
  });
  note.append(document.createTextNode(suffix));
  return note;
}

// One layout for every study tab: focus, sample scope, real hands, theory, better play, drills.
function renderStudy(container, unit) {
  const heading = document.createElement("div");
  heading.className = "panel-heading";
  heading.innerHTML = '<div><p class="eyebrow"></p><h2></h2></div>';
  heading.querySelector(".eyebrow").textContent = unit.eyebrow;
  heading.querySelector("h2").textContent = "学习单元";

  const focus = studySection("01", "训练焦点");
  const focusTitle = document.createElement("p");
  focusTitle.className = "study-focus";
  focusTitle.textContent = unit.focus.title;
  const focusDetail = document.createElement("p");
  focusDetail.textContent = unit.focus.detail;
  focus.append(focusTitle, focusDetail);

  const scope = studySection("02", "样本口径", "数字只描述这些样本里的行动习惯；口径外的牌局不参与判断。");
  const list = document.createElement("dl");
  list.className = "study-scope";
  unit.scope.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value;
    list.append(term, detail);
  });
  scope.append(list);

  const examples = studySection("03", "真实牌例", "牌局编号、底牌与动作来自 GG 原始牌谱，并逐手核对过；不按输赢倒推对错。");
  const grid = document.createElement("div");
  grid.className = "example-grid";
  grid.append(...unit.examples.map(exampleCard));
  if (!unit.examples.length) grid.textContent = "当前没有已核对的真实牌例；新增原始牌谱后再选例。";
  examples.append(grid);

  const theory = studySection("04", "背后理论", unit.theoryNote);
  const theoryList = document.createElement("ol");
  theoryList.className = "theory-list";
  unit.theory.forEach(([title, text]) => {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = title;
    item.append(strong, document.createTextNode(text));
    theoryList.append(item);
  });
  theory.append(theoryList);

  const better = studySection("05", "更好的打法");
  const priorities = document.createElement("div");
  priorities.className = "review-priorities";
  priorities.append(...unit.better.map((card) => reviewCard(...card)));
  better.append(priorities);

  const drills = studySection("06", "练习题 · 先想再看答案");
  const drillGrid = document.createElement("div");
  drillGrid.className = "drill-grid";
  drillGrid.append(...unit.drills.map((drill, index) => drillCard(index + 1, ...drill)));
  drills.append(drillGrid);

  container.replaceChildren(heading, focus, scope, examples, theory, better, drills);
  if (unit.sources) container.append(unit.sources);
}

function dateRange(first, last) {
  return `${first?.slice(0, 10) || "—"} 至 ${last?.slice(0, 10) || "—"}`;
}

function renderCashReview(data) {
  const { coverage, cold_calls: audit, examples } = data;
  const count = (value) => value.toLocaleString("zh-CN");
  const spots = Object.fromEntries(audit.by_position.map((spot) => [spot.position, spot]));
  const sb = spots.SB || { calls: 0, threebets: 0 };
  const middleCalls = (spots.HJ?.calls || 0) + (spots.CO?.calls || 0);
  const middleThreebets = (spots.HJ?.threebets || 0) + (spots.CO?.threebets || 0);
  const sbMonths = audit.by_month.filter((row) => row.position === "SB" && row.calls).map((row) => `${row.month.slice(5)}月 ${row.calls} 次`).join("、");
  elements.cashSyncSummary.textContent = `${count(coverage.all_hands)} 手 · 最近记录 ${coverage.last?.slice(0, 10) || "—"}`;
  renderStudy(elements.cashStudy, {
    eyebrow: "STUDY UNIT · 极速桌德州",
    focus: {
      title: "面对单人开池时，别把平跟当作 SB、HJ、CO 的默认中间选项。",
      detail: `SB 平跟 ${sb.calls} 次、3-bet ${sb.threebets} 次；HJ 与 CO 合计平跟 ${middleCalls} 次、3-bet ${middleThreebets} 次。SB 平跟按月：${sbMonths || "暂无"}。这是跨月份重复出现的主动决策习惯，不是挑出来的几手坏结果。`,
    },
    scope: [
      ["手数", `汇总 ${count(coverage.all_hands)} 手；其中 ${count(coverage.detailed_hands)} 手有可核对的原始牌谱`],
      ["日期", `汇总 ${dateRange(coverage.first, coverage.last)}；原始牌谱 ${dateRange(coverage.detailed_first, coverage.detailed_last)}`],
      ["级别与筛选", audit.scope],
      ["自动弃牌", "GG 导出不标记自动弃牌，所以只统计确实跟注或 3-bet 的主动决策，不把弃牌算作技术错误。"],
    ],
    examples,
    theoryNote: "理论来自公开文章的约 100BB 有抽水现金桌模型，不是你这一级别 GG 极速桌的逐手求解。",
    theory: [
      ["小盲不能照搬大盲的防守逻辑：", "SB 全程没有位置，BB 还没行动，平跟后常被跟进或挤压；平跟也会让范围里的强牌更少，所以普通 100BB 底池主要按“3-bet 或弃牌”处理。"],
      ["HJ/CO 身后还有人：", "强牌不加注会丢掉价值和隔离效果；非同花的中等 Ax、宽张牌面对前位范围容易被压制，跟进去并不能便宜地实现牌力。"],
      ["有抽水的现金桌更不鼓励中间位置冷跟：", "冷跟赢下的底池要被抽水，翻前弃牌权益也被放弃；有前注、straddle 或 Cash Drop 死钱时结论会变，本统计已排除 Cash Drop。"],
      ["不是所有位置都禁止平跟：", "BTN 与 BB 条件不同，部分平跟完全合理；也不要为了提高 3-bet 比例，把本该弃的牌硬改成 3-bet。"],
    ],
    better: [
      ["优先 01", "小盲面对开池：先选“3-bet 还是弃牌”", `SB 平跟 ${sb.calls} 次、3-bet ${sb.threebets} 次。`, "强牌如 AQo 取价值 3-bet；QJo 这类容易被压制的边缘牌弃掉；ATs 这类混合牌先核对匹配解，不惯性平跟。"],
      ["优先 02", "HJ / CO：别把跟注当中间选项", `HJ 与 CO 合计平跟 ${middleCalls} 次、3-bet ${middleThreebets} 次。`, "AKo 优先价值 3-bet；AJo、ATo 面对较强前位开池默认弃牌；例外需要对手证据。"],
      ["证据边界", "这是模式，不是逐手判错", "没有逐手匹配 GG 抽水、开池范围和对手信息，不能把每一次平跟都定为负 EV。", "从下一批新牌谱观察主动平跟是否下降，并同时核对 3-bet 与弃牌分支。"],
    ],
    drills: [
      ["SB · A♣T♣ vs BTN", "BTN 开到 2.52BB，114BB 有效，BB 尚未行动。你会跟、3-bet 还是弃？", "这是 3-bet / 跟注混合候选，不能直接判平跟错误。公开的 100BB、BTN 2.5BB、NL500 范围中 ATs 混合两种动作；本手更深且为 GG 极速桌，需要对应抽水、深度的解才能给出频率。"],
      ["HJ · A♣K♦ vs UTG", "UTG 开到 2BB，你在 HJ 持 AKo，后面还有多人。你会怎么打？", "默认价值 3-bet。只平跟会让身后轻松入池，也让强牌更难实现价值；特定对手陷阱是有证据时的例外。"],
      ["CO · A♠J♣ vs UTG", "UTG 开到 2.52BB，你在 CO 持 AJo，后面还有 BTN 与盲位。你会怎么打？", "没有对手显著宽开的证据时，默认弃牌，不为“牌看起来不错”而平跟；弱 Ax 对 UTG 易受支配，也可能被身后挤压。"],
    ],
    sources: linkList("知识依据：", [["小盲为何多采用 3-bet/弃牌", "https://blog.gtowizard.com/crush-3-bet-pots-oop-in-cash-games/"], ["有抽水现金桌的冷跟原则", "https://blog.gtowizard.com/cold-calling-in-straddle-ante-games/"], ["GG R&C 解库的模型选项", data.model_url]], "。公开文章提供理论方向，不等于你的精确 GG NL25 解；牌例不是逐手已计算 EV。"),
  });
}

async function loadCashReview() {
  try {
    const response = await fetch("/api/cash-review");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取现金桌训练报告");
    renderCashReview(data);
  } catch (error) {
    elements.cashStudy.textContent = error.message;
  }
}

const rangeScenarioLabels = { SB_BTN: "SB 对 BTN", SB_CO: "SB 对 CO", HJ_UTG: "HJ 对 UTG", CO_UTG: "CO 对 UTG" };
const rangeActionLabels = { opener_open: "对手开池", hero_all: "Hero 全范围", hero_3bet: "Hero 3-bet", hero_call: "Hero 跟注", hero_fold: "Hero 弃牌" };

function renderRanges(ranges) {
  elements.rangeCount.textContent = `${ranges.length} 份范围`;
  elements.rangeList.replaceChildren();
  if (!ranges.length) {
    const empty = document.createElement("p");
    empty.className = "range-empty";
    empty.textContent = "还没有本地范围。先从一个高频节点复制对应动作的范围，粘贴到左侧保存。";
    elements.rangeList.append(empty);
    return;
  }
  ranges.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "range-entry";
    const title = document.createElement("strong");
    title.textContent = `${rangeScenarioLabels[entry.scenario]} · ${rangeActionLabels[entry.action]}`;
    const meta = document.createElement("small");
    meta.textContent = `${entry.stack_bb}BB 有效 · 开池 ${entry.open_bb_hundredths / 100}BB · ${entry.rake_model === "microstakes" ? "微额抽水" : "无抽水 chipEV"} · ${new Date(entry.created_at).toLocaleString("zh-CN")}`;
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "查看原始复制文本";
    const raw = document.createElement("pre");
    raw.textContent = entry.range_text;
    details.append(summary, raw);
    card.append(title, meta);
    if (entry.source_url) {
      const link = document.createElement("a");
      link.href = entry.source_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "原始节点 ↗";
      card.append(link);
    }
    card.append(details);
    elements.rangeList.append(card);
  });
}

async function loadRanges() {
  try {
    const response = await fetch("/api/ranges");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取本地范围");
    renderRanges(data.ranges);
  } catch (error) {
    elements.rangeList.textContent = error.message;
  }
}

async function saveManualRange(event) {
  event.preventDefault();
  const button = elements.rangeForm.querySelector('button[type="submit"]');
  button.disabled = true;
  elements.rangeStatus.classList.remove("error");
  elements.rangeStatus.textContent = "正在保存到本机…";
  const payload = {
    scenario: elements.rangeScenario.value,
    action: elements.rangeAction.value,
    stack_bb: elements.rangeStack.value,
    open_bb: elements.rangeOpen.value,
    rake_model: elements.rangeRake.value,
    source_url: elements.rangeSource.value,
    range_text: elements.rangeText.value,
  };
  try {
    const response = await fetch("/api/ranges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "保存失败");
    elements.rangeStatus.textContent = result.saved ? "已保存到本机；旧版本不会被覆盖。" : "这份范围已经保存过。";
    elements.rangeText.value = "";
    await loadRanges();
  } catch (error) {
    elements.rangeStatus.classList.add("error");
    elements.rangeStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function switchView(view) {
  const knowledge = view === "knowledge";
  elements.analysisView.hidden = view !== "analysis";
  elements.ploView.hidden = view !== "plo";
  elements.mttView.hidden = view !== "mtt";
  elements.knowledgeView.hidden = !knowledge;
  elements.navButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (knowledge && !knowledgeLoaded) loadKnowledge();
  if (view === "mtt" && !mttLoaded) loadMtt();
  if (view === "plo" && !ploLoaded) loadPlo();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mttMoney(cents, currency = "$") {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  return `${sign}${currency}${Math.abs(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tableRow(body, values, toneIndex = -1, toneValue = null) {
  const row = document.createElement("tr");
  values.forEach((value, index) => {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (index === toneIndex) tone(cell, toneValue);
    row.append(cell);
  });
  body.append(row);
}

function renderMtt(data) {
  const { coverage, currencies, months, formats, stack_bands: bands, combined: usd } = data;
  const yuan = currencies["¥"];
  const rate = `人民币按 1 美元 = ${data.cny_per_usd} 元折算`;
  const number = (value) => value.toLocaleString("zh-CN");
  document.querySelector("#mtt-events").textContent = number(usd.events);
  document.querySelector("#mtt-entries").textContent = number(usd.entries);
  document.querySelector("#mtt-buyin").textContent = mttMoney(usd.buyin_cents).replace(/^\+/, "");
  document.querySelector("#mtt-reward").textContent = mttMoney(usd.reward_cents).replace(/^\+/, "");
  const net = document.querySelector("#mtt-net");
  net.textContent = mttMoney(usd.net_cents);
  tone(net, usd.net_cents);
  const roi = document.querySelector("#mtt-roi");
  roi.textContent = signed(usd.roi, "%");
  tone(roi, usd.roi);
  elements.mttView.querySelector("#mtt-coverage").textContent = `赛事概括 ${coverage.first_event?.slice(0, 10) || "—"}—${coverage.last_event?.slice(0, 10) || "—"}：${number(coverage.events)} 场（德州 ${number(coverage.holdem_events)} 场）；德州逐手 ${coverage.first_hand?.slice(0, 10) || "—"}—${coverage.last_hand?.slice(0, 10) || "—"}：${number(coverage.holdem_hands)} 手。`;
  document.querySelector("#mtt-sync-summary").textContent = `${number(coverage.events)} 场赛事 · ${number(coverage.holdem_hands)} 手德州牌谱`;
  const top = formats["10BB"];
  const other = formats.other;
  document.querySelector("#mtt-focus-title").textContent = "优先复盘非 10BB 赛制的长期成绩";
  document.querySelector("#mtt-focus-detail").textContent = `非 10BB：${number(other.events)} 场，净 ${mttMoney(other.net_cents)}，ROI ${signed(other.roi, "%")}。10BB 为 ${signed(top.roi, "%")}，但其中最大一笔奖金 ${mttMoney(data.largest_ten_bb_reward_cents).replace(/^\+/, "")}；去掉这一场后变为 ${signed(data.ten_bb_without_largest.roi, "%")}。这是赛制选择与复盘线索，不足以单独证明某类牌技错误。`;
  const formatBody = document.querySelector("#mtt-format-body");
  formatBody.replaceChildren();
  [["10BB", top], ["其他", other]].forEach(([label, value]) => tableRow(formatBody, [label, number(value.events), number(value.entries), mttMoney(value.buyin_cents).replace(/^\+/, ""), mttMoney(value.reward_cents).replace(/^\+/, ""), mttMoney(value.net_cents), signed(value.roi, "%")], 5, value.net_cents));
  const monthBody = document.querySelector("#mtt-month-body");
  monthBody.replaceChildren();
  Object.entries(months).forEach(([month, value]) => tableRow(monthBody, [month, number(value.events), mttMoney(value.buyin_cents).replace(/^\+/, ""), mttMoney(value.reward_cents).replace(/^\+/, ""), mttMoney(value.net_cents), signed(value.roi, "%")], 4, value.net_cents));
  document.querySelector("#mtt-month-note").textContent = `${rate}后与美元赛事合并；免费赛与非现金奖励不折成收益。`;
  const stackBody = document.querySelector("#mtt-stack-body");
  stackBody.replaceChildren();
  Object.entries(bands).forEach(([band, value]) => tableRow(stackBody, [`${band} BB`, number(value.hands), percent(value.vpip), percent(value.pfr), percent(value.rfi), number(value.rfi_opportunities), percent(value.threebet)]));
  document.querySelector("#mtt-boundary").textContent = `${rate}（固定汇率，不联网更新）：其中人民币付费德州 ${number(yuan.events)} 场，原币净 ${mttMoney(yuan.net_cents, "¥")}、ROI ${signed(yuan.roi, "%")}，已并入上方成绩。${number(coverage.excluded_from_roi)} 份赛事概括因其他牌种、免费赛、卫星赛、阶段赛或非现金奖励不进入上述现金 ROI。逐手统计只含可下载时段的德州手牌；锦标赛奥马哈手牌暂不导入；未完成赛事的行动可能已包含，但不计入成绩。`;
  renderMttStudy(data);
}

function renderMttStudy(data) {
  const { coverage, formats, preflop_decisions: decisions } = data;
  const number = (value) => value.toLocaleString("zh-CN");
  const coldBody = document.querySelector("#mtt-cold-body");
  coldBody.replaceChildren();
  data.cold_calls.forEach((row) => tableRow(coldBody, [row.format === "10BB" ? "10BB" : "其他", `${row.band} BB`, row.position_group, number(row.spots), number(row.folds), number(row.calls), number(row.threebets), number(row.jams), number(row.bounty_calls)]));
  const find = (format, band, group) => data.cold_calls.find((row) => row.format === format && row.band === band && row.position_group === group) || { spots: 0, folds: 0, calls: 0, threebets: 0, jams: 0, bounty_calls: 0 };
  const deep = find("other", ">25", "前中位");
  const deepTen = find("10BB", ">25", "前中位");
  const raised = deep.threebets + deep.jams;
  const share = deep.calls + raised ? Math.round(100 * deep.calls / (deep.calls + raised)) : null;
  const other = formats.other;
  renderStudy(elements.mttStudy, {
    eyebrow: "STUDY UNIT · 锦标赛德州",
    focus: {
      title: "非 10BB 赛事、筹码 25BB 以上时，前中位面对开池少做“先跟进去看看”。",
      detail: `这种节点共 ${number(deep.spots)} 次：跟注 ${deep.calls}、3-bet ${deep.threebets}、全下 ${deep.jams}；主动继续里平跟约占 ${share ?? "—"}%。和现金桌的冷跟习惯是同一类问题。背景：非 10BB 赛事 ${number(other.events)} 场（含人民币折算），ROI ${signed(other.roi, "%")}，是亏损最集中的赛制。跟注中有 ${deep.bounty_calls} 次在赏金赛，赏金会让部分跟注变合理，所以先看具体牌例。`,
    },
    scope: [
      ["赛事成绩", `${number(coverage.events)} 份赛事概括（德州 ${number(coverage.holdem_events)} 场），${dateRange(coverage.first_event, coverage.last_event)}`],
      ["逐手牌谱", `德州 ${number(coverage.holdem_hands)} 手，${dateRange(coverage.first_hand, coverage.last_hand)}；其中 ${number(decisions.hands)} 手（${dateRange(decisions.first, decisions.last)}）有底牌与首个决定的明细`],
      ["节点筛选", "Hero 第一次行动前恰好一次非全下加注；“前中位”指 UTG 到 CO；按开局筹码 ÷ 大盲分组。10BB 赛事同类节点只有 " + `${number(deepTen.spots)} 次，单独列出。`],
      ["排除内容", `锦标赛奥马哈手牌不导入；人民币按 1 美元 = ${data.cny_per_usd} 元折算后与美元合并；免费赛、卫星赛、阶段赛与非现金奖励不进入现金 ROI。`],
      ["未计算", "ICM、赏金价值与具体对手范围都没有逐手计算；导出文本也不标记预选弃牌。"],
    ],
    examples: data.examples,
    theoryNote: "以下是锦标赛通用原则，不是 ICM 或 solver 逐手结论。",
    theory: [
      ["风险溢价：", "有奖金结构时，输掉筹码的代价大于赢到同样筹码的收益，容易被压制的边缘牌更该谨慎。"],
      ["被压制：", "KQo、KJo、AJo 面对前位开池，常遇到 AK、AQ、KK 这类更强的同类牌；中了顶对也经常输给更大的踢脚。"],
      ["身后还有人：", "前注让盲位和后位的跟注更划算，但前中位平跟时身后仍有多人可以挤压或跟进，最后常变成没有主动权的多人底池。"],
      ["中短筹码时 SPR 低：", "约 20–30BB 平跟后，翻牌常已被底池绑定；“3-bet 全下或弃牌”通常更简洁，也拿得到弃牌权益。"],
      ["赏金只在你能覆盖对手时加分：", "筹码比开池者少就淘汰不了他，赏金不会增加这次跟注的价值。"],
    ],
    better: [
      ["优先 01", "前中位对前位开池：KQo / KJo / AJo 默认弃牌", `本节点跟注 ${deep.calls} 次，其中赏金赛 ${deep.bounty_calls} 次。`, "强牌（QQ+、AK）3-bet；中小对子和同花连张可以按筹码深度跟；非同花宽张默认弃牌，偶尔对很宽的开池者 3-bet。"],
      ["优先 02", "对手开池筹码 ≤25BB：选 3-bet 全下或弃牌", "平跟后剩余筹码与底池接近，翻牌很难弃。", "按对手开池范围决定全下范围；AJo、KQ 这类牌对短码前位开池常常只是弃牌。"],
      ["证据边界", "赛制 ROI 不是牌技判决", `10BB 赛事 ROI ${signed(formats["10BB"].roi, "%")}，去掉最大一笔奖金后 ${signed(data.ten_bb_without_largest.roi, "%")}。`, "下一批牌谱验收：同一节点的平跟是否减少，3-bet / 弃牌是否更清楚；继续把非 10BB 赛事按赛制和买入拆开。"],
    ],
    drills: [
      ["LJ · K♣Q♦ vs UTG（赏金赛）", "8 人桌，UTG（75BB）最小加注到 2BB；你 36BB，筹码少于开池者。跟、3-bet 还是弃？", "默认弃牌。KQo 对 UTG 容易被压制，身后还有 4 人加盲位；你淘汰不了开池者，赏金不增加这次跟注的价值。"],
      ["CO · A♥J♦ vs UTG（约 20BB）", "UTG 只剩约 20BB，最小加注到 2BB；你 33BB。怎么打？", "不平跟。选 3-bet 全下或弃牌：平跟后对手只剩约 18BB，翻牌几乎被绑定；要不要全下取决于你对他开池范围的判断。"],
      ["HJ · 9♣9♦ vs UTG（非赏金，40BB）", "UTG（50BB）最小加注到 2BB，你 40BB，身后还有 4 人加盲位。跟还是弃？", "跟注是合理选项。中对能靠中三条或摊牌价值实现权益，40BB 也有足够的隐含赔率；这说明目标不是“绝不平跟”，而是不拿容易被压制的非同花宽张平跟。"],
    ],
  });
}

async function loadMtt() {
  try {
    const response = await fetch("/api/mtt");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取锦标赛分析");
    renderMtt(data);
    mttLoaded = true;
  } catch (error) {
    document.querySelector("#mtt-coverage").textContent = error.message;
  }
}

function renderPlo(data) {
  const { coverage, summary, positions, structures, sb_unopened: sb, bb_vs_raise: bigBlind, bb_premium_vs_raise: premium } = data;
  const number = (value) => value.toLocaleString("zh-CN");
  const stakes = coverage.stakes.map((stake) => `${stake.label} ${number(stake.hands)} 手`).join("；");
  document.querySelector("#plo-sync-summary").textContent = `${number(coverage.hands)} 手 · ${dateRange(coverage.first, coverage.last)}`;
  document.querySelector("#plo-hands").textContent = number(summary.hands);
  const net = document.querySelector("#plo-net-bb");
  net.textContent = bb(summary.net_bb);
  tone(net, summary.net_bb);
  document.querySelector("#plo-bb100").textContent = summary.bb_per_100 == null ? "—" : signed(summary.bb_per_100, " BB");
  document.querySelector("#plo-vpip").textContent = percent(summary.vpip);
  document.querySelector("#plo-pfr").textContent = percent(summary.pfr);
  document.querySelector("#plo-threebet").textContent = percent(summary.threebet);

  const positionBody = document.querySelector("#plo-position-body");
  positionBody.replaceChildren();
  Object.entries(positions).forEach(([position, row]) => tableRow(positionBody, [position, number(row.hands), bb(row.net_bb), percent(row.vpip), percent(row.pfr), percent(row.rfi), number(row.rfi_opportunities), number(row.limps)], 2, row.net_bb));
  const structureBody = document.querySelector("#plo-structure-body");
  structureBody.replaceChildren();
  [["同花", structures.suit], ["对子", structures.pair], ["连接", structures.connectivity]].forEach(([group, rows]) => rows.forEach((row) => tableRow(structureBody, [group, row.name, number(row.dealt), percent(row.vpip), percent(row.pfr)])));
  document.querySelector("#plo-boundary").textContent = `${data.sample_warning} ${data.autofold.note}理论部分为通用 PLO 原则，不是 solver 结论；本地知识库还没有已核验的 PLO 知识卡。`;

  renderStudy(elements.ploStudy, {
    eyebrow: "STUDY UNIT · 极速桌奥马哈",
    focus: {
      title: "大盲面对单次开池几乎只跟不加注；小盲无人入池时，别平跟。",
      detail: `BB 面对单次开池 ${number(bigBlind.spots)} 次：弃牌 ${bigBlind.folds}、跟注 ${bigBlind.calls}、3-bet 只有 ${bigBlind.raises} 次（${percent(bigBlind.raise_rate)}）。其中拿到 AA、KK 或带 A 的双同花共 ${premium.spots} 次，只 3-bet 了 ${premium.raises} 次。SB 无人入池 ${sb.spots} 次：加注 ${sb.raises}（${percent(sb.raise_rate)}）、平跟 ${sb.calls}、弃牌 ${sb.folds}。SB 的加注开池率不是主要问题，要改的是平跟和大盲几乎不 3-bet 这两个习惯。`,
    },
    scope: [
      ["手数", `${number(coverage.hands)} 手，按手牌 ID 去重；单独存放，不计入德州统计`],
      ["日期", dateRange(coverage.first, coverage.last)],
      ["级别", stakes || "—"],
      ["自动弃牌", "导出文本不标记自动弃牌；弃牌次数含自动与手动，所以只评价确实入池的动作（平跟、跟注、3-bet）。"],
      ["结果指标", `${data.sample_warning} 当前 BB/100 为 ${signed(summary.bb_per_100, "")}，只作记录。`],
    ],
    examples: data.examples,
    theoryNote: "以下是通用 PLO 原则，不是 solver 结论；具体边界需要按对手开池范围、筹码深度和抽水核对。",
    theory: [
      ["翻前权益差距小，可实现性决定牌的价值：", "PLO 里大多数起手牌翻前胜率很接近。双同花、连张、带坚果同花（A 同花）的牌翻后更容易做成坚果牌；彩虹、不连接、有孤立“悬挂牌”的牌常在翻牌后被迫放弃。"],
      ["底池限注下，只有 3-bet 能把好结构的底池做大：", "AA、带好边牌的 KK、带 A 的双同花在翻前领先最多。3-bet 能把底池做大、降低 SPR、拿到主动权；只跟注则让开池者带着位置控制底池大小。"],
      ["小盲按“加注或弃牌”分类：", "SB 对 BB 全程没有位置。平跟让 BB 免费看牌，或被加注后陷入第二次难决定；值得玩的牌就加注拿走死钱，不值得的就弃。"],
      ["弃牌也是防守的一部分：", "BB 已投入 1BB 不是跟注的理由。低级别现金桌抽水占比较高，没有位置时边缘牌更难实现权益，防守范围要按结构而不是“看起来不错”来选。"],
    ],
    better: [
      ["优先 01", "BB 面对单次开池：顶级结构就 3-bet", `本样本 3-bet ${bigBlind.raises}/${bigBlind.spots} 次；AA/KK/A 双同花中 ${premium.calls} 次只跟注。`, "AA（尤其带同花或连张）、带好边牌的 KK、A 高的双同花连张默认 3-bet；中等结构可以跟；彩虹、不连接的边缘牌更多弃牌。"],
      ["优先 02", "SB 无人入池：加注或弃牌", `平跟 ${sb.calls} 次，加注 ${sb.raises} 次。`, "T98x、带同花的连张这类可玩牌直接加注；4-3-2 加孤张这类零散低牌直接弃，不平跟。"],
      ["证据边界", "小样本只看行动习惯", `只有 ${number(coverage.hands)} 手；BTN 开池率 ${percent(positions.BTN?.rfi)} 含自动弃牌，不据此判断开池过紧。`, "下一批牌谱先验收两件事：BB 面对开池的 3-bet 次数是否上升，SB 平跟是否接近零。"],
    ],
    drills: [
      ["BB · A♥A♣T♠5♦ vs HJ", "HJ（32BB）开池到 3.4BB，其余人都弃牌。你在 BB 用彩虹 AA，怎么打？", "3-bet（约底池）。AA 翻前领先最多，对手只有 32BB，3-bet 后 SPR 很低，多数翻牌可以直接打光，避免没有位置时的多轮难决定。"],
      ["SB · T♥9♦8♥4♣ 无人入池", "前面全部弃牌，你在 SB，BB 是常规玩家。你会平跟、加注还是弃牌？", "加注开池。T-9-8 三张连接加一组红心同花，值得主动入池；平跟让 BB 免费看牌。4♣ 是孤张，所以如果 BB 很少弃牌，偏向弃牌也可以，但不要平跟。"],
      ["BB · A♦9♥3♠2♣ vs BTN", "BTN 开池到 3.5BB，你在 BB。跟还是弃？", "默认弃牌。四张彩虹、9 不连接、A 不同花，翻后很少做成坚果牌；没有位置时常在翻牌就被迫放弃。"],
    ],
  });
}

async function loadPlo() {
  try {
    const response = await fetch("/api/plo");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取奥马哈分析");
    renderPlo(data);
    ploLoaded = true;
  } catch (error) {
    elements.ploStudy.textContent = error.message;
  }
}

function knowledgeParameters() {
  const parameters = new URLSearchParams({ domain: knowledgeDomain });
  if (elements.knowledgeCreator.value) parameters.set("creator", elements.knowledgeCreator.value);
  if (elements.knowledgeTopic.value) parameters.set("topic", elements.knowledgeTopic.value);
  if (elements.knowledgeQuery.value.trim()) parameters.set("q", elements.knowledgeQuery.value.trim());
  return parameters;
}

async function loadKnowledge() {
  elements.knowledgeStatus.textContent = `正在读取 ${knowledgeDomain} 知识库…`;
  elements.knowledgeStatus.className = "knowledge-status";
  try {
    const response = await fetch(`/api/knowledge?${knowledgeParameters()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法读取知识库");
    knowledgeLoaded = true;
    populateCreators(data.creators);
    renderKnowledgeCards(data.cards);
    renderPendingSources(data.pending_sources);
    elements.knowledgeCardCount.textContent = data.counts.cards.toLocaleString("zh-CN");
    elements.knowledgePendingCount.textContent = data.counts.pending_sources.toLocaleString("zh-CN");
    elements.knowledgeStatus.textContent = `${knowledgeDomain} · ${data.counts.cards} 张已核验知识卡 · ${data.counts.pending_sources} 个待精读来源`;
    renderKnowledgeRefreshStatus(data.refresh);
  } catch (error) {
    elements.knowledgeStatus.textContent = error.message;
    elements.knowledgeStatus.className = "knowledge-status error";
  }
}

function formatRefreshTime(value) {
  if (!value) return "尚未检查";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function renderKnowledgeRefreshStatus(refresh) {
  elements.knowledgeRefreshStatus.className = "knowledge-refresh-status";
  if (!refresh || !refresh.configured) {
    elements.knowledgeRefreshStatus.textContent = "尚未配置官方公开来源";
    return;
  }
  if (refresh.in_progress) {
    elements.knowledgeRefreshStatus.textContent = "正在检查官方公开来源…";
    return;
  }
  const run = refresh.last_run;
  if (!run) {
    elements.knowledgeRefreshStatus.textContent = "尚未检查；打开页面时会自动检查";
    return;
  }
  const result = run.status === "SUCCESS" ? "检查完成" : run.status === "PARTIAL" ? "部分来源检查失败" : "检查失败";
  const errors = run.errors && run.errors.length ? ` · ${run.errors.length} 个来源待重试` : "";
  elements.knowledgeRefreshStatus.textContent = `${result} ${formatRefreshTime(run.finished_at)} · 新增 ${run.sources_added} 个待精读来源${errors}`;
}

async function refreshKnowledgeSources() {
  elements.knowledgeRefresh.disabled = true;
  elements.knowledgeRefreshStatus.textContent = "正在检查官方公开来源…";
  try {
    const response = await fetch("/api/knowledge/refresh", { method: "POST" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "来源检查失败");
    knowledgeLoaded = false;
    await loadKnowledge();
  } catch (error) {
    elements.knowledgeRefreshStatus.textContent = error.message;
    elements.knowledgeRefreshStatus.className = "knowledge-refresh-status error";
  } finally {
    elements.knowledgeRefresh.disabled = false;
  }
}

function populateCreators(creators) {
  const current = elements.knowledgeCreator.value;
  elements.knowledgeCreator.replaceChildren(new Option("全部作者", ""));
  creators.forEach((creator) => elements.knowledgeCreator.add(new Option(creator, creator)));
  elements.knowledgeCreator.value = creators.includes(current) ? current : "";
}

function renderKnowledgeCards(cards) {
  elements.knowledgeCards.replaceChildren();
  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "knowledge-empty";
    empty.textContent = `${knowledgeDomain} 当前条件下还没有已核验知识卡。这里宁可显示空白，也不会用标题或转载内容拼出策略结论。`;
    elements.knowledgeCards.append(empty);
    return;
  }
  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "knowledge-card";

    const meta = document.createElement("div");
    meta.className = "knowledge-meta";
    const domain = document.createElement("span");
    domain.className = "knowledge-domain";
    domain.textContent = card.domain;
    const context = document.createElement("span");
    context.textContent = `${card.street} · ${card.positions} · ${card.stack_depth}`;
    meta.append(domain, context);

    const title = document.createElement("h2");
    title.textContent = card.title;
    const summary = document.createElement("p");
    summary.className = "knowledge-summary";
    summary.textContent = card.summary;
    const assumptions = document.createElement("p");
    assumptions.className = "knowledge-assumptions";
    assumptions.textContent = `适用边界：${card.assumptions}`;

    const source = document.createElement("div");
    source.className = "knowledge-source";
    const sourceLabel = document.createElement("span");
    sourceLabel.textContent = `${card.creator} · ${card.platform}`;
    const link = document.createElement("a");
    link.href = card.source_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "查看原始来源 ↗";
    source.append(sourceLabel, link);

    article.append(meta, title, summary, assumptions, source);
    elements.knowledgeCards.append(article);
  });
}

function renderPendingSources(sources) {
  elements.pendingSources.replaceChildren();
  if (!sources.length) {
    const empty = document.createElement("p");
    empty.className = "pending-empty";
    empty.textContent = "当前筛选下没有待精读来源。";
    elements.pendingSources.append(empty);
    return;
  }
  sources.forEach((source) => {
    const item = document.createElement("article");
    item.className = "pending-source";
    const title = document.createElement("strong");
    title.textContent = source.title;
    const meta = document.createElement("span");
    meta.textContent = `${source.creator} · ${source.platform} · ${source.domain}`;
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "打开来源 ↗";
    item.append(title, meta, link);
    elements.pendingSources.append(item);
  });
}

[elements.window, elements.stake, elements.from, elements.to].forEach((control) => control.addEventListener("change", refreshDashboard));
elements.reset.addEventListener("click", () => {
  elements.window.value = "all";
  elements.stake.value = "";
  elements.from.value = "";
  elements.to.value = "";
  refreshDashboard();
});

elements.navButtons.forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
elements.domainButtons.forEach((button) => button.addEventListener("click", () => {
  knowledgeDomain = button.dataset.domain;
  elements.domainButtons.forEach((candidate) => {
    const active = candidate === button;
    candidate.classList.toggle("active", active);
    candidate.setAttribute("aria-pressed", String(active));
  });
  elements.knowledgeCreator.value = "";
  elements.knowledgeTopic.value = "";
  loadKnowledge();
}));
elements.knowledgeSearch.addEventListener("click", loadKnowledge);
elements.knowledgeCreator.addEventListener("change", loadKnowledge);
elements.knowledgeTopic.addEventListener("change", loadKnowledge);
elements.knowledgeQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadKnowledge();
});
elements.knowledgeReset.addEventListener("click", () => {
  elements.knowledgeCreator.value = "";
  elements.knowledgeTopic.value = "";
  elements.knowledgeQuery.value = "";
  loadKnowledge();
});
elements.knowledgeRefresh.addEventListener("click", refreshKnowledgeSources);
elements.focusLink.addEventListener("click", () => {
  document.querySelector(".cash-review").scrollIntoView({ behavior: "smooth" });
});
elements.rangeForm.addEventListener("submit", saveManualRange);

refreshDashboard();
loadCashReview();
loadRanges();
