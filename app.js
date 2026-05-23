// === Storage keys ===
const KEYS = {
  profiles: 'gametracker:profiles',
  currentProfile: 'gametracker:currentProfile',
  rawgKey: 'gametracker:rawgKey',
  data: (profile) => `gametracker:profile:${profile}`,
};

// === State ===
let state = {
  profiles: [],
  currentProfile: null,
  games: [],
  screenshotsBuffer: [],
};

// === Utilities ===
const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function loadProfiles() {
  const raw = localStorage.getItem(KEYS.profiles);
  return raw ? JSON.parse(raw) : [];
}

function saveProfiles(list) {
  localStorage.setItem(KEYS.profiles, JSON.stringify(list));
}

function loadGames(profile) {
  if (!profile) return [];
  const raw = localStorage.getItem(KEYS.data(profile));
  return raw ? JSON.parse(raw) : [];
}

function saveGames() {
  if (!state.currentProfile) return;
  localStorage.setItem(KEYS.data(state.currentProfile), JSON.stringify(state.games));
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(s) {
  return (s ?? '').toString().replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function statusLabel(s) {
  return { cleared: '클리어', playing: '플레이 중', planned: '플레이 예정' }[s] || s;
}

// === Profiles ===
function refreshProfileSelect() {
  const sel = $('profileSelect');
  sel.innerHTML = '';
  state.profiles.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    if (p === state.currentProfile) opt.selected = true;
    sel.appendChild(opt);
  });
}

function switchProfile(name) {
  state.currentProfile = name;
  localStorage.setItem(KEYS.currentProfile, name);
  state.games = loadGames(name);
  renderAll();
}

function createProfile(name) {
  name = (name || '').trim();
  if (!name) return;
  if (state.profiles.includes(name)) {
    alert('이미 존재하는 프로필 이름입니다.');
    return;
  }
  state.profiles.push(name);
  saveProfiles(state.profiles);
  refreshProfileSelect();
  switchProfile(name);
}

function deleteCurrentProfile() {
  if (!state.currentProfile) return;
  if (state.profiles.length <= 1) {
    alert('마지막 프로필은 삭제할 수 없습니다.');
    return;
  }
  if (!confirm(`프로필 "${state.currentProfile}" 와 모든 게임 데이터를 삭제할까요?`)) return;
  localStorage.removeItem(KEYS.data(state.currentProfile));
  state.profiles = state.profiles.filter((p) => p !== state.currentProfile);
  saveProfiles(state.profiles);
  refreshProfileSelect();
  switchProfile(state.profiles[0]);
}

// === RAWG lookup ===
async function rawgSearch(query) {
  const key = localStorage.getItem(KEYS.rawgKey);
  if (!key) {
    alert('RAWG API 키가 설정되지 않았습니다.\n설정 패널에서 키를 입력하거나 정보를 직접 입력해주세요.');
    return null;
  }
  const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(query)}&page_size=6`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`RAWG ${res.status}`);
    const json = await res.json();
    return json.results || [];
  } catch (err) {
    alert('RAWG 조회 실패: ' + err.message);
    return null;
  }
}

async function rawgDetail(id) {
  const key = localStorage.getItem(KEYS.rawgKey);
  if (!key) return null;
  try {
    const res = await fetch(`https://api.rawg.io/api/games/${id}?key=${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error(`RAWG ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

function renderLookupResults(results) {
  const box = $('lookupResults');
  box.innerHTML = '';
  if (!results || !results.length) {
    box.innerHTML = '<div class="muted" style="padding:6px">검색 결과 없음</div>';
    return;
  }
  results.forEach((r) => {
    const div = document.createElement('div');
    div.className = 'lookup-result';
    const genres = (r.genres || []).map((g) => g.name).join(', ');
    div.innerHTML = `
      <img src="${r.background_image || ''}" alt="" onerror="this.style.opacity=0.2" />
      <div style="flex:1; min-width:0">
        <strong>${escapeHtml(r.name)}</strong>
        <div class="meta">${escapeHtml(r.released || '')} · ${escapeHtml(genres)}</div>
      </div>
    `;
    div.addEventListener('click', async () => {
      box.innerHTML = '<div class="muted" style="padding:6px">상세 정보 불러오는 중...</div>';
      const detail = await rawgDetail(r.id);
      applyLookupToForm(detail || r);
      box.innerHTML = '';
    });
    box.appendChild(div);
  });
}

function applyLookupToForm(game) {
  $('title').value = game.name || $('title').value;
  $('genres').value = (game.genres || []).map((g) => g.name).join(', ');
  $('released').value = game.released || '';
  const desc = game.description_raw || game.description || '';
  $('description').value = desc.length > 600 ? desc.slice(0, 600) + '…' : desc;
  $('coverImage').value = game.background_image || '';
}

