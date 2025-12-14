import React from 'react';
import { GameState } from '../types';

interface UIProps {
  score: number;
  lives: number;
  gameState: GameState;
  onStart: () => void;
  onRestart: () => void;
}

const UI: React.FC<UIProps> = ({ score, lives, gameState, onStart, onRestart }) => {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
      
      {/* HUD */}
      <div className="flex justify-between items-start text-white font-bold tracking-widest uppercase" style={{ textShadow: '2px 2px 0 #000' }}>
        <div className="flex flex-col">
          <span className="text-yellow-400">P1 SCORE</span>
          <span>{score.toString().padStart(6, '0')}</span>
        </div>
        <div className="flex flex-col items-end">
           <span className="text-red-500">LIVES</span>
           <div className="flex gap-2">
             {Array.from({length: Math.max(0, lives)}).map((_, i) => (
                <div key={i} className="w-4 h-4 bg-red-500 rounded-full border border-white"></div>
             ))}
           </div>
        </div>
      </div>

      {/* Menus */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
        {gameState === GameState.MENU && (
          <div className="text-center animate-pulse">
            <h1 className="text-6xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-red-600 font-black tracking-tighter mb-8 filter drop-shadow-[4px_4px_0_rgba(0,0,0,1)]">
              CONTRA
              <span className="block text-2xl text-white mt-2 tracking-widest">REACT MISSION</span>
            </h1>
            <div className="text-white text-xl space-y-4">
               <button 
                 onClick={onStart}
                 className="px-8 py-2 border-2 border-white hover:bg-white hover:text-black transition-colors"
               >
                 PRESS START
               </button>
               <div className="text-xs text-gray-400 mt-8">
                 CONTROLS: WASD / ARROWS to Move<br/>
                 J / X to Shoot<br/>
                 K / Z to Jump
               </div>
            </div>
          </div>
        )}

        {gameState === GameState.GAME_OVER && (
          <div className="text-center bg-black/80 p-8 border-4 border-red-600">
            <h2 className="text-5xl text-red-600 mb-4 font-bold">GAME OVER</h2>
            <p className="text-white mb-6">FINAL SCORE: {score}</p>
            <button 
                 onClick={onRestart}
                 className="px-6 py-2 bg-red-600 text-white hover:bg-red-500 transition-colors"
               >
                 TRY AGAIN
            </button>
          </div>
        )}

        {gameState === GameState.VICTORY && (
          <div className="text-center bg-black/80 p-8 border-4 border-blue-500">
             <h2 className="text-5xl text-blue-400 mb-4 font-bold">MISSION COMPLETE</h2>
             <p className="text-white mb-6">THE JUNGLE IS SECURE.</p>
             <p className="text-yellow-400 mb-8">SCORE: {score}</p>
             <button 
                 onClick={onRestart}
                 className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-500 transition-colors"
               >
                 PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UI;