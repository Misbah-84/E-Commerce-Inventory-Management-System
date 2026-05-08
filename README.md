# Ecommerce Dashboard (Semester Project)

This repository contains my semester project: an **Amazon Seller Central style Ecommerce Dashboard**.

## Overview
This application provides a full-featured dashboard for an e-commerce platform. It was recently overhauled from Streamlit to a **Flask REST API** backend with a modern **Single Page Application (SPA)** frontend built using **Vanilla JavaScript (ES6+), HTML5, and Tailwind CSS**.

## Key Features
- **Dashboard**: Real-time KPI metrics (Revenue, Orders, Low Stock Alerts) and visual sales trends using Chart.js.
- **Inventory Manager**: Searchable and paginated inventory table. Includes the ability to Add/Edit products and process sales (Point of Sale).
- **Departments**: Product catalog grouped by category.
- **Payments Ledger**: Chronological log of all transactions fetched directly from the database.
- **ACID Transactions**: Secure sale processing ensuring that the MongoDB database confirms the transaction before the UI reflects the change.

## Tech Stack
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS, Chart.js, FontAwesome
- **Backend**: Python, Flask, Flask-CORS
- **Database**: MongoDB (via PyMongo)

## How to Run Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/Misbah-84/ecommerce_dashboard.git
   ```
2. Navigate to the project directory:
   ```bash
   cd ecommerce_dashboard
   ```
3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the Flask server:
   ```bash
   python app.py
   ```
5. Open your web browser and navigate to `http://127.0.0.1:5000/`.
