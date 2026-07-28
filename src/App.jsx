import { useState, useRef } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import './App.css';

export default function App() {
  // --- STATE MANAGEMENT ---
  // Core game logic instance
  const [game, setGame] = useState(new Chess());
  
  // UI states for highlighting and click-to-move
  const [optionSquares, setOptionSquares] = useState({});
  const [moveFrom, setMoveFrom] = useState('');
  
  // States and Refs specifically for handling pawn promotion
  const [moveTo, setMoveTo] = useState(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  // We use a ref to prevent stale closures when the promotion dialog triggers
  const promotionRef = useRef(null);

  // --- BOT LOGIC ---
  // Temporarily plays a random move. Later to be replaced by Stockfish integration.
  function makeRandomMove(currentGame) {
    setTimeout(() => {
      // Stop if the game is already over (checkmate, draw, etc.)
      if (currentGame.isGameOver()) return;

      const possibleMoves = currentGame.moves();
      if (possibleMoves.length === 0) return;
      
      const randomIndex = Math.floor(Math.random() * possibleMoves.length);
      const randomMove = possibleMoves[randomIndex];

      // Clone game, execute move, update state
      const gameCopy = new Chess();
      gameCopy.loadPgn(currentGame.pgn());
      gameCopy.move(randomMove);
      
      setGame(gameCopy);
    }, 300);
  }

  // --- CORE MOVE EXECUTION ---
  // Centralized function to handle all moves, ensuring DRY principles
  function executeMove(source, target, promotionPiece) {
    const gameCopy = new Chess();
    gameCopy.loadPgn(game.pgn());

    try {
      const moveData = { from: source, to: target };
      if (promotionPiece) {
        moveData.promotion = promotionPiece;
      }

      const move = gameCopy.move(moveData);

      // If the move is legal
      if (move) {
        setGame(gameCopy);
        setOptionSquares({});
        setMoveFrom('');

        // Trigger bot response if game is still active
        if (!gameCopy.isGameOver()) {
          makeRandomMove(gameCopy);
        }
        return true;
      }
    } catch (e) {
      // Catch and ignore illegal moves thrown by chess.js
    }
    return false;
  }

  // --- EVENT HANDLERS ---
  
  // 1. Drag & Drop handler
  function onDrop(sourceSquare, targetSquare) {
    const moves = game.moves({ verbose: true });
    
    // Check if the current drag-and-drop action triggers a pawn promotion
    const isPromotion = moves.some(
      (m) => m.from === sourceSquare && m.to === targetSquare && m.promotion
    );

    if (isPromotion) {
      // Save move coordinates safely in the ref, open dialog, and hold the piece
      promotionRef.current = { from: sourceSquare, to: targetSquare };
      setMoveTo(targetSquare);
      setShowPromotionDialog(true);
      return true; 
    }

    // Execute standard move
    return executeMove(sourceSquare, targetSquare);
  }

  // 2. Click-to-Move handler
  function onSquareClick(square) {
    // Disable board clicks if the promotion modal is active
    if (showPromotionDialog) return;

    // Case A: A piece is already selected, try to move it to the clicked square
    if (moveFrom) {
      const moves = game.moves({ verbose: true });
      const isPromotion = moves.some(
        (m) => m.from === moveFrom && m.to === square && m.promotion
      );

      if (isPromotion) {
        promotionRef.current = { from: moveFrom, to: square };
        setMoveTo(square);
        setShowPromotionDialog(true);
        return;
      }

      const success = executeMove(moveFrom, square);
      // If the move was successful, stop here. 
      // If not (e.g. clicked another own piece), proceed to select it instead.
      if (success) return;
    }

    // Case B: Select a piece and highlight its legal moves
    const moves = game.moves({
      square,
      verbose: true
    });

    // If clicking an empty square or opponent's piece when it's your turn, clear selection
    if (moves.length === 0) {
      setMoveFrom('');
      setOptionSquares({});
      return;
    }

    setMoveFrom(square);
    const newSquares = {};
    
    // Calculate highlights for all legal destinations
    moves.forEach((move) => {
      const isCapture = move.flags.includes('c');
      newSquares[move.to] = {
        background: isCapture
          ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)' // Larger circle for captures
          : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)', // Standard dot
        borderRadius: '50%'
      };
    });

    // Highlight the selected piece's square
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)'
    };

    setOptionSquares(newSquares);
  }

  // 3. Promotion Dialog Selection handler
  function onPromotionPieceSelect(piece) {
    // If a piece is selected and ref holds the coordinates, execute
    if (piece && promotionRef.current) {
      // react-chessboard returns pieces like "wQ" (White Queen), chess.js needs "q"
      const promotionChar = piece[1].toLowerCase();
      executeMove(promotionRef.current.from, promotionRef.current.to, promotionChar);
    } else {
      // If user clicks outside the dialog to cancel
      setMoveFrom('');
    }
    
    // Cleanup states and close dialog
    promotionRef.current = null;
    setMoveTo(null);
    setShowPromotionDialog(false);
    return true;
  }

  // --- RENDER ---
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center' }}>LineTrainer</h1>
      
      <Chessboard 
        position={game.fen()} 
        onPieceDrop={onDrop}
        onSquareClick={onSquareClick}
        customSquareStyles={optionSquares}
        
        // Promotion Native UI Props
        promotionToSquare={moveTo}
        showPromotionDialog={showPromotionDialog}
        onPromotionPieceSelect={onPromotionPieceSelect}
      />
    </div>
  );
}