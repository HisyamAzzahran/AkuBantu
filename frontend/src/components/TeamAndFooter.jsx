import React from 'react';
import { Linkedin, Instagram } from 'lucide-react';
import samImage from './assets/sam.png';
// Data untuk tim, Anda bisa mengganti nama, jabatan, dan link IG di sini
const teamMembers = [
  {
    name: 'Hisyam Az-Zahran',
    title: 'Project Manager',
    ig: 'https://www.instagram.com/mhmdhisyaam/',
    imageUrl: samImage 
  },
  {
    name: 'Jepri',
    title: 'Frontend Dev',
    ig: '#',
    imageUrl: ''
  },
  {
    name: 'Evan',
    title: 'Backend Dev',
    ig: '#',
    imageUrl: ''
  },
  {
    name: 'Jeremi',
    title: 'Frontend Dev',
    ig: '#',
    imageUrl: ''
  },
  {
    name: 'Dzul',
    title: 'AI Engineer',
    ig: '#',
    imageUrl: ''
  }
];

const TeamAndFooter = () => {
  return (
    <>
      {/* ===== BAGIAN TIM KAMI ===== */}
      <div className="team-section-futuristic">
        <h2 className="section-heading-futuristic">Meet The Team</h2>
        <div className="team-grid-futuristic">
          {teamMembers.map((member, index) => (
            <div key={index} className="team-member-card-futuristic">
              <div className="team-member-photo-wrapper">
                {member.imageUrl ? (
                  <img src={member.imageUrl} alt={member.name} />
                ) : (
                  <div className="team-member-placeholder">
                    {member.name?.charAt(0) || '?'}
                  </div>
                )}
              </div>
              <h4 className="team-member-name">{member.name}</h4>
              <p className="team-member-title">{member.title}</p>
              <a href={member.ig} target="_blank" rel="noopener noreferrer" className="team-member-ig">
                <Instagram size={18} />
                <span>Instagram</span>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ===== BAGIAN FOOTER ===== */}
      <footer className="footer-futuristic">
        <div className="footer-content-futuristic">
          <div className="footer-about">
            <h4>Tentang AkuBantu</h4>
            <p>
              AkuBantu adalah platform pengembangan diri mahasiswa berbasis AI yang dikembangkan oleh ElevatEd Indonesia. Kami membantu mahasiswa memetakan potensi, merancang strategi belajar, dan menyiapkan karier masa depan mereka dengan pendampingan yang personal dan berkelanjutan.
            </p>
          </div>
          <div className="footer-social">
            <h4>Terhubung Dengan Kami</h4>
            <div className="social-links">
              <a href="https://www.instagram.com/elevated.indonesia/" target="_blank" rel="noopener noreferrer">
                <Instagram size={20} />
                <span>@elevated.indonesia</span>
              </a>
              <a href="https://www.linkedin.com/company/elevated-idn/" target="_blank" rel="noopener noreferrer">
                <Linkedin size={20} />
                <span>AkuBantu (ElevatEd Indonesia)</span>
              </a>
            </div>
          </div>
        </div>
        <div className="footer-copyright">
          <p>&copy; {new Date().getFullYear()} AkuBantu. All Rights Reserved.</p>
        </div>
      </footer>
    </>
  );
};

export default TeamAndFooter;
