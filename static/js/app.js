const API_URL = '/api';

// State Management
let currentRole = null; 
let currentEmail = null;
let currentCustomerId = null;
let currentView = 'marketplace';
let charts = {};
let cart = [];

// DOM Hooks
const loginOverlay = document.getElementById('login-overlay');
const topNavbar = document.getElementById('top-navbar');
const mainContent = document.getElementById('main-content');
const roleBadge = document.getElementById('badge-role');
const emailBadge = document.getElementById('badge-email');
const navContainer = document.getElementById('nav-container');
const loadingOverlay = document.getElementById('loading-overlay');
const toastContainer = document.getElementById('toast-container');
const genericModal = document.getElementById('generic-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const cartBadge = document.getElementById('cbadge');
const cartDrawer = document.getElementById('cart-dr');
const cartOverlay = document.getElementById('cart-ov');
const cartBody = document.getElementById('cart-body');
const cartFooter = document.getElementById('cart-ft');
const cartSubtotal = document.getElementById('cart-sub');
const checkoutModal = document.getElementById('com');
const cartTrigger = document.getElementById('cart-trigger');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    checkActiveSession();
    loadCartFromStorage();
});

// Credentials Authentication Strategy
window.handleLoginSubmit = async function() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) {
        showToast("Please fill in both email and password.", "error");
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Authentication failed.");
        }
        
        // Save Session State
        currentRole = data.role;
        currentEmail = data.email;
        currentCustomerId = data.customer_id;
        
        sessionStorage.setItem('session_role', currentRole);
        sessionStorage.setItem('session_email', currentEmail);
        sessionStorage.setItem('session_customer_id', currentCustomerId);
        
        showToast(`🎉 Welcome back! Logged in as ${currentRole}`, "success");
        
        // Apply Gated Visibilities
        loginOverlay.classList.add('hidden');
        topNavbar.classList.remove('hidden');
        mainContent.classList.remove('hidden');
        
        // Update UI Info
        roleBadge.textContent = currentRole;
        roleBadge.className = `text-[9px] font-mono font-bold px-2 py-1 rounded uppercase ${
            currentRole === 'Admin' ? 'bg-wn-gold-l text-wn-gold-d border border-wn-gold-d/20' : 'bg-zinc-100 text-zinc-700 border border-zinc-300/40'
        }`;
        emailBadge.textContent = currentEmail;
        
        // Render Navigation Links
        renderNav();
        
        // Cart controls visibility based on role
        if (currentRole === 'Customer') {
            cartTrigger.style.display = 'block';
            navigate('marketplace');
        } else {
            cartTrigger.style.display = 'none';
            navigate('insights');
        }
        
    } catch (err) {
        showToast(err.message, "error");
    }
}

function checkActiveSession() {
    const sRole = sessionStorage.getItem('session_role');
    const sEmail = sessionStorage.getItem('session_email');
    const sCustId = sessionStorage.getItem('session_customer_id');
    
    if (sRole && sEmail && sCustId) {
        currentRole = sRole;
        currentEmail = sEmail;
        currentCustomerId = sCustId;
        
        loginOverlay.classList.add('hidden');
        topNavbar.classList.remove('hidden');
        mainContent.classList.remove('hidden');
        
        roleBadge.textContent = currentRole;
        roleBadge.className = `text-[9px] font-mono font-bold px-2 py-1 rounded uppercase ${
            currentRole === 'Admin' ? 'bg-wn-gold-l text-wn-gold-d border border-wn-gold-d/20' : 'bg-zinc-100 text-zinc-700 border border-zinc-300/40'
        }`;
        emailBadge.textContent = currentEmail;
        
        renderNav();
        
        if (currentRole === 'Customer') {
            cartTrigger.style.display = 'block';
            navigate('marketplace');
        } else {
            cartTrigger.style.display = 'none';
            navigate('insights');
        }
    } else {
        loginOverlay.classList.remove('hidden');
        topNavbar.classList.add('hidden');
        mainContent.classList.add('hidden');
    }
}

window.handleLogout = function() {
    sessionStorage.clear();
    currentRole = null;
    currentEmail = null;
    currentCustomerId = null;
    cart = [];
    saveCartToStorage();
    
    document.getElementById('login-password').value = '';
    
    loginOverlay.classList.remove('hidden');
    topNavbar.classList.add('hidden');
    mainContent.classList.add('hidden');
    
    showToast("Session logged out successfully.", "info");
}

// Dynamic Navigation and Role Gating
function renderNav() {
    const adminLinks = `
        <a onclick="navigate('insights')" class="nav-link" id="nav-insights">Central Insights</a>
        <a onclick="navigate('marketplace')" class="nav-link" id="nav-marketplace">Product Marketplace</a>
        <a onclick="navigate('inventory')" class="nav-link" id="nav-inventory">Inventory Matrix</a>
        <a onclick="navigate('lab')" class="nav-link" id="nav-lab">Performance Tuning Lab</a>
    `;
    const customerLinks = `
        <a onclick="navigate('marketplace')" class="nav-link" id="nav-marketplace">Product Marketplace</a>
        <a onclick="navigate('orders')" class="nav-link" id="nav-orders">My Orders History</a>
    `;
    navContainer.innerHTML = currentRole === 'Admin' ? adminLinks : customerLinks;
}

