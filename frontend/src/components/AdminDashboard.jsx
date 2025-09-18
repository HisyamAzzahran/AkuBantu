import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Users, Save, Edit3, Trash2, XCircle, CheckSquare, PieChart, PlusCircle, BarChart2, Shield, Crown, User, Coins, TrendingUp, UserPlus } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_URL = "https://webai-production-b975.up.railway.app";

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ tokens: 0, is_premium: 0 });
  const [newUser, setNewUser] = useState({ email: '', username: '', password: '', tokens: 10, is_premium: 0 });
  const [featureStats, setFeatureStats] = useState([]);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [statsViewMode, setStatsViewMode] = useState('chart');
  const [daysFilter, setDaysFilter] = useState(30); // 7 | 30 | 90
  const navigate = useNavigate();

  const fetchUsers = useCallback(async () => {
    try { const res = await axios.get(`${API_URL}/admin/users`); setUsers(res.data || []); }
    catch { toast.error('❌ Gagal mengambil data user!'); }
  }, []);
  const fetchFeatureUsage = useCallback(async () => {
    try { const res = await axios.get(`${API_URL}/admin/feature-usage?days=${daysFilter}`); setFeatureStats(res.data || []); }
    catch { toast.error('❌ Gagal mengambil statistik!'); }
  }, [daysFilter]);

  useEffect(() => { fetchUsers(); fetchFeatureUsage(); }, [fetchUsers, fetchFeatureUsage]);

  const handleFullRefresh = async () => {
    setIsRefreshingData(true);
    toast.info('Memperbarui data...');
    await Promise.all([fetchUsers(), fetchFeatureUsage()]);
    setIsRefreshingData(false);
    toast.success('✅ Data berhasil diperbarui!');
  };

  const startEdit = (user) => { setEditing(user); setForm({ tokens: user.tokens, is_premium: user.is_premium ? 1 : 0 }); };
  const cancelEdit = () => setEditing(null);
  const updateUser = async () => {
    if (!editing) return;
    try {
      await axios.post(`${API_URL}/admin/update-user`, { email: editing.email, tokens: Number(form.tokens), is_premium: parseInt(form.is_premium, 10) });
      toast.success(`✅ User ${editing.email} berhasil diupdate!`);
      setEditing(null); fetchUsers();
    } catch { toast.error(`❌ Gagal update user ${editing.email}!`); }
  };
  const deleteUser = async (emailToDelete) => {
    if (window.confirm(`Yakin ingin menghapus user ${emailToDelete}?`)) {
      try { await axios.post(`${API_URL}/admin/delete-user`, { email: emailToDelete }); toast.success(`🗑️ User ${emailToDelete} berhasil dihapus!`); fetchUsers(); }
      catch { toast.error(`❌ Gagal menghapus user ${emailToDelete}!`); }
    }
  };

  const handleNewUserChange = (e) => { const { name, value } = e.target; setNewUser(prev => ({ ...prev, [name]: value })); };
  const handleNewUserSelectChange = (e) => { const { name, value } = e.target; setNewUser(prev => ({ ...prev, [name]: parseInt(value, 10) })); };
  const handleFormChange = (e) => { const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value })); };
  const handleFormSelectChange = (e) => { const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: parseInt(value, 10) })); };
  const addUser = async (e) => {
    e.preventDefault();
    if (!newUser.email || !newUser.username || !newUser.password) { toast.warning('⚠️ Email, Username, dan Password wajib diisi!'); return; }
    try {
      const payload = { ...newUser, tokens: Number(newUser.tokens), is_premium: parseInt(newUser.is_premium, 10) };
      const res = await axios.post(`${API_URL}/admin/add-user`, payload);
      if (res.data.message.includes('berhasil ditambahkan')) {
        toast.success('✅ User baru berhasil ditambahkan!');
        setNewUser({ email: '', username: '', password: '', tokens: 10, is_premium: 0 }); fetchUsers();
      } else { toast.error(res.data.message || '❌ Gagal menambahkan user!'); }
    } catch (error) { toast.error(error.response?.data?.error || '❌ Gagal menambahkan user!'); }
  };
  const saveDatabase = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/download-db`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', 'webai.db'); document.body.appendChild(link); link.click(); link.remove();
      toast.success('Database berhasil diunduh!');
    } catch { toast.error('❌ Gagal mengunduh database!'); }
  };

  // Analytics
  const totalUsers = users.length;
  const premiumUsers = users.filter(u => u?.is_premium === 1 || u?.is_premium === true).length;
  const basicUsers = totalUsers - premiumUsers;
  const totalTokens = users.reduce((acc, u) => acc + (Number(u?.tokens) || 0), 0);
  const featureCostMap = {
    'student_goals_planning': 3,
    'student_goals_delete_all': 0,
    'essay_exchange_v2': 2,
    'ikigai_final_analysis': 5,
    'swot_analyzer': 1,
    'Interview Simulator': 5,
  };
  const featureLabelMap = {
    'student_goals_planning': 'Student Goals Planning',
    'student_goals_delete_all': 'Student Goals Reset',
    'essay_exchange_v2': 'Motivation Letter Assistant',
    'ikigai_final_analysis': 'Ikigai Final Analysis',
    'swot_analyzer': 'SWOT Analyzer',
    'Interview Simulator': 'Interview Simulator',
  };
  const [tokensSpentExact, setTokensSpentExact] = useState(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await axios.get(`${API_URL}/admin/tokens-spent?days=${daysFilter}`);
        if (mounted) setTokensSpentExact(Number(r.data?.tokens_spent) || 0);
      } catch (_) {
        if (mounted) setTokensSpentExact(null);
      }
    })();
    return () => { mounted = false; };
  }, [daysFilter]);
  const tokensSpentEstimate = (featureStats || []).reduce((sum, s) => sum + ((featureCostMap[s?.feature] || 0) * (Number(s?.count) || 0)), 0);
  const tokensSpent = tokensSpentExact ?? tokensSpentEstimate;

  // New users in period (if created_at available)
  const newUsersInPeriod = (() => {
    const cut = Date.now() - daysFilter * 24 * 60 * 60 * 1000;
    const count = users.filter(u => u?.created_at && new Date(u.created_at).getTime() >= cut).length;
    return count || 0;
  })();

  const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
  const chartData = { labels: (featureStats || []).map(s => featureLabelMap[s?.feature] || s.feature), datasets: [{ label: 'Usage', data: (featureStats || []).map(s => s.count), backgroundColor: 'rgba(0,245,255,0.35)', borderColor: 'rgba(0,245,255,0.75)', borderWidth: 1, borderRadius: 6 }] };

  return (
    <div className="admin-page-container">
      <div className="admin-header">
        <h2 className="admin-title"><Shield /> Admin Dashboard</h2>
        <div className="admin-actions">
          <button className="futuristic-button secondary" onClick={() => navigate('/admin/track-ikigai')}><BarChart2 size={18} /> Track Ikigai</button>
          <button className="futuristic-button secondary" onClick={saveDatabase}><Save size={18} /> Download DB</button>
          <button className="futuristic-button primary" onClick={handleFullRefresh} disabled={isRefreshingData} data-loading={isRefreshingData || undefined}><RefreshCw size={18} /> Refresh</button>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon users"><Users size={20}/></div>
          <div className="metric-value">{totalUsers}</div>
          <div className="metric-label">Total Users</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon users"><UserPlus size={20}/></div>
          <div className="metric-value">{newUsersInPeriod}</div>
          <div className="metric-label">New Users ({daysFilter}d)</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon premium"><Crown size={20}/></div>
          <div className="metric-value">{premiumUsers}</div>
          <div className="metric-label">Premium</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon basic"><User size={20}/></div>
          <div className="metric-value">{basicUsers}</div>
          <div className="metric-label">Basic</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon tokens"><Coins size={20}/></div>
          <div className="metric-value">{totalTokens}</div>
          <div className="metric-label">Tokens Remaining</div>
        </div>
        <div className="metric-card">
          <div className="metric-icon spent"><TrendingUp size={20}/></div>
          <div className="metric-value">{tokensSpent}</div>
          <div className="metric-label">Tokens Spent ({tokensSpentExact !== null ? 'exact' : 'est.'})</div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="admin-main-content">
          <div className="admin-card-futuristic">
            <div className="admin-card-header">
              <h5 className="admin-card-title"><PieChart /> Feature Usage</h5>
              <div className="segmented-control small" style={{gap: '6px'}}>
                <div className="segmented-control" style={{marginRight: '8px'}}>
                  {[7,30,90].map(d => (
                    <button key={d} className={daysFilter === d ? 'active' : ''} onClick={() => setDaysFilter(d)}>{d}d</button>
                  ))}
                </div>
                <button className={statsViewMode === 'chart' ? 'active' : ''} onClick={() => setStatsViewMode('chart')}>Chart</button>
                <button className={statsViewMode === 'list' ? 'active' : ''} onClick={() => setStatsViewMode('list')}>List</button>
                <button className="futuristic-button secondary x-small" onClick={() => exportUsageCsv(featureStats)} style={{marginLeft:'8px'}}>Export CSV</button>
              </div>
            </div>
            <div className="admin-card-body">
              {statsViewMode === 'chart' ? (
                <div className="chart-container-futuristic" style={{height: 360}}>
                  <Bar data={chartData} options={chartOptions} />
                </div>
              ) : (
                <ul className="futuristic-list">
                  {(featureStats || []).map((s) => (
                    <li key={s.feature}><span>{featureLabelMap[s?.feature] || s.feature}</span><span className="list-badge">{s.count}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="admin-card-futuristic">
            <div className="admin-card-header"><h5 className="admin-card-title"><Users /> Data Pengguna ({users.length})</h5></div>
            <div className="admin-card-body no-padding">
              <div className="table-responsive-futuristic">
                <table className="futuristic-table">
                  <thead><tr><th>ID</th><th>Email</th><th>Username</th><th>Status</th><th>Token</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td className="cell-email">{u.email}</td>
                        <td>{u.username}</td>
                        <td><span className={`status-badge ${u.is_premium ? 'premium' : 'basic'}`}>{u.is_premium ? 'Premium' : 'Basic'}</span></td>
                        <td>{u.tokens}</td>
                        <td>
                          <div className="action-buttons">
                            <button onClick={() => startEdit(u)} className="futuristic-button icon-only secondary"><Edit3 size={16}/></button>
                            <button onClick={() => deleteUser(u.email)} className="futuristic-button icon-only remove"><Trash2 size={16}/></button>
                            <button className="futuristic-button x-small" onClick={() => exportUsersCsv(users)} style={{marginLeft:'6px'}}>Export CSV</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-sidebar">
          {editing && (
            <div className="admin-card-futuristic">
              <div className="admin-card-header"><h5 className="admin-card-title"><Edit3 /> Edit User: {editing.email}</h5></div>
              <div className="admin-card-body">
                <div className="form-group-futuristic"><label>Tokens:</label><input name="tokens" type="number" className="futuristic-input" value={form.tokens} onChange={handleFormChange} /></div>
                <div className="form-group-futuristic"><label>Status Premium:</label><select name="is_premium" className="futuristic-select" value={form.is_premium} onChange={handleFormSelectChange}><option value="0">Basic</option><option value="1">Premium</option></select></div>
                <div className="action-buttons"><button className="futuristic-button secondary" onClick={cancelEdit}><XCircle size={18}/> Batal</button><button className="futuristic-button primary" onClick={updateUser}><CheckSquare size={18}/> Simpan</button></div>
              </div>
            </div>
          )}
          <div className="admin-card-futuristic">
            <div className="admin-card-header"><h5 className="admin-card-title"><PlusCircle /> Tambah User Baru</h5></div>
            <form onSubmit={addUser} className="admin-card-body">
              <div className="form-group-futuristic"><label>Email:</label><input name="email" type="email" className="futuristic-input" placeholder="Email" value={newUser.email} onChange={handleNewUserChange} required /></div>
              <div className="form-group-futuristic"><label>Username:</label><input name="username" type="text" className="futuristic-input" placeholder="Username" value={newUser.username} onChange={handleNewUserChange} required /></div>
              <div className="form-group-futuristic"><label>Password:</label><input name="password" type="password" className="futuristic-input" placeholder="Password" value={newUser.password} onChange={handleNewUserChange} required /></div>
              <div className="form-grid">
                <div className="form-group-futuristic"><label>Tokens:</label><input name="tokens" type="number" className="futuristic-input" value={newUser.tokens} onChange={handleNewUserChange} /></div>
                <div className="form-group-futuristic"><label>Status:</label><select name="is_premium" className="futuristic-select" value={newUser.is_premium} onChange={handleNewUserSelectChange}><option value="0">Basic</option><option value="1">Premium</option></select></div>
              </div>
              <div className="generator-actions"><button type="submit" className="futuristic-button primary large">Tambah User</button></div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

// --- CSV Helpers ---
function exportUsersCsv(users) {
  const headers = ['id','email','username','is_premium','tokens'];
  const rows = users.map(u => [u.id, u.email, u.username, u.is_premium ? 1 : 0, u.tokens]);
  downloadCsv('users.csv', [headers, ...rows]);
}
function exportUsageCsv(stats) {
  const headers = ['feature','count'];
  const rows = (stats || []).map(s => [s.feature, s.count]);
  downloadCsv('feature_usage.csv', [headers, ...rows]);
}
function downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.setAttribute('download', filename);
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
