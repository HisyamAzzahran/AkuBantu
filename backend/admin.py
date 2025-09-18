import sqlite3
import bcrypt
import os
from datetime import datetime, timezone # Pastikan timezone diimport jika ada default CURRENT_TIMESTAMP yang butuh aware datetime

DB_NAME = "webai.db"

def create_connection_and_delete_if_forced(db_file, force_new=False):
    """ 
    Membuat koneksi database. 
    Jika force_new True dan file ada, file akan dihapus dulu setelah konfirmasi.
    """
    if force_new:
        print(f"\nPERINGATAN: Mode 'FORCE_CREATE_NEW_DB' aktif.")
        print(f"File database '{db_file}' yang sudah ada akan dihapus untuk membuat yang baru.")
        user_confirmation = input(f"Apakah Anda yakin ingin menghapus '{db_file}' dan membuat ulang? (ketik 'ya' untuk melanjutkan): ").strip().lower()
        if user_confirmation != 'ya':
            print("Setup database dibatalkan oleh pengguna.")
            return None # Batalkan jika tidak dikonfirmasi
        
        if os.path.exists(db_file):
            try:
                print(f"Menghapus database lama: {db_file}...")
                os.remove(db_file)
                print(f"Database '{db_file}' berhasil dihapus.")
            except OSError as e:
                print(f"[File Deletion Error] Gagal menghapus '{db_file}': {e}")
                print("Pastikan file tidak sedang digunakan oleh proses lain dan Anda memiliki izin.")
                return None 

    conn = None
    try:
        conn = sqlite3.connect(db_file)
        print(f"\nSQLite version: {sqlite3.version}")
        print(f"Berhasil membuat atau terhubung ke database: '{os.path.abspath(db_file)}'")
    except sqlite3.Error as e:
        print(f"[DB Connection Error] {e}")
    return conn

def create_all_tables(conn):
    """ Membuat semua tabel yang dibutuhkan jika belum ada """
    if conn is None:
        print("Koneksi database tidak valid, tidak bisa membuat tabel.")
        return

    cursor = conn.cursor()
    print("\nMemeriksa dan membuat tabel jika diperlukan...")

    tables_sql = {
        "users": """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                is_premium INTEGER DEFAULT 0,
                is_admin INTEGER DEFAULT 0,
                tokens INTEGER DEFAULT 0
            );
        """,
        "otp_codes": """
            CREATE TABLE IF NOT EXISTS otp_codes (
                email TEXT PRIMARY KEY,
                otp_code TEXT NOT NULL,
                username_temp TEXT NOT NULL,
                password_hash_temp TEXT NOT NULL, 
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """,
        "feature_log": """
            CREATE TABLE IF NOT EXISTS feature_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                feature TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """,
        "track_ikigai": """
            CREATE TABLE IF NOT EXISTS track_ikigai (
                id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, nama TEXT NOT NULL,
                mbti TEXT NOT NULL, via TEXT NOT NULL, career TEXT NOT NULL,
                ikigai_spot TEXT NOT NULL, slice_purpose TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """,
        "track_swot": """
            CREATE TABLE IF NOT EXISTS track_swot (
              id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, nama TEXT NOT NULL,
              mbti TEXT NOT NULL, via1 TEXT NOT NULL, via2 TEXT NOT NULL, via3 TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """,
        "student_goals_plans": """
            CREATE TABLE IF NOT EXISTS student_goals_plans (
                id TEXT PRIMARY KEY, user_email TEXT NOT NULL, nama_input TEXT NOT NULL,
                jurusan_input TEXT NOT NULL, semester_input_awal INTEGER NOT NULL,
                mode_action_input TEXT NOT NULL, swot_file_ref TEXT, ikigai_file_ref TEXT,
                target_semester_plan INTEGER NOT NULL, plan_content TEXT NOT NULL,
                is_initial_data_source BOOLEAN DEFAULT FALSE, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_email) REFERENCES users(email)
            );
        """,
        "app_orders": """
    CREATE TABLE IF NOT EXISTS app_orders (
        order_id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        item_id TEXT NOT NULL,      -- Pastikan ini ada
        item_name TEXT NOT NULL,    -- Pastikan ini ada
        quantity INTEGER NOT NULL DEFAULT 1, -- Pastikan ini ada
        amount INTEGER NOT NULL, 
        status TEXT NOT NULL, 
        items_json TEXT,            -- Ini yang error, pastikan ada
        snap_token TEXT, 
        midtrans_transaction_id TEXT, 
        payment_type TEXT, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users(email)
    );
"""
    }

    for table_name, sql_command in tables_sql.items():
        try:
            cursor.execute(sql_command)
            print(f"Tabel '{table_name}' berhasil dicek/dibuat.")
        except sqlite3.Error as e:
            print(f"[DB Table Creation Error for {table_name}] {e}")
    
    conn.commit()
    print("Struktur semua tabel selesai diperiksa/dibuat.")

