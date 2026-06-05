from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pymongo
import time
import os
import json
from bson import json_util
from functools import wraps

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# ==============================================================================
# --- DISTRIBUTED DATA MODELING & SHARDING LOGIC CONFIGURATION (Conceptual) ---
# ==============================================================================
# In a production horizontal scale environment:
# 1. 'products' Collection:
#    - Shard Key: Hashed Shard Key on the 'category' field.
#    - Rationale: Categories are highly diversified, distributing active read and 
#      write queries evenly across the shard keyspace, avoiding write hotspots.
# 2. 'orders' Collection:
#    - Shard Key: Ranged Shard Key on the 'created_at' timestamp field.
#    - Rationale: Facilitates chronologically organized queries and range-based 
#      temporal analytical scans across cluster shards.
# ==============================================================================

MONGO_URIs = [
    "mongodb+srv://misbah-ullah:1012311891@cluster0.ias0chn.mongodb.net/?serverSelectionTimeoutMS=3000&connectTimeoutMS=3000",
    "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000&connectTimeoutMS=2000"
]

client = None
db = None

# Connect with Atlas auto-fallback
for uri in MONGO_URIs:
    try:
        display_uri = uri.split('@')[-1] if '@' in uri else uri
        print(f"[DB INIT] Connecting to MongoDB: {display_uri}")
        temp_client = pymongo.MongoClient(uri)
        # Verify connection by pinging
        temp_client.admin.command('ping')
        client = temp_client
        print(f"[DB INIT] Successfully connected to cluster: {display_uri}")
        break
    except Exception as e:
        print(f"[DB INIT] Connection attempt failed: {e}")

if not client:
    print("[DB INIT] Warning: Falling back to local MongoDB default instance.")
    client = pymongo.MongoClient("mongodb://127.0.0.1:27017/")

db = client["OmniChannelDB"]
products_col = db["products"]
customers_col = db["customers"]
orders_col = db["orders"]
payments_col = db["payments"]
users_col = db["users"]

# Programmatic physical B-Tree Index verification
def verify_physical_indices():
    try:
        # Index on products category
        products_col.create_index([("category", pymongo.ASCENDING)])
        # Compound index on orders matching {customer_id: 1, created_at: -1}
        orders_col.create_index([("customer_id", pymongo.ASCENDING), ("created_at", pymongo.DESCENDING)])
        print("[DB INDEX] B-Tree indices verified and configured successfully.")
    except Exception as e:
        print(f"[DB INDEX] Index creation warning: {e}")

verify_physical_indices()

# Role-Based Access Control Decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        role = request.headers.get("X-Role", "Customer")
        if role != "Admin":
            return jsonify({"error": "Forbidden: Administrator access required."}), 403
        return f(*args, **kwargs)
    return decorated_function

# --- SECURITY STRATEGY: PASSWORD-BASED AUTHENTICATION ---
@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    try:
        data = request.json or {}
        email = data.get("email", "").strip()
        password = data.get("password", "").strip()
        
        if not email or not password:
            return jsonify({"error": "Email and password are required fields."}), 400
            
        user = users_col.find_one({"email": email})
        if not user or user.get("password") != password:
            return jsonify({"error": "Invalid email or password."}), 401
            
        return jsonify({
            "success": True,
            "email": user["email"],
            "role": user["role"],
            "customer_id": user.get("customer_id", "CUST-101")
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Serve SPA
@app.route('/')
def index():
    return render_template('index.html')

# --- INVENTORY & PRODUCTS CATALOG ---
@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 50))
        search = request.args.get('search', '')
        category = request.args.get('category', 'all')
        
        query = {}
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]
            # Support searching by numeric ID if query is numeric
            if search.isdigit():
                query["$or"].append({"id": int(search)})
        
        if category and category != 'all':
            query["category"] = {"$regex": f"^{category}$", "$options": "i"}
            
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

