import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
// PERBAIKAN: Mengimpor PDFDownloadLink secara langsung dari library
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Shield, Zap, Download, Target, Loader } from 'lucide-react';

const API_URL = "https://webai-production-b975.up.railway.app";

// PERBAIKAN: Komponen Spinner sekarang menggunakan ikon Loader dari Lucide dengan kelas animasi
const Spinner = ({ size = 20, color = "#000" }) => (
    <Loader size={size} color={color} className="animate-spin" />
);

// --- Komponen PDF (Tidak perlu diubah secara fungsional) ---
const SwotPDFDocument = ({ result, userData, mbti, via1, via2, via3 }) => {
    const styles = StyleSheet.create({
        page: { paddingTop: 35, paddingBottom: 65, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.5, color: '#333' },
        header: { fontSize: 22, textAlign: 'center', marginBottom: 8, color: '#1A237E', fontWeight: 'bold' },
        subHeader: { fontSize: 12, textAlign: 'center', marginBottom: 25, color: '#566573' },
        footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#95a5a6', fontSize: 8 },
        userDataSection: { marginBottom: 20, padding: 12, borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 5, backgroundColor: '#F8F9F9' },
        userDataTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 8, color: '#1A237E' },
        userDataText: { fontSize: 10, marginBottom: 4 },
        boldText: { fontWeight: 'bold' },
        mainSectionHeader: { fontSize: 16, fontWeight: 'bold', color: '#1A237E', marginTop: 20, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1.5, borderBottomColor: '#1A237E' },
        introNarration: { fontStyle: 'italic', color: '#566573', marginBottom: 15, textAlign: 'justify' },
        swotSectionHeader: { fontSize: 14, fontWeight: 'bold', marginBottom: 10, marginTop: 10 },
        swotPoint: { marginBottom: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#EAECEE' },
        pointTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 3 },
        pointDetailLabel: { fontWeight: 'bold', color: '#333', marginTop: 4 },
        pointDetailText: { paddingLeft: 8, textAlign: 'justify' },
        arenaHeader: { fontSize: 15, fontWeight: 'bold', color: '#1565C0', marginTop: 20, marginBottom: 12 },
        strategySectionHeader: { fontSize: 12, fontWeight: 'bold', color: '#424242', marginTop: 8, marginBottom: 5, paddingLeft: 5 },
        strategyPoint: { marginBottom: 5, paddingLeft: 15, textAlign: 'justify', display: 'flex', flexDirection: 'row' },
        bullet: { marginRight: 5 },
        conclusionText: { fontStyle: 'italic', color: '#566573', marginTop: 15, padding: 10, backgroundColor: '#F8F9F9', borderRadius: 4, borderLeftWidth: 3, borderLeftColor: '#1565C0' },
        paragraph: { marginBottom: 6, textAlign: 'justify' },
    });

    const renderPdfContent = (markdownContent) => {
        const sections = markdownContent.split(/--- (TAHAP \d:.*?) ---/);
        const elements = [];

        for (let i = 1; i < sections.length; i += 2) {
            const header = sections[i].trim();
            const content = sections[i + 1].trim();
            
            elements.push(<Text key={`main-header-${i}`} style={styles.mainSectionHeader}>{header}</Text>);

            if (header.includes("ANALISIS SWOT PRIBADI")) {
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return;

                    if (trimmedLine.match(/^\d\./)) {
                        elements.push(<Text key={`intro-${index}`} style={styles.introNarration}>{trimmedLine.replace(/^\d\.\s*/, '')}</Text>);
                    } else if (trimmedLine.startsWith('🟩') || trimmedLine.startsWith('🟨') || trimmedLine.startsWith('🟦') || trimmedLine.startsWith('🟥')) {
                        let color = '#27ae60';
                        if (trimmedLine.startsWith('🟨')) color = '#f39c12';
                        if (trimmedLine.startsWith('🟦')) color = '#3498db';
                        if (trimmedLine.startsWith('🟥')) color = '#e74c3c';
                        elements.push(<Text key={`swot-header-${index}`} style={{...styles.swotSectionHeader, color}}>{trimmedLine}</Text>);
                    } else if (trimmedLine.match(/^[⭐⚠️🚀🔥]/)) {
                        elements.push(<View key={`point-view-${index}`} style={styles.swotPoint}><Text style={styles.pointTitle}>{trimmedLine}</Text></View>);
                    } else if (trimmedLine.toLowerCase().startsWith('**contoh:**')) {
                        elements.push(<View key={`contoh-${index}`} style={{...styles.pointDetailText, marginLeft: 10}}><Text style={styles.boldText}>Contoh: </Text><Text>{trimmedLine.replace(/\*\*contoh:\*\*/i, '').trim()}</Text></View>);
                    } else if (trimmedLine.toLowerCase().startsWith('**strategi:**')) {
                         elements.push(<View key={`strategi-${index}`} style={{...styles.pointDetailText, marginLeft: 10}}><Text style={styles.boldText}>Strategi: </Text><Text>{trimmedLine.replace(/\*\*strategi:\*\*/i, '').trim()}</Text></View>);
                    }
                });
            } else if (header.includes("SWOT ACTION LENS")) {
                const arenaSections = content.split(/(?=🎓 Akademik|🤝 Organisasi|🏆 Lomba)/);
                arenaSections.forEach((arenaContent, arenaIndex) => {
                    const trimmedArena = arenaContent.trim();
                    if (!trimmedArena) return;

                    const lines = trimmedArena.split('\n');
                    const arenaHeader = lines.shift();
                    elements.push(<Text key={`arena-header-${arenaIndex}`} style={styles.arenaHeader}>{arenaHeader}</Text>);
                    
                    let conclusion = [];
                    lines.forEach((line, lineIndex) => {
                        const trimmedLine = line.trim();
                        if (!trimmedLine) return;
                        if (trimmedLine.startsWith('📌')) {
                            elements.push(<Text key={`strat-header-${arenaIndex}-${lineIndex}`} style={styles.strategySectionHeader}>{trimmedLine}</Text>);
                        } else if (trimmedLine.startsWith('-')) {
                            elements.push(<View key={`strat-point-${arenaIndex}-${lineIndex}`} style={styles.strategyPoint}><Text style={styles.bullet}>• </Text><Text>{trimmedLine.substring(1).trim()}</Text></View>);
                        } else {
                            conclusion.push(trimmedLine);
                        }
                    });

                    if (conclusion.length > 0) {
                        elements.push(<Text key={`conclusion-${arenaIndex}`} style={styles.conclusionText}>{conclusion.join('\n')}</Text>);
                    }
                });
            }
        }
        return elements;
    };

    return (
        <Document author="AkuBantu" title={`Analisis SWOT - ${userData?.nama || 'Hasil'}`}>
            <Page size="A4" style={styles.page}>
                <Text style={styles.header}>Analisis SWOT Diri & Rencana Aksi</Text>
                <Text style={styles.subHeader}>Powered by AkuBantu</Text>
                {userData && (
                    <View style={styles.userDataSection}>
                        <Text style={styles.userDataTitle}>Data Diri untuk Analisis:</Text>
                        <Text style={styles.userDataText}><Text style={styles.boldText}>Nama:</Text> {userData.nama || 'N/A'}</Text>
                        <Text style={styles.userDataText}><Text style={styles.boldText}>MBTI:</Text> {mbti || 'N/A'}</Text>
                        <Text style={styles.userDataText}><Text style={styles.boldText}>VIA Strengths:</Text> {`${via1 || 'N/A'}, ${via2 || 'N/A'}, ${via3 || 'N/A'}`}</Text>
                    </View>
                )}
                {renderPdfContent(result)}
                <Text style={styles.footer} fixed>Dihasilkan oleh AkuBantu untuk {userData?.nama || 'Anda'} pada {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
            </Page>
        </Document>
    );
};


