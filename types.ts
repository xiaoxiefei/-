export enum Direction {
  Right = 1,
  Left = -1,
}

export enum GameState {
  MENU,
  PLAYING,
  GAME_OVER,
  VICTORY
}

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Entity extends Box {
  vx: number;
  vy: number;
  color: string;
  isDead: boolean;
}

export interface Bullet extends Entity {
  owner: 'player' | 'enemy';
  life: number;
}

export interface Enemy extends Entity {
  id: number;
  type: 'runner' | 'turret' | 'boss';
  hp: number;
  shootCooldown: number;
  state: 'idle' | 'running' | 'shooting';
  direction: Direction;
}

export interface Platform extends Box {
  type: 'solid' | 'pass-through';
}

export interface Player extends Entity {
  direction: Direction;
  isGrounded: boolean;
  isCrouching: boolean;
  shootCooldown: number;
  invincibleTimer: number;
  hp: number; // Lives
  score: number;
  state: 'idle' | 'run' | 'jump';
  facingVertical: 0 | 1 | -1; // 0 neutral, 1 up, -1 down
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  shoot: boolean;
}