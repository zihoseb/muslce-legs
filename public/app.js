const STORAGE_KEY = "muscle-leg-suika:v2";
const WORLD = { width: 420, height: 900, wall: 18, floor: 878, dangerY: 104 };
const GRAVITY = 1850;
const AIR = 0.995;
const RESTITUTION = 0.22;
const FRICTION = 0.985;
const DROP_COOLDOWN = 520;
const DEATH_LINE_GRACE_MS = 1150;
const DEATH_LINE_TOLERANCE = 8;
const REVIVE_CLEARANCE = 96;
const COMBO_WINDOW = 3600;
const SHARE_REWARD = 50;
const AD_REWARD = 80;
const COIN_PACK_REWARD = 300;
const AD_COOLDOWN_MS = 30000;
const MAX_LEVEL = 10;
const MAX_GAME_WIDTH = 430;
const ASSET_BASE = new URL("assets/muscle-legs/", document.baseURI).href.replace(/\/$/, "");
const ANIMATION_DURATION = 540;

const LEG_COLORS = {
  white: {
    label: "白腿",
    skin: "#f3ead8",
    skinDeep: "#d3b893",
    stroke: "#92785c",
    shoe: "#c94138",
    text: "#2f2b27"
  },
  black: {
    label: "黑腿",
    skin: "#2b2825",
    skinDeep: "#111111",
    stroke: "#050505",
    shoe: "#1f9d89",
    text: "#f8f1df"
  }
};

const RARITIES = {
  common: { label: "普通", color: "#8a8f98" },
  rare: { label: "稀有", color: "#267ecf" },
  epic: { label: "史诗", color: "#8757d9" },
  legendary: { label: "传说", color: "#d88916" }
};

const RIVAL_BOARD = [
  { playerId: "rival-01", username: "西瓜腿王", maxLevel: 8, coins: 2880, score: 9520 },
  { playerId: "rival-02", username: "深蹲小王", maxLevel: 7, coins: 2140, score: 7610 },
  { playerId: "rival-03", username: "冲刺队长", maxLevel: 6, coins: 1760, score: 6120 },
  { playerId: "rival-04", username: "腿王学徒", maxLevel: 5, coins: 980, score: 3840 },
  { playerId: "rival-05", username: "健身房新人", maxLevel: 3, coins: 360, score: 1260 }
];

const TASKS = [
  {
    id: "first-drop",
    title: "首次落下",
    reward: 40,
    goal: 1,
    progress: (player) => player.stats.totalDrops
  },
  {
    id: "first-merge",
    title: "首次合成",
    reward: 90,
    goal: 1,
    progress: (player) => player.stats.totalMerges
  },
  {
    id: "level-five",
    title: "五级肌力",
    reward: 180,
    goal: 5,
    progress: (player) => player.maxLevelAchieved
  },
  {
    id: "combo-four",
    title: "四连爆发",
    reward: 220,
    goal: 4,
    progress: (player) => player.stats.maxCombo
  },
  {
    id: "black-merge",
    title: "黑腿进化",
    reward: 120,
    goal: 3,
    progress: (player) => player.stats.blackMerges
  },
  {
    id: "social-starter",
    title: "好友赠送",
    reward: 110,
    goal: 1,
    progress: (player) => player.stats.sentLegs
  }
];

const PANEL_TITLES = {
  menu: "菜单",
  tasks: "任务",
  catalog: "图鉴",
  leaderboard: "排行榜",
  share: "分享"
};

let state = loadGame();
let leaderboard = Array.isArray(state.leaderboard) ? state.leaderboard : [...RIVAL_BOARD];
let canvas;
let ctx;
let dpr = 1;
let viewScale = 1;
let renderTime = 0;
let bodies = [];
let currentLeg = null;
let nextLeg = null;
let pointerX = WORLD.width / 2;
let lastTime = 0;
let lastDropAt = 0;
let dangerTimer = 0;
let paused = false;
let gameOver = false;
let reviveUsed = false;
let gameOverMode = "final";
let activePanel = "";
let toastTimer = 0;
let rewardTimer = 0;
let viewportRaf = 0;
let eventsBound = false;
const imageCache = new Map();

const els = {
  playerName: document.querySelector("#player-name"),
  scoreCount: document.querySelector("#score-count"),
  coinCount: document.querySelector("#coin-count"),
  maxLevel: document.querySelector("#max-level"),
  comboCount: document.querySelector("#combo-count"),
  taskBadge: document.querySelector("#task-badge"),
  catalogBadge: document.querySelector("#catalog-badge"),
  nextLabel: document.querySelector("#next-label"),
  nextPreview: document.querySelector("#next-preview"),
  dropLeg: document.querySelector("#drop-leg"),
  pauseGame: document.querySelector("#pause-game"),
  newRound: document.querySelector("#new-round"),
  runStatus: document.querySelector("#run-status"),
  dangerStatus: document.querySelector("#danger-status"),
  gameOverPanel: document.querySelector("#game-over"),
  gameOverTitle: document.querySelector("#game-over-title"),
  gameOverReason: document.querySelector("#game-over-reason"),
  finalScore: document.querySelector("#final-score"),
  reviveAd: document.querySelector("#revive-ad"),
  reviveRound: document.querySelector("#revive-round"),
  exitRound: document.querySelector("#exit-round"),
  restartRound: document.querySelector("#restart-round"),
  openMenu: document.querySelector("#open-menu"),
  openTasks: document.querySelector("#open-tasks"),
  openCatalog: document.querySelector("#open-catalog"),
  openLeaderboard: document.querySelector("#open-leaderboard"),
  openShare: document.querySelector("#open-share"),
  panelModal: document.querySelector("#panel-modal"),
  modalScrim: document.querySelector("#modal-scrim"),
  modalTitle: document.querySelector("#modal-title"),
  modalBody: document.querySelector("#modal-body"),
  modalClose: document.querySelector("#modal-close"),
  toast: document.querySelector("#toast")
};

initializeGame();