window.navigate = function(view) {
    if (currentRole === 'Customer' && view !== 'marketplace' && view !== 'orders') {
        view = 'marketplace'; // Gate restricted views from customers
    }
    
    currentView = view;
    
    // Highlight Active Link
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${view}`);
    if (activeLink) activeLink.classList.add('active');

    // Display Loading indicator
    mainContent.innerHTML = `
        <div class="flex justify-center items-center p-24">
            <div class="relative w-12 h-12">
                <div class="absolute inset-0 rounded-full border-4 border-wn-gold-l opacity-25"></div>
                <div class="absolute inset-0 rounded-full border-4 border-t-wn-gold border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
            </div>
        </div>
    `;
    
    switch(view) {
        case 'insights': renderInsights(); break;
        case 'marketplace': renderMarketplace(); break;
        case 'inventory': renderInventory(); break;
        case 'lab': renderLab(); break;
        case 'orders': renderOrders(); break;
    }
}

// REST Fetch Controller with Role and Customer Identity headers
async function apiFetch(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'X-Role': currentRole,
        'X-Customer-ID': currentCustomerId,
        'X-Customer-Email': currentEmail,
        ...(options.headers || {})
    };
    
    try {
        const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server connection error.');
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

// ==================== RENDERING COMPONENT MODULES ====================

// 1. Admin Central Insights Dashboard
async function renderInsights() {
    try {
        const data = await apiFetch('/dashboard/analytics');
        
        mainContent.innerHTML = `
            <div class="fade-in-up">
                <div class="mb-8">
                    <span class="text-[10px] tracking-[0.25em] uppercase text-wn-gold-d font-bold">Admin Workspace</span>
                    <h1 class="text-4xl font-playfair font-bold italic tracking-tight text-wn-noir mt-1">Central Insights</h1>
                </div>
                
                <!-- KPI Indicators -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                    <div class="kpi-card flex flex-col justify-between">
                        <span class="text-[10px] uppercase tracking-[0.12em] text-wn-muted font-bold">Total Sales (Processed)</span>
                        <div class="text-3xl font-playfair font-bold text-wn-gold-d mt-2">Rs. ${Math.round(data.total_sales).toLocaleString()}</div>
                    </div>
                    <div class="kpi-card flex flex-col justify-between">
                        <span class="text-[10px] uppercase tracking-[0.12em] text-wn-muted font-bold">Orders Tracked (ACID Guaranteed)</span>
                        <div class="text-3xl font-playfair font-bold text-wn-gold-d mt-2">${data.total_orders}</div>
                    </div>
                    <div class="kpi-card flex flex-col justify-between">
                        <span class="text-[10px] uppercase tracking-[0.12em] text-wn-muted font-bold">Critical Low-Stock Matrix</span>
                        <div class="text-3xl font-playfair font-bold ${data.low_stock_count > 0 ? 'text-red-500' : 'text-wn-gold-d'} mt-2">${data.low_stock_count} Items</div>
                    </div>
                </div>

                <!-- Aggregation Charts Section -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white p-6 rounded-2xl border border-wn-border shadow-sm">
                        <h3 class="font-playfair font-bold text-lg mb-4 text-wn-noir italic">Revenue by Category (Aggregation)</h3>
                        <div class="relative h-[280px] w-full">
                            <canvas id="chart-revenue"></canvas>
                        </div>
                    </div>
                    <div class="bg-white p-6 rounded-2xl border border-wn-border shadow-sm">
                        <h3 class="font-playfair font-bold text-lg mb-4 text-wn-noir italic">Logistics Status Matrix</h3>
                        <div class="relative h-[280px] w-full flex justify-center">
                            <canvas id="chart-logistics"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Render Chart.js
        renderRevenueChart(data.revenue_by_category);
        renderLogisticsChart(data.logistics_status);

    } catch (e) {
        mainContent.innerHTML = `
            <div class="text-center py-16 bg-white border border-wn-border rounded-2xl">
                <i class="fa-solid fa-circle-exclamation text-red-400 text-4xl mb-3"></i>
                <p class="text-sm font-semibold text-wn-muted">Could not populate analytical insights dashboard. Please ensure the database is seeded.</p>
                <button class="btn-d px-5 py-2.5 rounded-lg text-xs font-semibold mt-4" onclick="navigate('inventory')">Go to Inventory Matrix</button>
            </div>
        `;
    }
}

function renderRevenueChart(revenueData) {
    if (charts.revenue) charts.revenue.destroy();
    
    const ctx = document.getElementById('chart-revenue').getContext('2d');
    
    const labels = revenueData.length > 0 ? revenueData.map(c => c._id) : ['Electronics', 'Apparel', 'Appliances'];
    const values = revenueData.length > 0 ? revenueData.map(c => c.total_revenue) : [0, 0, 0];
    
    charts.revenue = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Gross Sales (PKR)',
                data: values,
                backgroundColor: 'rgba(212, 168, 83, 0.85)',
                borderColor: '#b8882a',
                borderWidth: 1.5,
                borderRadius: 6,
                barPercentage: 0.55
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: '#f3f4f6' },
                    ticks: { font: { family: 'Inter', size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter', size: 10, weight: 'bold' } }
                }
            }
        }
    });
}