// === Screenshots ===
async function handleScreenshotInput(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await fileToDataURL(file);
    state.screenshotsBuffer.push(dataUrl);
  }
  renderScreenshotPreview();
}

function renderScreenshotPreview() {
  const box = $('screenshotPreview');
  box.innerHTML = '';
  state.screenshotsBuffer.forEach((src, idx) => {
    const t = document.createElement('div');
    t.className = 'thumb';
    t.innerHTML = `<img src="${src}" alt="" /><button type="button" class="remove" data-idx="${idx}">×</button>`;
    box.appendChild(t);
  });
  box.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.screenshotsBuffer.splice(Number(btn.dataset.idx), 1);
      renderScreenshotPreview();
    });
  });
}

// === Form submit ===
function resetForm() {
  $('gameForm').reset();
  $('editingId').value = '';
  $('coverImage').value = '';
  state.screenshotsBuffer = [];
  renderScreenshotPreview();
  $('lookupResults').innerHTML = '';
  $('submitBtn').textContent = '추가';
}

function buildGameFromForm() {
  const id = $('editingId').value || uid();
  const title = $('title').value.trim();
  const genres = $('genres').value.split(',').map((g) => g.trim()).filter(Boolean);
  return {
    id,
    title,
    status: $('status').value,
    platform: $('platform').value,
    genres,
    released: $('released').value.trim(),
    description: $('description').value.trim(),
    note: $('note').value.trim(),
    background_image: $('coverImage').value || '',
    screenshots: state.screenshotsBuffer.slice(),
    createdAt: Date.now(),
  };
}

function submitGame(e) {
  e.preventDefault();
  if (!state.currentProfile) {
    alert('먼저 프로필을 만드세요.');
    return;
  }
  const game = buildGameFromForm();
  if (!game.title || !game.platform) return;

  const editingId = $('editingId').value;
  if (editingId) {
    const idx = state.games.findIndex((g) => g.id === editingId);
    if (idx !== -1) {
      game.createdAt = state.games[idx].createdAt;
      state.games[idx] = game;
    }
  } else {
    state.games.unshift(game);
  }
  saveGames();
  resetForm();
  renderAll();
}

