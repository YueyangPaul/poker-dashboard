// Omaha textbook sub-page of the knowledge view: content comes from /api/plo-textbook, live numbers from /api/plo.
(function () {
  // A standalone page sets window.PLO_TEXTBOOK = { dataUrl, standalone: true } and has no personal data.
  const config = Object.assign({ dataUrl: "/api/plo-textbook", standalone: false }, window.PLO_TEXTBOOK || {});
  const root = document.querySelector("#plo-textbook");
  const library = document.querySelector("#knowledge-library");
  const tabs = document.querySelectorAll(".knowledge-tab");
  const state = { book: null, chapter: "guide", rangeKey: "top20", highlight: null, drillScores: {}, position: { scenario: "open", mine: 0, theirs: 0 } };

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

  function videoOf(id) { return state.book.videos.find((video) => video.id === id); }

  function refChip(ref) {
    const [id, time] = ref.split("|");
    const video = videoOf(id);
    const [minutes, seconds] = time.split(":").map(Number);
    return el("a", {
      class: "tb-ref", href: `https://www.bilibili.com/video/${video.bv}/?t=${minutes * 60 + seconds}`,
      target: "_blank", rel: "noopener noreferrer", title: `${video.title} · ${time}`,
    }, `${id} ${time}`);
  }

  function verifyBadge() { return el("span", { class: "tb-verify", title: "画面看不清或说法未经证实" }, "待核对"); }

  function sectionBlock(title, children, extraClass = "") {
    return el("section", { class: `tb-block ${extraClass}` }, [el("h3", { text: title }), ...[].concat(children)]);
  }

  // ---------- widgets ----------
  function classifierWidget() {
    const output = el("div", { class: "tb-classifier-output", "aria-live": "polite" });
    const input = el("input", { type: "text", value: "AsKh9s8h", placeholder: "例如 AsKh9s8h", "aria-label": "四张底牌", maxlength: "24" });
    const run = () => {
      output.replaceChildren();
      try {
        const result = window.PloClassifier.classify(input.value, state.book.tables.ranges);
        const labels = { ds: "双同花", ss: "单同花", ts: "三同花（查表按彩虹）", mt: "四张同花（查表按彩虹）", rb: "彩虹" };
        const rowLabel = state.book.tables.ranges.rowLabels[result.row] || result.row;
        const cards = el("div", { class: "tb-cards" }, result.cards.map((card) => el("span", { class: `tb-card suit-${card[1]}` }, card[0] + { s: "♠", h: "♥", d: "♦", c: "♣" }[card[1]])));
        const facts = el("div", { class: "tb-facts" }, [
          el("span", {}, ["花色：", el("strong", { text: labels[result.suitClass] })]),
          el("span", {}, ["类别：", el("strong", { text: rowLabel })]),
          result.trips ? el("span", { class: "tb-warn", text: "含三条：最差的对子结构" }) : null,
          result.twoPair ? el("span", { text: "两对：按较大的对子查表" }) : null,
        ]);
        const lookups = el("div", { class: "tb-lookups" }, ["top20", "top30"].map((key) => {
          const table = state.book.tables.ranges[key];
          const hit = result.lookups[key];
          return el("article", {}, [
            el("small", { text: `${table.title} · ${table.use}` }),
            el("strong", { text: hit.percent === null ? "待核对" : `${hit.percent}%` }),
            el("p", { text: window.PloClassifier.advice(hit.percent) }),
            hit.threshold ? el("p", { class: "tb-muted", text: `门槛示例：${hit.threshold}` }) : null,
            el("button", { class: "quiet-button", type: "button", onclick: () => {
              state.rangeKey = key; state.highlight = { row: result.row, column: result.column }; openChapter("preflop", "tb-ranges");
            } }, "在范围表中查看"),
          ]);
        }));
        output.append(cards, facts, lookups, el("p", { class: "tb-note", text: "仅为查表近似：线性范围表只按类别和花色给比例，具体是否开池还要和门槛牌比较结构与大小；连张 2g 的判定规则待核对。" }));
      } catch (error) {
        output.append(el("p", { class: "tb-warn", text: error.message }));
      }
    };
    input.addEventListener("keydown", (event) => { if (event.key === "Enter") run(); });
    const samples = ["AsKh9s8h", "6s5h4s3h", "AhAcTs5d", "KdTd9c8c", "5s4h4d2s", "As2h3d4c"];
    const widget = sectionBlock("起手牌分类器", [
      el("p", { class: "tb-muted", text: "输入 4 张牌（点数 A K Q J T 9…2，花色 s h d c），看它属于哪一类、在开池表里对应哪一格。" }),
      el("div", { class: "tb-input-row" }, [input, el("button", { type: "button", onclick: run }, "查表")]),
      el("div", { class: "tb-samples" }, samples.map((sample) => el("button", { class: "tb-chip", type: "button", onclick: () => { input.value = sample; run(); } }, sample))),
      output,
    ], "tb-widget");
    queueMicrotask(run);
    return widget;
  }

  function rangesWidget() {
    const ranges = state.book.tables.ranges;
    const detail = el("div", { class: "tb-detail", "aria-live": "polite" });
    const wrap = el("div", { class: "table-wrap tb-table-wrap" });
    const switcher = el("div", { class: "tb-segment" });
    const draw = () => {
      const table = ranges[state.rangeKey];
      switcher.replaceChildren(...["top20", "top30"].map((key) => el("button", {
        type: "button", class: key === state.rangeKey ? "active" : "", "aria-pressed": String(key === state.rangeKey),
        onclick: () => { state.rangeKey = key; draw(); },
      }, `${ranges[key].title}（${ranges[key].use}）`)));
      const head = el("tr", {}, [el("th", { text: "类别" }), ...ranges.columns.map((column) => el("th", { text: ranges.columnLabels[column] })), el("th", { text: "发到" }), el("th", { text: "占开池" })]);
      const body = ranges.rows.map((row) => {
        const cell = table.cells[row];
        return el("tr", {}, [
          el("td", { text: ranges.rowLabels[row] || row }),
          ...ranges.columns.map((column) => {
            const [percent, threshold] = cell[column];
            const flagged = (table.verifyCells || []).includes(`${row}.${column}`);
            const active = state.highlight && state.highlight.row === row && state.highlight.column === column;
            const heat = percent === null ? 0 : percent / 100;
            return el("td", {}, el("button", {
              type: "button", class: `tb-heat${active ? " active" : ""}`, style: `--heat:${heat}`,
              onclick: () => { state.highlight = { row, column }; draw(); },
            }, [percent === null ? "?" : `${percent}%`, flagged ? el("sup", { text: "待核对" }) : null]));
          }),
          el("td", { text: `${cell.dealt}%` }), el("td", { text: `${cell.rfi}%` }),
        ]);
      });
      wrap.replaceChildren(el("table", { class: "tb-range-table" }, [el("thead", {}, head), el("tbody", {}, body)]));
      if (state.highlight) {
        const { row, column } = state.highlight;
        const [percent, threshold] = table.cells[row][column];
        const flagged = (table.verifyCells || []).includes(`${row}.${column}`);
        detail.replaceChildren(el("div", {}, [
          el("strong", { text: `${table.title} · ${ranges.rowLabels[row] || row} · ${ranges.columnLabels[column]}` }),
          el("p", { text: percent === null ? "比例看不清。" : `这一类里入选 ${percent}%。${window.PloClassifier.advice(percent)}。` }),
          threshold ? el("p", { text: `门槛示例（最差可玩）：${threshold}` }) : null,
          flagged ? verifyBadge() : null,
        ]));
      } else {
        detail.replaceChildren(el("p", { class: "tb-muted", text: "还没有选中格子。" }));
      }
    };
    draw();
    return sectionBlock("开池范围表", [
      switcher,
      el("p", { class: "tb-muted", text: "点任意格子看门槛牌。颜色越亮，这一类入选比例越高。三同花、四同花按彩虹列查。" }),
      wrap, detail, el("p", { class: "tb-source" }, ["来源：", refChip(ranges.top20.ref), " ", refChip(ranges.top30.ref)]),
    ], "tb-widget");
  }

  function positionsWidget() {
    const tables = state.book.tables;
    const out = el("div", { class: "tb-position-out", "aria-live": "polite" });
    const controls = el("div", { class: "toolbar tb-toolbar" });
    const scenarios = { open: "我开池", defend: "我面对开池", vs3bet: "我开池后被 3-bet" };
    const select = (label, options, value, onchange) => el("label", {}, [label, el("select", { onchange: (event) => onchange(event.target.value) }, options.map(([v, text]) => {
      const option = el("option", { value: v }, text); if (String(v) === String(value)) option.selected = true; return option;
    }))]);
    const draw = () => {
      const { scenario } = state.position;
      const mine = Number(state.position.mine);
      const theirs = Number(state.position.theirs);
      controls.replaceChildren(select("场景", Object.entries(scenarios), scenario, (value) => { state.position = { scenario: value, mine: 0, theirs: 0 }; draw(); }));
      let grid;
      let rowsLabel;
      let colsLabel;
      let message;
      let highlight = null;
      if (scenario === "open") {
        controls.append(select("我的位置", tables.rfi.positions.map((name, index) => [index, name]), mine, (value) => { state.position.mine = value; draw(); }));
        const cash = tables.rfi.rows["常规桌"][mine];
        const mtt = tables.rfi.rows["锦标赛"][mine];
        message = `${tables.rfi.positions[mine]} 开池：常规桌约 ${cash}%，锦标赛约 ${mtt}%。常规桌只有满池开池或弃牌。`;
        grid = el("table", {}, [
          el("thead", {}, el("tr", {}, [el("th", { text: "" }), ...tables.rfi.positions.map((name, index) => el("th", { class: index === mine ? "tb-hit" : "" }, name))])),
          el("tbody", {}, Object.entries(tables.rfi.rows).map(([name, values]) => el("tr", {}, [el("td", { text: name }), ...values.map((value, index) => el("td", { class: index === mine ? "tb-hit" : "" }, `${value}%`))]))),
        ]);
        out.replaceChildren(el("p", { class: "tb-answer", text: message }), el("div", { class: "table-wrap" }, grid), el("p", { class: "tb-source" }, ["来源：", refChip(tables.rfi.ref)]));
        return;
      }
      const table = scenario === "defend" ? tables.defense : tables.vs3bet;
      rowsLabel = scenario === "defend" ? table.defenders : table.threebettors;
      colsLabel = table.openers;
      const validPairs = [];
      table.cells.forEach((row, r) => row.forEach((cell, c) => { if (cell) validPairs.push([r, c]); }));
      if (scenario === "defend") {
        const defenderOptions = [...new Set(validPairs.map(([r]) => r))].map((r) => [r, rowsLabel[r]]);
        const d = defenderOptions.some(([r]) => r === mine) ? mine : defenderOptions[0][0];
        const openerOptions = validPairs.filter(([r]) => r === d).map(([, c]) => [c, colsLabel[c]]);
        const o = openerOptions.some(([c]) => c === theirs) ? theirs : openerOptions[0][0];
        state.position.mine = d; state.position.theirs = o;
        controls.append(select("我的位置", defenderOptions, d, (value) => { state.position.mine = Number(value); draw(); }), select("开池位置", openerOptions, o, (value) => { state.position.theirs = Number(value); draw(); }));
        const [total, threebet] = table.cells[d][o];
        message = `${rowsLabel[d]} 面对 ${colsLabel[o]}（开池 ${table.openRates[o]}%）：总共防守 ${total}%，其中 3-bet ${threebet}%、跟注约 ${Math.round((total - threebet) * 10) / 10}%，其余弃牌。`;
        highlight = [d, o];
      } else {
        const openerOptions = [...new Set(validPairs.map(([, c]) => c))].map((c) => [c, colsLabel[c]]);
        const o = openerOptions.some(([c]) => c === mine) ? mine : openerOptions[0][0];
        const bettorOptions = validPairs.filter(([, c]) => c === o).map(([r]) => [r, rowsLabel[r]]);
        const b = bettorOptions.some(([r]) => r === theirs) ? theirs : bettorOptions[0][0];
        state.position.mine = o; state.position.theirs = b;
        controls.append(select("我的开池位置", openerOptions, o, (value) => { state.position.mine = Number(value); draw(); }), select("3-bet 位置", bettorOptions, b, (value) => { state.position.theirs = Number(value); draw(); }));
        const [fold, call, four] = table.cells[b][o];
        message = `${colsLabel[o]} 开池（${tables.defense.openRates[o]}%）被 ${rowsLabel[b]} 3-bet：弃牌 ${fold}%、跟注 ${call}%、4-bet ${four}%（占全部手牌）。${["小盲", "大盲"].includes(rowsLabel[b]) ? "被盲位 3-bet 时翻后有位置，几乎全部继续。" : ""}`;
        highlight = [b, o];
      }
      grid = el("table", {}, [
        el("thead", {}, el("tr", {}, [el("th", { text: scenario === "defend" ? "防守 ＼ 开池" : "3-bet ＼ 开池" }), ...colsLabel.map((name, c) => el("th", { class: highlight[1] === c ? "tb-hit" : "" }, name))])),
        el("tbody", {}, table.cells.map((row, r) => el("tr", {}, [el("td", { class: highlight[0] === r ? "tb-hit" : "", text: rowsLabel[r] }), ...row.map((cell, c) => el("td", { class: highlight[0] === r && highlight[1] === c ? "tb-hit tb-hit-cell" : "" }, cell ? (scenario === "defend" ? `${cell[0]}%（${cell[1]}%）` : cell.map((value) => `${value}%`).join(" / ")) : "—"))]))),
      ]);
      out.replaceChildren(el("p", { class: "tb-answer", text: message }), el("div", { class: "table-wrap" }, grid), el("p", { class: "tb-muted", text: table.note }), el("p", { class: "tb-source" }, ["来源：", refChip(table.ref)]));
    };
    draw();
    return sectionBlock("位置选择器", [el("p", { class: "tb-muted", text: "选一个场景和位置，表格会高亮对应的格子。数字是常规桌 100BB 的教练表格。" }), controls, out], "tb-widget");
  }

  function flopWidget() {
    const flop = state.book.tables.flop;
    const detail = el("div", { class: "tb-detail", "aria-live": "polite" }, el("p", { class: "tb-muted", text: "点任意格子看这一类牌的打法和视频里的例子。" }));
    const grid = el("table", { class: "tb-flop" }, [
      el("thead", {}, el("tr", {}, [el("th", { text: "成牌 ＼ 额外属性" }), ...flop.columns.map((name) => el("th", { text: name }))])),
      el("tbody", {}, flop.cells.map((row, r) => el("tr", {}, [el("td", { text: flop.rows[r] }), ...row.map((action, c) => el("td", {}, el("button", {
        type: "button", class: `tb-action act-${action.split("/")[0]}`,
        onclick: (event) => {
          grid.querySelectorAll(".tb-action.active").forEach((node) => node.classList.remove("active"));
          event.currentTarget.classList.add("active");
          detail.replaceChildren(el("div", {}, [
            el("strong", { text: `${flop.rows[r]} + ${flop.columns[c]} → ${action}` }),
            ...action.split("/").map((part) => el("p", {}, [el("b", { text: `${part}：` }), flop.actions[part]])),
            flop.examples[`${r},${c}`] ? el("p", { class: "tb-example", text: `例：${flop.examples[`${r},${c}`]}` }) : null,
          ]));
        },
      }, action)))]))),
    ]);
    return sectionBlock(flop.title, [el("div", { class: "table-wrap" }, grid), detail, el("p", { class: "tb-source" }, ["来源：", refChip(flop.ref)])], "tb-widget");
  }

  function bubbleWidget() {
    const bubble = state.book.tables.bubble;
    const detail = el("p", { class: "tb-answer", "aria-live": "polite", text: "点格子看解释：泡泡因子越高，输一次要赢越多次才补得回来。" });
    const grid = el("table", {}, [
      el("thead", {}, el("tr", {}, [el("th", { text: "自己 ＼ 对手" }), ...bubble.players.map(([name, chips]) => el("th", {}, [name, el("br"), el("small", { text: chips })]))])),
      el("tbody", {}, bubble.cells.map((row, r) => el("tr", {}, [el("td", {}, `${bubble.players[r][0]} ${bubble.players[r][1]}`), ...row.map((cell, c) => el("td", {}, cell ? el("button", {
        type: "button", class: "tb-heat tb-bubble", style: `--heat:${Math.min(1, (cell[1] - 1) / 1.5)}`,
        onclick: () => { detail.textContent = `${bubble.players[r][0]} 对 ${bubble.players[c][0]}：泡泡因子 ${cell[1]}，比没有 ICM 时多需要 ${cell[0]}% 的胜率才值得打光。${cell[1] >= 2 ? "大于 2，已经非常高——除非牌力极强，否则避免与这个对手翻前打光。" : cell[1] < 1.2 ? "接近 1，几乎不受 ICM 约束，可以放开施压。" : ""}`; },
      }, [`+${cell[0]}%`, el("br"), el("small", { text: cell[1].toFixed(2) })]) : "—"))]))),
    ]);
    return sectionBlock(bubble.title, [el("p", { class: "tb-muted" }, [bubble.note, " ", bubble.verify ? verifyBadge() : null]), el("div", { class: "table-wrap" }, grid), detail, el("p", { class: "tb-source" }, ["来源：", refChip(bubble.ref)])], "tb-widget");
  }

  function drillsWidget() {
    const drills = state.book.drills;
    const total = el("p", { class: "tb-answer", "aria-live": "polite" });
    const updateTotal = () => {
      const answered = Object.keys(state.drillScores).length;
      const earned = Object.values(state.drillScores).reduce((sum, value) => sum + value, 0);
      const best = drills.filter((drill) => drill.id in state.drillScores).reduce((sum, drill) => sum + Math.max(...drill.options.map((option) => option.score)), 0);
      total.textContent = answered ? `已答 ${answered}/${drills.length} 题，得分 ${earned}/${best}` : `共 ${drills.length} 题，选完会显示分值和解析。`;
    };
    const cards = drills.map((drill, index) => {
      const reveal = el("div", { class: "tb-reveal", hidden: true });
      const best = Math.max(...drill.options.map((option) => option.score));
      const buttons = drill.options.map((option) => el("button", {
        type: "button", class: "tb-option",
        onclick: () => {
          if (drill.id in state.drillScores) return;
          state.drillScores[drill.id] = option.score;
          buttons.forEach((button, i) => {
            const score = drill.options[i].score;
            button.disabled = true;
            button.classList.add(score === best ? "best" : "other");
            button.append(el("small", { text: ` ${score} 分` }));
          });
          reveal.hidden = false;
          updateTotal();
        },
      }, option.label));
      reveal.append(el("p", { text: drill.explain }), el("p", { class: "tb-source" }, ["出处：", refChip(drill.ref), drill.verify ? [" ", verifyBadge()] : null].flat()));
      return el("article", { class: "drill-card tb-drill" }, [
        el("span", { text: `${drill.source} · ${String(index + 1).padStart(2, "0")}` }),
        el("h4", { text: drill.title }),
        el("p", { text: drill.prompt }),
        el("div", { class: "tb-options" }, buttons),
        reveal,
      ]);
    });
    updateTotal();
    return sectionBlock("练习题 · 先作答再看解析", [total, el("div", { class: "drill-grid tb-drill-grid" }, cards), el("button", { class: "quiet-button", type: "button", onclick: () => { state.drillScores = {}; openChapter("practice"); } }, "重新作答")], "tb-widget");
  }

  function appendixWidget() {
    const verifyList = el("ul", { class: "tb-points" }, state.book.verify.map((item) => el("li", {}, [verifyBadge(), " ", item.text, " ", refChip(item.ref)])));
    if (config.standalone) {
      return [sectionBlock(`待核对条目（${state.book.verify.length}）`, verifyList), sectionBlock("视频清单", videoTable())];
    }
    const mine = el("div", { class: "tb-mydata" }, el("p", { class: "tb-muted", text: "正在读取你的奥马哈数据…" }));
    fetch("/api/plo").then((response) => response.json()).then((data) => {
      const number = (value) => Number(value).toLocaleString("zh-CN");
      const pct = (value) => (value === null || value === undefined ? "—" : `${value}%`);
      const bb = data.bb_vs_raise;
      const sb = data.sb_unopened;
      const rows = [
        ["样本", `${number(data.coverage.hands)} 手，${(data.coverage.first || "—").slice(0, 10)} 至 ${(data.coverage.last || "—").slice(0, 10)}`, "PLO 波动大，BB/100 不作结论"],
        ["小盲无人入池", `加注 ${sb.raises}、平跟 ${sb.calls}、弃牌 ${sb.folds}（共 ${sb.spots} 次）`, "教材：常规桌只有满池开池或弃牌，不 limp"],
        ["大盲面对单次开池", `3-bet ${bb.raises}/${bb.spots}（${pct(bb.raise_rate)}），跟注 ${bb.calls}，弃牌 ${bb.folds}`, "教材：BB 对 BTN 约 37% 防守、其中 9.5% 3-bet；没位置时 3-bet 用线性范围"],
        ["顶级结构在 BB", `AA/KK/A 双同花 ${data.bb_premium_vs_raise.spots} 次，3-bet ${data.bb_premium_vs_raise.raises} 次`, "教材：AA 在必定 3-bet 列表里（差彩虹 AA 除外）"],
        ["各位置开池（RFI）", Object.entries(data.positions).filter(([, row]) => row.rfi !== null).map(([position, row]) => `${position} ${pct(row.rfi)}`).join(" · "), "教材常规桌：UTG 18 · MP 23 · CO 31 · BTN 49 · SB 38"],
      ];
      mine.replaceChildren(el("div", { class: "table-wrap" }, el("table", { class: "tb-compare" }, [
        el("thead", {}, el("tr", {}, ["项目", "你的数据", "对照教材"].map((text) => el("th", { text })))),
        el("tbody", {}, rows.map((row) => el("tr", {}, row.map((text) => el("td", { text }))))),
      ])));
    }).catch(() => mine.replaceChildren(el("p", { class: "tb-warn", text: "无法读取 /api/plo；在本机服务上打开页面才有个人数据。" })));
    return [sectionBlock("你的奥马哈数据 × 教材", mine, "tb-widget"), sectionBlock(`待核对条目（${state.book.verify.length}）`, verifyList), sectionBlock("视频清单", videoTable())];
  }

  function videoTable() {
    return el("div", { class: "table-wrap" }, el("table", { class: "tb-videos" }, [
      el("thead", {}, el("tr", {}, ["编号", "系列", "标题", "发布", "时长", "来源"].map((text) => el("th", { text })))),
      el("tbody", {}, state.book.videos.map((video) => el("tr", {}, [
        el("td", { text: video.id }), el("td", { text: video.series }),
        el("td", {}, el("a", { href: `https://www.bilibili.com/video/${video.bv}/`, target: "_blank", rel: "noopener noreferrer" }, video.title)),
        el("td", { text: video.date }), el("td", { text: video.duration }), el("td", { text: video.source }),
      ]))),
    ]));
  }

  const WIDGETS = { classifier: classifierWidget, ranges: rangesWidget, positions: positionsWidget, flop: flopWidget, bubble: bubbleWidget, drills: drillsWidget, appendix: appendixWidget };

  // ---------- page ----------
  function openChapter(id, scrollTarget) {
    state.chapter = id;
    render();
    const target = scrollTarget ? root.querySelector(`.${scrollTarget}`) : root.querySelector(".tb-content");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function render() {
    const book = state.book;
    const chapters = book.chapters;
    const index = chapters.findIndex((chapter) => chapter.id === state.chapter);
    const chapter = chapters[index];
    const nav = el("nav", { class: "tb-nav", "aria-label": "教材章节" }, chapters.map((item) => el("button", {
      type: "button", class: item.id === chapter.id ? "active" : "", "aria-current": item.id === chapter.id ? "page" : null,
      onclick: () => openChapter(item.id),
    }, item.title)));
    const content = el("article", { class: "tb-content panel" }, [
      el("p", { class: "eyebrow", text: `CHAPTER ${String(index).padStart(2, "0")} / ${String(chapters.length - 1).padStart(2, "0")}` }),
      el("h2", { text: chapter.title }),
      chapter.intro ? el("p", { class: "tb-intro", text: config.standalone && chapter.id === "appendix" ? "待核对条目和视频清单。" : chapter.intro }) : null,
    ]);
    if (chapter.widget && WIDGETS[chapter.widget]) {
      const widget = WIDGETS[chapter.widget]();
      [].concat(widget).forEach((node) => {
        if (chapter.widget === "ranges") node.classList.add("tb-ranges");
        content.append(node);
      });
    }
    chapter.sections.forEach((section) => content.append(sectionBlock(section.title, el("ul", { class: "tb-points" }, section.points.map((point) => el("li", {}, [
      point.text, point.verify ? [" ", verifyBadge()] : null, " ", ...(point.refs || []).map(refChip),
    ].flat()))))));
    content.append(el("div", { class: "tb-pager" }, [
      index > 0 ? el("button", { class: "quiet-button", type: "button", onclick: () => openChapter(chapters[index - 1].id) }, `← ${chapters[index - 1].title}`) : el("span"),
      index < chapters.length - 1 ? el("button", { type: "button", onclick: () => openChapter(chapters[index + 1].id) }, `${chapters[index + 1].title} →`) : el("span"),
    ]));
    const header = el("header", { class: "tb-header" }, [
      el("div", {}, [
        el("p", { class: "eyebrow", text: "PLO STUDY TEXTBOOK" }),
        el("h2", { text: book.meta.title }),
        el("p", { class: "subhead", text: book.meta.subtitle }),
      ]),
      el("p", { class: "tb-disclaimer" }, [book.meta.disclaimer, " ", el("a", { href: book.meta.source, target: "_blank", rel: "noopener noreferrer" }, "原账号主页 ↗"), ` · 更新于 ${book.meta.updated}`]),
    ]);
    root.replaceChildren(header, el("div", { class: "tb-layout" }, [nav, content]));
  }

  async function load() {
    if (state.book) return;
    try {
      const response = await fetch(config.dataUrl);
      if (!response.ok) throw new Error("无法读取奥马哈教材");
      state.book = await response.json();
      render();
    } catch (error) {
      root.replaceChildren(el("p", { class: "tb-warn", text: error.message }));
    }
  }

  function showPage(page) {
    const textbook = page === "plo-textbook";
    library.hidden = textbook;
    root.hidden = !textbook;
    tabs.forEach((tab) => {
      const active = tab.dataset.kpage === page;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    if (textbook) load();
    if (location.hash !== (textbook ? "#plo-textbook" : "")) history.replaceState(null, "", textbook ? "#plo-textbook" : location.pathname);
  }

  if (config.standalone) {
    load();
    return;
  }
  tabs.forEach((tab) => tab.addEventListener("click", () => showPage(tab.dataset.kpage)));
  if (location.hash === "#plo-textbook") {
    if (typeof switchView === "function") switchView("knowledge");
    showPage("plo-textbook");
  }
})();