def insert_user(conn, user_data, force_new_db):
    """ Menambahkan user baru. Jika force_new_db=False, gunakan INSERT OR IGNORE. """
    if conn is None:
        print(f"Koneksi database tidak valid, gagal menambahkan user {user_data['email']}.")
        return

    hashed_password_bytes = bcrypt.hashpw(user_data['password'].encode('utf-8'), bcrypt.gensalt())
    hashed_password_str = hashed_password_bytes.decode('utf-8')
    
    params = (
        user_data['username'], 
        user_data['email'], 
        hashed_password_str, 
        user_data['is_premium'], 
        user_data['is_admin'], 
        user_data['tokens']
    )

    # Jika FORCE_CREATE_NEW_DB adalah True, kita berasumsi tabel baru saja dibuat dan kosong,
    # jadi INSERT biasa sudah cukup. Jika False, berarti bisa jadi ada data lama,
    # maka INSERT OR IGNORE lebih aman untuk mencegah error jika email sudah ada.
    if force_new_db:
        sql = ''' INSERT INTO users(username, email, password, is_premium, is_admin, tokens)
                  VALUES(?,?,?,?,?,?) '''
    else:
        sql = ''' INSERT OR IGNORE INTO users(username, email, password, is_premium, is_admin, tokens)
                  VALUES(?,?,?,?,?,?) '''
    
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        if cur.rowcount > 0:
            print(f"User '{user_data['username']}' ({user_data['email']}) berhasil dijadwalkan untuk penambahan.")
        elif not force_new_db:
            print(f"User '{user_data['username']}' ({user_data['email']}) kemungkinan sudah ada (diabaikan).")
        # conn.commit() akan dipanggil sekali di akhir setelah semua user di-loop
    except sqlite3.Error as e:
        print(f"[DB User Insert Error for {user_data['email']}] {e}")

def main():
    # SET True UNTUK SELALU MEMBUAT DATABASE BARU DARI AWAL (MENGHAPUS YANG LAMA JIKA ADA)
    # SET False UNTUK MENGGUNAKAN DATABASE YANG ADA ATAU MEMBUAT BARU JIKA BELUM ADA (TANPA MENGHAPUS)
    FORCE_CREATE_NEW_DB = True  # Anda bisa ubah ini ke False jika tidak ingin selalu menghapus DB lama
    
    print(f"Memulai script setup_database.py untuk database '{DB_NAME}'...")
    
    conn = create_connection_and_delete_if_forced(DB_NAME, force_new=FORCE_CREATE_NEW_DB)

    if conn:
        create_all_tables(conn) # Membuat semua tabel yang diperlukan

        users_to_add = [
            {
                'email': 'hisyamjunior898@gmail.com', 'username': 'Samm', 
                'password': 'Hisy@m123', 'is_premium': 1, 'is_admin': 1, 'tokens': 999 
            },
            {
                'email': 'user123@mail.com', 'username': 'User123', 
                'password': 'user123', 'is_premium': 1, 'is_admin': 0, 'tokens': 70
            },
            {
                'email': 'Elevated@mail.com', 'username': 'AkuBantu', 
                'password': 'Eleva123', 'is_premium': 1, 'is_admin': 0, 'tokens': 70
            },
            {
                'email': 'mapresunpad25@gmail.com', 'username': 'MapresUnpad25', 
                'password': 'MapresUnpad25', 'is_premium': 1, 'is_admin': 0, 'tokens': 20
            }
            # Tambahkan pengguna lain di sini jika perlu
        ]

        print("\nMenambahkan data pengguna awal...")
        for user_data_item in users_to_add:
            insert_user(conn, user_data_item, FORCE_CREATE_NEW_DB)
        
        try:
            conn.commit() # Commit semua insert user sekali di akhir
            print("Semua data pengguna telah berhasil diproses dan di-commit.")
        except sqlite3.Error as e:
            print(f"[DB Commit Error for Users] {e}")
            conn.rollback() # Rollback jika gagal commit

        print("\nProses setup database selesai.")
        conn.close()
        print(f"Koneksi ke database '{DB_NAME}' ditutup.")
    else:
        print("Gagal melakukan setup database karena koneksi tidak dapat dibuat/dihubungi.")

    db_file_exists = os.path.exists(DB_NAME)
    print(f"Status akhir: Apakah file '{DB_NAME}' ada di '{os.path.abspath(DB_NAME)}'? -> {'Ada' if db_file_exists else 'TIDAK ADA'}")

if __name__ == '__main__':
    main()
