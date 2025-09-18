import React, { useState, useEffect } from 'react';

const CustomCursor = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);

    useEffect(() => {
        // Fungsi untuk memperbarui posisi kursor
        const onMouseMove = (e) => {
            setPosition({ x: e.clientX, y: e.clientY });
        };

        // Fungsi untuk mendeteksi saat kursor berada di atas elemen interaktif
        const onMouseOver = (e) => {
            // Cek apakah target adalah link, button, atau elemen dengan peran button
            if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('[role="button"]')) {
                setIsHovering(true);
            }
        };

        // Fungsi untuk mendeteksi saat kursor meninggalkan elemen interaktif
        const onMouseOut = (e) => {
            if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('[role="button"]')) {
                setIsHovering(false);
            }
        };

        // Menambahkan event listener ke dokumen
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseover', onMouseOver);
        document.addEventListener('mouseout', onMouseOut);

        // Membersihkan event listener saat komponen dilepas
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseover', onMouseOver);
            document.removeEventListener('mouseout', onMouseOut);
        };
    }, []);

    // Menambahkan kelas 'hover' jika kursor berada di atas elemen interaktif
    const ringClasses = `custom-cursor-ring ${isHovering ? 'hover' : ''}`;

    return (
        <>
            {/* Elemen untuk titik tengah kursor */}
            <div 
                className="custom-cursor-dot" 
                style={{ left: `${position.x}px`, top: `${position.y}px` }}
            ></div>
            {/* Elemen untuk cincin luar kursor */}
            <div 
                className={ringClasses}
                style={{ left: `${position.x}px`, top: `${position.y}px` }}
            ></div>
        </>
    );
};

export default CustomCursor;
