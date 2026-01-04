const STORAGE_KEY = 'gardenIdleState';
const MAX_CARE_CHARGE = 100;
const CARE_DECAY_VISIBLE_PER_HOUR = 2;
const CARE_DECAY_HIDDEN_PER_HOUR = 4;
const WATER_ALL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WEED_SWEEP_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const BASE_GROWTH_PER_HOUR = 6;
const BASE_MOISTURE_DECAY_PER_HOUR = 4;
const BASE_WEED_GROWTH_PER_HOUR = 2;
const NEGATIVE_EVENT_BASE_CHANCE = 0.12;
const MOON_BLOOM_CHANCE = 0.25;

let potGrid;
let careChargeFill;
let careChargeValue;
let waterAllButton;
let weedSweepButton;
let waterAllCooldownLabel;
let weedSweepCooldownLabel;
let petalCount;
let dailyModal;
let dailyTasksList;
let dailyRewardLabel;
let dailyCloseButton;
let dailyOpenButton;

const DEFAULT_POTS = Array.from({ length: 6 }, (_, index) => ({
  id: index,
  hasPlant: true,
  growth: Math.random() * 30,
  moisture: 70 + Math.random() * 20,
  weeds: Math.random() * 10,
  state: 'growing',
}));

const DAILY_TASK_DEFS = [
  { id: 'water', label: 'Water pots', goal: 1 },
  { id: 'weed', label: 'Clear weeds', goal: 1 },
  { id: 'collect', label: 'Collect blooms', goal: 3 },
];

let state = buildDefaultState();
let lastTick = Date.now();
let selectedPotId = null;
const storageAvailable = checkStorageAvailable();

document.addEventListener('DOMContentLoaded', () => {
  initialize();
});

function initialize() {
  state = loadState();
  potGrid = document.getElementById('pot-grid');
  careChargeFill = document.getElementById('carecharge-fill');
  careChargeValue = document.getElementById('carecharge-value');
  waterAllButton = document.getElementById('water-all');
  weedSweepButton = document.getElementById('weed-sweep');
  waterAllCooldownLabel = document.getElementById('water-all-cooldown');
  weedSweepCooldownLabel = document.getElementById('weed-sweep-cooldown');
  petalCount = document.getElementById('petal-count');
  dailyModal = document.getElementById('daily-modal');
  dailyTasksList = document.getElementById('daily-tasks');
  dailyRewardLabel = document.getElementById('daily-reward');
  dailyCloseButton = document.getElementById('daily-close');
  dailyOpenButton = document.getElementById('open-daily');

  const requiredElements = [
    { id: 'pot-grid', el: potGrid },
    { id: 'carecharge-fill', el: careChargeFill },
    { id: 'carecharge-value', el: careChargeValue },
    { id: 'water-all', el: waterAllButton },
    { id: 'weed-sweep', el: weedSweepButton },
    { id: 'water-all-cooldown', el: waterAllCooldownLabel },
    { id: 'weed-sweep-cooldown', el: weedSweepCooldownLabel },
    { id: 'petal-count', el: petalCount },
    { id: 'daily-modal', el: dailyModal },
    { id: 'daily-tasks', el: dailyTasksList },
    { id: 'daily-reward', el: dailyRewardLabel },
    { id: 'daily-close', el: dailyCloseButton },
    { id: 'open-daily', el: dailyOpenButton },
  ];

  const missing = requiredElements.filter((entry) => !entry.el).map((entry) => entry.id);
  if (missing.length > 0) {
    console.warn('Missing UI elements:', missing.join(', '));
    return;
  }

  applyOfflineProgress();
  applyTheme();
  render();

  waterAllButton.addEventListener('click', handleWaterAll);
  weedSweepButton.addEventListener('click', handleWeedSweep);
  dailyCloseButton.addEventListener('click', () => setDailyModalOpen(false));
  dailyOpenButton.addEventListener('click', () => setDailyModalOpen(true));
  potGrid.addEventListener('click', handlePotGridClick);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      const delta = now - state.lastActive;
      applyCareDecay(delta, CARE_DECAY_HIDDEN_PER_HOUR);
      applyGrowth(delta);
      state.lastActive = now;
      lastTick = now;
      render();
    } else {
      state.lastActive = Date.now();
      saveState();
    }
  });

  setInterval(() => {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;
    state.lastActive = now;
    applyCareDecay(delta, CARE_DECAY_VISIBLE_PER_HOUR);
    applyGrowth(delta);
    applyTheme();
    render();
    saveState();
  }, 60 * 1000);

  saveState();
  setDailyModalOpen(true);
}

