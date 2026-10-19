// Four-card Omaha starting-hand classifier used by the textbook page; mirrors the lesson's lookup tables.
(function (root) {
  const RANKS = "23456789TJQKA";
  const SUITS = "shdc";

  function parseHand(text) {
    const compact = String(text || "").replace(/[\s,，]/g, "")
      .replace(/10/g, "T").replace(/♠/g, "s").replace(/♥/g, "h").replace(/♦/g, "d").replace(/♣/g, "c");
    if (compact.length !== 8) throw new Error("请输入 4 张牌，例如 AsKh9s8h");
    const cards = [];
    for (let index = 0; index < 8; index += 2) {
      const rank = compact[index].toUpperCase();
      const suit = compact[index + 1].toLowerCase();
      if (!RANKS.includes(rank) || !SUITS.includes(suit)) throw new Error(`无法识别 ${compact.slice(index, index + 2)}`);
      cards.push(rank + suit);
    }
    if (new Set(cards).size !== 4) throw new Error("有重复的牌");
    return cards;
  }

  function suitClass(cards) {
    const counts = {};
    cards.forEach((card) => { counts[card[1]] = (counts[card[1]] || 0) + 1; });
    const shape = Object.values(counts).sort((a, b) => b - a).join("");
    return { "22": "ds", "211": "ss", "31": "ts", "4": "mt", "1111": "rb" }[shape];
  }

  // Rundowns: 0g = four in a row, 1g = one missing rank, 2g = one two-rank hole (as in the table's examples).
  function rundown(values) {
    const options = [values];
    if (values.includes(14)) options.push(values.map((value) => (value === 14 ? 1 : value)));
    let best = null;
    options.forEach((option) => {
      const sorted = [...option].sort((a, b) => a - b);
      const holes = [];
      for (let index = 1; index < 4; index += 1) {
        const gap = sorted[index] - sorted[index - 1] - 1;
        if (gap > 0) holes.push(gap);
      }
      let label = null;
      if (!holes.length) label = "0g";
      else if (holes.length === 1 && holes[0] === 1) label = "1g";
      else if (holes.length === 1 && holes[0] === 2) label = "2g";
      if (label && (!best || label < best)) best = label;
    });
    return best;
  }

  function category(cards) {
    const values = cards.map((card) => RANKS.indexOf(card[0]) + 2);
    const counts = {};
    values.forEach((value) => { counts[value] = (counts[value] || 0) + 1; });
    const paired = Object.keys(counts).map(Number).filter((value) => counts[value] >= 2).sort((a, b) => b - a);
    if (paired.length) {
      const top = paired[0];
      const name = { 14: "AA", 13: "KK", 12: "QQ", 11: "JJ", 10: "TT" }[top] || (top >= 6 ? "99-66" : "55-22");
      return { row: name, trips: counts[top] >= 3, twoPair: paired.length > 1 };
    }
    const run = rundown(values);
    if (run) return { row: run };
    if (values.includes(14)) {
      const rest = values.filter((value) => value !== 14);
      const within = (low, high) => rest.filter((value) => value >= low && value <= high).length >= 2;
      if (within(10, 13)) return { row: "A大大" };
      if (within(6, 9)) return { row: "A中中" };
      if (within(2, 5)) return { row: "A小小" };
      return { row: "其他A" };
    }
    return { row: "其他" };
  }

  function classify(text, ranges) {
    const cards = parseHand(text);
    const suits = suitClass(cards);
    const kind = category(cards);
    const column = suits === "ds" ? "ds" : suits === "ss" ? "ss" : "r";
    const lookups = {};
    if (ranges) {
      ["top20", "top30"].forEach((key) => {
        const cell = ranges[key].cells[kind.row];
        const [percent, threshold] = cell[column];
        lookups[key] = { percent, threshold };
      });
    }
    return { cards, suitClass: suits, column, row: kind.row, trips: Boolean(kind.trips), twoPair: Boolean(kind.twoPair), lookups };
  }

  function advice(percent) {
    if (percent === null || percent === undefined) return "这一格比例看不清，待核对";
    if (percent >= 100) return "这一类全部开池";
    if (percent <= 0) return "这一类全部弃牌";
    return `这一类只开 ${percent}%：和门槛牌比较结构与大小，比门槛好才开池`;
  }

  root.PloClassifier = { parseHand, suitClass, rundown, category, classify, advice };
})(typeof window !== "undefined" ? window : this);
