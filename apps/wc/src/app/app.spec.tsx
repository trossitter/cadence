import { render } from '@testing-library/react';
import { Provider } from 'react-redux';

import App from './app';
import { store } from './store';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    expect(baseElement).toBeTruthy();
  });

  it('should show the Cadence weekly commitment table', () => {
    const { getByText } = render(
      <Provider store={store}>
        <App />
      </Provider>,
    );
    expect(getByText(/Weekly commitments tied to RCDO outcomes/gi)).toBeTruthy();
  });
});
