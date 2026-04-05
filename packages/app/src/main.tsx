import ReactDOM from 'react-dom/client';
import 'ol/ol.css';
import './app/App.css';
import { App } from './app/App';
import { RootStore, StoreContext } from './stores/RootStore';

const rootStore = new RootStore();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StoreContext.Provider value={rootStore}>
    <App />
  </StoreContext.Provider>,
);