function initializeGame() {
  normalizePlayer(state.player);
  canvas = document.querySelector("#game-canvas");
  ctx = canvas.getContext("2d");
  syncViewportLayout();
  preloadLegAssets();
  hydrateRound();
  bindEvents();
  startRewardTimer();
  updateLeaderboard(state.player);
  checkTasks();
  saveGame();
  renderUi();
  syncViewportLayout();
  requestAnimationFrame(tick);
}

function bindEvents() {
  if (eventsBound) {
    return;
  }

  eventsBound = true;
  window.addEventListener("resize", scheduleViewportLayout);
  window.addEventListener("orientationchange", scheduleViewportLayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleViewportLayout);
    window.visualViewport.addEventListener("scroll", scheduleViewportLayout);
  }
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
  window.addEventListener("keydown", handleKeyDown);
  els.dropLeg.addEventListener("click", dropCurrentLeg);
  els.pauseGame.addEventListener("click", togglePause);
  els.newRound.addEventListener("click", startNewRound);
  els.restartRound.addEventListener("click", startNewRound);
  els.reviveRound.addEventListener("click", revivePlayer);
  els.exitRound.addEventListener("click", exitRound);
  els.openMenu.addEventListener("click", () => openPanel("menu"));
  [els.openTasks, els.openCatalog, els.openLeaderboard, els.openShare].forEach((button) => {
    button.addEventListener("click", () => openPanel(button.dataset.panel));
  });
  els.modalClose.addEventListener("click", closePanel);
  els.modalScrim.addEventListener("click", closePanel);
  els.modalBody.addEventListener("click", handlePanelAction);
}

function tick(time) {
  const dt = Math.min(0.032, (time - lastTime) / 1000 || 0.016);
  lastTime = time;
  renderTime = time;

  if (!paused && !gameOver) {
    stepPhysics(dt);
    checkDanger(dt);
  }

  drawScene();
  requestAnimationFrame(tick);
}

function stepPhysics(dt) {
  const substeps = 3;
  const step = dt / substeps;

  for (let index = 0; index < substeps; index += 1) {
    for (const body of bodies) {
      body.vy += GRAVITY * step;
      body.vx *= AIR;
      body.vy *= AIR;
      body.x += body.vx * step;
      body.y += body.vy * step;
      collideWithWorld(body);
    }

    resolveBodyCollisions();
  }
}

function collideWithWorld(body) {
  const left = WORLD.wall + body.radius;
  const right = WORLD.width - WORLD.wall - body.radius;
  const bottom = WORLD.floor - body.radius;

  if (body.x < left) {
    body.x = left;
    body.vx = Math.abs(body.vx) * RESTITUTION;
  }

  if (body.x > right) {
    body.x = right;
    body.vx = -Math.abs(body.vx) * RESTITUTION;
  }

  if (body.y > bottom) {
    body.y = bottom;
    body.vy = -Math.abs(body.vy) * RESTITUTION;
    body.vx *= FRICTION;
  }
}

function resolveBodyCollisions() {
  const mergedIds = new Set();

  for (let a = 0; a < bodies.length; a += 1) {
    for (let b = a + 1; b < bodies.length; b += 1) {
      const bodyA = bodies[a];
      const bodyB = bodies[b];
      if (mergedIds.has(bodyA.id) || mergedIds.has(bodyB.id)) {
        continue;
      }

      const dx = bodyB.x - bodyA.x;
      const dy = bodyB.y - bodyA.y;
      const distance = Math.hypot(dx, dy) || 0.001;
      const minDistance = bodyA.radius + bodyB.radius;

      if (distance >= minDistance) {
        continue;
      }

      if (canMerge(bodyA, bodyB)) {
        mergeBodies(bodyA, bodyB);
        mergedIds.add(bodyA.id);
        mergedIds.add(bodyB.id);
        continue;
      }

      separateBodies(bodyA, bodyB, dx / distance, dy / distance, minDistance - distance);
    }
  }
}

function separateBodies(bodyA, bodyB, nx, ny, overlap) {
  const massA = bodyA.mass;
  const massB = bodyB.mass;
  const totalMass = massA + massB;
  const moveA = overlap * (massB / totalMass);
  const moveB = overlap * (massA / totalMass);

  bodyA.x -= nx * moveA;
  bodyA.y -= ny * moveA;
  bodyB.x += nx * moveB;
  bodyB.y += ny * moveB;

  const rvx = bodyB.vx - bodyA.vx;
  const rvy = bodyB.vy - bodyA.vy;
  const velocityAlongNormal = rvx * nx + rvy * ny;
  if (velocityAlongNormal > 0) {
    return;
  }

  const impulse = (-(1 + RESTITUTION) * velocityAlongNormal) / (1 / massA + 1 / massB);
  const ix = impulse * nx;
  const iy = impulse * ny;
  bodyA.vx -= ix / massA;
  bodyA.vy -= iy / massA;
  bodyB.vx += ix / massB;
  bodyB.vy += iy / massB;
}

function mergeBodies(bodyA, bodyB) {
  bodies = bodies.filter((body) => body.id !== bodyA.id && body.id !== bodyB.id);

  const level = bodyA.level + 1;
  const x = (bodyA.x * bodyA.mass + bodyB.x * bodyB.mass) / (bodyA.mass + bodyB.mass);
  const y = (bodyA.y * bodyA.mass + bodyB.y * bodyB.mass) / (bodyA.mass + bodyB.mass);
  const merged = createBody(bodyA.color, level, clamp(x, WORLD.wall + radiusForLevel(level), WORLD.width - WORLD.wall - radiusForLevel(level)), y);
  merged.vx = (bodyA.vx + bodyB.vx) * 0.24;
  merged.vy = Math.min(-230, (bodyA.vy + bodyB.vy) * 0.12 - 90);
  merged.flash = 1;
  merged.animationStartedAt = renderTime || performance.now();
  merged.animationUntil = merged.animationStartedAt + ANIMATION_DURATION;
  bodies.push(merged);

  const score = level * level * 22;
  const coins = level * 9 + rarityBonus(calculateRarity(level));
  state.player.score += score;
  state.player.bestScore = Math.max(state.player.bestScore, state.player.score);
  state.player.coins += coins;
  state.player.stats.totalMerges += 1;
  if (merged.color === "black") {
    state.player.stats.blackMerges += 1;
  }
  updateCombo();
  addLegUnlock(merged.color, merged.level);
  addLegToInventory(state.player, createLegRecord(merged.color, merged.level));
  updatePlayerMax(state.player);
  updateLeaderboard(state.player);
  const taskMessage = checkTasks();
  saveRound();
  saveGame();
  renderUi();
  showStatus(`${LEG_COLORS[merged.color].label} L${level} 合成，+${score} 分`);
  showToast([`${LEG_COLORS[merged.color].label} L${level} 合成，金币 +${coins}`, taskMessage].filter(Boolean).join(" | "));
}

