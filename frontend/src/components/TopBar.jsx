import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ShoppingCart, X, LogOut, UserCircle, Crown, Coins, Zap, Package, Gift, Award } from 'lucide-react';
import LeaderboardModal from './LeaderboardModal';

const API_URL = "https://webai-production-b975.up.railway.app";
// State konfigurasi Midtrans (diambil dari backend agar selalu sinkron)
// Akan fallback ke env Vite bila endpoint tidak tersedia
const FALLBACK_CLIENT_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MIDTRANS_CLIENT_KEY)
  ? import.meta.env.VITE_MIDTRANS_CLIENT_KEY
  : "Mid-client-JOo3HqkYlo-7INwj";
const FALLBACK_ENV = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MIDTRANS_ENV)
  ? String(import.meta.env.VITE_MIDTRANS_ENV).toLowerCase()
  : 'production';

// Komponen Modal
const Modal = ({ onClose, children }) => {
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    return (
        <div className="modal-overlay-futuristic" onClick={handleOverlayClick}>
            <div onClick={(e) => e.stopPropagation()}>{children}</div>
        </div>
    );
};

// Loader kecil untuk tombol (mengganti referensi CssLoader yang tidak didefinisikan)
const CssLoader = ({ size = 16, color = 'currentColor' }) => (
    <span
        className="css-loader-mini"
        style={{
            width: `${size}px`,
            height: `${size}px`,
            color,
        }}
        aria-hidden="true"
    />
);

// CSS Loader (tidak dipakai lagi, diseragamkan via CSS data-loading)

