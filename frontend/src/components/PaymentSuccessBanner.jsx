import React from 'react';

const PaymentSuccessBanner = ({ onClose }) => {
  return (
    <div className="success-banner" role="status" aria-live="polite">
      <div className="success-banner-text">
        Pembayaran berhasil. Hak akses dan token Anda sedang diperbarui.
      </div>
      <button className="success-dismiss" aria-label="Tutup" onClick={onClose}>×</button>
    </div>
  );
};

export default PaymentSuccessBanner;