function checkDanger() {
  if (bodies.some(isPastDeathLine)) {
    endRound("球越过死亡线");
    return;
  }

  dangerTimer = bodies.some(isNearDeathLine) ? 1 : 0;
  renderDanger();
}

function isPastDeathLine(body) {
  const age = Date.now() - Number(body.createdAt || 0);
  return age > DEATH_LINE_GRACE_MS && body.y - body.radius <= WORLD.dangerY + DEATH_LINE_TOLERANCE;
}

function isNearDeathLine(body) {
  return body.y - body.radius <= WORLD.dangerY + 32;
}

function handlePointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  const scale = WORLD.width / rect.width;
  pointerX = clamp((event.clientX - rect.left) * scale, dropMinX(), dropMaxX());
}

function handlePointerDown(event) {
  handlePointerMove(event);
  dropCurrentLeg();
}

function handleKeyDown(event) {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    dropCurrentLeg();
  }

  if (event.key === "ArrowLeft") {
    pointerX = clamp(pointerX - 18, dropMinX(), dropMaxX());
  }

  if (event.key === "ArrowRight") {
    pointerX = clamp(pointerX + 18, dropMinX(), dropMaxX());
  }
}

function dropCurrentLeg() {
  if (paused || gameOver || !currentLeg || Date.now() - lastDropAt < DROP_COOLDOWN) {
    return;
  }

  const body = createBody(currentLeg.color, currentLeg.level, pointerX, dropY());
  body.vy = 60;
  bodies.push(body);
  lastDropAt = Date.now();
  state.player.stats.totalDrops += 1;
  currentLeg = nextLeg;
  nextLeg = generateNextLeg();
  const taskMessage = checkTasks();
  saveRound();
  saveGame();
  renderUi();
  showStatus(`${LEG_COLORS[body.color].label} L${body.level} 落下`);
  if (taskMessage) {
    showToast(taskMessage);
  }
}

function startNewRound() {
  bodies = [];
  currentLeg = generateNextLeg(true);
  nextLeg = generateNextLeg();
  pointerX = WORLD.width / 2;
  dangerTimer = 0;
  paused = false;
  gameOver = false;
  reviveUsed = false;
  gameOverMode = "final";
  state.player.score = 0;
  state.player.stats.currentCombo = 0;
  state.round = serializeRound();
  saveGame();
  renderUi();
  showStatus("新一局开始");
}

function endRound(reason = "球越过死亡线") {
  if (gameOver) {
    return;
  }

  gameOver = true;
  gameOverMode = reviveUsed ? "final" : "revive";
  state.player.bestScore = Math.max(state.player.bestScore, state.player.score);
  updateLeaderboard(state.player);
  saveRound();
  saveGame();
  renderUi();
  showStatus(reason);
  showToast(gameOverMode === "revive" ? "球越过死亡线，扫码或观看广告可复活" : `本局结束，得分 ${state.player.score}`);
}

function revivePlayer() {
  if (!gameOver || gameOverMode !== "revive") {
    return;
  }

  reviveUsed = true;
  gameOver = false;
  paused = false;
  dangerTimer = 0;
  moveBodiesBelowDeathLine();
  bodies.forEach((body) => {
    body.vx = 0;
    body.vy = 0;
    body.flash = 1;
    body.createdAt = Date.now();
  });
  state.player.stats.revives += 1;
  pointerX = WORLD.width / 2;
  lastDropAt = Date.now();
  updateLeaderboard(state.player);
  saveRound();
  saveGame();
  renderUi();
  showStatus("扫码复活成功，继续合成");
  showToast("复活成功，本局继续");
}

function moveBodiesBelowDeathLine() {
  if (!bodies.length) {
    return;
  }

  const minTop = Math.min(...bodies.map((body) => body.y - body.radius));
  const offset = Math.max(0, WORLD.dangerY + REVIVE_CLEARANCE - minTop);
  bodies.forEach((body, index) => {
    body.y = Math.min(WORLD.floor - body.radius, body.y + offset + index * 0.7);
    body.x = clamp(body.x, WORLD.wall + body.radius, WORLD.width - WORLD.wall - body.radius);
  });
}

function exitRound() {
  if (!gameOver) {
    return;
  }

  reviveUsed = true;
  gameOverMode = "final";
  saveRound();
  saveGame();
  renderUi();
  showStatus("本局结束");
}

function togglePause() {
  if (gameOver) {
    return;
  }

  paused = !paused;
  els.pauseGame.querySelector("span").textContent = paused ? "▶" : "Ⅱ";
  showStatus(paused ? "已暂停" : "继续下落");
}

function giftHighestLeg() {
  const color = state.player.lastUnlockedColor || "white";
  const level = Math.max(1, state.player.maxLevelAchieved);
  const select = document.querySelector("#modal-friend-select");
  const receiverId = select ? select.value : state.player.friends[0]?.id;
  const receiver = getPlayerById(receiverId);
  const leg = {
    ...createLegRecord(color, level),
    id: generateUniqueId()
  };
  sendLegToFriend(state.player, receiver.id, leg);
  const taskMessage = checkTasks();
  updateLeaderboard(state.player);
  saveGame();
  renderUi();
  showToast([`已赠送 ${LEG_COLORS[color].label} L${level} 给 ${receiver.username}，友情金币 +20`, taskMessage].filter(Boolean).join(" | "));
}

