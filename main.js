const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const maskLabel = document.getElementById('mask');
const ammoLabel = document.getElementById('ammo');
const stateLabel = document.getElementById('state');
const waveLabel = document.getElementById('wave');
const scoreLabel = document.createElement('span');
scoreLabel.id = 'score';
scoreLabel.textContent = 'Score: 0';
document.querySelector('#hud .stats').appendChild(scoreLabel);
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('start-btn');

let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

window.addEventListener('resize', () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
});

const keys = new Set();
let mouse = { x: width / 2, y: height / 2 };
let shooting = false;
let meleeing = false;
let score = 0;
let combo = 0;
let comboTimer = 0;

const noises = [];
const VISION_RANGE = 260;
const VISION_FOV = Math.PI * 0.75;

const waveConfigs = [
  {
    label: 'Intro sweep',
    spawns: [
      { x: 520, y: 200, path: [ { x: 520, y: 200 }, { x: 520, y: 320 } ] },
      { x: 840, y: 180, path: [ { x: 840, y: 180 }, { x: 920, y: 320 } ] },
      { x: 220, y: 520, path: [ { x: 220, y: 520 }, { x: 420, y: 520 } ] },
      { x: 820, y: 560, path: [ { x: 820, y: 560 }, { x: 820, y: 440 } ] },
    ],
    speed: 1,
    vision: 1,
  },
  {
    label: 'Crossfire',
    spawns: [
      { x: 520, y: 200, path: [ { x: 520, y: 200 }, { x: 520, y: 320 }, { x: 620, y: 320 } ] },
      { x: 840, y: 180, path: [ { x: 840, y: 180 }, { x: 920, y: 320 }, { x: 760, y: 320 } ] },
      { x: 220, y: 520, path: [ { x: 220, y: 520 }, { x: 420, y: 520 }, { x: 420, y: 440 } ] },
      { x: 820, y: 560, path: [ { x: 820, y: 560 }, { x: 820, y: 440 }, { x: 700, y: 440 } ] },
      { x: 360, y: 260, path: [ { x: 360, y: 260 }, { x: 360, y: 420 } ] },
      { x: 640, y: 520, path: [ { x: 640, y: 520 }, { x: 840, y: 520 } ] },
    ],
    speed: 1.05,
    vision: 1.05,
  },
  {
    label: 'Rushdown',
    spawns: [
      { x: 520, y: 200, path: [ { x: 520, y: 200 }, { x: 520, y: 320 }, { x: 720, y: 320 } ] },
      { x: 820, y: 240, path: [ { x: 820, y: 240 }, { x: 940, y: 360 }, { x: 820, y: 360 } ] },
      { x: 220, y: 520, path: [ { x: 220, y: 520 }, { x: 420, y: 520 }, { x: 420, y: 640 } ] },
      { x: 820, y: 560, path: [ { x: 820, y: 560 }, { x: 820, y: 440 }, { x: 640, y: 440 } ] },
      { x: 460, y: 360, path: [ { x: 460, y: 360 }, { x: 560, y: 440 } ] },
      { x: 660, y: 200, path: [ { x: 660, y: 200 }, { x: 760, y: 200 }, { x: 760, y: 300 } ] },
      { x: 600, y: 520, path: [ { x: 600, y: 520 }, { x: 600, y: 620 }, { x: 760, y: 620 } ] },
    ],
    speed: 1.1,
    vision: 1.1,
  },
];

const masks = [
  { name: 'Tiger', description: 'Speed boost', speed: 1.2, ammoBonus: 0, dash: 1.05 },
  { name: 'Owl', description: 'Ammo hoarder', speed: 1.0, ammoBonus: 3, dash: 1 },
  { name: 'Rhino', description: 'Longer stun melee', speed: 0.95, ammoBonus: 0, dash: 1.15 },
];

const level = {
  walls: [],
  spawn: { x: 160, y: 200 },
};

