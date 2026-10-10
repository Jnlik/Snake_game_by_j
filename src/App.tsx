import { useState, useEffect, useCallback, useRef } from 'react';

// Types
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

// Constants
const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = {
  easy: 150,
  medium: 100,
  hard: 60,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

// Helper functions
function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
  return pos;
}

function getHighScore(difficulty: Difficulty): number {
  try {
    return parseInt(localStorage.getItem(`snake-highscore-${difficulty}`) || '0', 10);
  } catch {
    return 0;
  }
}

function setHighScore(difficulty: Difficulty, score: number): void {
  try {
    localStorage.setItem(`snake-highscore-${difficulty}`, score.toString());
  } catch {
    // localStorage not available
  }
}

// Main App Component
export default function App() {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [highScores, setHighScores] = useState<Record<Difficulty, number>>({
    easy: getHighScore('easy'),
    medium: getHighScore('medium'),
    hard: getHighScore('hard'),
  });

  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Initialize game
  const initGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }];
    setSnake(initialSnake);
    setFood(getRandomPosition(initialSnake));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    setScore(0);
    setGameState('playing');
  }, []);

  // Game tick
  const tick = useCallback(() => {
    setSnake(prevSnake => {
      const head = { ...prevSnake[0] };
      const dir = directionRef.current;

      switch (dir) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameState('gameover');
        return prevSnake;
      }

      // Self collision
      if (prevSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
        setGameState('gameover');
        return prevSnake;
      }

      const newSnake = [head, ...prevSnake];

      // Food collision
      setFood(prevFood => {
        if (head.x === prevFood.x && head.y === prevFood.y) {
          setScore(prev => {
            const newScore = prev + (difficulty === 'easy' ? 5 : difficulty === 'medium' ? 10 : 20);
            // Update high score
            if (newScore > highScores[difficulty]) {
              setHighScores(hs => ({ ...hs, [difficulty]: newScore }));
              setHighScore(difficulty, newScore);
            }
            return newScore;
          });
          return getRandomPosition(newSnake);
        }
        newSnake.pop();
        return prevFood;
      });

      return newSnake;
    });
  }, [difficulty, highScores]);

  // Game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = window.setInterval(tick, SPEEDS[difficulty]);
    }
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [gameState, tick, difficulty]);

  // Change direction
  const changeDirection = useCallback((newDir: Direction) => {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT',
    };
    if (opposites[newDir] !== directionRef.current) {
      directionRef.current = newDir;
      setDirection(newDir);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'idle' || gameState === 'gameover') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          initGame();
          return;
        }
      }

      if (gameState === 'playing' || gameState === 'paused') {
        switch (e.key) {
          case 'ArrowUp': case 'w': case 'W':
            e.preventDefault();
            changeDirection('UP');
            break;
          case 'ArrowDown': case 's': case 'S':
            e.preventDefault();
            changeDirection('DOWN');
            break;
          case 'ArrowLeft': case 'a': case 'A':
            e.preventDefault();
            changeDirection('LEFT');
            break;
          case 'ArrowRight': case 'd': case 'D':
            e.preventDefault();
            changeDirection('RIGHT');
            break;
          case ' ':
          case 'Escape':
            e.preventDefault();
            setGameState(prev => prev === 'playing' ? 'paused' : 'playing');
            break;
          case 'r': case 'R':
            e.preventDefault();
            initGame();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, changeDirection, initGame]);

  // Touch controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const minSwipe = 30;

    if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) {
      // Tap - toggle pause
      if (gameState === 'playing') setGameState('paused');
      else if (gameState === 'paused') setGameState('playing');
      else if (gameState === 'idle' || gameState === 'gameover') initGame();
      touchStartRef.current = null;
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      changeDirection(dy > 0 ? 'DOWN' : 'UP');
    }
    touchStartRef.current = null;
  }, [gameState, changeDirection, initGame]);

  // Update high scores when difficulty changes
  useEffect(() => {
    setHighScores({
      easy: getHighScore('easy'),
      medium: getHighScore('medium'),
      hard: getHighScore('hard'),
    });
  }, [difficulty]);

  const getSegmentStyle = (index: number, total: number) => {
    const opacity = 1 - (index / total) * 0.4;
    return { opacity };
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-4 select-none overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-lg mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-emerald-400 tracking-tight">
          🐍 Snake Game
        </h1>

        {/* Score Bar */}
        <div className="flex justify-between items-center mt-3 px-2">
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Score</div>
            <div className="text-2xl font-bold text-white">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Best</div>
            <div className="text-2xl font-bold text-amber-400">{highScores[difficulty]}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400 uppercase tracking-wider">Length</div>
            <div className="text-2xl font-bold text-emerald-300">{snake.length}</div>
          </div>
        </div>
      </div>

      {/* Difficulty Selector */}
      <div className="flex gap-2 mb-4">
        {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
          <button
            key={d}
            onClick={() => {
              if (gameState !== 'playing') {
                setDifficulty(d);
              }
            }}
            disabled={gameState === 'playing'}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              difficulty === d
                ? d === 'easy'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                  : d === 'medium'
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50'
            }`}
          >
            {DIFFICULTY_LABELS[d]}
          </button>
        ))}
      </div>

      {/* Game Board */}
      <div
        ref={boardRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative w-full max-w-lg aspect-square bg-gray-800/80 rounded-2xl border-2 border-gray-700 shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-sm"
      >
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: `${100 / GRID_SIZE}% ${100 / GRID_SIZE}%`,
          }}
        />

        {/* Food */}
        <div
          className="absolute rounded-full bg-red-500 shadow-lg shadow-red-500/50 animate-pulse"
          style={{
            width: `${100 / GRID_SIZE}%`,
            height: `${100 / GRID_SIZE}%`,
            left: `${(food.x / GRID_SIZE) * 100}%`,
            top: `${(food.y / GRID_SIZE) * 100}%`,
            transition: 'left 0.1s, top 0.1s',
          }}
        >
          <div className="w-full h-full rounded-full bg-red-400 scale-75" />
        </div>

        {/* Snake */}
        {snake.map((seg, index) => {
          const isHead = index === 0;
          const segmentSize = 100 / GRID_SIZE;
          return (
            <div
              key={`${index}-${seg.x}-${seg.y}`}
              className={`absolute rounded-md ${
                isHead
                  ? 'bg-emerald-400 shadow-md shadow-emerald-400/40 z-10'
                  : 'bg-emerald-500'
              }`}
              style={{
                width: `${segmentSize - 0.5}%`,
                height: `${segmentSize - 0.5}%`,
                left: `${(seg.x / GRID_SIZE) * 100 + 0.25}%`,
                top: `${(seg.y / GRID_SIZE) * 100 + 0.25}%`,
                ...getSegmentStyle(index, snake.length),
                transition: 'left 0.08s linear, top 0.08s linear',
              }}
            >
              {isHead && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="flex gap-[20%]">
                    <div className="w-[20%] h-[20%] rounded-full bg-gray-900" />
                    <div className="w-[20%] h-[20%] rounded-full bg-gray-900" />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Overlay States */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="text-6xl mb-4 animate-bounce">🐍</div>
            <h2 className="text-2xl font-bold text-white mb-2">Ready to Play?</h2>
            <p className="text-gray-300 text-sm mb-6 text-center px-4">
              Use arrow keys or swipe to control
            </p>
            <button
              onClick={initGame}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Start Game
            </button>
            <p className="text-gray-500 text-xs mt-4">Press Space or Enter</p>
          </div>
        )}

        {gameState === 'paused' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="text-5xl mb-4">⏸️</div>
            <h2 className="text-2xl font-bold text-white mb-2">Paused</h2>
            <button
              onClick={() => setGameState('playing')}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-105 active:scale-95 mt-4"
            >
              Resume
            </button>
            <p className="text-gray-500 text-xs mt-4">Press Space or Tap</p>
          </div>
        )}

        {gameState === 'gameover' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-20">
            <div className="text-5xl mb-3">💀</div>
            <h2 className="text-2xl font-bold text-red-400 mb-1">Game Over!</h2>
            <p className="text-3xl font-bold text-white mb-1">{score} pts</p>
            {score >= highScores[difficulty] && score > 0 && (
              <p className="text-amber-400 text-sm font-medium mb-2 animate-pulse">
                🏆 New High Score!
              </p>
            )}
            <p className="text-gray-400 text-sm mb-4">
              Best: {Math.max(score, highScores[difficulty])} pts
            </p>
            <button
              onClick={initGame}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Play Again
            </button>
            <p className="text-gray-500 text-xs mt-4">Press Space or Enter</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mt-4 flex gap-3">
        {gameState === 'playing' && (
          <button
            onClick={() => setGameState('paused')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-all duration-200"
          >
            ⏸ Pause
          </button>
        )}
        {gameState === 'paused' && (
          <button
            onClick={() => setGameState('playing')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-all duration-200"
          >
            ▶ Resume
          </button>
        )}
        {(gameState === 'playing' || gameState === 'paused') && (
          <button
            onClick={initGame}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition-all duration-200"
          >
            🔄 Restart
          </button>
        )}
      </div>

      {/* Mobile D-Pad */}
      <div className="mt-6 md:hidden grid grid-cols-3 gap-2 w-40">
        <div />
        <button
          onTouchStart={(e) => { e.preventDefault(); changeDirection('UP'); }}
          className="w-12 h-12 bg-gray-700/80 hover:bg-gray-600 active:bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xl transition-all duration-100 active:scale-90"
        >
          ↑
        </button>
        <div />
        <button
          onTouchStart={(e) => { e.preventDefault(); changeDirection('LEFT'); }}
          className="w-12 h-12 bg-gray-700/80 hover:bg-gray-600 active:bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xl transition-all duration-100 active:scale-90"
        >
          ←
        </button>
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            if (gameState === 'playing') setGameState('paused');
            else if (gameState === 'paused') setGameState('playing');
            else if (gameState === 'idle' || gameState === 'gameover') initGame();
          }}
          className="w-12 h-12 bg-gray-700/80 hover:bg-gray-600 active:bg-amber-600 rounded-xl flex items-center justify-center text-white text-xs transition-all duration-100 active:scale-90"
        >
          {gameState === 'playing' ? '⏸' : '▶'}
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}
          className="w-12 h-12 bg-gray-700/80 hover:bg-gray-600 active:bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xl transition-all duration-100 active:scale-90"
        >
          →
        </button>
        <div />
        <button
          onTouchStart={(e) => { e.preventDefault(); changeDirection('DOWN'); }}
          className="w-12 h-12 bg-gray-700/80 hover:bg-gray-600 active:bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xl transition-all duration-100 active:scale-90"
        >
          ↓
        </button>
        <div />
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-gray-500 text-xs hidden md:block">
        <p>Arrow Keys / WASD to move • Space to pause • R to restart</p>
      </div>
    </div>
  );
}