function handleShareGame() {
  shareGame(state.player);
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(window.location.href).catch(() => undefined);
  }
  const taskMessage = checkTasks();
  updateLeaderboard(state.player);
  saveGame();
  renderUi();
  showToast([`分享奖励 +${SHARE_REWARD} 金币`, taskMessage].filter(Boolean).join(" | "));
}

function handleRewardedAd() {
  const now = Date.now();
  const elapsed = now - Number(state.player.lastRewardedAdAt || 0);
  if (elapsed < AD_COOLDOWN_MS) {
    showToast(`激励广告冷却中，${Math.ceil((AD_COOLDOWN_MS - elapsed) / 1000)} 秒后可领`);
    return;
  }

  state.player.lastRewardedAdAt = now;
  state.player.stats.adsWatched += 1;
  state.player.coins += AD_REWARD;
  updateLeaderboard(state.player);
  saveGame();
  renderUi();
  showToast(`激励广告奖励 +${AD_REWARD} 金币`);
}

function handleCoinPack() {
  state.player.stats.purchases += 1;
  state.player.coins += COIN_PACK_REWARD;
  updateLeaderboard(state.player);
  saveGame();
  renderUi();
  showToast(`金币包到账 +${COIN_PACK_REWARD}`);
}

function resetSave() {
  if (!window.confirm("重置会清空当前本地存档。")) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  state = createDefaultState();
  leaderboard = [...RIVAL_BOARD];
  startNewRound();
  showToast("存档已重置");
}

function renderUi() {
  els.playerName.textContent = state.player.username;
  els.scoreCount.textContent = formatNumber(state.player.score);
  els.coinCount.textContent = formatNumber(state.player.coins);
  els.maxLevel.textContent = `L${state.player.maxLevelAchieved}`;
  els.comboCount.textContent = `${state.player.stats.currentCombo}x`;
  els.nextLabel.textContent = `L${currentLeg.level}`;
  els.nextPreview.style.backgroundImage = `url("${currentLeg.image}")`;
  els.nextPreview.parentElement.setAttribute(
    "aria-label",
    `${LEG_COLORS[currentLeg.color].label} L${currentLeg.level}，下一条 ${LEG_COLORS[nextLeg.color].label} L${nextLeg.level}`
  );
  els.taskBadge.textContent = `${state.player.achievements.length}/${TASKS.length}`;
  els.catalogBadge.textContent = String(getCatalogEntries().length);
  els.gameOverPanel.hidden = !gameOver;
  els.gameOverTitle.textContent = gameOverMode === "revive" ? "越线警告" : "本局结束";
  els.gameOverReason.textContent = gameOverMode === "revive"
    ? "球越过虚线，扫码或观看广告可复活"
    : "本局已结束";
  els.finalScore.textContent = `${formatNumber(state.player.score)} 分`;
  els.reviveAd.hidden = gameOverMode !== "revive";
  els.reviveRound.hidden = gameOverMode !== "revive";
  els.exitRound.hidden = gameOverMode !== "revive";
  els.restartRound.hidden = false;
  els.dropLeg.disabled = paused || gameOver;
  renderRewards();
  renderDanger();
  if (activePanel) {
    renderActivePanel();
  }
}

function renderTasks() {
  if (activePanel === "tasks") {
    renderActivePanel();
  }
}

function renderTasksPanel() {
  return `
    <div class="modal-summary">
      <strong>${state.player.achievements.length}/${TASKS.length}</strong>
      <span>任务完成后金币自动到账</span>
    </div>
    <div class="task-list">
      ${TASKS.map((task) => {
    const progress = Math.min(task.goal, task.progress(state.player));
    const percent = Math.round((progress / task.goal) * 100);
    const completed = state.player.achievements.includes(task.id);
    return `
      <article class="task-row ${completed ? "done" : ""}">
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <p>${progress}/${task.goal} · 奖励 ${task.reward}</p>
        </div>
        <div class="progress-track" aria-label="${escapeHtml(task.title)} 进度">
          <span style="width: ${percent}%"></span>
        </div>
        <strong>${completed ? "已完成" : "进行中"}</strong>
      </article>
    `;
  }).join("")}
    </div>
  `;
}

function renderFriends() {
  if (activePanel === "share") {
    renderActivePanel();
  }
}

function renderLeaderboard() {
  if (activePanel === "leaderboard") {
    renderActivePanel();
  }
}

function renderLeaderboardPanel() {
  return `
    <ol class="leaderboard">
      ${leaderboard.map((entry, index) => `
    <li class="${entry.playerId === state.player.id ? "is-player" : ""}">
      <span class="rank">${index + 1}</span>
      <div>
        <strong>${escapeHtml(entry.username)}</strong>
        <span>L${entry.maxLevel} · ${formatNumber(entry.score || 0)} 分</span>
      </div>
    </li>
  `).join("")}
    </ol>
  `;
}

function renderRewards() {
  const elapsed = Date.now() - Number(state.player.lastRewardedAdAt || 0);
  const cooldown = Math.max(0, AD_COOLDOWN_MS - elapsed);
  const button = document.querySelector("[data-action='reward-ad']");
  if (button) {
    button.disabled = cooldown > 0;
    const label = button.querySelector("span");
    if (label) {
      label.textContent = cooldown > 0 ? `${Math.ceil(cooldown / 1000)} 秒` : `+${AD_REWARD} 金币`;
    }
  }
}

function renderCatalog() {
  if (activePanel === "catalog") {
    renderActivePanel();
  }
}

function getCatalogEntries() {
  const entries = [];
  const unlocked = state.player.unlocked || {};
  for (const color of Object.keys(LEG_COLORS)) {
    const maxLevel = unlocked[color] || 1;
    for (let level = 1; level <= maxLevel; level += 1) {
      entries.push({ color, level, rarity: calculateRarity(level) });
    }
  }

  return entries;
}

function renderCatalogPanel() {
  const entries = getCatalogEntries();
  return `
    <div class="modal-summary">
      <strong>${entries.length}</strong>
      <span>已解锁腿型</span>
    </div>
    <div class="catalog-list">
      ${entries.map((entry) => `
    <span class="catalog-chip rarity-${entry.rarity}">
      <img src="${escapeHtml(getLegAsset(entry.color, entry.level).image)}" alt="" aria-hidden="true">
      <span>${LEG_COLORS[entry.color].label}</span>
      <strong>L${entry.level}</strong>
    </span>
  `).join("")}
    </div>
  `;
}

