import React from 'react';
import { Linkedin, Instagram } from 'lucide-react';
import fahmiImage from './assets/fahmi.JPG'; 
import nanaImage from './assets/nana.jpeg';
import ginanImage from './assets/ginan.jpeg';
import samImage from './assets/sam.png';
// Data untuk tim, Anda bisa mengganti nama, jabatan, dan link IG di sini
const teamMembers = [
  {
    name: 'Fahmi Nur Alim',
    title: 'Founder & CEO',
    ig: 'https://www.instagram.com/fahminur.a/',
    // Ganti dengan URL gambar asli jika ada
    imageUrl: fahmiImage 
  },
  {
    name: 'Ginanjar Pamungkas',
    title: 'Co-Founder & COO',
    ig: 'https://www.instagram.com/ginan.ph/',
    imageUrl: ginanImage
  },
  {
    name: 'Hisyam Az-Zahran',
    title: 'Co-Founder & CPO',
    ig: 'https://www.instagram.com/mhmdhisyaam/',
    imageUrl: samImage 
  },
  {
    name: 'Najwa Nur Awalia',
    title: 'Co-Founder & CMO',
    ig: 'https://www.instagram.com/najwa.nurawalia/',
    imageUrl: nanaImage
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
                <img src={member.imageUrl} alt={member.name} />
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
