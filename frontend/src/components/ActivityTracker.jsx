import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { UploadCloud, CalendarPlus, Plus, Trash2, ChevronDown, ChevronUp, CheckCircle, Circle, BarChart2, PlusCircle, RefreshCw } from 'lucide-react';

const API_URL = "https://webai-production-b975.up.railway.app";
const TOKEN_COST = 1;

// --- Komponen Item Aktivitas (Desain Ulang) ---
const ActivityItem = ({ activity, onToggleComplete, onDelete, onAddToCalendar }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const formatDate = (start, end) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        if (startDate.toDateString() === endDate.toDateString()) return startDate.toLocaleDateString('id-ID', options);
        return `${startDate.toLocaleDateString('id-ID', options)} - ${endDate.toLocaleDateString('id-ID', options)}`;
    };
    const formatTime = (start, end, isAllDay) => {
        if (isAllDay) return "Seharian Penuh";
        const startTime = new Date(start).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTime = new Date(end).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${startTime} - ${endTime}`;
    };

    return (
        <div className={`activity-item-futuristic ${activity.is_completed ? 'completed' : ''}`}>
            <div className="activity-main" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="activity-check" onClick={(e) => { e.stopPropagation(); onToggleComplete(activity.id, !activity.is_completed); }}>
                    {activity.is_completed ? <CheckCircle size={24} className="check-icon completed" /> : <Circle size={24} className="check-icon" />}
                </div>
                <div className="activity-summary">
                    <span className="activity-title">{activity.title}</span>
                    <span className="activity-time">{formatTime(activity.start_datetime, activity.end_datetime, activity.is_allday)}</span>
                </div>
                <div className="activity-expander">{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
            </div>
            {isExpanded && (
                <div className="activity-details">
                    <p><strong>Tanggal:</strong> {formatDate(activity.start_datetime, activity.end_datetime)}</p>
                    {activity.description && <p><strong>Deskripsi:</strong> {activity.description}</p>}
                    {activity.location && <p><strong>Lokasi:</strong> {activity.location}</p>}
                    <div className="activity-actions">
                        <button className="action-btn gcal" onClick={() => onAddToCalendar(activity)}><CalendarPlus size={16} /> Add to GCal</button>
                        <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); onDelete(activity.id);}}><Trash2 size={16} /> Hapus</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Komponen Modal (Desain Ulang) ---
const AddActivityModal = ({ weekNumber, onSubmit, onCancel, isLoading }) => {
    const [title, setTitle] = useState('');
    const [startDatetime, setStartDatetime] = useState('');
    const [endDatetime, setEndDatetime] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title || !startDatetime || !endDatetime) { toast.warn("Judul dan waktu wajib diisi."); return; }
        if (new Date(startDatetime) >= new Date(endDatetime)) { toast.warn("Waktu selesai harus setelah waktu mulai."); return; }
        onSubmit({ weekNumber, title, startDatetime, endDatetime, description });
    };

    return (
        <div className="modal-overlay-futuristic" onClick={onCancel}>
            <div className="modal-content-futuristic" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header-futuristic">
                    <h5 className="modal-title-futuristic">Tambah Aktivitas (Minggu {weekNumber})</h5>
                    <button onClick={onCancel} className="btn-close-futuristic" disabled={isLoading}><X size={20} /></button>
                </div>
                <div className="modal-body-futuristic">
                    <form onSubmit={handleSubmit} className="futuristic-modal-form">
                        <div className="form-group-futuristic"><label>Judul Aktivitas</label><input type="text" className="futuristic-input" value={title} onChange={e => setTitle(e.target.value)} required /></div>
                        <div className="form-group-futuristic"><label>Waktu Mulai</label><input type="datetime-local" className="futuristic-input" value={startDatetime} onChange={e => setStartDatetime(e.target.value)} required /></div>
                        <div className="form-group-futuristic"><label>Waktu Selesai</label><input type="datetime-local" className="futuristic-input" value={endDatetime} onChange={e => setEndDatetime(e.target.value)} required /></div>
                        <div className="form-group-futuristic"><label>Deskripsi (Opsional)</label><textarea className="futuristic-textarea" value={description} onChange={e => setDescription(e.target.value)} rows="3"></textarea></div>
                        <div className="modal-actions">
                            <button type="button" className="futuristic-button secondary" onClick={onCancel} disabled={isLoading} data-loading={undefined}>Batal</button>
                            <button type="submit" className="futuristic-button primary" disabled={isLoading} data-loading={isLoading || undefined}>Simpan</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};


const ActivityTracker = ({ email, isPremium, setTokenSisa }) => {
    // --- Semua State dan Logika Fungsi Tetap Sama ---
    const [userPoints, setUserPoints] = useState(0);
    const [weeklyPlans, setWeeklyPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [plannerPdf, setPlannerPdf] = useState(null);
    const [plannerFileName, setPlannerFileName] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [targetWeekForAdd, setTargetWeekForAdd] = useState(null);

    const fetchHistory = useCallback(async () => {
        if (!email) { setIsLoading(false); return; }
        setIsLoading(true);
        try {
            const response = await axios.get(`${API_URL}/daily-activity/history?email=${email}`);
            setUserPoints(response.data.points || 0);
            setWeeklyPlans(response.data.plans || []);
        } catch (error) { toast.error("Gagal memuat riwayat jadwal Anda.");
        } finally { setIsLoading(false); }
    }, [email]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const generateGCalLink = (activity) => {
        const toGCalTime = (dateStr) => new Date(dateStr).toISOString().replace(/-|:|\.\d+/g, '');
        let dates;
        if (activity.is_allday) {
            const startDate = new Date(activity.start_datetime).toISOString().slice(0, 10).replace(/-/g, '');
            const endDateObj = new Date(activity.end_datetime);
            endDateObj.setDate(endDateObj.getDate() + 1);
            const endDate = endDateObj.toISOString().slice(0, 10).replace(/-/g, '');
            dates = `${startDate}/${endDate}`;
        } else {
            dates = `${toGCalTime(activity.start_datetime)}/${toGCalTime(activity.end_datetime)}`;
        }
        const details = `Deskripsi: ${activity.description || '-'}\n\nDibuat oleh AkuBantu`;
        const params = new URLSearchParams({ action: 'TEMPLATE', text: activity.title, dates, details, location: activity.location || '', trp: activity.is_private ? 'false' : 'true' });
        window.open(`https://www.google.com/calendar/render?${params.toString()}`, '_blank');
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') { setPlannerPdf(file); setPlannerFileName(file.name);
        } else { toast.warn("Harap pilih file PDF."); setPlannerPdf(null); setPlannerFileName(''); }
    };

    const handleGenerateFirstWeek = async () => {
        if (!plannerPdf) { toast.error("Silakan upload PDF Rencana Studi."); return; }
        setIsLoading(true);
        const formData = new FormData();
        formData.append('email', email); formData.append('planner_pdf', plannerPdf);
        try {
            const response = await axios.post(`${API_URL}/daily-activity/generate-first-week`, formData);
            setUserPoints(response.data.points);
            setWeeklyPlans([response.data.plan]);
            setTokenSisa(prev => prev - TOKEN_COST);
            toast.success("Jadwal minggu pertama berhasil dibuat!");
        } catch (error) { toast.error(error.response?.data?.error || "Gagal membuat jadwal.");
        } finally { setIsLoading(false); }
    };

    const handleAddNextWeek = async () => {
        setIsSubmitting(true);
        try {
            const response = await axios.post(`${API_URL}/daily-activity/generate-next-week`, { email });
            setWeeklyPlans(prev => [...prev, response.data.plan].sort((a,b) => a.week - b.week));
            setTokenSisa(prev => prev - TOKEN_COST);
            toast.success(`Jadwal untuk Minggu ${response.data.plan.week} berhasil dibuat!`);
        } catch (error) { toast.error(error.response?.data?.error || "Gagal membuat jadwal minggu berikutnya.");
        } finally { setIsSubmitting(false); }
    };

    const handleToggleComplete = async (activityId, isCompleted) => {
        const originalPlans = JSON.parse(JSON.stringify(weeklyPlans));
        setWeeklyPlans(prev => prev.map(week => ({ ...week, activities: week.activities.map(act => act.id === activityId ? { ...act, is_completed: isCompleted } : act) })));
        try {
            const response = await axios.put(`${API_URL}/daily-activity/update`, { email, activityId, isCompleted });
            setUserPoints(response.data.newPoints);
            toast.success(isCompleted ? "Kerja bagus! Poin bertambah!" : "Tugas ditandai belum selesai.");
        } catch(error) { toast.error("Gagal update status."); setWeeklyPlans(originalPlans); }
    };

    const handleDeleteActivity = async (activityId) => {
        if(window.confirm("Yakin ingin menghapus aktivitas ini?")) {
            const originalPlans = JSON.parse(JSON.stringify(weeklyPlans));
            setWeeklyPlans(prev => prev.map(week => ({...week, activities: week.activities.filter(act => act.id !== activityId)})));
            try {
                await axios.delete(`${API_URL}/daily-activity/delete/${activityId}?email=${email}`);
                toast.info("Aktivitas berhasil dihapus.");
            } catch (error) { toast.error("Gagal menghapus aktivitas."); setWeeklyPlans(originalPlans); }
        }
    };

    const handleManualAddSubmit = async (activityData) => {
        setIsSubmitting(true);
        try {
            const response = await axios.post(`${API_URL}/daily-activity/add-manual`, { ...activityData, email });
            const newActivity = response.data.activity;
            setWeeklyPlans(prev => prev.map(week => week.week === newActivity.week_number ? { ...week, activities: [...week.activities, newActivity].sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)) } : week ));
            toast.success("Aktivitas manual berhasil ditambahkan!");
            setIsAddModalOpen(false);
        } catch (error) { toast.error(error.response?.data?.error || "Gagal menambah aktivitas manual.");
        } finally { setIsSubmitting(false); }
    };

    const handleResetAll = async () => {
        if (window.confirm("Yakin ingin menghapus SEMUA jadwal? Poin Anda TIDAK akan hilang.")) {
            setIsSubmitting(true);
            try {
                await axios.delete(`${API_URL}/daily-activity/reset-all?email=${email}`);
                setWeeklyPlans([]); setPlannerPdf(null); setPlannerFileName('');
                toast.success("Semua jadwal berhasil direset!");
            } catch (error) { toast.error(error.response?.data?.error || "Terjadi kesalahan saat mereset data.");
            } finally { setIsSubmitting(false); }
        }
    };

    // --- JSX (Tampilan) yang sudah di-desain ulang ---
    if (isLoading) { return <div className="loading-state-container"><ClipLoader size={50} color="#00f5ff" /><p>Memuat datamu...</p></div> }
    
    if (weeklyPlans.length === 0) {
        return (
            <div className="generator-container-futuristic initial-view">
                <div className="generator-header">
                    <h2 className="generator-title-futuristic"style={{ color: 'white' }}>Student Daily Activity</h2>
                    <p className="generator-subtitle-futuristic"style={{ color: 'white' }}>Anda belum punya jadwal. Upload PDF Rencana Studi untuk memulai!</p>
                </div>
                <div className="upload-area-futuristic">
                    <input type="file" id="plannerUpload" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} />
                    <label htmlFor="plannerUpload" className="futuristic-file-input">
                        <UploadCloud size={32} />
                        <span>{plannerFileName || 'Klik untuk upload PDF Rencana Studi'}</span>
                    </label>
                </div>
                <button onClick={handleGenerateFirstWeek} className="futuristic-button primary large" disabled={!plannerPdf || isSubmitting} data-loading={isSubmitting || undefined}>
                    Buat Jadwal Minggu 1
                </button>
                <p className="token-cost-notice">Biaya: {TOKEN_COST} token</p>
            </div>
        );
    }

    return (
        <div className="generator-container-futuristic">
            <div className="tracker-header-futuristic">
                <h2 className="tracker-title-futuristic">My Daily Activities</h2>
                <div className="points-display-futuristic">
                    <BarChart2 size={24} />
                    <span>{userPoints} Poin</span>
                </div>
            </div>
            
            {(weeklyPlans.sort((a, b) => a.week - b.week)).map(plan => (
                <div key={plan.week} className="week-container-futuristic">
                    <div className="week-header-futuristic">
                        <h3 className="week-title-futuristic">Minggu {plan.week}</h3>
                        <button className="futuristic-button secondary small" onClick={() => { setIsAddModalOpen(true); setTargetWeekForAdd(plan.week); }}>
                            <PlusCircle size={16}/> Tambah Manual
                        </button>
                    </div>
                    <div className="activity-list-futuristic">
                        {plan.activities && plan.activities.length > 0 ? (
                            plan.activities.map(activity => (
                                <ActivityItem 
                                    key={activity.id} 
                                    activity={activity}
                                    onToggleComplete={handleToggleComplete}
                                    onDelete={handleDeleteActivity}
                                    onAddToCalendar={generateGCalLink}
                                />
                            ))
                        ) : (<p className="empty-week-futuristic">Tidak ada aktivitas untuk minggu ini. Semangat!</p>)}
                    </div>
                </div>
            ))}

            <div className="generator-actions bottom-actions">
                <button onClick={handleAddNextWeek} className="futuristic-button primary" disabled={isSubmitting} data-loading={isSubmitting || undefined}>
                    <Plus size={18}/> Tambah Minggu Berikutnya
                </button>
                <button onClick={handleResetAll} className="futuristic-button secondary" disabled={isSubmitting}>
                    <RefreshCw size={18}/> Reset Semuanya
                </button>
            </div>

            {isAddModalOpen && (
                <AddActivityModal 
                    weekNumber={targetWeekForAdd} 
                    onSubmit={handleManualAddSubmit} 
                    onCancel={() => { setIsAddModalOpen(false); setTargetWeekForAdd(null); }}
                    isLoading={isSubmitting}
                />
            )}
        </div>
    );
};

export default ActivityTracker;

