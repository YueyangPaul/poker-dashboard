// Detailed cash course, with source-page diagrams and offline study tools.
(function () {
  const root = document.querySelector("#cash-textbook");
  if (!root) return;
  const state = { book: null, chapter: "mix-decisions", group: 3, query: "", answers: {}, read: new Set() };
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
  const block = (title, children) => el("section", { class: "tb-block" }, [el("h3", { text: title }), ...[].concat(children)]);
  function teachingTable(table) {
    return block(table.title, [el("div", { class: "table-wrap" }, el("table", { class: "cash-teaching-table" }, [
      el("thead", {}, el("tr", {}, table.columns.map((title) => el("th", { scope: "col", text: title })))),
      el("tbody", {}, table.rows.map((row) => el("tr", {}, row.map((text) => el("td", { text }))))),
    ])), el("p", { class: "tb-note", text: table.note }), null]);
  }
  function open(id) {
    state.chapter = id; state.query = "";
    const course = state.book.chapters.find(c => c.id === id);
    if (course && course.grade) state.group = course.grade <= 2 ? 1 : course.grade <= 4 ? 3 : course.grade <= 6 ? 5 : 7;
    render();
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
      output,
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
      return el("section", { class: "tb-block cash-quiz" }, [el("h3", { text: `${d.id} · ${d.question}` }), choices, feedback, null]);
    });
    update();
    return [tally, ...cards, el("button", { type: "button", class: "quiet-button", onclick: () => { state.answers = {}; render(); } }, "重新练习")];
  }
  function ruleCard(rule) {
    return el("details", { class: "cash-rule" }, [
      el("summary", { text: `${rule.id} · ${rule.title}` }),
      el("p", {}, [el("strong", { text: "候选问题：" }), rule.signal]),
      el("p", {}, [el("strong", { text: "所需证据：" }), rule.evidence]),
      el("p", { class: "tb-note", text: `${rule.scope}。${rule.verdict}。` }), null,
      el("button", { type: "button", class: "quiet-button", onclick: () => open(rule.chapter) }, "回到本课"),
    ]);
  }
  function cards(values) {
    return el("div", { class: "lab-cards" }, values.map(value => el("span", { class: `lab-card ${/[hd]$/.test(value) ? "red" : ""}` }, value.slice(0,-1) + {s:"♠",h:"♥",d:"♦",c:"♣"}[value.slice(-1)])));
  }
  function scenarioLab(lesson) {
    let index = 0;
    const scene = el("div");
    const chooser = el("div", { class: "lab-segment" });
    const draw = () => {
      const item = lesson.examples[index];
      chooser.replaceChildren(...lesson.examples.map((_,i) => el("button", { type:"button", "aria-pressed":String(index===i), onclick:()=>{index=i;draw();} }, i===0 ? "先做这个决定" : "换一个条件")));
      const feedback=el("div", {class:"lab-feedback", "aria-live":"polite"});
      const choices=el("div",{class:"lab-choices"});
      choices.append(...item.options.map((option,i)=>el("button",{type:"button",class:"quiet-button",onclick:()=>{
        choices.querySelectorAll('button').forEach((button,j)=>button.setAttribute('aria-pressed',String(j===i)));
        feedback.replaceChildren(el("strong",{text:i===item.correct ? "这个思路更合适" : "试着换一个观察角度"}),el("p",{text:item.feedback}));
      }},option)));
      scene.replaceChildren(el("div",{class:"lab-table"},[el("small",{text:"教学情境 · 用来比较推理，不是精确求解结果"}),el("p",{text:"公共牌"}),cards(item.board),el("p",{text:"你的手牌"}),cards(item.hand)]),el("p",{class:"lab-scene",text:item.scene}),choices,feedback);
    };
    draw();return el("div",{class:"lab-scenario"},[chooser,scene]);
  }
  function experiment(mode) {
    const controls=el("div",{class:"lab-controls"}); const out=el("div",{"aria-live":"polite"});
    const slider=(label,min,max,value,change)=>{
      const number=el("strong",{text:String(value)});
      const input=el("input",{type:"range",min,max,value,"aria-label":label,oninput:e=>{number.textContent=e.target.value;change(Number(e.target.value));}});
      controls.append(el("label",{},[el("span",{},[label," ",number]),input]));
    };
    const bar=(title,value,max=100)=>el("div",{class:"lab-bar-row"},[el("span",{text:title}),el("div",{class:"lab-bar-track"},el("i",{style:`width:${Math.min(100,Math.max(0,value/max*100))}%`})),el("strong",{text:value.toFixed(1)})]);
    let title,note;
    if(mode==="mix") {
      title="只有动作价值接近，混合才有意义";
      note="玩具模型：动作A的EV为1，动作B可以与它等价，也可以略差。固定对手策略，只观察改变频率怎样影响平均结果；不模拟对手之后的反制。";
      let frequency=50,equal=true;
      const draw=()=>{const alternative=equal?1:0.8;const total=frequency/100+(1-frequency/100)*alternative;out.replaceChildren(bar('动作A频率 %',frequency),bar('动作B频率 %',100-frequency),el('p',{class:'lab-insight',text:`平均EV ${total.toFixed(3)}。${equal?'两条线等价，调整比例不会凭空提高单手牌EV；频率仍影响对手能否读懂整体范围。':'动作B明确更差时，随机加入它会降低这个固定对手模型的EV。先判断价值，再决定是否混合。'}`}));};
      controls.append(el('button',{type:'button',class:'quiet-button',onclick:e=>{equal=!equal;e.target.textContent=equal?'当前：动作等价 · 点击改变':'当前：动作B略差 · 点击改变';draw();}},'当前：动作等价 · 点击改变'));
      slider('动作A使用频率 %',0,100,frequency,v=>{frequency=v;draw();});draw();
    } else if(mode==="survival") {
      title="把100份起始范围，一街一街筛过去";
      note="每个弃牌率的分母，都是上一街继续的部分。这里只演示条件比例；实际牌族还会被跑牌、位置和行动方式重新排序。";
      const rates=[40,40,50];const draw=()=>{let remain=100;const nodes=rates.map((rate,i)=>{remain*=1-rate/100;return bar(['翻牌后剩余','转牌后剩余','河牌后剩余'][i],remain);});out.replaceChildren(...nodes,el('p',{class:'lab-insight',text:`最初100份，最终剩 ${remain.toFixed(1)} 份。条件弃牌率不能直接相加；同样的幸存数量，也不代表保留下来的价值与诈唬组成相同。`}));};
      rates.forEach((r,i)=>slider(['翻牌条件弃牌率 %','转牌条件弃牌率 %','河牌条件弃牌率 %'][i],0,100,r,v=>{rates[i]=v;draw();}));draw();
    } else if(mode==="elastic") {
      title="多冒风险，是否换来了足够多的弃牌？";
      note="示意反应曲线，不是玩家池统计：底池100，按你设定的基础倾向与敏感程度计算各尺度弃牌率。纯诈唬被跟必输；坚果总领先，只比较额外支付，无加注。";
      let base=35,sensitivity=35,value=false;
      const draw=()=>{const rows=[10,33,75,150,400].map(size=>{const f=Math.min(.99,Math.max(0,base/100+sensitivity/100*Math.log(1+size/100)));return {size,f,ev:value?(1-f)*size:f*100-(1-f)*size};});const best=rows.reduce((a,b)=>a.ev>b.ev?a:b);out.replaceChildren(...rows.map(r=>bar(`${r.size}% · 弃${(r.f*100).toFixed(0)}%`,r.ev,Math.max(100,...rows.map(item=>item.ev)))),el('p',{class:'lab-insight',text:`当前曲线下，这五个尺度中${best.size}%的${value?'额外价值':'纯诈唬EV'}最高，为 ${best.ev.toFixed(2)}。${value?'支付次数少，不一定比支付幅度小更差。':'最高也可能仍是负数，不能省略过牌这个选项。'} 曲线输入是假设，结论不能直接搬到真实手牌。`}));};
      controls.append(el('button',{type:'button',class:'quiet-button',onclick:e=>{value=!value;e.target.textContent=value?'当前：坚果取值 · 点击切换':'当前：纯诈唬 · 点击切换';draw();}},'当前：纯诈唬 · 点击切换'));
      slider('基础弃牌倾向 %',0,80,base,v=>{base=v;draw();});slider('对尺度的敏感程度',0,60,sensitivity,v=>{sensitivity=v;draw();});draw();
    } else if(mode==="raise") {
      title="加注投入多少，争取的底池又是多少？";
      note="底池100，对手已下注50，你尚未在本街投入。加注到R：现在风险为R，对手弃牌赢150。被跟后按直接摊牌处理，无抽水、再加注与未来下注；胜率只针对加注后的继续范围。";
      let raise=150,fold=50,equity=20;const draw=()=>{const threshold=raise/(150+raise)*100;const ev=fold/100*150+(1-fold/100)*(equity/100*(100+2*raise)-raise);out.replaceChildren(bar('纯诈唬所需弃牌率 %',threshold),bar('假设实际弃牌率 %',fold),el('p',{class:'lab-insight',text:`加注EV ${ev.toFixed(2)}。被跟后的胜率为${equity}%，所以这不是只靠弃牌的模型。先区分总加注额、对手已下注额和当前底池；这个结果没有计算跟注替代方案，不能直接当作加注建议。`}));};
      slider('加注到 R',100,400,raise,v=>{raise=v;draw();});slider('对手面对加注弃牌率 %',0,100,fold,v=>{fold=v;draw();});slider('被跟后的胜率 %',0,100,equity,v=>{equity=v;draw();});draw();
    } else
 if(mode==="range") {
      title="让一次行动，改变整个范围";
      note="这里只示意强、中、弱三段如何重新分布；比例不是任何牌面的求解结果。留意“中间更密”和“强端更多”的区别。";
      const states=[['尚未筛选',[25,45,30],'强中弱都存在，不能一看到过牌就删掉强端。'],['跟过一次下注',[20,65,15],'弱端被移走，中间更密：整体未必弱，强端却可能受限。'],['选择大额下注',[45,10,45],'中间变少，强牌和诈唬突出：这是极化，不是所有牌都变强。'],['选择随后过牌',[15,70,15],'部分强牌和空气都离开，中段更密：这是紧缩，仍保留一定强牌。']];
      const draw=i=>{const [,values,reason]=states[i];out.replaceChildren(...values.map((v,j)=>bar(['强牌区域','中间区域','弱牌区域'][j],v)),el('p',{class:'lab-insight',text:reason}));controls.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-pressed',String(i===j)));};
      controls.append(...states.map(([name],i)=>el('button',{type:'button',class:'quiet-button',onclick:()=>draw(i)},name)));draw(0);
    } else if(mode==="growth") {
      title="三条街，底池会长到多大？";
      note="双方都跟注的教学模型：起始底池20、剩余有效筹码100；每街按同一比例下注，投入不超过剩余筹码。先观察尺度，再考虑现实中哪些牌会支付。";
      let size=50;const draw=()=>{let pot=20,stack=100;const rows=[];for(const street of ['翻牌','转牌','河牌']){const bet=Math.min(stack,pot*size/100);stack-=bet;pot+=2*bet;rows.push(bar(`${street}后底池`,pot,220));}out.replaceChildren(...rows,el('p',{class:'lab-insight',text:`剩余有效筹码 ${stack.toFixed(1)}。${stack===0?'已到投入上限；后续不能再加大。':'这就是等待或小注可能留下的未完成投入。'} 这只比较建池速度，不代表每手牌都该投入这么多。`}));};
      slider('每街下注占底池 %',25,150,size,v=>{size=v;draw();});draw();
    } else if(mode==="odds") {
      title="价格变了，你的跟注门槛怎么变？";
      note="河牌单挑、跟注后直接摊牌，无抽水和平分；胜率指对下注范围的胜率。早期街不能直接套用这个终局模型。";
      let size=50,equity=30;const draw=()=>{const needed=size/(100+size*2)*100;const ev=equity/100*(100+size*2)-size;out.replaceChildren(bar('所需胜率 %',needed),bar('你估计的胜率 %',equity),el('p',{class:'lab-insight',text:`跟注EV ${ev.toFixed(2)}；弃牌EV为0。${ev>0?'在这些假设下，跟注更有利。':ev<0?'在这些假设下，弃牌更有利。':'刚好位于无差别点。'} 多数时候会输，并不能单独决定是否跟注。`}));};
      slider('对手下注占底池 %',25,200,size,v=>{size=v;draw();});slider('对下注范围的胜率 %',0,100,equity,v=>{equity=v;draw();});draw();
    } else if(mode==="value") {
      title="被跟得多，和被跟时领先，是两回事";note="河牌终局模型：底池100、下注75，无加注和平分。独立调整被跟概率与被跟后胜率，观察总EV；实际两个输入常随尺度一起变化。";
      let call=50,equity=40;const draw=()=>{const ev=(1-call/100)*100+call/100*(equity/100*250-75);out.replaceChildren(bar('被跟后胜率 %',equity),el('p',{class:'lab-insight',text:`下注总EV ${ev.toFixed(2)}。其中，被跟分支的净期望为 ${(equity/100*250-75).toFixed(2)}。下注总EV还包含弃牌收益，不能只因总数为正就称它为价值下注，更要与过牌比较。`}));};
      slider('被跟概率 %',10,100,call,v=>{call=v;draw();});slider('被跟后的胜率 %',0,100,equity,v=>{equity=v;draw();});draw();
    } else {
      title="拖动弃牌率，看下注与过牌谁更赚";note="底池100、下注75；被跟时必输，无加注。过牌能直接摊牌，胜率可独立调整。负值表示从当前决策起亏损。";
      let fold=57,showdown=34;const draw=()=>{const bet=fold/100*100-(1-fold/100)*75;out.replaceChildren(bar('下注EV',bet,100),bar('过牌EV',showdown,100),el('p',{class:'lab-insight',text:`下注 ${bet.toFixed(2)}，过牌 ${showdown.toFixed(2)}，差额 ${(bet-showdown).toFixed(2)}。${bet>showdown?'当前模型支持下注。':'当前模型更支持过牌。'} 改一改摊牌概率，看看结论何时翻转。`}));};
      slider('对手弃牌率 %',0,100,fold,v=>{fold=v;draw();});slider('过牌赢池概率 %',0,100,showdown,v=>{showdown=v;draw();});draw();
    }
    return el('section',{class:'lab-experiment'},[el('h3',{text:title}),el('p',{class:'lab-model-note',text:note}),controls,out]);
  }
  function renderLesson(body,c) {
    const l=c.learning;let stage=0;
    const stageNav=el('nav',{class:'lab-stages','aria-label':'学习步骤'});const content=el('div',{class:'lab-stage-content'});
    const draw=()=>{
      stageNav.replaceChildren(...['讲透原理','动手实验','情境练习','知识详解'].map((name,i)=>el('button',{type:'button','aria-pressed':String(stage===i),onclick:()=>{stage=i;draw();}},`${i+1}. ${name}`)));
      content.replaceChildren();
      if(stage===0){
        content.append(el('p',{class:'lab-lead',text:l.idea}),el('div',{class:'lab-explain-grid'},[block('为什么会这样',el('p',{text:l.why})),block('把它变成判断步骤',el('p',{text:l.method}))]),el('aside',{class:'lab-trap'},[el('strong',{text:'容易掉进去的坑'}),el('p',{text:l.trap})]),block('带着问题看这手牌',[scenarioLab(l)]));
      } else if(stage===1)content.append(experiment(l.mode));
      else if(stage===2)content.append(scenarioLab(l),...quiz(state.book.drills.filter(d=>d.chapter===c.id)));
      else {
        const select=el('select',{'aria-label':'选择深入主题'}); const detail=el('div',{class:'cash-prose'});
        c.sections.forEach((section,i)=>select.append(el('option',{value:i,text:section.title.replace(/^第.+?章[ ·]*/, '')})));
        const show=()=>{const s=c.sections[Number(select.value)];detail.replaceChildren(el('h3',{text:s.title.replace(/^第.+?章[ ·]*/, '')}),...s.points.map(p=>p.kind==='heading'?el('h4',{text:p.text.replace(/^第.+?节[ ·]*/, '')}):el('p',{text:p.text})));};
        select.addEventListener('change',show);show();content.append(el('label',{class:'lab-topic'},['选择一个主题深入理解',select]),detail,...(c.tables||[]).map(teachingTable));
      }
      if(stage<3)content.append(el('button',{type:'button',class:'lab-next',onclick:()=>{stage++;draw();content.scrollIntoView({behavior:'smooth',block:'start'});}},['开始动手实验 →','换个情境检验 →','继续查看知识详解 →'][stage]));
    };
    body.append(el('p',{class:'lab-kicker',text:'理解一个问题，再把它用到牌桌上'}),stageNav,content);
    draw();
    const done=el('button',{type:'button',class:'quiet-button',onclick:()=>{
      if(state.read.has(c.id))state.read.delete(c.id);else state.read.add(c.id);
      try{localStorage.setItem('cash-textbook-read',JSON.stringify([...state.read]));}catch(_){}
      done.textContent=state.read.has(c.id)?'✓ 已学完 · 点击取消':'标记本课已学完';
    }},state.read.has(c.id)?'✓ 已学完 · 点击取消':'标记本课已学完');
    const lessons=state.book.chapters.filter(c=>c.learning);const i=lessons.indexOf(c);
    body.append(el('footer',{class:'lab-lesson-footer'},[done,i<lessons.length-1?el('button',{type:'button',onclick:()=>open(lessons[i+1].id)},'下一课 →'):el('span',{text:'已到最后一课，回练习页检验掌握情况。'})]));
  }

  function renderBody(body) {
    const book = state.book;
    if (state.query) {
      const q = state.query.toLowerCase();
      const hits = book.chapters.filter((c) => JSON.stringify(c).toLowerCase().includes(q));
      body.replaceChildren(el("h2", { text: `查找“${state.query}” · ${hits.length} 章` }), ...hits.map((c) => block(c.title, [
        el("p", { text: c.learning ? c.learning.question : "选择本课继续" }), ...c.sections.flatMap((s) => s.points.filter((p) => p.kind !== "heading" && p.text.toLowerCase().includes(q))).slice(0,3).map((p) => el("p", {text:p.text})),
        el("button", { type: "button", class: "quiet-button", onclick: () => open(c.id) }, "阅读本章"),
      ])));
      if (!hits.length) body.append(el("p", { text: "没有匹配章节，可试试“阻挡”“紧缩”或“跟注”。" }));
      return;
    }
    const index = book.chapters.findIndex((c) => c.id === state.chapter);
    const c = book.chapters[index];
    body.replaceChildren(el("p", { class: "eyebrow", text: c.grade ? `YEAR ${c.grade} / CASH STUDY` : "STUDY DESK" }), el("h2", { text: c.title }), el("p", { class: "tb-intro", text: c.learning ? c.learning.question : "选择一个问题，开始练习。" }));
    if (c.grade) { renderLesson(body, c); return; }
    c.sections.forEach((section, i) => {
      const content = c.grade ? section.points.map((p) => p.kind === "heading"
        ? el("h4", { text: p.text }) : el("p", {}, [p.text, " ", null]))
        : [el("ul", { class: "tb-points" }, section.points.map((p) => el("li", {}, [p.text, " ", null])))];
      const node = block(section.title, content); node.id = `cash-unit-${i}`;
      if (c.grade) node.classList.add("cash-prose");
      body.append(node);
    });
    if (c.id === "guide") body.append(block("从你的困惑开始", el("div", { class: "cash-route-grid" }, visibleCourses().map(c => el("button", { type: "button", class: "quiet-button", onclick: () => open(c.id) }, c.learning.question)))));
    if (c.id === "tools") body.append(tools());
    if (c.id === "practice") body.append(...quiz(book.drills.filter(d => visibleCourses().some(c => c.id === d.chapter))));
    if (c.id === "review") body.append(block("复盘步骤", [el("p", { text: "核对完整牌谱 → 匹配位置、筹码、抽水与行动线 → 引用规则及页码 → 解释更好的替代行动 → 按重复模式聚合。" }), el("p", { class: "tb-note", text: "标签使用：符合教材原则 / 候选漏洞 / 有依据的剥削偏离 / 证据不足。数据库不保留完整翻后牌谱，翻后判断需要原始记录；未摊牌也可评估决策理由，不能编造对手底牌。" })]), ...book.rules.map(ruleCard));
    body.append(el("div", { class: "tb-pager" }, [index > 0 ? el("button", { type: "button", class: "quiet-button", onclick: () => open(book.chapters[index - 1].id) }, "← 上一章") : el("span"), index < book.chapters.length - 1 ? el("button", { type: "button", onclick: () => open(book.chapters[index + 1].id) }, "下一章 →") : el("span")]));
  }
  function visibleCourses() {
    return state.book.chapters.filter(c => c.grade && (state.group === 7 ? c.grade === 7 : c.grade >= state.group && c.grade <= state.group + 1));
  }
  function render() {
    const book = state.book;
    const body = el("article", { class: "tb-content panel" });
    const search = el("input", { type: "search", placeholder: "搜索章节与原则，例如：阻挡、超池、跟注", "aria-label": "搜索现金桌教材", value: state.query, oninput: (event) => { state.query = event.target.value.trim(); renderBody(body); } });
    const count = book.chapters.filter((c) => c.grade && state.read.has(c.id)).length;
    const group = el("select", {"aria-label":"课程阶段", onchange:event=>{
      state.group=Number(event.target.value); state.query=""; state.chapter=visibleCourses()[0].id; render();
    }});
    [[1,"基础 · 1–2年级"],[3,"进阶 · 3–4年级"],[5,"剥削 · 5–6年级"],[7,"策略工具箱 · 7年级"]].forEach(([value,label])=>{
      const option=el("option",{value,text:label}); option.selected=value===state.group; group.append(option);
    });
    const navCourses = book.chapters.filter(c=>!c.grade).slice(0,1).concat(visibleCourses(),book.chapters.filter(c=>!c.grade).slice(1));
    root.replaceChildren(el("header", { class: "tb-header" }, [el("div", {}, [el("p", { class: "eyebrow", text: "NLHE CASH / CARROT STUDY NOTES" }), el("h2", { text: book.meta.title }), el("p", { class: "subhead", text: book.meta.subtitle })]), null]), el("div", { class: "cash-study-toolbar" }, [group, search, el("span", { text: `已读 ${count}/${book.meta.lesson_count} 课 · 进度保存在此浏览器` })]), el("div", { class: "tb-layout" }, [el("nav", { class: "tb-nav", "aria-label": "现金桌教材章节" }, navCourses.map((c) => el("button", { type: "button", class: c.id === state.chapter ? "active" : "", "aria-current": c.id === state.chapter ? "page" : "false", onclick: () => open(c.id) }, `${state.read.has(c.id) ? "✓ " : ""}${c.title}`))), body]));
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
