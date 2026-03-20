# 📚 MyStore E-Commerce & Telemetry Platform

A full-stack, distributed e-commerce application demonstrating modern web architecture. This project features a robust relational database, secure authentication, an admin analytics dashboard, and a decoupled microservices architecture utilizing a high-throughput data ingestion pipeline.

## ✨ Key Features

**System Architecture & Engineering:**
* ⚙️ **Microservices Design:** Core e-commerce logic runs on a Python/Flask backend, while high-volume user telemetry is offloaded to a lightning-fast Go microservice.
* 🗄️ **Relational Data Modeling:** A strictly structured PostgreSQL database with complex table relationships (Users, Admin, Products, Orders, Reviews, Wishlists, Sessions, and Activity Logs).
* 🔄 **Automated Seeding & Teardown:** Custom Python scripts to completely wipe, rebuild, and seed the database with thousands of mock records instantly.

**Admin Dashboard:**
* 📊 **Live Analytics:** Visualizes real-time revenue, order volume, and category distribution using Chart.js.
* 📦 **Inline Inventory Management:** A seamless, single-page interface to add, update, and delete products without page reloads or modal popups.
* 🔒 **Role-Based Access Control:** Completely segregated Admin authentication and secure session tokens.

**User Experience:**
* 🛒 **Storefront & Checkout:** Dynamic product fetching, real-time filtering, pagination, and a simulated Stripe checkout experience.
* ❤️ **Wishlists & Reviews:** Optimistic UI updates for saving books and leaving star ratings.
* 🖼️ **Profile Management:** Users can view their order history and upload custom avatars directly to the server.

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API, DOM Manipulation, CSS Grid)
* **Core API (Backend):** Python, Flask, Flask-CORS, Werkzeug
* **Telemetry Microservice:** Go (Golang), Goroutines (Asynchronous logging)
* **Database:** PostgreSQL (`psycopg2` and `lib/pq` drivers)
* **Tools:** Chart.js, Faker, dotenv

## 📂 Project Structure

```text
Ecomdemo/
├── backend/                 # Main E-Commerce API (Port 5000)
│   ├── app.py               # Core Flask routes & checkout logic
│   ├── admin_setup.py       # Complete database schema builder
│   ├── seeder.py            # Generates 1,000+ mock books & users
│   ├── .env                 # Database credentials
│   └── uploads/             # Stores user profile pictures
├── telemetry-service/       # High-throughput Logging Microservice (Port 8080)
│   ├── main.go              # Go server utilizing background goroutines
│   ├── go.mod / go.sum      # Go dependencies
│   └── .env                 # Database credentials
└── frontend/                # Vanilla JS Web Application
    ├── index.html           # Main storefront
    ├── book.html            # Dedicated product details & reviews
    ├── profile.html         # User dashboard & order history
    ├── bestsellers.html     # Trending analytics view
    ├── admin.html           # Secure executive dashboard
    ├── css/
    │   └── style.css        # Global styles
    ├── js/
    │   ├── storefront.js    # Core UI, cart, and auth logic
    │   ├── admin.js         # Chart rendering and inventory control
    │   └── telemetry.js     # Silent asynchronous event tracker
    └── images/              # Static assets and favicons
