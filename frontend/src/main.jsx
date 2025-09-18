// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Impor komponen App utama Anda
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter } from 'react-router-dom';

import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'; // Atau App.css jika itu CSS global utama Anda
import 'react-toastify/dist/ReactToastify.css';
import 'animate.css';

const GOOGLE_CLIENT_ID = "759794184458-ge21at6jk8p8s3icf6hv76065n7pncck.apps.googleusercontent.com"; // PASTIKAN INI BENAR

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);