function renderMenuPanel() {
  return `
    <div class="menu-stat-grid">
      <div class="menu-stat">
        <span>本局分数</span>
        <strong>${formatNumber(state.player.score)}</strong>
      </div>
      <div class="menu-stat coin-stat">
        <span>金币</span>
        <strong>${formatNumber(state.player.coins)}</strong>
      </div>
      <div class="menu-stat">
        <span>最高等级</span>
        <strong>L${state.player.maxLevelAchieved}</strong>
      </div>
      <div class="menu-stat">
        <span>连击</span>
        <strong>${state.player.stats.currentCombo}x</strong>
      </div>
    </div>
    <div class="menu-action-grid">
      <button class="command-button" data-action="drop-current" type="button" ${paused || gameOver ? "disabled" : ""}>落下</button>
      <button class="command-button secondary" data-action="toggle-pause" type="button">${paused ? "继续" : "暂停"}</button>
      <button class="command-button secondary" data-action="new-round" type="button">重开</button>
    </div>
    <div class="menu-link-grid">
      <button class="dock-button" data-panel="tasks" type="button">
        <span aria-hidden="true">✓</span>
        <strong>任务</strong>
        <em>${state.player.achievements.length}/${TASKS.length}</em>
      </button>
      <button class="dock-button" data-panel="catalog" type="button">
        <span aria-hidden="true">▦</span>
        <strong>图鉴</strong>
        <em>${getCatalogEntries().length}</em>
      </button>
      <button class="dock-button" data-panel="leaderboard" type="button">
        <span aria-hidden="true">#</span>
        <strong>排行</strong>
        <em>Top</em>
      </button>
      <button class="dock-button" data-panel="share" type="button">
        <span aria-hidden="true">↗</span>
        <strong>分享</strong>
        <em>奖励</em>
      </button>
    </div>
  `;
}

function renderSharePanel() {
  const elapsed = Date.now() - Number(state.player.lastRewardedAdAt || 0);
  const cooldown = Math.max(0, AD_COOLDOWN_MS - elapsed);
  const giftDisabled = state.player.maxLevelAchieved <= 1 && state.player.stats.totalMerges === 0;
  const friendOptions = state.player.friends.map((friend) => {
    return `<option value="${escapeHtml(friend.id)}">${escapeHtml(friend.username)}</option>`;
  }).join("");

  return `
    <div class="boost-grid">
      <button class="reward-tile" data-action="share-game" type="button">
        <strong>分享游戏</strong>
        <span>+${SHARE_REWARD} 金币</span>
      </button>
      <button class="reward-tile" data-action="reward-ad" type="button" ${cooldown > 0 ? "disabled" : ""}>
        <strong>激励广告</strong>
        <span>${cooldown > 0 ? `${Math.ceil(cooldown / 1000)} 秒` : `+${AD_REWARD} 金币`}</span>
      </button>
      <button class="reward-tile" data-action="buy-pack" type="button">
        <strong>金币包</strong>
        <span>+${COIN_PACK_REWARD} 金币</span>
      </button>
    </div>
    <section class="panel-section modal-section">
      <div class="panel-heading compact-heading">
        <h3>好友赠送</h3>
        <span>最高 L${state.player.maxLevelAchieved}</span>
      </div>
      <label class="friend-select">
        <span>选择好友</span>
        <select id="modal-friend-select">${friendOptions}</select>
      </label>
      <button class="command-button" data-action="gift-leg" type="button" ${giftDisabled ? "disabled" : ""}>赠送选中腿</button>
    </section>
    <button class="text-button danger-text" data-action="reset-save" type="button">重置本地存档</button>
  `;
}

function openPanel(panel) {
  if (!PANEL_TITLES[panel]) {
    return;
  }

  activePanel = panel;
  els.panelModal.hidden = false;
  document.body.classList.add("modal-open");
  renderActivePanel();
}

function closePanel() {
  activePanel = "";
  els.panelModal.hidden = true;
  document.body.classList.remove("modal-open");
}

function renderActivePanel() {
  if (!activePanel) {
    return;
  }

  const renderers = {
    menu: renderMenuPanel,
    tasks: renderTasksPanel,
    catalog: renderCatalogPanel,
    leaderboard: renderLeaderboardPanel,
    share: renderSharePanel
  };
  const renderer = renderers[activePanel];
  els.modalTitle.textContent = PANEL_TITLES[activePanel];
  els.modalBody.innerHTML = renderer ? renderer() : "";
}

function handlePanelAction(event) {
  const panelControl = event.target.closest("[data-panel]");
  if (panelControl && PANEL_TITLES[panelControl.dataset.panel]) {
    openPanel(panelControl.dataset.panel);
    return;
  }

  const control = event.target.closest("[data-action]");
  if (!control || control.disabled) {
    return;
  }

  const action = control.dataset.action;
  if (action === "share-game") {
    handleShareGame();
  } else if (action === "reward-ad") {
    handleRewardedAd();
  } else if (action === "buy-pack") {
    handleCoinPack();
  } else if (action === "gift-leg") {
    giftHighestLeg();
  } else if (action === "reset-save") {
    resetSave();
  } else if (action === "drop-current") {
    dropCurrentLeg();
    closePanel();
    return;
  } else if (action === "toggle-pause") {
    togglePause();
  } else if (action === "new-round") {
    startNewRound();
    closePanel();
    return;
  }

  if (activePanel) {
    renderActivePanel();
  }
}

function renderDanger() {
  if (gameOver) {
    els.dangerStatus.textContent = gameOverMode === "revive" ? "可复活" : "结束";
  } else if (dangerTimer > 0) {
    els.dangerStatus.textContent = "临近死亡线";
  } else {
    els.dangerStatus.textContent = "死亡线";
  }
}