const SwotAnalyzer = ({ email, isPremium, tokenSisa, setTokenSisa, userData }) => {
    const [mbti, setMbti] = useState('');
    const [via1, setVia1] = useState('');
    const [via2, setVia2] = useState('');
    const [via3, setVia3] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAnalyze = async () => {
        if (!mbti || !via1 || !via2 || !via3) { toast.warning("⚠️ Lengkapi semua input MBTI dan VIA!"); return; }
        if (!isPremium || tokenSisa < 1) { toast.error("🚫 Token tidak cukup atau akun belum Premium."); return; }
        setLoading(true);
        try {
            await axios.post(`${API_URL}/log-feature`, { email, feature: 'swot_analyzer' });
            const res = await axios.post(`${API_URL}/analyze-swot`, { email, nama: userData.nama, mbti, via1, via2, via3 });
            if (res.status === 200 && res.data.result) {
                setResult(res.data.result);
                toast.success("✅ Analisis SWOT & Rencana Aksi berhasil dibuat!");
            } else { toast.error(res.data.error || "❌ Gagal generate analisis SWOT."); }
        } catch (err) { toast.error(err.response?.data?.error || "❌ Terjadi kesalahan server.");
        } finally { setLoading(false); }
    };
    
    if (!isPremium) { return ( <div className="locked-feature-notice"> 🚫 Fitur "SWOT Analyzer" hanya untuk <strong>Pengguna Premium</strong>! </div> ); }

    return (
        <div className="generator-container-futuristic">
            {/* PERBAIKAN: Menambahkan style tag untuk animasi spin */}
            <style>
                {`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .animate-spin {
                        animation: spin 1s linear infinite;
                    }
                `}
            </style>
            <div className="generator-header">
                <Shield size={40} />
                <h2 className="generator-title-futuristic"style={{ color: 'white' }}>AI SWOT Self-Analysis</h2>
                <p className="generator-subtitle-futuristic">Kenali dirimu dan bangun rencana aksi strategis berdasarkan kepribadian MBTI dan VIA Character Strengths.</p>
            </div>
            
            {!result ? (
                <div className="generator-form-futuristic">
                    <h4 className="form-section-title">Langkah 1: Masukkan Data Kepribadian</h4>
                    <div className="form-grid">
                        <div className="form-group-futuristic"><label>MBTI Type (4 Huruf Kapital)</label><input type="text" className="futuristic-input" value={mbti} onChange={(e) => setMbti(e.target.value.toUpperCase())} placeholder="Contoh: INFP" maxLength="4" /></div>
                        <div className="form-group-futuristic"><label>VIA Character Strength #1</label><input type="text" className="futuristic-input" value={via1} onChange={(e) => setVia1(e.target.value)} placeholder="Misal: Creativity" /></div>
                        <div className="form-group-futuristic"><label>VIA Character Strength #2</label><input type="text" className="futuristic-input" value={via2} onChange={(e) => setVia2(e.target.value)} placeholder="Misal: Honesty" /></div>
                        <div className="form-group-futuristic"><label>VIA Character Strength #3</label><input type="text" className="futuristic-input" value={via3} onChange={(e) => setVia3(e.target.value)} placeholder="Misal: Kindness" /></div>
                    </div>
                    <div className="generator-actions">
                         <button onClick={handleAnalyze} disabled={loading || !mbti || !via1 || !via2 || !via3} className="futuristic-button primary large">
                             {loading ? <Spinner /> : <><Zap size={18}/> Analisis SWOT Saya</>}
                         </button>
                    </div>
                </div>
            ) : (
                <div className="swot-results-wrapper">
                    <div className="swot-results-header">
                        <h3><Target size={22}/> Hasil Analisis & Rencana Aksi Anda:</h3>
                        {/* PERBAIKAN: Menghapus state dan logika pemuatan dinamis yang bermasalah */}
                        <PDFDownloadLink 
                            document={<SwotPDFDocument result={result} userData={userData} mbti={mbti} via1={via1} via2={via2} via3={via3} />} 
                            fileName={`Analisis_SWOT_Action_Plan_${(userData?.nama || "AkuBantu").replace(/\s+/g, '_')}.pdf`} 
                            className="futuristic-button secondary small"
                        >
                            {({ loading: pdfLoading }) => (pdfLoading ? <Spinner color="#fff" /> : <><Download size={14}/> Unduh PDF</>)}
                        </PDFDownloadLink>
                    </div>
                    <div className="swot-markdown-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(result)) }} />
                    <button onClick={() => setResult('')} className="futuristic-button primary large" style={{marginTop: '1.5rem'}}>
                        Analisis Ulang / Kembali
                    </button>
                </div>
            )}
        </div>
    );
};

export default SwotAnalyzer;
