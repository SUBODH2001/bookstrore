import psycopg2
import os
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

load_dotenv()
db_password = os.getenv("DB_PASSWORD")
db_connection_string = f"dbname=mystore user=postgres password={db_password}"

def setup_database():
    try:
        connection = psycopg2.connect(db_connection_string)
        cursor = connection.cursor()
        
        print("🧹 Wiping old database tables (if they exist)...")
        # 1. DROP ALL TABLES (CASCADE ensures dependent tables are safely dropped)
        cursor.execute("DROP TABLE IF EXISTS activity_log CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS wishlist CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS reviews CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS orders CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS sessions CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS products CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS admin_users CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS users CASCADE;")

        print("🏗️ Creating fresh tables...")

        # 2. CREATE CORE USERS TABLES
        cursor.execute("""
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                profile_pic VARCHAR(255)
            );
        """)

        cursor.execute("""
            CREATE TABLE admin_users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL
            );
        """)

        cursor.execute("""
            CREATE TABLE sessions (
                id SERIAL PRIMARY KEY,
                token VARCHAR(255) UNIQUE NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 3. CREATE STORE INVENTORY TABLES
        cursor.execute("""
            CREATE TABLE products (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                author VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                stock_quantity INTEGER NOT NULL,
                category VARCHAR(100) DEFAULT 'Uncategorized',
                synopsis TEXT,
                isbn VARCHAR(20),
                published_year INTEGER
            );
        """)

        # 4. CREATE TRANSACTION & INTERACTION TABLES
        cursor.execute("""
            CREATE TABLE orders (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        cursor.execute("""
            CREATE TABLE reviews (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, product_id)
            );
        """)

        cursor.execute("""
            CREATE TABLE wishlist (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, product_id)
            );
        """)

        cursor.execute("""
            CREATE TABLE activity_log (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                action VARCHAR(100) NOT NULL,
                details JSONB,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cursor.execute("""
            CREATE TABLE admin_sessions (
                id SERIAL PRIMARY KEY,
                token VARCHAR(255) UNIQUE NOT NULL,
                admin_id INTEGER REFERENCES admin_users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 5. INJECT DEFAULT ADMIN ACCOUNT
        print("👤 Creating default admin account...")
        admin_password_hash = generate_password_hash("admin") # Default password is 'admin'
        cursor.execute(
            "INSERT INTO admin_users (username, password_hash) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
            ('admin', admin_password_hash)
        )

        connection.commit()
        print("✅ Database setup complete! All tables are ready.")
        print("👉 Next step: Run 'python seeder.py' to populate the store with books.")
        
    except Exception as error:
        print("❌ Error setting up database:", error)
    finally:
        if 'connection' in locals(): connection.close()

if __name__ == '__main__':
    setup_database()