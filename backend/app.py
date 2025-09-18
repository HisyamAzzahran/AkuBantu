from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv
from threading import Timer
from openai import OpenAI
import sqlite3
import os
import bcrypt
import base64
import json
import time
import fitz  
from docx import Document 
import re
import uuid
from werkzeug.utils import secure_filename
import random
from datetime import datetime, timedelta, timezone 
from flask_mail import Mail, Message
import json
import uuid
import time
import midtransclient
from itsdangerous import URLSafeTimedSerializer
from datetime import timedelta

from auth import init_db as auth_init_db, login_user, verify_otp_and_register_user
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) 

# --- Konfigurasi Aplikasi ---
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///webai.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.googlemail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME') # Email Anda dari .env
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD_APP') # App Password dari .env
app.config['MAIL_DEFAULT_SENDER'] = (
    os.environ.get('MAIL_DEFAULT_SENDER_NAME', 'AkuBantu'),
    os.environ.get('MAIL_USERNAME') # Harus sama dengan MAIL_USERNAME untuk Gmail
)
mail = Mail(app)

# --- KONFIGURASI MIDTRANS CLIENT ---
MIDTRANS_SERVER_KEY_CONFIG = os.environ.get('MIDTRANS_SERVER_KEY')
MIDTRANS_CLIENT_KEY_CONFIG = os.environ.get('MIDTRANS_CLIENT_KEY')
MIDTRANS_IS_PRODUCTION_CONFIG = os.environ.get('MIDTRANS_IS_PRODUCTION', 'True').lower() == 'true'

if not MIDTRANS_SERVER_KEY_CONFIG or not MIDTRANS_CLIENT_KEY_CONFIG:
    print("PERINGATAN PENTING: MIDTRANS_SERVER_KEY atau MIDTRANS_CLIENT_KEY tidak ditemukan di variabel lingkungan.")
    # Di produksi, Anda mungkin ingin menghentikan aplikasi jika key penting ini tidak ada.
    # Contoh: raise ValueError("MIDTRANS Keys tidak terkonfigurasi!")

# Inisialisasi Snap client dari Midtrans
# Pastikan ini hanya dieksekusi sekali saat aplikasi dimulai
try:
    snap = midtransclient.Snap(
        is_production=MIDTRANS_IS_PRODUCTION_CONFIG,
        server_key=MIDTRANS_SERVER_KEY_CONFIG,
        client_key=MIDTRANS_CLIENT_KEY_CONFIG # Client key juga dibutuhkan di sini
    )
    print(f"Midtrans Client berhasil diinisialisasi. Mode Produksi: {MIDTRANS_IS_PRODUCTION_CONFIG}")
except Exception as e:
    print(f"GAGAL inisialisasi Midtrans Client: {e}")
    snap = None # Set ke None jika gagal agar bisa dicek nanti

DB_NAME = "webai.db"

# Konstanta Biaya Token
TOKEN_COST_STUDENT_GOALS = 3
TOKEN_COST_ACTIVITY_TRACKER = 1
TOKEN_COST_SWOT = 1
TOKEN_COST_IKIGAI = 5
# Folder Uploads
UPLOADS_FOLDER_GOALS = os.path.join(app.root_path, 'uploads', 'student_goals_files')
if not os.path.exists(UPLOADS_FOLDER_GOALS):
    os.makedirs(UPLOADS_FOLDER_GOALS, exist_ok=True)

# Init SQLAlchemy
db = SQLAlchemy(app)

# Init OpenAI Client
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("PERINGATAN: OPENAI_API_KEY tidak ditemukan di variabel lingkungan.")
client = OpenAI(api_key=OPENAI_API_KEY)

# Google Client ID
GOOGLE_CLIENT_ID_SERVER = os.environ.get("GOOGLE_CLIENT_ID")
if not GOOGLE_CLIENT_ID_SERVER:
    print("PERINGATAN: GOOGLE_CLIENT_ID tidak ditemukan di variabel lingkungan.")

# --- Model Database SQLAlchemy ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    username = db.Column(db.String(120), nullable=False)
    password = db.Column(db.String(255), nullable=False)
    tokens = db.Column(db.Integer, default=10)
    is_premium = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False) 
    reset_token = db.Column(db.String(255), nullable=True)
    reset_token_expiration = db.Column(db.DateTime, nullable=True)

class FeatureLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False)
    feature = db.Column(db.String(100), nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

# Buat tabel SQLAlchemy dan panggil init_db dari auth.py
with app.app_context():
    db.create_all()
    auth_init_db() # Ini akan membuat tabel users (lagi, tapi aman dg IF NOT EXISTS) dan otp_codes

# Pembuatan tabel manual lainnya (jika tidak semua ada di auth_init_db)
conn_startup_manual = None
try:
    conn_startup_manual = sqlite3.connect(DB_NAME)
    cursor_startup_manual = conn_startup_manual.cursor()

    # --- Tabel-tabel yang sudah ada ---
    cursor_startup_manual.execute("""
    CREATE TABLE IF NOT EXISTS track_ikigai (
        id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, nama TEXT NOT NULL,
        mbti TEXT NOT NULL, via TEXT NOT NULL, career TEXT NOT NULL,
        ikigai_spot TEXT NOT NULL, slice_purpose TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")
    
    cursor_startup_manual.execute("""
    CREATE TABLE IF NOT EXISTS track_swot (
        id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, nama TEXT NOT NULL,
        mbti TEXT NOT NULL, via1 TEXT NOT NULL, via2 TEXT NOT NULL, via3 TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    
    cursor_startup_manual.execute('''
        CREATE TABLE IF NOT EXISTS track_swot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            nama TEXT NOT NULL,
            mbti TEXT,
            via1 TEXT,
            via2 TEXT,
            via3 TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor_startup_manual.execute("""
    CREATE TABLE IF NOT EXISTS student_goals_plans (
        id TEXT PRIMARY KEY, user_email TEXT NOT NULL, nama_input TEXT NOT NULL,
        jurusan_input TEXT NOT NULL, semester_input_awal INTEGER NOT NULL,
        mode_action_input TEXT NOT NULL, swot_file_ref TEXT, ikigai_file_ref TEXT,
        target_semester_plan INTEGER NOT NULL, plan_content TEXT NOT NULL,
        is_initial_data_source INTEGER DEFAULT 0, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users(email)
    )""")

    cursor_startup_manual.execute("""
    CREATE TABLE IF NOT EXISTS app_orders (
        order_id TEXT PRIMARY KEY, user_email TEXT NOT NULL, item_id TEXT NOT NULL,
        item_name TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, amount INTEGER NOT NULL,
        status TEXT NOT NULL, snap_token TEXT, midtrans_transaction_id TEXT,
        payment_type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users(email)
    )""")
    
    # --- PENAMBAHAN TABEL BARU ---
    # Tabel untuk fitur Student Daily Activity
    cursor_startup_manual.execute("""
    CREATE TABLE IF NOT EXISTS daily_activities (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        week_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        start_datetime TEXT NOT NULL,
        end_datetime TEXT NOT NULL,
        is_allday INTEGER DEFAULT 0,
        description TEXT,
        location TEXT,
        is_private INTEGER DEFAULT 1,
        is_completed INTEGER DEFAULT 0,
        points_awarded INTEGER DEFAULT 10,
        source_planner_pdf TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_email) REFERENCES users(email)
    )""")
    
    # Menambahkan kolom 'points' ke tabel 'users' jika belum ada
    cursor_startup_manual.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor_startup_manual.fetchall()]
    if 'points' not in columns:
        cursor_startup_manual.execute("ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0")
        print("Kolom 'points' berhasil ditambahkan ke tabel 'users'.")

    # Tambah kolom premium_expires_at & permanent_premium jika belum ada
    cursor_startup_manual.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor_startup_manual.fetchall()]
    if 'premium_expires_at' not in columns:
        cursor_startup_manual.execute("ALTER TABLE users ADD COLUMN premium_expires_at TEXT")
        print("Kolom 'premium_expires_at' ditambahkan ke tabel 'users'.")
    if 'permanent_premium' not in columns:
        cursor_startup_manual.execute("ALTER TABLE users ADD COLUMN permanent_premium INTEGER DEFAULT 0")
        print("Kolom 'permanent_premium' ditambahkan ke tabel 'users'.")

    conn_startup_manual.commit()
    
    # --- PERBAIKAN PESAN LOG ---
    # Pesan log sekarang lebih umum dan mencakup semua tabel
    print("Semua tabel manual (ikigai, swot, goals, orders, activities, dll.) berhasil dicek/dibuat.")

except sqlite3.Error as e:
    print(f"Error saat membuat tabel manual saat startup: {e}")
finally:
    if conn_startup_manual:
        conn_startup_manual.close()

# --- Fungsi Helper ---
static_folder = os.path.join(app.root_path, "static") # Definisikan path static folder
if not os.path.exists(static_folder):
    os.makedirs(static_folder)

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    print("PERINGATAN: SECRET_KEY tidak ditemukan di variabel lingkungan. Ini penting untuk keamanan reset password.")
    SECRET_KEY = 'your_secret_key_here' # Ganti dengan secret key yang kuat di produksi
app.config['SECRET_KEY'] = SECRET_KEY
serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])

PRODUCT_CATALOG = {
    "PREMIUM_1MO": {"name": "Langganan Premium AkuBantu - 1 Bulan", "price": 39000, "type": "premium", "duration_days": 30, "token_amount": 0},
    "PREMIUM_1YR": {"name": "Langganan Premium AkuBantu - 1 Tahun", "price": 399000, "type": "premium", "duration_days": 365, "token_amount": 0},
    "TOKEN_PAKET_5": {"name": "Paket 5 Token AkuBantu", "price": 7495, "type": "token", "token_amount": 5},
    "TOKEN_PAKET_10": {"name": "Paket 10 Token AkuBantu", "price": 9999, "type": "token", "token_amount": 10},
    "TOKEN_CUSTOM": {"name_template": "{amount} Token Kustom AkuBantu", "price_per_token": 1499, "type": "token", "min_amount": 5} # token_amount akan dihitung
}


def delete_file_later(path, delay=60): # Delay diperpanjang sedikit
    def delete():
        try:
            if os.path.exists(path):
                os.remove(path)
                print(f"[Auto Delete] File {path} telah dihapus.")
        except Exception as e:
            print(f"[Auto Delete Error] Gagal menghapus {path}: {str(e)}")
    Timer(delay, delete).start()
def send_password_reset_email(user_email, reset_url):
    subject = "AkuBantu - Permintaan Reset Password Anda"
    html_body = f"""
    <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
            <h2 style="color: #0056b3; text-align: center;">AkuBantu - Reset Password</h2>
            <p>Halo,</p>
            <p>Anda menerima email ini karena ada permintaan untuk mereset password akun AkuBantu Anda.</p>
            <p>Silakan klik link berikut untuk mengatur ulang password Anda:</p>
            <p style="text-align: center; margin: 25px 0;"><a href="{reset_url}" style="display: inline-block; padding: 10px 20px; font-size: 16px; text-align: center; text-decoration: none; border-radius: 5px; background-color: #007bff; color: white;">Reset Password</a></p>
            <p>Link ini akan kedaluwarsa dalam 60 menit.</p>
            <p>Jika Anda tidak meminta reset password ini, Anda dapat mengabaikan email ini dengan aman. Password Anda tidak akan diubah.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="text-align: center; font-size: 0.8em; color: #777;">Salam hangat,<br>Tim AkuBantu</p>
        </div>
    </body></html>"""
    app.logger.info(f"Mencoba mengirim email reset password ke: {user_email}") # Tambahkan log ini
    app.logger.info(f"URL Reset Password yang dibuat: {reset_url}") # Tambahkan log ini
    return send_email_actual(user_email, subject, html_body)

def validate_and_save_activities(cursor, email, week_number, generated_activities, planner_pdf_path=None):
    """Fungsi helper untuk memvalidasi dan menyimpan aktivitas."""
    activities_for_frontend = []
    current_timestamp = datetime.now(timezone.utc).isoformat()
    
    for activity_data in generated_activities:
        if not all(k in activity_data for k in ['title', 'start_datetime', 'end_datetime']) or not activity_data.get('title'):
            print(f"Skipping invalid activity from AI (missing required fields): {activity_data}")
            continue

        activity_id = str(uuid.uuid4())
        cursor.execute("""
            INSERT INTO daily_activities (id, user_email, week_number, title, start_datetime, end_datetime, is_allday, 
            description, location, is_private, is_completed, timestamp, source_planner_pdf)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            activity_id, email, week_number, activity_data.get('title'), activity_data.get('start_datetime'),
            activity_data.get('end_datetime'), activity_data.get('is_allday', False),
            activity_data.get('description'), activity_data.get('location'),
            activity_data.get('is_private', True), False, current_timestamp, planner_pdf_path
        ))
        activity_data['id'] = activity_id
        activity_data['is_completed'] = False
        activity_data['week_number'] = week_number
        activities_for_frontend.append(activity_data)
        
    return activities_for_frontend

def send_email_actual(recipient_email, subject, html_body):
    global mail # Pastikan mail bisa diakses
    try:
        msg = Message(subject, recipients=[recipient_email], html=html_body)
        app.logger.info(f"Mencoba mengirim email dengan subjek: {subject} ke: {recipient_email}") # Tambahkan log ini
        mail.send(msg)
        print(f"Email berhasil dikirim ke {recipient_email} dengan subjek '{subject[:30]}...'")
        return True
    except Exception as e:
        print(f"GAGAL KIRIM EMAIL ke {recipient_email}: {str(e)}")
        app.logger.error(f"Failed to send email to {recipient_email}: {e}", exc_info=True) # Tambahkan exc_info=True untuk melihat detail error
        return False

def censor_email(email):
    """Fungsi untuk menyensor email, misal: user@gmail.com -> u***@gmail.com"""
    try:
        local_part, domain = email.split('@')
        if len(local_part) > 1:
            return f"{local_part[0]}***@{domain}"
        else:
            return f"*@{domain}"
    except:
        return "***@***.***" #

def generate_openai_response(prompt, model="o3"): # Default model diubah ke gpt-03
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=1
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        app.logger.error(f"OpenAI API Error for prompt '{prompt[:50]}...': {str(e)}")
        raise Exception(f"Gagal menghubungi layanan AI: {str(e)}") # Re-raise untuk ditangkap oleh route

def send_email_otp_actual(recipient_email, otp_code, username_to_greet):
    global mail # Pastikan mail bisa diakses
    try:
        subject = f"Kode Verifikasi AkuBantu untuk {username_to_greet}"
        html_body = f"""
        <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; background-color: #f9f9f9;">
                <h2 style="color: #0056b3; text-align: center;">AkuBantu - Verifikasi Akun Anda</h2>
                <p>Halo <strong>{username_to_greet}</strong>,</p>
                <p>Terima kasih telah mendaftar di AkuBantu!</p>
                <p>Gunakan kode OTP berikut untuk menyelesaikan proses registrasi Anda:</p>
                <p style="font-size: 28px; font-weight: bold; color: #007bff; text-align: center; background-color: #e7f3ff; padding: 10px; border-radius: 5px; letter-spacing: 3px; margin: 25px 0;">{otp_code}</p>
                <p>Kode ini berlaku selama <strong>10 menit</strong>.</p>
                <p style="font-size: 0.9em; color: #555;">Demi keamanan Anda, jangan berikan kode ini kepada siapapun. Jika Anda tidak merasa melakukan permintaan ini, mohon abaikan email ini.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="text-align: center; font-size: 0.8em; color: #777;">Salam hangat,<br>Tim AkuBantu</p>
            </div>
        </body></html>"""
        msg = Message(subject, recipients=[recipient_email], html=html_body)
        mail.send(msg)
        print(f"Email OTP {otp_code} berhasil dikirim ke {recipient_email}")
        return True
    except Exception as e:
        print(f"GAGAL KIRIM EMAIL OTP ke {recipient_email}: {str(e)}")
        app.logger.error(f"Failed to send OTP email to {recipient_email}: {e}")
        return False

# --- Routes Aplikasi ---
@app.route('/daily-activity/reset-all', methods=['DELETE'])
def reset_all_activities():
    email = request.args.get('email')
    if not email:
        return jsonify({"error": "Email pengguna wajib diisi untuk reset."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # --- PERBAIKAN LOGIKA ---
        # HANYA menghapus aktivitas harian untuk pengguna ini.
        # TIDAK ADA LAGI LOGIKA PENGURANGAN ATAU RESET POIN.
        cursor.execute("DELETE FROM daily_activities WHERE user_email = ?", (email,))
        deleted_rows = cursor.rowcount
        
        conn.commit()
        
        print(f"Reset jadwal untuk {email}. {deleted_rows} aktivitas berhasil dihapus. Poin pengguna tidak diubah.")
        return jsonify({"message": "Semua jadwal berhasil direset!"})

    except Exception as e:
        if conn: conn.rollback()
        print(f"❌ ERROR /daily-activity/reset-all: {str(e)}")
        return jsonify({"error": "Gagal mereset data."}), 500
    finally:
        if conn:
            conn.close()
            
@app.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Ambil top 10 pengguna berdasarkan poin tertinggi
        cursor.execute("""
            SELECT username, email, points 
            FROM users 
            ORDER BY points DESC 
            LIMIT 10
        """)
        
        top_users = cursor.fetchall()

        leaderboard_data = []
        for rank, user_row in enumerate(top_users, 1):
            leaderboard_data.append({
                "rank": rank,
                "username": user_row['username'],
                "email": censor_email(user_row['email']),
                "points": user_row['points']
            })

        return jsonify(leaderboard_data)

    except Exception as e:
        print(f"❌ ERROR /leaderboard: {str(e)}")
        return jsonify({"error": "Gagal memuat papan peringkat."}), 500
    finally:
        if conn:
            conn.close()
            
@app.route('/daily-activity/generate-first-week', methods=['POST'])
def generate_first_week_activity():
    if 'planner_pdf' not in request.files: return jsonify({"error": "File PDF tidak ditemukan."}), 400
    pdf_file = request.files['planner_pdf']
    email = request.form.get('email')
    if not email: return jsonify({"error": "Email pengguna wajib diisi."}), 400

    planner_filename = secure_filename(f"{uuid.uuid4().hex}_{pdf_file.filename}")
    planner_pdf_path = os.path.join(UPLOADS_FOLDER_GOALS, planner_filename) 
    pdf_file.save(planner_pdf_path)
    pdf_file.seek(0)

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        cursor.execute("SELECT is_premium, tokens FROM users WHERE email = ?", (email,))
        user_data = cursor.fetchone()
        if not user_data: return jsonify({"error": "User tidak ditemukan."}), 404
        is_premium_user, current_tokens = user_data
        if not is_premium_user: return jsonify({"error": "Fitur ini hanya untuk pengguna Premium."}), 403
        if current_tokens < TOKEN_COST_ACTIVITY_TRACKER: return jsonify({"error": f"Token tidak cukup."}), 403
        
        pdf_content = ""
        with fitz.open(stream=pdf_file.read(), filetype="pdf") as doc:
            for page in doc: pdf_content += page.get_text()
        if not pdf_content.strip(): return jsonify({"error": "Gagal membaca konten dari file PDF."}), 400

        prompt = f"""
        Anda adalah seorang accountability coach yang mengubah rencana besar menjadi jadwal mingguan.
        Tugas Anda adalah membaca "Student Goals Planning" di bawah ini, dan membuat jadwal konkret untuk MINGGU PERTAMA.
        
        --- RENCANA STUDI LENGKAP DARI PDF ---
        {pdf_content}
        --- AKHIR RENCANA STUDI ---

        Instruksi:
        1.  Ekstrak Misi: Identifikasi "Main Mission" dan "Side Mission" dari teks di atas.
        2.  Jadwalkan untuk Minggu 1: Buat 3-5 aktivitas paling penting untuk MINGGU PERTAMA berdasarkan misi yang Anda ekstrak. Aktivitas harus berupa langkah nyata, contoh: "Mencari 5 jurnal untuk Main Mission 1", bukan "Menyelesaikan Main Mission 1".
        3.  Detail Logis: Tentukan tanggal dan waktu yang realistis untuk setiap aktivitas. Asumsikan hari ini adalah awal minggu.
        4.  Buatkan aktifitasnya balance anatar kegiatan kuliah dan luar kuliah seperti leadership, lomba (ini disesuikan dengan pdfnya).
        5.  Format JSON WAJIB: Output HARUS berupa objek JSON dengan satu kunci "activities". Setiap item dalam array harus memiliki kunci: "title", "start_datetime", "end_datetime", "is_allday", "description", "location", "is_private". Pastikan "title" tidak pernah kosong.
        """

        response = client.chat.completions.create(model="gpt-4o", response_format={"type": "json_object"}, messages=[{"role": "user", "content": prompt}], temperature=0.7)
        ai_result = json.loads(response.choices[0].message.content)
        generated_activities = ai_result.get("activities", [])
        
        activities_for_frontend = validate_and_save_activities(cursor, email, 1, generated_activities, planner_pdf_path)

        if not activities_for_frontend: return jsonify({"error": "AI tidak menghasilkan jadwal yang valid. Coba lagi."}), 500

        new_token_balance = current_tokens - TOKEN_COST_ACTIVITY_TRACKER
        cursor.execute("UPDATE users SET tokens = ? WHERE email = ?", (new_token_balance, email))
        conn.commit()

        return jsonify({ "message": "Jadwal berhasil dibuat!", "points": 0, "plan": { "week": 1, "activities": activities_for_frontend }})
    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": f"Terjadi kesalahan pada server: {str(e)}"}), 500
    finally:
        if conn: conn.close()

# ==============================================================================
# ENDPOINT: Generate Jadwal Minggu Berikutnya
# ==============================================================================
@app.route('/daily-activity/generate-next-week', methods=['POST'])
def generate_next_week_activity():
    email = request.json.get('email')
    if not email: return jsonify({"error": "Email pengguna wajib diisi."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT is_premium, tokens FROM users WHERE email = ?", (email,))
        user_data = cursor.fetchone()
        if not user_data: return jsonify({"error": "User tidak ditemukan."}), 404
        is_premium_user, current_tokens = user_data
        if not is_premium_user: return jsonify({"error": "Fitur ini hanya untuk pengguna Premium."}), 403
        if current_tokens < TOKEN_COST_ACTIVITY_TRACKER: return jsonify({"error": "Token tidak cukup."}), 403

        cursor.execute("SELECT MAX(week_number) as last_week, source_planner_pdf FROM daily_activities WHERE user_email = ?", (email,))
        last_plan_info = cursor.fetchone()
        if not last_plan_info or not last_plan_info['source_planner_pdf']:
            return jsonify({"error": "Tidak ditemukan data rencana awal untuk melanjutkan."}), 404

        last_week_number = last_plan_info['last_week']
        next_week_number = last_week_number + 1
        planner_pdf_path = last_plan_info['source_planner_pdf']

        with open(planner_pdf_path, "rb") as f:
            pdf_content = ""
            with fitz.open(stream=f.read(), filetype="pdf") as doc:
                for page in doc: pdf_content += page.get_text()

        cursor.execute("SELECT title FROM daily_activities WHERE user_email = ?", (email,))
        all_past_activities = "\n".join([f"- {row['title']}" for row in cursor.fetchall()])

        # --- PERBAIKAN PROMPT DI SINI ---
        prompt = f"""
        Lanjutkan pembuatan jadwal mingguan untuk mahasiswa berdasarkan konteks berikut.

        [KONTEKS 1: RENCANA STUDI ASLI]
        {pdf_content}

        [KONTEKS 2: RIWAYAT AKTIVITAS YANG SUDAH DIJADWALKAN]
        {all_past_activities}

        [TUGAS ANDA]
        Buatlah jadwal untuk MINGGU {next_week_number}.
        1. Analisis misi yang belum tersentuh di Rencana Studi.
        2. JANGAN ulangi aktivitas yang sudah ada di Riwayat.
        3. Buat 3-5 aktivitas baru yang realistis untuk 5-7 hari ke depan.
        4. Buatkan aktifitasnya balance anatar kegiatan kuliah dan luar kuliah seperti leadership, lomba (ini disesuikan dengan pdfnya).
        
        [ATURAN OUTPUT JSON - SANGAT PENTING!]
        Output HARUS berupa objek JSON valid. Objek ini berisi satu kunci "activities". Setiap item dalam array HARUS memiliki kunci-kunci berikut:
        - "title" (string): Judul aktivitas. TIDAK BOLEH KOSONG.
        - "start_datetime" (string): Waktu mulai dalam format YYYY-MM-DDTHH:MM:SS. Contoh: "2025-07-05T09:00:00". JANGAN gunakan "day" atau "time".
        - "end_datetime" (string): Waktu selesai dalam format YYYY-MM-DDTHH:MM:SS.
        - "is_allday" (boolean): true jika seharian, false jika tidak.
        - "description" (string): Deskripsi singkat.
        - "location" (string): Lokasi aktivitas.
        - "is_private" (boolean): true jika acara pribadi.
        """
        
        response = client.chat.completions.create(model="gpt-4o", response_format={"type": "json_object"}, messages=[{"role": "user", "content": prompt}], temperature=0.7)
        ai_result = json.loads(response.choices[0].message.content)
        generated_activities = ai_result.get("activities", [])

        activities_for_frontend = validate_and_save_activities(cursor, email, next_week_number, generated_activities, planner_pdf_path)

        if not activities_for_frontend:
             return jsonify({"error": "AI tidak menghasilkan jadwal yang valid. Coba lagi."}), 500

        new_token_balance = current_tokens - TOKEN_COST_ACTIVITY_TRACKER
        cursor.execute("UPDATE users SET tokens = ? WHERE email = ?", (new_token_balance, email))
        conn.commit()
        
        return jsonify({ "message": "Jadwal minggu berikutnya berhasil dibuat!", "plan": { "week": next_week_number, "activities": activities_for_frontend }})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": f"Kesalahan server: {str(e)}"}), 500
    finally:
        if conn: conn.close()

# ==============================================================================
# ENDPOINT: Menambah Aktivitas Manual
# ==============================================================================
@app.route('/daily-activity/add-manual', methods=['POST'])
def add_manual_activity():
    data = request.json
    email = data.get('email')
    week_number = data.get('weekNumber')
    title = data.get('title')
    start_datetime = data.get('startDatetime')
    end_datetime = data.get('endDatetime')
    
    if not all([email, week_number, title, start_datetime, end_datetime]):
        return jsonify({"error": "Data aktivitas manual tidak lengkap."}), 400
    
    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        activity_id = str(uuid.uuid4())
        current_timestamp = datetime.now(timezone.utc).isoformat()
        
        cursor.execute("SELECT source_planner_pdf FROM daily_activities WHERE user_email = ? LIMIT 1", (email,))
        pdf_path_row = cursor.fetchone()
        source_pdf = pdf_path_row[0] if pdf_path_row else None

        cursor.execute("""
            INSERT INTO daily_activities (id, user_email, week_number, title, start_datetime, end_datetime, is_allday, 
            description, location, is_private, is_completed, timestamp, source_planner_pdf)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            activity_id, email, week_number, title, start_datetime, end_datetime, 
            data.get('isAllday', False), data.get('description'), data.get('location'), 
            data.get('isPrivate', True), False, current_timestamp, source_pdf
        ))
        conn.commit()
        
        new_activity = {**data, "id": activity_id, "is_completed": False, "week_number": week_number, "start_datetime": start_datetime, "end_datetime": end_datetime}
        return jsonify({"message": "Aktivitas berhasil ditambahkan!", "activity": new_activity}), 201

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": f"Gagal menambah aktivitas: {str(e)}"}), 500
    finally:
        if conn: conn.close()

# ==============================================================================
# ENDPOINT: Memuat Riwayat Jadwal & Poin
# ==============================================================================
@app.route('/daily-activity/history', methods=['GET'])
def get_activity_history():
    email = request.args.get('email')
    if not email: return jsonify({"error": "Email pengguna wajib diisi."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.row_factory = sqlite3.Row 
        cursor = conn.cursor()

        cursor.execute("SELECT points FROM users WHERE email = ?", (email,))
        user_row = cursor.fetchone()
        user_points = user_row['points'] if user_row else 0

        cursor.execute("SELECT * FROM daily_activities WHERE user_email = ? ORDER BY week_number, start_datetime", (email,))
        activities = cursor.fetchall()

        weekly_plans = {}
        for activity in activities:
            week_num = activity['week_number']
            if week_num not in weekly_plans:
                weekly_plans[week_num] = { "week": week_num, "activities": [] }
            weekly_plans[week_num]['activities'].append(dict(activity))
        
        sorted_plans = sorted(weekly_plans.values(), key=lambda x: x['week'])

        return jsonify({ "points": user_points, "plans": sorted_plans })

    except Exception as e:
        return jsonify({"error": "Gagal memuat riwayat."}), 500
    finally:
        if conn: conn.close()

# ==============================================================================
# ENDPOINT: Update status selesai & poin
# ==============================================================================
@app.route('/daily-activity/update', methods=['PUT'])
def update_activity_status():
    data = request.json
    email = data.get('email')
    activity_id = data.get('activityId')
    is_completed = data.get('isCompleted')

    if not all([email, activity_id, isinstance(is_completed, bool)]):
        return jsonify({"error": "Data tidak lengkap."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        cursor.execute("UPDATE daily_activities SET is_completed = ? WHERE id = ? AND user_email = ?", 
                       (is_completed, activity_id, email))
        
        if cursor.rowcount == 0:
            return jsonify({"error": "Aktivitas tidak ditemukan atau bukan milik Anda."}), 404

        cursor.execute("SELECT points_awarded FROM daily_activities WHERE id = ?", (activity_id,))
        points_row = cursor.fetchone()
        points_change = points_row[0] if points_row else 10
        points_modifier = points_change if is_completed else -points_change
        
        cursor.execute("UPDATE users SET points = points + ? WHERE email = ?", (points_modifier, email))
        
        cursor.execute("SELECT points FROM users WHERE email = ?", (email,))
        new_total_points = cursor.fetchone()[0]

        conn.commit()
        return jsonify({"message": "Status diperbarui!", "newPoints": new_total_points})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": "Gagal memperbarui status aktivitas."}), 500
    finally:
        if conn: conn.close()

# ==============================================================================
# ENDPOINT: Hapus aktivitas
# ==============================================================================
@app.route('/daily-activity/delete/<string:activity_id>', methods=['DELETE'])
def delete_activity(activity_id):
    email = request.args.get('email')
    if not email: return jsonify({"error": "Email diperlukan untuk otorisasi."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        cursor.execute("DELETE FROM daily_activities WHERE id = ? AND user_email = ?", (activity_id, email))

        if cursor.rowcount == 0:
            return jsonify({"error": "Aktivitas tidak ditemukan atau Anda tidak berhak menghapusnya."}), 404
        
        conn.commit()
        return jsonify({"message": "Aktivitas berhasil dihapus."})

    except Exception as e:
        if conn: conn.rollback()
        return jsonify({"error": "Gagal menghapus aktivitas."}), 500
    finally:
        if conn: conn.close()
            
@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.json
    email = data.get('email')

    if not email:
        return jsonify({"error": "Email is required."}), 400

    user = User.query.filter_by(email=email).first()
    app.logger.info(f"Mencoba reset password untuk email: {email}, User ditemukan: {user}") # Tambahkan baris ini

    if user:
        token = serializer.dumps(email, salt='reset-password-salt')
        reset_url = f"{request.headers.get('Origin')}/reset-password?token={token}" # Pastikan frontend Anda memiliki rute /reset-password
        send_password_reset_email(user.email, reset_url)
        user.reset_token = token
        user.reset_token_expiration = datetime.now(timezone.utc) + timedelta(minutes=60)
        db.session.commit()
        return jsonify({"message": "Password reset link has been sent to your email address."}), 200
    else:
        # Jangan mengungkap apakah email ada atau tidak untuk alasan keamanan
        return jsonify({"message": "If an account with that email exists, a password reset link has been sent."}), 200

@app.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.json
    token = data.get('token')
    new_password = data.get('newPassword')

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required."}), 400

    try:
        email = serializer.loads(token, salt='reset-password-salt', max_age=3600) # Token berlaku selama 60 menit
    except Exception as e:
        return jsonify({"error": "Invalid or expired reset token."}), 400

    user = User.query.filter_by(email=email, reset_token=token).first()

    if user and user.reset_token_expiration > datetime.now(timezone.utc):
        hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
        user.password = hashed_password
        user.reset_token = None
        user.reset_token_expiration = None
        db.session.commit()
        return jsonify({"message": "Your password has been successfully reset."}), 200
    else:
        return jsonify({"error": "Invalid or expired reset token."}), 400

@app.route("/payment/create-transaction", methods=["POST"])
def create_midtrans_transaction_route():
    if not snap: # Cek apakah Midtrans client berhasil diinisialisasi
        app.logger.error("Midtrans client (snap) tidak terinisialisasi saat /payment/create-transaction.")
        return jsonify({"error": "Layanan pembayaran sedang tidak dapat diakses karena kesalahan konfigurasi server."}), 503

    data = request.json
    # Log hanya bagian penting atau sebagian kecil dari data untuk keamanan dan ukuran log
    app.logger.info(f"Menerima permintaan /payment/create-transaction dari email: {data.get('email')}, item_id: {data.get('item_id')}, custom_qty={data.get('custom_token_quantity')}") 
    
    order_id = None # Inisialisasi order_id di luar try agar bisa diakses di logging error umum
    try:
        email = data.get("email")
        # Ambil username dari data request, jika tidak ada, buat default dari email
        username = data.get("username", email.split('@')[0] if email else "Pengguna AkuBantu")
        item_id_frontend = data.get("item_id") # Frontend mengirimkan ID item yang dipilih
        custom_token_quantity_frontend = data.get("custom_token_quantity") 
        # payment_type_request tidak lagi diambil dari frontend, tapi dari PRODUCT_CATALOG

        # --- Validasi Input Dasar ---
        if not email:
            return jsonify({"error": "Email pengguna wajib diisi."}), 400
        if not item_id_frontend:
            return jsonify({"error": "ID Item (item_id) wajib diisi."}), 400

        # --- Ambil Detail Produk & Hitung Harga dari Katalog Backend ---
        verified_gross_amount = 0
        verified_item_name = ""
        midtrans_item_id = item_id_frontend # ID yang akan dikirim ke Midtrans & disimpan di DB
        item_quantity_for_midtrans = 1 # Untuk Midtrans, paket biasanya kuantitas 1
        tokens_to_be_granted_if_success = 0
        product_type = ""
        product_duration_days = 0 # Untuk premium

        if item_id_frontend == "TOKEN_CUSTOM":
            # Validasi custom_token_quantity_frontend
            if not custom_token_quantity_frontend or not isinstance(custom_token_quantity_frontend, int) or custom_token_quantity_frontend <= 0:
                return jsonify({"error": "Jumlah token kustom (custom_token_quantity) tidak valid."}), 400
            
            custom_product_info = PRODUCT_CATALOG.get("TOKEN_CUSTOM")
            if not custom_product_info or "price_per_token" not in custom_product_info or "name_template" not in custom_product_info:
                app.logger.error(f"Konfigurasi TOKEN_CUSTOM tidak lengkap dalam PRODUCT_CATALOG untuk user: {email}")
                return jsonify({"error": "Kesalahan konfigurasi produk token kustom di server."}), 500

            price_per_token = custom_product_info["price_per_token"]
            verified_gross_amount = price_per_token * custom_token_quantity_frontend
            verified_item_name = custom_product_info["name_template"].format(amount=custom_token_quantity_frontend)
            tokens_to_be_granted_if_success = custom_token_quantity_frontend
            product_type = custom_product_info["type"]
        
        elif item_id_frontend in PRODUCT_CATALOG:
            product_info = PRODUCT_CATALOG[item_id_frontend]
            verified_gross_amount = product_info["price"]
            verified_item_name = product_info["name"]
            tokens_to_be_granted_if_success = product_info.get("token_amount", 0)
            product_type = product_info["type"]
            product_duration_days = product_info.get("duration_days", 0) # Ambil durasi jika ada
        else:
            app.logger.warning(f"Permintaan pembayaran untuk item_id tidak dikenal: {item_id_frontend} dari {email}")
            return jsonify({"error": "Produk tidak valid atau tidak ditemukan."}), 400

        if verified_gross_amount <= 0: # Harga harus positif
            app.logger.warning(f"Jumlah total pembayaran tidak valid ({verified_gross_amount}) untuk item {item_id_frontend} dari {email}")
            return jsonify({"error": "Jumlah total pembayaran tidak valid."}), 400

        # --- Persiapan Data Transaksi ---
        order_id = f"ELEVAAI-{product_type.upper()}-{int(time.time())}-{str(uuid.uuid4().hex[:6].upper())}"
        current_time_iso = datetime.now(timezone.utc).isoformat()

        # Detail item yang akan disimpan di database dan dikirim ke Midtrans
        # Untuk Midtrans, item_details adalah array, meskipun kita hanya proses 1 "produk" utama
        items_for_db_and_midtrans = [{
            "id": midtrans_item_id, 
            "name": verified_item_name,
            "price": verified_gross_amount, # Harga total untuk item ini
            "quantity": item_quantity_for_midtrans, 
            # Informasi tambahan untuk disimpan di DB (items_json)
            "token_amount_granted": tokens_to_be_granted_if_success if product_type == "token" else 0,
            "duration_days_granted": product_duration_days if product_type == "premium" else 0
        }]

        # Simpan order ke database Anda SEBELUM membuat transaksi di Midtrans
        conn_db_order = None
        try:
            conn_db_order = sqlite3.connect(DB_NAME)
            cursor_order = conn_db_order.cursor()
            cursor_order.execute("""
                INSERT INTO app_orders (order_id, user_email, item_id, item_name, quantity, amount, status, items_json, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                order_id, email, midtrans_item_id, verified_item_name, item_quantity_for_midtrans,
                verified_gross_amount, 'PENDING', json.dumps(items_for_db_and_midtrans), 
                current_time_iso, current_time_iso
            ))
            conn_db_order.commit()
            app.logger.info(f"Order {order_id} ({verified_item_name}) untuk {email} berhasil disimpan ke DB (status PENDING).")
        except sqlite3.Error as db_err:
            if conn_db_order: conn_db_order.rollback()
            app.logger.error(f"Gagal menyimpan order {order_id} ke DB: {db_err}", exc_info=True)
            return jsonify({"error": "Gagal memproses pesanan internal."}), 500
        finally:
            if conn_db_order: conn_db_order.close()

        # Siapkan parameter untuk Midtrans Snap
        app_base_url = os.environ.get('APP_BASE_URL', request.host_url.rstrip('/'))
        
        start_time_utc = datetime.now(timezone.utc)
        midtrans_start_time = start_time_utc.strftime("%Y-%m-%d %H:%M:%S +0000")
        expiry_settings = {
            "start_time": midtrans_start_time,
            "unit": "minutes", 
            "duration": 30 # Kadaluwarsa dalam 30 menit (bisa dikonfigurasi)
        }

        params = {
            "transaction_details": { 
                "order_id": order_id, 
                "gross_amount": verified_gross_amount 
            },
            "item_details": items_for_db_and_midtrans, # Gunakan items yang sudah disiapkan
            "customer_details": { 
                "email": email, 
                "first_name": username,
                # "last_name": "NamaBelakangJikaAda",
                # "phone": "NomorTeleponJikaAda" 
            },
            "callbacks": { 
                "finish": f"{app_base_url}/payment-status?order_id={order_id}" 
            },
            "expiry": expiry_settings,
            # Aktifkan metode pembayaran yang diinginkan
            # Batasi ke kanal yang sudah aktif di Midtrans production
            "enabled_payments": ["gopay", "bni_va", "bri_va", "permata_va", "echannel", "other_va"]
        }
        
        app.logger.info(f"Mengirim permintaan create_transaction ke Midtrans untuk Order ID: {order_id}. Params: {str(params)[:300]}...") # Log sebagian params
        transaction_response = snap.create_transaction(params)
        snap_token = transaction_response.get('token')

        if not snap_token:
            app.logger.error(f"Midtrans tidak mengembalikan snap_token untuk order {order_id}. Respons: {transaction_response}")
            conn_fail_snap = None
            try:
                conn_fail_snap = sqlite3.connect(DB_NAME)
                cursor_fail_snap = conn_fail_snap.cursor()
                cursor_fail_snap.execute("UPDATE app_orders SET status = ?, updated_at = ? WHERE order_id = ?", 
                                         ('FAILED_SNAP_TOKEN', datetime.now(timezone.utc).isoformat(), order_id))
                conn_fail_snap.commit()
            except sqlite3.Error as db_err_snap_fail:
                app.logger.error(f"Gagal update status FAILED_SNAP_TOKEN untuk order {order_id} ke DB: {db_err_snap_fail}")
            finally:
                if conn_fail_snap: conn_fail_snap.close()
            return jsonify({"error": "Gagal mendapatkan token sesi pembayaran dari Midtrans."}), 502

        # Simpan snap_token ke tabel order Anda
        conn_update_snap = None
        try:
            conn_update_snap = sqlite3.connect(DB_NAME)
            cursor_update_snap = conn_update_snap.cursor()
            cursor_update_snap.execute("UPDATE app_orders SET snap_token = ?, updated_at = ? WHERE order_id = ?", 
                                       (snap_token, datetime.now(timezone.utc).isoformat(), order_id))
            conn_update_snap.commit()
        except sqlite3.Error as db_err_snap:
            app.logger.error(f"Gagal menyimpan snap_token untuk order {order_id} ke DB: {db_err_snap}")
            # Ini bukan error fatal jika snap_token sudah didapat, jadi lanjutkan
        finally:
            if conn_update_snap: conn_update_snap.close()
            
        app.logger.info(f"Midtrans Snap Token '{snap_token}' berhasil dibuat untuk Order ID: {order_id}.")
        return jsonify({"snap_token": snap_token, "order_id": order_id}), 200

    except midtransclient.error_midtrans.MidtransAPIError as e:
        error_messages_midtrans = e.api_response.get('error_messages', [str(e.api_response_message or str(e))]) if hasattr(e, 'api_response') and e.api_response else [str(e)]
        http_status = e.http_status_code if hasattr(e, 'http_status_code') and e.http_status_code else 500
        app.logger.error(f"Midtrans API Error (Order ID: {order_id if 'order_id' in locals() else 'N/A'}): {', '.join(error_messages_midtrans)} - HTTP {http_status}", exc_info=True)
        return jsonify({"error": f"Gagal membuat sesi pembayaran dengan Midtrans: {', '.join(error_messages_midtrans)}"}), http_status
    except Exception as e:
        order_id_for_log = order_id if 'order_id' in locals() else data.get('item_id', 'N/A')
        app.logger.error(f"Error umum membuat transaksi Midtrans (Item ID/Order ID: {order_id_for_log}, Email: {data.get('email', 'N/A')}): {str(e)}", exc_info=True)
        return jsonify({"error": "Kesalahan server saat memproses pembayaran. Silakan coba lagi nanti."}), 500

@app.route("/payment/midtrans-notification", methods=["POST"])
def midtrans_notification_handler_route():
    global snap # Akses objek snap yang sudah diinisialisasi
    if not snap:
        app.logger.error("MIDTRANS CLIENT (SNAP) NOT INITIALIZED - Cannot process Midtrans notification.")
        return jsonify({"status": "error", "message": "Internal server configuration error for payment processing."}), 200 # Sesuai permintaan Midtrans

    try:
        notification_data = request.json
    except Exception as e:
        app.logger.error(f"Gagal parse JSON notifikasi Midtrans: {e}. Request data: {request.data}")
        return jsonify({"status": "error", "message": "Invalid JSON payload from Midtrans."}), 400

    app.logger.info(f"Menerima notifikasi Midtrans: {str(notification_data)[:500]}...") # Log sebagian data

    order_id_from_notif = notification_data.get('order_id')
    transaction_id_from_notif = notification_data.get('transaction_id')
    transaction_status_from_notif = notification_data.get('transaction_status')
    fraud_status_from_notif = notification_data.get('fraud_status')
    payment_type_from_notif = notification_data.get('payment_type')
    gross_amount_from_notif_str = notification_data.get('gross_amount')

    if not all([order_id_from_notif, transaction_id_from_notif, transaction_status_from_notif, gross_amount_from_notif_str]):
        app.logger.error(f"Notifikasi Midtrans tidak lengkap untuk order_id: {order_id_from_notif}. Data: {notification_data}")
        return jsonify({"status": "error", "message": "Notifikasi tidak lengkap."}), 400

    # **LANGKAH 1: VERIFIKASI NOTIFIKASI DENGAN MENGAMBIL STATUS LANGSUNG DARI MIDTRANS**
    try:
        app.logger.info(f"Memverifikasi status transaksi untuk Order ID: {order_id_from_notif} ke API Midtrans...")
        status_from_midtrans_api = snap.transactions.status(order_id_from_notif)
        app.logger.info(f"Respons status dari API Midtrans untuk Order ID {order_id_from_notif}: {str(status_from_midtrans_api)[:300]}")

        # Validasi data dari notifikasi dengan data dari API Midtrans
        if not (status_from_midtrans_api.get('transaction_id') == transaction_id_from_notif and
                status_from_midtrans_api.get('transaction_status') == transaction_status_from_notif and
                float(status_from_midtrans_api.get('gross_amount', "0.00")) == float(gross_amount_from_notif_str)
                # Pertimbangkan verifikasi fraud_status jika ada di respons status API dan penting
                # and status_from_midtrans_api.get('fraud_status') == fraud_status_from_notif 
                ):
            app.logger.error(f"Verifikasi notifikasi GAGAL untuk Order ID: {order_id_from_notif}. Data notifikasi tidak cocok dengan data dari API Midtrans.")
            return jsonify({"status": "error", "message": "Verifikasi notifikasi gagal. Data tidak cocok."}), 403 

        app.logger.info(f"Notifikasi untuk Order ID: {order_id_from_notif} berhasil diverifikasi dengan API Midtrans.")
        # Gunakan status terverifikasi dari API Midtrans untuk proses selanjutnya
        verified_transaction_status = status_from_midtrans_api.get('transaction_status')
        verified_fraud_status = status_from_midtrans_api.get('fraud_status', fraud_status_from_notif) 
        # Jika 'payment_type' dari status API berbeda, Anda bisa log atau gunakan dari status API
        verified_payment_type = status_from_midtrans_api.get('payment_type', payment_type_from_notif)

    except midtransclient.error_midtrans.MidtransAPIError as e:
        error_msg = e.api_response.get('status_message', str(e)) if hasattr(e, 'api_response') and e.api_response else str(e)
        app.logger.error(f"Midtrans API Error saat verifikasi notifikasi Order ID {order_id_from_notif}: {error_msg} - HTTP {e.http_status_code if hasattr(e, 'http_status_code') else 'N/A'}")
        return jsonify({"status": "error", "message": "Gagal verifikasi notifikasi dengan Midtrans."}), 200
    except Exception as e:
        app.logger.error(f"Error umum saat verifikasi notifikasi Order ID {order_id_from_notif}: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Kesalahan server saat verifikasi notifikasi."}), 200

    # **LANGKAH 2: PROSES NOTIFIKASI DAN UPDATE DATABASE ANDA**
    conn_db_update = None
    try:
        conn_db_update = sqlite3.connect(DB_NAME)
        cursor_update = conn_db_update.cursor()

        # Ambil detail order dari database lokal Anda (pastikan urutan kolom SELECT benar)
        cursor_update.execute("SELECT user_email, item_id, items_json, status, amount FROM app_orders WHERE order_id = ?", (order_id_from_notif,))
        order_in_db = cursor_update.fetchone()

        if not order_in_db:
            app.logger.error(f"Order ID {order_id_from_notif} dari notifikasi Midtrans tidak ditemukan di database lokal.")
            return jsonify({"status": "ok", "message": "Order ID tidak ditemukan di sistem kami."}), 200

        user_email_order = order_in_db[0]
        item_id_from_db_order = order_in_db[1] 
        items_ordered_json_str = order_in_db[2] 
        current_order_status_db = order_in_db[3]
        order_amount_db = order_in_db[4]

        final_statuses = ['SETTLEMENT', 'SUCCESS_CAPTURE', 'EXPIRE_PROCESSED', 'CANCEL_PROCESSED', 'DENY_PROCESSED', 'FAILED', 'REVIEW_AMOUNT_MISMATCH']
        if current_order_status_db in final_statuses:
            app.logger.info(f"Order ID {order_id_from_notif} sudah dalam status final '{current_order_status_db}'. Notifikasi diabaikan.")
            return jsonify({"status": "ok", "message": "Notifikasi sudah diproses sebelumnya."}), 200
        
        if int(float(status_from_midtrans_api.get('gross_amount', "0.00"))) != order_amount_db:
            app.logger.error(f"Gross amount tidak cocok untuk Order ID {order_id_from_notif}. API Midtrans: {status_from_midtrans_api.get('gross_amount')}, DB: {order_amount_db}")
            # ... (logika untuk REVIEW_AMOUNT_MISMATCH) ...
            cursor_update.execute("UPDATE app_orders SET status = ?, midtrans_transaction_id = ?, payment_type = ?, updated_at = ? WHERE order_id = ?",
                                  ('REVIEW_AMOUNT_MISMATCH', transaction_id_from_notif, verified_payment_type, datetime.now(timezone.utc).isoformat(), order_id_from_notif))
            conn_db_update.commit()
            return jsonify({"status": "ok", "message": "Amount mismatch dicatat."}), 200

        new_db_status_order = current_order_status_db
        payment_processed_successfully = False

        # Gunakan verified_transaction_status dan verified_fraud_status dari API Midtrans
        if verified_transaction_status == 'capture':
            if verified_fraud_status == 'accept':
                new_db_status_order = 'SUCCESS_CAPTURE'
                payment_processed_successfully = True
                app.logger.info(f"Pembayaran Order ID {order_id_from_notif} CAPTURE & ACCEPT (BERHASIL).")
            elif verified_fraud_status == 'challenge':
                new_db_status_order = 'CHALLENGE_FDS'
                app.logger.warning(f"Pembayaran Order ID {order_id_from_notif} di-CHALLENGE oleh FDS Midtrans.")
            else: # fraud_status == 'deny'
                new_db_status_order = 'DENY_FDS'
                app.logger.error(f"Pembayaran Order ID {order_id_from_notif} DITOLAK oleh FDS Midtrans.")
        
        elif verified_transaction_status == 'settlement':
            new_db_status_order = 'SETTLEMENT'
            payment_processed_successfully = True
            app.logger.info(f"Pembayaran Order ID {order_id_from_notif} SETTLEMENT (BERHASIL FINAL).")

        elif verified_transaction_status == 'pending': new_db_status_order = 'PENDING_PAYMENT'
        elif verified_transaction_status == 'deny': new_db_status_order = 'DENY_PAYMENT'
        elif verified_transaction_status == 'expire': new_db_status_order = 'EXPIRE_PROCESSED'
        elif verified_transaction_status == 'cancel': new_db_status_order = 'CANCEL_PROCESSED'
        else:
            app.logger.warning(f"Menerima status transaksi '{verified_transaction_status}' yang tidak dikenal untuk Order ID: {order_id_from_notif}")
            new_db_status_order = verified_transaction_status.upper()

        # Update status order di database Anda
        cursor_update.execute("UPDATE app_orders SET status = ?, midtrans_transaction_id = ?, payment_type = ?, updated_at = ? WHERE order_id = ?",
                              (new_db_status_order, transaction_id_from_notif, verified_payment_type, datetime.now(timezone.utc).isoformat(), order_id_from_notif))

        if payment_processed_successfully:
            app.logger.info(f"Memproses entitlement untuk order {order_id_from_notif} yang sukses...")
            try:
                items_ordered = json.loads(items_ordered_json_str) if items_ordered_json_str else []
                if items_ordered:
                    main_item_purchased = items_ordered[0] # Asumsi item pertama adalah yang utama dibeli
                    product_id_from_order = main_item_purchased.get("id") # Ini adalah item_id yang disimpan di app_orders
                    
                    product_info_catalog = PRODUCT_CATALOG.get(product_id_from_order)

                    if product_id_from_order == "TOKEN_CUSTOM":
                        # Untuk TOKEN_CUSTOM, jumlah token diambil dari `token_amount_granted` yang disimpan di items_json
                        tokens_to_add = main_item_purchased.get('token_amount_granted', 0)
                        if tokens_to_add > 0:
                            cursor_update.execute("UPDATE users SET tokens = tokens + ? WHERE email = ?", (tokens_to_add, user_email_order))
                            app.logger.info(f"{tokens_to_add} token (kustom) ditambahkan ke user {user_email_order} untuk order {order_id_from_notif}.")
                        else:
                            app.logger.warning(f"Token amount kustom adalah 0 atau tidak ada di items_json untuk order {order_id_from_notif}")
                    elif product_info_catalog: # Untuk produk standar dari catalog
                        if product_info_catalog['type'] == 'token' and product_info_catalog.get('token_amount', 0) > 0:
                            tokens_to_add = product_info_catalog['token_amount']
                            cursor_update.execute("UPDATE users SET tokens = tokens + ? WHERE email = ?", (tokens_to_add, user_email_order))
                            app.logger.info(f"{tokens_to_add} token (paket) ditambahkan ke user {user_email_order} untuk order {order_id_from_notif}.")
                        elif product_info_catalog['type'] == 'premium':
                            # Set premium aktif + tambahkan bonus 10 token, atur durasi
                            # Permanent list berdasarkan handle email (sebelum '@')
                            permanent_handles = {"user","hisyam","eca","unpadpreneur","eip"}
                            handle = (user_email_order.split('@')[0]).lower() if user_email_order else ''

                            # Ambil expiry lama (kalau ada)
                            cursor_update.execute("SELECT premium_expires_at FROM users WHERE email = ?", (user_email_order,))
                            row_prev = cursor_update.fetchone()
                            prev_exp = None
                            if row_prev and row_prev[0]:
                                try:
                                    prev_exp = datetime.fromisoformat(row_prev[0])
                                except Exception:
                                    prev_exp = None

                            if handle in permanent_handles:
                                cursor_update.execute(
                                    "UPDATE users SET is_premium = 1, permanent_premium = 1, premium_expires_at = NULL, tokens = tokens + 10 WHERE email = ?",
                                    (user_email_order,)
                                )
                                app.logger.info(f"User {user_email_order} diupgrade Premium PERMANEN (+10 token) order {order_id_from_notif}.")
                            else:
                                now_utc = datetime.now(timezone.utc)
                                if prev_exp and prev_exp.tzinfo is None:
                                    # Jika tanpa timezone, anggap UTC
                                    prev_exp = prev_exp.replace(tzinfo=timezone.utc)
                                base = prev_exp if (prev_exp and prev_exp > now_utc) else now_utc
                                new_exp = base + timedelta(days=30)
                                cursor_update.execute(
                                    "UPDATE users SET is_premium = 1, permanent_premium = 0, premium_expires_at = ?, tokens = tokens + 10 WHERE email = ?",
                                    (new_exp.isoformat(), user_email_order,)
                                )
                                app.logger.info(f"User {user_email_order} diupgrade Premium 30 hari (+10 token) sampai {new_exp.isoformat()} untuk order {order_id_from_notif}.")
                    else:
                        app.logger.error(f"Product ID '{product_id_from_order}' dari order {order_id_from_notif} tidak ditemukan di PRODUCT_CATALOG.")
                else:
                    app.logger.error(f"items_json kosong atau format salah untuk order {order_id_from_notif}.")
            except json.JSONDecodeError:
                app.logger.error(f"Gagal parse items_json untuk order {order_id_from_notif}: '{items_ordered_json_str}'")
            except Exception as e_entitlement:
                app.logger.error(f"Error saat memberikan entitlement untuk order {order_id_from_notif}: {e_entitlement}", exc_info=True)
        
        conn_db_update.commit()
        app.logger.info(f"Status Order ID {order_id_from_notif} diupdate ke '{new_db_status_order}' di DB.")
        return jsonify({"status": "ok", "message": "Notifikasi berhasil diproses."}), 200

    except Exception as e:
        if conn_db_update: conn_db_update.rollback()
        app.logger.error(f"Error fatal saat memproses notifikasi Midtrans (Order ID: {order_id_from_notif or 'Tidak diketahui'}): {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Gagal memproses notifikasi di server."}), 200
    finally:
        if conn_db_update: conn_db_update.close()

@app.route("/request-registration-otp", methods=["POST"])
def request_registration_otp():
    # ... (Kode dari respons sebelumnya, pastikan DB_NAME, bcrypt, random, dll terdefinisi/diimport) ...
    # Saya salin kembali dengan sedikit penyesuaian logging
    data = request.json
    email = data.get("email", "").strip().lower()
    username = data.get("username", "").strip()
    password_plain = data.get("password", "")

    if not email or not username or not password_plain:
        return jsonify({"error": "Email, Username, dan Password wajib diisi."}), 400
    if len(password_plain) < 6:
        return jsonify({"error": "Password minimal harus 6 karakter."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT email FROM users WHERE email = ? OR username = ?", (email, username))
        if cursor.fetchone():
            return jsonify({"error": "Email atau Username sudah terdaftar. Silakan login atau gunakan yang lain."}), 409

        hashed_bytes = bcrypt.hashpw(password_plain.encode('utf-8'), bcrypt.gensalt())
        password_hash_temp_str = hashed_bytes.decode('utf-8')
        otp = str(random.randint(100000, 999999))
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)

        cursor.execute("""
            INSERT OR REPLACE INTO otp_codes (email, otp_code, username_temp, password_hash_temp, expires_at) 
            VALUES (?, ?, ?, ?, ?)
        """, (email, otp, username, password_hash_temp_str, expires_at.isoformat()))
        conn.commit()

        if send_email_otp_actual(email, otp, username):
            app.logger.info(f"OTP {otp} dikirim ke {email} untuk user {username}")
            return jsonify({"message": f"Kode OTP telah dikirim ke {email}. Cek email Anda (termasuk folder spam)."}), 200
        else:
            cursor.execute("DELETE FROM otp_codes WHERE email = ?", (email,))
            conn.commit()
            app.logger.error(f"Gagal mengirim email OTP aktual ke {email}, OTP yang tersimpan dihapus.")
            return jsonify({"error": "Gagal mengirim email OTP. Pastikan email Anda aktif dan coba lagi nanti."}), 502
            
    except sqlite3.Error as e:
        if conn: conn.rollback()
        app.logger.error(f"DB Error /request-registration-otp: {e}")
        return jsonify({"error": "Kesalahan database saat memproses permintaan OTP."}), 500
    except Exception as e:
        app.logger.error(f"Server Error /request-registration-otp: {e}")
        return jsonify({"error": f"Kesalahan server internal: {str(e)}"}), 500
    finally:
        if conn: conn.close()

@app.route("/register", methods=["POST"])
def register_route_with_otp_final():
    data = request.json
    email = data.get("email", "").strip().lower()
    otp_input = data.get("otp", "").strip()

    if not email or not otp_input:
        return jsonify({"error": "Email dan OTP wajib diisi untuk verifikasi."}), 400
    
    # Menggunakan verify_otp_and_register_user dari auth.py
    success, message = verify_otp_and_register_user(email, otp_input) 
    
    if success:
        return jsonify({"message": message}), 201
    else:
        status_code = 400 
        if "kadaluwarsa" in message.lower() or "tidak ditemukan" in message.lower() or "salah" in message.lower():
            status_code = 400 
        elif "sudah terdaftar" in message.lower():
            status_code = 409
        elif "database" in message.lower() or "internal" in message.lower():
            status_code = 500
        return jsonify({"error": message}), status_code

@app.route("/login", methods=["POST"])
def login_route():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email dan password wajib diisi."}), 400

    user_info = login_user(email, password)

    if user_info:
        return jsonify({
            "message": "Login berhasil!",
            "id": user_info.get("id"), # Kembalikan ID jika ada
            "email": user_info["email"],
            "username": user_info["username"],
            "is_premium": user_info["is_premium"],
            "is_admin": user_info["is_admin"],
            "tokens": user_info["tokens"]
        }), 200
    else:
        return jsonify({"error": "Email atau password salah."}), 401

@app.route("/auth/google/callback", methods=["POST"])
def auth_google_callback():
    # ... (Kode lengkap dari respons sebelumnya, pastikan GOOGLE_CLIENT_ID_SERVER, DB_NAME, bcrypt, uuid terdefinisi) ...
    # ... (dan login_user atau cara membuat data user_for_response yang konsisten) ...
    data = request.json
    google_id_token_str = data.get("id_token")

    if not google_id_token_str:
        return jsonify({"error": "ID Token Google tidak ditemukan."}), 400
    if not GOOGLE_CLIENT_ID_SERVER:
        app.logger.error("ERROR: GOOGLE_CLIENT_ID environment variable not set.")
        return jsonify({"error": "Konfigurasi server Google Auth bermasalah."}), 500

    conn = None
    try:
        idinfo = id_token.verify_oauth2_token(google_id_token_str, google_requests.Request(), GOOGLE_CLIENT_ID_SERVER)
        if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise ValueError('Issuer token salah.')

        google_email = idinfo['email']
        google_name = idinfo.get('name', google_email.split('@')[0])

        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, password, is_premium, is_admin, tokens FROM users WHERE email = ?", (google_email,))
        user_record = cursor.fetchone()
        user_for_response = {}
        response_message = ""

        if user_record:
            print(f"User Google ditemukan: {google_email}, login.")
            user_for_response = {
                "id": user_record[0], "username": user_record[1], "email": user_record[2],
                "is_premium": bool(user_record[4]), "is_admin": bool(user_record[5]),
                "tokens": user_record[6]
            }
            response_message = "Berhasil masuk dengan Google!"
        else:
            print(f"User Google baru: {google_email}, membuat akun...")
            username_to_save = google_name
            cursor.execute("SELECT id FROM users WHERE username = ?", (username_to_save,))
            if cursor.fetchone():
                username_to_save = f"{google_name}_{str(uuid.uuid4())[:4]}"
            
            placeholder_password_hash = bcrypt.hashpw(str(uuid.uuid4()).encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            default_tokens = 3
            default_is_premium = 0
            default_is_admin = 0

            cursor.execute("INSERT INTO users (username, email, password, tokens, is_premium, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
                           (username_to_save, google_email, placeholder_password_hash, default_tokens, default_is_premium, default_is_admin))
            new_user_id = cursor.lastrowid
            conn.commit()
            
            user_for_response = {
                "id": new_user_id, "username": username_to_save, "email": google_email,
                "is_premium": False, "is_admin": False, "tokens": default_tokens
            }
            response_message = "Akun baru berhasil dibuat dengan Google!"
        
        return jsonify({"message": response_message, "user": user_for_response}), 200
    except ValueError as e:
        app.logger.error(f"Google Auth Error - Invalid token: {str(e)}")
        return jsonify({"error": "Token Google tidak valid atau sudah kadaluwarsa."}), 401
    except sqlite3.Error as e:
        if conn: conn.rollback()
        app.logger.error(f"DB Error /auth/google/callback: {str(e)}")
        return jsonify({"error": "Kesalahan database saat proses Google Sign-In."}), 500
    except Exception as e:
        app.logger.error(f"Server Error /auth/google/callback: {str(e)}")
        return jsonify({"error": f"Kesalahan server internal: {str(e)}"}), 500
    finally:
        if conn: conn.close()
    
@app.route("/student-goals/generate", methods=["POST"])
def student_goals_generate():
    conn = None  # <--- TAMBAHKAN INISIALISASI INI
    try:
        email = request.form.get("email")
        nama = request.form.get("nama")
        jurusan = request.form.get("jurusan")
        semester_input_awal_str = request.form.get("semester_input_awal")
        target_semester_str = request.form.get("target_semester")
        mode_action = request.form.get("mode_action")

        is_regeneration_str = request.form.get("is_regeneration", "false")
        is_adding_super_plan_str = request.form.get("is_adding_super_plan", "false")
        plan_id_to_regenerate = request.form.get("plan_id_to_regenerate")

        swot_file_ref_from_req = request.form.get("swot_file_ref")
        ikigai_file_ref_from_req = request.form.get("ikigai_file_ref")

        is_regeneration = is_regeneration_str.lower() == 'true'
        is_adding_super_plan = is_adding_super_plan_str.lower() == 'true'
        is_initial_generation = not is_regeneration and not is_adding_super_plan

        if not email:
            # Jika return di sini, 'conn' belum di-assign, tapi karena sudah None, 'finally' aman
            return jsonify({"error": "Email wajib diisi."}), 400
        if not target_semester_str or not target_semester_str.isdigit():
            return jsonify({"error": "Target semester tidak valid."}), 400
        target_semester = int(target_semester_str)

        if is_initial_generation:
            if not all([nama, jurusan, semester_input_awal_str, mode_action]):
                return jsonify({"error": "Data awal (nama, jurusan, semester input, mode action) tidak lengkap."}), 400
            if not semester_input_awal_str.isdigit() or not (1 <= int(semester_input_awal_str) <= 14):
                 return jsonify({"error": "Semester input awal tidak valid (1-14)."}), 400
            if 'swot_pdf' not in request.files or 'ikigai_pdf' not in request.files:
                return jsonify({"error": "File SWOT dan Ikigai PDF wajib diunggah untuk rencana awal."}), 400
        elif (is_adding_super_plan or is_regeneration) and not all([nama, jurusan, mode_action]):
             return jsonify({"error": "Konteks data awal (nama, jurusan, mode action) diperlukan untuk menambah/regenerasi."}), 400

        # 'conn' baru di-assign di sini
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT is_premium, tokens FROM users WHERE email = ?", (email,))
        user_data = cursor.fetchone()

        if not user_data:
            # conn.close() tidak perlu di sini karena akan ditangani 'finally'
            return jsonify({"error": "User tidak ditemukan."}), 404

        is_premium_user, current_tokens = user_data
        if not is_premium_user:
            # conn.close() tidak perlu di sini
            return jsonify({"error": "Fitur ini hanya untuk pengguna Premium."}), 403
        if current_tokens < TOKEN_COST_STUDENT_GOALS:
            # conn.close() tidak perlu di sini
            return jsonify({"error": f"Token tidak cukup. Anda memerlukan {TOKEN_COST_STUDENT_GOALS} token."}), 403

        final_swot_file_ref = swot_file_ref_from_req
        final_ikigai_file_ref = ikigai_file_ref_from_req
        initial_data_refs_for_response = {}

        if is_initial_generation:
            swot_pdf_file = request.files['swot_pdf']
            ikigai_pdf_file = request.files['ikigai_pdf']
            
            swot_filename = secure_filename(f"{uuid.uuid4().hex}_{swot_pdf_file.filename}")
            ikigai_filename = secure_filename(f"{uuid.uuid4().hex}_{ikigai_pdf_file.filename}")
            
            final_swot_file_ref = os.path.join(UPLOADS_FOLDER_GOALS, swot_filename)
            final_ikigai_file_ref = os.path.join(UPLOADS_FOLDER_GOALS, ikigai_filename)
            
            try:
                swot_pdf_file.save(final_swot_file_ref)
                ikigai_pdf_file.save(final_ikigai_file_ref)
                initial_data_refs_for_response = {
                    "swot_file_ref": final_swot_file_ref,
                    "ikigai_file_ref": final_ikigai_file_ref
                }
            except Exception as e:
                # conn.close() tidak perlu di sini
                print(f"[File Save Error] {str(e)}")
                return jsonify({"error": f"Gagal menyimpan file: {str(e)}"}), 500
        
        prompt = f"""
Data Pengguna:
- Nama: {nama}
- Jurusan: {jurusan}
- Semester yang Direncanakan: {target_semester}
- Mode Action: {'ambis (ambis)' if mode_action == 'ambis' else 'santuy (Santuy)'}

Tugas Anda:
Buatlah "Student Goals Planning" yang komprehensif untuk semester yang disebutkan.
Pastikan output terstruktur dengan baik dan mudah dibaca.

Format output yang diinginkan adalah sebagai berikut (gunakan Markdown):

# 📚 Misi Kuliah Semester {target_semester} Ini
(Berikan deskripsi singkat, 1-2 kalimat, mengenai fokus utama atau tema besar untuk semester ini berdasarkan data pengguna. Kaitkan dengan mode action jika memungkinkan.)

## 🎯 Mission Pack
(Detailkan minimal 2 Main Mission dan untuk setiap Main Mission, berikan minimal 2 Side Mission. Buatlah se-actionable mungkin!)

### Main Mission 1: [Judul Main Mission 1 yang Menarik dan Relevan]
   - **Deskripsi Singkat:** (1 kalimat penjelasan Main Mission ini)
   - **Target Utama:** (Indikator keberhasilan yang jelas dan terukur untuk Main Mission ini)
   - **Side Mission 1.1:** [Deskripsi Side Mission yang mendukung Main Mission 1]
     - *Action Steps:* (minimal 2 langkah konkret, spesifik, dan terukur)
       1. Langkah A...
       2. Langkah B...
   - **Side Mission 1.2:** [Deskripsi Side Mission lain yang mendukung Main Mission 1]
     - *Action Steps:*
       1. Langkah C...
       2. Langkah D...

### Main Mission 2: [Judul Main Mission 2 yang Menarik dan Relevan]
   - **Deskripsi Singkat:** (1 kalimat penjelasan Main Mission ini)
   - **Target Utama:** (Indikator keberhasilan yang jelas dan terukur untuk Main Mission ini)
   - **Side Mission 2.1:** [Deskripsi Side Mission yang mendukung Main Mission 2]
     - *Action Steps:*
       1. Langkah E...
       2. Langkah F...
   - **Side Mission 2.2:** [Deskripsi Side Mission lain yang mendukung Main Mission 2]
     - *Action Steps:*
       1. Langkah G...
       2. Langkah H...

*(Jika relevan dan menambah nilai, Anda bisa menambahkan Main Mission ke-3)*

## 💬 Quotes Penutup
(Satu kutipan motivasi yang singkat, relevan dengan tema semester atau tantangan mahasiswa, dan membangkitkan semangat.)

---
**PENTING:** Gunakan tone bahasa yang santai, Gen Z-friendly, reflektif, namun tetap actionable. Hindari bahasa yang terlalu kaku atau formal. Buat perencanaan ini terasa personal, memotivasi, dan memberikan panduan yang jelas!
"""
        plan_content = generate_openai_response(prompt)

        current_timestamp_iso = datetime.now(timezone.utc).isoformat()
        plan_record_id = str(uuid.uuid4())

        if is_regeneration and plan_id_to_regenerate:
            cursor.execute("""
                UPDATE student_goals_plans 
                SET plan_content = ?, timestamp = ?
                WHERE id = ? AND user_email = ?
            """, (plan_content, current_timestamp_iso, plan_id_to_regenerate, email))
            plan_record_id = plan_id_to_regenerate
        else:
            db_nama_input = nama if is_initial_generation else (cursor.execute("SELECT nama_input FROM student_goals_plans WHERE user_email = ? AND is_initial_data_source = TRUE ORDER BY timestamp DESC LIMIT 1", (email,)).fetchone() or [nama])[0]
            db_jurusan_input = jurusan if is_initial_generation else (cursor.execute("SELECT jurusan_input FROM student_goals_plans WHERE user_email = ? AND is_initial_data_source = TRUE ORDER BY timestamp DESC LIMIT 1", (email,)).fetchone() or [jurusan])[0]
            db_semester_input_awal_val = int(semester_input_awal_str) if semester_input_awal_str else target_semester # Fallback jika semester_input_awal_str None
            db_semester_input_awal = int(semester_input_awal_str) if is_initial_generation else (cursor.execute("SELECT semester_input_awal FROM student_goals_plans WHERE user_email = ? AND is_initial_data_source = TRUE ORDER BY timestamp DESC LIMIT 1", (email,)).fetchone() or [db_semester_input_awal_val])[0]
            db_mode_action_input = mode_action if is_initial_generation else (cursor.execute("SELECT mode_action_input FROM student_goals_plans WHERE user_email = ? AND is_initial_data_source = TRUE ORDER BY timestamp DESC LIMIT 1", (email,)).fetchone() or [mode_action])[0]
            
            db_swot_file_ref = final_swot_file_ref if is_initial_generation else (cursor.execute("SELECT swot_file_ref FROM student_goals_plans WHERE user_email = ? AND is_initial_data_source = TRUE ORDER BY timestamp DESC LIMIT 1", (email,)).fetchone() or [final_swot_file_ref])[0]
            db_ikigai_file_ref = final_ikigai_file_ref if is_initial_generation else (cursor.execute("SELECT ikigai_file_ref FROM student_goals_plans WHERE user_email = ? AND is_initial_data_source = TRUE ORDER BY timestamp DESC LIMIT 1", (email,)).fetchone() or [final_ikigai_file_ref])[0]

            cursor.execute("""
                INSERT INTO student_goals_plans 
                (id, user_email, nama_input, jurusan_input, semester_input_awal, mode_action_input, 
                 swot_file_ref, ikigai_file_ref, target_semester_plan, plan_content, is_initial_data_source, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (plan_record_id, email, db_nama_input, db_jurusan_input, db_semester_input_awal, db_mode_action_input,
                  db_swot_file_ref, db_ikigai_file_ref, target_semester, plan_content, is_initial_generation, current_timestamp_iso))

        new_token_balance = current_tokens - TOKEN_COST_STUDENT_GOALS
        cursor.execute("UPDATE users SET tokens = ? WHERE email = ?", (new_token_balance, email))
        conn.commit()

        response_payload = {
            "message": "Rencana berhasil diproses!",
            "plan": {
                "id": plan_record_id,
                "semester": target_semester,
                "content": plan_content,
                "timestamp": current_timestamp_iso,
                "is_initial_data_source": is_initial_generation
            },
            "new_token_balance": new_token_balance
        }
        if is_initial_generation:
            response_payload["initial_data_refs"] = initial_data_refs_for_response
        
        return jsonify(response_payload), 200

    except sqlite3.Error as e:
        if conn:
            conn.rollback()
        print(f"[DB Error - /student-goals/generate] {str(e)}")
        return jsonify({"error": f"Kesalahan database: {str(e)}"}), 500
    except Exception as e:
        print(f"[Server Error - /student-goals/generate] {str(e)}")
        # Jika conn belum diinisialisasi, pengecekan 'if conn:' di finally akan aman
        return jsonify({"error": f"Kesalahan server internal: {str(e)}"}), 500
    finally:
        if conn: # Sekarang 'conn' pasti sudah terdefinisi (meskipun bisa None)
            conn.close()

# Di app.py Anda

@app.route("/student-goals/history/all", methods=["DELETE"]) # Atau POST jika Anda tidak bisa/mau pakai DELETE
def delete_all_student_goals_history():
    email = request.args.get("email") # Jika dikirim sebagai query param dengan metode DELETE

    if not email:
        return jsonify({"error": "Parameter email wajib diisi."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        # Validasi user jika perlu (misalnya, apakah user ini ada)
        cursor.execute("SELECT 1 FROM users WHERE email = ?", (email,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "User tidak ditemukan."}), 404

        # Hapus semua rencana untuk user_email tersebut
        cursor.execute("DELETE FROM student_goals_plans WHERE user_email = ?", (email,))
        deleted_rows = cursor.rowcount # Jumlah baris yang terhapus
        conn.commit()

        return jsonify({"message": f"Berhasil menghapus {deleted_rows} riwayat rencana untuk {email}."}), 200

    except sqlite3.Error as e:
        if conn:
            conn.rollback()
        print(f"[DB Error - /student-goals/history/all] {str(e)}")
        return jsonify({"error": f"Kesalahan database: {str(e)}"}), 500
    except Exception as e:
        print(f"[Server Error - /student-goals/history/all] {str(e)}")
        return jsonify({"error": f"Kesalahan server internal: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()

@app.route("/student-goals/history", methods=["GET"])
def student_goals_history():
    # global DB_NAME
    email = request.args.get("email")
    if not email:
        return jsonify({"error": "Parameter email wajib diisi."}), 400

    conn = None # Initialize conn to None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        # Ambil semua kolom yang relevan, urutkan agar yang terbaru per semester muncul (jika ada duplikat semester)
        # atau frontend bisa mengelola versi jika diperlukan.
        # Untuk simple history, urutkan berdasarkan semester lalu timestamp
        cursor.execute("""
            SELECT id, user_email, nama_input, jurusan_input, semester_input_awal, 
                   mode_action_input, swot_file_ref, ikigai_file_ref, 
                   target_semester_plan, plan_content, is_initial_data_source, timestamp 
            FROM student_goals_plans 
            WHERE user_email = ? 
            ORDER BY target_semester_plan ASC, timestamp DESC
        """, (email,))
        
        plans_data = []
        # Menggunakan fetchall dan kemudian memprosesnya
        rows = cursor.fetchall()
        for row in rows:
            plans_data.append({
                "id": row[0],
                "user_email": row[1],
                "nama_input": row[2],
                "jurusan_input": row[3],
                "semester_input_awal": row[4],
                "mode_action_input": row[5],
                "swot_file_ref": row[6],
                "ikigai_file_ref": row[7],
                "semester": row[8], # Menggunakan 'semester' agar konsisten dengan frontend
                "content": row[9],
                "is_initial_data_source": bool(row[10]), # Konversi ke boolean
                "timestamp": row[11]
            })
        
        return jsonify({"plans": plans_data}), 200

    except sqlite3.Error as e:
        print(f"[DB Error - /student-goals/history] {str(e)}")
        return jsonify({"error": f"Kesalahan database: {str(e)}", "plans": []}), 500 # Kembalikan array kosong
    except Exception as e:
        print(f"[Server Error - /student-goals/history] {str(e)}")
        return jsonify({"error": f"Kesalahan server internal: {str(e)}", "plans": []}), 500
    finally:
        if conn:
            conn.close()

@app.route("/analyze-swot", methods=["POST"])
def analyze_swot():
    data = request.get_json()
    email = data.get("email")
    nama = data.get("nama")
    mbti = data.get("mbti")
    via1 = data.get("via1")
    via2 = data.get("via2")
    via3 = data.get("via3")

    if not all([email, nama, mbti, via1, via2, via3]):
        return jsonify({"error": "Data tidak lengkap. Semua field wajib diisi."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()

        cursor.execute("SELECT is_premium, tokens FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User tidak ditemukan."}), 404

        is_premium, tokens = user
        if not is_premium:
             return jsonify({"error": "Fitur ini hanya untuk pengguna Premium."}), 403
        if tokens < TOKEN_COST_SWOT:
            return jsonify({"error": f"Token tidak cukup. Anda memerlukan {TOKEN_COST_SWOT} token."}), 403

        # --- PROMPT GABUNGAN ---
        # Tahap 1: Membuat Analisis SWOT Personal
        # Tahap 2: Membuat Rencana Aksi (Action Lens) berdasarkan SWOT yang baru dibuat
        prompt = f"""
--- TAHAP 1: ANALISIS SWOT PRIBADI ---

PERAN TAHAP 1:
Bertindaklah sebagai gabungan 5 peran expert berikut:
1. Psikolog perkembangan yang ngerti cara manusia kenal dirinya secara utuh.
2. Career coach senior yang biasa bantu mahasiswa nemuin arah hidup dan kontribusi nyata.
3. Life & growth strategist yang bisa bimbing dari refleksi ke aksi.
4. Mentor konten Gen Z yang bisa ngejelasin insight dengan gaya ringan, relevan, dan relatable.
5. Expert dalam tes kepribadian MBTI dan VIA Character Strength.

DATA PENGGUNA:
- Nama: {nama}
- MBTI: {mbti}
- VIA Character Strength: {via1}, {via2}, {via3}

TUGAS TAHAP 1:
Buat analisis SWOT diri dari hasil MBTI dan VIA tersebut, khusus untuk mahasiswa.
Format output HARUS sama persis dengan struktur di bawah ini:

1. Buka dengan narasi ringan tentang kombinasi kepribadian MBTI + VIA, bahas vibe-nya user secara umum.
2. Lanjutkan dengan kalimat transisi yang ngenalin SWOT sebagai tools refleksi.
3. Tampilkan 4 bagian SWOT berikut secara berurutan dan konsisten yang masing-masing minimal 3 poin:
   🟩 S – Strength (Kekuatan Alami)
   🟨 W – Weakness (Hambatan Pribadi)
   🟦 O – Opportunity (Peluang Potensial)
   🟥 T – Threat (Tantangan yang Perlu Diwaspadai)

4. Untuk setiap poin SWOT, wajib pakai format ini:
   ⭐/⚠️/🚀/🔥 [Judul Point]: Penjelasan singkat 1 baris.
   **Contoh:** [Berikan contoh nyata bagaimana poin ini muncul dalam kehidupan mahasiswa]
   **Strategi:** [Berikan satu strategi awal yang actionable untuk poin ini]

5. Gunakan emoji, heading, dan tone Gen Z yang ringan, santai, dan relatable.
6. Sorot poin penting dengan format bold.

--- TAHAP 2: SWOT ACTION LENS (RENCANA AKSI) ---

PERAN TAHAP 2:
Sekarang, bertindaklah sebagai gabungan ahli berikut:
1. Strategist pengembangan diri mahasiswa
2. Mentor organisasi dan lomba kampus
3. Akademisi yang paham gaya belajar dan kontribusi mahasiswa
4. UX communicator yang paham gaya Gen Z

TUGAS TAHAP 2:
Berdasarkan analisis SWOT yang TELAH KAMU BUAT DI TAHAP 1, buatlah SWOT Action Lens. Tujuannya adalah membantu mahasiswa menemukan strategi terbaik dalam 3 arena utama kehidupan kampus:
🎓 Akademik
🤝 Organisasi
🏆 Lomba

Untuk setiap arena (Akademik, Organisasi, Lomba), tampilkan strategi berbasis 4 jenis pendekatan SWOT:
📌 SO (Strength–Opportunity): Bagaimana menggunakan kekuatan untuk menangkap peluang?
📌 ST (Strength–Threat): Bagaimana menggunakan kekuatan untuk mengatasi ancaman?
📌 WO (Weakness–Opportunity): Bagaimana mengatasi kelemahan dengan memanfaatkan peluang?
📌 WT (Weakness–Threat): Bagaimana meminimalkan kelemahan dan menghindari ancaman?

ATURAN PENULISAN STRATEGI:
- Gunakan bullet point.
- Setiap poin harus spesifik dan actionable, diikuti penjelasan ringkas setelah tanda "–". Contoh: `- Ikut riset dosen – Manfaatkan kekuatan analitis (Strength) untuk mengerjakan proyek riset (Opportunity).`
- Hindari narasi panjang.
- Hindari emoji berlebihan, hanya gunakan emoji label (📌 dan 🎓🤝🏆).

KESIMPULAN PER ARENA:
Setelah semua strategi di masing-masing arena, tambahkan satu paragraf kesimpulan untuk arena tersebut yang berisi:
1. Rekomendasi peran atau pendekatan ideal user di arena tersebut.
2. Prinsip strategis yang perlu dipegang.

ATURAN FINAL (SANGAT PENTING):
- Lakukan kedua tahap secara berurutan dalam satu respons tunggal.
- Jangan ada pertanyaan atau CTA di akhir. Output harus selesai setelah bagian Lomba.
- Pastikan format rapi, konsisten, dan mudah dibaca.
"""

        result = generate_openai_response(prompt)

        # Log penggunaan fitur
        cursor.execute("""
            INSERT INTO track_swot (email, nama, mbti, via1, via2, via3)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (email, nama, mbti, via1, via2, via3))

        # Kurangi token pengguna
        cursor.execute("UPDATE users SET tokens = tokens - ? WHERE email = ?", (TOKEN_COST_SWOT, email))
        conn.commit()
        
        return jsonify({"result": result}), 200

    except Exception as e:
        print("[ERROR - /analyze-swot]", str(e))
        return jsonify({"error": f"Terjadi kesalahan pada server: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()

@app.route("/log-feature", methods=["POST"])
def log_feature():
    data = request.json
    email = data.get("email")
    feature = data.get("feature")
    if not email or not feature:
        return jsonify({"error": "Email dan nama fitur wajib disertakan"}), 400
    new_log = FeatureLog(email=email, feature=feature)
    db.session.add(new_log)
    db.session.commit()
    return jsonify({"message": "Log ditambahkan"}), 200

@app.route("/admin/feature-usage", methods=["GET"])
def get_feature_usage():
    logs = db.session.query(
        FeatureLog.feature,
        db.func.count(FeatureLog.id)
    ).group_by(FeatureLog.feature).all()

    return jsonify([{"feature": f, "count": c} for f, c in logs])

@app.route('/upload_cv', methods=['POST'])
def upload_cv():
    try:
        file = request.files.get('cv')
        if not file:
            return jsonify({"error": "File CV tidak ditemukan."}), 400

        filename = file.filename.lower()
        if filename.endswith('.pdf'):
            text = extract_text_from_pdf(file)
        elif filename.endswith('.docx'):
            text = extract_text_from_docx(file)
        else:
            return jsonify({"error": "Format file tidak didukung. Hanya PDF atau DOCX."}), 400

        # Lakukan ringkasan jika perlu (sementara langsung return semua isi)
        summary = summarize_cv_text(text)
        return jsonify({"cv_summary": summary})

    except Exception as e:
        print("[ERROR - /upload_cv]", str(e))
        return jsonify({"error": str(e)}), 500


def extract_text_from_pdf(file):
    text = ""
    doc = fitz.open(stream=file.read(), filetype="pdf")
    for page in doc:
        text += page.get_text()
    return text

def extract_text_from_docx(file):
    doc = Document(file)
    return "\n".join([para.text for para in doc.paragraphs])


def summarize_cv_text(text):
    # Placeholder ringkasan: ambil max 1000 karakter
    cleaned = text.replace('\n', ' ').strip()
    return cleaned[:1000] + "..." if len(cleaned) > 1000 else cleaned

@app.route('/delete_cv', methods=['POST'])
def delete_cv():
    try:
        for filename in os.listdir("temp_cv"):
            os.remove(os.path.join("temp_cv", filename))
        return jsonify({"message": "Semua CV sementara dihapus."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/debug/user", methods=["GET"])
def debug_user():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT email, password FROM users")
        users = cursor.fetchall()
        conn.close()
        return jsonify([
            {"email": u[0], "password": u[1]} for u in users
        ])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json()

    user_answer = data.get('answer', '')
    username = data.get('username', 'pelamar')
    history = data.get('history', [])
    interview_type = data.get('interviewType', 'beasiswa')
    language = data.get('language', 'id')
    scholarship_name = data.get('scholarshipName', '')
    internship_position = data.get('internshipPosition', '')
    cv_summary = data.get('cv_summary', '').strip() # Pastikan cv_summary di-strip

    history_block = "\n".join([
        f"Pertanyaan Sebelumnya: {item['q']}\nJawaban Pelamar: {item['a']}" for item in history
    ]) if history else "(Ini adalah pertanyaan pertama atau riwayat belum tersedia.)"

    # Keterangan CV yang lebih jelas untuk AI
    cv_info_id = f"Ringkasan CV Pelamar:\n{cv_summary}\n" if cv_summary else "Informasi CV Pelamar: (Tidak tersedia atau tidak diunggah)\n"
    cv_info_en = f"Applicant's CV Summary:\n{cv_summary}\n" if cv_summary else "Applicant's CV Information: (Not available or not uploaded)\n"

    # 📌 Prompt Generator yang Diperbarui
    if interview_type == 'magang':
        base_desc_id = f"""
Anda adalah seorang Manajer Perekrutan yang sangat berpengalaman dan kritis, sedang melakukan wawancara dengan Saudara {username} untuk posisi magang sebagai "{internship_position}", Pastikan pertanyaannya tidak begitu panjang banget normal saja.
{cv_info_id}
Riwayat Wawancara Sejauh Ini:
{history_block}

Jawaban Terbaru dari Pelamar atas Pertanyaan Terakhir:
"{user_answer}"

Tugas Anda (WAJIB DIPATUHI):
1.  Analisis jawaban terbaru pelamar DALAM KONTEKS ringkasan CV (jika tersedia) dan riwayat wawancara.
2.  Ajukan SATU pertanyaan lanjutan yang SANGAT SPESIFIK, profesional, dan bertujuan untuk MENGGALI LEBIH DALAM.
3.  Jika CV tersedia dan ada poin menarik/kurang jelas, PRIORITASKAN pertanyaan Anda untuk mengklarifikasi atau meminta detail lebih lanjut dari CV tersebut yang relevan dengan posisi "{internship_position}". Contoh: "Di CV Anda disebutkan proyek X, bisa ceritakan kontribusi spesifik Anda dan tantangan yang Anda hadapi?"
4.  Fokus pertanyaan bisa pada:
    * Motivasi kerja yang sesungguhnya untuk posisi dan perusahaan ini.
    * Kesiapan profesional dan pemahaman teknis terkait "{internship_position}".
    * Kemampuan problem-solving (minta contoh konkret dari pengalaman di CV atau situasi hipotetis yang relevan).
    * Pengalaman kerja tim atau kepemimpinan (jika relevan di CV).
5.  HINDARI pertanyaan yang bersifat umum, terlalu teoritis, repetitif, atau yang jawabannya sudah sangat jelas di CV (kecuali untuk elaborasi mendalam).
6.  Pertanyaan HARUS bersifat terbuka (bukan jawaban ya/tidak).
7.  Gunakan bahasa Indonesia yang formal dan profesional.
"""

        base_desc_en = f"""
You are a highly experienced and critical Hiring Manager conducting an interview with Mr./Ms. {username} for an internship position as "{internship_position}".
{cv_info_en}
Interview History So Far:
{history_block}

The Candidate's Latest Answer to the Previous Question:
"{user_answer}"

Your Task (MANDATORY ADHERENCE):
1.  Analyze the candidate's latest answer IN THE CONTEXT of their CV summary (if available) and the interview history.
2.  Ask ONE follow-up question that is HIGHLY SPECIFIC, professional, and aims to DIG DEEPER.
3.  If a CV is available and contains interesting points or areas needing clarification, PRIORITIZE your question to clarify or request more details from the CV relevant to the "{internship_position}" role. Example: "Your CV mentions project X; could you elaborate on your specific contribution and the challenges you faced?"
4.  Your question can focus on:
    * Genuine work motivation for this specific role and company.
    * Professional readiness and technical understanding related to "{internship_position}".
    * Problem-solving skills (ask for concrete examples from CV experiences or relevant hypothetical situations).
    * Teamwork or leadership experiences (if relevant from the CV).
5.  AVOID questions that are generic, too theoretical, repetitive, or whose answers are already very obvious from the CV (unless seeking profound elaboration).
6.  The question MUST be open-ended (not a yes/no answer).
7.  Use formal and professional English.
"""
        prompt = base_desc_en if language == "en" else base_desc_id

    else:  # Default: beasiswa
        base_desc_id = f"""
Anda adalah seorang Anggota Komite Seleksi Beasiswa "{scholarship_name}" yang sangat teliti dan berpengalaman. Anda sedang mewawancarai Saudara {username}.
{cv_info_id}
Riwayat Wawancara Sejauh Ini:
{history_block}

Jawaban Terbaru dari Pelamar atas Pertanyaan Terakhir:
"{user_answer}"

Tugas Anda (WAJIB DIPATUHI):
1.  Evaluasi jawaban terbaru pelamar DALAM KONTEKS ringkasan CV (jika tersedia) dan tujuan beasiswa "{scholarship_name}".
2.  Ajukan SATU pertanyaan lanjutan yang SANGAT TAJAM, profesional, dan bertujuan MENGUJI KEDALAMAN pemikiran pelamar.
3.  Jika CV tersedia, formulasikan pertanyaan yang secara cerdas menghubungkan informasi di CV dengan kriteria atau nilai-nilai beasiswa. Contoh: "Anda menulis di CV tentang keterlibatan Anda dalam kegiatan sosial Y. Bagaimana pengalaman tersebut membentuk perspektif Anda mengenai [nilai yang relevan dengan beasiswa]?"
4.  Fokus pertanyaan bisa pada:
    * Konsistensi antara tujuan studi jangka panjang, rencana kontribusi pasca-beasiswa, dan profil pelamar (termasuk CV).
    * Kekuatan personal yang unik dan bagaimana itu akan membantu kesuksesan studi dan kontribusi.
    * Pemahaman kritis pelamar terhadap isu yang relevan dengan bidang studi atau beasiswa.
    * Pengalaman spesifik dari CV yang menunjukkan potensi kepemimpinan atau kemampuan riset.
5.  HINDARI pertanyaan klise, standar, atau yang hanya mengulang informasi dari aplikasi/CV tanpa penggalian lebih lanjut.
6.  Pertanyaan HARUS bersifat terbuka dan memancing jawaban analitis.
7.  Gunakan bahasa Indonesia yang formal, lugas, dan berwibawa.
"""

        base_desc_en = f"""
You are a meticulous and experienced Scholarship Selection Committee Member for the "{scholarship_name}" scholarship. You are interviewing Mr./Ms. {username}.
{cv_info_en}
Interview History So Far:
{history_block}

The Applicant's Latest Answer to the Previous Question:
"{user_answer}"

Your Task (MANDATORY ADHERENCE):
1.  Evaluate the applicant's latest answer IN THE CONTEXT of their CV summary (if available) and the objectives of the "{scholarship_name}" scholarship.
2.  Ask ONE follow-up question that is HIGHLY INSIGHTFUL, professional, and aims to TEST THE DEPTH of the applicant's thinking.
3.  If a CV is available, formulate a question that intelligently links information from the CV to the scholarship's criteria or values. Example: "You mentioned in your CV your involvement in social activity Y. How has that experience shaped your perspective on [scholarship-relevant value]?"
4.  Your question can focus on:
    * Consistency between long-term study goals, post-scholarship contribution plans, and the applicant's profile (including CV).
    * Unique personal strengths and how they will contribute to academic success and future impact.
    * The applicant's critical understanding of issues relevant to their field of study or the scholarship's theme.
    * Specific experiences from the CV that demonstrate leadership potential or research aptitude.
5.  AVOID clichéd, standard questions, or those that merely repeat information from the application/CV without deeper probing.
6.  The question MUST be open-ended and designed to elicit an analytical response.
7.  Use formal, direct, and distinguished English.
"""
        prompt = base_desc_en if language == "en" else base_desc_id

    try:
        response = client.chat.completions.create(
            model="gpt-4o", # Tetap gunakan model yang canggih seperti gpt-4o
            messages=[
                {"role": "system", "content": "Anda adalah pewawancara ulung yang cerdas, kritis, dan sangat profesional. Tugas Anda adalah mengajukan pertanyaan yang tajam dan relevan untuk menggali kualitas serta potensi pelamar secara mendalam, dengan memperhatikan detail dari CV dan jawaban sebelumnya."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=250, # Cukup untuk satu pertanyaan
            temperature=0.6 # Sedikit turunkan temperature untuk pertanyaan yang lebih fokus dan profesional
        )
        question = response.choices[0].message.content.strip()
        return jsonify({"question": question})
    except Exception as e:
        print(f"[ERROR - /ask] {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/speak', methods=['POST'])
def speak():
    data = request.get_json()
    text = data.get('text', '').strip()

    if not text:
        return jsonify({"error": "Teks kosong tidak dapat dibacakan."}), 400

    try:
        tts_response = client.audio.speech.create(
            model="tts-1",
            voice="nova",
            instructions="Speak in a cheerful and positive tone tidak kaku",
            input=text
        )

        timestamp = str(int(time.time()))
        output_path = f"static/audio_{timestamp}.mp3"

        with open(output_path, "wb") as f:
            f.write(tts_response.content)
            
        delete_file_later(output_path, delay=30)

        return send_file(output_path, mimetype='audio/mpeg')
    except Exception as e:
        print("[ERROR - /speak]", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/evaluate', methods=['POST'])
def evaluate():
    import re, json

    data = request.get_json()
    answers = data.get('answers', [])
    username = data.get('username', 'pelamar')
    interview_type = data.get('interviewType', 'beasiswa')
    language = data.get('language', 'id')
    scholarship_name = data.get('scholarshipName', '')
    internship_position = data.get('internshipPosition', '')
    cv_summary = data.get('cv_summary', '')

    combined_answers = "\n".join([f"{i+1}. {ans}" for i, ans in enumerate(answers)])

    if interview_type == 'magang':
        prompt_id = f"""
Kamu adalah juri profesional dari perusahaan yang sedang mengevaluasi hasil wawancara pelamar magang bernama Saudara {username}, untuk posisi "{internship_position}".

Jika tersedia, berikut ringkasan CV pelamar:
{cv_summary if cv_summary else '(CV tidak tersedia)'}

Berikut jawaban dari sesi wawancaranya:
{combined_answers}

Beri skor untuk setiap jawaban dari 1–5 berdasarkan: relevansi terhadap posisi, kesiapan kerja, kejelasan komunikasi, dan kedalaman argumen.

Kemudian, hitung total skor dan berikan feedback singkat.

Format JSON:
{{
  "scores": [4, 4, 5, 3, 4],
  "total": 20,
  "feedback": "Pelamar cukup siap dan mampu menjelaskan motivasinya dengan baik. Disarankan untuk memperkuat contoh konkret terkait pengalaman kerja sebelumnya."
}}
"""

        prompt_en = f"""
You are a company recruiter evaluating the interview answers of an internship candidate named {username}, applying for the position of "{internship_position}".

CV Summary:
{cv_summary if cv_summary else '(No CV provided)'}

Interview Answers:
{combined_answers}

Evaluate each answer on a scale of 1–5 based on: relevance to the role, preparedness, clarity of communication, and depth of reasoning.

Then, calculate total score and give concise feedback.

JSON Format:
{{
  "scores": [4, 4, 5, 3, 4],
  "total": 20,
  "feedback": "The candidate is fairly prepared and articulated motivation clearly. Suggest adding concrete examples of prior work experience."
}}
"""

        prompt = prompt_en if language == 'en' else prompt_id

    else:  # default: beasiswa
        prompt_id = f"""
Kamu adalah juri profesional seleksi beasiswa "{scholarship_name}". Evaluasilah hasil wawancara pelamar bernama Saudara {username}.

Jika tersedia, berikut ringkasan CV pelamar:
{cv_summary if cv_summary else '(CV tidak tersedia)'}

Berikut jawaban wawancaranya:
{combined_answers}

Nilai setiap jawaban dengan skala 1–5 berdasarkan: kejelasan, kedalaman argumen, relevansi terhadap tujuan studi dan kontribusi sosial.

Lalu, berikan total skor dan satu paragraf feedback.

Format JSON:
{{
  "scores": [4, 4, 5, 4, 4],
  "total": 21,
  "feedback": "Pelamar menunjukkan motivasi kuat dan pemahaman mendalam terhadap visi beasiswa. Perlu memperkuat aspek rencana kontribusi pasca studi."
}}
"""

        prompt_en = f"""
You are a professional jury for the "{scholarship_name}" scholarship. Evaluate the interview responses of the candidate {username}.

CV Summary:
{cv_summary if cv_summary else '(No CV provided)'}

Interview Answers:
{combined_answers}

Score each answer (1–5) based on: clarity, depth of thought, relevance to study goals, and potential for social contribution.

Provide total score and concise feedback.

JSON Format:
{{
  "scores": [4, 4, 5, 4, 4],
  "total": 21,
  "feedback": "The candidate demonstrates strong motivation and good alignment with the scholarship’s vision. The post-study contribution plan could be stronger."
}}
"""
        prompt = prompt_en if language == 'en' else prompt_id

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Anda adalah juri evaluasi wawancara yang sangat teliti, kritis, dan profesional. Formatkan hasil secara rapi."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        content = response.choices[0].message.content.strip()
        json_block = re.search(r'{.*}', content, re.DOTALL)
        if not json_block:
            raise ValueError("Gagal menemukan JSON pada hasil evaluasi.")
        parsed = json.loads(json_block.group())
        return jsonify(parsed)
    except Exception as e:
        print("[ERROR - /evaluate]", str(e))
        return jsonify({"error": str(e)}), 500
    
@app.route('/transcribe', methods=['POST'])
def transcribe():
    try:
        audio_file = request.files['audio']
        if not audio_file:
            return jsonify({"error": "File audio tidak ditemukan"}), 400

        with open("temp_audio.webm", "wb") as f:
            f.write(audio_file.read())

        with open("temp_audio.webm", "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="text"
            )
        
        delete_file_later("temp_audio.webm", delay=30)

        return jsonify({"transcription": transcript})
    except Exception as e:
        print("[ERROR - /transcribe]", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/generate-essay-exchange-v2", methods=["POST"])
def generate_essay_exchange_v2():
    data = request.json
    email = data.get("email")
    
    # Mengambil semua data terstruktur dari frontend
    program_name = data.get("programName")
    destination = data.get("destination")
    academic_motivation = data.get("academicMotivation")
    personal_motivation = data.get("personalMotivation")
    relevant_skills = data.get("relevantSkills")
    future_contribution = data.get("futureContribution")

    # Validasi dasar
    if not all([email, program_name, destination, academic_motivation, personal_motivation, relevant_skills, future_contribution]):
        return jsonify({"error": "Data tidak lengkap. Semua kolom wajib diisi."}), 400

    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Cek status user (premium & token)
        cursor.execute("SELECT is_premium, tokens FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User tidak ditemukan"}), 404

        is_premium, tokens = user
        TOKEN_COST = 2 # Definisikan biaya token di sini

        if not is_premium:
            return jsonify({"error": "Fitur ini hanya untuk Pengguna Premium."}), 403
        
        if tokens < TOKEN_COST:
            return jsonify({"error": f"Token tidak cukup. Anda memerlukan {TOKEN_COST} token."}), 403

        # --- PROMPT BARU YANG JAUH LEBIH DETAIL ---
        # Prompt ini memanfaatkan semua input dari pengguna untuk hasil yang lebih personal.
        prompt = f"""
        Anda adalah seorang mentor beasiswa berpengalaman yang ahli dalam menyusun motivation letter untuk program pertukaran pelajar internasional.
        Tugas Anda adalah membuat draf motivation letter yang kuat, persuasif, dan terstruktur dengan baik berdasarkan informasi yang diberikan oleh seorang mahasiswa.

        Berikut adalah data mahasiswa tersebut:
        - Nama Program yang Dituju: {program_name}
        - Negara & Universitas Tujuan: {destination}
        - Motivasi Akademik: {academic_motivation}
        - Motivasi Pribadi & Kultural: {personal_motivation}
        - Skill & Pengalaman Relevan: {relevant_skills}
        - Rencana Kontribusi Pasca-Program: {future_contribution}

        Tolong buat draf motivation letter dalam Bahasa Inggris yang profesional dan menyentuh.
        Struktur esai harus mencakup:
        1.  **Paragraf Pembuka:** Perkenalkan diri secara singkat dan sebutkan dengan jelas program yang dituju serta antusiasme yang kuat.
        2.  **Paragraf Motivasi Akademik:** Jelaskan secara detail mengapa memilih universitas dan negara tersebut. Hubungkan dengan mata kuliah spesifik atau riset yang relevan dengan jurusan mahasiswa.
        3.  **Paragraf Motivasi Pribadi:** Ceritakan tentang keinginan untuk berkembang secara pribadi, belajar tentang budaya baru, dan bagaimana pengalaman ini akan membentuk karakter.
        4.  **Paragraf Kualifikasi:** Tonjolkan 2-3 skill atau pengalaman yang paling relevan yang membuat mahasiswa ini menjadi kandidat yang kuat dan cocok untuk program tersebut.
        5.  **Paragraf Kontribusi & Masa Depan:** Jelaskan rencana konkret setelah kembali ke Indonesia dan bagaimana ilmu yang didapat akan memberikan dampak positif bagi komunitas atau negara.
        6.  **Paragraf Penutup:** Ringkas kembali antusiasme dan kualifikasi, serta sampaikan harapan untuk dapat diterima di program tersebut dengan kalimat yang sopan dan percaya diri.

        Gaya bahasa harus formal, inspiratif, dan percaya diri. Hindari penggunaan bahasa gaul atau kalimat yang terlalu bertele-tele.
        Pastikan setiap paragraf mengalir dengan baik dan terhubung satu sama lain.
        """

        # Panggil fungsi generator AI Anda
        output = generate_openai_response(prompt) 

        # Kurangi token pengguna
        cursor.execute("UPDATE users SET tokens = tokens - ? WHERE email = ?", (TOKEN_COST, email,))
        conn.commit()
        
        # Kirim hasil kembali ke frontend dengan key 'essay'
        return jsonify({"essay": output}), 200

    except Exception as e:
        print(f"🚨 ERROR generate-essay-exchange-v2: {e}")
        return jsonify({"error": "Terjadi kegagalan di server saat membuat esai."}), 500
    finally:
        if conn:
            conn.close()

@app.route("/admin/update-user", methods=["POST"])
def update_user():
    try:
        data = request.get_json()
        email = data.get("email")
        tokens = data.get("tokens")
        is_premium = data.get("is_premium")

        conn = sqlite3.connect(DB_NAME, timeout=10)
        conn.execute('PRAGMA journal_mode=WAL;')
        cursor = conn.cursor()

        cursor.execute("UPDATE users SET tokens = ?, is_premium = ? WHERE email = ?", (tokens, is_premium, email))
        conn.commit()
        return jsonify({"message": "User updated"}), 200

    except Exception as e:
        print("🚨 UPDATE USER ERROR:", str(e))
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()

@app.route("/admin/delete-user", methods=["POST"])
def delete_user():
    data = request.json
    email = data.get("email")

    if not email:
        return jsonify({"message": "Email harus disertakan!"}), 400

    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"message": "User tidak ditemukan."}), 404

        cursor.execute("DELETE FROM users WHERE email = ?", (email,))
        conn.commit()
        return jsonify({"message": f"User dengan email {email} berhasil dihapus."}), 200

    except Exception as e:
        print("❌ ERROR delete user:", e)
        return jsonify({"message": "Terjadi kesalahan saat menghapus user."}), 500
    finally:
        conn.close()

@app.route("/admin/users", methods=["GET"])
def get_all_users():
    try:
        with sqlite3.connect(DB_NAME) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, email, is_premium, tokens FROM users")
            users = cursor.fetchall()
            return jsonify([
                {"id": row[0], "username": row[1], "email": row[2], "is_premium": row[3], "tokens": row[4]}
                for row in users
            ])
    except Exception as e:
        print("🚨 ADMIN USER FETCH ERROR:", e)
        return jsonify([])
    
# Tambahkan ini ke bawah semua route yang sudah ada di app.py

@app.route("/reduce-token", methods=["POST"])
def reduce_token():
    try:
        data = request.get_json()
        email = data.get("email")

        if not email:
            return jsonify({"error": "Email tidak ditemukan."}), 400

        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT tokens FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()

        if not row:
            return jsonify({"error": "User tidak ditemukan."}), 404

        current_token = row[0]
        if current_token <= 0:
            return jsonify({"error": "Token habis. Silakan isi ulang token kamu."}), 403

        new_token = current_token - 1
        cursor.execute("UPDATE users SET tokens = ? WHERE email = ?", (new_token, email))
        conn.commit()

        return jsonify({"success": True, "new_token": new_token}), 200

    except Exception as e:
        print("🚨 ERROR reduce-token:", e)
        return jsonify({"error": f"Gagal mengurangi token: {str(e)}"}), 500

    finally:
        conn.close()

@app.route("/analyze-ikigai-basic", methods=["POST"])
def analyze_ikigai_basic():
    data = request.get_json()
    email = data.get("email")
    nama = data.get("nama")
    jurusan = data.get("jurusan")
    sesuai_jurusan = data.get("sesuaiJurusan")
    mbti = data.get("mbti")
    via = data.get("via", [])
    career = data.get("career", [])

    if not all([email, nama, jurusan, mbti]) or len(via) < 3 or len(career) < 3:
        return jsonify({"error": "Data input tidak lengkap."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT is_premium, tokens FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User tidak ditemukan."}), 404

        is_premium, tokens = user
        if not is_premium:
            return jsonify({"error": "Fitur ini hanya untuk pengguna Premium."}), 403
        if tokens < TOKEN_COST_IKIGAI:
            return jsonify({"error": f"Token tidak cukup. Anda memerlukan {TOKEN_COST_IKIGAI} token."}), 403

        prompt = f"""
Bertindaklah sebagai gabungan ahli berikut:
1. Psikolog perkembangan (holistic self-awareness analysis)
2. Senior career coach (strategic life direction untuk mahasiswa)
3. Life growth strategist (refleksi to action transformation)
4. Gen Z mentor (relatable dan engaging communication)
5. Personality assessment expert (MBTI, VIA, Career Explorer interpretation)

DATA HASIL TES PENGGUNA:
- Nama: {nama}
- Jurusan: {jurusan}
- MBTI: {mbti}
- VIA Character Strength: {', '.join(via)}
- Career Explorer Role: {', '.join(career)}
- Ingin karir sesuai jurusan?: {sesuai_jurusan}

TUGAS UTAMA:
Berdasarkan data di atas, buatlah analisis Ikigai yang mendalam dengan struktur WAJIB berikut:

--- BAGIAN 1: IKIGAI SPOT & SLICE OF LIFE ---

**Ikigai Spot:**
(Buat 5 Ikigai Spot yang paling cocok dan relevan. Formatnya: **[Nama Role yang Catchy]:** Peran utama kamu adalah [definisi 1 kalimat]. Contoh konkret: [contoh yang relate dengan kehidupan mahasiswa].)

**Slice of Life Purpose:**
(Buat 5 Slice of Life Purpose yang paling sesuai dengan kombinasi karakter di atas. Gunakan format bebas casual seperti: 'Gue pengen bantu orang yang…'. Hindari kalimat klise dan normatif. Cukup satu kalimat per poin.)


--- BAGIAN 2: FRAMEWORK PEMETAAN IKIGAI ---

(Gunakan format narasi untuk menjelaskan setiap pilar. Buat dalam satu paragraf per pilar.)

**1. What You Love (Passion):**
(Ambil insight dari VIA Character Strength. Berikan interpretasi personal tentang apa yang membuat pengguna bersemangat berdasarkan kekuatan karakternya.)

**2. What You’re Good At (Mission):**
(Ambil insight dari MBTI. Jelaskan kemampuan alami (natural abilities) yang dimiliki pengguna berdasarkan tipe kepribadiannya dan bagaimana itu menjadi keahliannya.)

**3. What The World Needs (Vocation):**
(Ambil insight dari Career Explorer Roles. Jelaskan bagaimana peran-peran yang dipilih pengguna dapat memberikan dampak sosial (societal impact) yang dibutuhkan dunia saat ini.)

**4. What You Can Be Paid For (Profession):**
(Lihat dari peluang pasar (market opportunities) yang relevan dengan jurusan dan pilihan karir. Jelaskan potensi monetisasi (monetization potential) dari kombinasi keahlian dan minat pengguna.)

CATATAN GAYA BAHASA & FORMAT:
- Gunakan gaya bahasa yang ringan, hangat, dan membumi untuk mahasiswa.
- Tone harus relatable, tidak terlalu formal.
- Pastikan output terstruktur rapi sesuai permintaan di atas. Jangan menambahkan judul atau bagian lain.
"""
        result = generate_openai_response(prompt)
        
        def extract_list_from_text(keyword, text, max_items=5):
            pattern = rf"(?:\*\*)?{keyword}(?:\*\*)?:?\s*\n(.*?)(?=\n\n\*\*|\n---|\Z)"
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if not match:
                print(f"Warning: Keyword '{keyword}' tidak ditemukan dalam respons AI.")
                return []
            
            block = match.group(1).strip()
            lines = [re.sub(r'^[-\*•\d\.]+\s*', '', line).strip() for line in block.split("\n") if line.strip()]
            return lines[:max_items]

        spot_list = extract_list_from_text("Ikigai Spot", result)
        slice_list = extract_list_from_text("Slice of Life Purpose", result)

        if not spot_list: spot_list = ["Gagal mem-parsing Ikigai Spot. Silakan coba lagi atau lihat hasil lengkap di bawah."]*5
        if not slice_list: slice_list = ["Gagal mem-parsing Slice of Life. Silakan coba lagi atau lihat hasil lengkap di bawah."]*5
        
        return jsonify({
            "hasilPrompt": result,
            "spotList": spot_list,
            "sliceList": slice_list
        }), 200

    except Exception as e:
        print(f"[ERROR - /analyze-ikigai-basic] {str(e)}")
        return jsonify({"error": f"Terjadi kesalahan pada server: {str(e)}"}), 500
    finally:
        if conn: conn.close()

@app.route("/analyze-ikigai-final", methods=["POST"])
def analyze_ikigai_final():
    data = request.get_json()
    email = data.get("email")
    ikigai_spot = data.get("ikigaiSpot")
    slice_purpose = data.get("slicePurpose")
    # Mengambil data user yang dikirim dari frontend
    nama = data.get("nama")
    jurusan = data.get("jurusan")
    mbti = data.get("mbti")
    via = data.get("via", [])
    career = data.get("career", [])
    sesuai_jurusan = data.get("sesuaiJurusan", "YA")

    if not all([email, ikigai_spot, slice_purpose, nama, jurusan, mbti, via, career]):
        return jsonify({"error": "Data untuk analisis final tidak lengkap."}), 400

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT is_premium, tokens FROM users WHERE email = ?", (email,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User tidak ditemukan."}), 404

        is_premium, tokens = user
        if not is_premium:
            return jsonify({"error": "Fitur ini hanya untuk pengguna Premium."}), 403
        if tokens < TOKEN_COST_IKIGAI:
            return jsonify({"error": f"Token tidak cukup. Anda memerlukan {TOKEN_COST_IKIGAI} token."}), 403

        prompt = f"""
Bertindaklah sebagai gabungan 5 peran ahli berikut:
1. Psikolog perkembangan : analisis self-awareness holistik
2. Career coach senior : strategic life planning untuk mahasiswa
3. Life & growth strategist : transformasi refleksi menjadi aksi
4. Mentor konten Gen Z : komunikasi relatable dan engaging
5. Expert MBTI, VIA, Career Explorer : interpretasi tes kepribadian

Tugas kamu adalah membuat output final SWEET SPOT CAREER & BUSINESS berdasarkan data berikut:
- Nama Kamu: {nama}
- Jurusan Kamu: {jurusan}
- MBTI: {mbti}
- VIA Character Strength: {', '.join(via)}
- Career Explorer Role: {', '.join(career)}
- Ikigai Spot Pilihan: {ikigai_spot}
- Slice of Life Purpose Pilihan: {slice_purpose}
- Apakah mempertimbangkan jurusan? {sesuai_jurusan}

CATATAN PENTING UNTUK HASIL:
- Hindari istilah teknis berlebihan.
- Gunakan bahasa membumi, aplikatif, dan gaya bahasa ringan ala Gen Z.

STRUKTUR OUTPUT WAJIB DIIKUTI:

**1. Strategi Realistis Awal per Track**
(Buat dalam format narasi untuk setiap track: Employee Track, Self-Employed Track, Business Owner Track. Jika `sesuai_jurusan` adalah 'YA', tambahkan juga Jurusan-Based Track. Setiap narasi track harus diakhiri dengan sub-bagian `Bisa mulai sekarang?` yang berisi bentuk start yang realistis.)

**2. Penjabaran per Track**
(Buat penjabaran detail untuk setiap track yang muncul di bagian 1. Setiap track harus memuat:
- **Peran:** [Nama Peran]
- **Hard Skills (Top 3):**
  - [Skill 1]
  - [Skill 2]
  - [Skill 3]
- **Soft Skills (Top 3):**
  - [Skill 1]
  - [Skill 2]
  - [Skill 3]
- **Alasan Personal Match:** [Jelaskan dalam satu paragraf singkat mengapa track ini cocok dengan profil pengguna])

**3. CTA Penutup**
(Buat satu paragraf penutup yang mengajak pengguna untuk memilih 1 dari track di atas sebagai fokus utama untuk didalami saat ini.)
"""
        result = generate_openai_response(prompt)

        # Simpan ke track_ikigai
        cursor.execute("""
            INSERT INTO track_ikigai (email, nama, mbti, via, career, ikigai_spot, slice_purpose)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            email,
            nama,
            mbti,
            json.dumps(via),
            json.dumps(career),
            ikigai_spot,
            slice_purpose
        ))

        # Kurangi token setelah analisis basic dan final selesai
        cursor.execute("UPDATE users SET tokens = tokens - ? WHERE email = ?", (TOKEN_COST_IKIGAI, email))
        conn.commit()
        
        return jsonify({"result": result}), 200

    except Exception as e:
        print("[ERROR - /analyze-ikigai-final]", str(e))
        return jsonify({"error": f"Terjadi kesalahan pada server: {str(e)}"}), 500
    finally:
        if conn:
            conn.close()

@app.route("/admin/track-ikigai", methods=["GET"])
def track_ikigai():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT email, nama, mbti, via, career, ikigai_spot, slice_purpose, timestamp FROM track_ikigai ORDER BY timestamp DESC")
        rows = cursor.fetchall()
        conn.close()

        result = []
        for row in rows:
            result.append({
                "email": row[0],
                "nama": row[1],
                "mbti": row[2],
                "via": json.loads(row[3]),
                "career": json.loads(row[4]),
                "ikigai_spot": row[5],
                "slice_purpose": row[6],
                "timestamp": row[7]
            })

        return jsonify(result), 200
    except Exception as e:
        print("[ERROR - track_ikigai]", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/admin/add-user", methods=["POST"])
def add_user():
    data = request.json
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")  # Harus disimpan
    tokens = data.get("tokens", 0)
    is_premium = data.get("is_premium", 0)

    if not email or not username or not password:
        return jsonify({"error": "Data tidak lengkap"}), 400

    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    existing = cursor.fetchone()

    if existing:
        return jsonify({"error": "Email sudah terdaftar"}), 400

    cursor.execute("""
        INSERT INTO users (email, username, password, tokens, is_premium)
        VALUES (?, ?, ?, ?, ?)
    """, (email, username, hashed_pw, tokens, is_premium))
    conn.commit()
    conn.close()

    return jsonify({"message": "User berhasil ditambahkan."}), 200

@app.route('/admin/download-db', methods=['GET'])
def download_db():
    try:
        db_path = "webai.db"
        if os.path.exists(db_path):
            return send_file(db_path, as_attachment=True)
        else:
            return jsonify({"error": "File database tidak ditemukan."}), 404
    except Exception as e:
        print("❌ ERROR download DB:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/user/state', methods=['GET'])
def user_state():
    try:
        email = (request.args.get('email') or '').strip().lower()
        if not email:
            return jsonify({"error": "email parameter required"}), 400
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT username, tokens, is_premium, COALESCE(permanent_premium,0), premium_expires_at FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            return jsonify({"error": "user not found"}), 404
        username, tokens, is_premium, permanent_premium, premium_expires_at = row

        days_left = None
        updated = False
        if is_premium and not permanent_premium and premium_expires_at:
            try:
                exp = datetime.fromisoformat(premium_expires_at)
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                now_utc = datetime.now(timezone.utc)
                if now_utc > exp:
                    cursor.execute("UPDATE users SET is_premium = 0 WHERE email = ?", (email,))
                    conn.commit()
                    is_premium = 0
                    updated = True
                else:
                    delta = exp - now_utc
                    days_left = max(0, int(delta.total_seconds() // 86400))
            except Exception:
                days_left = None

        if updated:
            cursor.execute("SELECT tokens, is_premium FROM users WHERE email = ?", (email,))
            r2 = cursor.fetchone()
            if r2:
                tokens, is_premium = r2[0], r2[1]

        conn.close()
        return jsonify({
            "email": email,
            "username": username,
            "tokens": tokens,
            "is_premium": bool(is_premium),
            "permanent_premium": bool(permanent_premium),
            "premium_expires_at": premium_expires_at,
            "days_left": days_left,
            "will_expire_soon": (days_left is not None and days_left <= 7 and days_left > 0)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/payment/config', methods=['GET'])
def payment_config():
    try:
        # Client key aman untuk di-expose ke frontend sesuai panduan Midtrans
        return jsonify({
            "is_production": MIDTRANS_IS_PRODUCTION_CONFIG,
            "client_key": MIDTRANS_CLIENT_KEY_CONFIG or ""
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    debug_mode = os.environ.get("FLASK_DEBUG", "0").lower() in ["true", "1"]
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=debug_mode)