function buildLevel() {
  level.walls = [
    { x: 80, y: 120, w: 300, h: 24 },
    { x: 360, y: 120, w: 24, h: 220 },
    { x: 420, y: 260, w: 280, h: 24 },
    { x: 620, y: 120, w: 24, h: 220 },
    { x: 740, y: 120, w: 220, h: 24 },
    { x: 80, y: 420, w: 220, h: 24 },
    { x: 260, y: 420, w: 24, h: 220 },
    { x: 320, y: 560, w: 320, h: 24 },
    { x: 620, y: 420, w: 24, h: 220 },
    { x: 700, y: 420, w: 280, h: 24 },
    { x: 80, y: 80, w: 900, h: 24 },
    { x: 80, y: 80, w: 24, h: 600 },
    { x: 956, y: 80, w: 24, h: 600 },
    { x: 80, y: 656, w: 900, h: 24 },
  ];

}

function vecLength(x, y) {
  return Math.hypot(x, y);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function triggerShake(magnitude = 6, duration = 0.2) {
  cameraShakeMagnitude = Math.max(cameraShakeMagnitude, magnitude);
  cameraShakeDuration = Math.max(cameraShakeDuration, duration);
  cameraShakeTime = cameraShakeDuration;
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function moveWithCollisions(entity, dx, dy, colliders) {
  entity.x += dx;
  for (const wall of colliders) {
    if (rectsIntersect(entity, wall)) {
      if (dx > 0) entity.x = wall.x - entity.w;
      else if (dx < 0) entity.x = wall.x + wall.w;
    }
  }

  entity.y += dy;
  for (const wall of colliders) {
    if (rectsIntersect(entity, wall)) {
      if (dy > 0) entity.y = wall.y - entity.h;
      else if (dy < 0) entity.y = wall.y + wall.h;
    }
  }
}

function lineOfSight(a, b, walls) {
  for (const wall of walls) {
    const x1 = a.x + a.w / 2;
    const y1 = a.y + a.h / 2;
    const x2 = b.x + b.w / 2;
    const y2 = b.y + b.h / 2;
    // Axis aligned wall rectangle intersection using parametric step sampling
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      if (x >= wall.x && x <= wall.x + wall.w && y >= wall.y && y <= wall.y + wall.h) return false;
    }
  }
  return true;
}

class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.w = 26;
    this.h = 26;
    this.x = level.spawn.x;
    this.y = level.spawn.y;
    this.speed = 210;
    this.angle = 0;
    this.alive = true;
    this.ammo = 6 + masks[currentMask].ammoBonus;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.status = 'Ready';
  }
}

class Enemy {
  constructor(spawn, modifiers = { speed: 1, vision: 1 }) {
    this.w = 24;
    this.h = 24;
    this.x = spawn.x;
    this.y = spawn.y;
    this.path = spawn.path;
    this.patrolIndex = 0;
    this.state = 'patrol';
    this.speed = 170 * (modifiers.speed || 1);
    this.visionRange = VISION_RANGE * (modifiers.vision || 1);
    this.alive = true;
    this.stunTimer = 0;
    this.alertTimer = 0;
    this.facing = 0;
  }
}

class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 880;
    this.life = 0.8;
    this.w = 6;
    this.h = 6;
  }
}

let player;
let enemies = [];
let bullets = [];
let lastTime = 0;
let currentMask = 0;
let gameStarted = false;
let currentWave = 1;
let readyNextWave = false;
let cameraShakeTime = 0;
let cameraShakeDuration = 0;
let cameraShakeMagnitude = 0;
let alertGlow = 0;
const muzzleFlashes = [];
const hitSparks = [];

function reset(options = {}) {
  const { keepOverlay = false, keepScore = false, keepWave = false } = options;
  if (!keepWave) currentWave = 1;
  buildLevel();
  player = new Player();
  enemies = spawnForWave(currentWave);
  bullets = [];
  muzzleFlashes.length = 0;
  hitSparks.length = 0;
  noises.length = 0;
  if (!keepScore) score = 0;
  combo = 0;
  comboTimer = 0;
  alertGlow = 0;
  cameraShakeTime = 0;
  cameraShakeDuration = 0;
  cameraShakeMagnitude = 0;
  if (!keepOverlay) overlay.classList.add('hidden');
  updateHud();
}

