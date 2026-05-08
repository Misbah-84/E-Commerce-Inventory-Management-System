from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pymongo
import time
import os

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

MONGO_URI = "mongodb+srv://misbah-ullah:1012311891@cluster0.ias0chn.mongodb.net/"
client = pymongo.MongoClient(MONGO_URI)
db = client["EcommerceDB"]
products_col = db["products"]
orders_col = db["orders"]
payments_col = db["payments"]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    try:
        sales_pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}]
        total_sales_value = list(orders_col.aggregate(sales_pipeline))
        total_sales = total_sales_value[0]["total"] if total_sales_value else 0
        total_orders = orders_col.count_documents({})
        low_stock_count = products_col.count_documents({"stock": {"$lt": 10}})
        
        # Data for charts
        orders = list(orders_col.find({}, {"_id": 0}))
        products = list(products_col.find({}, {"_id": 1, "category": 1}))
        
        # aggregate revenue by category
        revenue_by_cat = {}
        status_dist = {}
        
        for order in orders:
            status = order.get("status", "Unknown")
            status_dist[status] = status_dist.get(status, 0) + 1
            
            p_id = order.get("product_id")
            p_cat = next((p["category"] for p in products if p["_id"] == p_id), "Unknown")
            
            revenue_by_cat[p_cat] = revenue_by_cat.get(p_cat, 0) + order.get("total_amount", 0)

        return jsonify({
            "total_sales": total_sales,
            "total_orders": total_orders,
            "low_stock_count": low_stock_count,
            "charts": {
                "revenue_by_category": revenue_by_cat,
                "status_distribution": status_dist
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        search = request.args.get('search', '')
        
        query = {}
        if search:
            query = {"$or": [{"name": {"$regex": search, "$options": "i"}}, {"_id": {"$regex": search, "$options": "i"}}]}
            
        skip = (page - 1) * limit
        total = products_col.count_documents(query)
        items = list(products_col.find(query).skip(skip).limit(limit))
        
        return jsonify({
            "items": items,
            "total": total,
            "page": page,
            "limit": limit
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/inventory/add', methods=['POST'])
def add_product():
    try:
        data = request.json
        if products_col.find_one({"_id": data["_id"]}):
            return jsonify({"error": "Product ID already exists."}), 400
            
        products_col.insert_one(data)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/inventory/edit/<product_id>', methods=['PUT'])
def edit_product(product_id):
    try:
        data = request.json
        if "_id" in data:
            del data["_id"]
            
        products_col.update_one({"_id": product_id}, {"$set": data})
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/departments', methods=['GET'])
def get_departments():
    try:
        pipeline = [
            {"$group": {
                "_id": "$category",
                "products": {"$push": "$$ROOT"}
            }}
        ]
        departments = list(products_col.aggregate(pipeline))
        return jsonify(departments)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/payments', methods=['GET'])
def get_payments():
    try:
        payments = list(payments_col.find({}, {"_id": 0}))
        payments.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
        return jsonify(payments)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/sales/process', methods=['POST'])
def process_sale():
    try:
        data = request.json
        product_id = data.get("product_id")
        qty = int(data.get("qty", 1))
        
        product = products_col.find_one({"_id": product_id})
        if not product:
            return jsonify({"error": "Product not found"}), 404
            
        if product["stock"] < qty:
            return jsonify({"error": f"Insufficient stock! Available: {product['stock']}"}), 400
            
        with client.start_session() as session:
            with session.start_transaction():
                products_col.update_one(
                    {"_id": product_id},
                    {"$inc": {"stock": -qty}},
                    session=session
                )
                t_amount = product["price"] * qty
                oid = f"ORD-{int(time.time()*100)}"
                orders_col.insert_one({
                    "_id": oid,
                    "product_id": product_id,
                    "qty": qty,
                    "status": "Delivered",
                    "total_amount": t_amount
                }, session=session)
                payments_col.insert_one({
                    "order_id": oid,
                    "amount": t_amount,
                    "status": "Cleared",
                    "timestamp": time.time()
                }, session=session)
                
        return jsonify({
            "success": True, 
            "message": f"Sale successful! System synced: {qty} x {product['name']} for ${t_amount:,.2f}."
        })
    except pymongo.errors.OperationFailure as e:
        return jsonify({"error": f"Transaction conflict: {e}"}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    app.run(debug=True, port=5000)
