import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  GameState, 
  InputState, 
  Player, 
  Bullet, 
  Enemy, 
  Platform, 
  Direction,
  Box
} from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  GRAVITY, 
  PLAYER_SPEED, 
  JUMP_FORCE, 
  BULLET_SPEED, 
  COLORS, 
  SHOOT_COOLDOWN,
  CAMERA_OFFSET_X,
  ENEMY_SPEED,
  LEVEL_LENGTH,
  SPRITES,
  PALETTE
} from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  setLives: (lives: number) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, setScore, setLives }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const musicTimerRef = useRef<number>();
  
  // Game State Refs (Mutable for performance in game loop)
  const playerRef = useRef<Player>({
    x: 100, y: 100, width: 24, height: 48, vx: 0, vy: 0, 
    color: 'blue', isDead: false, direction: Direction.Right,
    isGrounded: false, isCrouching: false, shootCooldown: 0,
    invincibleTimer: 0, hp: 3, score: 0, state: 'idle', facingVertical: 0
  });
  
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<any[]>([]); 
  const cameraRef = useRef({ x: 0 });
  const inputsRef = useRef<InputState>({ left: false, right: false, up: false, down: false, jump: false, shoot: false });
  const tickRef = useRef<number>(0); // For animation
  
  // Static Level Data
  const platformsRef = useRef<Platform[]>([]);

  // Initialize Audio Context
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  // Music Sequencer
  const scheduleMusic = useCallback(() => {
    if (gameState !== GameState.PLAYING || !audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    const tempo = 125;
    const secondsPerBeat = 60.0 / tempo;
    const lookahead = 0.1; 

    // Basic "Jungle" Style Loop
    // Bass: C2 ... Bb1 ...
    const bassLine = [
      65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 65.41, // C2
      58.27, 58.27, 58.27, 58.27, 58.27, 58.27, 58.27, 58.27  // Bb1
    ];
    
    // Melody (Simple Arp)
    const melody = [
      null, 261.63, null, 311.13, 392.00, null, 311.13, 261.63, // C4, Eb4, G4
      null, 233.08, null, 293.66, 349.23, null, 293.66, 233.08  // Bb3, D4, F4
    ];

    while (nextNoteTimeRef.current < ctx.currentTime + lookahead) {
       // Loop index
       const beatIndex = Math.floor(nextNoteTimeRef.current / (secondsPerBeat / 4));
       const step = beatIndex % 16;
       
       // Play Bass (Quarter notes - every 4th step)
       if (step % 2 === 0) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = bassLine[Math.floor(step/2)] || 65.41;
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          gain.gain.setValueAtTime(0.15, nextNoteTimeRef.current);
          gain.gain.exponentialRampToValueAtTime(0.01, nextNoteTimeRef.current + 0.1);
          
          osc.start(nextNoteTimeRef.current);
          osc.stop(nextNoteTimeRef.current + 0.15);
       }

       // Play Melody
       const note = melody[step];
       if (note) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.value = note;
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          gain.gain.setValueAtTime(0.1, nextNoteTimeRef.current);
          gain.gain.exponentialRampToValueAtTime(0.01, nextNoteTimeRef.current + 0.1);
          
          osc.start(nextNoteTimeRef.current);
          osc.stop(nextNoteTimeRef.current + 0.15);
       }
       
       // Advance
       nextNoteTimeRef.current += secondsPerBeat / 4; // 16th notes
    }
    
    musicTimerRef.current = window.setTimeout(scheduleMusic, 25);
  }, [gameState]);

  // Start Music on Game Start
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
       initAudio();
       nextNoteTimeRef.current = audioCtxRef.current?.currentTime || 0;
       scheduleMusic();
    } else {
       if (musicTimerRef.current) clearTimeout(musicTimerRef.current);
    }
    return () => {
      if (musicTimerRef.current) clearTimeout(musicTimerRef.current);
    };
  }, [gameState, initAudio, scheduleMusic]);


  // Initialize Level
  const initLevel = useCallback(() => {
    // Ground
    const plats: Platform[] = [];
    
    // Function to add solid ground chunks
    const addGround = (x: number, width: number) => {
      plats.push({ x, y: CANVAS_HEIGHT - 40, width, height: 40, type: 'solid' });
    };

    // Build Stage 1-like structure
    addGround(0, 800); // Start area
    addGround(900, 300); // Gap jump
    addGround(1300, 600); // Long run
    addGround(2000, 200); 
    addGround(2300, 1700); // Final stretch to boss
    
    // Floating Platforms
    const addPlat = (x: number, y: number, w: number) => {
      plats.push({ x, y, width: w, height: 10, type: 'pass-through' });
    };

    addPlat(400, 400, 100);
    addPlat(600, 300, 100);
    addPlat(950, 400, 100);
    addPlat(1400, 450, 100);
    addPlat(1600, 350, 100);
    addPlat(1800, 250, 100);
    
    // High platforms
    addPlat(2400, 400, 100);
    addPlat(2600, 300, 100);
    
    platformsRef.current = plats;

    // Reset Entities
    playerRef.current = {
      x: 100, y: 100, width: 24, height: 48, vx: 0, vy: 0, 
      color: 'blue', isDead: false, direction: Direction.Right,
      isGrounded: false, isCrouching: false, shootCooldown: 0,
      invincibleTimer: 0, hp: 3, score: 0, state: 'idle', facingVertical: 0
    };
    bulletsRef.current = [];
    enemiesRef.current = [];
    particlesRef.current = [];
    cameraRef.current = { x: 0 };
    tickRef.current = 0;

    // Spawn Enemies
    const spawnEnemy = (x: number, type: 'runner' | 'turret' | 'boss', y: number = 0) => {
       enemiesRef.current.push({
         id: Math.random(),
         x, 
         y: y === 0 ? CANVAS_HEIGHT - 88 : y, // Default ground runner height
         width: type === 'boss' ? 60 : 24,
         height: type === 'boss' ? 80 : 48,
         vx: 0, vy: 0,
         color: COLORS.ENEMY_RED,
         isDead: false,
         type,
         hp: type === 'boss' ? 50 : 1,
         shootCooldown: 0,
         state: 'idle',
         direction: Direction.Left
       });
    };

    spawnEnemy(600, 'runner');
    spawnEnemy(1000, 'turret', 350); // On platform
    spawnEnemy(1200, 'runner');
    spawnEnemy(1500, 'runner');
    spawnEnemy(1700, 'turret', 300);
    spawnEnemy(2200, 'runner');
    spawnEnemy(2500, 'runner');
    spawnEnemy(2800, 'runner');
    spawnEnemy(3500, 'boss', CANVAS_HEIGHT - 120);

  }, []);

  // Handle Input Events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyA': case 'ArrowLeft': inputsRef.current.left = true; break;
        case 'KeyD': case 'ArrowRight': inputsRef.current.right = true; break;
        case 'KeyW': case 'ArrowUp': inputsRef.current.up = true; break;
        case 'KeyS': case 'ArrowDown': inputsRef.current.down = true; break;
        case 'KeyK': case 'KeyZ': 
          if (!inputsRef.current.jump) inputsRef.current.jump = true; 
          break;
        case 'KeyJ': case 'KeyX': inputsRef.current.shoot = true; break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyA': case 'ArrowLeft': inputsRef.current.left = false; break;
        case 'KeyD': case 'ArrowRight': inputsRef.current.right = false; break;
        case 'KeyW': case 'ArrowUp': inputsRef.current.up = false; break;
        case 'KeyS': case 'ArrowDown': inputsRef.current.down = false; break;
        case 'KeyK': case 'KeyZ': inputsRef.current.jump = false; break;
        case 'KeyJ': case 'KeyX': inputsRef.current.shoot = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Game Loop
  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    
    tickRef.current++;
    const player = playerRef.current;
    const inputs = inputsRef.current;
    const bullets = bulletsRef.current;
    const enemies = enemiesRef.current;
    const platforms = platformsRef.current;

    // --- PLAYER PHYSICS ---
    
    // Horizontal Movement
    if (inputs.left) {
      player.vx = -PLAYER_SPEED;
      player.direction = Direction.Left;
    } else if (inputs.right) {
      player.vx = PLAYER_SPEED;
      player.direction = Direction.Right;
    } else {
      player.vx = 0;
    }

    // Vertical Facing
    if (inputs.up) player.facingVertical = 1;
    else if (inputs.down) player.facingVertical = -1;
    else player.facingVertical = 0;

    // Jumping
    if (inputs.jump && player.isGrounded) {
      if (inputs.down) {
         player.y += 1; 
         player.isGrounded = false;
         player.vy = 1;
      } else {
         player.vy = JUMP_FORCE;
         player.isGrounded = false;
         // Play Jump Sound
         if (audioCtxRef.current) {
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.frequency.setValueAtTime(150, audioCtxRef.current.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, audioCtxRef.current.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, audioCtxRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.1);
         }
      }
    }

    // Gravity
    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    // Level Bounds (Left)
    if (player.x < cameraRef.current.x) player.x = cameraRef.current.x;

    // --- COLLISION DETECTION ---
    player.isGrounded = false;
    
    // Check Platforms
    for (const plat of platforms) {
      // Basic AABB
      if (
        player.x < plat.x + plat.width &&
        player.x + player.width > plat.x &&
        player.y < plat.y + plat.height &&
        player.y + player.height > plat.y
      ) {
        // Landing on top
        const wasAbove = (player.y - player.vy + player.height) <= plat.y;
        
        if (player.vy > 0 && wasAbove) {
           player.y = plat.y - player.height;
           player.vy = 0;
           player.isGrounded = true;
        }
      }
    }

    // Pitfall Death
    if (player.y > CANVAS_HEIGHT) {
      handlePlayerDeath();
    }

    // --- SHOOTING ---
    if (player.shootCooldown > 0) player.shootCooldown--;
    if (inputs.shoot && player.shootCooldown <= 0) {
      let bx = 0, by = 0;
      
      // Determine shoot direction
      if (player.facingVertical === 1) { // UP
         if (inputs.left || inputs.right) { // Diagonal Up
             bx = player.direction * BULLET_SPEED * 0.7;
             by = -BULLET_SPEED * 0.7;
         } else { // Straight Up
             bx = 0;
             by = -BULLET_SPEED;
         }
      } else if (player.facingVertical === -1 && !player.isGrounded) { // DOWN (only in air)
         if (inputs.left || inputs.right) { // Diagonal Down
             bx = player.direction * BULLET_SPEED * 0.7;
             by = BULLET_SPEED * 0.7;
         } else { // Straight Down
             bx = 0;
             by = BULLET_SPEED;
         }
      } else if (player.facingVertical === -1 && player.isGrounded) {
          // Crouching shoot (horizontal)
          bx = player.direction * BULLET_SPEED;
          by = 0;
      } else {
          // Normal horizontal
          bx = player.direction * BULLET_SPEED;
          by = 0;
      }

      // Spawn Bullet
      bulletsRef.current.push({
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        width: 8, height: 8,
        vx: bx, vy: by,
        color: COLORS.BULLET,
        isDead: false,
        owner: 'player',
        life: 100
      });
      player.shootCooldown = SHOOT_COOLDOWN;
      
      // Shoot Sound
      if (audioCtxRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtxRef.current.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtxRef.current.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtxRef.current.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.1);
      }
    }

    // --- BULLETS UPDATE ---
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      
      // Remove off-screen or dead bullets
      if (b.life <= 0 || b.x < cameraRef.current.x || b.x > cameraRef.current.x + CANVAS_WIDTH || b.y < 0 || b.y > CANVAS_HEIGHT) {
        bullets.splice(i, 1);
        continue;
      }

      // Check Bullet Collisions
      if (b.owner === 'player') {
        for (const enemy of enemies) {
          if (!enemy.isDead && checkCollision(b, enemy)) {
             enemy.hp--;
             b.life = 0; // Destroy bullet
             createParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, 'red');
             if (enemy.hp <= 0) {
               enemy.isDead = true;
               player.score += (enemy.type === 'boss' ? 1000 : 100);
               setScore(player.score);
               if (enemy.type === 'boss') {
                  setGameState(GameState.VICTORY);
               }
             }
             break;
          }
        }
      } else {
        // Enemy bullet hitting player
        if (checkCollision(b, player) && player.invincibleTimer <= 0) {
           handlePlayerDeath();
           b.life = 0;
        }
      }
    }

    // --- ENEMIES UPDATE ---
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      
      // Simple AI
      const distToPlayer = player.x - enemy.x;
      
      // Activation Distance
      if (Math.abs(distToPlayer) < 600) {
        if (enemy.type === 'runner') {
          // Run towards player
          if (Math.abs(distToPlayer) > 10) {
             enemy.vx = (distToPlayer > 0 ? 1 : -1) * ENEMY_SPEED;
             enemy.direction = distToPlayer > 0 ? Direction.Right : Direction.Left;
          }
          enemy.x += enemy.vx;
          enemy.y += 10; // Simple Gravity for enemies (stick to floor)
          
          // Floor clamp for enemies
          let enemyGrounded = false;
          for(const plat of platforms) {
             if (enemy.x < plat.x + plat.width && enemy.x + enemy.width > plat.x &&
                 enemy.y < plat.y + plat.height && enemy.y + enemy.height > plat.y) {
                 enemy.y = plat.y - enemy.height;
                 enemyGrounded = true;
             }
          }
        }
        
        // Shooting Logic (Turrets and Boss)
        if (enemy.type === 'turret' || enemy.type === 'boss') {
           enemy.shootCooldown--;
           if (enemy.shootCooldown <= 0) {
              const angle = Math.atan2((player.y + player.height/2) - (enemy.y + 10), (player.x + player.width/2) - enemy.x);
              const speed = BULLET_SPEED * 0.5;
              
              bulletsRef.current.push({
                x: enemy.x + enemy.width/2,
                y: enemy.y + 10,
                width: 8, height: 8,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: 'orange',
                isDead: false,
                owner: 'enemy',
                life: 200
              });
              enemy.shootCooldown = 120; // Slow fire
           }
        }
      }

      // Collision with Player (Touch Damage)
      if (checkCollision(player, enemy) && player.invincibleTimer <= 0 && !enemy.isDead) {
         handlePlayerDeath();
      }
    }

    // --- PARTICLES ---
    for(let i=particlesRef.current.length-1; i>=0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }

    // --- CAMERA ---
    if (player.x > cameraRef.current.x + CAMERA_OFFSET_X) {
      cameraRef.current.x = player.x - CAMERA_OFFSET_X;
    }
    if (cameraRef.current.x > LEVEL_LENGTH - CANVAS_WIDTH) {
       cameraRef.current.x = LEVEL_LENGTH - CANVAS_WIDTH;
    }

    // Invincibility
    if (player.invincibleTimer > 0) player.invincibleTimer--;

  }, [gameState, setGameState, setScore, initLevel]);

  const handlePlayerDeath = () => {
    const player = playerRef.current;
    if (player.invincibleTimer > 0) return;
    
    player.hp--;
    setLives(player.hp);
    
    createParticles(player.x, player.y, 'white');
    
    // Death sound
    if (audioCtxRef.current) {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtxRef.current.currentTime);
        osc.frequency.linearRampToValueAtTime(10, audioCtxRef.current.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtxRef.current.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.3);
    }

    if (player.hp <= 0) {
      setGameState(GameState.GAME_OVER);
    } else {
      // Respawn logic
      player.y = -100; // Drop from sky
      player.x = Math.max(cameraRef.current.x + 50, player.x); // Keep somewhat forward
      player.vx = 0;
      player.vy = 0;
      player.invincibleTimer = 180; // 3 seconds at 60fps
    }
  };

  const createParticles = (x: number, y: number, color: string) => {
    for(let i=0; i<8; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 30,
        color
      });
    }
  };

  const checkCollision = (r1: Box, r2: Box) => {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  };

  const drawSprite = (ctx: CanvasRenderingContext2D, map: number[][], x: number, y: number, facingRight: boolean) => {
      const pixelSize = 2; // Each sprite pixel is 2x2 screen pixels
      
      ctx.save();
      ctx.translate(x, y);
      if (!facingRight) {
         ctx.translate(24, 0);
         ctx.scale(-1, 1);
      }
      
      for(let r=0; r<map.length; r++) {
          for(let c=0; c<map[r].length; c++) {
              const colorIndex = map[r][c];
              if (colorIndex !== 0) {
                  ctx.fillStyle = PALETTE[colorIndex] || '#fff';
                  ctx.fillRect(c * pixelSize, r * pixelSize, pixelSize, pixelSize);
              }
          }
      }
      
      ctx.restore();
  };

  // Render Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cx = cameraRef.current.x;

    // Clear Screen
    ctx.fillStyle = COLORS.SKY;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Save context for camera transform
    ctx.save();
    ctx.translate(-cx, 0);

    // Draw Platforms
    const platforms = platformsRef.current;
    for (const plat of platforms) {
      // Draw platform
      if (plat.type === 'solid') {
         ctx.fillStyle = COLORS.GROUND;
         ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
         // Grass top
         ctx.fillStyle = COLORS.GRASS;
         ctx.fillRect(plat.x, plat.y, plat.width, 10);
      } else {
         // Floating platform visuals
         ctx.fillStyle = COLORS.PLATFORM;
         ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
         // Shadow/Detail
         ctx.fillStyle = '#555';
         ctx.fillRect(plat.x + 5, plat.y + 2, plat.width - 10, plat.height - 4);
      }
    }

    // Draw Enemies
    const enemies = enemiesRef.current;
    for (const en of enemies) {
      if (en.isDead) continue;
      
      if (en.type === 'boss') {
         ctx.fillStyle = '#444';
         ctx.fillRect(en.x, en.y, en.width, en.height);
         ctx.fillStyle = en.shootCooldown < 20 ? 'white' : 'red';
         ctx.beginPath();
         ctx.arc(en.x + en.width/2, en.y + en.height/2, 20, 0, Math.PI*2);
         ctx.fill();
         // Health Bar
         ctx.fillStyle = 'red';
         ctx.fillRect(en.x, en.y - 10, (en.hp / 50) * en.width, 5);
      } else if (en.type === 'turret') {
         ctx.fillStyle = '#888'; 
         ctx.fillRect(en.x, en.y + 10, en.width, en.height - 10);
         ctx.fillStyle = COLORS.ENEMY_RED; 
         ctx.fillRect(en.x + 4, en.y, en.width - 8, 20);
         const player = playerRef.current;
         const angle = Math.atan2((player.y) - en.y, (player.x) - en.x);
         ctx.save();
         ctx.translate(en.x + en.width/2, en.y + 10);
         ctx.rotate(angle);
         ctx.fillStyle = '#333';
         ctx.fillRect(0, -2, 20, 4);
         ctx.restore();

      } else {
         // Runner
         ctx.fillStyle = COLORS.ENEMY_RED;
         ctx.fillRect(en.x, en.y, en.width, en.height);
         ctx.fillStyle = 'white';
         const eyeOffset = en.direction === Direction.Right ? 14 : 4;
         ctx.fillRect(en.x + eyeOffset, en.y + 8, 4, 4);
      }
    }

    // Draw Player
    const p = playerRef.current;
    if (Math.floor(Date.now() / 100) % 2 === 0 || p.invincibleTimer === 0) { 
        let spriteMap = SPRITES.IDLE;
        
        if (!p.isGrounded) {
            spriteMap = SPRITES.JUMP; // Tucked jump
        } else if (Math.abs(p.vx) > 0.1) {
            // Run cycle
            const frame = Math.floor(tickRef.current / 6) % 3;
            spriteMap = SPRITES.RUN[frame];
        }

        // We use the top-left coordinate, but sprite logic might need adjustment if sizes vary.
        // Sprites are 12x24 grid -> 24x48 pixels. matches p.width/p.height.
        drawSprite(ctx, spriteMap, p.x, p.y, p.direction === Direction.Right);
    }

    // Draw Bullets
    const bullets = bulletsRef.current;
    for (const b of bullets) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Particles
    const particles = particlesRef.current;
    for (const part of particles) {
      ctx.fillStyle = part.color;
      ctx.fillRect(part.x, part.y, 4, 4);
    }
    
    // Draw Water at bottom
    ctx.fillStyle = COLORS.WATER;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(cx, CANVAS_HEIGHT - 20, CANVAS_WIDTH, 20);
    ctx.globalAlpha = 1.0;

    ctx.restore(); 

  }, []);

  // Loop Driver
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
        let lastTime = 0;
        const animate = (time: number) => {
            const deltaTime = time - lastTime;
            if (deltaTime >= 16) { 
                update();
                draw();
                lastTime = time;
            }
            requestRef.current = requestAnimationFrame(animate);
        };
        requestRef.current = requestAnimationFrame(animate);
    } else if (gameState === GameState.MENU) {
       initLevel(); 
       draw(); // Draw once for background
    }
    return () => {
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [gameState, update, draw, initLevel]);

  return (
    <div className="relative border-4 border-gray-700 rounded shadow-2xl overflow-hidden">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block bg-black"
      />
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanlines opacity-30 pointer-events-none"></div>
    </div>
  );
};

export default GameCanvas;