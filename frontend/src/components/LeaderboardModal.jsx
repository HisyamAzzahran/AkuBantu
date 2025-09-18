import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Award, Crown } from 'lucide-react';

const API_URL = "https://webai-production-b975.up.railway.app";

// Komponen CSS Loader internal untuk menggantikan ClipLoader
const CssLoader = () => <div className="css-loader-futuristic"></div>;

const LeaderboardModal = ({ isOpen, onClose }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchLeaderboard = async () => {
            // Hanya set loading pada pengambilan data pertama kali
            if (leaderboardData.length === 0) {
                setIsLoading(true);
            }
            setError('');

            try {
                const response = await axios.get(`${API_URL}/leaderboard`);
                if (isMounted) {
                    setLeaderboardData(response.data);
                }
            } catch (err) {
                console.error("Failed to fetch leaderboard:", err);
                if (isMounted) {
                    setError("Gagal memuat papan peringkat. Coba lagi nanti.");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        // Ambil data langsung saat modal dibuka
        fetchLeaderboard();

        // Fitur "Real-time": Ambil data ulang setiap 15 detik
        const intervalId = setInterval(fetchLeaderboard, 15000);

        // Membersihkan interval saat komponen di-unmount atau modal ditutup
        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [isOpen]); // Dependensi hanya pada isOpen

    const getMedal = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };
    
    if (!isOpen) return null;

    return (
        <div className="modal-overlay-futuristic" onClick={onClose}>
            {/* CSS & JSX yang sudah di-desain ulang */}
            <style>{`
                .modal-overlay-futuristic { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(10, 10, 20, 0.5); backdrop-filter: blur(10px); display: flex; justify-content: center; align-items: center; z-index: 1050; padding: 20px; animation: fadeIn 0.3s ease-out; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                
                .modal-content-futuristic.leaderboard-modal { background: rgba(20, 20, 35, 0.9); backdrop-filter: blur(20px); border: 1px solid rgba(0, 245, 255, 0.3); border-radius: 20px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); max-width: 600px; width: 100%; display: flex; flex-direction: column; animation: scaleUp 0.4s ease-out; }
                @keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }

                .modal-header-futuristic { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid rgba(0, 245, 255, 0.2); }
                .modal-title-futuristic { font-size: 1.5rem; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 0.75rem; }
                .btn-close-futuristic { background: transparent; border: none; color: #888; cursor: pointer; transition: color 0.3s ease; }
                .btn-close-futuristic:hover { color: #fff; }

                .leaderboard-subtitle { text-align: center; color: #b0b0b0; padding: 1rem 1.5rem; font-size: 0.95rem; }
                
                .leaderboard-body { padding: 0 1rem 1rem; max-height: 65vh; overflow-y: auto; }
                .leaderboard-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.75rem; }
                .leaderboard-item { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; transition: all 0.3s ease; }
                .leaderboard-item:hover { background: rgba(0, 245, 255, 0.08); border-color: rgba(0, 245, 255, 0.5); }
                
                .leaderboard-item.rank-1 { border-left: 4px solid #ffd700; }
                .leaderboard-item.rank-2 { border-left: 4px solid #c0c0c0; }
                .leaderboard-item.rank-3 { border-left: 4px solid #cd7f32; }

                .rank-number { font-size: 1.5rem; font-weight: 700; color: #fff; width: 50px; text-align: center; flex-shrink: 0; }
                .user-details { flex-grow: 1; display: flex; flex-direction: column; }
                .username { font-weight: 600; color: #e0e0e0; display: flex; align-items: center; gap: 0.5rem; }
                .premium-icon { color: #ffd700; }
                .email { font-size: 0.8rem; color: #888; }
                .points { font-weight: 700; font-size: 1.1rem; color: #00f5ff; flex-shrink: 0; }
                .loader-container, .error-container { padding: 3rem; text-align: center; color: #b0b0b0; display: flex; justify-content: center; align-items: center; }
                .css-loader-futuristic { border: 4px solid rgba(255, 255, 255, 0.2); border-top: 4px solid #00f5ff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
            
            <div className="modal-content-futuristic leaderboard-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header-futuristic">
                    <h5 className="modal-title-futuristic"><Award size={28} /> Papan Peringkat</h5>
                    <button className="btn-close-futuristic" onClick={onClose}><X size={24} /></button>
                </div>

                <div className="leaderboard-subtitle">
                    Poin didapatkan dari menyelesaikan tugas. Terus tingkatkan produktivitasmu!
                </div>
                
                <div className="leaderboard-body">
                    {isLoading ? (
                        <div className="loader-container"><CssLoader /></div>
                    ) : error ? (
                        <div className="error-container">{error}</div>
                    ) : (
                        <ul className="leaderboard-list">
                            {leaderboardData.map(user => (
                                <li key={user.rank} className={`leaderboard-item rank-${user.rank}`}>
                                    <span className="rank-number">{getMedal(user.rank)}</span>
                                    <div className="user-details">
                                        <span className="username">
                                            {user.username}
                                            {user.is_premium && <Crown size={14} className="premium-icon" title="Pengguna Premium" />}
                                        </span>
                                        <span className="email">{user.email}</span>
                                    </div>
                                    <span className="points">{user.points.toLocaleString('id-ID')} Poin</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaderboardModal;
