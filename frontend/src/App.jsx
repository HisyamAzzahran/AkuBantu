import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Analytics } from '@vercel/analytics/react';

import LandingHeader from './components/LandingHeader'; 
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import AdminDashboard from "./components/AdminDashboard";
import ModeSelector from "./components/ModeSelector";
import EssayExchangesGenerator from "./components/EssayExchangesGenerator";
import InterviewPage from './components/InterviewPage';
import ResultPage from './components/ResultPage';
import TopBar from './components/TopBar';
import IkigaiInputForm from './components/Ikigai/IkigaiInputForm';
import IkigaiTestLink from './components/Ikigai/IkigaiTestLink';
import IkigaiAnalyzer from './components/Ikigai/IkigaiAnalyzer';
import IkigaiFinalAnalyzer from './components/Ikigai/IkigaiFinalAnalyzer';
import TrackIkigai from './components/TrackIkigai';
import SwotAnalyzer from './components/SwotAnalyzer';
import StudentGoalsPlanner from './components/StudentGoalsPlanner';
import ActivityTracker from './components/ActivityTracker';
import TeamAndFooter from './components/TeamAndFooter';
import CustomCursor from './components/CustomCursor'; 
import PromoBanner from './components/PromoBanner';
import PaymentSuccessBanner from './components/PaymentSuccessBanner';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import 'animate.css';
import { Zap, Crown, Gift, Coins, Package, Loader, Target, Rocket, Award, Shield, Globe2, Sparkles, BookOpen, BrainCircuit, CheckCircle2, UserPlus } from 'lucide-react';
// Helper icon for step 2 (menu)
const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);


const API_URL = "https://webai-production-b975.up.railway.app";

// --- Komponen Halaman Landing ---