function renderLogisticsChart(logisticsData) {
    if (charts.logistics) charts.logistics.destroy();
    
    const ctx = document.getElementById('chart-logistics').getContext('2d');
    
    const labels = logisticsData.length > 0 ? logisticsData.map(s => s._id) : ['Cleared'];
    const values = logisticsData.length > 0 ? logisticsData.map(s => s.count) : [0];
    
    charts.logistics = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#09090b', '#d4a853', '#71717a', '#10b981'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        font: { family: 'Inter', size: 10, weight: 'bold' }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

// 2. Product Marketplace Grid (Decoupled Front Store)
async function renderMarketplace() {
    try {
        const data = await apiFetch('/inventory?limit=100');
        
        if (data.items.length === 0) {
            mainContent.innerHTML = `
                <div class="text-center py-16 bg-white border border-wn-border rounded-2xl max-w-xl mx-auto">
                    <i class="fa-solid fa-store-slash text-wn-gold text-4xl mb-3 opacity-40"></i>
                    <h3 class="font-playfair font-bold text-xl italic mb-2">Marketplace is Empty</h3>
                    <p class="text-sm text-wn-muted">The system matrix has no products currently active. Please seed the store.</p>
                    ${currentRole === 'Admin' ? `<button class="btn-d px-5 py-2.5 rounded-lg text-xs font-semibold mt-4" onclick="navigate('inventory')">Admin Inventory Matrix</button>` : ''}
                </div>
            `;
            return;
        }

        let productsHtml = data.items.map(p => {
            const pId = p.id || p._id;
            return `
            <div class="pc flex flex-col">
                <div class="relative h-60 bg-wn-bg overflow-hidden flex items-center justify-center">
                    <img src="${p.image_url || 'https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&q=80'}" alt="${p.name}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-105" onerror="this.src='https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&q=80'">
                    <span class="absolute top-3 left-3 bg-wn-noir text-white text-[9px] font-extrabold uppercase px-2 py-1 tracking-wider rounded">${p.category}</span>
                </div>
                <div class="p-5 flex-grow flex flex-col justify-between">
                    <div>
                        <span class="text-[9px] text-wn-gold-d font-extrabold uppercase tracking-widest">${p.category} Category</span>
                        <h3 class="font-playfair font-bold text-base mb-1 text-wn-noir mt-0.5 leading-tight">${p.name}</h3>
                        <p class="text-xs text-wn-muted line-clamp-2 leading-relaxed mb-4">${p.description || 'Premium design & quality specifications.'}</p>
                    </div>
                    
                    <div class="pt-4 border-t border-wn-border flex items-center justify-between">
                        <div>
                            <div class="text-[9px] uppercase tracking-wider text-wn-muted font-bold">Base Price</div>
                            <div class="text-sm font-extrabold font-playfair italic">Rs. ${p.price.toLocaleString()}</div>
                        </div>
                        
                        <div class="flex gap-2">
                            ${p.stock > 0 
                                ? `
                                ${currentRole === 'Customer' ? `
                                <button class="btn-o p-2 rounded-lg text-xs" onclick="addToCart('${pId}', '${p.name.replace(/'/g,"\\'")}', ${p.price}, '${p.image_url}', '${p.category}')" title="Add to Bag">
                                    <i class="fa-solid fa-cart-plus"></i>
                                </button>
                                <button class="btn-g rounded-lg px-3 py-2 text-xs font-bold whitespace-nowrap text-white" onclick="instantBuy('${pId}', '${p.name.replace(/'/g,"\\'")}', ${p.price})">
                                    Instant Buy
                                </button>` : `<span class="text-wn-gold-d font-bold text-xs p-2 bg-wn-gold-l/50 rounded-lg">Stock: ${p.stock}</span>`}
                                `
                                : `<span class="text-red-500 font-extrabold text-[10px] bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg uppercase tracking-wider">Out Of Stock</span>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');

        mainContent.innerHTML = `
            <div class="fade-in-up">
                <div class="mb-10 text-center max-w-2xl mx-auto">
                    <span class="text-[10px] tracking-[0.25em] uppercase text-wn-gold-d font-bold">Featured Catalog</span>
                    <h1 class="text-4xl font-playfair font-bold italic tracking-tight text-wn-noir mt-1 mb-3">Product Marketplace</h1>
                    <p class="text-sm text-wn-muted">Discover premium catalog collections. Verified operations secured via horizontal distributed replica cluster bounds.</p>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    ${productsHtml}
                </div>
            </div>
        `;
    } catch(e) {}
}

// 3. Admin Inventory Matrix View (Highlight and Delete Integrations)
async function renderInventory() {
    try {
        const data = await apiFetch('/inventory?limit=100');
        
        let rowsHtml = data.items.map(p => {
            const pId = p.id || p._id;
            const isLowStock = p.stock < 10;
            return `
            <tr class="tbl-row border-b border-wn-border ${isLowStock ? 'low-stock-row' : ''}">
                <td class="px-6 py-4 whitespace-nowrap text-xs font-mono font-bold text-wn-noir">${pId}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-wn-noir">${p.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-wn-muted"><span class="cat-pill">${p.category}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-extrabold">Rs. ${p.price.toLocaleString()}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${isLowStock ? 'low-stock-text font-bold text-red-600' : 'text-wn-noir font-medium'}">${p.stock}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-xs font-semibold space-x-3">
                    <button class="text-wn-gold hover:text-wn-gold-d transition-colors" onclick="openEditModal('${pId}', '${p.name.replace(/'/g,"\\'")}', ${p.stock})">
                        <i class="fas fa-edit"></i> Edit Stock
                    </button>
                    <!-- Core CRUD Extension: Gated Deletion -->
                    <button class="text-red-500 hover:text-red-700 transition-colors" onclick="deleteProduct(${pId}, '${p.name.replace(/'/g,"\\'")}')">
                        <i class="fas fa-trash-can"></i> Delete
                    </button>
                </td>
            </tr>
        `}).join('');

        mainContent.innerHTML = `
            <div class="fade-in-up">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
                    <div>
                        <span class="text-[10px] tracking-[0.25em] uppercase text-wn-gold-d font-bold">Database Matrix</span>
                        <h1 class="text-3xl font-playfair font-bold italic tracking-tight text-wn-noir mt-1">Inventory Matrix</h1>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn-o px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2" onclick="openAddProductModal()">
                            <i class="fas fa-plus"></i> Add Product
                        </button>
                        <button class="btn-d px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 text-white" onclick="seedDb()">
                            <i class="fas fa-database"></i> Wipe &amp; Seed Database
                        </button>
                    </div>
                </div>
                
                <div class="bg-white rounded-2xl border border-wn-border shadow-sm overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-wn-border">
                            <thead class="bg-wn-noir">
                                <tr>
                                    <th class="px-6 py-3.5 text-left text-[10px] font-bold text-white/70 uppercase tracking-widest">ID</th>
                                    <th class="px-6 py-3.5 text-left text-[10px] font-bold text-white/70 uppercase tracking-widest">Product Definition</th>
                                    <th class="px-6 py-3.5 text-left text-[10px] font-bold text-white/70 uppercase tracking-widest">Category</th>
                                    <th class="px-6 py-3.5 text-left text-[10px] font-bold text-white/70 uppercase tracking-widest">Base Price</th>
                                    <th class="px-6 py-3.5 text-left text-[10px] font-bold text-white/70 uppercase tracking-widest">Active Stock</th>
                                    <th class="px-6 py-3.5 text-right text-[10px] font-bold text-white/70 uppercase tracking-widest">Commands</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-wn-border bg-white" id="inventory-tbl-body">
                                ${rowsHtml.length > 0 ? rowsHtml : `
                                    <tr>
                                        <td colspan="6" class="text-center py-12 text-wn-muted text-sm font-semibold">
                                            No inventory records found. Click "Wipe &amp; Seed Database" to initialize academic benchmarks.
                                        </td>
                                    </tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch(e) {}
}

// Programmatic deletion connection
window.deleteProduct = async function(id, name) {
    if (!confirm(`CAUTION: Are you absolutely sure you want to permanently delete "${name}" (ID: ${id}) from the database catalog?`)) {
        return;
    }
    
    try {
        const response = await apiFetch(`/inventory/delete/${id}`, {
            method: 'DELETE'
        });
        showToast(response.message || "Product deleted successfully.", "success");
        if (currentView === 'inventory') renderInventory();
    } catch(err) {
        // Errors already toasted by wrapper
    }
}

// 4. Performance Tuning & Profiling Lab View
function renderLab() {
    mainContent.innerHTML = `
        <div class="fade-in-up max-w-4xl mx-auto">
            <div class="mb-8 text-center">
                <span class="text-[10px] tracking-[0.3em] uppercase text-wn-gold-d block mb-1 font-bold">Index Optimizer Suite</span>
                <h1 class="text-3xl font-playfair font-bold italic tracking-tight text-wn-noir mb-2">Performance Tuning Lab</h1>
                <p class="text-sm text-wn-muted">Analyze database winning planner pipelines in real-time. Verify B-Tree index scan utilities.</p>
            </div>
            
            <!-- Conceptual Distributed Sharding Details -->
            <div class="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-8 text-white">
                <h3 class="text-sm font-bold uppercase tracking-wider text-wn-gold mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-network-wired"></i> Distributed MongoDB Atlas Cluster Modeling
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div class="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <span class="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Products Collection Sharding</span>
                        <div class="flex justify-between mt-1 mb-2 font-mono">
                            <span>Shard Key:</span>
                            <strong class="text-white">Hashed (category)</strong>
                        </div>
                        <p class="text-[11px] text-zinc-400 leading-relaxed">Splits products horizontally across Atlas cluster nodes. Highly balanced, avoiding write bottlenecks when querying category items.</p>
                    </div>
                    <div class="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                        <span class="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Orders Collection Sharding</span>
                        <div class="flex justify-between mt-1 mb-2 font-mono">
                            <span>Shard Key:</span>
                            <strong class="text-white">Ranged (created_at)</strong>
                        </div>
                        <p class="text-[11px] text-zinc-400 leading-relaxed">Organizes sales chronologically. Ranges of timestamps route to adjacent chunks, enabling efficient temporal queries.</p>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <!-- Profile Query 1 -->
                <div class="bg-white p-6 rounded-2xl border border-wn-border shadow-sm cursor-pointer hover:border-wn-gold transition-all" onclick="runProfile('category')">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-wn-gold-l text-wn-gold-d flex items-center justify-center"><i class="fas fa-magnifying-glass"></i></div>
                        <div>
                            <h3 class="font-bold text-sm text-wn-noir">Query Products by Category</h3>
                            <span class="text-[9px] text-wn-muted font-bold">Single-field B-Tree Index: {category: 1}</span>
                        </div>
                    </div>
                    <p class="text-xs text-wn-muted font-mono bg-wn-bg p-3.5 rounded-lg border border-wn-border overflow-x-auto whitespace-nowrap">db.products.find({category: "electronics"})</p>
                    <button class="mt-4 text-wn-gold font-bold text-xs w-full text-center hover:text-wn-gold-d transition-colors">Run explain("executionStats") →</button>
                </div>
                
                <!-- Profile Query 2 -->
                <div class="bg-white p-6 rounded-2xl border border-wn-border shadow-sm cursor-pointer hover:border-wn-gold transition-all" onclick="runProfile('customer')">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-wn-noir text-white flex items-center justify-center"><i class="fas fa-layer-group"></i></div>
                        <div>
                            <h3 class="font-bold text-sm text-wn-noir">Customer Compound Sort</h3>
                            <span class="text-[9px] text-wn-muted font-bold">Compound B-Tree Index: {customer_id: 1, created_at: -1}</span>
                        </div>
                    </div>
                    <p class="text-xs text-wn-muted font-mono bg-wn-bg p-3.5 rounded-lg border border-wn-border overflow-x-auto whitespace-nowrap font-semibold">db.orders.find({customer_id: "CUST-101"}).sort({created_at: -1})</p>
                    <button class="mt-4 text-wn-gold font-bold text-xs w-full text-center hover:text-wn-gold-d transition-colors">Run explain("executionStats") →</button>
                </div>
            </div>

            <!-- Diagnostics Window -->
            <div id="profile-results" class="hidden bg-wn-noir text-emerald-400 font-mono p-6 rounded-2xl shadow-xl text-xs overflow-x-auto border border-wn-noir leading-relaxed perf-glow">
                <!-- Results injected -->
            </div>
        </div>
    `;
}

// 5. Customer Orders History View
async function renderOrders() {
    try {
        const data = await apiFetch('/orders/mine');
        
        if (data.length === 0) {
            mainContent.innerHTML = `
                <div class="text-center py-16 bg-white border border-wn-border rounded-2xl max-w-xl mx-auto">
                    <i class="fa-solid fa-box-open text-wn-gold text-4xl mb-3 opacity-40"></i>
                    <h3 class="font-playfair font-bold text-xl italic mb-2">No Orders Found</h3>
                    <p class="text-sm text-wn-muted">You haven't placed any purchases under customer ID: ${currentCustomerId}.</p>
                    <button class="btn-g text-white px-5 py-2.5 rounded-lg text-xs font-bold mt-4" onclick="navigate('marketplace')">Start Shopping</button>
                </div>
            `;
            return;
        }

        let ordersHtml = data.map(o => `
            <div class="bg-white border border-wn-border rounded-2xl shadow-sm overflow-hidden mb-6">
                <!-- Header -->
                <div class="p-4 sm:p-5 border-b border-wn-border flex flex-wrap justify-between items-center bg-wn-bg gap-3">
                    <div>
                        <div class="text-[10px] font-bold font-mono text-wn-muted uppercase tracking-wider">Order Reference ID</div>
                        <div class="text-sm font-bold text-wn-noir">${o._id}</div>
                    </div>
                    <div>
                        <div class="text-[10px] font-bold text-wn-muted uppercase tracking-wider">ACID Commitment Date</div>
                        <div class="text-xs font-semibold text-wn-noir">${new Date(o.created_at * 1000).toLocaleString()}</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 border border-green-200 text-green-600">
                            <span class="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span> ${o.status}
                        </span>
                        <span class="text-base font-extrabold font-playfair italic text-wn-gold-d">Rs. ${o.total_amount.toLocaleString()}</span>
                    </div>
                </div>
                <!-- Items list -->
                <div class="p-5 divide-y divide-wn-border">
                    ${o.line_items.map(item => `
                        <div class="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                            <img src="${item.image_url || 'https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&q=80'}" alt="${item.name}" class="w-12 h-14 object-cover rounded-lg border border-wn-border bg-wn-bg" onerror="this.src='https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&q=80'">
                            <div class="flex-grow">
                                <h4 class="font-bold text-sm text-wn-noir leading-tight">${item.name}</h4>
                                <span class="text-[9px] uppercase font-bold tracking-wider text-wn-gold-d">${item.category}</span>
                            </div>
                            <div class="text-right">
                                <div class="text-xs font-extrabold font-playfair italic">Rs. ${item.price.toLocaleString()}</div>
                                <div class="text-[10px] text-wn-muted font-bold">Qty: ${item.qty}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <!-- Delivery Info -->
                <div class="px-5 py-3 border-t border-wn-border bg-wn-bg/40 flex justify-between text-[10px] text-wn-muted">
                    <span>📍 Recipient Address: <strong class="text-wn-noir">${o.address || 'Standard Delivery'}</strong></span>
                    <span>📞 Phone: <strong class="text-wn-noir">${o.phone || 'N/A'}</strong></span>
                </div>
            </div>
        `).join('');

        mainContent.innerHTML = `
            <div class="fade-in-up max-w-4xl mx-auto">
                <div class="mb-8">
                    <span class="text-[10px] tracking-[0.25em] uppercase text-wn-gold-d font-bold">Customer Account</span>
                    <h1 class="text-3xl font-playfair font-bold italic tracking-tight text-wn-noir mt-1">My Orders History</h1>
                    <p class="text-xs text-wn-muted mt-1">Showing active orders committed under customer ID: ${currentCustomerId}.</p>
                </div>
                ${ordersHtml}
            </div>
        `;
    } catch(e) {}
}

// ==================== TRANSACTION ACTIONS & MODALS CONTROLS ====================

function loadCartFromStorage() {
    try {
        const stored = localStorage.getItem('wn_cart');
        if (stored) {
            cart = JSON.parse(stored);
            updateCartBadge();
        }
    } catch (e) {}
}

function saveCartToStorage() {
    try {
        localStorage.setItem('wn_cart', JSON.stringify(cart));
        updateCartBadge();
    } catch(e) {}
}

function updateCartBadge() {
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    cartBadge.textContent = totalQty;
    cartBadge.style.display = (totalQty > 0 && currentRole === 'Customer') ? 'flex' : 'none';
}

window.openCart = function() {
    renderCart();
    cartOverlay.classList.remove('hidden');
    cartDrawer.classList.remove('translate-x-full');
}

window.closeCart = function() {
    cartOverlay.classList.add('hidden');
    cartDrawer.classList.add('translate-x-full');
}

window.addToCart = function(id, name, price, img, category) {
    const existing = cart.find(i => i.id === id);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id, name, price, img, category, qty: 1 });
    }
    saveCartToStorage();
    openCart();
    showToast(`Added to Bag: ${name}`, 'success');
}

window.adjustCartQty = function(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        cart = cart.filter(i => i.id !== id);
    }
    saveCartToStorage();
    renderCart();
}

window.removeFromCart = function(id) {
    cart = cart.filter(i => i.id !== id);
    saveCartToStorage();
    renderCart();
    showToast('Item removed from cart.', 'info');
}

function renderCart() {
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const totalCount = cart.reduce((s, i) => s + i.qty, 0);
    
    document.getElementById('cart-cl').textContent = `${totalCount} item${totalCount !== 1 ? 's' : ''} in bag`;
    
    if (cart.length === 0) {
        cartBody.innerHTML = `
            <div class="text-center py-16 text-wn-muted">
                <i class="fa-solid fa-bag-shopping text-4xl opacity-20 mb-3 block"></i>
                <p class="text-xs">Your shopping bag is completely empty.</p>
            </div>
        `;
        cartFooter.classList.add('hidden');
        return;
    }
    
    cartFooter.classList.remove('hidden');
    cartSubtotal.textContent = `Rs. ${Math.round(subtotal).toLocaleString()}`;
    
    cartBody.innerHTML = cart.map(item => `
        <div class="flex items-center gap-4 py-3 border-b border-wn-border last:border-b-0">
            <img src="${item.img || 'https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&q=80'}" alt="${item.name}" class="w-12 h-14 object-cover rounded-lg border border-wn-border bg-wn-bg" onerror="this.src='https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&q=80'">
            <div class="flex-grow">
                <h4 class="font-bold text-xs text-wn-noir leading-snug">${item.name}</h4>
                <div class="text-xs font-semibold text-wn-gold-d mt-0.5 font-mono">Rs. ${Math.round(item.price * item.qty).toLocaleString()}</div>
                <div class="flex items-center gap-2 mt-2">
                    <button onclick="adjustCartQty('${item.id}', -1)" class="w-6 h-6 border border-wn-border hover:bg-wn-bg text-xs font-bold rounded flex items-center justify-center">-</button>
                    <span class="text-xs font-mono font-bold">${item.qty}</span>
                    <button onclick="adjustCartQty('${item.id}', 1)" class="w-6 h-6 border border-wn-border hover:bg-wn-bg text-xs font-bold rounded flex items-center justify-center">+</button>
                </div>
            </div>
            <button onclick="removeFromCart('${item.id}')" class="text-wn-muted hover:text-red-500 p-2 text-xs transition-colors">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');
}

// Proceed to checkout modal
window.openCO = function() {
    closeCart();
    if (cart.length === 0) return;
    
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    
    document.getElementById('co-sub').textContent = `Rs. ${Math.round(subtotal).toLocaleString()}`;
    document.getElementById('co-tax').textContent = `Rs. ${Math.round(tax).toLocaleString()}`;
    document.getElementById('co-tot').innerHTML = `Rs. ${Math.round(total).toLocaleString()}`;
    
    document.getElementById('co-is').innerHTML = cart.map(item => `
        <div class="flex justify-between text-xs py-1.5 border-b border-wn-border last:border-0 bg-white">
            <span class="font-medium text-wn-noir">${item.name} &times; ${item.qty}</span>
            <span class="font-bold font-mono">Rs. ${Math.round(item.price * item.qty).toLocaleString()}</span>
        </div>
    `).join('');
    
    // Gated details locked in Customer context
    document.getElementById('co-id').value = currentCustomerId;
    document.getElementById('co-em').value = currentEmail;
    
    checkoutModal.classList.remove('hidden');
    checkoutModal.style.display = 'flex';
}

// Place Order via ACID transaction checks
window.placeOrd = async function() {
    const recipient = document.getElementById('co-nm').value.trim();
    const address = document.getElementById('co-ad').value.trim();
    const phone = document.getElementById('co-ph').value.trim();
    
    if (!recipient || !address || !phone) {
        showToast('Please specify Recipient Name, Delivery Address and Phone.', 'error');
        return;
    }
    
    cM('com');
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.style.display = 'flex';
    setTimeout(() => loadingOverlay.classList.remove('opacity-0'), 10);
    
    let processedSuccess = 0;
    
    try {
        for (let item of cart) {
            await apiFetch('/sales/process', {
                method: 'POST',
                body: JSON.stringify({ 
                    product_id: item.id, 
                    qty: item.qty
                })
            });
            processedSuccess++;
        }
        
        showToast(`🎉 Order Placed Successfully! (${processedSuccess} items committed to Atlas)`, 'success');
        cart = [];
        saveCartToStorage();
        
        if (currentView === 'marketplace') renderMarketplace();
        setTimeout(() => navigate('orders'), 1000);
        
    } catch (e) {
        // Errors already toasted by fetch wrapper
    } finally {
        loadingOverlay.classList.add('opacity-0');
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.style.display = 'none';
        }, 300);
    }
}

// Single Click buy
window.instantBuy = async function(productId, productName, price) {
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.style.display = 'flex';
    setTimeout(() => loadingOverlay.classList.remove('opacity-0'), 10);
    
    try {
        const res = await apiFetch('/sales/process', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, qty: 1 })
        });
        
        showToast(res.message, 'success');
        if (currentView === 'marketplace') renderMarketplace();
        
    } catch (e) {
        // Handled
    } finally {
        loadingOverlay.classList.add('opacity-0');
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.style.display = 'none';
        }, 300);
    }
}

