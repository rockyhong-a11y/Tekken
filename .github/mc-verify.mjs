import fs from 'fs';

// Mirror of index.html's parseMetacriticApiJson + key extraction, run on a
// GitHub Actions runner (open internet) to verify live fetching works.
const KEY_DEFAULT = '1MOZgmNFxvmljaQR1X9KAij9Mo4xAY3u';
const TYPE = { game: 13, movie: 2, tv: 1 };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function getKey() {
  try {
    const r = await fetch('https://www.metacritic.com/', { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const h = await r.text();
      const m = h.match(/apiKey=([A-Za-z0-9]{16,})/);
      if (m) return { key: m[1], source: 'homepage' };
    }
  } catch (_) {}
  return { key: KEY_DEFAULT, source: 'default' };
}

function parse(text, queryTitle, typeId) {
  const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9가-힣 ]+/gi, '').replace(/\s+/g, ' ').trim();
  const qn = normalize(queryTitle);
  const tq = (ct) => { if (!ct) return 0; if (ct === qn) return 100; if (ct.startsWith(qn) || qn.startsWith(ct)) return 85; if (ct.includes(qn)) return 70; if (qn.includes(ct)) return 60; const a = new Set(qn.split(' ').filter(Boolean)); const b = new Set(ct.split(' ').filter(Boolean)); const inter = [...a].filter((w) => b.has(w)).length; return Math.round(inter / Math.max(a.size, b.size, 1) * 50); };
  try {
    let t = (text || '').trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) t = fence[1];
    const data = JSON.parse(t);
    const comp = (data.components || []).find((c) => c && c.meta && c.meta.componentName === 'search');
    const items = comp && comp.data && Array.isArray(comp.data.items) ? comp.data.items : null;
    if (!items) return null;
    let best = null;
    for (const it of items) {
      if (typeId && it.typeId && it.typeId !== typeId) continue;
      const score = it.criticScoreSummary && it.criticScoreSummary.score;
      if (typeof score !== 'number' || score <= 0 || score > 100) continue;
      const q = tq(normalize(it.title));
      if (!best || q > best.q) best = { score: Math.round(score), q };
    }
    return best && best.q >= 35 ? best.score : null;
  } catch (_) { return null; }
}

const { key, source } = await getKey();
const out = { ranAt: new Date().toISOString(), apiKeySource: source, results: [] };
const tests = [['Elden Ring', 'game'], ['The Legend of Zelda: Breath of the Wild', 'game'], ['Breaking Bad', 'tv'], ['The Batman', 'movie']];
for (const [title, cat] of tests) {
  const url = `https://backend.metacritic.com/composer/metacritic/pages/search/${encodeURIComponent(title)}/web?apiKey=${key}&mcoTypeId=${TYPE[cat]}`;
  let status = null, score = null, err = null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://www.metacritic.com/' } });
    status = r.status;
    if (r.ok) score = parse(await r.text(), title, TYPE[cat]);
  } catch (e) { err = String(e && e.message || e); }
  out.results.push({ title, cat, status, score, err });
  console.log(`${title} [${cat}] -> status=${status} score=${score} ${err ? 'err=' + err : ''}`);
}
fs.writeFileSync('mc-verify-result.json', JSON.stringify(out, null, 2));
console.log('\n' + JSON.stringify(out, null, 2));
