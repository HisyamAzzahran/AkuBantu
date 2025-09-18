// src/components/LoginForm.js

import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import 'animate.css';
// Kita tidak lagi import './LoginForm.css';
import { GoogleLogin } from '@react-oauth/google';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi';

const API_URL_BASE = "https://webai-production-b975.up.railway.app";

const LoginForm = ({ apiUrl, onLogin }) => {
  const effectiveApiUrl = apiUrl || API_URL_BASE;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [loadingForgotPassword, setLoadingForgotPassword] = useState(false);

  // --- SEMUA FUNGSI LOGIKA ANDA TETAP SAMA, TIDAK ADA YANG DIUBAH ---
  const handleEmailLogin = async (e) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      toast.warn("⚠️ Email dan password harus diisi!");
      return;
    }
    setLoadingEmail(true);
    try {
      const res = await axios.post(`${effectiveApiUrl}/login`, { email, password });
      toast.success(res.data.message || "✅ Login berhasil!");
      if (res.data.email && res.data.tokens !== null && res.data.is_premium !== undefined && res.data.is_admin !== undefined) {
        onLogin(res.data.is_premium, res.data.email, res.data.is_admin, res.data.tokens, res.data.username);
      } else {
        toast.error("❌ Data login tidak lengkap dari server.");
      }
    } catch (error) {
      toast.error(error.response?.data?.error || error.response?.data?.message || "❌ Login gagal! Cek kembali email dan password Anda.");
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoadingGoogle(true);
    try {
      const res = await axios.post(`${effectiveApiUrl}/auth/google/callback`, { id_token: credentialResponse.credential });
      toast.success(res.data.message || "✅ Berhasil masuk dengan Google!");
      if (onLogin && res.data.user) {
        onLogin(res.data.user.is_premium, res.data.user.email, res.data.user.is_admin, res.data.user.tokens, res.data.user.username);
      } else {
        toast.error("❌ Data login dari Google tidak lengkap.");
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "❌ Gagal masuk dengan Google.");
    } finally {
      setLoadingGoogle(false);
    }
  };
  
  const handleGoogleError = (error) => {
    toast.error("Login dengan Google gagal atau dibatalkan. Silakan coba lagi.");
    setLoadingGoogle(false);
  };
  
  const handleForgotPasswordClick = () => setShowForgotPassword(true);
  
  const handleForgotPasswordEmailChange = (e) => setForgotPasswordEmail(e.target.value.toLowerCase());
  
  const handleSendResetLink = async () => {
    if (!forgotPasswordEmail) {
      toast.warn("⚠️ Email harus diisi untuk mengirim link reset password.");
      return;
    }
    setLoadingForgotPassword(true);
    try {
      const res = await axios.post(`${effectiveApiUrl}/forgot-password`, { email: forgotPasswordEmail });
      toast.success(res.data.message || "✅ Link reset password telah dikirim ke email Anda!");
      setShowForgotPassword(false);
    } catch (error) {
      toast.error(error.response?.data?.error || "❌ Gagal mengirim link reset password.");
    } finally {
      setLoadingForgotPassword(false);
    }
  };

  // --- BAGIAN JSX (TAMPILAN) YANG SUDAH DISESUAIKAN TOTAL ---
  return (
    <div className="auth-form-content">
      <div className="auth-header">
      </div>

      {!showForgotPassword ? (
        <>
          <form onSubmit={handleEmailLogin}>
            <div className="form-group">
              <FiMail className="input-icon-futuristic" />
              <input
                type="email"
                className="futuristic-input"
                placeholder="Masukkan email Anda"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                disabled={loadingEmail || loadingGoogle}
                required
              />
            </div>

            <div className="form-group">
              <FiLock className="input-icon-futuristic" />
              <input
                type={showPassword ? "text" : "password"}
                className="futuristic-input"
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loadingEmail || loadingGoogle}
                required
              />
              <button
                type="button"
                className="password-toggle-futuristic"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loadingEmail || loadingGoogle}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>

            <div className="form-options">
              <button
                type="button"
                className="forgot-password-link-futuristic"
                onClick={handleForgotPasswordClick}
                disabled={loadingEmail || loadingGoogle}
              >
                Lupa kata sandi?
              </button>
            </div>

            <button
              type="submit"
              className="futuristic-button"
              disabled={loadingEmail || loadingGoogle || !email || !password}
              data-loading={loadingEmail || undefined}
            >
              Masuk
            </button>
          </form>

          <div className="auth-divider">
            <span>atau</span>
          </div>

          <div className="google-login-section-futuristic">
            {loadingGoogle ? (
              <div className="ai-thinking-bubble" style={{justifyContent:'center'}}><div className="ai-thinking-text">Menghubungkan Google<span className="typing-dots"><span></span><span></span><span></span></span></div></div>
            ) : (
              <div className="google-btn-wrapper">
                 <GoogleLogin
                   onSuccess={handleGoogleSuccess}
                   onError={handleGoogleError}
                   theme="outline"
                   size="large"
                   shape="rectangular"
                   logo_alignment="left"
                   width="100%"
                 />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="forgot-password-form">
          <div className="form-group">
            <FiMail className="input-icon-futuristic" />
            <input
              type="email"
              className="futuristic-input"
              placeholder="Masukkan email terdaftar"
              value={forgotPasswordEmail}
              onChange={handleForgotPasswordEmailChange}
              disabled={loadingForgotPassword}
              required
            />
          </div>
          <button
            type="button"
            className="futuristic-button"
            onClick={handleSendResetLink}
            disabled={loadingForgotPassword || !forgotPasswordEmail}
            data-loading={loadingForgotPassword || undefined}
          >
            Kirim Link Reset
          </button>
          <button
            type="button"
            className="back-btn-futuristic"
            onClick={() => setShowForgotPassword(false)}
            disabled={loadingForgotPassword}
          >
            <FiArrowLeft /> Kembali ke Login
          </button>
        </div>
      )}
    </div>
  );
};

export default LoginForm;