// Seed database state
window.seedDb = async function() {
    if (!confirm("Are you sure you want to wipe and seed the database? This resets all collections to the baseline!")) return;
    
    try {
        const data = await apiFetch('/seed', { method: 'POST' });
        showToast(data.message, 'success');
        if (currentView === 'inventory') renderInventory();
    } catch(e) {}
}

// Explain diagnostics
window.runProfile = async function(type) {
    const resultsDiv = document.getElementById('profile-results');
    resultsDiv.innerHTML = '<span class="text-white/50 animate-pulse">> Initializing explain("executionStats") profiling on Atlas cluster...</span>';
    resultsDiv.classList.remove('hidden');
    
    try {
        const data = await apiFetch(`/performance/profile?type=${type}`);
        const isIxscan = data.stage === 'IXSCAN';
        
        resultsDiv.innerHTML = `
<div class="text-white font-extrabold mb-3 border-b border-white/10 pb-2 flex justify-between items-center">
    <span>[PROFILER DIAGNOSTICS LOG]</span>
    <span class="px-2 py-0.5 text-[10px] rounded font-bold ${isIxscan ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}">${isIxscan ? 'INDEX SCAN (IXSCAN)' : 'COLLSCAN ALERT'}</span>
</div>
<div>> Cluster:             <span class="text-white font-bold font-mono">MongoDB Atlas (Replica Set Active)</span></div>
<div>> Execution Latency:     <span class="text-white font-bold font-mono">${data.executionTimeMillis} ms</span></div>
<div>> Documents Scanned:     <span class="text-white font-bold font-mono">${data.totalDocsExamined}</span></div>
<div>> Winning Access Plan:  <span class="text-white font-bold font-mono font-bold">${data.stage}</span></div>
<div class="mt-4 p-3 rounded-lg ${isIxscan ? 'bg-emerald-950/40 border border-emerald-900/50 text-emerald-300' : 'bg-red-950/40 border border-red-900/50 text-red-300'}">
    ${isIxscan 
        ? '✓ <strong>Performance Optimized:</strong> The query planner traversed a sub-millisecond B-Tree index scan structure. Costly documents scanning completely bypassed.' 
        : '⚠️ <strong>Efficiency Warning (COLLSCAN):</strong> Full collection scan performed. The database engine had to inspect every single document in the collection. physical index optimization recommended.'}
</div>

<details class="mt-4 cursor-pointer">
    <summary class="text-[10px] font-bold text-wn-gold-d select-none">Show Raw explain("executionStats") JSON Payload</summary>
    <pre class="bg-black/60 p-4 rounded-lg mt-2 text-[10px] text-white/70 overflow-x-auto whitespace-pre-wrap max-h-80">${JSON.stringify(data.raw, null, 2)}</pre>
</details>
        `;
    } catch(e) {
        resultsDiv.innerHTML = `<span class="text-red-400 font-bold">> Profiling Error: ${e.message}</span>`;
    }
}

