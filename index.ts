import { createElement } from 'react';
import { registerRootComponent } from 'expo';

import App from './App';
import ErrorBoundary from './components/general/ErrorBoundary';

function Root() {
  return createElement(ErrorBoundary, null, createElement(App));
}

registerRootComponent(Root);
