import React, { useState } from 'react';
import { Home, Info, Tag, LogIn, Menu, X } from 'lucide-react';

// PERBAIKAN TOTAL: Struktur JSX header dirombak untuk mendukung menu mobile
const LandingHeader = ({ onNavigate }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <header className="new-header-container">
            <div className="new-header-wrapper">
                
                {/* Bagian Kiri: Logo */}
                <div className="new-header-left">
                    <span className="new-logo-text">AkuBantu</span>
                </div>

                {/* Bagian Tengah: Navigasi (Hanya untuk Desktop) */}
                <nav className="new-header-center">
                    <a href="#home" className="new-nav-link">
                        <Home size={16} />
                        <span>Home</span>
                    </a>
                    <a href="#pricing" className="new-nav-link">
                        <Tag size={16} />
                        <span>Price</span>
                    </a>
                    <a href="#about" className="new-nav-link">
                        <Info size={16} />
                        <span>About</span>
                    </a>
                </nav>

                {/* Bagian Kanan: Tombol Login (Hanya untuk Desktop) */}
                <div className="new-header-right">
                    <button className="new-login-btn" onClick={onNavigate}>
                        <LogIn size={16} />
                        <span>Login</span>
                    </button>
                </div>

                {/* Tombol Hamburger (Hanya untuk Mobile) */}
                <div className="mobile-menu-toggle">
                    <button onClick={toggleMobileMenu}>
                        {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                    </button>
                </div>
            </div>

            {/* Menu Mobile (Muncul saat tombol hamburger diklik) */}
            {isMobileMenuOpen && (
                <div className="mobile-menu-dropdown">
                    <a href="#home" className="mobile-nav-link" onClick={toggleMobileMenu}>Home</a>
                    <a href="#pricing" className="mobile-nav-link" onClick={toggleMobileMenu}>Price</a>
                    <a href="#about" className="mobile-nav-link" onClick={toggleMobileMenu}>About</a>
                    <button className="mobile-login-btn" onClick={() => { onNavigate(); toggleMobileMenu(); }}>Login</button>
                </div>
            )}
        </header>
    );
};

export default LandingHeader;
