import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import UI from './components/UI';
import { GameState } from './types';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);

  const handleStart = () => {
    setScore(0);
    setLives(3);
    setGameState(GameState.PLAYING);
  };

  const handleRestart = () => {
    setGameState(GameState.MENU);
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="relative group">
        {/* Arcade Cabinet Effect Wrappers (Visual Only) */}
        <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-blue-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        
        <div className="relative">
           <GameCanvas 
             gameState={gameState} 
             setGameState={setGameState}
             setScore={setScore}
             setLives={setLives}
           />
           <UI 
             score={score}
             lives={lives}
             gameState={gameState}
             onStart={handleStart}
             onRestart={handleRestart}
           />
        </div>
        
        {/* Mobile Controls Hint (Visible only on small screens) */}
        <div className="md:hidden text-white text-center mt-4 text-xs">
          Physical Keyboard Required for Best Experience
        </div>
      </div>
    </div>
  );
};

export default App;