function buildDefaultState() {
  return {
    careCharge: 85,
    petals: 0,
    pots: createDefaultPots(),
    lastWaterAllDate: null,
    lastWeedSweepDate: null,
    lastActive: Date.now(),
    dailyTasks: buildDailyTasks(),
  };
}

function createDefaultPots() {
  return DEFAULT_POTS.map((pot) => ({ ...pot }));
}

function handlePotGridClick(event) {
  const button = event.target.closest('button[data-action]');
  const card = event.target.closest('.pot-card');
  if (button && potGrid.contains(button)) {
    const potId = Number(button.dataset.potId);
    const action = button.dataset.action;
    const pot = state.pots.find((entry) => entry.id === potId);
    if (!pot) {
      console.warn('Missing pot for action', potId);
      return;
    }
    if (action === 'collect') {
      handleCollect(pot);
    } else if (action === 'plant') {
      handlePlant(pot);
    }
    return;
  }

  if (card && potGrid.contains(card)) {
    const potId = Number(card.dataset.potId);
    const pot = state.pots.find((entry) => entry.id === potId);
    if (!pot) {
      console.warn('Missing pot for selection', potId);
      return;
    }
    selectedPotId = potId;
    console.info(`Selected pot ${pot.id + 1}:`, pot.state);
    renderPots();
  }
}

function setDailyModalOpen(isOpen) {
  dailyModal.classList.toggle('open', isOpen);
  dailyModal.setAttribute('aria-hidden', (!isOpen).toString());
}

function loadState() {
  if (!storageAvailable) {
    return buildDefaultState();
  }
  const raw = getStorageItem(STORAGE_KEY);
  if (!raw) {
    return buildDefaultState();
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      careCharge: clamp(parsed.careCharge ?? 85, 0, MAX_CARE_CHARGE),
      petals: parsed.petals ?? 0,
      pots: parsed.pots ?? DEFAULT_POTS,
      lastWaterAllDate: parsed.lastWaterAllDate ?? null,
      lastWeedSweepDate: parsed.lastWeedSweepDate ?? null,
      lastActive: parsed.lastActive ?? Date.now(),
      dailyTasks: normalizeDailyTasks(parsed.dailyTasks),
    };
  } catch (error) {
    return buildDefaultState();
  }
}

function saveState() {
  if (!storageAvailable) return;
  setStorageItem(STORAGE_KEY, JSON.stringify(state));
}

function applyOfflineProgress() {
  const now = Date.now();
  const delta = now - state.lastActive;
  applyCareDecay(delta, CARE_DECAY_HIDDEN_PER_HOUR);
  applyGrowth(delta);
  state.lastActive = now;
  saveState();
}

function applyCareDecay(deltaMs, ratePerHour) {
  if (state.careCharge <= 0) return;
  const hours = deltaMs / (60 * 60 * 1000);
  const decay = ratePerHour * hours;
  state.careCharge = clamp(state.careCharge - decay, 0, MAX_CARE_CHARGE);
}

function applyGrowth(deltaMs) {
  const hours = deltaMs / (60 * 60 * 1000);
  const careMultiplier = getCareMultiplier(state.careCharge);
  const dayMultiplier = isDaytime() ? 1.1 : 1;

  state.pots.forEach((pot) => {
    if (!pot.hasPlant) return;

    pot.moisture = clamp(pot.moisture - BASE_MOISTURE_DECAY_PER_HOUR * hours, 0, 100);
    pot.weeds = clamp(pot.weeds + BASE_WEED_GROWTH_PER_HOUR * hours, 0, 100);

    applyNegativeEvents(pot, hours);

    if (pot.moisture <= 0 || pot.weeds >= 100) {
      pot.state = 'wilted';
    } else if (pot.growth >= 100) {
      pot.state = 'blooming';
    } else {
      pot.state = 'growing';
    }

    if (pot.state !== 'wilted') {
      pot.growth = clamp(
        pot.growth + BASE_GROWTH_PER_HOUR * careMultiplier * dayMultiplier * hours,
        0,
        100,
      );
    }

    if (pot.growth >= 100 && pot.state !== 'wilted') {
      pot.state = 'blooming';
    }
  });
}

function applyNegativeEvents(pot, hours) {
  const careFactor = (MAX_CARE_CHARGE - state.careCharge) / MAX_CARE_CHARGE;
  const eventChance = NEGATIVE_EVENT_BASE_CHANCE * (1 + careFactor * 2) * hours;
  const weedsChance = eventChance * (isDaytime() ? 1 : 0.85);
  const moistureChance = eventChance;

  if (Math.random() < weedsChance) {
    pot.weeds = clamp(pot.weeds + 12 + Math.random() * 8, 0, 100);
  }

  if (Math.random() < moistureChance) {
    pot.moisture = clamp(pot.moisture - (10 + Math.random() * 8), 0, 100);
  }
}

