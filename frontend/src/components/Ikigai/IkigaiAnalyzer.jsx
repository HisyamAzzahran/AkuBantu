// src/components/IkigaiAnalyzer.jsx

import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Zap, BrainCircuit, Target, Briefcase, Bot } from 'lucide-react';

const API_URL = "https://webai-production-b975.up.railway.app";

const IkigaiAnalyzer = ({ email, tokenSisa, setTokenSisa, isPremium, userData, onResult }) => {
  const [mbti, setMbti] = useState('');
  const [via, setVia] = useState(['', '', '']);
  const [career, setCareer] = useState(['', '', '']);
  const [loading, setLoading] = useState(false);
  const [hasil, setHasil] = useState('');

  const handleAnalyze = async () => {
    if (!mbti || via.includes('') || career.includes('')) {
      toast.warning("⚠️ Lengkapi semua hasil tes dulu ya!");
      return;
    }
    if (!isPremium || tokenSisa < 5) {
      toast.error("🚫 Token tidak cukup atau akun belum Premium (perlu 5 token).");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/analyze-ikigai-basic`, {
        email, mbti, via, career, ...userData
      });
      if (res.status === 200 && res.data.hasilPrompt && res.data.spotList && res.data.sliceList) {
        setHasil(res.data.hasilPrompt);
        toast.success("✅ Berhasil generate pemetaan Ikigai!");
        onResult({
          hasilPrompt: res.data.hasilPrompt,
          spotList: res.data.spotList,
          sliceList: res.data.sliceList,
          mbti, via, career
        });
      } else {
        toast.error("❌ Gagal generate Ikigai.");
      }
    } catch (err) {
      toast.error("❌ Terjadi kesalahan server.");
    } finally {
      setLoading(false);
    }
  };

  const handleArrayInputChange = (index, value, type) => {
    if (type === 'via') {
      const newVia = [...via];
      newVia[index] = value;
      setVia(newVia);
    } else if (type === 'career') {
      const newCareer = [...career];
      newCareer[index] = value;
      setCareer(newCareer);
    }
  };

  return (
    <div className="generator-container-futuristic">
      <div className="generator-header">
        <Bot size={40} />
        <h2 className="generator-title-futuristic" style={{ color: 'white' }}>Step 3: AI Ikigai Analyzer</h2>
        <p className="generator-subtitle-futuristic" style={{ color: 'white' }}>Masukkan hasil tes kepribadian Anda untuk mendapatkan pemetaan awal Ikigai yang dipersonalisasi oleh AI.</p>
      </div>

      <div className="generator-form-futuristic">
        <div className="form-group-futuristic">
            <label><BrainCircuit size={16}/> MBTI Type (4 Huruf Kapital)</label>
            <input
                type="text"
                className="futuristic-input"
                placeholder="Contoh: INFP"
                value={mbti}
                onChange={(e) => setMbti(e.target.value.toUpperCase())}
                maxLength="4"
            />
        </div>
        
        <div className="form-grid" style={{marginTop: '1.5rem'}}>
            <div className="form-group-futuristic">
                <label><Target size={16}/> Top 3 VIA Character Strengths</label>
                {via.map((v, i) => (
                    <input
                        key={i}
                        type="text"
                        className="futuristic-input"
                        style={{marginBottom: '0.75rem'}}
                        placeholder={`VIA Strength #${i + 1}`}
                        value={v}
                        onChange={(e) => handleArrayInputChange(i, e.target.value, 'via')}
                    />
                ))}
            </div>
            <div className="form-group-futuristic">
                <label><Briefcase size={16}/> Top 3 Career Explorer Roles</label>
                {career.map((c, i) => (
                    <input
                        key={i}
                        type="text"
                        className="futuristic-input"
                        style={{marginBottom: '0.75rem'}}
                        placeholder={`Career Role #${i + 1}`}
                        value={c}
                        onChange={(e) => handleArrayInputChange(i, e.target.value, 'career')}
                    />
                ))}
            </div>
        </div>

        <div className="generator-actions">
            <button onClick={handleAnalyze} disabled={loading || !mbti || via.includes('') || career.includes('')} className="futuristic-button primary large" data-loading={loading || undefined}>
                <Zap size={18}/> Analisis & Lanjut
            </button>
        </div>
      </div>
    </div>
  );
};

export default IkigaiAnalyzer;