function updateHud() {
  maskLabel.textContent = `Mask: ${masks[currentMask].name} (${masks[currentMask].description})`;
  ammoLabel.textContent = `Ammo: ${player.ammo}`;
  stateLabel.textContent = `Status: ${player.status}`;
  waveLabel.textContent = `Wave: ${currentWave} (${getWaveConfig(currentWave).label})`;
  scoreLabel.textContent = `Score: ${score} (x${Math.max(1, combo)})`;
}

function getWaveConfig(wave) {
  return waveConfigs[Math.min(wave - 1, waveConfigs.length - 1)];
}

function spawnForWave(wave) {
  const config = getWaveConfig(wave);
  return config.spawns.map((spawn) => new Enemy(spawn, { speed: config.speed, vision: config.vision }));
}

function showOverlay(message, showStartButton = false) {
  overlayText.textContent = message;
  overlay.classList.remove('hidden');
  startBtn.classList.toggle('hidden', !showStartButton);
}

function beginRun({ continueWave = false } = {}) {
  reset({ keepScore: continueWave, keepWave: continueWave });
  gameStarted = true;
  readyNextWave = false;
  overlay.classList.add('hidden');
  player.status = 'Ready';
  updateHud();
}

function startFromOverlay() {
  beginRun({ continueWave: readyNextWave });
}

function handleInput(dt) {
  const speedBoost = masks[currentMask].speed;
  const baseSpeed = player.speed * speedBoost;
  let dx = 0;
  let dy = 0;
  if (keys.has('w')) dy -= 1;
  if (keys.has('s')) dy += 1;
  if (keys.has('a')) dx -= 1;
  if (keys.has('d')) dx += 1;
  const len = vecLength(dx, dy) || 1;
  dx = (dx / len) * baseSpeed * dt;
  dy = (dy / len) * baseSpeed * dt;

  // Dash
  if (keys.has('Shift') && player.dashCooldown <= 0 && player.alive) {
    player.dashTimer = 0.15 * masks[currentMask].dash;
    player.dashCooldown = 1.0;
    player.status = 'Dashing';
  }

  if (player.dashTimer > 0) {
    const angle = Math.atan2(mouse.y - (player.y + player.h / 2), mouse.x - (player.x + player.w / 2));
    dx += Math.cos(angle) * 500 * dt * masks[currentMask].dash;
    dy += Math.sin(angle) * 500 * dt * masks[currentMask].dash;
    player.dashTimer -= dt;
    if (player.dashTimer <= 0) player.status = 'Ready';
  } else {
    player.dashCooldown -= dt;
  }

  moveWithCollisions(player, dx, dy, level.walls);
}

function shoot() {
  if (!player.alive) return;
  if (player.ammo <= 0) {
    stateLabel.textContent = 'Status: Click! No ammo';
    return;
  }
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  const angle = Math.atan2(mouse.y - py, mouse.x - px);
  bullets.push(new Bullet(px, py, angle));
  muzzleFlashes.push({
    x: px + Math.cos(angle) * 14,
    y: py + Math.sin(angle) * 14,
    angle,
    life: 0.14,
    maxLife: 0.14,
  });
  triggerShake(4, 0.12);
  player.ammo -= 1;
  addNoise(px, py, 240);
  updateHud();
}

function meleeStrike() {
  if (!player.alive) return;
  const reach = masks[currentMask].name === 'Rhino' ? 70 : 50;
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  let hit = false;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const ex = enemy.x + enemy.w / 2;
    const ey = enemy.y + enemy.h / 2;
    const dist = vecLength(ex - px, ey - py);
    if (dist < reach && lineOfSight(player, enemy, level.walls)) {
      enemy.stunTimer = 0.6;
      enemy.state = 'stunned';
      enemy.alertTimer = 0;
      hit = true;
    }
  }
  if (hit) {
    player.status = 'Stun';
    stateLabel.textContent = 'Status: Stun hit';
    addNoise(px, py, 160);
    muzzleFlashes.push({ x: px + Math.cos(player.angle) * 16, y: py + Math.sin(player.angle) * 16, angle: player.angle, life: 0.12, maxLife: 0.12 });
    triggerShake(3, 0.1);
  }
}

function addNoise(x, y, radius) {
  noises.push({ x, y, radius, life: 0.35 });
}

function awardKill() {
  combo = Math.min(combo + 1, 9);
  comboTimer = 3.4;
  const points = 100 * combo;
  score += points;
  stateLabel.textContent = `Status: +${points} (${combo}x combo)`;
  updateHud();
}

