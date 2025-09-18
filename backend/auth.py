# auth.py
import sqlite3
import bcrypt
import os
from datetime import datetime, timedelta, timezone
import random

DB_NAME = "webai.db"

# ... (fungsi init_db() dan login_user() Anda yang sudah ada dan diperbaiki) ...
def init_db():
    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                is_premium INTEGER DEFAULT 0,
                is_admin INTEGER DEFAULT 0,
                tokens INTEGER DEFAULT 0
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS otp_codes (
                email TEXT PRIMARY KEY,
                otp_code TEXT NOT NULL,
                username_temp TEXT NOT NULL,
                password_hash_temp TEXT NOT NULL, 
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        print(f"Database '{DB_NAME}' dan tabel-tabel (users, otp_codes) berhasil diinisialisasi/dicek.")
    except sqlite3.Error as e:
        print(f"[DB Error in init_db] {str(e)}")
    finally:
        if conn:
            conn.close()

def login_user(email, password_input):
    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT username, email, password, is_premium, is_admin, tokens FROM users WHERE email = ?", (email,))
        user_record = cursor.fetchone()

        if user_record:
            hashed_password_from_db = user_record[2] 
            password_input_bytes = password_input.encode('utf-8')
            hashed_password_for_check_bytes = None

            if isinstance(hashed_password_from_db, str):
                hashed_password_for_check_bytes = hashed_password_from_db.encode('utf-8')
            elif isinstance(hashed_password_from_db, bytes):
                hashed_password_for_check_bytes = hashed_password_from_db
            else:
                print(f"[Login Attempt] Format password tidak dikenal dari DB untuk email: {email}")
                return None 

            if bcrypt.checkpw(password_input_bytes, hashed_password_for_check_bytes):
                return {
                    "username": user_record[0], "email": user_record[1],
                    "is_premium": bool(user_record[3]), "is_admin": bool(user_record[4]),
                    "tokens": user_record[5]
                }
            else:
                print(f"[Login Attempt] Password salah untuk email: {email}")
                return None
        else:
            print(f"[Login Attempt] User tidak ditemukan: {email}")
            return None
    except sqlite3.Error as e:
        print(f"[DB Error in login_user] {str(e)}")
        return None
    except Exception as e:
        print(f"[Unexpected Error in login_user] {str(e)}")
        return None
    finally:
        if conn:
            conn.close()

# --- FUNGSI BARU UNTUK VERIFIKASI OTP DAN REGISTRASI FINAL ---
def verify_otp_and_register_user(email, otp_input):
    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # 1. Ambil data OTP dan data sementara dari tabel otp_codes
        cursor.execute("SELECT otp_code, username_temp, password_hash_temp, expires_at FROM otp_codes WHERE email = ?", (email,))
        otp_record = cursor.fetchone()

        if not otp_record:
            return False, "OTP tidak ditemukan atau sesi registrasi tidak valid. Silakan minta OTP baru."

        stored_otp, username_temp, password_hash_temp, expires_at_str = otp_record
        expires_at = datetime.fromisoformat(expires_at_str) # Konversi string ISO ke datetime

        # 2. Cek apakah OTP sudah kadaluwarsa
        if datetime.now(timezone.utc) > expires_at:
            cursor.execute("DELETE FROM otp_codes WHERE email = ?", (email,)) # Hapus OTP kadaluwarsa
            conn.commit()
            return False, "Kode OTP sudah kadaluwarsa. Silakan minta OTP baru."
        
        # 3. Cek apakah OTP yang dimasukkan cocok
        if stored_otp != otp_input:
            # Di sini Anda bisa menambahkan logika untuk mengurangi percobaan OTP jika mau
            return False, "Kode OTP salah. Periksa kembali kode Anda."

        # 4. OTP valid, lanjutkan membuat user di tabel 'users'
        # Cek sekali lagi untuk jaga-jaga jika email/username terdaftar saat proses OTP berjalan
        cursor.execute("SELECT email FROM users WHERE email = ? OR username = ?", (email, username_temp))
        if cursor.fetchone():
            # Hapus OTP karena sudah divalidasi (meskipun gagal karena duplikat)
            cursor.execute("DELETE FROM otp_codes WHERE email = ?", (email,))
            conn.commit()
            return False, "Email atau Username sudah terdaftar setelah proses OTP. Silakan login."

        # Masukkan ke tabel users
        # Default token, is_premium, is_admin bisa disesuaikan
        cursor.execute("INSERT INTO users (username, email, password, tokens, is_premium, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
                       (username_temp, email, password_hash_temp, 3, 0, 0))
        
        # 5. Hapus OTP yang sudah berhasil digunakan dari tabel otp_codes
        cursor.execute("DELETE FROM otp_codes WHERE email = ?", (email,))
        conn.commit()
        
        print(f"User {username_temp} ({email}) berhasil diregistrasi setelah verifikasi OTP.")
        return True, "Registrasi berhasil! Silakan login dengan akun baru Anda."

    except sqlite3.Error as e:
        if conn: conn.rollback()
        print(f"[DB Error in verify_otp_and_register_user] {str(e)}")
        return False, "Terjadi kesalahan pada database saat verifikasi OTP."
    except Exception as e:
        print(f"[Unexpected Error in verify_otp_and_register_user] {str(e)}")
        return False, "Terjadi kesalahan internal saat verifikasi OTP."
    finally:
        if conn:
            conn.close()