function handleWaterAll() {
  if (!canUseDailyAction(state.lastWaterAllDate, WATER_ALL_COOLDOWN_MS)) return;
  state.lastWaterAllDate = Date.now();
  state.careCharge = clamp(state.careCharge + 30, 0, MAX_CARE_CHARGE);
  state.pots.forEach((pot) => {
    if (!pot.hasPlant) return;
    pot.moisture = clamp(pot.moisture + 30, 0, 100);
    if (pot.state === 'wilted' && pot.moisture > 0 && pot.weeds < 100) {
      pot.state = 'growing';
    }
  });
  updateDailyProgress('water');
  render();
  saveState();
}

function handleWeedSweep() {
  if (!canUseDailyAction(state.lastWeedSweepDate, WEED_SWEEP_COOLDOWN_MS)) return;
  state.lastWeedSweepDate = Date.now();
  state.careCharge = clamp(state.careCharge + 25, 0, MAX_CARE_CHARGE);
  state.pots.forEach((pot) => {
    if (!pot.hasPlant) return;
    pot.weeds = clamp(pot.weeds - 40, 0, 100);
    if (pot.state === 'wilted' && pot.moisture > 0 && pot.weeds < 100) {
      pot.state = 'growing';
    }
  });
  updateDailyProgress('weed');
  render();
  saveState();
}

function handleCollect(pot) {
  if (pot.state !== 'blooming') return;
  const moonBloom = !isDaytime() && Math.random() < MOON_BLOOM_CHANCE;
  const bonusPetals = moonBloom ? 2 : 0;

  state.petals += 1 + bonusPetals;
  state.careCharge = clamp(state.careCharge + 5, 0, MAX_CARE_CHARGE);

  pot.growth = 0;
  pot.moisture = 60;
  pot.weeds = 0;
  pot.state = 'growing';
  pot.hasPlant = true;

  updateDailyProgress('collect');
  render();
  saveState();
}

function handlePlant(pot) {
  pot.hasPlant = true;
  pot.growth = 0;
  pot.moisture = 50;
  pot.weeds = 0;
  pot.state = 'growing';
  render();
  saveState();
}

function render() {
  renderCareCharge();
  renderActions();
  renderPots();
  renderDailyTasks();
}

function renderCareCharge() {
  careChargeFill.style.width = `${state.careCharge}%`;
  careChargeValue.textContent = `${Math.round(state.careCharge)}`;
  petalCount.textContent = `${state.petals}`;
}

function renderActions() {
  updateCooldownLabel(waterAllButton, waterAllCooldownLabel, state.lastWaterAllDate, WATER_ALL_COOLDOWN_MS);
  updateCooldownLabel(weedSweepButton, weedSweepCooldownLabel, state.lastWeedSweepDate, WEED_SWEEP_COOLDOWN_MS);
}

function updateCooldownLabel(button, label, lastDate, cooldownMs) {
  if (!lastDate) {
    button.disabled = false;
    label.textContent = '';
    return;
  }
  const remaining = cooldownMs - (Date.now() - lastDate);
  if (remaining <= 0) {
    button.disabled = false;
    label.textContent = '';
  } else {
    button.disabled = true;
    label.textContent = `Ready in ${formatTime(remaining)}`;
  }
}

function renderPots() {
  potGrid.innerHTML = '';
  state.pots.forEach((pot) => {
    const card = document.createElement('div');
    card.className = `pot-card ${pot.state}`;
    card.dataset.potId = pot.id;
    if (selectedPotId === pot.id) {
      card.classList.add('selected');
    }

    const header = document.createElement('div');
    header.className = 'pot-header';
    header.innerHTML = `<span>Pot ${pot.id + 1}</span><span class="state">${formatState(pot)}</span>`;

    const growthRow = buildBarRow('Growth', pot.growth, pot.state === 'blooming');
    const moistureRow = buildBarRow('Moisture', pot.moisture);
    const weedsRow = buildBarRow('Weeds', 100 - pot.weeds);
    weedsRow.classList.add('weeds');

    const footer = document.createElement('div');
    footer.className = 'pot-actions';

    const actionButton = document.createElement('button');
    if (!pot.hasPlant) {
      actionButton.textContent = 'Plant seed';
      actionButton.dataset.action = 'plant';
    } else if (pot.state === 'blooming') {
      actionButton.textContent = 'Collect blooms';
      actionButton.dataset.action = 'collect';
    } else if (pot.state === 'wilted') {
      actionButton.textContent = 'Needs care';
      actionButton.disabled = true;
    } else {
      actionButton.textContent = 'Growing';
      actionButton.disabled = true;
    }

    actionButton.dataset.potId = pot.id;

    footer.appendChild(actionButton);

    card.appendChild(header);
    card.appendChild(growthRow);
    card.appendChild(moistureRow);
    card.appendChild(weedsRow);
    card.appendChild(footer);

    potGrid.appendChild(card);
  });
}

