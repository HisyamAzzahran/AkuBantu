import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Zap, Download, Target, Bot, CheckCircle } from 'lucide-react';

const API_URL = "https://webai-production-b975.up.railway.app";


// --- Komponen PDF (Tidak diubah) ---
const ikigaiPdfStyles = StyleSheet.create({
    page: { paddingTop: 35, paddingBottom: 65, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.5, color: '#333333' },
    header: { fontSize: 22, textAlign: 'center', marginBottom: 15, color: '#1A5276', fontWeight: 'bold' },
    subHeader: { fontSize: 12, textAlign: 'center', marginBottom: 25, color: '#566573' },
    userDataSection: { marginBottom: 20, padding: 10, borderWidth: 1, borderColor: '#EAECEE', borderRadius: 5, backgroundColor: '#FBFCFC' },
    userDataTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#1F618D' },
    userDataText: { fontSize: 10, marginBottom: 3, color: '#283747' },
    h1: { fontSize: 18, fontWeight: 'bold', color: '#154360', marginBottom: 12, marginTop: 15, borderBottomWidth: 1, borderBottomColor: '#D4E6F1', paddingBottom: 4 },
    h2: { fontSize: 15, fontWeight: 'bold', color: '#1F618D', marginBottom: 10, marginTop: 10 },
    h3: { fontSize: 13, fontWeight: 'bold', color: '#2980B9', marginBottom: 8, marginTop: 8, paddingLeft: 5 },
    paragraph: { marginBottom: 6, textAlign: 'justify' },
    boldText: { fontWeight: 'bold' },
    italicText: { fontStyle: 'italic' },
    listItem: { flexDirection: 'row', marginBottom: 4, paddingLeft: 15 },
    bullet: { width: 10, marginRight: 5, textAlign: 'center', fontWeight: 'bold', color: '#2980B9' },
    listItemText: { flex: 1, textAlign: 'justify'},
    ctaSection: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#EAECEE'},
    ctaText: { fontStyle: 'italic', textAlign: 'center', color: '#566573', fontSize: 11},
    footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#7F8C8D', fontSize: 8 },
});

