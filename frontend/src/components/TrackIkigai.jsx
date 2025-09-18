import React, { useEffect, useState, useCallback } from 'react';
import { ClipLoader } from 'react-spinners';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowLeft, ListChecks } from 'lucide-react';

const API_URL = "https://webai-production-b975.up.railway.app";

const TrackIkigai = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/track-ikigai`);
      setData(res.data);
      if (res.data.length === 0) {
        toast.info("ℹ️ Belum ada data pemetaan Ikigai yang tercatat.");
      }
    } catch (err) {
      toast.error("❌ Gagal mengambil data track Ikigai.");
      console.error("Error fetching Ikigai tracking data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="admin-page-container">
      <div className="admin-header">
        <h2 className="admin-title">
          <ListChecks /> Riwayat Pemetaan Ikigai
        </h2>
        <div className="admin-actions">
          <button className="futuristic-button secondary" onClick={() => navigate('/')}>
            <ArrowLeft size={18} /> Kembali
          </button>
          <button className="futuristic-button primary" onClick={fetchData} disabled={loading} data-loading={loading || undefined}>
            <RefreshCw size={18} />
            Refresh Data
          </button>
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="loading-state-container">
            <ClipLoader size={50} color="#00f5ff" />
            <p>Memuat data Ikigai...</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <div className="table-responsive-futuristic">
            <table className="futuristic-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Email</th>
                  <th>Nama</th>
                  <th>MBTI</th>
                  <th>Top 3 VIA Strengths</th>
                  <th>Top 3 Career Roles</th>
                  <th>Ikigai Spot</th>
                  <th>Slice of Life</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && !loading ? (
                  <tr><td colSpan="9" className="text-center p-4">Belum ada data pemetaan Ikigai yang tercatat.</td></tr>
                ) : (
                  data.map((d, i) => (
                    <tr key={d.id || i}>
                      <td className="text-center">{i + 1}</td>
                      <td className="cell-email">{d.email}</td>
                      <td>{d.nama}</td>
                      <td className="text-center">{d.mbti}</td>
                      <td>{Array.isArray(d.via) ? d.via.join(', ') : d.via}</td>
                      <td>{Array.isArray(d.career) ? d.career.join(', ') : d.career}</td>
                      <td>{d.ikigai_spot}</td>
                      <td>{d.slice_purpose}</td>
                      <td className="text-nowrap">{formatTimestamp(d.timestamp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackIkigai;
