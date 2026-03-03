import { useEffect, useRef, useState, useCallback } from 'react';
import { Engine } from './game/engine';
import { HOTBAR_BLOCKS, BLOCKS, ALL_BLOCKS } from './game/blocks';
import { HealthState } from './game/health';
import './App.css';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [slot, setSlot] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });
  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [dayTime, setDayTime] = useState(0.3);
  const [fps, setFps] = useState(0);
  const [showInventory, setShowInventory] = useState(false);
  const [hp, setHp] = useState<HealthState>({ hp: 20, maxHp: 20, isDead: false, damageFlash: 0 });
  const [isDead, setIsDead] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const notifTimer = useRef<number>(0);

  const toggleInventory = useCallback(() => {
    setShowInventory(v => !v);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || engineRef.current) return;
    const engine = new Engine(canvasRef.current);
    engineRef.current = engine;
    engine.onHotbarChange = setSlot;
    engine.onPositionChange = setPos;
    engine.onLockChange = setLocked;
    engine.onTimeChange = setDayTime;
    engine.onFpsChange = setFps;
    engine.onInventoryToggle = toggleInventory;
    engine.onHealthChange = setHp;
    engine.onDeath = () => setIsDead(true);
    engine.onNotification = (msg) => {
      setNotification(msg);
      clearTimeout(notifTimer.current);
      notifTimer.current = window.setTimeout(() => setNotification(null), 2000);
    };
    engine.start();
    return () => { engine.stop(); engineRef.current = null; };
  }, [toggleInventory]);

  const timeLabel = (() => {
    if (dayTime < 0.2) return 'Night';
    if (dayTime < 0.3) return 'Dawn';
    if (dayTime < 0.7) return 'Day';
    if (dayTime < 0.8) return 'Dusk';
    return 'Night';
  })();

  const sunAngle = dayTime * 360;

  return (
    <div className="game">
      <canvas ref={canvasRef} />

      {!started && (
        <div className="overlay" onClick={() => setStarted(true)}>
          <h1>MyCraft</h1>
          <p className="subtitle">クリックしてゲームを開始</p>
          <div className="controls">
            <p>WASD: 移動 / Space: ジャンプ / Shift: ダッシュ</p>
            <p>左クリック: 破壊 / 右クリック: 設置</p>
            <p>1-9 or スクロール: 選択 / E: インベントリ</p>
            <p>F5: セーブ / F9: ロード / ESC: マウス解放</p>
          </div>
        </div>
      )}

      {started && !locked && !showInventory && (
        <div className="pause-msg">クリックしてプレイを再開</div>
      )}

      <div className="crosshair">+</div>

      {/* Debug info */}
      <div className="debug">
        <div>{fps} FPS</div>
        <div>X:{pos.x} Y:{pos.y} Z:{pos.z}</div>
        <div>{timeLabel}</div>
      </div>

      {/* Time indicator */}
      <div className="time-indicator">
        <div className="sun-track">
          <div className="sun-dot" style={{ transform: `rotate(${sunAngle}deg) translateY(-12px)` }}>
            {dayTime > 0.2 && dayTime < 0.8 ? '\u2600' : '\u263D'}
          </div>
        </div>
      </div>

      {/* Hotbar */}
      <div className="hotbar">
        {HOTBAR_BLOCKS.map((bt, i) => (
          <div key={i} className={`slot${i === slot ? ' active' : ''}`}>
            <div className="block-icon" style={{ backgroundColor: BLOCKS[bt]?.color }} />
            <span className="slot-num">{i + 1}</span>
          </div>
        ))}
        <div className="slot-label">{BLOCKS[HOTBAR_BLOCKS[slot]]?.name}</div>
      </div>

      {/* Hearts */}
      <div className="hearts">
        {Array.from({ length: Math.ceil(hp.maxHp / 2) }, (_, i) => {
          const val = hp.hp - i * 2;
          return (
            <span key={i} className={`heart${val >= 2 ? ' full' : val === 1 ? ' half' : ' empty'}`} />
          );
        })}
      </div>

      {/* Damage flash */}
      {hp.damageFlash > 0 && (
        <div className="damage-flash" style={{ opacity: hp.damageFlash * 0.4 }} />
      )}

      {/* Death screen */}
      {isDead && (
        <div className="death-screen">
          <h2>You Died!</h2>
          <button onClick={() => { engineRef.current?.respawn(); setIsDead(false); }}>
            Respawn
          </button>
        </div>
      )}

      {/* Notification toast */}
      {notification && <div className="notification">{notification}</div>}

      {/* Inventory */}
      {showInventory && (
        <div className="inventory-overlay" onClick={() => setShowInventory(false)}>
          <div className="inventory" onClick={e => e.stopPropagation()}>
            <h2>Inventory</h2>
            <div className="inv-grid">
              {ALL_BLOCKS.map(bt => (
                <div
                  key={bt}
                  className="inv-slot"
                  onClick={() => {
                    engineRef.current?.selectBlock(bt);
                    setShowInventory(false);
                  }}
                >
                  <div className="block-icon" style={{ backgroundColor: BLOCKS[bt]?.color }} />
                  <span className="inv-name">{BLOCKS[bt]?.name}</span>
                </div>
              ))}
            </div>
            <p className="inv-hint">クリックで選択 / ESC or Eで閉じる</p>
          </div>
        </div>
      )}
    </div>
  );
}