function drawScene() {
  const scale = dpr * viewScale;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, WORLD.width, WORLD.height);
  drawBackground();

  if (!gameOver) {
    drawDropGuide();
  }

  for (const body of bodies) {
    drawBody(body);
    body.flash = Math.max(0, (body.flash || 0) - 0.045);
  }

  drawWalls();
  ctx.restore();
}

function drawBackground() {
  const background = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  background.addColorStop(0, "#f8fcfa");
  background.addColorStop(0.62, "#edf3ef");
  background.addColorStop(1, "#e6dfd6");
  ctx.fillStyle = background;
  roundRect(ctx, 0, 0, WORLD.width, WORLD.height, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(201, 74, 63, 0.48)";
  ctx.setLineDash([8, 7]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(WORLD.wall, WORLD.dangerY);
  ctx.lineTo(WORLD.width - WORLD.wall, WORLD.dangerY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(201, 74, 63, 0.82)";
  ctx.font = "900 12px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("死亡线", WORLD.wall + 8, WORLD.dangerY - 7);
}

function drawDropGuide() {
  const radius = radiusForLevel(currentLeg.level);
  pointerX = clamp(pointerX, dropMinX(), dropMaxX());
  ctx.strokeStyle = "rgba(19, 130, 111, 0.34)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pointerX, 26);
  ctx.lineTo(pointerX, WORLD.floor - 12);
  ctx.stroke();
  drawToken(pointerX, dropY(), radius, currentLeg.color, currentLeg.level, 0.72, false, 0.7, currentLeg, true);
}

function drawWalls() {
  ctx.fillStyle = "#2a2926";
  roundRect(ctx, 0, 0, WORLD.wall, WORLD.height, 14);
  ctx.fill();
  roundRect(ctx, WORLD.width - WORLD.wall, 0, WORLD.wall, WORLD.height, 14);
  ctx.fill();
  roundRect(ctx, 0, WORLD.floor, WORLD.width, WORLD.height - WORLD.floor, 14);
  ctx.fill();
}

function drawBody(body) {
  drawToken(body.x, body.y, body.radius, body.color, body.level, 1, true, body.flash || 0, body, body.flash > 0);
}

function drawToken(x, y, radius, colorKey, level, alpha = 1, shadow = true, flash = 0, assetSource = null, highlighted = false) {
  const color = LEG_COLORS[colorKey];
  const rarity = RARITIES[calculateRarity(level)];
  const asset = assetSource || getLegAsset(colorKey, level);
  ctx.save();
  ctx.globalAlpha = alpha;

  if (shadow) {
    ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 10;
  }

  const glow = ctx.createRadialGradient(x - radius * 0.28, y - radius * 0.32, radius * 0.1, x, y, radius);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(0.18, color.skin);
  glow.addColorStop(0.76, color.skinDeep);
  glow.addColorStop(1, rarity.color);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = Math.max(3, radius * 0.08);
  ctx.strokeStyle = flash > 0 ? "#ffffff" : rarity.color;
  ctx.stroke();

  if (!drawLegAsset(x, y, radius, asset, highlighted)) {
    drawLegGlyph(x, y, radius, colorKey);
  }

  ctx.fillStyle = color.text;
  ctx.font = `900 ${Math.max(12, radius * 0.34)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`L${level}`, x, y + radius * 0.56);

  if (flash > 0) {
    ctx.globalAlpha = flash * 0.5;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, radius + flash * 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawLegAsset(x, y, radius, asset, highlighted) {
  const path = getActiveAssetPath(asset, highlighted);
  const image = loadAssetImage(path);
  if (!image.complete || !image.naturalWidth) {
    return false;
  }

  const imageHeight = radius * 2.36;
  const imageWidth = imageHeight * (image.naturalWidth / image.naturalHeight);
  ctx.drawImage(image, x - imageWidth / 2, y - imageHeight * 0.58, imageWidth, imageHeight);
  return true;
}

function getActiveAssetPath(asset, highlighted) {
  if (
    asset &&
    asset.animationFrames &&
    asset.animationFrames.length &&
    asset.animationStartedAt &&
    renderTime < asset.animationUntil
  ) {
    const progress = clamp((renderTime - asset.animationStartedAt) / ANIMATION_DURATION, 0, 0.999);
    const index = Math.floor(progress * asset.animationFrames.length);
    return asset.animationFrames[index];
  }

  if (highlighted && asset && asset.highlightImage) {
    return asset.highlightImage;
  }

  return asset && asset.image ? asset.image : getLegImage("white", 1);
}

function drawLegGlyph(x, y, radius, colorKey) {
  const color = LEG_COLORS[colorKey];
  const scale = radius / 48;
  ctx.save();
  ctx.translate(x, y - radius * 0.12);
  ctx.rotate(-0.14);
  ctx.scale(scale, scale);
  ctx.fillStyle = color.skin;
  ctx.strokeStyle = color.stroke;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-4, -34);
  ctx.bezierCurveTo(13, -34, 22, -18, 16, -2);
  ctx.bezierCurveTo(12, 10, 7, 17, 11, 29);
  ctx.bezierCurveTo(4, 34, -8, 34, -16, 29);
  ctx.bezierCurveTo(-10, 16, -9, 8, -16, -3);
  ctx.bezierCurveTo(-25, -19, -17, -34, -4, -34);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color.shoe;
  ctx.beginPath();
  ctx.roundRect(-18, 26, 40, 13, 8);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = colorKey === "black" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.72)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-8, -21);
  ctx.bezierCurveTo(2, -27, 11, -21, 11, -10);
  ctx.moveTo(-11, 3);
  ctx.bezierCurveTo(-1, -3, 9, 0, 10, 11);
  ctx.stroke();
  ctx.restore();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  viewScale = rect.width / WORLD.width;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function scheduleViewportLayout() {
  if (viewportRaf) {
    return;
  }

  viewportRaf = requestAnimationFrame(() => {
    viewportRaf = 0;
    syncViewportLayout();
  });
}

function syncViewportLayout() {
  const viewport = window.visualViewport || window;
  const viewportWidth = Math.max(1, Number(viewport.width || window.innerWidth || document.documentElement.clientWidth));
  const viewportHeight = Math.max(1, Number(viewport.height || window.innerHeight || document.documentElement.clientHeight));
  const gameWidth = Math.min(MAX_GAME_WIDTH, viewportWidth, viewportHeight * (WORLD.width / WORLD.height));
  const gameHeight = gameWidth * (WORLD.height / WORLD.width);

  document.documentElement.style.setProperty("--vh", `${viewportHeight * 0.01}px`);
  document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
  document.documentElement.style.setProperty("--game-width", `${gameWidth}px`);
  document.documentElement.style.setProperty("--game-height", `${gameHeight}px`);

  if (canvas && ctx) {
    resizeCanvas();
  }
}

function hydrateRound() {
  const round = state.round || {};
  bodies = Array.isArray(round.bodies) ? round.bodies.map(hydrateBody).filter(Boolean) : [];
  currentLeg = hydrateLegOption(round.currentLeg) || generateNextLeg(true);
  nextLeg = hydrateLegOption(round.nextLeg) || generateNextLeg();
  pointerX = Number(round.pointerX || WORLD.width / 2);
  gameOver = Boolean(round.gameOver);
  reviveUsed = Boolean(round.reviveUsed);
  gameOverMode = gameOver && !reviveUsed ? "revive" : "final";
  paused = false;
}

function saveRound() {
  state.round = serializeRound();
}

function serializeRound() {
  return {
    bodies: bodies.map((body) => ({
      id: body.id,
      color: body.color,
      level: body.level,
      rarity: body.rarity,
      image: body.image,
      highlightImage: body.highlightImage,
      animationFrames: body.animationFrames,
      effects: body.effects,
      x: body.x,
      y: body.y,
      vx: body.vx,
      vy: body.vy,
      createdAt: body.createdAt
    })),
    currentLeg,
    nextLeg,
    pointerX,
    gameOver,
    reviveUsed
  };
}

function hydrateBody(raw) {
  if (!raw || !LEG_COLORS[raw.color]) {
    return null;
  }
  const body = createBody(raw.color, raw.level, raw.x, raw.y);
  body.id = raw.id || generateUniqueId();
  body.vx = Number(raw.vx || 0);
  body.vy = Number(raw.vy || 0);
  body.createdAt = Number(raw.createdAt || Date.now() - DEATH_LINE_GRACE_MS);
  return body;
}

function createBody(color, level, x, y) {
  const radius = radiusForLevel(level);
  const leg = createLegRecord(color, level);
  return {
    ...leg,
    radius,
    mass: radius * radius,
    x: clamp(Number(x || WORLD.width / 2), WORLD.wall + radius, WORLD.width - WORLD.wall - radius),
    y: Number(y || dropY()),
    vx: 0,
    vy: 0,
    createdAt: Date.now(),
    flash: 0
  };
}

function generateNextLeg(first = false) {
  const maxSeedLevel = Math.min(3, Math.max(1, state.player.maxLevelAchieved - 2));
  const level = first || Math.random() < 0.76 ? 1 : randomInt(1, maxSeedLevel);
  const color = Math.random() < 0.52 ? "white" : "black";
  return createLegRecord(color, level);
}

function radiusForLevel(level) {
  return [0, 19, 25, 32, 40, 49, 59, 70, 82, 95, 109][clamp(level, 1, MAX_LEVEL)];
}

function dropY() {
  return 42;
}

function dropMinX() {
  return WORLD.wall + radiusForLevel(currentLeg.level);
}

function dropMaxX() {
  return WORLD.width - WORLD.wall - radiusForLevel(currentLeg.level);
}

function canMerge(bodyA, bodyB) {
  return bodyA.color === bodyB.color && bodyA.level === bodyB.level && bodyA.level < MAX_LEVEL;
}

function addLegUnlock(color, level) {
  state.player.unlocked[color] = Math.max(state.player.unlocked[color] || 1, level);
  state.player.lastUnlockedColor = color;
}

function createLegRecord(color, level) {
  const rarity = calculateRarity(level);
  const asset = getLegAsset(color, level);
  loadAssetImage(asset.image);
  loadAssetImage(asset.highlightImage);
  asset.animationFrames.forEach(loadAssetImage);
  return {
    id: generateUniqueId(),
    color,
    level,
    rarity,
    image: asset.image,
    highlightImage: asset.highlightImage,
    animationFrames: [...asset.animationFrames],
    effects: getEffects(level)
  };
}

function hydrateLegOption(raw) {
  if (!raw || !LEG_COLORS[raw.color]) {
    return null;
  }

  return {
    ...createLegRecord(raw.color, raw.level || 1),
    id: raw.id || generateUniqueId()
  };
}

function addLegToInventory(player, leg) {
  player.legs.push(leg);
}

function updateCombo() {
  const now = Date.now();
  const last = Number(state.player.stats.lastMergeAt || 0);
  state.player.stats.currentCombo = now - last <= COMBO_WINDOW
    ? state.player.stats.currentCombo + 1
    : 1;
  state.player.stats.maxCombo = Math.max(state.player.stats.maxCombo, state.player.stats.currentCombo);
  state.player.stats.lastMergeAt = now;
}

function updatePlayerMax(player) {
  const unlockedMax = Math.max(1, ...Object.values(player.unlocked || {}));
  const bodyMax = Math.max(1, ...bodies.map((body) => body.level));
  player.maxLevelAchieved = Math.max(player.maxLevelAchieved || 1, unlockedMax, bodyMax);
}

function checkTasks() {
  const completed = [];
  for (const task of TASKS) {
    if (task.progress(state.player) >= task.goal && completeTask(state.player, task.id)) {
      completed.push(task);
    }
  }

  if (!completed.length) {
    return "";
  }

  const coins = completed.reduce((sum, task) => sum + task.reward, 0);
  return `完成任务 ${completed.map((task) => task.title).join("、")}，金币 +${coins}`;
}

function completeTask(player, taskId) {
  if (player.achievements.includes(taskId)) {
    return false;
  }

  player.achievements.push(taskId);
  player.coins += getTaskReward(taskId);
  return true;
}

function getTaskReward(taskId) {
  const task = TASKS.find((item) => item.id === taskId);
  return task ? task.reward : 0;
}

function updateLeaderboard(player) {
  const localEntry = {
    playerId: player.id,
    username: player.username,
    maxLevel: player.maxLevelAchieved,
    coins: player.coins,
    score: Math.max(player.bestScore || 0, player.score || 0)
  };
  const rivals = leaderboard.length ? leaderboard : RIVAL_BOARD;
  leaderboard = [localEntry, ...rivals.filter((entry) => entry.playerId !== player.id)]
    .sort((a, b) => (b.score || 0) - (a.score || 0) || b.maxLevel - a.maxLevel)
    .slice(0, 10);
  state.leaderboard = leaderboard;
}

function shareGame(player) {
  player.coins += SHARE_REWARD;
  player.stats.shares += 1;
}

function sendLegToFriend(sender, receiverId, leg) {
  const receiver = getPlayerById(receiverId);
  receiver.legs.push(leg);
  sender.stats.sentLegs += 1;
  sender.coins += 20;
  return leg;
}

function getPlayerById(playerId) {
  return state.player.friends.find((friend) => friend.id === playerId) || state.player;
}

function calculateRarity(level) {
  if (level >= 8) {
    return "legendary";
  }
  if (level >= 5) {
    return "epic";
  }
  if (level >= 3) {
    return "rare";
  }
  return "common";
}

function rarityBonus(rarity) {
  return { common: 6, rare: 16, epic: 34, legendary: 80 }[rarity] || 0;
}

function getLegImage(color, level) {
  return getLegAsset(color, level).image;
}

function getLegHighlightImage(color, level) {
  return getLegAsset(color, level).highlightImage;
}

function getLegAnimationFrames(color, level) {
  return getLegAsset(color, level).animationFrames;
}

function getEffects(level) {
  const effects = [];
  if (level >= 3) {
    effects.push("shine");
  }
  if (level >= 5) {
    effects.push("burst");
  }
  if (level >= 8) {
    effects.push("legend-aura");
  }
  return effects;
}

function startRewardTimer() {
  if (!rewardTimer) {
    rewardTimer = window.setInterval(renderRewards, 1000);
  }
}

function getLegAsset(color, level) {
  const safeColor = LEG_COLORS[color] ? color : "white";
  const safeLevel = clamp(Math.round(Number(level) || 1), 1, MAX_LEVEL);
  const baseName = `${safeColor}-level-${safeLevel}`;
  return {
    image: `${ASSET_BASE}/${baseName}.png`,
    highlightImage: `${ASSET_BASE}/${baseName}-highlight.png`,
    animationFrames: [1, 2, 3].map((frame) => `${ASSET_BASE}/animation/${baseName}-frame-${frame}.png`)
  };
}

function preloadLegAssets() {
  for (const color of Object.keys(LEG_COLORS)) {
    for (let level = 1; level <= Math.min(4, MAX_LEVEL); level += 1) {
      const asset = getLegAsset(color, level);
      loadAssetImage(asset.image);
      loadAssetImage(asset.highlightImage);
      asset.animationFrames.forEach(loadAssetImage);
    }
  }
}

function loadAssetImage(path) {
  if (!imageCache.has(path)) {
    const image = new Image();
    image.decoding = "async";
    image.src = path;
    imageCache.set(path, image);
  }

  return imageCache.get(path);
}

function showStatus(message) {
  els.runStatus.textContent = message;
}

function showToast(message) {
  if (!message) {
    return;
  }

  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("visible");
  toastTimer = window.setTimeout(() => els.toast.classList.remove("visible"), 3600);
}

function createDefaultState() {
  return {
    player: {
      id: "player-local",
      username: "健腿新秀",
      coins: 120,
      legs: [],
      score: 0,
      bestScore: 0,
      maxLevelAchieved: 1,
      achievements: [],
      unlocked: { white: 1, black: 1 },
      lastUnlockedColor: "white",
      friends: [
        { id: "friend-sprinter", username: "短跑阿强", coins: 0, legs: [] },
        { id: "friend-coach", username: "器械教练", coins: 0, legs: [] },
        { id: "friend-dancer", username: "舞台腿王", coins: 0, legs: [] }
      ],
      stats: {
        totalDrops: 0,
        totalMerges: 0,
        blackMerges: 0,
        currentCombo: 0,
        maxCombo: 0,
        lastMergeAt: 0,
        shares: 0,
        sentLegs: 0,
        revives: 0,
        adsWatched: 0,
        purchases: 0
      },
      lastRewardedAdAt: 0
    },
    leaderboard: [...RIVAL_BOARD],
    round: null
  };
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && saved.player ? saved : createDefaultState();
  } catch {
    return createDefaultState();
  }
}

function saveGame() {
  saveRound();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizePlayer(player) {
  const defaults = createDefaultState().player;
  player.id = player.id || defaults.id;
  player.username = player.username || defaults.username;
  player.coins = Number(player.coins || 0);
  player.legs = Array.isArray(player.legs) ? player.legs.map(hydrateLegOption).filter(Boolean) : [];
  player.score = Number(player.score || 0);
  player.bestScore = Number(player.bestScore || 0);
  player.maxLevelAchieved = Math.max(1, Number(player.maxLevelAchieved || 1));
  player.achievements = Array.isArray(player.achievements) ? player.achievements : [];
  player.unlocked = { white: 1, black: 1, ...(player.unlocked || {}) };
  player.lastUnlockedColor = LEG_COLORS[player.lastUnlockedColor] ? player.lastUnlockedColor : "white";
  player.friends = Array.isArray(player.friends) && player.friends.length ? player.friends : defaults.friends;
  player.stats = { ...defaults.stats, ...(player.stats || {}) };
  player.lastRewardedAdAt = Number(player.lastRewardedAdAt || 0);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUniqueId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `leg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function previewBackground(leg) {
  const color = LEG_COLORS[leg.color];
  const rarity = RARITIES[calculateRarity(leg.level)];
  return `radial-gradient(circle at 34% 28%, #fff 0 10%, ${color.skin} 34%, ${color.skinDeep} 72%, ${rarity.color} 100%)`;
}

function roundRect(context, x, y, width, height, radius) {
  if (context.roundRect) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    return;
  }

  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