const TopBar = ({ email, username, isPremium, onLogout, setTokenSisa, setIsPremiumState }) => {
    const navigate = useNavigate();
    const [midtransSnapToken, setMidtransSnapToken] = useState('');
    const [isLoadingPayment, setIsLoadingPayment] = useState(false);
    const [currentProcessingItemId, setCurrentProcessingItemId] = useState(null);

    const productCatalog = {
        premium: [
            { id: 'PREMIUM_1MO', name: 'Premium 1 Bulan', price: 39000, type: 'premium', description: "Akses penuh semua fitur premium AkuBantu selama 30 hari.", duration_days: 30, token_amount: 0, icon: <Zap size={28} className="product-icon premium-icon" />, best_value: false },
            { id: 'PREMIUM_1YR', name: 'Premium 1 Tahun', price: 399000, type: 'premium', description: "Hemat lebih banyak dengan akses premium penuh selama 365 hari.", duration_days: 365, token_amount: 0, icon: <Crown size={28} className="product-icon premium-icon" />, best_value: true },
        ],
        token: [
            { id: 'TOKEN_PAKET_5', name: '5 Token', price: 7495, type: 'token', token_amount: 5, description: "Cocok untuk mencoba beberapa fitur premium.", icon: <Gift size={28} className="product-icon token-icon" />, best_value: false },
            { id: 'TOKEN_PAKET_10', name: '10 Token', price: 9999, type: 'token', token_amount: 10, description: "Pilihan populer untuk penggunaan reguler.", icon: <Coins size={28} className="product-icon token-icon" />, best_value: true },
            { id: 'TOKEN_CUSTOM', name_template: '{amount} Token Kustom', price_per_token: 1499, type: 'token', description: "Beli token sesuai jumlah yang Anda butuhkan, minimal 5.", icon: <Package size={28} className="product-icon token-icon" />, min_amount: 5 }
        ],
    };

    const [showProductSelectionModal, setShowProductSelectionModal] = useState(false);
    const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
    const [productsToShow, setProductsToShow] = useState([]);
    const [paymentTypeForModal, setPaymentTypeForModal] = useState('');
    const [customTokenAmount, setCustomTokenAmount] = useState(5);

    const refreshUserState = async () => {
        try {
            const res = await axios.get(`${API_URL}/user/state`, { params: { email } });
            const data = res.data || {};
            if (typeof data.tokens === 'number' && setTokenSisa) setTokenSisa(data.tokens);
            if (typeof data.is_premium !== 'undefined' && setIsPremiumState) setIsPremiumState(!!data.is_premium);
            if (data.will_expire_soon && data.days_left >= 0) {
                toast.info(`Premium Anda akan berakhir dalam ${data.days_left} hari.`);
            }
            if (!data.is_premium && data.premium_expires_at) {
                toast.info('Masa aktif Premium Anda telah berakhir.');
            }
        } catch (e) {
            // silently ignore
        }
    };

    // MENGATASI SCROLLBAR BODY SAAT MODAL AKTIF
    useEffect(() => {
        if (showProductSelectionModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [showProductSelectionModal]);

    // EFEK UNTUK SCRIPT MIDTRANS
    const [midtransEnv, setMidtransEnv] = useState(FALLBACK_ENV);
    const [midtransClientKey, setMidtransClientKey] = useState(FALLBACK_CLIENT_KEY);

    // Ambil konfigurasi dari backend lalu inject script Snap sesuai environment sebenarnya
    useEffect(() => {
        let cancelled = false;
        const fetchConfigAndInject = async () => {
            try {
                const res = await axios.get(`${API_URL}/payment/config`);
                const isProd = !!res.data?.is_production;
                const cKey = res.data?.client_key || FALLBACK_CLIENT_KEY;
                if (cancelled) return;
                setMidtransEnv(isProd ? 'production' : 'sandbox');
                setMidtransClientKey(cKey);
                // replace script if exist
                const existing = document.getElementById('midtrans-snap-script');
                if (existing) existing.remove();
                const script = document.createElement('script');
                script.id = 'midtrans-snap-script';
                script.src = isProd ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
                script.setAttribute('data-client-key', cKey);
                script.async = true;
                document.body.appendChild(script);
            } catch {
                // fallback jika backend belum expose endpoint
                if (!document.getElementById('midtrans-snap-script')) {
                    const script = document.createElement('script');
                    script.id = 'midtrans-snap-script';
                    script.src = FALLBACK_ENV === 'production' ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
                    script.setAttribute('data-client-key', FALLBACK_CLIENT_KEY);
                    script.async = true;
                    document.body.appendChild(script);
                }
            }
        };
        fetchConfigAndInject();
        return () => { cancelled = true; };
    }, []);

    const handlePaymentCallback = useCallback((result, paymentItem) => {
        if (paymentItem?.type === 'premium' && setIsPremiumState) {
            setIsPremiumState(true);
            toast.success("Akun Anda berhasil diupgrade ke Premium!");
            refreshUserState();
        } else if (paymentItem?.type === 'token' && setTokenSisa) {
            const tokensAdded = paymentItem.id === 'TOKEN_CUSTOM' ? paymentItem.custom_token_quantity : paymentItem.token_amount;
            if (tokensAdded) {
                toast.success(`${tokensAdded} token akan segera ditambahkan.`);
                refreshUserState();
            }
        }
        // Arahkan ke beranda dengan flag sukses untuk menampilkan notifikasi/section
        try { navigate('/?payment=success'); } catch {}
    }, [setIsPremiumState, setTokenSisa, navigate]);

    useEffect(() => {
        let snapClosedWithoutAction = true;
        if (midtransSnapToken && window.snap && currentProcessingItemId) {
            const paymentItemDetail = productCatalog[paymentTypeForModal]?.find(p => p.id === currentProcessingItemId) || (currentProcessingItemId === 'TOKEN_CUSTOM' ? { id: 'TOKEN_CUSTOM', type: 'token', custom_token_quantity: customTokenAmount } : null);
            setIsLoadingPayment(false);
            window.snap.pay(midtransSnapToken, {
                onSuccess: (result) => { snapClosedWithoutAction = false; toast.success(`✅ Pembayaran berhasil!`); if (paymentItemDetail) handlePaymentCallback(result, paymentItemDetail); setMidtransSnapToken(''); setCurrentProcessingItemId(null); },
                onPending: (result) => { snapClosedWithoutAction = false; toast.info(`⏳ Pembayaran Anda tertunda.`); setMidtransSnapToken(''); setCurrentProcessingItemId(null); },
                onError: (result) => { snapClosedWithoutAction = false; toast.error(`❌ Terjadi kesalahan pembayaran.`); setMidtransSnapToken(''); setCurrentProcessingItemId(null); },
                onClose: () => { if (snapClosedWithoutAction && midtransSnapToken) { setMidtransSnapToken(''); setCurrentProcessingItemId(null); setIsLoadingPayment(false); toast.info("Pembayaran dibatalkan."); } }
            });
        }
    }, [midtransSnapToken, currentProcessingItemId, handlePaymentCallback, paymentTypeForModal, customTokenAmount]);

    // Initial refresh on mount
    useEffect(() => { if (email) { refreshUserState(); } }, [email]);

    // FUNGSI INITIATE PAYMENT (LENGKAP)
    const initiateMidtransPayment = async (selectedProduct) => {
        if (!email) { toast.error("Email pengguna tidak ditemukan."); return; }
        const clientKeyToUse = midtransClientKey || FALLBACK_CLIENT_KEY;
        if (!clientKeyToUse || clientKeyToUse.length < 15) { toast.error("❌ Konfigurasi Client Key Midtrans belum benar."); return; }
        
        setIsLoadingPayment(true);
        setCurrentProcessingItemId(selectedProduct.id);
        
        let finalPrice = selectedProduct.price;
        let finalItemName = selectedProduct.name;
        let customTokenQty = null;

        if (selectedProduct.id === 'TOKEN_CUSTOM') {
            if (!customTokenAmount || customTokenAmount < 1 || isNaN(customTokenAmount)) { 
                toast.error("Jumlah token kustom tidak valid."); 
                setIsLoadingPayment(false); 
                setCurrentProcessingItemId(null); 
                return; 
            }
            const customProductConfig = productCatalog.token.find(p => p.id === 'TOKEN_CUSTOM');
            const pricePerToken = customProductConfig?.price_per_token || 1499;
            finalPrice = customTokenAmount * pricePerToken;
            finalItemName = customProductConfig?.name_template.replace("{amount}", customTokenAmount.toString()) || `${customTokenAmount} Token Kustom`;
            customTokenQty = customTokenAmount;
        }

        const payload = { 
            email, 
            username, 
            item_id: selectedProduct.id, 
            item_details: [{ id: selectedProduct.id, price: finalPrice, quantity: 1, name: finalItemName }], 
            total_amount: finalPrice, 
            payment_type_request: selectedProduct.type, 
            ...(customTokenQty !== null && { custom_token_quantity: customTokenQty }) 
        };

        try {
            const response = await axios.post(`${API_URL}/payment/create-transaction`, payload);
            if (response.data && response.data.snap_token) {
                setMidtransSnapToken(response.data.snap_token);
            } else { 
                throw new Error(response.data.error || "Gagal memulai sesi pembayaran."); 
            }
        } catch (error) {
            toast.error(error.response?.data?.error || error.message || "Gagal menghubungi server pembayaran.");
            setIsLoadingPayment(false); 
            setCurrentProcessingItemId(null);
        }
    };

    const openProductSelectionModal = (type) => { setPaymentTypeForModal(type); setProductsToShow(productCatalog[type] || []); setShowProductSelectionModal(true); setCustomTokenAmount(5); };
    const handleCustomTokenChange = (e) => { const value = e.target.value; if (value === '' || (/^\d+$/.test(value) && parseInt(value, 10) >= 1)) { setCustomTokenAmount(value === '' ? '' : parseInt(value, 10)); } else if (value !== '' && parseInt(value, 10) < 1) { setCustomTokenAmount(1); } };
    const handleCustomTokenSubmit = () => { if (customTokenAmount && customTokenAmount >= 5) { const customProductConfig = productCatalog.token.find(p => p.id === 'TOKEN_CUSTOM'); if (!customProductConfig) { toast.error("Konfigurasi token kustom error."); return; } initiateMidtransPayment({ id: 'TOKEN_CUSTOM', name: customProductConfig.name_template.replace("{amount}", customTokenAmount.toString()), price: customTokenAmount * (customProductConfig.price_per_token || 1499), type: 'token', token_amount: customTokenAmount }); } else { toast.warn("Masukkan jumlah token minimal 5.") } };
    const closeModal = () => { if (!isLoadingPayment) { setShowProductSelectionModal(false); } };

    return (
        <>
            {/* BAGIAN TOP BAR (LENGKAP) */}
            <div className="topbar-container-futuristic">
                <div className="logo-text-futuristic">AkuBantu</div>
                <div className="topbar-nav-items-futuristic">
                    {!isPremium && (
                        <button className="topbar-action-btn-futuristic premium-btn" onClick={() => openProductSelectionModal('premium')} disabled={isLoadingPayment && currentProcessingItemId?.startsWith('PREMIUM')}>
                            {isLoadingPayment && currentProcessingItemId?.startsWith('PREMIUM') ? <CssLoader size={16} color="currentColor" /> : <Crown size={16} />}
                            <span>Jadi Premium</span>
                        </button>
                    )}
                    <button className="topbar-action-btn-futuristic token-btn" onClick={() => openProductSelectionModal('token')} disabled={isLoadingPayment && currentProcessingItemId?.startsWith('TOKEN')}>
                        {isLoadingPayment && currentProcessingItemId?.startsWith('TOKEN') ? <CssLoader size={16} color="currentColor" /> : <Coins size={16} />}
                        <span>Beli Token</span>
                    </button>
                </div>
                <div className="topbar-right-futuristic">
                    <button className="leaderboard-btn-futuristic" title="Lihat Papan Peringkat" onClick={() => setIsLeaderboardOpen(true)} data-loading={undefined}>
                        <Award size={18} />
                    </button>
                    <div className="user-info-futuristic">
                        <span className="user-email-futuristic"><UserCircle size={14} /> {username || email}</span>
                        <span className={`user-status-badge-futuristic ${isPremium ? 'premium' : 'basic'}`}>
                            {isPremium ? <><Crown size={10} /> Premium</> : 'Basic'}
                        </span>
                    </div>
                    {onLogout && (
                        <button onClick={onLogout} className="logout-btn-futuristic" title="Keluar" data-loading={undefined}>
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* BAGIAN MODAL (DENGAN TAMPILAN BARU) */}
            {showProductSelectionModal && (
                <Modal onClose={closeModal}>
                    <div className="modal-content-futuristic product-modal">
                        <div className="modal-header-futuristic">
                            <h5 className="modal-title-futuristic">
                                {paymentTypeForModal === 'token' ? <Coins size={24} /> : <Crown size={24} />}
                                Pilih {paymentTypeForModal === 'token' ? 'Paket Token' : 'Langganan Premium'}
                            </h5>
                            <button onClick={closeModal} className="btn-close-futuristic" disabled={isLoadingPayment}><X size={20} /></button>
                        </div>
                        <div className="modal-body-futuristic product-grid">
                            {productsToShow.map(product => (product.id !== 'TOKEN_CUSTOM' &&
                                <div key={product.id} className="product-item-card-futuristic" onClick={() => !isLoadingPayment && initiateMidtransPayment(product)}>
                                    {product.best_value && <div className="best-value-badge-futuristic">Pilihan Terbaik</div>}
                                    <div className="product-icon-wrapper-futuristic">{product.icon}</div>
                                    <h6 className="product-title">{product.name}</h6>
                                    <p className="product-description">{product.description}</p>
                                    <p className="product-price">Rp{product.price.toLocaleString('id-ID')},-</p>
                                    <button className="select-product-btn-futuristic" disabled={isLoadingPayment} data-loading={(isLoadingPayment && currentProcessingItemId === product.id) || undefined}>
                                        <ShoppingCart size={18} />
                                        <span>Pilih & Bayar</span>
                                    </button>
                                </div>
                            ))}
                            {paymentTypeForModal === 'token' && (
                                <div className="custom-token-card-futuristic">
                                    <div className="custom-token-content">
                                        <div className="product-icon-wrapper-futuristic">{productCatalog.token.find(p => p.id === 'TOKEN_CUSTOM')?.icon}</div>
                                        <h6 className="product-title">Beli Jumlah Lain?</h6>
                                        <p className="product-description">Beli token sesuai jumlah yang Anda butuhkan.</p>
                                    </div>
                                    <div className="custom-token-action">
                                        <div className="custom-token-input-container">
                                            <input type="number" value={customTokenAmount} onChange={handleCustomTokenChange} placeholder="Jumlah" min="5" disabled={isLoadingPayment} />
                                            <span>Token</span>
                                        </div>
                                        {customTokenAmount >= 5 && <p className="custom-token-total-price">Estimasi: <strong>Rp{(customTokenAmount * 1499).toLocaleString('id-ID')},-</strong></p>}
                                        <button className="select-product-btn-futuristic" onClick={handleCustomTokenSubmit} disabled={isLoadingPayment || !customTokenAmount || customTokenAmount < 5} data-loading={(isLoadingPayment && currentProcessingItemId === 'TOKEN_CUSTOM') || undefined}>
                                            <ShoppingCart size={18} />
                                            <span>Beli {customTokenAmount || 0} Token</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
        </>
    );
};

export default TopBar;

