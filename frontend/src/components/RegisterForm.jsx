import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { GoogleLogin } from '@react-oauth/google';
// Menambahkan ikon yang relevan untuk form registrasi
import { FiMail, FiLock, FiUser, FiKey, FiArrowLeft } from 'react-icons/fi';

const API_URL_BASE = "https://webai-production-b975.up.railway.app";

// PERBAIKAN CSS: Style ini disertakan di sini untuk kemudahan.
// Idealnya, Anda memindahkan ini ke file App.css Anda.
const formStyles = `
  .futuristic-input {
    width: 100%;
    height: 52px; /* Menetapkan tinggi yang pasti */
    padding: 0 1rem 0 50px; /* Mengatur padding horizontal */
    line-height: 52px; /* KUNCI: Membuat teks di tengah secara vertikal */
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(0, 245, 255, 0.4);
    border-radius: 10px;
    color: #fff;
    font-size: 1rem;
    transition: all 0.3s ease;
  }

  /* Perbaikan untuk placeholder agar tidak menimpa line-height */
  .futuristic-input::placeholder {
    line-height: normal;
    vertical-align: middle;
  }
  
  .futuristic-input:focus { 
    outline: none; 
    border-color: #ff00ff; 
    box-shadow: 0 0 15px rgba(255, 0, 255, 0.5); 
  }

  .otp-input {
    text-align: center;
    padding: 0 1rem;
    font-size: 1.5rem;
    letter-spacing: 0.5rem;
  }
`;


function RegisterForm({ apiUrl, onRegisterSuccess, onLogin }) {
  const effectiveApiUrl = apiUrl || API_URL_BASE;

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoadingOtp, setIsLoadingOtp] = useState(false);
  const [isLoadingRegister, setIsLoadingRegister] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // --- LOGIKA FORM TETAP SAMA ---
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email.trim() || !username.trim() || !password.trim()) {
      toast.warn("⚠️ Email, Username, dan Password wajib diisi.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.warn("⚠️ Format email tidak valid.");
      return;
    }
    if (password.length < 6) {
      toast.warn("⚠️ Password minimal 6 karakter.");
      return;
    }
    setIsLoadingOtp(true);
    try {
      await axios.post(`${effectiveApiUrl}/request-registration-otp`, { email, username, password });
      toast.success(`✉️ Kode OTP telah dikirim ke ${email}. Cek email Anda.`);
      setIsOtpSent(true);
    } catch (error) {
      toast.error(error.response?.data?.error || "❌ Gagal mengirim OTP.");
    }
    setIsLoadingOtp(false);
  };

  const handleFinalRegister = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      toast.warn("⚠️ Kode OTP harus 6 digit.");
      return;
    }
    setIsLoadingRegister(true);
    try {
      const response = await axios.post(`${effectiveApiUrl}/register`, { email, otp });
      toast.success(response.data.message || "✅ Registrasi berhasil! Silakan login.");
      if (onRegisterSuccess) onRegisterSuccess();
    } catch (error) {
      toast.error(error.response?.data?.error || "❌ Registrasi gagal.");
    }
    setIsLoadingRegister(false);
  };
  
  const backToInitialForm = () => {
    setIsOtpSent(false);
    setOtp('');
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsGoogleLoading(true);
    try {
      const res = await axios.post(`${effectiveApiUrl}/auth/google/callback`, { id_token: credentialResponse.credential });
      toast.success(res.data.message || "✅ Berhasil masuk/daftar dengan Google!");
      if (onLogin && res.data.user) {
        onLogin(res.data.user.is_premium, res.data.user.email, res.data.user.is_admin, res.data.user.tokens, res.data.user.username);
      } else {
        toast.error("❌ Data login dari Google tidak lengkap.");
      }
    } catch (error) {
      toast.error(error.response?.data?.error || "❌ Gagal masuk/daftar dengan Google.");
    }
    setIsGoogleLoading(false);
  };

  const handleGoogleError = (error) => {
    toast.error("Login dengan Google gagal atau dibatalkan.");
    setIsGoogleLoading(false);
  };

  return (
    <div className="auth-form-content">
      <style>{formStyles}</style>
      {!isOtpSent ? (
        <>
          <div className="auth-header">
            <div className="auth-logo"><span className="auth-logo-text">AkuBantu</span></div>
            <h3 className="auth-title">Bergabung dengan Masa Depan</h3>
          </div>
          <form onSubmit={handleRequestOtp}>
            <div className="form-group">
              <FiUser className="input-icon-futuristic" />
              <input type="text" className="futuristic-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Pilih username Anda" required disabled={isLoadingOtp}/>
            </div>
            <div className="form-group">
              <FiMail className="input-icon-futuristic" />
              <input type="email" className="futuristic-input" value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} placeholder="Masukkan email Anda" required disabled={isLoadingOtp}/>
            </div>
            <div className="form-group">
              <FiLock className="input-icon-futuristic" />
              <input type="password" className="futuristic-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Buat password (min. 6 karakter)" required disabled={isLoadingOtp}/>
            </div>
            <button type="submit" className="futuristic-button" disabled={isLoadingOtp || !email.trim() || !username.trim() || !password.trim()} data-loading={isLoadingOtp || undefined}>
              Dapatkan Kode OTP
            </button>
          </form>
          <div className="auth-divider"><span>atau</span></div>
          <div className="google-login-section-futuristic">
            {isGoogleLoading ? <div className="ai-thinking-bubble" style={{justifyContent:'center'}}><div className="ai-thinking-text">Menghubungkan Google<span className="typing-dots"><span></span><span></span><span></span></span></div></div> : (
              <div className="google-btn-wrapper">
                <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} theme="outline" size="large" shape="rectangular" logo_alignment="left" width="100%" text="signup_with" />
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="auth-header">
            <h3 className="auth-title">Verifikasi Email Anda</h3>
            <p className="auth-subtitle">Kode OTP telah dikirim ke <strong>{email}</strong>. Periksa folder inbox atau spam Anda.</p>
          </div>
          <form onSubmit={handleFinalRegister}>
            <div className="form-group">
              <FiKey className="input-icon-futuristic" />
              <input type="text" className="futuristic-input otp-input" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="______" maxLength="6" required disabled={isLoadingRegister} />
            </div>
            <button type="submit" className="futuristic-button" disabled={isLoadingRegister || otp.length !== 6} data-loading={isLoadingRegister || undefined}>
              Verifikasi & Daftar
            </button>
          </form>
          <button type="button" className="back-btn-futuristic" onClick={backToInitialForm} disabled={isLoadingRegister}>
            <FiArrowLeft /> Kembali & Ubah Data
          </button>
        </>
      )}
    </div>
  );
}

export default RegisterForm;