// CRUD Modals
window.openAddProductModal = function() {
    modalTitle.textContent = 'Add New Matrix Product';
    modalBody.innerHTML = `
        <div class="space-y-4">
            <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-wn-dark mb-1">Product ID (Numeric ID)</label>
                <input type="number" id="add-id" placeholder="e.g. 104" class="w-full p-2.5 border border-wn-border rounded-lg text-xs font-mono font-bold focus:border-wn-gold outline-none">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-wn-dark mb-1">Product Name</label>
                <input type="text" id="add-nm" placeholder="e.g. Sony Wireless Earbuds" class="w-full p-2.5 border border-wn-border rounded-lg text-xs focus:border-wn-gold outline-none">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-wn-dark mb-1">Category</label>
                <select id="add-ct" class="w-full p-2.5 border border-wn-border rounded-lg text-xs focus:border-wn-gold outline-none">
                    <option value="electronics">electronics</option>
                    <option value="apparel">apparel</option>
                    <option value="appliances">appliances</option>
                </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-wn-dark mb-1">Base Price (PKR)</label>
                    <input type="number" id="add-pr" placeholder="4500" class="w-full p-2.5 border border-wn-border rounded-lg text-xs focus:border-wn-gold outline-none">
                </div>
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-wn-dark mb-1">Stock Amount</label>
                    <input type="number" id="add-stock" placeholder="50" class="w-full p-2.5 border border-wn-border rounded-lg text-xs focus:border-wn-gold outline-none">
                </div>
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-wn-dark mb-1">Description</label>
                <textarea id="add-ds" rows="2" placeholder="Describe the item details..." class="w-full p-2.5 border border-wn-border rounded-lg text-xs focus:border-wn-gold outline-none"></textarea>
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-wn-dark mb-1">Image URL</label>
                <input type="text" id="add-img" placeholder="https://images.unsplash.com/..." class="w-full p-2.5 border border-wn-border rounded-lg text-xs focus:border-wn-gold outline-none">
            </div>
            
            <button class="btn-d w-full py-3 rounded-lg mt-4 font-bold text-white text-xs" onclick="submitAddProduct()">Submit New Matrix Item</button>
        </div>
    `;
    openModal();
}

