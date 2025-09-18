// src/components/Modal.js
import React from 'react';
import './Modal.css'; // Tetap impor Modal.css untuk styling dasar backdrop & content positioning

const Modal = ({ children, onClose }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}> {/* Kelas ini akan kita target di TopBar.css */}
      <div 
        className="modal-content animate__animated animate__fadeInUp" // Kelas ini juga akan kita target
        onClick={e => e.stopPropagation()}
      >
        {/* Tombol close internal DIHAPUS dari sini */}
        {children} {/* Di sinilah header, body, footer dari TopBar.js akan masuk */}
      </div>
    </div>
  );
};

export default Modal;