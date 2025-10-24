import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { Target, User, Book, Calendar, UploadCloud, FileText, Lock, PlusCircle, RefreshCw, Trash2, Download, ScrollText } from 'lucide-react';

const API_URL = "https://webai-production-b975.up.railway.app";
const TOKEN_COST_PER_GENERATION = 3;
const FEATURE_NAME_LOG = "student_goals_planning";

const pdfStyles = StyleSheet.create({
    page: { paddingTop: 35, paddingBottom: 65, paddingHorizontal: 35, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.4, },
    header: { fontSize: 20, textAlign: 'center', marginBottom: 10, color: '#2c3e50', fontWeight: 'bold' },
    userInfo: { fontSize: 11, marginBottom: 20, textAlign: 'center', color: '#34495e' },
    h1: { fontSize: 16, fontWeight: 'bold', color: '#154360', marginBottom: 10, marginTop: 8, borderBottomWidth: 0.5, borderBottomColor: '#aed6f1', paddingBottom: 2 },
    h2: { fontSize: 14, fontWeight: 'bold', color: '#1f618d', marginBottom: 8, marginTop: 6 },
    h3: { fontSize: 12, fontWeight: 'bold', color: '#2980b9', marginBottom: 6, marginTop: 4 },
    paragraph: { marginBottom: 5, textAlign: 'justify' },
    boldText: { fontWeight: 'bold' },
    italicText: { fontStyle: 'italic' },
    listItem: { flexDirection: 'row', marginBottom: 3, paddingLeft: 10 },
    bullet: { width: 10, marginRight: 5, textAlign: 'center' },
    listItemText: { flex: 1, textAlign: 'justify'},
    actionStepItem: { flexDirection: 'row', marginBottom: 2, paddingLeft: 20 },
    actionStepNumber: { width: 15, marginRight: 3, fontWeight: 'bold' },
    quoteSection: { marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eeeeee'},
    quoteText: { fontStyle: 'italic', textAlign: 'center', color: '#566573', fontSize: 11},
    footer: { position: 'absolute', bottom: 30, left: 35, right: 35, textAlign: 'center', color: 'grey', fontSize: 8 },
});

const StudentGoalsPDFDocument = ({ plan, userData }) => {
    const { semester, content } = plan;
    const renderPdfContent = (markdownContent) => {
        const elements = [];
        const lines = markdownContent.split('\n');
        lines.forEach((line, index) => {
            line = line.trim();
            if (line.startsWith('# 📚')) { elements.push(<Text key={`pdf-h1-${index}`} style={pdfStyles.h1}>{line.replace(/^#\s*📚\s*/, '')}</Text>); }
            else if (line.startsWith('## 🎯')) { elements.push(<Text key={`pdf-h2-${index}`} style={pdfStyles.h2}>{line.replace(/^##\s*🎯\s*/, '')}</Text>); }
            else if (line.startsWith('### Main Mission')) { elements.push(<Text key={`pdf-h3-${index}`} style={pdfStyles.h3}>{line.replace(/^###\s*/, '')}</Text>); }
            else if (line.startsWith('## 💬')) { elements.push(<View key={`pdf-quote-section-${index}`} style={pdfStyles.quoteSection}><Text style={pdfStyles.h2}>{line.replace(/^##\s*💬\s*/, '')}</Text></View>); }
            else if (line.startsWith('- **Deskripsi Singkat:**')) { elements.push(<Text key={`pdf-desc-${index}`} style={pdfStyles.paragraph}><Text style={pdfStyles.boldText}>Deskripsi Singkat:</Text> {line.replace('- **Deskripsi Singkat:**', '').trim()}</Text>); }
            else if (line.startsWith('- **Target Utama:**')) { elements.push(<Text key={`pdf-target-${index}`} style={pdfStyles.paragraph}><Text style={pdfStyles.boldText}>Target Utama:</Text> {line.replace('- **Target Utama:**', '').trim()}</Text>); }
            else if (line.startsWith('- *Side Mission')) { elements.push(<Text key={`pdf-sideh-${index}`} style={{...pdfStyles.h3, fontSize: 11, color: '#5499c7', marginLeft: 10, marginTop:3, marginBottom:1}}>{line.replace(/^-\s*/, '').trim()}</Text>); }
            else if (line.startsWith('- *Action Steps:*')) { elements.push(<Text key={`pdf-actionlabel-${index}`} style={{...pdfStyles.italicText, marginLeft: 20, marginBottom:1, marginTop:1, fontWeight:'bold'}}>Action Steps:</Text>); }
            else if (/^\s*\d+\.\s/.test(line)) { elements.push( <View key={`pdf-action-${index}`} style={pdfStyles.actionStepItem}> <Text style={pdfStyles.actionStepNumber}>{line.match(/^\s*(\d+\.)/)[0]}</Text> <Text style={pdfStyles.listItemText}>{line.replace(/^\s*\d+\.\s/, '').trim()}</Text> </View> ); }
            else if (line.startsWith('- ')) { elements.push( <View key={`pdf-li-${index}`} style={pdfStyles.listItem}> <Text style={pdfStyles.bullet}>•</Text> <Text style={pdfStyles.listItemText}>{line.substring(2).trim()}</Text> </View> ); }
            else if (line.trim() !== "") { if (elements.length > 0 && elements[elements.length-1].props.style === pdfStyles.quoteSection) { elements.push(<Text key={`pdf-quote-text-${index}`} style={pdfStyles.quoteText}>{line.trim()}</Text>); } else { elements.push(<Text key={`pdf-p-${index}`} style={pdfStyles.paragraph}>{line.trim()}</Text>); } }
        });
        return elements;
    };
    return ( <Document author="AkuBantu" title={`Rencana Studi Semester ${semester} - ${userData?.nama || 'Mahasiswa'}`}> <Page size="A4" style={pdfStyles.page}> <Text style={pdfStyles.header}>Student Goals Planning - AkuBantu</Text> {userData && ( <View style={pdfStyles.userInfo}> <Text>Nama: {userData.nama || 'N/A'}</Text> <Text>Jurusan: {userData.jurusan || 'N/A'}</Text> <Text>Rencana untuk Semester: {semester}</Text> </View> )} {renderPdfContent(content)} <Text style={pdfStyles.footer} fixed> Dihasilkan oleh AkuBantu pada {new Date().toLocaleDateString('id-ID')} </Text> </Page> </Document> );
};

// --- Komponen Utama ---
const StudentGoalsPlanner = ({ email, tokenSisa, setTokenSisa, isPremium }) => {
    const [nama, setNama] = useState('');
    const [jurusan, setJurusan] = useState('');
    const [inputSemester, setInputSemester] = useState('');
    const [modeAction, setModeAction] = useState('ambiez');
    const [swotFile, setSwotFile] = useState(null);
    const [ikigaiFile, setIkigaiFile] = useState(null);
    const [swotFileName, setSwotFileName] = useState('');
    const [ikigaiFileName, setIkigaiFileName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingHistory, setIsFetchingHistory] = useState(true);
    const [generatedPlans, setGeneratedPlans] = useState([]);
    const [initialDataForSession, setInitialDataForSession] = useState(null);
    const [isDeletingHistory, setIsDeletingHistory] = useState(false);

    // --- Semua logika fungsi (fetch, process, dll) tetap sama ---
    const fetchPlanHistory = useCallback(async () => {
        if (!email) return;
        setIsFetchingHistory(true);
        try {
            const response = await axios.get(`${API_URL}/student-goals/history?email=${email}`);
            if (response.data && Array.isArray(response.data.plans)) {
                const sortedPlans = response.data.plans.sort((a, b) => a.semester - b.semester || new Date(b.timestamp) - new Date(a.timestamp));
                setGeneratedPlans(sortedPlans);
                if (sortedPlans.length > 0) {
                    const latestInitialDataSourcePlan = sortedPlans.find(p => p.is_initial_data_source);
                    const sourceToUse = latestInitialDataSourcePlan || sortedPlans[0];
                    if (sourceToUse) {
                        setNama(sourceToUse.nama_input || '');
                        setJurusan(sourceToUse.jurusan_input || '');
                        setModeAction(sourceToUse.mode_action_input || 'ambiez');
                        setInitialDataForSession({ nama: sourceToUse.nama_input, jurusan: sourceToUse.jurusan_input, modeAction: sourceToUse.mode_action_input, swotFileRef: sourceToUse.swot_file_ref, ikigaiFileRef: sourceToUse.ikigai_file_ref, });
                    }
                } else {
                    setInitialDataForSession(null); setNama(''); setJurusan(''); setInputSemester(''); setModeAction('ambiez');
                }
            } else {
                setGeneratedPlans([]); setInitialDataForSession(null);
            }
        } catch (error) {
            console.error("Gagal memuat riwayat:", error);
            setGeneratedPlans([]); setInitialDataForSession(null);
        } finally {
            setIsFetchingHistory(false);
        }
    }, [email]);

    useEffect(() => { fetchPlanHistory(); }, [fetchPlanHistory]);

    const handleFileChange = (event, fileType) => {
        const file = event.target.files[0];
        if (!file) {
            if (fileType === 'swot') { setSwotFile(null); setSwotFileName(''); } else { setIkigaiFile(null); setIkigaiFileName(''); }
            return;
        }
        if (file.type !== "application/pdf") { toast.warn("⚠️ Hanya file PDF yang diperbolehkan."); event.target.value = null; return; }
        if (fileType === 'swot') { setSwotFile(file); setSwotFileName(file.name); }
        else if (fileType === 'ikigai') { setIkigaiFile(file); setIkigaiFileName(file.name); }
    };

    const validateBaseRequirements = () => {
        if (!isPremium) { toast.error("🚫 Fitur ini hanya untuk Pengguna Premium."); return false; }
        if (tokenSisa < TOKEN_COST_PER_GENERATION) { toast.error(`🚫 Token tidak cukup. Anda memerlukan ${TOKEN_COST_PER_GENERATION} token.`); return false; }
        return true;
    };

    const processPlanGeneration = async ({ targetSemester, isRegeneration = false, isAddingSuperPlan = false, planIdToRegenerate = null }) => {
        if (!validateBaseRequirements()) return;
        if (!isRegeneration && !isAddingSuperPlan) {
            if (!nama.trim() || !jurusan.trim() || !inputSemester.trim()) { toast.warn("⚠️ Nama, Jurusan, dan Semester awal harus diisi."); return; }
            if (!swotFile || !ikigaiFile) { toast.warn("⚠️ Harap unggah file PDF SWOT dan Ikigai."); return; }
            const semesterNum = parseInt(inputSemester, 10);
            if (isNaN(semesterNum) || semesterNum < 1 || semesterNum > 14) { toast.warn("⚠️ Semester tidak valid (1-14)."); return; }
        } else if ((isAddingSuperPlan || isRegeneration) && !initialDataForSession) {
            toast.error("❌ Data sesi awal tidak ditemukan. Harap buat rencana awal dulu."); return;
        }

        setIsLoading(true);
        try {
            await axios.post(`${API_URL}/log-feature`, { email, feature: FEATURE_NAME_LOG });
            const formData = new FormData();
            formData.append('email', email);
            if (!isAddingSuperPlan && !isRegeneration) {
                formData.append('nama', nama); formData.append('jurusan', jurusan); formData.append('semester_input_awal', inputSemester); formData.append('mode_action', modeAction);
                if (swotFile) formData.append('swot_pdf', swotFile);
                if (ikigaiFile) formData.append('ikigai_pdf', ikigaiFile);
            } else if (initialDataForSession) {
                formData.append('nama', initialDataForSession.nama); formData.append('jurusan', initialDataForSession.jurusan); formData.append('mode_action', initialDataForSession.modeAction);
                if (initialDataForSession.swotFileRef && initialDataForSession.swotFileRef !== 'pending_upload') formData.append('swot_file_ref', initialDataForSession.swotFileRef);
                if (initialDataForSession.ikigaiFileRef && initialDataForSession.ikigaiFileRef !== 'pending_upload') formData.append('ikigai_file_ref', initialDataForSession.ikigaiFileRef);
            }
            formData.append('target_semester', targetSemester);
            if (isRegeneration) formData.append('is_regeneration', 'true');
            if (isAddingSuperPlan) formData.append('is_adding_super_plan', 'true');
            if (planIdToRegenerate) formData.append('plan_id_to_regenerate', planIdToRegenerate);

            const response = await axios.post(`${API_URL}/student-goals/generate`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, });
            if (response.data && response.data.plan) {
                const newPlanData = response.data.plan;
                setGeneratedPlans(prevPlans => {
                    let updatedPlans;
                    if (isRegeneration && planIdToRegenerate) { updatedPlans = prevPlans.map(p => p.id === planIdToRegenerate ? { ...p, ...newPlanData } : p); }
                    else { const existingPlanIndex = prevPlans.findIndex(p => p.semester === newPlanData.semester && p.id === newPlanData.id); if (existingPlanIndex > -1) { updatedPlans = prevPlans.map((p, index) => index === existingPlanIndex ? { ...p, ...newPlanData } : p); } else { updatedPlans = [...prevPlans, newPlanData]; } }
                    return updatedPlans.sort((a, b) => a.semester - b.semester || new Date(b.timestamp) - new Date(a.timestamp));
                });
                setTokenSisa(prev => prev - TOKEN_COST_PER_GENERATION);
                toast.success(`✅ Rencana Semester ${targetSemester} berhasil di${isRegeneration ? 'perbarui' : 'buat'}!`);
                if(!isAddingSuperPlan && !isRegeneration) {
                     setInitialDataForSession({ nama: nama, jurusan: jurusan, modeAction: modeAction, swotFileRef: response.data.initial_data_refs?.swot_file_ref || initialDataForSession?.swotFileRef, ikigaiFileRef: response.data.initial_data_refs?.ikigai_file_ref || initialDataForSession?.ikigaiFileRef });
                }
            } else { toast.error(response.data.error || "❌ Gagal memproses rencana."); }
        } catch (error) { toast.error(error.response?.data?.error || "❌ Terjadi kesalahan pada server.");
        } finally { setIsLoading(false); }
    };

    const handleDeleteAllHistory = async () => {
        if (!email) { toast.error("Email pengguna tidak ditemukan."); return; }
        if (generatedPlans.length === 0) { toast.info("Tidak ada riwayat untuk dihapus."); return; }
        if (window.confirm("Yakin ingin menghapus semua riwayat rencana studi?")) {
            setIsDeletingHistory(true);
            try {
                await axios.delete(`${API_URL}/student-goals/history/all?email=${email}`);
                setGeneratedPlans([]); setInitialDataForSession(null); setNama(''); setJurusan(''); setInputSemester(''); setModeAction('ambiez'); setSwotFile(null); setSwotFileName(''); setIkigaiFile(null); setIkigaiFileName('');
                toast.success("🗑️ Semua riwayat berhasil dihapus!");
                await axios.post(`${API_URL}/log-feature`, { email, feature: "student_goals_delete_all" });
            } catch (error) { toast.error(error.response?.data?.error || "❌ Gagal menghapus riwayat.");
            } finally { setIsDeletingHistory(false); }
        }
    };
    
    if (!isPremium) { return ( <div className="locked-feature-notice"> 🚫 Fitur "Student Goals Planning" hanya untuk <strong>Pengguna Premium</strong>! </div> ); }
    if (isFetchingHistory) { return ( <div className="loading-state-container"><ClipLoader size={50} color="#00f5ff" /><p>Memuat riwayat rencana...</p></div> ); }

    const isInitialFormDisabled = !!initialDataForSession;
    
    // --- Tampilan JSX yang sudah di-desain ulang ---
    return (
        <div className="generator-container-futuristic">
            <div className="generator-header">
                <Target size={40} />
                <h2 className="generator-title-futuristic"style={{ color: 'white' }}>AI Student Goals Planner</h2>
                <p className="generator-subtitle-futuristic"style={{ color: 'white' }}>Rencanakan tujuan akademik dan non-akademik per semester dengan AI yang dipersonalisasi berdasarkan data SWOT & Ikigai Anda.</p>
                <p className="token-cost-notice">Biaya: {TOKEN_COST_PER_GENERATION} token per generasi.</p>
            </div>

            {!isInitialFormDisabled && (
                <div className="generator-form-futuristic initial-setup">
                    <h4 className="form-section-title">Langkah 1: Konfigurasi Awal</h4>
                    <div className="form-grid">
                        <div className="form-group-futuristic"><label><User size={16}/> Nama Lengkap</label><input type="text" className="futuristic-input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama Kamu" /></div>
                        <div className="form-group-futuristic"><label><Book size={16}/> Jurusan</label><input type="text" className="futuristic-input" value={jurusan} onChange={(e) => setJurusan(e.target.value)} placeholder="Contoh: Ilmu Komputer" /></div>
                        <div className="form-group-futuristic"><label><Calendar size={16}/> Semester Awal</label><input type="number" className="futuristic-input" value={inputSemester} onChange={(e) => setInputSemester(e.target.value)} placeholder="Angka, cth: 4" min="1" max="14"/></div>
                    </div>
                    <div className="form-group-futuristic" style={{marginTop: '1.5rem'}}>
                        <label>Mode Eksekusi Misi</label>
                        <div className="segmented-control">
                            <button className={modeAction === 'ambiez' ? 'active' : ''} onClick={() => setModeAction('ambiez')}>Ambiez</button>
                            <button className={modeAction === 'santuy' ? 'active' : ''} onClick={() => setModeAction('santuy')}>Santuy</button>
                        </div>
                    </div>
                    <div className="form-grid" style={{marginTop: '1.5rem'}}>
                        <div className="form-group-futuristic">
                            <label>Upload Hasil SWOT (PDF Wajib)</label>
                            <label htmlFor="swotFileSGP" className="futuristic-file-input">
                                <UploadCloud size={18}/> <span>{swotFileName || 'Pilih File PDF...'}</span>
                                <input type="file" id="swotFileSGP" accept=".pdf" onChange={(e) => handleFileChange(e, 'swot')} disabled={isLoading}/>
                            </label>
                        </div>
                        <div className="form-group-futuristic">
                            <label>Upload Hasil Ikigai (PDF Wajib)</label>
                            <label htmlFor="ikigaiFileSGP" className="futuristic-file-input">
                                <UploadCloud size={18}/> <span>{ikigaiFileName || 'Pilih File PDF...'}</span>
                                <input type="file" id="ikigaiFileSGP" accept=".pdf" onChange={(e) => handleFileChange(e, 'ikigai')} disabled={isLoading}/>
                            </label>
                        </div>
                    </div>
                    <button onClick={() => processPlanGeneration({ targetSemester: parseInt(inputSemester, 10) })} disabled={isLoading || !nama || !jurusan || !inputSemester || !swotFile || !ikigaiFile} className="futuristic-button primary large" data-loading={isLoading || undefined}>
                        {`Buat Rencana Awal (Semester ${inputSemester || 'Target'})`}
                    </button>
                </div>
            )}
            
            {isInitialFormDisabled && (
                <div className="locked-data-info">
                    <p><Lock size={14}/> <strong>Data Awal Sesi Terkunci:</strong> {initialDataForSession.nama} ({initialDataForSession.jurusan}) - Mode: {initialDataForSession.modeAction}</p>
                    <small>Data awal ini digunakan untuk semua rencana dalam sesi ini. Untuk mengubah, hapus semua riwayat.</small>
                </div>
            )}

            {generatedPlans.length > 0 && (
                <div className="results-container-futuristic with-actions">
                    <div className="results-header">
                        <h3><ScrollText size={22}/> Riwayat Rencana Studimu</h3>
                        <button className="futuristic-button secondary small" onClick={handleDeleteAllHistory} disabled={isDeletingHistory || isLoading} data-loading={isDeletingHistory || undefined}>
                            <Trash2 size={16}/> Hapus Semua
                        </button>
                    </div>
                    {generatedPlans.map((plan, index) => (
                        <div key={plan.id || index} className="result-card-futuristic plan-card">
                            <div className="plan-card-header">
                                <strong>Rencana Semester {plan.semester}</strong>
                                <PDFDownloadLink document={<StudentGoalsPDFDocument plan={plan} userData={initialDataForSession || {nama, jurusan}} />} fileName={`Rencana_Semester_${plan.semester}_${(initialDataForSession?.nama || nama || 'AkuBantu').replace(/\s+/g, '_')}.pdf`} className="futuristic-button secondary x-small">
                                    {({ loading: pdfLoading }) => (pdfLoading ? <ClipLoader size={14}/> : <><Download size={14}/> PDF</>)}
                                </PDFDownloadLink>
                            </div>
                            <div className="plan-card-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(plan.content || 'Konten tidak tersedia.')) }} />
                            <div className="plan-card-footer">Dibuat: {plan.timestamp ? new Date(plan.timestamp).toLocaleString('id-ID') : 'Baru saja'}</div>
                        </div>
                    ))}
                </div>
            )}

            {isInitialFormDisabled && (
                <div className="generator-actions bottom-actions">
                    <button onClick={() => processPlanGeneration({ targetSemester: (generatedPlans.length > 0 ? Math.max(...generatedPlans.map(p => p.semester)) + 1 : 0), isAddingSuperPlan: true })} disabled={isLoading || isDeletingHistory} className="futuristic-button primary">
                        <PlusCircle size={18}/> Tambah Super Plan
                    </button>
                    <button onClick={() => processPlanGeneration({ targetSemester: (generatedPlans.length > 0 ? Math.max(...generatedPlans.map(p => p.semester)) : 0), isRegeneration: true, planIdToRegenerate: (generatedPlans.length > 0 ? generatedPlans.reduce((latest, current) => new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest).id : null) })} disabled={isLoading || isDeletingHistory || generatedPlans.length === 0} className="futuristic-button secondary">
                        <RefreshCw size={18}/> Regenerate Terakhir
                    </button>
                </div>
            )}
        </div>
    );
};

export default StudentGoalsPlanner;

