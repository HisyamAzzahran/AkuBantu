import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { FileText, Send, Copy, RefreshCw, Trash2, Plane, University, Brain, Sparkles, Star, Target } from 'lucide-react';

const API_URL = "https://webai-production-b975.up.railway.app";
const TOKEN_COST = 2;
const FEATURE_NAME_LOG = "essay_exchange_v2";

const EssayExchangesGenerator = ({ email, tokenSisa, setTokenSisa, isPremium }) => {
    const [formData, setFormData] = useState({
        programName: '',
        destination: '',
        academicMotivation: '',
        personalMotivation: '',
        relevantSkills: '',
        futureContribution: '',
    });
    const [generatedEssay, setGeneratedEssay] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const isFormValid = () => Object.values(formData).every(value => value.trim() !== '');

    const handleGenerate = async (isRegenerate = false) => {
        if (!isPremium) { toast.error("Fitur ini hanya untuk Pengguna Premium."); return; }
        if (!isFormValid()) { toast.warn("Harap isi semua kolom untuk hasil maksimal."); return; }
        if (tokenSisa < TOKEN_COST) { toast.error(`Token tidak cukup. Perlu ${TOKEN_COST} token.`); return; }

        setIsLoading(true);
        if (!isRegenerate) setGeneratedEssay('');
        
        try {
            const response = await axios.post(`${API_URL}/generate-essay-exchange-v2`, { email, ...formData });
            if (response.data && response.data.essay) {
                setGeneratedEssay(response.data.essay);
                if (!isRegenerate) {
                    setTokenSisa(prev => prev - TOKEN_COST);
                    await axios.post(`${API_URL}/log-feature`, { email, feature: FEATURE_NAME_LOG });
                }
                toast.success("Motivation Letter berhasil di-generate!");
            } else { throw new Error(response.data.error || "Gagal membuat esai."); }
        } catch (error) { toast.error(error.response?.data?.error || "Terjadi kesalahan pada server.");
        } finally { setIsLoading(false); }
    };

    const handleCopyToClipboard = () => { if (generatedEssay) navigator.clipboard.writeText(generatedEssay).then(() => toast.success("📋 Teks esai disalin!")); };
    const handleReset = () => { setFormData({ programName: '', destination: '', academicMotivation: '', personalMotivation: '', relevantSkills: '', futureContribution: '' }); setGeneratedEssay(''); };

    if (!isPremium) { return (<div className="locked-feature-notice">🚫 Fitur "Essay for Exchanges" hanya untuk <strong>Pengguna Premium</strong>!</div>); }

    return (
        <div className="generator-container-futuristic">
            <div className="generator-header">
                <Plane size={40} />
                <h2 className="generator-title-futuristic" style={{ color: 'white' }}>AI Motivation Letter Assistant </h2>
                <p className="generator-subtitle-futuristic">Susun draf pertama motivation letter untuk program impianmu dengan bantuan AI yang terstruktur.</p>
            </div>
            
            {!generatedEssay ? (
                <form className="generator-form-futuristic" onSubmit={(e) => { e.preventDefault(); handleGenerate(false); }}>
                    <div className="form-grid">
                        <div className="form-group-futuristic"><label><FileText size={16}/> Nama Program Exchange</label><input type="text" name="programName" className="futuristic-input" value={formData.programName} onChange={handleInputChange} placeholder="Cth: IISMA" /></div>
                        <div className="form-group-futuristic"><label><University size={16}/> Negara & Universitas Tujuan</label><input type="text" name="destination" className="futuristic-input" value={formData.destination} onChange={handleInputChange} placeholder="Cth: USA, University of Pennsylvania" /></div>
                        <div className="form-group-futuristic"><label><Brain size={16}/> Motivasi Akademik</label><textarea name="academicMotivation" className="futuristic-textarea" value={formData.academicMotivation} onChange={handleInputChange} rows="4" placeholder="Mata kuliah apa yang ingin diambil? Mengapa relevan?"></textarea></div>
                        <div className="form-group-futuristic"><label><Sparkles size={16}/> Motivasi Pribadi & Kultural</label><textarea name="personalMotivation" className="futuristic-textarea" value={formData.personalMotivation} onChange={handleInputChange} rows="4" placeholder="Apa yang ingin kamu pelajari dari budayanya?"></textarea></div>
                        <div className="form-group-futuristic"><label><Star size={16}/> Skill & Pengalaman Relevan</label><textarea name="relevantSkills" className="futuristic-textarea" value={formData.relevantSkills} onChange={handleInputChange} rows="4" placeholder="Sebutkan 2-3 skill atau pengalaman terkuatmu."></textarea></div>
                        <div className="form-group-futuristic"><label><Target size={16}/> Rencana Kontribusi Pasca-Program</label><textarea name="futureContribution" className="futuristic-textarea" value={formData.futureContribution} onChange={handleInputChange} rows="4" placeholder="Apa rencanamu setelah kembali ke Indonesia?"></textarea></div>
                    </div>
                    <div className="generator-actions">
                        <button type="submit" className="futuristic-button primary large" disabled={isLoading || !isFormValid()} data-loading={isLoading || undefined}>
                            <Send size={18}/> Generate Draf Esai
                        </button>
                    </div>
                </form>
            ) : (
                <div className="results-container-futuristic with-actions">
                    <div className="results-header">
                        <h3><span className="icon-wrap" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg></span> Draf Motivation Letter Anda</h3>
                        <div className="result-actions-group">
                            <button className="futuristic-button secondary small" onClick={handleCopyToClipboard}><Copy size={16}/> Salin</button>
                            <button className="futuristic-button secondary small" onClick={() => handleGenerate(true)} disabled={isLoading} data-loading={isLoading || undefined}><RefreshCw size={16}/> Regenerate</button>
                            <button className="futuristic-button secondary small danger" onClick={handleReset}><Trash2 size={16}/> Mulai Baru</button>
                        </div>
                    </div>
                    <div className="result-card-futuristic plan-card"style={{ color: 'white' }}>
                        <div className="plan-card-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(generatedEssay)) }} />
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="ai-thinking-bubble animate__animated animate__fadeIn" style={{marginTop: '1rem'}}>
                    <div className="ai-thinking-icon"><Send size={16}/></div>
                    <div className="ai-thinking-text">AI sedang menulis draf <span className="typing-dots"><span></span><span></span><span></span></span></div>
                </div>
            )}
        </div>
    );
};

export default EssayExchangesGenerator;
