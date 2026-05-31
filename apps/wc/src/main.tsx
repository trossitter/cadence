import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { CadenceRoot } from './app/cadence-root';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <CadenceRoot />
  </StrictMode>,
);
