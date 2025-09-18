import React, { useEffect, useState } from 'react';

const PromoBanner = ({ onUpgrade }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const dismissed = localStorage.getItem('promo_dismissed');
    if (!dismissed) setVisible(true);
  }, []);
  if (!visible) return null;
  return (
    <div className="promo-banner">
      <span className="promo-text">Promo khusus pengguna baru: diskon Premium 20% minggu ini.</span>
      <div className="promo-actions">
        <button className="cta-button secondary" onClick={() => onUpgrade && onUpgrade()}>Lihat Paket</button>
        <button className="promo-dismiss" aria-label="Tutup" onClick={() => { localStorage.setItem('promo_dismissed','1'); setVisible(false); }}>×</button>
      </div>
    </div>
  );
};

export default PromoBanner;

