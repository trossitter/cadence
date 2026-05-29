import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import App from './app/app';
import { CadenceAuthProvider } from './app/auth/cadence-auth-provider';
import { store } from './app/store';
import './styles.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <CadenceAuthProvider>
      <Provider store={store}>
        <App />
      </Provider>
    </CadenceAuthProvider>
  </StrictMode>,
);
