// health.ts -- Pure logic module for HP, fall damage, death and respawn.
// No Three.js dependency.

export interface HealthState {
  hp: number;
  maxHp: number;
  isDead: boolean;
  /** 0-1 value that fades over FLASH_DURATION seconds after taking damage. */
  damageFlash: number;
}

/** Duration (seconds) over which damageFlash fades from 1 to 0. */
const FLASH_DURATION = 0.3;

/** Seconds of invincibility after taking damage. */
const DAMAGE_COOLDOWN = 0.5;

/** Blocks of free-fall before damage starts (Minecraft vanilla = 3). */
const SAFE_FALL_DISTANCE = 3;

/** Default maximum HP (10 hearts x 2 HP each). */
const MAX_HP = 20;

export interface UpdateResult {
  /** Whether the player took damage this frame. */
  damaged: boolean;
  /** Whether the player died this frame. */
  died: boolean;
  /** Amount of damage dealt this frame (0 if none). */
  damage: number;
}

export class HealthSystem {
  state: HealthState;

  /**
   * The Y coordinate recorded the last time the player was standing on solid
   * ground.  Fall distance is measured from this value.
   */
  private lastGroundY: number;

  /** Whether the player was on the ground during the *previous* frame. */
  private wasOnGround: boolean;

  /** Remaining invincibility time (seconds). */
  private cooldownTimer: number;

  /**
   * When the player is in water we suppress fall-damage tracking because the
   * player is decelerating in liquid, not slamming into the ground.
   */
  private wasInWater: boolean;

  // ---- optional callbacks ------------------------------------------------

  /** Fired whenever hp changes (damage or heal). */
  onHpChange?: (state: HealthState) => void;

  /** Fired the moment the player dies (hp reaches 0). */
  onDeath?: () => void;

  // ---- construction ------------------------------------------------------

  constructor(spawnY: number) {
    this.state = {
      hp: MAX_HP,
      maxHp: MAX_HP,
      isDead: false,
      damageFlash: 0,
    };
    this.lastGroundY = spawnY;
    this.wasOnGround = true;
    this.wasInWater = false;
    this.cooldownTimer = 0;
  }

  // ---- public API --------------------------------------------------------

  /**
   * Call once per frame.
   *
   * @param dt        - Frame delta time in seconds.
   * @param playerY   - The player's current feet-level Y coordinate.
   * @param onGround  - Whether the player is currently standing on solid ground.
   * @param inWater   - Whether the player is currently in water (head or feet).
   *                    When true, fall tracking is reset so landing in water
   *                    negates fall damage -- just like vanilla Minecraft.
   */
  update(
    dt: number,
    playerY: number,
    onGround: boolean,
    inWater: boolean = false,
  ): UpdateResult {
    const result: UpdateResult = { damaged: false, died: false, damage: 0 };

    // Dead players do not process anything.
    if (this.state.isDead) return result;

    // ---- tick cooldown ---------------------------------------------------
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
    }

    // ---- tick damage flash -----------------------------------------------
    if (this.state.damageFlash > 0) {
      this.state.damageFlash = Math.max(0, this.state.damageFlash - dt / FLASH_DURATION);
    }

    // ---- water handling --------------------------------------------------
    // Entering water at any point resets the fall-damage baseline so that the
    // player does not accumulate distance while sinking through liquid.
    if (inWater) {
      this.lastGroundY = playerY;
      this.wasInWater = true;
      this.wasOnGround = onGround;
      return result;
    }

    // If the player *just* left water this frame, anchor the baseline to the
    // current position so only the distance fallen *after* leaving the water
    // counts.
    if (this.wasInWater && !inWater) {
      this.lastGroundY = playerY;
      this.wasInWater = false;
    }

    // ---- fall detection --------------------------------------------------
    // A "landing" is when the player transitions from airborne to grounded.
    if (onGround && !this.wasOnGround) {
      const fallDistance = this.lastGroundY - playerY;

      // Only apply damage for genuine downward falls.
      if (fallDistance > SAFE_FALL_DISTANCE) {
        const dmg = Math.floor(fallDistance - SAFE_FALL_DISTANCE);
        if (dmg > 0) {
          const applied = this.applyDamage(dmg);
          if (applied) {
            result.damaged = true;
            result.damage = dmg;
            result.died = this.state.isDead;
          }
        }
      }

      // Whether or not damage occurred, reset baseline on landing.
      this.lastGroundY = playerY;
    }

    // While on the ground, keep the baseline up to date.  This handles the
    // player walking up slopes or stairs -- we always want the *highest*
    // ground-level Y so that stepping off a ledge measures from the ledge top.
    if (onGround) {
      // Use the higher of current ground position or stored position.  Walking
      // downhill via slopes should NOT count as falling, because the player
      // remains on the ground the entire time (onGround stays true).
      this.lastGroundY = playerY;
    }

    this.wasOnGround = onGround;
    return result;
  }

  /**
   * Manually apply damage to the player (e.g. mob attacks, fire, drowning).
   * Respects the invincibility cooldown.
   *
   * @returns `true` if damage was actually applied (not blocked by cooldown).
   */
  takeDamage(amount: number): boolean {
    if (this.state.isDead) return false;
    if (amount <= 0) return false;
    return this.applyDamage(amount);
  }

  /**
   * Reset the player to full HP and clear death state.
   *
   * @param spawnY - The Y coordinate of the respawn point.
   */
  respawn(spawnY: number): void {
    this.state.hp = this.state.maxHp;
    this.state.isDead = false;
    this.state.damageFlash = 0;
    this.lastGroundY = spawnY;
    this.wasOnGround = true;
    this.wasInWater = false;
    this.cooldownTimer = 0;
    this.onHpChange?.(this.state);
  }

  // ---- internals ---------------------------------------------------------

  /**
   * Core damage application.  Handles cooldown gating, HP clamping, flash,
   * callbacks, and death.
   *
   * @returns `true` if damage went through.
   */
  private applyDamage(amount: number): boolean {
    if (this.cooldownTimer > 0) return false;

    const prev = this.state.hp;
    this.state.hp = Math.max(0, this.state.hp - amount);
    this.state.damageFlash = 1;
    this.cooldownTimer = DAMAGE_COOLDOWN;

    if (this.state.hp !== prev) {
      this.onHpChange?.(this.state);
    }

    if (this.state.hp <= 0) {
      this.state.isDead = true;
      this.onDeath?.();
    }

    return true;
  }
}
