"use client";

import { useEffect, useRef, useState } from "react";

const BASE_COOLDOWN_MS = 500;
const MIN_COOLDOWN_MS = 100;
const COOLDOWN_STEP = 50;
const BASE_DAMAGE = 20;
const BASE_NORMAL_HEALTH = 20;
const DAMAGE_STEP = 5;
const MAX_DAMAGE_LEVEL = 1000000000;
const MAX_LIVES = 3;
const PLAYER_X = 80;
const PLAYER_SIZE = 64;
const PROJECTILE_SPEED = 760;
const SOLDIER_COOLDOWN_MS = 900;
const SOLDIER_PROJECTILE_SPEED = PROJECTILE_SPEED;
const SOLDIER_DAMAGE_RATIO = 0.6;
const BOSS_WAVE_INTERVAL = 10;
const BOSS_BASE_HEALTH = 100;

const randomBetween = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const buildSoldierPositions = (count, height) => {
  if (count <= 0) {
    return [];
  }

  const spacing = 90;
  const totalHeight = (count - 1) * spacing;
  const start = height / 2 - totalHeight / 2;

  return Array.from({ length: count }, (_, index) =>
    clamp(start + index * spacing, 70, height - 70)
  );
};

export default function Home() {
  const [runners, setRunners] = useState([]);
  const [projectiles, setProjectiles] = useState([]);
  const [sparks, setSparks] = useState([]);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [playerY, setPlayerY] = useState(260);
  const [lives, setLives] = useState(MAX_LIVES);
  const [wave, setWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [silver, setSilver] = useState(0);
  const [gold, setGold] = useState(0);
  const [damageLevel, setDamageLevel] = useState(1);
  const [cooldownLevel, setCooldownLevel] = useState(1);
  const [soldiers, setSoldiers] = useState(0);
  const [soldierAngles, setSoldierAngles] = useState([]);
  const [shopOpen, setShopOpen] = useState(false);

  const stageRef = useRef(null);
  const runnerIdRef = useRef(1);
  const projectileIdRef = useRef(1);
  const spawnTimerRef = useRef(null);
  const waveTimerRef = useRef(null);
  const runnersRef = useRef([]);
  const projectilesRef = useRef([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const playerYRef = useRef(playerY);
  const sizeRef = useRef({ width: 1200, height: 800 });
  const totalToSpawnRef = useRef(0);
  const spawnedRef = useRef(0);
  const wavePendingRef = useRef(false);
  const soldiersRef = useRef(0);
  const damageRef = useRef(BASE_DAMAGE);
  const soldierShotRef = useRef(0);
  const soldierAnglesRef = useRef([]);
  const shopOpenRef = useRef(false);

  const damage = BASE_DAMAGE + (damageLevel - 1) * DAMAGE_STEP;
  const cooldownMs = Math.max(
    MIN_COOLDOWN_MS,
    BASE_COOLDOWN_MS - (cooldownLevel - 1) * COOLDOWN_STEP
  );
  const damageCost = 60 + (damageLevel - 1) * 35;
  const cooldownCost = 80 + (cooldownLevel - 1) * 45;
  const soldierCostSilver = 140 + soldiers * 90;
  const soldierCostGold = Math.floor(soldiers / 2);

  const soldierPositions = buildSoldierPositions(soldiers, sizeRef.current.height);
  const isBossWave = wave % BOSS_WAVE_INTERVAL === 0;
  const bossRunner = runners.find((runner) => runner.type === "boss");
  const bossHealthRatio = bossRunner
    ? bossRunner.health / bossRunner.maxHealth
    : 0;

  useEffect(() => {
    soldiersRef.current = soldiers;
  }, [soldiers]);

  useEffect(() => {
    setSoldierAngles((prev) => {
      const next = Array.from({ length: soldiers }, (_, index) => prev[index] ?? 0);
      soldierAnglesRef.current = next;
      return next;
    });
  }, [soldiers]);

  useEffect(() => {
    damageRef.current = damage;
  }, [damage]);

  useEffect(() => {
    shopOpenRef.current = shopOpen;
    if (shopOpen && waveTimerRef.current) {
      window.clearTimeout(waveTimerRef.current);
    }
    if (shopOpen) {
      wavePendingRef.current = false;
    }
  }, [shopOpen]);

  useEffect(() => {
    soldierAnglesRef.current = soldierAngles;
  }, [soldierAngles]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Tab") {
        return;
      }

      event.preventDefault();
      if (gameOver) {
        return;
      }

      setShopOpen((prev) => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameOver]);

  useEffect(() => {
    if (gameOver) {
      setShopOpen(false);
    }
  }, [gameOver]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setNow(Date.now());
    }, 50);

    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const updateSize = () => {
      sizeRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    const { width, height } = sizeRef.current;
    mouseRef.current = { x: width * 0.7, y: height * 0.5 };
    playerYRef.current = height * 0.5;
    setPlayerY(height * 0.5);
  }, []);

  useEffect(() => {
    const sparkCount = 10;
    const items = Array.from({ length: sparkCount }, (_, index) => ({
      id: index,
      left: randomBetween(0, window.innerWidth),
      top: randomBetween(0, window.innerHeight),
      delay: randomBetween(0, 6),
      size: randomBetween(8, 18),
    }));

    setSparks(items);
  }, []);

  useEffect(() => {
    if (gameOver) {
      return undefined;
    }

    const minSpeed = 90 + wave * 8;
    const maxSpeed = 150 + wave * 12;
    const minDelay = Math.max(260, 920 - wave * 45);
    const maxDelay = Math.max(420, 1250 - wave * 55);
    const normalHealth = BASE_NORMAL_HEALTH + Math.max(0, wave - 1) * 2;
    const totalToSpawn = isBossWave ? 1 : Math.min(3 + (wave - 1) * 2, 26);

    totalToSpawnRef.current = totalToSpawn;
    spawnedRef.current = 0;
    wavePendingRef.current = false;

    const spawnOne = () => {
      if (gameOver) {
        return;
      }

      if (shopOpenRef.current) {
        spawnTimerRef.current = window.setTimeout(spawnOne, 300);
        return;
      }

      const { height, width } = sizeRef.current;
      const size = isBossWave ? randomBetween(200, 260) : randomBetween(70, 140);
      const topLimit = Math.max(40, height - size - 40);

      const bossHealth =
        BOSS_BASE_HEALTH + Math.max(0, wave - BOSS_WAVE_INTERVAL) * 10;

      const runner = {
        id: runnerIdRef.current++,
        x: width + randomBetween(20, 160),
        y: randomBetween(40, topLimit),
        size,
        speed: isBossWave
          ? randomBetween(52, 70) + wave * 1.5
          : randomBetween(minSpeed, maxSpeed),
        type: isBossWave ? "boss" : "normal",
        health: isBossWave ? bossHealth : normalHealth,
        maxHealth: isBossWave ? bossHealth : normalHealth,
      };

      setRunners((prev) => {
        const next = [...prev, runner];
        runnersRef.current = next;
        return next;
      });

      spawnedRef.current += 1;
      if (spawnedRef.current < totalToSpawnRef.current) {
        spawnTimerRef.current = window.setTimeout(
          spawnOne,
          randomBetween(minDelay, maxDelay)
        );
      }
    };

    spawnTimerRef.current = window.setTimeout(
      spawnOne,
      randomBetween(240, 640)
    );

    return () => {
      if (spawnTimerRef.current) {
        window.clearTimeout(spawnTimerRef.current);
      }
    };
  }, [wave, gameOver, isBossWave]);

  useEffect(() => {
    let frameId = 0;
    let lastTime = performance.now();

    const step = (time) => {
      const delta = Math.min(0.04, (time - lastTime) / 1000);
      lastTime = time;

      const { width, height } = sizeRef.current;
      if (!gameOver && !shopOpenRef.current) {
        const targetY = clamp(mouseRef.current.y, 40, height - 40);
        const nextPlayerY =
          playerYRef.current +
          (targetY - playerYRef.current) * Math.min(1, delta * 8);

        playerYRef.current = nextPlayerY;
        setPlayerY(nextPlayerY);

        let lostLives = 0;

        let nextRunners = runnersRef.current
          .map((runner) => ({
            ...runner,
            x: runner.x - runner.speed * delta,
          }))
          .filter((runner) => {
            if (runner.x + runner.size < 0) {
              lostLives += 1;
              return false;
            }
            return true;
          });

        let nextProjectiles = projectilesRef.current
          .map((projectile) => ({
            ...projectile,
            x: projectile.x + projectile.vx * delta,
            y: projectile.y + projectile.vy * delta,
          }))
          .filter(
            (projectile) =>
              projectile.x > -40 &&
              projectile.x < width + 40 &&
              projectile.y > -40 &&
              projectile.y < height + 40
          );

        if (soldiersRef.current > 0 && nextRunners.length > 0) {
          if (time - soldierShotRef.current >= SOLDIER_COOLDOWN_MS) {
            const soldierSlots = buildSoldierPositions(
              soldiersRef.current,
              height
            );
            const newShots = [];
            const previousAngles = soldierAnglesRef.current;
            const nextAngles = soldierSlots.map(
              (_, index) => previousAngles[index] ?? 0
            );
            const soldierDamage = Math.max(
              6,
              Math.round(damageRef.current * SOLDIER_DAMAGE_RATIO)
            );
            const soldierX = PLAYER_X - 6;
            const availableTargets = [...nextRunners];

            const findNearestTarget = (soldierY, pool, removeTarget) => {
              let bestIndex = -1;
              let bestDistance = Infinity;

              pool.forEach((runner, index) => {
                const runnerMid = runner.y + runner.size * 0.5;
                const distance = Math.abs(runnerMid - soldierY);
                if (distance < bestDistance) {
                  bestDistance = distance;
                  bestIndex = index;
                }
              });

              if (bestIndex < 0) {
                return null;
              }

              if (removeTarget) {
                const [target] = pool.splice(bestIndex, 1);
                return target ?? null;
              }

              return pool[bestIndex] ?? null;
            };

            soldierSlots.forEach((soldierY, index) => {
              let target = findNearestTarget(soldierY, availableTargets, true);
              if (!target) {
                target = findNearestTarget(soldierY, nextRunners, false);
              }

              if (!target) {
                return;
              }

              const targetX = target.x + target.size * 0.5;
              const targetY = target.y + target.size * 0.5;
              const targetVx = -target.speed;
              const targetVy = 0;
              const dx = targetX - soldierX;
              const dy = targetY - soldierY;
              const speed = SOLDIER_PROJECTILE_SPEED;
              const a = targetVx * targetVx + targetVy * targetVy - speed * speed;
              const b = 2 * (dx * targetVx + dy * targetVy);
              const c = dx * dx + dy * dy;
              let t = 0;

              if (Math.abs(a) < 0.001) {
                if (Math.abs(b) > 0.001) {
                  t = -c / b;
                }
              } else {
                const discriminant = b * b - 4 * a * c;
                if (discriminant >= 0) {
                  const sqrt = Math.sqrt(discriminant);
                  const t1 = (-b - sqrt) / (2 * a);
                  const t2 = (-b + sqrt) / (2 * a);
                  t = Math.min(t1, t2);
                  if (t < 0) {
                    t = Math.max(t1, t2);
                  }
                }
              }

              if (!Number.isFinite(t) || t <= 0) {
                t = 0;
              }

              const aimX = targetX + targetVx * t;
              const aimY = targetY + targetVy * t;
              const angle = Math.atan2(aimY - soldierY, aimX - soldierX);
              const angleDeg = (angle * 180) / Math.PI;
              nextAngles[index] = angleDeg;

              newShots.push({
                id: projectileIdRef.current++,
                x: soldierX + 30,
                y: soldierY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                angle: angleDeg,
                damage: soldierDamage,
              });
            });

            if (nextAngles.length > 0) {
              soldierAnglesRef.current = nextAngles;
              setSoldierAngles(nextAngles);
            }

            if (newShots.length > 0) {
              nextProjectiles = [...nextProjectiles, ...newShots];
            }

            soldierShotRef.current = time;
          }
        }

        const remainingProjectiles = [];
        const updatedRunners = [...nextRunners];
        let silverEarned = 0;
        let goldEarned = 0;

        nextProjectiles.forEach((projectile) => {
          let hitIndex = -1;

          for (let i = 0; i < updatedRunners.length; i += 1) {
            const runner = updatedRunners[i];
            if (
              projectile.x > runner.x &&
              projectile.x < runner.x + runner.size &&
              projectile.y > runner.y &&
              projectile.y < runner.y + runner.size
            ) {
              hitIndex = i;
              break;
            }
          }

          if (hitIndex >= 0) {
            const runner = updatedRunners[hitIndex];
            runner.health -= projectile.damage;
            if (runner.health <= 0) {
              if (runner.type === "boss") {
                goldEarned += 5;
              } else {
                silverEarned += 10;
              }
              updatedRunners.splice(hitIndex, 1);
            }
          } else {
            remainingProjectiles.push(projectile);
          }
        });

        if (silverEarned > 0) {
          setSilver((prev) => prev + silverEarned);
        }
        if (goldEarned > 0) {
          setGold((prev) => prev + goldEarned);
        }

        if (
          !wavePendingRef.current &&
          totalToSpawnRef.current > 0 &&
          spawnedRef.current >= totalToSpawnRef.current &&
          updatedRunners.length === 0
          && !shopOpenRef.current
        ) {
          wavePendingRef.current = true;
          waveTimerRef.current = window.setTimeout(() => {
            setWave((prev) => prev + 1);
          }, 1200);
        }

        if (lostLives > 0) {
          setLives((prev) => {
            const next = Math.max(0, prev - lostLives);
            if (next === 0) {
              setGameOver(true);
            }
            return next;
          });
        }

        runnersRef.current = updatedRunners;
        projectilesRef.current = remainingProjectiles;
        setRunners(updatedRunners);
        setProjectiles(remainingProjectiles);
      }

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frameId);
  }, [gameOver]);

  const cooldownRemaining = Math.max(0, cooldownUntil - now);
  const canAttack = cooldownRemaining === 0;
  const cooldownRatio = Math.min(
    1,
    Math.max(0, cooldownRemaining / cooldownMs)
  );
  const cooldownFill = 1 - cooldownRatio;
  const cooldownSeconds = (cooldownRemaining / 1000).toFixed(1);

  const isDamageMaxed = damageLevel >= MAX_DAMAGE_LEVEL;
  const canBuyDamage = !gameOver && silver >= damageCost && !isDamageMaxed;
  const isCooldownMaxed = cooldownMs <= MIN_COOLDOWN_MS;
  const canBuyCooldown = !gameOver && silver >= cooldownCost && !isCooldownMaxed;
  const canBuySoldier =
    !gameOver && silver >= soldierCostSilver && gold >= soldierCostGold;

  const handleShoot = () => {
    if (gameOver || shopOpen || !canAttack) {
      return;
    }

    const angle = Math.atan2(
      mouseRef.current.y - playerYRef.current,
      mouseRef.current.x - PLAYER_X
    );

    const projectile = {
      id: projectileIdRef.current++,
      x: PLAYER_X + PLAYER_SIZE * 0.6,
      y: playerYRef.current,
      vx: Math.cos(angle) * PROJECTILE_SPEED,
      vy: Math.sin(angle) * PROJECTILE_SPEED,
      angle: (angle * 180) / Math.PI,
      damage,
    };

    setCooldownUntil(Date.now() + cooldownMs);
    setProjectiles((prev) => {
      const next = [...prev, projectile];
      projectilesRef.current = next;
      return next;
    });
  };

  const handleMouseMove = (event) => {
    mouseRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerDown = (event) => {
    if (gameOver || shopOpen) {
      return;
    }

    handleMouseMove(event);
    handleShoot();
  };

  const handleBuyDamage = () => {
    if (!canBuyDamage) {
      return;
    }

    setSilver((prev) => prev - damageCost);
    setDamageLevel((prev) => prev + 1);
  };

  const handleBuyCooldown = () => {
    if (!canBuyCooldown) {
      return;
    }

    setSilver((prev) => prev - cooldownCost);
    setCooldownLevel((prev) => prev + 1);
  };

  const handleBuySoldier = () => {
    if (!canBuySoldier) {
      return;
    }

    setSilver((prev) => prev - soldierCostSilver);
    setGold((prev) => prev - soldierCostGold);
    setSoldiers((prev) => prev + 1);
  };

  const handleRestart = () => {
    if (spawnTimerRef.current) {
      window.clearTimeout(spawnTimerRef.current);
    }
    if (waveTimerRef.current) {
      window.clearTimeout(waveTimerRef.current);
    }

    runnersRef.current = [];
    projectilesRef.current = [];
    totalToSpawnRef.current = 0;
    spawnedRef.current = 0;
    wavePendingRef.current = false;

    setRunners([]);
    setProjectiles([]);
    setCooldownUntil(0);
    setLives(MAX_LIVES);
    setWave(1);
    setGameOver(false);
    setSilver(0);
    setGold(0);
    setDamageLevel(1);
    setCooldownLevel(1);
    setSoldiers(0);
    setShopOpen(false);
    setSoldierAngles([]);
  };

  const aimAngle = Math.atan2(
    mouseRef.current.y - playerY,
    mouseRef.current.x - PLAYER_X
  );
  const aimDegrees = (aimAngle * 180) / Math.PI;

  return (
    <div
      ref={stageRef}
      className="stage"
      onMouseMove={handleMouseMove}
      onPointerMove={handleMouseMove}
      onPointerDown={handlePointerDown}
    >
      <div className="absolute left-6 top-6 z-20 rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-200 backdrop-blur">
        Jo Defense
      </div>

      <div className="wave-pill">Wave {wave}</div>

      {bossRunner ? (
        <div className="boss-bar" onPointerDown={(event) => event.stopPropagation()}>
          <div className="boss-bar-label">Boss</div>
          <div className="boss-bar-track">
            <div
              className="boss-bar-fill"
              style={{ width: `${bossHealthRatio * 100}%` }}
            />
          </div>
          <div className="boss-bar-value">
            {Math.max(0, Math.ceil(bossRunner.health))} / {bossRunner.maxHealth}
          </div>
        </div>
      ) : null}

      <div className="lives-indicator">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
          Lives
        </div>
        <div className="lives-dots">
          {Array.from({ length: MAX_LIVES }).map((_, index) => (
            <span
              key={`life-${index}`}
              className={`life-dot ${index < lives ? "life-on" : "life-off"}`}
            />
          ))}
        </div>
      </div>

      {shopOpen ? (
        <div
          className="shop-overlay"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onMouseMove={(event) => event.stopPropagation()}
        >
          <div
            className="shop-panel"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="economy-header">Vault</div>
            <div className="coin-row">
              <span className="coin coin-silver" />
              <span className="coin-label">{silver} silver</span>
            </div>
            <div className="coin-row">
              <span className="coin coin-gold" />
              <span className="coin-label">{gold} gold</span>
            </div>

            <div className="stat-row">Damage: {damage}</div>
            <div className="stat-row">Cooldown: {cooldownMs}ms</div>
            <div className="stat-row">Soldiers: {soldiers}</div>

            <div className="shop-section">Weapon Upgrades</div>
            <button
              type="button"
              className="shop-button"
              onClick={handleBuyDamage}
              disabled={!canBuyDamage}
            >
              {isDamageMaxed
                ? "MAXED OUT"
                : `Damage +${DAMAGE_STEP} (${damageCost} silver)`}
            </button>
            <button
              type="button"
              className="shop-button"
              onClick={handleBuyCooldown}
              disabled={!canBuyCooldown}
            >
              {isCooldownMaxed
                ? "MAXED OUT"
                : `Cooldown -${COOLDOWN_STEP}ms (${cooldownCost} silver)`}
            </button>

            <div className="shop-section">Support</div>
            <button
              type="button"
              className="shop-button"
              onClick={handleBuySoldier}
              disabled={!canBuySoldier}
            >
              Hire Soldier ({soldierCostSilver} silver
              {soldierCostGold > 0 ? ` + ${soldierCostGold} gold` : ""})
            </button>
            <div className="shop-hint">Press Tab to resume</div>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-0 z-0">
        {sparks.map((spark) => (
          <span
            key={spark.id}
            className="spark"
            style={{
              left: `${spark.left}px`,
              top: `${spark.top}px`,
              animationDelay: `${spark.delay}s`,
              width: `${spark.size}px`,
              height: `${spark.size}px`,
            }}
          />
        ))}
      </div>

      <div className="player" style={{ top: `${playerY}px` }}>
        <div className="player-core" />
        <div
          className="player-barrel"
          style={{ transform: `translateY(-50%) rotate(${aimDegrees}deg)` }}
        />
      </div>

      {soldierPositions.map((soldierY, index) => (
        <div
          key={`soldier-${index}`}
          className="soldier"
          style={{ top: `${soldierY}px` }}
        >
          <div className="soldier-core" />
          <div
            className="soldier-barrel"
            style={{
              transform: `translateY(-50%) rotate(${soldierAngles[index] ?? 0}deg)`,
            }}
          />
        </div>
      ))}

      {projectiles.map((projectile) => (
        <span
          key={projectile.id}
          className="projectile"
          style={{
            left: `${projectile.x}px`,
            top: `${projectile.y}px`,
            transform: `translate(-50%, -50%) rotate(${projectile.angle}deg)`,
          }}
        />
      ))}

      {runners.map((runner) => (
        <img
          key={runner.id}
          src="/jo.png"
          alt={runner.type === "boss" ? "Boss Jo" : "Jo invader"}
          className={runner.type === "boss" ? "runner runner-boss" : "runner"}
          style={{
            left: `${runner.x}px`,
            top: `${runner.y}px`,
            width: `${runner.size}px`,
          }}
        />
      ))}

      <div
        className="cooldown-card"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
          Cooldown
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div
            className="cooldown-ring"
            style={{
              background: `conic-gradient(#38bdf8 ${
                cooldownFill * 360
              }deg, rgba(255, 255, 255, 0.12) 0deg)`,
            }}
          >
            <div className="cooldown-center">
              {canAttack ? "Ready" : `${cooldownSeconds}s`}
            </div>
          </div>
          <div className="text-sm text-slate-100">
            {canAttack ? "Attack ready" : "Recharging"}
          </div>
        </div>
        <div className="mt-3 h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-sky-400 transition-[width] duration-100"
            style={{ width: `${cooldownFill * 100}%` }}
          />
        </div>
      </div>

      {gameOver ? (
        <div className="game-over">
          <div
            className="game-over-card"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="game-over-title">Game Over</div>
            <div className="game-over-sub">You reached wave {wave}</div>
            <button
              type="button"
              className="game-over-button"
              onClick={handleRestart}
            >
              Restart
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
