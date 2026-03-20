from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import psycopg2
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2.errors
import uuid # For generating unique session tokens
import os
from werkzeug.utils import secure_filename
import json
from dotenv import load_dotenv



app = Flask(__name__)
CORS(app)
load_dotenv()

# Create an 'uploads' folder in your backend directory if it doesn't exist
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- Route to let the browser view the saved images ---
@app.route('/uploads/<filename>')
def get_uploaded_image(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

def get_db_connection():
    # UPDATE YOUR PASSWORD HERE:
    db_password = os.getenv("DB_PASSWORD")
    return psycopg2.connect(f"dbname=mystore user=postgres password={db_password}")

# ==========================================
# 1. USER AUTHENTICATION ROUTES
# ==========================================

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"message": "Username and password required"}), 400

    hashed_pw = generate_password_hash(password)
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("INSERT INTO users (username, password_hash) VALUES (%s, %s)", (username, hashed_pw))
        connection.commit()
        return jsonify({"message": "Account created! You can now log in."}), 201
    except psycopg2.IntegrityError:
        return jsonify({"message": "Username already exists!"}), 400
    finally:
        if 'connection' in locals(): connection.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT id, password_hash FROM users WHERE username = %s", (username,))
        user = cursor.fetchone()
        
        if user and check_password_hash(user[1], password):
            session_token = str(uuid.uuid4())
            cursor.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (session_token, user[0]))
            connection.commit()
            
            return jsonify({"message": f"Welcome back, {username}!", "token": session_token, "username": username}), 200
        else:
            return jsonify({"message": "Invalid username or password"}), 401
    finally:
        if 'connection' in locals(): connection.close()


# ==========================================
# 2. STOREFRONT & BOOK ROUTES
# ==========================================

@app.route('/categories', methods=['GET'])
def get_categories():
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute("SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category;")
    categories = [row[0] for row in cursor.fetchall()]
    connection.close()
    return jsonify(categories)


@app.route('/books', methods=['GET'])
def get_books():
    page = int(request.args.get('page', 1))
    limit = 20
    offset = (page - 1) * limit
    search_query = request.args.get('search', '').strip()
    category_filter = request.args.get('category', 'All')
    
    sql = """
        SELECT p.id, p.name, p.price, p.stock_quantity, p.category, 
               COALESCE(ROUND(AVG(r.rating), 1), 0) as avg_rating,
               COUNT(r.id) as review_count
        FROM products p
        LEFT JOIN reviews r ON p.id = r.product_id
        WHERE 1=1
    """
    params = []
    
    if search_query:
        sql += " AND p.name ILIKE %s"
        params.append(f"%{search_query}%")
    if category_filter != 'All':
        sql += " AND p.category = %s"
        params.append(category_filter)
        
    sql += " GROUP BY p.id ORDER BY p.id LIMIT %s OFFSET %s;"
    params.extend([limit, offset])
    
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(sql, tuple(params))
    books_data = cursor.fetchall()
    connection.close()
    
    books_list = [{
        "id": b[0], "name": b[1], "price": b[2], "stock": b[3], "category": b[4],
        "rating": float(b[5]), "reviews": b[6]
    } for b in books_data]
    
    return jsonify(books_list)


@app.route('/trending', methods=['GET'])
def get_trending():
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute("""
        SELECT p.id, p.name, p.price, p.stock_quantity, p.category, COUNT(o.id) as sales,
               COALESCE(ROUND(AVG(r.rating), 1), 0) as avg_rating,
               COUNT(DISTINCT r.id) as review_count
        FROM products p
        LEFT JOIN orders o ON p.id = o.product_id
        LEFT JOIN reviews r ON p.id = r.product_id
        GROUP BY p.id
        ORDER BY sales DESC LIMIT 5;
    """)
    trending_data = cursor.fetchall()
    connection.close()
    
    trending_list = [{
        "id": b[0], "name": b[1], "price": b[2], "stock": b[3], "category": b[4], 
        "sales": b[5], "rating": float(b[6]), "reviews": b[7]
    } for b in trending_data]
    return jsonify(trending_list)


