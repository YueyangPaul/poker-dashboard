// Only loaded in the exported read-only snapshot: answers /api/* requests from pre-built JSON files.
(function () {
  const realFetch = window.fetch.bind(window);
  const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
  const contains = (value, needle) => String(value || "").toLowerCase().includes(needle);

  function filterKnowledge(data, params) {
    const creator = params.get("creator");
    const topic = params.get("topic");
    const q = (params.get("q") || "").toLowerCase();
    const cards = data.cards.filter((card) => (!creator || card.creator === creator) && (!topic || card.topic_key === topic)
      && (!q || ["title", "summary", "tags", "topic_key", "creator", "source_title"].some((key) => contains(card[key], q))));
    const pending = topic ? [] : data.pending_sources.filter((source) => (!creator || source.creator === creator)
      && (!q || ["title", "creator", "content_type"].some((key) => contains(source[key], q))));
    return { ...data, cards, pending_sources: pending, counts: { cards: cards.length, pending_sources: pending.length } };
  }

  window.fetch = async function (input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    const at = url.pathname.indexOf("/api/");
    if (at === -1) return realFetch(input, init);
    const path = url.pathname.slice(at + 5);
    if ((init.method || "GET").toUpperCase() !== "GET") return json({ error: "这是只读的公开快照，不能保存或刷新；请在本机服务上操作。" }, 403);
    const load = (file) => realFetch(new URL(`api/${file}`, document.baseURI)).then((response) => response.json());
    if (path === "dashboard") {
      return json(await load(`dashboard/${url.searchParams.get("window") || "all"}__${url.searchParams.get("stake") || "all"}.json`));
    }
    if (path === "knowledge") return json(filterKnowledge(await load(`knowledge/${url.searchParams.get("domain") || "CASH"}.json`), url.searchParams));
    return json(await load(`${path}.json`));
  };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("#from-filter, #to-filter").forEach((input) => { input.disabled = true; input.title = "公开快照不支持按日期筛选"; });
    const badge = document.querySelector(".local-badge");
    if (badge) badge.textContent = "只读公开快照";
  });
})();