window.submitAddProduct = async function() {
    const id = parseInt(document.getElementById('add-id').value);
    const name = document.getElementById('add-nm').value.trim();
    const category = document.getElementById('add-ct').value;
    const price = parseFloat(document.getElementById('add-pr').value);
    const stock = parseInt(document.getElementById('add-stock').value);
    const description = document.getElementById('add-ds').value.trim();
    const image_url = document.getElementById('add-img').value.trim() || 'https://images.unsplash.com/photo-1583391733956-6c78276477e1?w=600&q=80';
    
    if (isNaN(id) || !name || isNaN(price) || isNaN(stock) || !description) {
        showToast('Please fulfill all required fields.', 'error');
        return;
    }
    
    try {
        await apiFetch('/inventory/add', {
            method: 'POST',
            body: JSON.stringify({ id, name, category, price, stock, description, image_url })
        });
        showToast('New matrix product injected successfully.', 'success');
        closeModal();
        if (currentView === 'inventory') renderInventory();
    } catch(e) {}
}

window.openEditModal = function(id, name, stock) {
    modalTitle.textContent = 'Update Stock Matrix';
    modalBody.innerHTML = `
        <div class="space-y-4">
            <div class="text-xs text-wn-muted">
                Updating stock allocation for <strong class="text-wn-noir">${name}</strong> (ID: ${id}).
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-wn-dark mb-1">Product ID</label>
                <input type="text" id="edit-id" value="${id}" disabled class="w-full p-2.5 border border-wn-border rounded-lg bg-wn-bg text-wn-muted cursor-not-allowed text-xs font-mono font-bold">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase tracking-wider text-wn-dark mb-1">Current Stock Level</label>
                <input type="number" id="edit-stock" value="${stock}" class="w-full p-2.5 border border-wn-border rounded-lg focus:border-wn-gold outline-none text-xs font-bold">
            </div>
            <button class="btn-d w-full py-3 rounded-lg mt-4 font-bold text-white text-xs" onclick="submitEdit()">Commit Stock Change</button>
        </div>
    `;
    openModal();
}

