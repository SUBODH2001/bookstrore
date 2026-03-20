import psycopg2
from faker import Faker
import random
import os
from dotenv import load_dotenv

# Load the .env file
load_dotenv()
db_password = os.getenv("DB_PASSWORD")

db_connection_string = f"dbname=mystore user=postgres password={db_password}"
fake = Faker()

categories = ['Fiction', 'Non-Fiction', 'Sci-Fi', 'Fantasy', 'Mystery', 'Thriller', 'Romance', 'Biography', 'History', 'Technology', 'Science', 'Business', 'Self-Help']

def seed_books(num_books=1000):
    try:
        connection = psycopg2.connect(db_connection_string)
        cursor = connection.cursor()

        print(f"🚀 Generating {num_books} books...")
        books_data = []
        for _ in range(num_books):
            name = fake.catch_phrase().title()
            author = fake.name()
            price = round(random.uniform(9.99, 59.99), 2)
            stock = random.randint(0, 150)
            category = random.choice(categories)
            synopsis = fake.paragraph(nb_sentences=5)
            isbn = fake.isbn13()
            year = random.randint(1990, 2026)
            
            books_data.append((name, price, stock, category, author, synopsis, isbn, year))

        # Batch insert into the newly created products table
        cursor.executemany("""
            INSERT INTO products (name, price, stock_quantity, category, author, synopsis, isbn, published_year)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, books_data)

        connection.commit()
        print(f"✅ Successfully seeded {num_books} books into the database!")

    except Exception as error:
        print("❌ Error seeding database:", error)
    finally:
        if 'connection' in locals(): connection.close()

if __name__ == '__main__':
    seed_books()