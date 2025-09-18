import sqlite3
import bcrypt

# Data user
username = "user123"
email = "user123@mail.com"
password = "user123"
hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# Koneksi ke database
conn = sqlite3.connect("database.db")
cursor = conn.cursor()

try:
    cursor.execute(
        "INSERT INTO users (username, email, password, is_premium) VALUES (?, ?, ?, ?)",
        (username, email, hashed_pw, 1)
    )
    conn.commit()
    print("✅ User 'user123' berhasil ditambahkan sebagai premium.")
except sqlite3.IntegrityError as e:
    print("⚠️ User sudah ada atau gagal ditambahkan:", e)
finally:
    conn.close()