window.submitEdit = async function() {
    const id = document.getElementById('edit-id').value;
    const stock = parseInt(document.getElementById('edit-stock').value);
    
    if (isNaN(stock) || stock < 0) {
        showToast('Stock level must be 0 or a positive integer.', 'error');
        return;
    }
    
    try {
        await apiFetch(`/inventory/edit/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ stock })
        });
        showToast('Stock levels securely synchronized.', 'success');
        closeModal();
        if (currentView === 'inventory') renderInventory();
    } catch (e) {}
}

// Modal Animation controls
function openModal() {
    genericModal.classList.remove('hidden');
    genericModal.style.display = 'flex';
    setTimeout(() => {
        genericModal.classList.remove('opacity-0');
        document.getElementById('generic-modal-content').classList.remove('scale-95');
    }, 10);
}

window.closeModal = function() {
    genericModal.classList.add('opacity-0');
    document.getElementById('generic-modal-content').classList.add('scale-95');
    setTimeout(() => {
        genericModal.classList.add('hidden');
        genericModal.style.display = 'none';
    }, 300);
}

function cM(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

// Toast notification
window.showToast = function(msg, type='info') {
    const toast = document.createElement('div');
    toast.className = `toast-custom flex items-center gap-3 px-4 py-3 rounded-xl mb-2.5 pointer-events-auto border border-wn-noir/10 shadow-lg text-xs font-semibold`;
    
    let icon = 'fa-circle-info text-wn-gold';
    if(type === 'success') icon = 'fa-circle-check text-emerald-400';
    if(type === 'error') icon = 'fa-triangle-exclamation text-rose-500';
    
    toast.innerHTML = `<i class="fas ${icon} text-sm"></i> <span class="flex-grow leading-tight">${msg}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('on'), 10);
    
    setTimeout(() => {
        toast.classList.remove('on');
        setTimeout(() => toast.remove(), 350);
    }, 4500);
}
