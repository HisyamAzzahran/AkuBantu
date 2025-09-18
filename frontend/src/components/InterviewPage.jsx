import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { User, Settings, Mic, ArrowRight, AlertTriangle, CheckCircle, X, Bot, UploadCloud, Play, Square } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import 'animate.css';

const API_BASE = "https://webai-production-b975.up.railway.app";

// PERBAIKAN: Loader internal berbasis CSS
const Spinner = ({ size = 22, color = "#000" }) => (
    <div style={{
        borderColor: color === "#000" ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)',
        borderTopColor: color,
        borderRadius: '50%',
        width: `${size}px`,
        height: `${size}px`,
        animation: 'spin 1s linear infinite'
    }}></div>
);

const InterviewPage = ({ isPremium, email, tokenSisa, setTokenSisa, onFinish }) => {
    // PERBAIKAN: Menggunakan state 'step' untuk mengontrol alur halaman
    const [step, setStep] = useState('name'); // 'name', 'options', 'interview'
    
    const [question, setQuestion] = useState('Silakan atur sesi interview Anda dan klik "Mulai Interview".');
    const [answer, setAnswer] = useState('');
    const [answersHistory, setAnswersHistory] = useState([]);
    const [questionsHistory, setQuestionsHistory] = useState([]);
    const [questionCount, setQuestionCount] = useState(0);
    const [username, setUsername] = useState('');
    const [showTyping, setShowTyping] = useState(false);
    const [tempName, setTempName] = useState('');
    const [showTokenModal, setShowTokenModal] = useState(false);
    const [cvFile, setCvFile] = useState(null);
    const [cvSummary, setCvSummary] = useState('');
    const [interviewType, setInterviewType] = useState('');
    const [language, setLanguage] = useState('id');
    const [scholarshipName, setScholarshipName] = useState('');
    const [internshipPosition, setInternshipPosition] = useState('');
    const [isSessionStarted, setIsSessionStarted] = useState(false);
    const [isLoadingStart, setIsLoadingStart] = useState(false);

    useEffect(() => {
        // Reset semua state saat komponen dimuat ulang
        setStep('name');
        setQuestion('Silakan atur sesi interview Anda dan klik "Mulai Interview".');
        setAnswer(''); setAnswersHistory([]); setQuestionsHistory([]); setQuestionCount(0); setUsername('');
        setTempName(''); setShowTyping(false); setShowTokenModal(false); setCvFile(null);
        setCvSummary(''); setInterviewType(''); setLanguage('id'); setScholarshipName('');
        setInternshipPosition(''); setIsSessionStarted(false); setIsLoadingStart(false);
        localStorage.removeItem('lastCvFileNameInterview');
    }, [email]);

    const logFeature = useCallback(async () => { if (email) { try { await axios.post(`${API_BASE}/log-feature`, { email, feature: "Interview Simulator" }); } catch (error) { console.error("Gagal log fitur:", error); } } }, [email]);

    const handleNameSubmit = () => {
        if (tempName.trim()) {
            setUsername(tempName.trim());
            setStep('options'); // Pindah ke langkah berikutnya
        } else {
            toast.warn("⚠️ Nama panggilan tidak boleh kosong.");
        }
    };

    const handleOptionsSubmit = () => {
        if (!interviewType) { toast.warn("Pilih jenis interview!"); return; }
        if (interviewType === 'beasiswa' && !scholarshipName.trim()) { toast.warn("Nama beasiswa tidak boleh kosong."); return; }
        if (interviewType === 'magang' && !internshipPosition.trim()) { toast.warn("Posisi magang tidak boleh kosong."); return; }
        setStep('interview'); // Pindah ke halaman interview utama
    };
    
    // Fungsi askQuestion, speakText, handleStartInterviewSession, handleTranscription tetap sama
    const askQuestion = useCallback(async (currentAnswerOrPrompt, fullHistory = [], currentCvSummary = '') => {
        try {
            const payload = { answer: currentAnswerOrPrompt, username, history: fullHistory, interviewType, language, scholarshipName, internshipPosition, cv_summary: currentCvSummary };
            const res = await axios.post(`${API_BASE}/ask`, payload);
            if (res.data && res.data.question) return res.data.question;
            throw new Error(res.data.error || "Format respons tidak sesuai.");
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Maaf, terjadi gangguan.';
            toast.error(errorMsg);
            return 'Gagal mengambil pertanyaan. Coba lagi.';
        }
    }, [username, interviewType, language, scholarshipName, internshipPosition]);

    const speakText = useCallback(async (textToSpeak) => {
        if (!textToSpeak || textToSpeak.startsWith("Gagal")) return;
        try {
            const res = await axios.post(`${API_BASE}/speak`, { text: textToSpeak }, { responseType: 'blob' });
            const audioURL = URL.createObjectURL(res.data);
            new Audio(audioURL).play().catch(e => console.error("Audio play error:", e));
        } catch (err) {
            console.error('TTS error:', err);
        }
    }, [API_BASE]);

    const handleStartInterviewSession = useCallback(async () => {
        if (!username || !interviewType || (interviewType === 'beasiswa' && !scholarshipName.trim()) || (interviewType === 'magang' && !internshipPosition.trim())) {
            toast.error("Pengaturan sesi belum lengkap.");
            return;
        }
        if (isPremium && tokenSisa < 5) {
            setShowTokenModal(true);
            return;
        }
        await logFeature();
        setIsSessionStarted(true);
        setShowTyping(true);
        setIsLoadingStart(true);
        setQuestion('Memproses CV & menyiapkan pertanyaan pertama...');
        setQuestionsHistory([]);
        setAnswersHistory([]);
        setQuestionCount(0);
        setAnswer('');
        let summaryForFirstQuestion = "";
        if (cvFile) {
            if (cvSummary && cvFile.name === localStorage.getItem('lastCvFileNameInterview')) {
                summaryForFirstQuestion = cvSummary;
            } else {
                const formData = new FormData();
                formData.append('cv', cvFile);
                try {
                    toast.info("Memproses CV Anda...");
                    const resUpload = await axios.post(`${API_BASE}/upload_cv`, formData);
                    if (resUpload.data && resUpload.data.cv_summary) {
                        summaryForFirstQuestion = resUpload.data.cv_summary;
                        setCvSummary(summaryForFirstQuestion);
                        localStorage.setItem('lastCvFileNameInterview', cvFile.name);
                        toast.success("CV berhasil diproses!");
                    } else {
                        throw new Error(resUpload.data.error || "Gagal mendapatkan ringkasan CV.");
                    }
                } catch (err) {
                    toast.warn(err.response?.data?.error || "CV gagal di-upload, interview dilanjutkan tanpa CV.");
                    summaryForFirstQuestion = "";
                    setCvSummary("");
                }
            }
        } else {
            setCvSummary('');
            summaryForFirstQuestion = '';
        }
        let pembukaPrompt = `Anda adalah pewawancara profesional. Ajukan SATU pertanyaan pembuka yang menarik kepada Sdr. ${username}.`;
        if (interviewType === "beasiswa") {
            pembukaPrompt = language === "en" ? `You are a professional interviewer for the "${scholarshipName}" scholarship. Ask Mr./Ms. ${username} ONE engaging opening question.` : `Anda pewawancara beasiswa "${scholarshipName}". Ajukan SATU pertanyaan pembuka yang menarik pada Sdr. ${username}.`;
        } else if (interviewType === "magang") {
            pembukaPrompt = language === "en" ? `You are a hiring manager for the "${internshipPosition}" role. Ask Mr./Ms. ${username} ONE insightful opening question.` : `Anda manajer perekrutan untuk posisi magang "${internshipPosition}". Ajukan SATU pertanyaan pembuka mendalam pada Sdr. ${username}.`;
        }
        const firstQuestion = await askQuestion(pembukaPrompt, [], summaryForFirstQuestion);
        setShowTyping(false);
        setIsLoadingStart(false);
        setQuestion(firstQuestion);
        setQuestionsHistory([firstQuestion]);
        speakText(firstQuestion);
    }, [username, interviewType, scholarshipName, internshipPosition, language, isPremium, tokenSisa, cvFile, logFeature, askQuestion, speakText, cvSummary]);

    const handleTranscription = useCallback(async (transcript) => {
        if (!transcript.trim()) {
            toast.info("Jawaban tidak terdeteksi.");
            return;
        }
        if (isPremium && tokenSisa < 5 && answersHistory.length > 0 && questionCount < 4) {
            setShowTokenModal(true);
            return;
        }
        setAnswer(transcript);
        const updatedAnswers = [...answersHistory, transcript];
        if (questionCount >= 4) {
            let finalTokenSisa = tokenSisa;
            if (isPremium && setTokenSisa) {
                const newTokens = Math.max(0, tokenSisa - 5);
                setTokenSisa(newTokens);
                finalTokenSisa = newTokens;
            }
            if (onFinish) {
                onFinish({ username, answers: updatedAnswers, email, tokenSisa: finalTokenSisa, isPremium, interviewType, language, scholarshipName, internshipPosition, cv_summary: cvSummary });
            }
            return;
        }
        setShowTyping(true);
        setQuestion('Memproses jawaban...');
        const combinedHistory = questionsHistory.map((q, i) => ({ q, a: updatedAnswers[i] || "" }));
        const nextQuestion = await askQuestion(transcript, combinedHistory, cvSummary);
        setShowTyping(false);
        setQuestion(nextQuestion);
        setAnswersHistory(updatedAnswers);
        setQuestionsHistory(prevQ => [...prevQ, nextQuestion]);
        setQuestionCount(prevC => prevC + 1);
        speakText(nextQuestion);
    }, [email, answersHistory, questionsHistory, questionCount, username, interviewType, language, scholarshipName, internshipPosition, cvSummary, isPremium, tokenSisa, setTokenSisa, onFinish, askQuestion, speakText]);

    // Render function untuk setiap langkah
    const renderNameStep = () => (
        <div className="interview-setup-container animate__animated animate__fadeIn">
            <div className="interview-setup-card">
                <div className="modal-header-futuristic">
                    <h5 className="modal-title-futuristic"><User /> Siapa Nama Panggilan Anda?</h5>
                </div>
                <div className="modal-body-futuristic">
                    <p className="modal-subtitle-futuristic">Nama ini akan digunakan oleh AI selama sesi interview.</p>
                    <input type="text" className="futuristic-input" value={tempName} onChange={(e) => setTempName(e.target.value)} placeholder="Contoh: Budi" onKeyPress={(e) => e.key === 'Enter' && tempName.trim() && handleNameSubmit()} />
                </div>
                <div className="modal-actions">
                    <button onClick={handleNameSubmit} className="futuristic-button primary" disabled={!tempName.trim()}>Lanjut <ArrowRight size={18} /></button>
                </div>
            </div>
        </div>
    );

    const renderOptionsStep = () => (
        <div className="interview-setup-container animate__animated animate__fadeIn">
            <div className="interview-setup-card">
                <div className="modal-header-futuristic">
                    <h5 className="modal-title-futuristic"><Settings /> Pengaturan Sesi</h5>
                </div>
                <div className="modal-body-futuristic">
                    <div className="form-group-futuristic">
                        <label>Upload CV (Opsional)</label>
                        <label htmlFor="cvFile-interview" className="futuristic-file-input">
                            <UploadCloud size={18} />
                            <span>{cvFile ? cvFile.name : 'Pilih File PDF/DOC...'}</span>
                            <input type="file" id="cvFile-interview" accept=".pdf,.doc,.docx" onChange={(e) => { setCvFile(e.target.files[0]); setCvSummary(''); localStorage.removeItem('lastCvFileNameInterview'); }} />
                        </label>
                    </div>
                    <div className="form-group-futuristic">
                        <label>Jenis Interview</label>
                        <div className="segmented-control">
                            <button className={interviewType === 'beasiswa' ? 'active' : ''} onClick={() => setInterviewType('beasiswa')}>Beasiswa</button>
                            <button className={interviewType === 'magang' ? 'active' : ''} onClick={() => setInterviewType('magang')}>Magang</button>
                        </div>
                    </div>
                    {interviewType === 'beasiswa' && (
                        <div className="animate__animated animate__fadeIn">
                            <div className="form-grid">
                                <div className="form-group-futuristic">
                                    <label>Bahasa</label>
                                    <select className="futuristic-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
                                        <option value="id">🇮🇩 Indonesia</option>
                                        <option value="en">🇬🇧 English</option>
                                    </select>
                                </div>
                                <div className="form-group-futuristic">
                                    <label>Nama Beasiswa</label>
                                    <input type="text" className="futuristic-input" placeholder="Masukkan nama beasiswa" value={scholarshipName} onChange={(e) => setScholarshipName(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
                    {interviewType === 'magang' && (
                        <div className="animate__animated animate__fadeIn">
                            <div className="form-group-futuristic">
                                <label>Posisi Magang</label>
                                <input type="text" className="futuristic-input" placeholder="Contoh: Software Engineer Intern" value={internshipPosition} onChange={(e) => setInternshipPosition(e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-actions">
                    <button onClick={() => setStep('name')} className="futuristic-button secondary">Kembali</button>
                    <button onClick={handleOptionsSubmit} className="futuristic-button primary" disabled={!interviewType || (interviewType === 'beasiswa' && !scholarshipName.trim()) || (interviewType === 'magang' && !internshipPosition.trim())}>Mulai Interview</button>
                </div>
            </div>
        </div>
    );

    const renderInterviewInterface = () => (
        <div className="generator-container-futuristic">
            <div className="interview-header">
                <h2 className="interview-title-futuristic">AI Interview Simulator</h2>
                <button className="futuristic-button secondary small" onClick={() => setStep('options')} title="Ubah Pengaturan Sesi">
                    <Settings size={15} /> Pengaturan
                </button>
            </div>
            <div className="interview-context-box">
                <p><strong>Nama:</strong> {username}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <p><strong>Jenis:</strong> {interviewType === 'magang' ? `Magang - "${internshipPosition}"` : `Beasiswa - "${scholarshipName}"`}</p>
                    <p><strong>Bahasa:</strong> {language === 'id' ? 'Indonesia' : 'English'}</p>
                </div>
                {cvFile && <p className={cvSummary ? 'text-success' : 'text-warning'}><CheckCircle size={14} /> {cvSummary ? 'CV akan digunakan.' : 'CV akan diproses saat mulai.'}</p>}
            </div>
            <div className="question-box-futuristic">
                <p className="interviewer-label"><Bot size={18} /> Pewawancara AI</p>
                {showTyping ? <div className="typing-indicator-futuristic"><span></span><span></span><span></span></div> : <p className="question-text">{question}</p>}
            </div>
            {questionCount < 5 && (!isPremium || tokenSisa >= 5) && (
                <>
                    {!isSessionStarted ? (
                        <div className="start-button-container">
                            <button onClick={handleStartInterviewSession} className="futuristic-button primary large" disabled={isLoadingStart || showTyping}>
                                {isLoadingStart ? <Spinner color="#000"/> : <Play size={20} />} {isLoadingStart ? "Memulai..." : "Mulai Sesi"}
                            </button>
                        </div>
                    ) : !showTyping && (
                        <AudioRecorder onTranscription={handleTranscription} disabled={showTyping || isLoadingStart} />
                    )}
                </>
            )}
            {answer && (
                <div className="answer-box-futuristic">
                    <p><strong>Jawaban Anda:</strong> "{answer}"</p>
                </div>
            )}
            <div className="question-counter-futuristic">
                <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${(questionCount / 5) * 100}%` }}></div>
                </div>
                <p>Pertanyaan Terjawab: <strong>{questionCount}/5</strong></p>
            </div>
        </div>
    );

    return (
        <div className="interview-page-wrapper">
            {showTokenModal && (
                <div className="modal-overlay-futuristic">
                    <div className="modal-content-futuristic">
                        <div className="modal-header-futuristic">
                            <h5 className="modal-title-futuristic danger"><AlertTriangle /> Token Tidak Cukup</h5>
                        </div>
                        <div className="modal-body-futuristic">
                            <p>Anda memerlukan minimal 5 token untuk sesi ini. Token Anda saat ini: <strong>{tokenSisa}</strong>.</p>
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setShowTokenModal(false)} className="futuristic-button secondary">Mengerti</button>
                        </div>
                    </div>
                </div>
            )}

            {step === 'name' && renderNameStep()}
            {step === 'options' && renderOptionsStep()}
            {step === 'interview' && renderInterviewInterface()}
        </div>
    );
}

export default InterviewPage;