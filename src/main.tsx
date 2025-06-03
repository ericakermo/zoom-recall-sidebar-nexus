
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Make React available globally for Zoom SDK
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';

// @ts-ignore
window.React = React;
// @ts-ignore
window.ReactDOM = ReactDOM;

createRoot(document.getElementById("root")!).render(<App />);