function renderDailyTasks() {
  const dailyTasks = state.dailyTasks;
  dailyTasksList.innerHTML = '';

  dailyTasks.tasks.forEach((task) => {
    const listItem = document.createElement('li');
    const progress = getTaskProgress(task.id);
    const completed = progress >= task.goal;
    listItem.className = completed ? 'complete' : '';
    listItem.textContent = `${task.label}: ${Math.min(progress, task.goal)}/${task.goal}`;
    dailyTasksList.appendChild(listItem);
  });

  dailyRewardLabel.textContent = dailyTasks.rewardClaimed
    ? 'Reward claimed! Garden Mood boosted.'
    : 'Complete all tasks for +10 Garden Mood.';
}

function updateDailyProgress(taskId) {
  if (!state.dailyTasks.tasks.some((task) => task.id === taskId)) return;

  if (!state.dailyTasks.progress) {
    state.dailyTasks.progress = { water: 0, weed: 0, collect: 0 };
  }

  if (taskId === 'water') state.dailyTasks.progress.water = 1;
  if (taskId === 'weed') state.dailyTasks.progress.weed = 1;
  if (taskId === 'collect') state.dailyTasks.progress.collect += 1;

  checkDailyReward();
}

function checkDailyReward() {
  const tasks = state.dailyTasks.tasks;
  const allDone = tasks.every((task) => getTaskProgress(task.id) >= task.goal);
  if (allDone && !state.dailyTasks.rewardClaimed) {
    state.dailyTasks.rewardClaimed = true;
    state.careCharge = clamp(state.careCharge + 10, 0, MAX_CARE_CHARGE);
  }
}

function getTaskProgress(taskId) {
  if (!state.dailyTasks.progress) {
    state.dailyTasks.progress = { water: 0, weed: 0, collect: 0 };
  }
  return state.dailyTasks.progress[taskId] ?? 0;
}

function buildDailyTasks() {
  const dateKey = getDateKey();
  const tasks = [...DAILY_TASK_DEFS].sort(() => 0.5 - Math.random());
  const count = 2 + Math.floor(Math.random() * 2);
  return {
    date: dateKey,
    tasks: tasks.slice(0, count),
    progress: { water: 0, weed: 0, collect: 0 },
    rewardClaimed: false,
  };
}

function normalizeDailyTasks(dailyTasks) {
  if (!dailyTasks || dailyTasks.date !== getDateKey()) {
    return buildDailyTasks();
  }
  return {
    ...dailyTasks,
    progress: dailyTasks.progress ?? { water: 0, weed: 0, collect: 0 },
  };
}

function canUseDailyAction(lastDate, cooldownMs) {
  if (!lastDate) return true;
  return Date.now() - lastDate >= cooldownMs;
}

function formatState(pot) {
  if (!pot.hasPlant) return 'Empty';
  if (pot.state === 'blooming') return 'Blooming';
  if (pot.state === 'wilted') return 'Wilted';
  return 'Growing';
}

function buildBarRow(label, value, highlight = false) {
  const row = document.createElement('div');
  row.className = 'bar-row';
  if (highlight) row.classList.add('highlight');
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const bar = document.createElement('div');
  bar.className = 'bar';
  const fill = document.createElement('div');
  fill.className = 'bar-fill';
  fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
  bar.appendChild(fill);
  row.appendChild(labelEl);
  row.appendChild(bar);
  return row;
}

function getCareMultiplier(careCharge) {
  if (careCharge >= 80) return 1;
  if (careCharge >= 40) return 0.6;
  return 0.2;
}

function isDaytime() {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 19;
}

function applyTheme() {
  document.body.classList.toggle('theme-day', isDaytime());
  document.body.classList.toggle('theme-night', !isDaytime());
}

function formatTime(ms) {
  const totalMinutes = Math.ceil(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function getDateKey() {
  return new Date().toISOString().split('T')[0];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function checkStorageAvailable() {
  try {
    const testKey = '__garden_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn('localStorage unavailable, running in memory only.');
    return false;
  }
}

function getStorageItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('Failed to read storage', error);
    return null;
  }
}

function setStorageItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('Failed to write storage', error);
  }
}