const IkigaiPDFDocument = ({ hasil, userData, selectedSpot, selectedSlice }) => {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) return null;

    const renderStyledText = (textLine, baseStyle = ikigaiPdfStyles.paragraph) => {
        const parts = textLine.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        return (<Text style={baseStyle}>{parts.map((part, i) => { if (part.startsWith('**') && part.endsWith('**')) { return <Text key={i} style={ikigaiPdfStyles.boldText}>{part.slice(2, -2)}</Text>; } if (part.startsWith('*') && part.endsWith('*')) { return <Text key={i} style={ikigaiPdfStyles.italicText}>{part.slice(1, -1)}</Text>; } return <Text key={i}>{part}</Text>; })}</Text>);
    };
    const renderIkigaiPdfContent = (markdownContent) => {
        const elements = [];
        markdownContent.split('\n').forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('1. Tabel Strategi') || trimmedLine.startsWith('## Tabel Strategi') || line.startsWith('# Tabel Strategi')) { elements.push(<Text key={`pdf-h2-${index}`} style={ikigaiPdfStyles.h2}>{trimmedLine.replace(/^[\d#.]+\s*/, '')}</Text>);
            } else if (trimmedLine.startsWith('2. Penjabaran') || trimmedLine.startsWith('## Penjabaran') || line.startsWith('# Penjabaran')) { elements.push(<Text key={`pdf-h2-${index}`} style={ikigaiPdfStyles.h2}>{trimmedLine.replace(/^[\d#.]+\s*/, '')}</Text>);
            } else if (trimmedLine.startsWith('3. CTA Penutup') || trimmedLine.startsWith('## CTA') || line.startsWith('# CTA')) { elements.push(<View key={`pdf-cta-section-${index}`} style={ikigaiPdfStyles.ctaSection}><Text style={ikigaiPdfStyles.h2}>{trimmedLine.replace(/^[\d#.]+\s*/, '')}</Text></View>);
            } else if (trimmedLine.match(/^###\s*(Employee Track|Self-Employed Track|Business Owner Track|Jurusan-Based Track)/i)) { elements.push(<Text key={`pdf-h3-${index}`} style={ikigaiPdfStyles.h3}>{trimmedLine.replace(/^###\s*/, '')}</Text>);
            } else if (trimmedLine.startsWith('- **') || trimmedLine.startsWith('* **')) { elements.push(renderStyledText(trimmedLine.replace(/^[-*]\s*/, ''), {...ikigaiPdfStyles.paragraph, paddingLeft: 10}));
            } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) { elements.push(<View key={`pdf-li-${index}`} style={ikigaiPdfStyles.listItem}><Text style={ikigaiPdfStyles.bullet}>•</Text>{renderStyledText(trimmedLine.substring(2), ikigaiPdfStyles.listItemText)}</View>);
            } else if (trimmedLine.startsWith('# ')) { elements.push(<Text key={`pdf-h1-gen-${index}`} style={ikigaiPdfStyles.h1}>{trimmedLine.replace(/^#\s*/, '')}</Text>);
            } else if (trimmedLine !== "") { if (elements.length > 0 && elements[elements.length-1].props.style === ikigaiPdfStyles.ctaSection) { elements.push(renderStyledText(trimmedLine, ikigaiPdfStyles.ctaText)); } else { elements.push(renderStyledText(trimmedLine, ikigaiPdfStyles.paragraph)); } }
        });
        return elements;
    };
    return ( <Document author="AkuBantu" title={`Analisis Ikigai - ${userData?.nama || 'Hasil'}`}> <Page size="A4" style={ikigaiPdfStyles.page}> <Text style={ikigaiPdfStyles.header}>Analisis Sweet Spot Career & Business</Text> <Text style={ikigaiPdfStyles.subHeader}>Powered by AkuBantu</Text> {userData && ( <View style={ikigaiPdfStyles.userDataSection}> <Text style={ikigaiPdfStyles.userDataTitle}>Data Analisis:</Text> <Text style={ikigaiPdfStyles.userDataText}><Text style={ikigaiPdfStyles.boldText}>Nama:</Text> {userData.nama || 'N/A'}</Text> <Text style={ikigaiPdfStyles.userDataText}><Text style={ikigaiPdfStyles.boldText}>Jurusan:</Text> {userData.jurusan || 'N/A'}</Text> {userData.mbti && <Text style={ikigaiPdfStyles.userDataText}><Text style={ikigaiPdfStyles.boldText}>MBTI:</Text> {userData.mbti}</Text>} {userData.via && Array.isArray(userData.via) && <Text style={ikigaiPdfStyles.userDataText}><Text style={ikigaiPdfStyles.boldText}>VIA Strengths:</Text> {userData.via.join(', ')}</Text>} {userData.career && Array.isArray(userData.career) && <Text style={ikigaiPdfStyles.userDataText}><Text style={ikigaiPdfStyles.boldText}>Career Roles:</Text> {userData.career.join(', ')}</Text>} {selectedSpot && <Text style={ikigaiPdfStyles.userDataText}><Text style={ikigaiPdfStyles.boldText}>Ikigai Spot Dipilih:</Text> {selectedSpot}</Text>} {selectedSlice && <Text style={ikigaiPdfStyles.userDataText}><Text style={ikigaiPdfStyles.boldText}>Slice of Life Dipilih:</Text> {selectedSlice}</Text>} </View> )} {renderIkigaiPdfContent(hasil)} <Text style={ikigaiPdfStyles.footer} fixed> Dihasilkan oleh AkuBantu untuk {userData?.nama || 'Anda'} pada {new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })} </Text> </Page> </Document> );
};

const parseIkigaiResult = (markdown) => {
    const sections = markdown.split(/##\s*(Tabel Strategi|Penjabaran|CTA Penutup)/i).filter(Boolean);
    const parsed = {
        introduction: sections[0] || '',
        tableData: [],
        explanation: '',
        cta: ''
    };

    const tableSection = sections.find(s => s.toLowerCase().includes('tabel strategi'));
    if (tableSection) {
        const tracks = tableSection.split(/###\s*(Employee Track|Self-Employed Track|Business Owner Track|Jurusan-Based Track)/i).filter(Boolean);
        for (let i = 0; i < tracks.length; i += 2) {
            const trackTitle = tracks[i];
            const trackContent = tracks[i+1];
            const items = trackContent.match(/- \*\*.*?\*\*.*?\n/g) || [];
            parsed.tableData.push({
                title: trackTitle,
                items: items.map(item => {
                    const match = item.match(/- \*\*(.*?):\*\*\s*(.*)/);
                    return match ? { term: match[1], definition: match[2] } : null;
                }).filter(Boolean)
            });
        }
    }

    const explanationSection = sections.find(s => s.toLowerCase().includes('penjabaran'));
    if (explanationSection) {
        parsed.explanation = explanationSection.replace(/penjabaran\s*-\s*/i, '').trim();
    }

    const ctaSection = sections.find(s => s.toLowerCase().includes('cta penutup'));
    if (ctaSection) {
        parsed.cta = ctaSection.replace(/cta penutup\s*/i, '').trim();
    }

    return parsed;
};

const IkigaiFinalAnalyzer = ({ email, tokenSisa, setTokenSisa, isPremium, userData, ikigaiSpotList, sliceList }) => {
    const [selectedSpot, setSelectedSpot] = useState('');
    const [selectedSlice, setSelectedSlice] = useState('');
    const [hasil, setHasil] = useState('');
    const [parsedResult, setParsedResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleAnalyze = async () => {
        if (!selectedSpot || !selectedSlice) { toast.warning("⚠️ Pilih dulu Ikigai Spot dan Slice of Life-nya!"); return; }
        if (!isPremium || tokenSisa < 5) { toast.error("🚫 Token tidak cukup atau akun belum Premium (Perlu 5 token)."); return; }
        setLoading(true);
        try {
            await axios.post(`${API_URL}/log-feature`, { email, feature: "ikigai_final_analysis" });
            const res = await axios.post(`${API_URL}/analyze-ikigai-final`, { email, ikigaiSpot: selectedSpot, slicePurpose: selectedSlice, ...userData });
            if (res.status === 200 && res.data.result) {
                setHasil(res.data.result);
                setParsedResult(parseIkigaiResult(res.data.result));
                setTokenSisa((prev) => prev - 5);
                toast.success("✅ Strategi karier berhasil dibuat!");
            } else { toast.error(res.data.error || "❌ Gagal generate strategi karier."); }
        } catch (err) { toast.error(err.response?.data?.error || "❌ Terjadi kesalahan server.");
        } finally { setLoading(false); }
    };

    if (!isPremium) { return ( <div className="locked-feature-notice"> 🚫 Fitur ini hanya untuk <strong>Pengguna Premium</strong>! </div> ); }
    if (tokenSisa < 5) { return ( <div className="locked-feature-notice danger"> ⚠️ Token Anda tidak cukup untuk fitur ini. </div> ); }

    return (
        <div className="generator-container-futuristic">
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
                <Bot size={40} />
                <h2 className="generator-title-futuristic"style={{ color: 'white' }}>Step 4: Final Ikigai Analysis</h2>
                <p className="generator-subtitle-futuristic">Pilih kombinasi terbaikmu untuk mendapatkan strategi karier dan bisnis yang paling relevan dari AI.</p>
            </div>

            {!parsedResult ? (
                <div className="generator-form-futuristic">
                    <div className="form-grid">
                        <div className="form-group-futuristic">
                            <label><Target size={16}/> Pilih Ikigai Spot</label>
                            <div className="choice-grid-futuristic">
                                {ikigaiSpotList.map((spot, index) => (
                                    <div key={index} className={`choice-box-futuristic ${selectedSpot === spot ? 'selected' : ''}`} onClick={() => setSelectedSpot(spot)}>
                                        {spot} {selectedSpot === spot && <CheckCircle size={18} />}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="form-group-futuristic">
                            <label><Target size={16}/> Pilih Slice of Life Purpose</label>
                             <div className="choice-grid-futuristic">
                                {sliceList.map((slice, index) => (
                                    <div key={index} className={`choice-box-futuristic ${selectedSlice === slice ? 'selected' : ''}`} onClick={() => setSelectedSlice(slice)}>
                                        {slice} {selectedSlice === slice && <CheckCircle size={18} />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="generator-actions">
                        <button onClick={handleAnalyze} disabled={loading || !selectedSpot || !selectedSlice} className="futuristic-button primary large" data-loading={loading || undefined}>
                            <Zap size={18}/> Analisis Sweetspot Saya
                        </button>
                    </div>
                </div>
            ) : (
                <div className="ikigai-results-wrapper">
                    <div className="ikigai-results-header">
                        <h3><Target size={22}/> Hasil Strategi Karier & Bisnis:</h3>
                        {isClient && (
                            <PDFDownloadLink document={<IkigaiPDFDocument hasil={hasil} userData={userData} selectedSpot={selectedSpot} selectedSlice={selectedSlice} />} fileName={`Analisis_Ikigai_${(userData?.nama || "AkuBantu").replace(/\s+/g, '_')}.pdf`} className="futuristic-button secondary small">
                                {({ loading: pdfLoading }) => (pdfLoading ? <span style={{opacity:0.8}}>Menyiapkan...</span> : <><Download size={14}/> Unduh PDF</>)}
                            </PDFDownloadLink>
                        )}
                    </div>
                    
                    <div className="ikigai-intro-section" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(parsedResult.introduction)) }} />

                    <div className="ikigai-table-container">
                        <h2 className="ikigai-section-title">Tabel Strategi</h2>
                        <div className="table-responsive-wrapper">
                            <table className="ikigai-strategy-table">
                                <thead>
                                    <tr>
                                        {parsedResult.tableData.map(track => <th key={track.title}>{track.title}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: Math.max(...parsedResult.tableData.map(t => t.items.length)) }).map((_, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {parsedResult.tableData.map((track) => (
                                                <td key={`${track.title}-${rowIndex}`}>
                                                    {track.items[rowIndex] ? (
                                                        <div>
                                                            <strong>{track.items[rowIndex].term}:</strong>
                                                            <p>{track.items[rowIndex].definition}</p>
                                                        </div>
                                                    ) : ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="ikigai-explanation-section">
                        <h2 className="ikigai-section-title">Penjabaran</h2>
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(parsedResult.explanation)) }} />
                    </div>

                    <div className="ikigai-cta-section">
                         <h2 className="ikigai-section-title">CTA Penutup</h2>
                         <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(parsedResult.cta)) }} />
                    </div>

                    <button onClick={() => { setHasil(''); setParsedResult(null); }} className="futuristic-button primary large" style={{marginTop: '1.5rem'}}>
                        Kembali & Pilih Ulang
                    </button>
                </div>
            )}
        </div>
    );
};

export default IkigaiFinalAnalyzer;