const PricingSection = ({ onNavigate }) => {
    const productCatalog = {
        premium: [
          { id: 'PREMIUM_1MO', name: 'Premium 1 Bulan', price: 39000, type: 'premium', description: "Akses penuh semua fitur premium AkuBantu selama 30 hari.", duration_days: 30, token_amount: 0, icon: <Zap size={28} className="product-icon premium-icon"/>, best_value: false },
          { id: 'PREMIUM_1YR', name: 'Premium 1 Tahun', price: 399000, type: 'premium', description: "Hemat lebih banyak dengan akses premium penuh selama 365 hari.", duration_days: 365, token_amount: 0, icon: <Crown size={28} className="product-icon premium-icon"/>, best_value: true },
        ],
        token: [
          { id: 'TOKEN_PAKET_5', name: '5 Token', price: 7495, type: 'token', token_amount: 5, description: "Cocok untuk mencoba beberapa fitur premium.", icon: <Gift size={28} className="product-icon token-icon"/>, best_value: false },
          { id: 'TOKEN_PAKET_10', name: '10 Token', price: 9999, type: 'token', token_amount: 10, description: "Pilihan populer untuk penggunaan reguler.", icon: <Coins size={28} className="product-icon token-icon"/>, best_value: true },
          { id: 'TOKEN_CUSTOM', name_template: '{amount} Token Kustom', price_per_token: 1499, type: 'token', description: "Beli token sesuai jumlah yang Anda butuhkan.", icon: <Package size={28} className="product-icon token-icon"/> }
        ],
    };

    const formatRupiah = (angka) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
    }

    return (
        <section id="pricing" className="pricing-section">
            <h2 className="section-title">Pilihan Paket Untuk Anda</h2>
            <p className="section-subtitle">Investasi terbaik untuk pengembangan diri Anda. Pilih paket yang paling sesuai dengan kebutuhan.</p>
            
            <div className="pricing-category-wrapper">
                <h3 className="pricing-category-title">Langganan Premium</h3>
                <div className="pricing-container">
                    {productCatalog.premium.map(item => (
                        <div key={item.id} className={`pricing-card futuristic-border ${item.best_value ? 'best-value' : ''}`}>
                            {item.best_value && <div className="best-value-badge">Best Value</div>}
                            <div className="pricing-icon-wrapper">{item.icon}</div>
                            <h3 className="pricing-title">{item.name}</h3>
                            <p className="pricing-description">{item.description}</p>
                            <div className="price">{formatRupiah(item.price)}</div>
                            <button className="cta-button primary" onClick={onNavigate}>
                                Pilih Paket
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="pricing-category-wrapper">
                <h3 className="pricing-category-title">Paket Token</h3>
                <div className="pricing-container">
                    {productCatalog.token.filter(item => item.id !== 'TOKEN_CUSTOM').map(item => (
                         <div key={item.id} className={`pricing-card futuristic-border ${item.best_value ? 'best-value' : ''}`}>
                            {item.best_value && <div className="best-value-badge">Best Value</div>}
                            <div className="pricing-icon-wrapper">{item.icon}</div>
                            <h3 className="pricing-title">{item.name}</h3>
                            <p className="pricing-description">{item.description}</p>
                            <div className="price">{formatRupiah(item.price)}</div>
                            <button className="cta-button primary" onClick={onNavigate}>
                                Pilih Paket
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

const LoadingTransition = () => (
    <div className="loading-transition-overlay">
        <div className="loading-grid-bg"></div>
        <div className="loading-content">
            <div className="loading-core"></div>
            <p className="loading-text">Mempersiapkan Landasan Pacu...</p>
        </div>
    </div>
);


const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [tokens, setTokens] = useState(0);
  const [showRegister, setShowRegister] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [username, setUsername] = useState('');
  const [ikigaiStep, setIkigaiStep] = useState(1);
  const [userIkigaiData, setUserIkigaiData] = useState({});
  const [ikigaiSpotList, setIkigaiSpotList] = useState([]);
  const [sliceList, setSliceList] = useState([]);
  const [showLanding, setShowLanding] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleLogin = (premium, userEmail, admin, tokenValue, userUsername) => {
    setIsLoggedIn(true);
    setIsPremium(premium);
    setEmail(userEmail);
    setIsAdmin(admin);
    setUsername(userUsername || userEmail.split('@')[0]); 
    setTokens(tokenValue);
    setSelectedMode(null);
    setShowRegister(false);
    setShowLanding(false);
    setShowAuth(false);
    localStorage.setItem('akubantu_session', JSON.stringify({
      email: userEmail,
      username: userUsername || userEmail.split('@')[0],
      isPremium: premium,
      isAdmin: admin,
      tokens: tokenValue,
      ts: Date.now()
    }));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setIsPremium(false);
    setIsAdmin(false);
    setEmail('');
    setTokens(0);
    setUsername('');
    setSelectedMode(null);
    setShowLanding(true);
    setShowAuth(false);
    localStorage.removeItem('akubantu_session');
  };

  const resetToMenu = () => {
    setShowResult(false);
    setSelectedMode(null);
    setIkigaiStep(1);
  };

  const handleNavigateToAuth = () => {
    setIsNavigating(true);
    setTimeout(() => {
        setShowLanding(false);
        setShowAuth(true);
        setIsNavigating(false);
    }, 1500);
  };

  // Restore session on first load
  useEffect(() => {
    try {
      const raw = localStorage.getItem('akubantu_session');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.email) {
        setIsLoggedIn(true);
        setEmail(s.email);
        setUsername(s.username || s.email.split('@')[0]);
        setIsPremium(!!s.isPremium);
        setIsAdmin(!!s.isAdmin);
        setTokens(Number(s.tokens) || 0);
        setShowLanding(false);
        setShowAuth(false);
      }
    } catch {}
  }, []);

  // Keep session in sync when tokens or premium changes
  useEffect(() => {
    if (!isLoggedIn) return;
    const raw = localStorage.getItem('akubantu_session');
    const s = raw ? JSON.parse(raw) : {};
    localStorage.setItem('akubantu_session', JSON.stringify({
      email: email || s.email,
      username: username || s.username,
      isPremium,
      isAdmin,
      tokens,
      ts: Date.now()
    }));
  }, [tokens, isPremium, isAdmin, username, email, isLoggedIn]);

  // Payment success banner via URL param
  const [showPaymentBanner, setShowPaymentBanner] = useState(false);
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const payment = url.searchParams.get('payment');
      if (payment === 'success') {
        setShowPaymentBanner(true);
        // Remove param to avoid repeat
        url.searchParams.delete('payment');
        window.history.replaceState({}, '', url.toString());
      }
    } catch {}
  }, []);

  // Poll user state after payment to ensure tokens/premium sync
  useEffect(() => {
    const poll = async () => {
      const raw = localStorage.getItem('akubantu_session');
      if (!raw) return;
      const s = JSON.parse(raw);
      if (!s?.email) return;
      const TIMES = 5; // ~15s total (every 3s)
      for (let i = 0; i < TIMES; i++) {
        try {
          const res = await axios.get(`${API_URL}/user/state`, { params: { email: s.email } });
          const data = res.data || {};
          if (typeof data.tokens === 'number') setTokens(data.tokens);
          if (typeof data.is_premium !== 'undefined') setIsPremium(!!data.is_premium);
          // early exit if premium true and token updated
          if (data.is_premium || i === TIMES - 1) break;
        } catch {}
        await new Promise(r => setTimeout(r, 3000));
      }
    };
    if (showPaymentBanner) poll();
  }, [showPaymentBanner]);

  const handleBackToLanding = () => {
    setShowAuth(false);
    setShowLanding(true);
  };

  const renderLandingPage = () => (
    <div className="landing-page-wrapper">
        <LandingHeader onNavigate={handleNavigateToAuth} />
        <main className="landing-main-content">
            <section className="landing-container" id="home">
                <div className="stars"></div>
                <div className="twinkling"></div>
                
                <div className="landing-content">
                    <div className="hero-section">
                        <div className="logo-container animate__animated animate__fadeInDown">
                            <div className="logo-glow">
                                <span className="logo-text">AkuBantu</span>
                                <div className="logo-subtitle">AI-Powered Student Development Companion</div>
                                <Analytics />
                            </div>
                        </div>
                        
                        <div className="hero-text animate__animated animate__fadeInUp animate__delay-1s">
                            <h1 className="hero-title">
                                Masa Depan <span className="gradient-text">Kecerdasan Buatan</span> Dimulai Dari Sini
                            </h1>
                            <p className="hero-description">
                                AkuBantu adalah pendamping Student Development berbasis AI untuk memetakan potensi, merancang strategi belajar, dan menyiapkan karier masa depanmu.
                            </p>
                        </div>

                        <div className="features-preview animate__animated animate__fadeInUp animate__delay-2s">
                            <div className="feature-item"><span>Ikigai Mapping</span></div>
                            <div className="feature-item"><span>SWOT Analysis</span></div>
                            <div className="feature-item"><span>Student Goals Planner</span></div>
                            <div className="feature-item"><span>Daily Activity Tracker</span></div>
                            <div className="feature-item"><span>Interview Simulator</span></div>
                            <div className="feature-item"><span>Motivation Letter Assistant</span></div>
                        </div>

                        <div className="cta-section animate__animated animate__fadeInUp animate__delay-3s">
                            <button className="cta-button primary" onClick={handleNavigateToAuth}>
                                <span className="button-text">Mulai Eksplorasi</span>
                                <div className="button-glow"></div>
                            </button>
                        </div>
                    </div>
                </div>
                {/* Trust bar */}
                <div className="trustbar">
                    <div className="trust-item"><Shield size={18}/> Keamanan & Privasi
                    </div>
                    <div className="trust-item"><Award size={18}/> Kualitas Teruji
                    </div>
                    <div className="trust-item"><Globe2 size={18}/> Skala Internasional
                    </div>
                    <div className="trust-item"><Sparkles size={18}/> Inovasi Berkelanjutan
                    </div>
                </div>
            </section>
            {/* Feature highlights */}
            <section className="section-pro">
                <div className="section-heading">
                    <h2>Fitur Unggulan</h2>
                    <p>Semua yang Anda butuhkan untuk belajar, berkarya, dan berkembang.</p>
                </div>
                <div className="feature-grid-pro">
                    <div className="feature-card-pro">
                        <div className="icon"><BookOpen size={22}/></div>
                        <h3>Ikigai Self Discovery</h3>
                        <p>Pemetaan sweet spot karier dengan kombinasi data MBTI, VIA, dan tujuan hidupmu.</p>
                    </div>
                    <div className="feature-card-pro">
                        <div className="icon"><BrainCircuit size={22}/></div>
                        <h3>SWOT Analyzer</h3>
                        <p>Dapatkan insight kekuatan, peluang, dan langkah perbaikan paling relevan.</p>
                    </div>
                    <div className="feature-card-pro">
                        <div className="icon"><Target size={22}/></div>
                        <h3>Student Goals Planning</h3>
                        <p>Bangun roadmap akademik per semester lengkap dengan action plan terukur.</p>
                    </div>
                    <div className="feature-card-pro">
                        <div className="icon"><Rocket size={22}/></div>
                        <h3>Daily Activity Coach</h3>
                        <p>Konversi rencana semester menjadi jadwal mingguan yang siap dijalankan.</p>
                    </div>
                    <div className="feature-card-pro">
                        <div className="icon"><Award size={22}/></div>
                        <h3>Interview Simulator</h3>
                        <p>Latihan interview beasiswa dan magang dengan feedback langsung dari AI.</p>
                    </div>
                    <div className="feature-card-pro">
                        <div className="icon"><Globe2 size={22}/></div>
                        <h3>Motivation Letter Assistant</h3>
                        <p>Susun motivation letter exchange yang personal dan terasa autentik.</p>
                    </div>
                </div>
            </section>
            {/* How it works */}
            <section className="section-pro how-it-works">
                <div className="section-heading">
                    <h2>Cara Kerja</h2>
                    <p>Tiga langkah sederhana untuk mulai produktif.</p>
                </div>
                <div className="steps-grid">
                    <div className="step-card">
                        <div className="step-icon"><UserPlus size={20}/></div>
                        <h4>1. Daftar</h4>
                        <p>Buat akun atau login untuk menyimpan progres Anda.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-icon"><MenuIcon/></div>
                        <h4>2. Pilih Mode</h4>
                        <p>Pilih modul Student Development seperti Ikigai, SWOT, Goals Planning, atau Interview.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-icon"><CheckCircle2 size={20}/></div>
                        <h4>3. Dapatkan Hasil</h4>
                        <p>Terapkan hasilnya dengan mudah; siap dipresentasikan atau dikirim.</p>
                    </div>
                </div>
            </section>
            {/* CTA banner */}
            <section className="cta-banner-pro">
                <div className="cta-banner-inner">
                    <div className="cta-banner-text">
                        <h3>Tingkatkan produktivitas Anda</h3>
                        <p>Coba gratis dan rasakan perbedaannya dalam hitungan menit.</p>
                    </div>
                    <button className="cta-button primary" onClick={handleNavigateToAuth}>Coba Sekarang</button>
                </div>
            </section>
            <PricingSection onNavigate={handleNavigateToAuth} />
            <div id="about">
              <TeamAndFooter />
            </div>
        </main>

        <div className="floating-elements">
            <div className="floating-cube cube-1"></div>
            <div className="floating-cube cube-2"></div>
            <div className="floating-cube cube-3"></div>
            <div className="floating-sphere sphere-1"></div>
            <div className="floating-sphere sphere-2"></div>
            <div className="floating-ring ring-1"></div>
            <div className="floating-ring ring-2"></div>
            <div className="floating-plus plus-1"></div>
            <div className="floating-plus plus-2"></div>
            <div className="floating-sphere sphere-3"></div>
            <div className="floating-cube cube-4"></div>
            <div className="floating-ring ring-3"></div>
            <div className="floating-plus plus-3"></div>
        </div>
    </div>
);
  
  const renderAuthForms = () => (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-particles"></div>
      </div>
      
      <div className="auth-wrapper">
      
        <button className="back-to-landing-btn" onClick={handleBackToLanding}>
          ← Kembali ke Beranda
        </button>
      
        <div className="auth-card futuristic animate__animated animate__fadeInUp">
          {showRegister ? (
            <>
              <RegisterForm apiUrl={API_URL} onRegisterSuccess={() => setShowRegister(false)} />
              <div className="auth-toggle">
                <span>Sudah memiliki akun? </span>
                <button className="auth-toggle-link" onClick={() => setShowRegister(false)}>
                  Masuk di sini
                </button>
              </div>
            </>
          ) : (
            <>
              <LoginForm apiUrl={API_URL} onLogin={handleLogin} />
              <div className="auth-toggle">
                <span>Belum memiliki akun? </span>
                <button className="auth-toggle-link" onClick={() => setShowRegister(true)}>
                  Daftar sekarang
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderSelectedModeContent = () => (
    <div className="main-content-wrapper futuristic">
      <button className="back-to-menu-btn futuristic" onClick={resetToMenu}>
        ⬅️ Kembali ke Menu Utama
      </button>

      {selectedMode === "exchanges" && (
        <EssayExchangesGenerator isPremium={isPremium} email={email} tokenSisa={tokens} setTokenSisa={setTokens} apiUrl={API_URL} />
      )}
      {selectedMode === "interview" && !showResult && (
        <InterviewPage isPremium={isPremium} email={email} tokenSisa={tokens} setTokenSisa={setTokens} apiUrl={API_URL}
          onFinish={(result) => {
            setResultData(result);
            setShowResult(true);
          }}
        />
      )}
      {selectedMode === "interview" && showResult && (
        <ResultPage {...resultData} onRestart={resetToMenu} />
      )}
      {selectedMode === "studentgoals" && (
        <StudentGoalsPlanner
          email={email}
          tokenSisa={tokens}
          setTokenSisa={setTokens}
          isPremium={isPremium}
        />
      )}
      {selectedMode === "ikigai" && (
        <>
          {ikigaiStep === 1 && <IkigaiInputForm onNext={() => setIkigaiStep(2)} saveUserData={setUserIkigaiData} />}
          {ikigaiStep === 2 && <IkigaiTestLink onNext={() => setIkigaiStep(3)} />}
          {ikigaiStep === 3 && (
            <IkigaiAnalyzer email={email} isPremium={isPremium} tokenSisa={tokens} setTokenSisa={setTokens} userData={userIkigaiData}
              onResult={(res) => {
                setIkigaiSpotList(res.spotList || []);
                setSliceList(res.sliceList || []);
                setUserIkigaiData((prev) => ({ ...prev, mbti: res.mbti, via: res.via, career: res.career }));
                setIkigaiStep(4);
              }}
            />
          )}
          {ikigaiStep === 4 && (
            <IkigaiFinalAnalyzer email={email} isPremium={isPremium} tokenSisa={tokens} setTokenSisa={setTokens} userData={userIkigaiData} ikigaiSpotList={ikigaiSpotList} sliceList={sliceList} />
          )}
        </>
      )}
      {selectedMode === "swot" && (
        <SwotAnalyzer isPremium={isPremium} email={email} tokenSisa={tokens} setTokenSisa={setTokens} userData={{ nama: email.split("@")[0] }} />
      )}
      {selectedMode === 'activitytracker' && (
        <ActivityTracker 
          email={email} 
          isPremium={isPremium} 
          setTokenSisa={setTokens}
        />
      )}
      
      <div className="token-info-card futuristic">
        <div className="token-icon"><Target size={18}/></div>
        <div className="token-text">
          <span>Token Tersisa</span>
          <strong>{tokens}</strong>
        </div>
      </div>
      
      {!isPremium && (
        <div className="premium-upgrade-card futuristic">
          <div className="premium-content">
            <div className="premium-icon"><Rocket size={18}/></div>
            <div className="premium-text">
              <h4>Upgrade ke Premium</h4>
              <p>Akses semua fitur premium dan dapatkan lebih banyak token.</p>
            </div>
            <a
              href="https://wa.me/6282211929271"
              target="_blank"
              rel="noopener noreferrer"
              className="premium-btn"
            >
              Upgrade Sekarang
            </a>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container futuristic">
      {/* PERBAIKAN: Menambahkan komponen kursor di sini */}
      <CustomCursor />
      {!isLoggedIn && showLanding && <PromoBanner onUpgrade={handleNavigateToAuth} />}
      {isLoggedIn && !isPremium && <PromoBanner onUpgrade={handleNavigateToAuth} />}
      {showPaymentBanner && <PaymentSuccessBanner onClose={() => setShowPaymentBanner(false)} />}
      
      {isLoggedIn && <TopBar email={email} username={username} isPremium={isPremium} onLogout={handleLogout} />}
      <ToastContainer 
        position="top-right" 
        autoClose={3000} 
        hideProgressBar={false} 
        newestOnTop={false} 
        closeOnClick 
        rtl={false} 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover 
        theme="dark"
        toastClassName="futuristic-toast"
      />

      {isNavigating ? <LoadingTransition /> : (
        <Routes>
            <Route
                path="/"
                element={
                    showLanding ? (
                        renderLandingPage()
                    ) : !isLoggedIn ? (
                        renderAuthForms()
                    ) : isAdmin ? (
                        <AdminDashboard apiUrl={API_URL} />
                    ) : !selectedMode ? (
                        <ModeSelector onSelectMode={setSelectedMode} isPremium={isPremium} />
                    ) : (
                        renderSelectedModeContent()
                    )
                }
            />
            <Route 
                path="/admin/track-ikigai" 
                element={isLoggedIn && isAdmin ? <TrackIkigai /> : <Navigate to="/" />} 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </div>
  );
};

export default App;

