import React, { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import 'animate.css';
import { BookOpen, Lock, BadgeCheck, Crown, Sparkles, Mic, Plane, Target } from 'lucide-react';

const fieldsConfig = {
  student: {
    name: 'Student Development',
    description: 'Modul pengembangan diri dan karier berbasis AI 🎓',
    icon: <BookOpen size={32} />,
    modes: [
      { id: 'ikigai', title: 'Ikigai Self Discovery', description: 'Pemetaan ikigai dan strategi karier personal.', premium: true },
      { id: 'swot', title: 'SWOT Self Analysis', description: 'Kenali kekuatan, tantangan, dan rencana aksimu.', premium: true },
      { id: 'studentgoals', title: 'Student Goals Planning', description: 'Susun roadmap akademik per semester dengan AI.', premium: true },
      { id: 'activitytracker', title: 'Student Daily Activity', description: 'Turunkan rencana semester jadi jadwal mingguan yang eksekutif.', premium: true },
      { id: 'interview', title: 'Interview Simulator', description: 'Simulasi interview beasiswa & magang secara real-time.', premium: true },
      { id: 'exchanges', title: 'Motivation Letter Assistant', description: 'Buat motivation letter exchange yang kuat dan terstruktur.', premium: true },
    ],
  },
};

const modeIcons = {
  ikigai: <BookOpen size={22} />,
  swot: <BookOpen size={22} />,
  studentgoals: <Target size={22} />,
  activitytracker: <Target size={22} />,
  interview: <Mic size={22} />,
  exchanges: <Plane size={22} />,
};

const ModeSelector = ({ onSelectMode, isPremium }) => {
  const defaultField = Object.keys(fieldsConfig)[0] || null;
  const [selectedFieldKey, setSelectedFieldKey] = useState(defaultField);
  const [query, setQuery] = useState('');

  const handleModeClick = (mode) => {
    if (mode.premium && !isPremium) {
      toast.warn('💡 Fitur ini khusus untuk pengguna Premium. Silakan upgrade!', { position: 'top-center' });
    } else {
      onSelectMode(mode.id);
    }
  };

  const fieldTabs = (
    <div className="field-tabs-futuristic" role="tablist" aria-label="Kategori fitur">
      {Object.entries(fieldsConfig).map(([key, field]) => (
        <button
          key={key}
          role="tab"
          aria-selected={selectedFieldKey === key}
          className={`field-tab-futuristic ${selectedFieldKey === key ? 'active' : ''}`}
          onClick={() => setSelectedFieldKey(key)}
          title={field.description}
        >
          <span className="field-tab-icon">{field.icon}</span>
          <span className="field-tab-text">{field.name}</span>
        </button>
      ))}
    </div>
  );

  const renderModesForSelectedField = () => {
    if (!selectedFieldKey) return null;
    const field = fieldsConfig[selectedFieldKey];

    const filteredModes = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return field.modes;
      return field.modes.filter((mode) =>
        mode.title.toLowerCase().includes(q) ||
        (mode.description || '').toLowerCase().includes(q)
      );
    }, [field.modes, query]);

    return (
      <>
        <div className="section-header-futuristic">
          <h3 className="section-title-futuristic">{field.name}</h3>
          <div className="mode-search-futuristic" role="search">
            <input
              type="text"
              placeholder="Cari modul..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Cari modul"
            />
          </div>
        </div>
        <div className="card-grid-futuristic">
          {filteredModes.map((mode) => {
            const isDisabled = mode.premium && !isPremium;
            return (
              <div
                key={mode.id}
                className={`mode-card-futuristic ${isDisabled ? 'disabled' : ''}`}
                onClick={() => handleModeClick(mode)}
                title={isDisabled ? 'Khusus pengguna Premium' : mode.description}
              >
                <div className="mode-card-header">
                  <div className="mode-card-title">
                    <span className="mode-card-icon">{modeIcons[mode.id] || <Sparkles size={20} />}</span>
                    <h4>{mode.title}</h4>
                  </div>
                  {mode.premium ? (
                    <span className="badge-premium-futuristic">
                      {isPremium ? <BadgeCheck size={14} /> : <Lock size={14} />}
                      Premium
                    </span>
                  ) : (
                    <span className="badge-free-futuristic">Gratis</span>
                  )}
                </div>
                <p>{mode.description}</p>
                {isDisabled && (
                  <div className="mode-locked-overlay" aria-hidden="true">
                    <Lock size={18} />
                    <span>Khusus Premium</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  return (
    <div className="mode-selector-container-futuristic animate__animated animate__fadeIn">
      <div className="welcome-stack">
        <h2 className="welcome-text-futuristic animate__animated animate__fadeInDown">
          Selamat datang di AkuBantu!
        </h2>
        <p className="welcome-subtitle-futuristic animate__animated animate__fadeInUp">
          Pilih modul Student Development terbaik dan mulai bertumbuh bersama AI.
        </p>
      </div>

      {fieldTabs}
      {renderModesForSelectedField()}

      {!isPremium && (
        <div className="global-premium-notice-futuristic">
          <p>
            Tingkatkan potensi Anda! Upgrade ke <strong>Premium</strong> untuk membuka seluruh modul eksklusif.
          </p>
          <a
            href="https://wa.me/6282211929271"
            target="_blank"
            rel="noopener noreferrer"
            className="upgrade-btn-futuristic"
          >
            <Crown size={16} /> Upgrade Sekarang
          </a>
        </div>
      )}
    </div>
  );
};

export default ModeSelector;