function editGame(id) {
  const g = state.games.find((x) => x.id === id);
  if (!g) return;
  $('editingId').value = g.id;
  $('title').value = g.title;
  $('status').value = g.status;
  $('platform').value = g.platform;
  $('genres').value = (g.genres || []).join(', ');
  $('released').value = g.released || '';
  $('description').value = g.description || '';
  $('note').value = g.note || '';
  $('coverImage').value = g.background_image || '';
  state.screenshotsBuffer = (g.screenshots || []).slice();
  renderScreenshotPreview();
  $('submitBtn').textContent = '수정 저장';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteGame(id) {
  const g = state.games.find((x) => x.id === id);
  if (!g) return;
  if (!confirm(`"${g.title}" 을(를) 삭제할까요?`)) return;
  state.games = state.games.filter((x) => x.id !== id);
  saveGames();
  renderAll();
}

// === Rendering ===
function renderStats() {
  const cleared = state.games.filter((g) => g.status === 'cleared').length;
  const playing = state.games.filter((g) => g.status === 'playing').length;
  const planned = state.games.filter((g) => g.status === 'planned').length;
  $('stats').innerHTML = `
    <span class="stat-pill total">전체 ${state.games.length}</span>
    <span class="stat-pill cleared">클리어 ${cleared}</span>
    <span class="stat-pill playing">플레이 중 ${playing}</span>
    <span class="stat-pill planned">예정 ${planned}</span>
  `;
}

function renderPlatformFilter() {
  const sel = $('filterPlatform');
  const current = sel.value || 'all';
  const platforms = Array.from(new Set(state.games.map((g) => g.platform).filter(Boolean))).sort();
  sel.innerHTML = '<option value="all">전체 플랫폼</option>' +
    platforms.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
  if ([...sel.options].some((o) => o.value === current)) sel.value = current;
}

function filteredGames() {
  const q = $('searchInput').value.toLowerCase().trim();
  const fs = $('filterStatus').value;
  const fp = $('filterPlatform').value;
  return state.games.filter((g) => {
    if (fs !== 'all' && g.status !== fs) return false;
    if (fp !== 'all' && g.platform !== fp) return false;
    if (q) {
      const hay = [g.title, ...(g.genres || []), g.platform, g.note, g.description].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function youtubeSearchUrl(title) {
  const q = encodeURIComponent(`${title} 공략`);
  return `https://www.youtube.com/results?search_query=${q}`;
}

function gameCardHTML(g) {
  const shots = (g.screenshots || []).slice(0, 4).map((s, i) => `<img src="${s}" data-id="${g.id}" data-idx="${i}" class="shot-thumb" alt="" />`).join('');
  const cover = g.background_image
    ? `<div class="cover" style="background-image:url('${g.background_image.replace(/'/g, "\\'")}')"></div>`
    : '';
  const genres = (g.genres || []).map((x) => `<span class="badge">${escapeHtml(x)}</span>`).join('');
  return `
    <article class="game-card status-${g.status}">
      ${cover}
      <div class="body">
        <h3>${escapeHtml(g.title)}</h3>
        <div class="badges">
          <span class="badge status-${g.status}">${statusLabel(g.status)}</span>
          ${g.platform ? `<span class="badge">${escapeHtml(g.platform)}</span>` : ''}
          ${genres}
        </div>
        <div class="info">
          ${g.released ? `📅 ${escapeHtml(g.released)}` : ''}
        </div>
        ${g.description ? `<p class="desc">${escapeHtml(g.description)}</p>` : ''}
        ${g.note ? `<p class="desc" style="color:#cbd0e0">📝 ${escapeHtml(g.note)}</p>` : ''}
        ${shots ? `<div class="shots">${shots}</div>` : ''}
        <div class="card-actions">
          <a class="youtube" href="${youtubeSearchUrl(g.title)}" target="_blank" rel="noreferrer noopener">▶ 공략</a>
          <button type="button" class="ghost" data-action="edit" data-id="${g.id}">수정</button>
          <button type="button" class="ghost danger" data-action="delete" data-id="${g.id}">삭제</button>
        </div>
      </div>
    </article>
  `;
}

function renderList() {
  const list = filteredGames();
  const container = $('gameList');
  container.innerHTML = list.map(gameCardHTML).join('');
  $('emptyState').classList.toggle('hidden', state.games.length > 0);

  container.querySelectorAll('[data-action="edit"]').forEach((b) => {
    b.addEventListener('click', () => editGame(b.dataset.id));
  });
  container.querySelectorAll('[data-action="delete"]').forEach((b) => {
    b.addEventListener('click', () => deleteGame(b.dataset.id));
  });
  container.querySelectorAll('.shot-thumb').forEach((img) => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

function renderAll() {
  renderStats();
  renderPlatformFilter();
  renderList();
}

function openLightbox(src) {
  const div = document.createElement('div');
  div.className = 'lightbox';
  div.innerHTML = `<img src="${src}" alt="" />`;
  div.addEventListener('click', () => div.remove());
  document.body.appendChild(div);
}

// === Init ===
function init() {
  state.profiles = loadProfiles();
  if (!state.profiles.length) {
    state.profiles = ['기본 프로필'];
    saveProfiles(state.profiles);
  }
  const saved = localStorage.getItem(KEYS.currentProfile);
  state.currentProfile = state.profiles.includes(saved) ? saved : state.profiles[0];
  state.games = loadGames(state.currentProfile);

  refreshProfileSelect();
  renderAll();

  // Profile events
  $('profileSelect').addEventListener('change', (e) => switchProfile(e.target.value));
  $('newProfileBtn').addEventListener('click', () => {
    const name = prompt('새 프로필 이름:');
    if (name) createProfile(name);
  });
  $('deleteProfileBtn').addEventListener('click', deleteCurrentProfile);

  // Settings panel
  const rawgKeyInput = $('rawgKey');
  rawgKeyInput.value = localStorage.getItem(KEYS.rawgKey) || '';
  updateRawgKeyStatus();
  $('settingsBtn').addEventListener('click', () => {
    $('settingsPanel').classList.toggle('hidden');
  });
  $('saveRawgKey').addEventListener('click', () => {
    const v = rawgKeyInput.value.trim();
    if (v) localStorage.setItem(KEYS.rawgKey, v);
    else localStorage.removeItem(KEYS.rawgKey);
    updateRawgKeyStatus();
  });

  // Lookup
  $('lookupBtn').addEventListener('click', async () => {
    const q = $('title').value.trim();
    if (!q) {
      alert('게임명을 먼저 입력하세요.');
      return;
    }
    $('lookupResults').innerHTML = '<div class="muted" style="padding:6px">검색 중...</div>';
    const results = await rawgSearch(q);
    renderLookupResults(results || []);
  });

  // Form
  $('gameForm').addEventListener('submit', submitGame);
  $('resetBtn').addEventListener('click', resetForm);
  $('screenshots').addEventListener('change', async (e) => {
    await handleScreenshotInput(e.target.files);
    e.target.value = '';
  });

  // Filters
  $('searchInput').addEventListener('input', renderList);
  $('filterStatus').addEventListener('change', renderList);
  $('filterPlatform').addEventListener('change', renderList);
}

function updateRawgKeyStatus() {
  const has = !!localStorage.getItem(KEYS.rawgKey);
  $('rawgKeyStatus').textContent = has
    ? '✅ RAWG 키가 저장되었습니다. "정보 불러오기"로 자동 채움이 가능합니다.'
    : '🔸 RAWG 키 없이도 사용 가능 (모든 정보 수동 입력).';
}

document.addEventListener('DOMContentLoaded', init);
