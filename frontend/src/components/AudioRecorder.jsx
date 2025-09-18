import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { Mic, StopCircle, Loader2 } from 'lucide-react';

const API_BASE = "https://webai-production-b975.up.railway.app";

function AudioRecorder({ onTranscription, disabled }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const dataArrayRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const clearCanvas = useCallback(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  // --- FUNGSI VISUALISASI YANG DIPERBARUI ---
  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current || !dataArrayRef.current) {
      if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
      return;
    }

    animationFrameIdRef.current = requestAnimationFrame(drawWaveform);
    analyserRef.current.getByteTimeDomainData(dataArrayRef.current);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    
    if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00f5ff'; // Warna gelombang neon
    ctx.beginPath();

    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArrayRef.current[i] / 128.0;
      const y = v * canvas.height / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }, []);

  const startVisualization = useCallback(async (stream) => {
    if (!stream) return;
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      if (sourceRef.current) sourceRef.current.disconnect();
      
      analyserRef.current = audioContextRef.current.createAnalyser();
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.fftSize = 2048;
      dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

      drawWaveform();
    } catch (e) {
      console.error("Gagal memulai visualisasi:", e);
      toast.error("Gagal memulai visualisasi audio.");
    }
  }, [drawWaveform]);

  const stopVisualizationAndStream = useCallback(() => {
    if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(track => track.stop());
    if (sourceRef.current) sourceRef.current.disconnect();
    clearCanvas();
  }, [clearCanvas]);

  const startRecording = async () => {
    if (disabled || isRecording || isProcessing) return;
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      await startVisualization(stream);
      setIsRecording(true);

      const options = { mimeType: 'audio/webm;codecs=opus' };
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      mediaRecorderRef.current.ondataavailable = event => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        if (audioBlob.size < 100) { toast.info("Tidak ada audio yang terekam."); setIsProcessing(false); stopVisualizationAndStream(); return; }
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        try {
          const response = await axios.post(`${API_BASE}/transcribe`, formData);
          if (response.data && typeof response.data.transcription === 'string') {
            onTranscription(response.data.transcription);
            if (response.data.transcription.trim() === "") toast.info("Tidak ada jawaban terdeteksi.");
            else toast.success("Audio berhasil ditranskripsi!");
          } else { throw new Error(response.data?.error || "Hasil transkripsi tidak valid."); }
        } catch (err) {
          toast.error(err.response?.data?.error || 'Gagal mentranskripsi audio.');
          onTranscription('');
        } finally {
          setIsProcessing(false);
        }
        stopVisualizationAndStream();
      };
      mediaRecorderRef.current.start();
      toast.info("🎙️ Perekaman dimulai...");
    } catch (err) {
      toast.error(`⚠️ Gagal memulai perekaman: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      toast.info("⏹️ Perekaman dihentikan, memproses audio...");
    }
  };
  
  useEffect(() => {
    return () => {
      stopVisualizationAndStream();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [stopVisualizationAndStream]);

  return (
    <div className="audio-recorder-futuristic">
      <canvas ref={canvasRef} className="visualizer-canvas-futuristic" width="400" height="80" />
      <div className="recorder-button-wrapper">
        <button 
          onClick={isRecording ? stopRecording : startRecording} 
          className={`recorder-btn-futuristic ${isRecording ? 'recording' : ''}`}
          disabled={disabled || isProcessing}
          title={isRecording ? "Stop dan kirim jawaban" : "Mulai rekam jawaban"}
        >
          {isProcessing 
            ? <Loader2 className="spinner" /> 
            : isRecording 
                ? <StopCircle size={32} /> 
                : <Mic size={32} />
          }
        </button>
      </div>
       <p className="recorder-status-text">
        {isProcessing ? 'Memproses audio...' : isRecording ? 'Sedang Merekam...' : 'Tekan untuk menjawab'}
      </p>
    </div>
  );
}

export default AudioRecorder;
