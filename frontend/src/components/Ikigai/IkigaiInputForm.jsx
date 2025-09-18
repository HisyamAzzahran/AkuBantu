import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { User, Book, GraduationCap, Building2, ArrowRight } from 'lucide-react';

const IkigaiInputForm = ({ onNext, saveUserData }) => {
  const [formData, setFormData] = useState({
    nama: '',
    jurusan: '',
    semester: '',
    universitas: '',
    sesuaiJurusan: 'YA',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNext = () => {
    const { nama, jurusan, semester, universitas } = formData;
    if (!nama || !jurusan || !semester || !universitas) {
      toast.warning("⚠️ Semua data wajib diisi lengkap!");
      return;
    }
    saveUserData(formData);
    onNext();
  };

  return (
    <div className="generator-container-futuristic">
      <div className="generator-header">
        <h2 className="generator-title-futuristic" style={{ color: 'white' }}>Step 1: Data Diri</h2>
        <p className="generator-subtitle-futuristic" style={{ color: 'white' }}>Isi data dirimu sebagai fondasi untuk pemetaan Ikigai yang akurat oleh AI.</p>
      </div>

      <div className="generator-form-futuristic">
        <div className="form-grid">
          <div className="form-group-futuristic">
            <label><User size={16}/> Nama Kamu</label>
            <input
              type="text"
              name="nama"
              className="futuristic-input"
              placeholder="Masukkan nama lengkap"
              value={formData.nama}
              onChange={handleChange}
            />
          </div>
          <div className="form-group-futuristic">
            <label><GraduationCap size={16}/> Jurusan</label>
            <input
              type="text"
              name="jurusan"
              className="futuristic-input"
              placeholder="Contoh: Ilmu Komputer"
              value={formData.jurusan}
              onChange={handleChange}
            />
          </div>
          <div className="form-group-futuristic">
            <label><Book size={16}/> Semester Saat Ini</label>
            <input
              type="text"
              name="semester"
              className="futuristic-input"
              placeholder="Angka, contoh: 4"
              value={formData.semester}
              onChange={handleChange}
            />
          </div>
          <div className="form-group-futuristic">
            <label><Building2 size={16}/> Universitas</label>
            <input
              type="text"
              name="universitas"
              className="futuristic-input"
              placeholder="Nama universitas Anda"
              value={formData.universitas}
              onChange={handleChange}
            />
          </div>
        </div>
        
        <div className="form-group-futuristic" style={{marginTop: '1.5rem'}}>
            <label>Ingin Berkarir Sesuai Jurusan?</label>
            <div className="segmented-control">
                <button 
                    className={formData.sesuaiJurusan === 'YA' ? 'active' : ''} 
                    onClick={() => setFormData({...formData, sesuaiJurusan: 'YA'})}
                >
                    Ya, Sesuai
                </button>
                <button 
                    className={formData.sesuaiJurusan === 'TIDAK' ? 'active' : ''} 
                    onClick={() => setFormData({...formData, sesuaiJurusan: 'TIDAK'})}
                >
                    Tidak, Ingin Explore
                </button>
            </div>
        </div>

        <div className="generator-actions">
            <button onClick={handleNext} className="futuristic-button primary large">
                Lanjut ke Tahap Tes <ArrowRight size={18}/>
            </button>
        </div>
      </div>
    </div>
  );
};

export default IkigaiInputForm;