# 📚 MyStore E-Commerce Platform

A fully functional, full-stack e-commerce application built from scratch. This project demonstrates a complete user journey from browsing products and adding them to a wishlist, to secure authentication, cart management, and a simulated checkout process. 

It features a robust relational database schema with a Python/Flask API handling the backend logic, and a dynamic, vanilla JavaScript frontend.

## ✨ Features

**For Users:**
* 🔐 **Secure Authentication:** User registration and login with hashed passwords and session tokens.
* 🛒 **Shopping Cart & Checkout:** Add items to the cart and process orders through a beautifully simulated MockStripe payment gateway.
* ❤️ **Wishlists:** Save books for later with optimistic UI updates and animated toggles.
* ⭐ **Reviews & Ratings:** Leave text reviews and dynamic star ratings on individual book pages.
* 🖼️ **Profile Management:** View purchase history, manage the wishlist, and upload custom profile pictures (with an integrated cropping tool).
* 🔍 **Smart Browsing:** Search bar, category filters, and pagination for smooth navigation.

**For Admins:**
* 📊 **Inventory Management:** A dedicated Admin Dashboard to add, update, and delete books dynamically.
* 🗄️ **Data Seeding:** A custom Python script using `Faker` to instantly generate and insert 1,000 realistic books into the database.
* 📡 **Telemetry & Activity Logging:** Tracks user clicks, cart additions, and profile views for future analytics.

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API, DOM Manipulation)
* **Backend:** Python, Flask, Flask-CORS, Werkzeug (Security)
* **Database:** PostgreSQL (`psycopg2` adapter)
* **Tools:** `python-dotenv` (Environment variables), `Faker` (Mock data generation), `Cropper.js` (Image cropping)

## 🚀 Getting Started

Follow these instructions to run the project on your local machine.

### 1. Prerequisites
* Python 3.x installed
* PostgreSQL installed and running on your machine

### 2. Database Setup
Create a new PostgreSQL database for the project:
```sql
CREATE DATABASE mystore;

cd backend
python -m venv .venv

# Activate the virtual environment
# On Windows:
.\.venv\Scripts\activate
# On Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install flask flask-cors psycopg2 werkzeug faker python-dotenv

DB_PASSWORD=your_actual_postgres_password_here

python admin_setup.py
python seeder.py
python app.py


Ecomdemo/
├── backend/
│   ├── app.py              # Main Flask API and routes
│   ├── admin_setup.py      # Database schema creation
│   ├── seeder.py           # Generates 1000 mock books
│   ├── .env                # Secure environment variables (ignored by git)
│   └── uploads/            # Stores user profile pictures
└── frontend/
    ├── index.html          # Main storefront
    ├── book.html           # Dedicated product details and reviews
    ├── profile.html        # User dashboard, orders, and wishlist
    ├── bestsellers.html    # Top 5 trending books
    ├── admin.html          # Inventory management
    ├── css/
    │   └── style.css       # Global styles and UI components
    └── js/
        ├── storefront.js   # Main store logic, cart, and checkout
        ├── book.js         # Single book page logic
        ├── profile.js      # User profile and image upload logic
        └── telemetry.js    # User activity tracking
