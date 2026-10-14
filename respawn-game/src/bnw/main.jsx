import ReactDOM from 'react-dom/client';
import BnWGame from '../../../BnWGame.jsx';

/** When running inside the full game, tell the host BnW is done (both boards solved). */
const notifyComplete = () => { if (window.parent !== window) window.parent.postMessage({ type: 'respawn:complete', level: 'bnw' }, '*'); };

// Rendered exactly as play.html renders it (no StrictMode).
ReactDOM.createRoot(document.getElementById('root')).render(<BnWGame onGameComplete={notifyComplete} />);
