import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

document.addEventListener('DOMContentLoaded', () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    // Enhanced error message for clarity if the issue persists elsewhere
    throw new Error("Could not find root element to mount to. Ensure a div with id='root' exists in your HTML and the script is loaded after the element, or this DOMContentLoaded listener is functioning correctly.");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
