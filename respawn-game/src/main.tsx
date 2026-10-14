import ReactDOM from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import './styles.css';
import App from './App';

// No StrictMode: the director is a single timed sequence and must run exactly once.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
