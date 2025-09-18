import React from 'react';
import './IkigaiTestLink.css';

const IkigaiTestLink = ({ onNext }) => {
  return (
    <div className="ikigai-test-container"style={{ color: 'white' }}>
      <h4>🧪 Step 2: Lakukan Tes Kepribadian</h4>
      <p className="desc">
        Klik tombol-tombol di bawah ini untuk mengikuti 3 tes. Setelah selesai, lanjut ke langkah berikutnya untuk input hasilnya.
      </p>

      <div className="button-group">
        <a
          href="https://boo.world/16-personality-test"
          target="_blank"
          rel="noopener noreferrer"
          className="test-button"
        >
          🔮 MBTI Test
        </a>
        <a
          href="https://www.viacharacter.org/account/register"
          target="_blank"
          rel="noopener noreferrer"
          className="test-button"
        >
          💎 VIA Character Test
        </a>
        <a
          href="https://www.careerexplorer.com/assessments"
          target="_blank"
          rel="noopener noreferrer"
          className="test-button"
        >
          🛠️ Career Explorer Test
        </a>
      </div>

      <button className="btn-lanjut" onClick={onNext}>
        ✅ Saya Sudah Selesai Tes → Lanjut Input Hasil
      </button>
    </div>
  );
};

export default IkigaiTestLink;
