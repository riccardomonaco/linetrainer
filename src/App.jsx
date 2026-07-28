import { useState, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessground } from 'chessground';

import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import './App.css';

export default function App() {
  const [game, setGame] = useState(new Chess());
  const gameRef = useRef(game);
  
  const boardRef = useRef(null);
  const cgRef = useRef(null);
  const engine = useRef(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const calculateDests = (chessInstance) => {
    const dests = new Map();
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

    files.forEach(file => {
      ranks.forEach(rank => {
        const square = file + rank;
        const moves = chessInstance.moves({ square, verbose: true });
        if (moves.length > 0) {
          dests.set(square, moves.map(m => m.to));
        }
      });
    });
    return dests;
  };

  useEffect(() => {
    engine.current = new Worker('/stockfish.js');
    engine.current.postMessage('uci');
    engine.current.postMessage('isready');

    engine.current.onmessage = (message) => {
      const line = message.data;
      if (line && line.startsWith('bestmove')) {
        const bestMove = line.split(' ')[1]; 
        if (bestMove) {
          const from = bestMove.substring(0, 2);
          const to = bestMove.substring(2, 4);
          const promotion = bestMove.length > 4 ? bestMove[4] : undefined;
          executeMove(from, to, promotion, true);
        }
      }
    };
    return () => engine.current.terminate();
  }, []);

  useEffect(() => {
    if (boardRef.current && !cgRef.current) {
      cgRef.current = Chessground(boardRef.current, {
        fen: game.fen(),
        turnColor: 'white',
        animation: { enabled: true, duration: 200 },
        movable: {
          color: 'white',
          free: false,
          dests: calculateDests(game)
        },
        events: {
          move: (orig, dest) => {
            handleUserMove(orig, dest);
          }
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cgRef.current) {
      cgRef.current.set({
        fen: game.fen(),
        turnColor: game.turn() === 'w' ? 'white' : 'black',
        movable: {
          color: game.turn() === 'w' ? 'white' : 'black',
          dests: calculateDests(game)
        },
        check: game.inCheck()
      });
    }
  }, [game.fen()]);

  const triggerBot = (currentGame) => {
    if (currentGame.isGameOver() || !engine.current) return;
    engine.current.postMessage(`position fen ${currentGame.fen()}`);
    engine.current.postMessage('go depth 10'); 
  };

  const handleUserMove = (source, target) => {
    const moves = gameRef.current.moves({ verbose: true });
    const isPromotion = moves.some(m => m.from === source && m.to === target && m.promotion);
    
    let promotionChar = undefined;
    if (isPromotion) {
      const pezzo = window.prompt("Promozione! Inserisci q (Regina), r (Torre), b (Alfiere), o n (Cavallo):", "q");
      promotionChar = pezzo ? pezzo.toLowerCase() : 'q';
    }

    const success = executeMove(source, target, promotionChar, false);
    
    if (!success && cgRef.current) {
      cgRef.current.set({ fen: gameRef.current.fen() });
    }
  };

  const executeMove = (source, target, promotionChar, isBot = false) => {
    const gameCopy = new Chess();
    gameCopy.loadPgn(gameRef.current.pgn());

    try {
      const move = gameCopy.move({
        from: source,
        to: target,
        promotion: promotionChar
      });

      if (move) {
        setGame(gameCopy);
        if (!isBot && !gameCopy.isGameOver()) {
          triggerBot(gameCopy);
        }
        return true;
      }
    } catch (e) {}
    return false;
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center' }}>LineTrainer</h1>
      
      {/* Usiamo la classe nativa 'brown' per avere subito il classico marrone/beige stabile */}
      <div 
        ref={boardRef} 
        className="cg-board-wrap brown cburnett" 
        style={{ width: '100%', aspectRatio: '1 / 1' }} 
      />

      {game.isCheckmate() && (
        <h2 style={{ color: '#d32f2f', textAlign: 'center', marginTop: '1.5rem', fontWeight: 'bold' }}>
          Scacco Matto! 🚩
        </h2>
      )}
    </div>
  );
}