# --- NEW: Fetch a Single Book's Details ---
@app.route('/books/<int:book_id>', methods=['GET'])
def get_book_details(book_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        sql = """
            SELECT p.id, p.name, p.author, p.price, p.stock_quantity, p.category, 
                   p.synopsis, p.isbn, p.published_year,
                   COALESCE(ROUND(AVG(r.rating), 1), 0) as avg_rating,
                   COUNT(r.id) as review_count
            FROM products p
            LEFT JOIN reviews r ON p.id = r.product_id
            WHERE p.id = %s
            GROUP BY p.id;
        """
        cursor.execute(sql, (book_id,))
        b = cursor.fetchone()
        
        if not b: return jsonify({"message": "Book not found"}), 404
            
        book_data = {
            "id": b[0], "name": b[1], "author": b[2], "price": b[3], 
            "stock": b[4], "category": b[5], "synopsis": b[6], 
            "isbn": b[7], "year": b[8],
            "rating": float(b[9]), "reviews": b[10]
        }
        return jsonify(book_data), 200
    finally:
        if 'connection' in locals(): connection.close()


# --- NEW: Fetch All Reviews for a Book ---
@app.route('/books/<int:book_id>/reviews', methods=['GET'])
def get_book_reviews(book_id):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        sql = """
            SELECT u.username, r.rating, r.comment, r.created_at 
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = %s
            ORDER BY r.created_at DESC;
        """
        cursor.execute(sql, (book_id,))
        reviews_data = cursor.fetchall()
        
        reviews_list = [{
            "username": r[0],
            "rating": r[1],
            "comment": r[2] if r[2] else "",
            "date": r[3].strftime("%B %d, %Y")
        } for r in reviews_data]
        
        return jsonify(reviews_list), 200
    finally:
        if 'connection' in locals(): connection.close()


# ==========================================
# 3. CHECKOUT & ORDERS ROUTES
# ==========================================

@app.route('/checkout', methods=['POST'])
def checkout():
    data = request.json
    token = request.headers.get('Authorization') 
    cart_items = data.get('cart') 
    
    if not token or not cart_items:
        return jsonify({"message": "Invalid request or empty cart"}), 400

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
        user_session = cursor.fetchone()
        
        if not user_session:
            return jsonify({"message": "Please log in to checkout!"}), 401

        current_user_id = user_session[0]

        for item in cart_items:
            product_id = item['id']
            cursor.execute("SELECT stock_quantity, name FROM products WHERE id = %s", (product_id,))
            product = cursor.fetchone()

            if not product or product[0] < 1:
                connection.rollback() 
                return jsonify({"message": f"Checkout failed! '{product[1]}' is out of stock."}), 400

            cursor.execute("UPDATE products SET stock_quantity = stock_quantity - 1 WHERE id = %s", (product_id,))
            cursor.execute(
                "INSERT INTO orders (product_id, user_id) VALUES (%s, %s)", 
                (product_id, current_user_id)
            )

        connection.commit()
        return jsonify({"message": "Checkout successful! Your books are on the way."}), 200

    except Exception as error:
        print("Checkout Error:", error)
        if 'connection' in locals():
            connection.rollback()
        return jsonify({"message": "Server error during checkout."}), 500
    finally:
        if 'connection' in locals():
            connection.close()


@app.route('/all-orders', methods=['GET'])
def get_all_orders():
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        query = """
            SELECT o.id AS order_id, u.username, p.name AS book_name, p.price, o.order_date 
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            JOIN products p ON o.product_id = p.id
            ORDER BY o.order_date DESC;
        """
        cursor.execute(query)
        orders_data = cursor.fetchall()
        
        orders_list = []
        for order in orders_data:
            orders_list.append({
                "order_id": order[0],
                "username": order[1] if order[1] else "Guest / Unknown",
                "book_name": order[2],
                "price": order[3],
                "date": order[4].strftime("%B %d, %Y at %I:%M %p") if order[4] else "Unknown"
            })
            
        return jsonify(orders_list), 200
    finally:
        if 'connection' in locals(): connection.close()


@app.route('/my-orders', methods=['GET'])
def get_my_orders():
    token = request.headers.get('Authorization')
    if not token: return jsonify({"message": "Unauthorized"}), 401

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
        user_session = cursor.fetchone()
        if not user_session: return jsonify({"message": "Invalid session."}), 401
            
        user_id = user_session[0]

        query = """
            SELECT o.id, p.name, p.price, o.order_date 
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.user_id = %s
            ORDER BY o.order_date DESC;
        """
        cursor.execute(query, (user_id,))
        orders_data = cursor.fetchall()
        
        orders_list = [{
            "order_id": order[0], "book_name": order[1], "price": order[2],
            "date": order[3].strftime("%B %d, %Y") if order[3] else "Unknown"
        } for order in orders_data]
            
        return jsonify(orders_list), 200
    finally:
        if 'connection' in locals(): connection.close()


# ==========================================
# 4. ADMIN INVENTORY MANAGEMENT ROUTES
# ==========================================

# --- UPDATED: Add Book (Now accepts author, synopsis, etc.) ---
@app.route('/add-book', methods=['POST'])
def add_book():
    data = request.json
    entered_password = data.get('password')
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT password_hash FROM admin_users WHERE username = 'admin'")
        result = cursor.fetchone()
        if not result or not check_password_hash(result[0], entered_password):
            return jsonify({"message": "Access Denied: Incorrect Password!"}), 401

        name = data.get('name')
        price = data.get('price')
        stock = data.get('stock')
        category = data.get('category', 'Uncategorized')
        author = data.get('author', 'Unknown Author')
        synopsis = data.get('synopsis', 'No synopsis provided.')
        isbn = data.get('isbn', '000-0000000000')
        year = data.get('year', 2026)
        
        cursor.execute(
            """INSERT INTO products (name, price, stock_quantity, category, author, synopsis, isbn, published_year) 
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (name, price, stock, category, author, synopsis, isbn, year)
        )
        connection.commit()
        return jsonify({"message": f"Added '{name}' to the database!"}), 201
    except Exception as error:
        if 'connection' in locals(): connection.rollback()
        return jsonify({"message": "Failed to add book."}), 500
    finally:
        if 'connection' in locals(): connection.close()

# --- UPDATED: Update Book (Now accepts author, synopsis, etc.) ---
@app.route('/update-book/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    data = request.json
    entered_password = data.get('password')
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT password_hash FROM admin_users WHERE username = 'admin'")
        result = cursor.fetchone()
        if not result or not check_password_hash(result[0], entered_password):
            return jsonify({"message": "Access Denied!"}), 401

        name = data.get('name')
        price = data.get('price')
        stock = data.get('stock')
        category = data.get('category', 'Uncategorized')
        author = data.get('author', 'Unknown Author')
        synopsis = data.get('synopsis', 'No synopsis provided.')
        isbn = data.get('isbn', '000-0000000000')
        year = data.get('year', 2026)
        
        cursor.execute(
            """UPDATE products SET name = %s, price = %s, stock_quantity = %s, category = %s, 
               author = %s, synopsis = %s, isbn = %s, published_year = %s WHERE id = %s""",
            (name, price, stock, category, author, synopsis, isbn, year, book_id)
        )
        connection.commit()
        return jsonify({"message": f"Successfully updated '{name}'!"}), 200
    except Exception as error:
        if 'connection' in locals(): connection.rollback()
        return jsonify({"message": "Failed to update."}), 500
    finally:
        if 'connection' in locals(): connection.close()


@app.route('/delete-book/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    data = request.json
    entered_password = data.get('password')
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT password_hash FROM admin_users WHERE username = 'admin'")
        result = cursor.fetchone()
        if not result or not check_password_hash(result[0], entered_password):
            return jsonify({"message": "Access Denied: Incorrect Password!"}), 401

        cursor.execute("DELETE FROM products WHERE id = %s", (book_id,))
        connection.commit()
        return jsonify({"message": "Book permanently deleted."}), 200

    except psycopg2.IntegrityError:
        if 'connection' in locals(): connection.rollback()
        return jsonify({"message": "Cannot delete: Customers have already ordered this book. Please update the stock to 0 instead."}), 400
    except Exception as error:
        if 'connection' in locals(): connection.rollback()
        return jsonify({"message": "Server error while deleting."}), 500
    finally:
        if 'connection' in locals(): connection.close()


# ==========================================
# 5. USER PROFILE & ACTIVITY ROUTES
# ==========================================

@app.route('/my-profile', methods=['GET'])
def get_my_profile():
    token = request.headers.get('Authorization')
    if not token: return jsonify({"message": "Unauthorized"}), 401

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
        user_session = cursor.fetchone()
        if not user_session: return jsonify({"message": "Invalid session."}), 401

        cursor.execute("SELECT username, profile_pic FROM users WHERE id = %s", (user_session[0],))
        user_data = cursor.fetchone()
        
        return jsonify({
            "username": user_data[0],
            "profile_pic": user_data[1] 
        }), 200
    finally:
        if 'connection' in locals(): connection.close()


@app.route('/upload-avatar', methods=['POST'])
def upload_avatar():
    token = request.headers.get('Authorization')
    if not token: return jsonify({"message": "Unauthorized"}), 401

    if 'file' not in request.files:
        return jsonify({"message": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "No file selected"}), 400

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
        user_session = cursor.fetchone()
        if not user_session: return jsonify({"message": "Invalid session"}), 401
        
        user_id = user_session[0]
        filename = secure_filename(f"user_{user_id}_{file.filename}")
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)

        cursor.execute("UPDATE users SET profile_pic = %s WHERE id = %s", (filename, user_id))
        connection.commit()

        return jsonify({"message": "Profile picture updated!", "filename": filename}), 200
    except Exception as error:
        print("Upload Error:", error)
        return jsonify({"message": "Server error during upload."}), 500
    finally:
        if 'connection' in locals(): connection.close()


@app.route('/submit-review', methods=['POST'])
def submit_review():
    token = request.headers.get('Authorization')
    if not token: return jsonify({"message": "You must be logged in to review."}), 401
    
    data = request.json
    product_id = data.get('product_id')
    rating = data.get('rating')
    comment = data.get('comment', '')

    if not rating or not (1 <= int(rating) <= 5):
        return jsonify({"message": "Rating must be between 1 and 5."}), 400

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
        user_session = cursor.fetchone()
        if not user_session: return jsonify({"message": "Invalid session."}), 401
        user_id = user_session[0]

        cursor.execute(
            "INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (%s, %s, %s, %s)",
            (user_id, product_id, rating, comment)
        )
        connection.commit()
        return jsonify({"message": "Thank you for your review!"}), 201
        
    except Exception as error:
        if 'connection' in locals(): connection.rollback()
        if "unique constraint" in str(error).lower():
            return jsonify({"message": "You have already reviewed this book!"}), 400
        return jsonify({"message": "Server error submitting review."}), 500
    finally:
        if 'connection' in locals(): connection.close()


@app.route('/log-activity', methods=['POST'])
def log_activity():
    token = request.headers.get('Authorization')
    if not token: return jsonify({"message": "Ghost activity ignored"}), 200
    
    data = request.json
    action = data.get('action')
    details = data.get('details', {})

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
        user_session = cursor.fetchone()
        
        if user_session:
            user_id = user_session[0]
            cursor.execute(
                "INSERT INTO activity_log (user_id, action, details) VALUES (%s, %s, %s)",
                (user_id, action, json.dumps(details))
            )
            connection.commit()
            
        return jsonify({"status": "logged"}), 200
    except Exception as e:
        print(f"Logging error: {e}")
        return jsonify({"status": "error"}), 500
    finally:
        if 'connection' in locals(): connection.close()    

# --- NEW: Toggle Wishlist (Add/Remove) ---
@app.route('/wishlist/toggle', methods=['POST'])
def toggle_wishlist():
    token = request.headers.get('Authorization')
    if not token: return jsonify({"message": "You must be logged in to save books."}), 401
    
    data = request.json
    product_id = data.get('product_id')

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Identify user
        cursor.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
        user_session = cursor.fetchone()
        if not user_session: return jsonify({"message": "Invalid session."}), 401
        user_id = user_session[0]

        # Check if it's already in the wishlist
        cursor.execute("SELECT id FROM wishlist WHERE user_id = %s AND product_id = %s", (user_id, product_id))
        existing = cursor.fetchone()

        if existing:
            # If it exists, remove it (Toggle Off)
            cursor.execute("DELETE FROM wishlist WHERE id = %s", (existing[0],))
            message = "Removed from wishlist 💔"
            action = "removed"
        else:
            # If it doesn't exist, add it (Toggle On)
            cursor.execute("INSERT INTO wishlist (user_id, product_id) VALUES (%s, %s)", (user_id, product_id))
            message = "Saved to wishlist ❤️"
            action = "added"

        connection.commit()
        return jsonify({"message": message, "action": action}), 200
        
    except Exception as error:
        print("Wishlist Error:", error)
        if 'connection' in locals(): connection.rollback()
        return jsonify({"message": "Server error updating wishlist."}), 500
    finally:
        if 'connection' in locals(): connection.close()

# --- NEW: Fetch User's Wishlist ---
@app.route('/my-wishlist', methods=['GET'])
def get_my_wishlist():
    token = request.headers.get('Authorization')
    if not token: return jsonify({"message": "Unauthorized"}), 401

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        cursor.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
        user_session = cursor.fetchone()
        if not user_session: return jsonify({"message": "Invalid session."}), 401
        user_id = user_session[0]

        # Join the wishlist with the products table to get book details
        query = """
            SELECT p.id, p.name, p.author, p.price, w.created_at
            FROM wishlist w
            JOIN products p ON w.product_id = p.id
            WHERE w.user_id = %s
            ORDER BY w.created_at DESC;
        """
        cursor.execute(query, (user_id,))
        wishlist_data = cursor.fetchall()
        
        wishlist_list = [{
            "id": item[0], "name": item[1], "author": item[2], "price": item[3],
            "date_added": item[4].strftime("%B %d, %Y")
        } for item in wishlist_data]
            
        return jsonify(wishlist_list), 200
    finally:
        if 'connection' in locals(): connection.close()

# --- NEW: Admin Analytics Dashboard Data ---
@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    token = request.headers.get('Authorization')
    
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # 1. Verify Admin (Basic check for this example)
        cursor.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
        if not cursor.fetchone(): 
            return jsonify({"message": "Unauthorized"}), 401

        # 2. Get Summary Stats
        cursor.execute("SELECT COUNT(*) FROM orders")
        total_orders = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM users")
        total_users = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COALESCE(SUM(p.price), 0) 
            FROM orders o 
            JOIN products p ON o.product_id = p.id
        """)
        total_revenue = cursor.fetchone()[0]

        # 3. Get Top 5 Books (For Bar Chart)
        cursor.execute("""
            SELECT p.name, COUNT(o.id) as sales
            FROM orders o
            JOIN products p ON o.product_id = p.id
            GROUP BY p.name
            ORDER BY sales DESC
            LIMIT 5
        """)
        top_books = [{"name": row[0], "sales": row[1]} for row in cursor.fetchall()]

        # 4. Get Sales by Category (For Doughnut Chart)
        cursor.execute("""
            SELECT p.category, COUNT(o.id) as sales
            FROM orders o
            JOIN products p ON o.product_id = p.id
            GROUP BY p.category
            HAVING COUNT(o.id) > 0
        """)
        category_sales = [{"category": row[0], "sales": row[1]} for row in cursor.fetchall()]

        return jsonify({
            "total_orders": total_orders,
            "total_users": total_users,
            "total_revenue": float(total_revenue),
            "top_books": top_books,
            "category_sales": category_sales
        }), 200

    except Exception as error:
        print("Analytics Error:", error)
        return jsonify({"message": "Server error fetching analytics."}), 500
    finally:
        if 'connection' in locals(): connection.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)