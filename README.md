# E-Commerce-Inventory-Management-System

**E-Commerce-Inventory-Management-System** is a professional-grade full-stack suite designed to manage inventory, sales, and analytics. Developed for the **Advanced Database Management System Lab** at the **Institute of Space Technology (IST)**, the system features a custom **HTML5/JavaScript** frontend and a **Python Flask REST API** integrated with **MongoDB Atlas**.

## 🚀 Key Features
* **Dashboard:** Real-time KPI metrics (Revenue, Orders, Low Stock Alerts) and visual sales trends using Chart.js.
* **Inventory Manager:** Searchable and paginated inventory table with the ability to Add/Edit products and process point-of-sale transactions.
* **Departments:** Product catalog dynamically grouped by category (e.g., Electronics, Home, Toys).
* **Payments Ledger:** A chronological log of all transactions fetched directly from the database.
* [cite_start]**ACID Transactions:** Secure sale processing ensuring that the MongoDB database confirms the transaction before the UI reflects the change[cite: 16, 55].

## 🛠️ Tech Stack
* [cite_start]**Database:** MongoDB 7.x (Cloud Cluster hosted on **MongoDB Atlas**)[cite: 39, 83].
* [cite_start]**Backend:** Python (**Flask**) utilizing the **PyMongo** driver[cite: 40, 41, 84].
* **Frontend:** **HTML5**, **CSS3 (Tailwind)**, and **Vanilla JavaScript (ES6)** for a professional Single Page Application (SPA) experience.
* [cite_start]**Analytics:** **Chart.js** for real-time business intelligence reporting[cite: 43].

## 📁 Project Structure
The repository is organized into a modular full-stack architecture:

* **📁 Root Directory**
    * `app.py`: The heart of the backend. Runs the Flask Server and exposes REST API endpoints that connect to MongoDB to fetch data and process ACID transactions.
    * [cite_start]`requirements.txt`: Lists all Python packages (Flask, Flask-CORS, PyMongo, etc.)[cite: 40, 41].
    * `README.md`: The front page of the repository containing project details and instructions.
    * `.gitignore`: Prevents temporary files and environment folders (like `venv/`) from being pushed to GitHub.
* **📁 templates/**
    * `index.html`: The main foundation of the frontend (SPA). Includes the layout, top navigation bar, and modal pop-ups.
* **📁 static/**
    * **js/app.js:** The brain of the frontend. Handles tab routing, API fetching, and dynamic rendering of Chart.js graphs.
    * **css/styles.css:** Custom CSS for smooth transitions, KPI card styling, and red-highlighting for low-stock items.

## ⚙️ How to Run Locally
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Misbah-84/E-Commerce-Inventory-Management-System.git](https://github.com/Misbah-84/E-Commerce-Inventory-Management-System.git)
Install Dependencies:

Bash
pip install -r requirements.txt
Configure Database:
Update the MONGO_URI in app.py with your MongoDB Atlas connection string.

Run Application:

Bash
python app.py
Access the App: Open http://127.0.0.1:5000/ in your browser.

👥 Project Team

**Misbah Ullah**

**Muhammad Hamas Khan**

**Mahraib Qaisar Dar**

Submitted To: **Ma'am Shakira Musa Baig**


Course: **Advanced Database Management System Lab**