function updateBullets(dt) {
  for (const bullet of bullets) {
    bullet.life -= dt;
    bullet.x += Math.cos(bullet.angle) * bullet.speed * dt;
    bullet.y += Math.sin(bullet.angle) * bullet.speed * dt;
    const bulletRect = { x: bullet.x - 3, y: bullet.y - 3, w: bullet.w, h: bullet.h };

    // Wall collision
    for (const wall of level.walls) {
      if (rectsIntersect(bulletRect, wall)) {
        bullet.life = 0;
        break;
      }
    }

    // Enemy collision
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (rectsIntersect(bulletRect, enemy)) {
        enemy.alive = false;
        awardKill();
        hitSparks.push({ x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, life: 0.28, maxLife: 0.28 });
        bullet.life = 0;
        break;
      }
    }
  }
  bullets = bullets.filter((b) => b.life > 0);
}

function updateNoises(dt) {
  for (const noise of noises) {
    noise.life -= dt;
  }
  for (let i = noises.length - 1; i >= 0; i--) {
    if (noises[i].life <= 0) noises.splice(i, 1);
  }
}

function updateEffects(dt) {
  if (cameraShakeTime > 0) {
    cameraShakeTime -= dt;
    if (cameraShakeTime < 0) cameraShakeTime = 0;
  }

  for (const flash of muzzleFlashes) {
    flash.life -= dt;
  }
  for (const spark of hitSparks) {
    spark.life -= dt;
  }
  for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
    if (muzzleFlashes[i].life <= 0) muzzleFlashes.splice(i, 1);
  }
  for (let i = hitSparks.length - 1; i >= 0; i--) {
    if (hitSparks[i].life <= 0) hitSparks.splice(i, 1);
  }

  let targetAlert = 0;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (enemy.state === 'chase') {
      targetAlert = 1;
      break;
    }
    if (enemy.state === 'alert') {
      targetAlert = Math.max(targetAlert, clamp(enemy.alertTimer / 0.6, 0, 1));
    }
  }
  if (!player.alive) targetAlert = 0;
  if (targetAlert > alertGlow) {
    alertGlow = targetAlert;
  } else {
    alertGlow = Math.max(0, alertGlow - dt * 1.5);
  }
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (enemy.stunTimer > 0) {
      enemy.stunTimer -= dt;
      if (enemy.stunTimer <= 0) enemy.state = 'patrol';
      continue;
    }

    const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };
    const enemyRect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
    const dirToPlayerX = player.x + player.w / 2 - (enemy.x + enemy.w / 2);
    const dirToPlayerY = player.y + player.h / 2 - (enemy.y + enemy.h / 2);
    const dist = vecLength(dirToPlayerX, dirToPlayerY);

    const routeTarget = enemy.state === 'chase' || enemy.state === 'alert' ? { x: player.x, y: player.y } : enemy.path[enemy.patrolIndex];
    const faceDx = routeTarget.x - enemy.x;
    const faceDy = routeTarget.y - enemy.y;
    enemy.facing = Math.atan2(faceDy, faceDx || 0.001);

    const angleToPlayer = Math.atan2(dirToPlayerY, dirToPlayerX);
    const angleDiff = Math.abs(Math.atan2(Math.sin(angleToPlayer - enemy.facing), Math.cos(angleToPlayer - enemy.facing)));

    const visionRange = enemy.visionRange || VISION_RANGE;
    if (player.alive && dist < visionRange && angleDiff < VISION_FOV / 2 && lineOfSight(enemyRect, playerRect, level.walls)) {
      enemy.state = 'alert';
      enemy.alertTimer = Math.min(enemy.alertTimer + dt, 0.6);
    }

    // Noise attraction
    for (const noise of noises) {
      const nd = vecLength(noise.x - (enemy.x + enemy.w / 2), noise.y - (enemy.y + enemy.h / 2));
      if (nd < noise.radius) {
        enemy.state = 'alert';
        enemy.alertTimer = Math.max(enemy.alertTimer, 0.35);
      }
    }

    if (enemy.state === 'alert') {
      enemy.alertTimer -= dt * 0.4;
      if (enemy.alertTimer <= 0) {
        enemy.alertTimer = 0;
        enemy.state = 'patrol';
      }
    }

    if (enemy.state === 'alert' && enemy.alertTimer >= 0.6) {
      enemy.state = 'chase';
    }

    let target;
    if (enemy.state === 'chase' || enemy.state === 'alert') {
      target = { x: player.x, y: player.y };
    } else {
      target = enemy.path[enemy.patrolIndex];
      const arrive = vecLength(enemy.x - target.x, enemy.y - target.y);
      if (arrive < 6) enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.path.length;
    }

    const dirX = target.x - enemy.x;
    const dirY = target.y - enemy.y;
    const len = vecLength(dirX, dirY) || 1;
    const speed = enemy.state === 'chase' ? enemy.speed + 30 : enemy.state === 'alert' ? enemy.speed + 10 : enemy.speed;
    const dx = (dirX / len) * speed * dt;
    const dy = (dirY / len) * speed * dt;
    moveWithCollisions(enemy, dx, dy, level.walls);

    // Player collision
    const enemyRect = { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h };
    if (player.alive && rectsIntersect(enemyRect, playerRect)) {
      player.alive = false;
      player.status = 'Down';
      gameStarted = false;
      readyNextWave = false;
      currentWave = 1;
      combo = 0;
      triggerShake(18, 0.45);
      updateHud();
      showOverlay('You were taken out. Press R or Start to retry wave 1.', true);
      stateLabel.textContent = 'Status: Down';
    }
  }
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  if (cameraShakeTime > 0 && cameraShakeDuration > 0) {
    const falloff = (cameraShakeTime / cameraShakeDuration) ** 2;
    const shakeAmount = cameraShakeMagnitude * falloff;
    const offsetX = (Math.random() * 2 - 1) * shakeAmount;
    const offsetY = (Math.random() * 2 - 1) * shakeAmount;
    ctx.translate(offsetX, offsetY);
  }
  drawGrid();

  // Walls
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  for (const wall of level.walls) {
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  }

  // Vision cones
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.state === 'stunned') continue;
    ctx.save();
    ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
    ctx.rotate(enemy.facing);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const visionRange = enemy.visionRange || VISION_RANGE;
    ctx.arc(0, 0, visionRange, -VISION_FOV / 2, VISION_FOV / 2);
    ctx.closePath();
    ctx.fillStyle = enemy.state === 'chase' ? 'rgba(255, 140, 66, 0.08)' : 'rgba(255, 237, 101, 0.06)';
    ctx.fill();
    ctx.restore();
  }

  // Bullets
  ctx.fillStyle = '#ff3cac';
  for (const bullet of bullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(bullet.angle);
    ctx.fillRect(-3, -3, 12, 6);
    ctx.restore();
  }

  // Impact sparks
  for (const spark of hitSparks) {
    const lifeT = spark.life / spark.maxLife;
    const radius = 16 * (1 - lifeT) + 8;
    ctx.save();
    ctx.globalAlpha = lifeT;
    ctx.strokeStyle = 'rgba(255, 140, 66, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(spark.x, spark.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Enemies
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    ctx.fillStyle = enemy.state === 'chase' ? '#ff8c42' : '#ffed65';
    ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h);
    if (enemy.state === 'stunned') {
      ctx.strokeStyle = '#2de2e6';
      ctx.strokeRect(enemy.x - 2, enemy.y - 2, enemy.w + 4, enemy.h + 4);
    }
  }

  // Player
  ctx.save();
  const px = player.x + player.w / 2;
  const py = player.y + player.h / 2;
  player.angle = Math.atan2(mouse.y - py, mouse.x - px);
  ctx.translate(px, py);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.alive ? '#2de2e6' : '#5b647a';
  ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
  ctx.fillStyle = '#ff3cac';
  ctx.fillRect(6, -3, 10, 6); // a small muzzle highlight
  ctx.restore();

  // Muzzle flashes and melee trails
  for (const flash of muzzleFlashes) {
    const lifeT = flash.life / flash.maxLife;
    const length = 26 * lifeT + 10;
    ctx.save();
    ctx.translate(flash.x, flash.y);
    ctx.rotate(flash.angle);
    ctx.globalAlpha = lifeT;
    ctx.fillStyle = 'rgba(255, 240, 180, 0.9)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, -6 * lifeT);
    ctx.lineTo(length, 6 * lifeT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // HUD markers
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // Objectives
  ctx.fillStyle = 'rgba(45, 226, 230, 0.18)';
  ctx.fillRect(940, 620, 32, 32);
  ctx.strokeStyle = '#2de2e6';
  ctx.strokeRect(940, 620, 32, 32);
  ctx.restore();

  // Alert edge glow
  if (alertGlow > 0) {
    const alpha = 0.32 * alertGlow;
    const thickness = 46;
    ctx.save();
    const leftGrad = ctx.createLinearGradient(0, 0, thickness, 0);
    leftGrad.addColorStop(0, `rgba(255, 64, 64, ${alpha})`);
    leftGrad.addColorStop(1, 'rgba(255, 64, 64, 0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, thickness, height);

    const rightGrad = ctx.createLinearGradient(width, 0, width - thickness, 0);
    rightGrad.addColorStop(0, `rgba(255, 64, 64, ${alpha})`);
    rightGrad.addColorStop(1, 'rgba(255, 64, 64, 0)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(width - thickness, 0, thickness, height);

    const topGrad = ctx.createLinearGradient(0, 0, 0, thickness);
    topGrad.addColorStop(0, `rgba(255, 64, 64, ${alpha})`);
    topGrad.addColorStop(1, 'rgba(255, 64, 64, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, width, thickness);

    const bottomGrad = ctx.createLinearGradient(0, height, 0, height - thickness);
    bottomGrad.addColorStop(0, `rgba(255, 64, 64, ${alpha})`);
    bottomGrad.addColorStop(1, 'rgba(255, 64, 64, 0)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, height - thickness, width, thickness);
    ctx.restore();
  }
}

function checkWin() {
  const remaining = enemies.some((e) => e.alive);
  if (!remaining && player.alive) {
    gameStarted = false;
    readyNextWave = true;
    player.status = 'Clear';
    stateLabel.textContent = 'Status: Clear';
    combo = 0;
    comboTimer = 0;
    currentWave += 1;
    const upcoming = getWaveConfig(currentWave);
    updateHud();
    showOverlay(`Wave cleared. Start wave ${currentWave}? (${upcoming.label})`, true);
  }
}

function update(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.05);
  lastTime = timestamp;

  if (player.alive && gameStarted) {
    handleInput(dt);
    updateBullets(dt);
    updateNoises(dt);
    updateEnemies(dt);
    checkWin();
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        combo = 0;
        updateHud();
      }
    }
  }

  updateEffects(dt);
  draw();
  requestAnimationFrame(update);
}

// Input listeners
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'r' || e.key === 'R') {
    beginRun();
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && !gameStarted) {
    startFromOverlay();
    return;
  }
  if (!gameStarted) return;
  if (['1', '2', '3'].includes(e.key)) {
    currentMask = Number(e.key) - 1;
    const ammoBefore = player ? player.ammo : 0;
    const wasAlive = player?.alive;
    const ammoDelta = masks[currentMask].ammoBonus;
    if (wasAlive) {
      player.ammo = clamp(player.ammo + ammoDelta, 0, 12);
    }
    player.speed = 210 * masks[currentMask].speed;
    updateHud();
    return;
  }
  keys.add(e.key === ' ' ? 'Space' : e.key);
});

window.addEventListener('keyup', (e) => {
  if (!gameStarted) return;
  keys.delete(e.key === ' ' ? 'Space' : e.key);
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
});

canvas.addEventListener('mousedown', (e) => {
  if (!gameStarted) return;
  if (e.button === 0) {
    shooting = true;
    shoot();
  }
  if (e.button === 2) {
    meleeing = true;
    meleeStrike();
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (!gameStarted) return;
  if (e.button === 0) shooting = false;
  if (e.button === 2) meleeing = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

startBtn.addEventListener('click', () => startFromOverlay());

reset({ keepOverlay: true });
showOverlay(`Press Enter or click Start to drop into wave ${currentWave} (${getWaveConfig(currentWave).label}).`, true);
requestAnimationFrame(update);
