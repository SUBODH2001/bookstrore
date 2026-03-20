import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_password = os.getenv("DB_PASSWORD")
# UPDATE YOUR PASSWORD HERE
db_connection_string = f"dbname=mystore user=postgres password={db_password}"

def setup_database():
    try:
        connection = psycopg2.connect(db_connection_string)
        cursor = connection.cursor()
        
        print("🧹 Wiping old product data...")
        # 1. DROP OLD TABLES (Clean slate!)
        cursor.execute("DROP TABLE IF EXISTS reviews CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS orders CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS products CASCADE;")

        # 2. RECREATE PRODUCTS (Now with Author, Synopsis, ISBN, Year!)
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

        # 3. RECREATE ORDERS
        cursor.execute("""
            CREATE TABLE orders (
                id SERIAL PRIMARY KEY,
                product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # 4. RECREATE REVIEWS
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

        connection.commit()
        print("✅ New Schema Applied: Products, Orders, and Reviews are ready!")
        
    except Exception as error:
        print("❌ Error setting up database:", error)
    finally:
        if 'connection' in locals(): connection.close()

if __name__ == '__main__':
    setup_database()