# --- SECURE SALE PROCESS: ACID TRANSACTION ---
@app.route('/api/sales/process', methods=['POST'])
def process_sale():
    try:
        data = request.json or {}
        # Support string or integer product id
        raw_product_id = data.get("product_id")
        try:
            product_id = int(raw_product_id)
        except (ValueError, TypeError):
            product_id = raw_product_id
            
        qty = int(data.get("qty", 1))
        customer_id = request.headers.get("X-Customer-ID", "CUST-101")
        customer_email = request.headers.get("X-Customer-Email", "customer@ist.edu.pk")
        
        # Ensure customer document exists
        customer = customers_col.find_one({"_id": customer_id})
        if not customer:
            customers_col.insert_one({
                "_id": customer_id,
                "email": customer_email,
                "name": "OmniChannel Partner"
            })
            customer = {"_id": customer_id, "email": customer_email, "name": "OmniChannel Partner"}
            
        attempts = 0
        max_attempts = 3
        use_transaction = True
        
        while attempts < max_attempts:
            attempts += 1
            try:
                if use_transaction:
                    with client.start_session() as session:
                        with session.start_transaction():
                            # a) Read stock within transaction boundary
                            product = products_col.find_one({"$or": [{"id": product_id}, {"_id": product_id}]}, session=session)
                            if not product:
                                session.abort_transaction()
                                return jsonify({"error": "Product not found."}), 404
                                
                            if product.get("stock", 0) < qty:
                                session.abort_transaction()
                                return jsonify({"error": f"Insufficient stock! Available: {product.get('stock', 0)}"}), 400
                            
                            # b) Optimistic stock decrement
                            res = products_col.update_one(
                                {"_id": product["_id"], "stock": {"$gte": qty}},
                                {"$inc": {"stock": -qty}},
                                session=session
                            )
                            if res.modified_count == 0:
                                session.abort_transaction()
                                raise pymongo.errors.OperationFailure("Write conflict detected under isolation levels.", 112)
                            
                            # c) Order creation
                            t_amount = product["price"] * qty
                            oid = f"ORD-{int(time.time()*1000)}"
                            now = time.time()
                            
                            order_doc = {
                                "_id": oid,
                                "customer_id": customer_id,
                                "customer_email": customer.get("email", "customer@ist.edu.pk"),
                                "created_at": now,
                                "status": "Cleared",
                                "total_amount": t_amount,
                                "line_items": [{
                                    "product_id": product_id,
                                    "name": product["name"],
                                    "category": product["category"],
                                    "qty": qty,
                                    "price": product["price"],
                                    "image_url": product.get("image_url", "")
                                }]
                            }
                            orders_col.insert_one(order_doc, session=session)
                            
                            # d) Ledger accounting log
                            payments_col.insert_one({
                                "order_id": oid,
                                "customer_id": customer_id,
                                "amount": t_amount,
                                "status": "Processed",
                                "timestamp": now
                            }, session=session)
                            
                            # Commit transaction
                            session.commit_transaction()
                            
                    return jsonify({
                        "success": True, 
                        "message": f"ACID Transaction Complete! Processed {qty}x {product['name']} on Atlas."
                    })
                else:
                    # Non-transactional atomic workflow (Local standalone fallback)
                    product = products_col.find_one({"$or": [{"id": product_id}, {"_id": product_id}]})
                    if not product:
                        return jsonify({"error": "Product not found."}), 404
                        
                    if product.get("stock", 0) < qty:
                        return jsonify({"error": f"Insufficient stock! Available: {product.get('stock', 0)}"}), 400
                    
                    # Atomic optimistic update
                    res = products_col.update_one(
                        {"_id": product["_id"], "stock": {"$gte": qty}},
                        {"$inc": {"stock": -qty}}
                    )
                    if res.modified_count == 0:
                        raise pymongo.errors.OperationFailure("Optimistic conflict detected.", 112)
                    
                    t_amount = product["price"] * qty
                    oid = f"ORD-{int(time.time()*1000)}"
                    now = time.time()
                    
                    order_doc = {
                        "_id": oid,
                        "customer_id": customer_id,
                        "customer_email": customer.get("email", "customer@ist.edu.pk"),
                        "created_at": now,
                        "status": "Cleared",
                        "total_amount": t_amount,
                        "line_items": [{
                            "product_id": product_id,
                            "name": product["name"],
                            "category": product["category"],
                            "qty": qty,
                            "price": product["price"],
                            "image_url": product.get("image_url", "")
                        }]
                    }
                    orders_col.insert_one(order_doc)
                    
                    payments_col.insert_one({
                        "order_id": oid,
                        "customer_id": customer_id,
                        "amount": t_amount,
                        "status": "Processed",
                        "timestamp": now
                    })
                    
                    return jsonify({
                        "success": True, 
                        "message": f"Atomic Update Complete! Processed {qty}x {product['name']} (Standalone Fallback)."
                    })
                    
            except pymongo.errors.ConnectionFailure:
                print("Transient Connection Failure. Retrying transaction...")
                continue
            except pymongo.errors.OperationFailure as e:
                err_msg = str(e)
                # Check if transaction numbers are not allowed (standalone database without replica set)
                if "transaction" in err_msg.lower() or "replica set" in err_msg.lower() or "not allowed" in err_msg.lower() or e.code == 20:
                    print("Standalone MongoDB detected. Downgrading to atomic non-transactional fallback...")
                    use_transaction = False
                    attempts = 0 # Reset attempts for fallback path
                    continue
                
                # Retry transient conflict errors
                if e.has_error_label("TransientTransactionError"):
                    print("TransientTransactionError label detected. Retrying transaction...")
                    continue
                else:
                    return jsonify({"error": f"Transaction conflict: {err_msg}"}), 409
            except Exception as e:
                return jsonify({"error": str(e)}), 500
                
        return jsonify({"error": "Transaction aborted after reaching maximum conflict retry attempts."}), 409
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- BUSINESS INTELLIGENCE AGGREGATION & ANALYTICS ---
@app.route('/api/dashboard/analytics', methods=['GET'])
@admin_required
def dashboard_analytics():
    try:
        # Pipeline 1: Category revenue metrics using sum and multiply stage
        revenue_pipeline = [
            {"$unwind": "$line_items"},
            {"$group": {
                "_id": "$line_items.category",
                "total_revenue": {"$sum": {"$multiply": ["$line_items.qty", "$line_items.price"]}}
            }},
            {"$sort": {"total_revenue": -1}}
        ]
        revenue_by_cat = list(orders_col.aggregate(revenue_pipeline))
        
        # Format names beautifully
        for cat in revenue_by_cat:
            if not cat["_id"]:
                cat["_id"] = "Other"
            cat["_id"] = str(cat["_id"]).capitalize()
            
        # Pipeline 2: Logistics counts
        logistics_pipeline = [
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        logistics_status = list(orders_col.aggregate(logistics_pipeline))
        
        total_orders = orders_col.count_documents({})
        low_stock_count = products_col.count_documents({"stock": {"$lt": 10}})
        
        # Calculate Grand Revenue Sum
        revenue_sum_pipeline = [
            {"$group": {
                "_id": None,
                "total": {"$sum": "$total_amount"}
            }}
        ]
        rev_sum_res = list(orders_col.aggregate(revenue_sum_pipeline))
        total_sales = rev_sum_res[0]["total"] if rev_sum_res else 0
        
        return jsonify({
            "total_sales": total_sales,
            "total_orders": total_orders,
            "low_stock_count": low_stock_count,
            "revenue_by_category": revenue_by_cat,
            "logistics_status": logistics_status
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- PHYSICAL QUERY OPTIMIZATION & EXPLAIN LAB ---
@app.route('/api/performance/profile', methods=['GET'])
@admin_required
def performance_profile():
    try:
        query_type = request.args.get('type', 'category')
        
        # Use explain command natively to profile winningPlan and executionStats
        if query_type == "category":
            cat_to_search = request.args.get('category', 'electronics')
            explain_result = db.command({
                "explain": {
                    "find": "products",
                    "filter": {"category": {"$regex": f"^{cat_to_search}$", "$options": "i"}}
                },
                "verbosity": "executionStats"
            })
        else:
            cust_id = request.args.get('customer_id', 'CUST-101')
            explain_result = db.command({
                "explain": {
                    "find": "orders",
                    "filter": {"customer_id": cust_id},
                    "sort": {"created_at": -1}
                },
                "verbosity": "executionStats"
            })
            
        # Sanitize explain result using json_util to prevent JSON serialization errors
        explain_result = json.loads(json_util.dumps(explain_result))
            
        ex_stats = explain_result.get("executionStats", {})
        exec_time = ex_stats.get("executionTimeMillis", 0)
        docs_ex = ex_stats.get("totalDocsExamined", 0)
        
        query_planner = explain_result.get("queryPlanner", {})
        winning_plan = query_planner.get("winningPlan", {})
        
        def find_stage_recursive(plan):
            if not plan:
                return "UNKNOWN"
            stage = plan.get("stage", "UNKNOWN")
            if stage in ["IXSCAN", "COLLSCAN"]:
                return stage
            if "inputStage" in plan:
                return find_stage_recursive(plan["inputStage"])
            if "inputStages" in plan:
                for sub in plan["inputStages"]:
                    res = find_stage_recursive(sub)
                    if res in ["IXSCAN", "COLLSCAN"]:
                        return res
            return stage
            
        stage = find_stage_recursive(winning_plan)
             
        return jsonify({
            "executionTimeMillis": exec_time,
            "totalDocsExamined": docs_ex,
            "stage": stage,
            "raw": explain_result
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- ADMIN CRUD OPERATIONS ---
@app.route('/api/inventory/add', methods=['POST'])
@admin_required
def add_product():
    try:
        data = request.json or {}
        p_id = data.get("id")
        if not p_id:
            return jsonify({"error": "Product ID (id) is required."}), 400
            
        # Coerce IDs to integer
        try:
            p_id = int(p_id)
        except ValueError:
            pass
            
        if products_col.find_one({"$or": [{"id": p_id}, {"_id": p_id}]}):
            return jsonify({"error": f"Product ID {p_id} already exists."}), 400
            
        data["id"] = p_id
        data["_id"] = p_id
        products_col.insert_one(data)
        return jsonify({"success": True, "message": "Product created in matrix successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/inventory/edit/<product_id>', methods=['PUT'])
@admin_required
def edit_product(product_id):
    try:
        # Coerce product ID to integer if possible
        try:
            pid = int(product_id)
        except ValueError:
            pid = product_id
            
        data = request.json or {}
        if "_id" in data:
            del data["_id"]
        if "id" in data:
            del data["id"]
            
        res = products_col.update_one({"$or": [{"id": pid}, {"_id": pid}]}, {"$set": data})
        if res.matched_count == 0:
            return jsonify({"error": "Product not found."}), 404
            
        return jsonify({"success": True, "message": "Product stock levels synchronized."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- CORE CRUD EXTENSION: PROGRAMMATIC HARD DELETE ---
@app.route('/api/inventory/delete/<int:product_id>', methods=['DELETE'])
@admin_required
def delete_product(product_id):
    try:
        # Enforce db.products.delete_one({"id": product_id}) as required
        res = products_col.delete_one({"id": product_id})
        
        # Also clean by _id fallback
        if res.deleted_count == 0:
            res = products_col.delete_one({"_id": product_id})
            
        if res.deleted_count == 0:
            return jsonify({"error": "Product not found in system matrix."}), 404
            
        return jsonify({"success": True, "message": f"Product ID {product_id} deleted successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/payments', methods=['GET'])
@admin_required
def get_payments():
    try:
        payments = list(payments_col.find({}, {"_id": 0}).sort("timestamp", -1))
        return jsonify(payments)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/orders/mine', methods=['GET'])
def get_my_orders():
    try:
        customer_id = request.headers.get("X-Customer-ID", "CUST-101")
        orders = list(orders_col.find({"customer_id": customer_id}).sort("created_at", -1))
        return jsonify(orders)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- BASELINE SEED ROUTE ---
@app.route('/api/seed', methods=['POST'])
def seed_database():
    try:
        # Wipe structural database records
        products_col.delete_many({})
        orders_col.delete_many({})
        payments_col.delete_many({})
        customers_col.delete_many({})
        users_col.delete_many({})
        
        # 1. Seed exact academic benchmark products
        products_data = [
            {
                "_id": 101,
                "id": 101,
                "name": "Sony WH-1000XM5 ANC Headphones",
                "category": "electronics",
                "price": 85000,
                "stock": 14,
                "description": "Industry-leading noise-canceling wireless over-ear headphones.",
                "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80"
            },
            {
                "_id": 102,
                "id": 102,
                "name": "Mechanical Gaming Keyboard (RGB)",
                "category": "electronics",
                "price": 12500,
                "stock": 4,
                "description": "Tactile blue-switch mechanical keyboard. [LOW STOCK TESTING FIELD]",
                "image_url": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80"
            },
            {
                "_id": 103,
                "id": 103,
                "name": "Anker PowerCore 24K Power Bank",
                "category": "electronics",
                "price": 18500,
                "stock": 1,
                "description": "Ultra-high capacity external battery. [CRITICAL BOUNDARY FIELD: Stock exactly 1]",
                "image_url": "https://images.unsplash.com/photo-1609592424085-f5b2257d47f2?w=600&q=80"
            },
            {
                "_id": 201,
                "id": 201,
                "name": "Premium Egyptian Cotton Oxford Shirt",
                "category": "apparel",
                "price": 4500,
                "stock": 45,
                "description": "Classic fit breathable formal shirt woven from premium extra-long staple cotton.",
                "image_url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80"
            },
            {
                "_id": 202,
                "id": 202,
                "name": "Waterproof All-Weather Windbreaker",
                "category": "apparel",
                "price": 8900,
                "stock": 8,
                "description": "Triple-layer membrane insulation built for extreme rain resistance. [LOW STOCK FIELD]",
                "image_url": "https://images.unsplash.com/photo-1544923246-77307dd654cb?w=600&q=80"
            },
            {
                "_id": 301,
                "id": 301,
                "name": "Smart Digital Air Fryer (5.5L)",
                "category": "appliances",
                "price": 28000,
                "stock": 22,
                "description": "Oil-free convection cooker featuring 8 rapid touchscreen pre-sets.",
                "image_url": "https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?w=600&q=80"
            },
            {
                "_id": 302,
                "id": 302,
                "name": "Robot Vacuum Cleaner with Auto-Mop",
                "category": "appliances",
                "price": 65000,
                "stock": 3,
                "description": "LiDAR-guided smart home autonomous floor cleaner. [LOW STOCK FIELD]",
                "image_url": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&q=80"
            }
        ]
        products_col.insert_many(products_data)
        
        # 2. Seed Baseline User Identity Credentials
        users_col.insert_many([
            {
                "email": "admin@ist.edu.pk",
                "password": "admin123",
                "role": "Admin",
                "customer_id": "ADMIN-100"
            },
            {
                "email": "customer@ist.edu.pk",
                "password": "customer123",
                "role": "Customer",
                "customer_id": "CUST-101"
            }
        ])
        
        # Initialize default customers
        customers_col.insert_one({
            "_id": "CUST-101",
            "email": "customer@ist.edu.pk",
            "name": "Academic Evaluation Customer"
        })
        
        return jsonify({
            "success": True, 
            "message": "OmniChannel Retail Hub state seeded programmatically on Atlas cluster."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Automated database seed on initial startup
try:
    if products_col.count_documents({}) == 0 or users_col.count_documents({}) == 0:
        print("[DB SEED] Structural collections are empty. Seeding baseline credentials...")
        with app.app_context():
            # Create a simple mock request to satisfy Flask routing if running within context
            # (or run the seeding helper directly)
            db["users"].delete_many({})
            db["users"].insert_many([
                {"email": "admin@ist.edu.pk", "password": "admin123", "role": "Admin", "customer_id": "ADMIN-100"},
                {"email": "customer@ist.edu.pk", "password": "customer123", "role": "Customer", "customer_id": "CUST-101"}
            ])
            # Check products
            if products_col.count_documents({}) == 0:
                products_col.insert_many([
                    {
                        "_id": 101, "id": 101, "name": "Sony WH-1000XM5 ANC Headphones", "category": "electronics", 
                        "price": 85000, "stock": 14, "description": "Industry-leading noise-canceling wireless over-ear headphones.",
                        "image_url": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80"
                    },
                    {
                        "_id": 102, "id": 102, "name": "Mechanical Gaming Keyboard (RGB)", "category": "electronics", 
                        "price": 12500, "stock": 4, "description": "Tactile blue-switch mechanical keyboard. [LOW STOCK TESTING FIELD]",
                        "image_url": "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&q=80"
                    },
                    {
                        "_id": 103, "id": 103, "name": "Anker PowerCore 24K Power Bank", "category": "electronics", 
                        "price": 18500, "stock": 1, "description": "Ultra-high capacity external battery. [CRITICAL BOUNDARY FIELD: Stock exactly 1]",
                        "image_url": "https://images.unsplash.com/photo-1609592424085-f5b2257d47f2?w=600&q=80"
                    },
                    {
                        "_id": 201, "id": 201, "name": "Premium Egyptian Cotton Oxford Shirt", "category": "apparel", 
                        "price": 4500, "stock": 45, "description": "Classic fit breathable formal shirt woven from premium extra-long staple cotton.",
                        "image_url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80"
                    },
                    {
                        "_id": 202, "id": 202, "name": "Waterproof All-Weather Windbreaker", "category": "apparel", 
                        "price": 8900, "stock": 8, "description": "Triple-layer membrane insulation built for extreme rain resistance. [LOW STOCK FIELD]",
                        "image_url": "https://images.unsplash.com/photo-1544923246-77307dd654cb?w=600&q=80"
                    },
                    {
                        "_id": 301, "id": 301, "name": "Smart Digital Air Fryer (5.5L)", "category": "appliances", 
                        "price": 28000, "stock": 22, "description": "Oil-free convection cooker featuring 8 rapid touchscreen pre-sets.",
                        "image_url": "https://images.unsplash.com/photo-1621972750749-0fbb1abb7736?w=600&q=80"
                    },
                    {
                        "_id": 302, "id": 302, "name": "Robot Vacuum Cleaner with Auto-Mop", "category": "appliances", 
                        "price": 65000, "stock": 3, "description": "LiDAR-guided smart home autonomous floor cleaner. [LOW STOCK FIELD]",
                        "image_url": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&q=80"
                    }
                ])
            print("[DB SEED] Startup seeds applied successfully.")
except Exception as startup_err:
    print(f"[DB SEED] Startup seeding failed (could be due to database connection delay): {startup_err}")

if __name__ == '__main__':
    os.makedirs('static/css', exist_ok=True)
    os.makedirs('static/js', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    app.run(debug=True, port=5000)
