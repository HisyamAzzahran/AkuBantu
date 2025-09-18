import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ClipLoader } from 'react-spinners';
import { ArrowLeftCircle, CheckCircle, AlertTriangle, ClipboardCopy } from 'lucide-react'; // Menambahkan beberapa ikon

// Pastikan Anda punya file CSS ini atau pindahkan style ke App.css/global CSS
import './ResultPage.css'; 
import 'react-toastify/dist/ReactToastify.css';
// animate.css sudah diimpor global atau di App.js

const API_URL_FROM_ENV = import.meta.env.VITE_API_URL || "https://webai-production-b975.up.railway.app";

function ResultPage({ 
    onRestart, 
    username,
    answers, // Array of strings
    email,
    // isPremium, // Tidak digunakan langsung di ResultPage untuk logic utama selain display mungkin
    // tokenSisa, // Token sudah di-handle InterviewPage, tidak perlu di-update lagi di sini
    interviewType,
    language, // Ditambahkan untuk konteks display
    scholarshipName,
    internshipPosition,
    cv_summary 
}) {
  const navigate = useNavigate();
  
  const [scores, setScores] = useState([]);
  const [totalScore, setTotalScore] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null); // Untuk menangani error spesifik

  const API_URL = API_URL_FROM_ENV;

  const evaluateAnswers = useCallback(async () => {
    setErrorState(null); // Reset error state
    if (!answers || !Array.isArray(answers) || answers.length === 0 || !username || !email) {
      toast.error("Data interview tidak lengkap untuk evaluasi.");
      setErrorState("Data interview tidak lengkap. Silakan mulai ulang sesi.");
      setLoading(false);
      // Tidak langsung navigate, biarkan user lihat pesan error dan klik tombol kembali
      return;
    }

    setLoading(true);
    console.log("ResultPage: Memulai evaluasi dengan data:", { answers, username, email });

    try {
      const evaluateResponse = await fetch(`${API_URL}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          username,
          interviewType,
          language,
          scholarshipName,
          internshipPosition,
          cv_summary
        }),
      });

      if (!evaluateResponse.ok) {
        const errorData = await evaluateResponse.json().catch(() => ({error: "Gagal memproses respons error dari server evaluasi."}));
        throw new Error(errorData.error || `Evaluasi gagal dengan status ${evaluateResponse.status}`);
      }

      const data = await evaluateResponse.json();
      console.log("ResultPage: Respons dari /evaluate:", data);

      if (data.scores && data.total !== undefined && data.feedback !== undefined) {
        setScores(data.scores);
        setTotalScore(data.total);
        setFeedback(data.feedback);
        // Tidak perlu toast sukses di sini, biarkan konten yang berbicara
      } else {
        throw new Error("Format data evaluasi dari server tidak sesuai atau data kosong.");
      }
    } catch (error) {
      console.error("ResultPage: Gagal evaluasi jawaban:", error);
      toast.error(`❌ ${error.message || "Terjadi kesalahan saat evaluasi."}`);
      setErrorState(error.message || "Terjadi kesalahan saat mengambil hasil evaluasi.");
    } finally {
      setLoading(false);
      console.log("ResultPage: Proses evaluasi selesai.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ API_URL, answers, cv_summary, email, internshipPosition, interviewType, language, scholarshipName, username ]);
  // Hapus onRestart & navigate dari deps jika tidak berubah atau menyebabkan loop.

  useEffect(() => {
    evaluateAnswers();
  }, [evaluateAnswers]);

  const handleCopyToClipboard = () => {
    let textToCopy = `Hasil Simulasi Interview untuk ${username}:\n\n`;
    textToCopy += `Jenis Interview: ${interviewType === 'magang' ? `Magang - ${internshipPosition}` : `Beasiswa - ${scholarshipName}`}\n`;
    textToCopy += `Bahasa: ${language === 'id' ? 'Indonesia' : 'English'}\n\n`;
    textToCopy += "Jawaban:\n";
    (answers || []).forEach((ans, index) => {
        textToCopy += `${index + 1}. ${ans}\n`;
        if (scores[index] !== undefined) {
            textToCopy += `   Skor: ${scores[index]}/5\n`;
        }
    });
    if (totalScore !== null) {
        textToCopy += `\nTotal Skor: ${totalScore}/${(answers || []).length * 5}\n`;
        textToCopy += `Feedback: ${feedback}\n`;
    }
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast.success("📋 Hasil evaluasi berhasil disalin ke clipboard!"))
      .catch(err => toast.error("❌ Gagal menyalin hasil."));
  };


  if (loading) {
    return (
      <div className="result-page-container text-center py-5 d-flex flex-column align-items-center justify-content-center">
        <ClipLoader size={50} color="#0d6efd" />
        <h2 className="mt-3 animate__animated animate__pulse animate__infinite">⏳ Menilai jawaban kamu...</h2>
        <p className="text-muted">Mohon tunggu sebentar ya!</p>
      </div>
    );
  }

  if (errorState) {
      return (
        <div className="result-page-container container text-center py-5 animate__animated animate__fadeIn">
            <AlertTriangle size={48} className="text-danger mb-3" />
            <h2 className="text-danger">Oops! Terjadi Kesalahan</h2>
            <p className="text-muted mb-4">{errorState}</p>
            <button
             onClick={() => { if (onRestart) onRestart(); else navigate('/'); }}
             className="btn btn-lg btn-primary"
            >
             <ArrowLeftCircle size={20} className="me-2" /> Kembali & Coba Lagi
            </button>
        </div>
      )
  }
  
  // Kondisi jika evaluasi selesai tapi tidak ada data skor (mungkin error format dari backend)
  if (!scores.length && !feedback && !totalScore) { 
      return (
        <div className="result-page-container container text-center py-5 animate__animated animate__fadeIn">
            <AlertTriangle size={48} className="text-warning mb-3" />
            <h2>Hasil Evaluasi Tidak Ditemukan</h2>
            <p className="text-muted mb-4">Tidak dapat menampilkan hasil evaluasi karena format data tidak sesuai atau kosong.</p>
            <button
             onClick={() => { if (onRestart) onRestart(); else navigate('/'); }}
             className="btn btn-lg btn-primary"
            >
             <ArrowLeftCircle size={20} className="me-2" /> Kembali ke Menu
            </button>
        </div>
      )
  }

  const maxPossibleScore = (answers || []).length * 5;
  const scorePercentage = totalScore !== null && maxPossibleScore > 0 ? (totalScore / maxPossibleScore) : 0;
  let performanceMessage = "Perlu banyak latihan agar jawabanmu lebih kuat dan terfokus.";
  if (scorePercentage >= 0.88) {
    performanceMessage = "💯 Luar Biasa! Kamu menunjukkan pemahaman dan kesiapan yang sangat baik.";
  } else if (scorePercentage >= 0.72) {
    performanceMessage = "👍 Bagus! Ada beberapa area yang bisa ditingkatkan untuk hasil yang lebih maksimal.";
  }


  return (
    <div className="result-page-container container py-4 animate__animated animate__fadeInUp">
      <div className="text-center mb-4">
        <h1 className="result-page-title display-5">📋 Hasil Simulasi Wawancara</h1>
      </div>
      
      <div className="user-greeting-box p-3 mb-4 shadow-sm animate__animated animate__fadeIn animate__delay-0.5s">
        <h2>Halo, <span className="text-primary fw-bold">{username}</span>! 👋</h2>
        <p className="lead mb-0">
          Berikut evaluasi jawabanmu untuk simulasi interview 
          {interviewType === 'magang' ? ` posisi ${internshipPosition || 'Magang'}` : ` Beasiswa ${scholarshipName || ''}`}
          {language === 'en' && ' (dalam Bahasa Inggris)'}:
        </p>
      </div>

      <div className="answers-summary mb-4 card shadow-sm animate__animated animate__fadeInUp animate__delay-1s">
        <div className="card-header bg-light">
            <h3 className="mb-0 section-title h5"><CheckCircle size={20} className="me-2 text-success"/> Jawaban Kamu:</h3>
        </div>
        <ul className="list-group list-group-flush">
          {(answers || []).map((ans, index) => (
            <li key={index} className="list-group-item answer-item">
              <div className="d-flex w-100 justify-content-between">
                <h6 className="mb-1 fw-bold">Jawaban Pertanyaan #{index + 1}</h6>
                {scores[index] !== undefined && (
                  <span className="badge bg-primary rounded-pill score-badge">Skor: {scores[index]}/5</span>
                )}
              </div>
              <p className="mb-1 answer-text">{ans || "-"}</p>
            </li>
          ))}
        </ul>
      </div>

      {totalScore !== null && (
        <div className="evaluation-summary card shadow animate__animated animate__fadeInUp animate__delay-1.5s">
          <div className="card-header bg-primary text-white">
            <h3 className="mb-0 h5"><CheckCircle size={20} className="me-2"/> Evaluasi & Feedback</h3>
          </div>
          <div className="card-body">
            <h4 className="card-title">Total Skor Akhir: <span className="fw-bold text-success">{totalScore} / {maxPossibleScore}</span></h4>
            <p className="card-text feedback-text text-muted fst-italic">"{feedback || "Tidak ada feedback spesifik."}"</p>
            <hr className="my-3"/>
            <p className="conclusion-text fw-bold mt-2 mb-0">{performanceMessage}</p>
          </div>
        </div>
      )}

      <div className="mt-4 pt-2 text-center result-actions animate__animated animate__fadeIn animate__delay-2s">
        <button
            onClick={handleCopyToClipboard}
            className="btn btn-outline-secondary me-2"
            title="Salin Hasil ke Clipboard"
        >
            <ClipboardCopy size={18} className="me-1" /> Salin Hasil
        </button>
        <button
          onClick={() => { if (onRestart) onRestart(); else navigate('/'); }}
          className="btn btn-primary"
        >
          <ArrowLeftCircle size={18} className="me-1" /> Ulangi / Kembali ke Menu
        </button>
      </div>
    </div>
  );
}

export default ResultPage;
