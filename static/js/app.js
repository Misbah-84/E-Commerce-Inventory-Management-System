const API_BASE = '/api';
let currentView = 'dashboard';
let charts = {};

// --- UTILS ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const colors = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    
    toast.className = `toast ${colors} text-white px-4 py-3 rounded shadow-lg flex items-center gap-3`;
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoading(text) {
    document.getElementById('loading-text').innerText = text || 'Processing Transaction...';
    document.getElementById('loading-overlay').classList.remove('hidden');
    document.getElementById('loading-overlay').classList.add('flex');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('loading-overlay').classList.remove('flex');
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

// --- ROUTING ---
function navigate(view) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
    
    currentView = view;
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-4 border-slate-900"></div></div>';
    
    switch(view) {
        case 'dashboard': renderDashboard(); break;
        case 'inventory': renderInventory(); break;
        case 'departments': renderDepartments(); break;
        case 'payments': renderPayments(); break;
        case 'support': renderSupport(); break;
    }
}

// Event Listeners for Nav
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(e.target.dataset.view);
    });
});

// --- VIEWS ---

// 1. Dashboard
async function renderDashboard() {
    try {
        const res = await fetch(`${API_BASE}/dashboard`);
        const data = await res.json();
        
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="fade-in">
                <h1 class="text-3xl font-bold text-slate-900 mb-2">Dashboard Overview</h1>
                <p class="text-slate-500 mb-8">Real-time performance metrics and sales trends.</p>
                
                <!-- KPI Cards -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div class="kpi-card bg-white rounded-lg shadow border border-slate-200 p-6 border-t-4 border-t-blue-500">
                        <p class="text-sm font-medium text-slate-500 mb-1">Total Revenue</p>
                        <h3 class="text-3xl font-bold text-slate-900">${formatCurrency(data.total_sales)}</h3>
                        <div class="mt-2 text-sm text-green-600 flex items-center gap-1"><i class="fas fa-arrow-up"></i> Live</div>
                    </div>
                    <div class="kpi-card bg-white rounded-lg shadow border border-slate-200 p-6 border-t-4 border-t-green-500">
                        <p class="text-sm font-medium text-slate-500 mb-1">Total Orders</p>
                        <h3 class="text-3xl font-bold text-slate-900">${data.total_orders}</h3>
                        <div class="mt-2 text-sm text-green-600 flex items-center gap-1"><i class="fas fa-box"></i> Processed</div>
                    </div>
                    <div class="kpi-card bg-white rounded-lg shadow border border-slate-200 p-6 border-t-4 border-t-purple-500">
                        <p class="text-sm font-medium text-slate-500 mb-1">Estimated Customers</p>
                        <h3 class="text-3xl font-bold text-slate-900">${Math.floor(data.total_orders * 0.8)}</h3>
                        <div class="mt-2 text-sm text-slate-400 flex items-center gap-1"><i class="fas fa-users"></i> Unique</div>
                    </div>
                    <div class="kpi-card bg-white rounded-lg shadow border border-slate-200 p-6 ${data.low_stock_count > 0 ? 'border-t-4 border-t-red-500 bg-red-50' : 'border-t-4 border-t-slate-400'}">
                        <p class="text-sm font-medium ${data.low_stock_count > 0 ? 'text-red-600' : 'text-slate-500'} mb-1">Low Stock Alerts</p>
                        <h3 class="text-3xl font-bold ${data.low_stock_count > 0 ? 'text-red-700' : 'text-slate-900'}">${data.low_stock_count}</h3>
                        ${data.low_stock_count > 0 ? '<div class="mt-2 text-sm text-red-600 font-bold flex items-center gap-1"><i class="fas fa-exclamation-triangle"></i> Action Required</div>' : '<div class="mt-2 text-sm text-green-600 flex items-center gap-1"><i class="fas fa-check"></i> All good</div>'}
                    </div>
                </div>

                <!-- Charts -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white rounded-lg shadow border border-slate-200 p-6">
                        <h3 class="text-lg font-bold text-slate-800 mb-4">Gross Profit by Category</h3>
                        <div style="position: relative; height: 250px; width: 100%;">
                            <canvas id="barChart"></canvas>
                        </div>
                    </div>
                    <div class="bg-white rounded-lg shadow border border-slate-200 p-6">
                        <h3 class="text-lg font-bold text-slate-800 mb-4">Logistics Status</h3>
                        <div style="position: relative; height: 250px; width: 100%; display: flex; justify-content: center;">
                            <canvas id="pieChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render Chart.js
        if (charts.bar) charts.bar.destroy();
        if (charts.pie) charts.pie.destroy();

        const catData = data.charts.revenue_by_category;
        charts.bar = new Chart(document.getElementById('barChart'), {
            type: 'bar',
            data: {
                labels: Object.keys(catData),
                datasets: [{
                    label: 'Revenue',
                    data: Object.values(catData),
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        const statData = data.charts.status_distribution;
        charts.pie = new Chart(document.getElementById('pieChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(statData),
                datasets: [{
                    data: Object.values(statData),
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

    } catch (e) {
        showToast('Error loading dashboard data', 'error');
    }
}

// 2. Inventory Manager
let currentPage = 1;
let currentSearch = '';

async function renderInventory() {
    try {
        const res = await fetch(`${API_BASE}/inventory?page=${currentPage}&search=${currentSearch}`);
        const data = await res.json();
        
        let rows = '';
        data.items.forEach(item => {
            const isLow = item.stock < 10;
            const itemJSON = JSON.stringify(item).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
            rows += `
                <tr class="border-b border-slate-200 hover:bg-slate-50 ${isLow ? 'low-stock-row' : ''}">
                    <td class="py-3 px-4 text-sm font-medium text-slate-900">${item._id}</td>
                    <td class="py-3 px-4 text-sm text-slate-700">${item.name}</td>
                    <td class="py-3 px-4 text-sm text-slate-700">
                        <span class="px-2 py-1 bg-slate-100 rounded-full text-xs">${item.category}</span>
                    </td>
                    <td class="py-3 px-4 text-sm font-medium text-slate-900">${formatCurrency(item.price)}</td>
                    <td class="py-3 px-4 text-sm ${isLow ? 'low-stock-text' : 'text-slate-700'}">${item.stock} ${isLow ? '<i class="fas fa-exclamation-circle ml-1"></i>' : ''}</td>
                    <td class="py-3 px-4 text-sm text-right">
                        <button onclick="openPOSModal(JSON.parse('${itemJSON}'))" class="text-green-600 hover:text-green-800 mr-3" title="Sell"><i class="fas fa-cash-register"></i> Sell</button>
                        <button onclick="openProductModal(JSON.parse('${itemJSON}'))" class="text-blue-600 hover:text-blue-800 mr-3"><i class="fas fa-edit"></i> Edit</button>
                    </td>
                </tr>
            `;
        });

        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="fade-in">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                        <h1 class="text-3xl font-bold text-slate-900">Inventory Manager</h1>
                        <p class="text-slate-500">Manage products, stock levels, and process point-of-sale transactions.</p>
                    </div>
                    <button onclick="openProductModal()" class="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition shadow whitespace-nowrap">
                        <i class="fas fa-plus mr-2"></i> Add Product
                    </button>
                </div>
                
                <div class="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
                    <div class="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <div class="relative w-64">
                            <input type="text" id="inv-search" value="${currentSearch}" placeholder="Search SKU or Name..." class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-slate-900 focus:outline-none">
                            <i class="fas fa-search absolute left-3 top-3.5 text-slate-400"></i>
                        </div>
                        <div class="text-sm text-slate-500">
                            Showing ${data.items.length} of ${data.total} items
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-800 text-white text-sm uppercase">
                                    <th class="py-3 px-4 font-semibold">SKU</th>
                                    <th class="py-3 px-4 font-semibold">Name</th>
                                    <th class="py-3 px-4 font-semibold">Category</th>
                                    <th class="py-3 px-4 font-semibold">Price</th>
                                    <th class="py-3 px-4 font-semibold">Stock</th>
                                    <th class="py-3 px-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || '<tr><td colspan="6" class="text-center py-8 text-slate-500">No products found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                    <div class="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                        <button onclick="changePage(-1)" class="px-3 py-1 border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
                        <span class="text-sm text-slate-600">Page ${currentPage}</span>
                        <button onclick="changePage(1)" class="px-3 py-1 border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50" ${data.items.length < data.limit ? 'disabled' : ''}>Next</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('inv-search').addEventListener('input', (e) => {
            currentSearch = e.target.value;
            currentPage = 1;
            clearTimeout(window.searchTimeout);
            window.searchTimeout = setTimeout(renderInventory, 500);
        });

    } catch (e) {
        showToast('Error loading inventory', 'error');
    }
}

function changePage(delta) {
    currentPage += delta;
    renderInventory();
}

// 3. Departments
async function renderDepartments() {
    try {
        const res = await fetch(`${API_BASE}/departments`);
        const data = await res.json();
        
        let grids = '';
        data.forEach(dept => {
            let items = '';
            dept.products.slice(0, 4).forEach(p => {
                items += `
                    <div class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 -mx-2 rounded transition-colors">
                        <div>
                            <p class="text-sm font-medium text-slate-800">${p.name}</p>
                            <p class="text-xs text-slate-500">${p._id}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm font-bold text-slate-900">${formatCurrency(p.price)}</p>
                            <p class="text-xs ${p.stock < 10 ? 'text-red-500 font-bold' : 'text-slate-500'}">${p.stock} in stock</p>
                        </div>
                    </div>
                `;
            });
            
            grids += `
                <div class="bg-white rounded-lg shadow border border-slate-200 p-6 flex flex-col h-full kpi-card">
                    <div class="flex items-center gap-3 mb-4 border-b border-slate-100 pb-3">
                        <div class="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg shadow-inner">
                            <i class="fas fa-tags"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-lg text-slate-900">${dept._id}</h3>
                            <p class="text-xs text-slate-500">${dept.products.length} Products</p>
                        </div>
                    </div>
                    <div class="flex-grow">
                        ${items}
                    </div>
                    ${dept.products.length > 4 ? `<button class="w-full mt-4 text-sm text-slate-600 hover:text-slate-900 font-medium py-2 bg-slate-50 border border-slate-200 rounded transition-colors hover:bg-slate-100">View All ${dept.products.length}</button>` : ''}
                </div>
            `;
        });

        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="fade-in">
                <h1 class="text-3xl font-bold text-slate-900 mb-2">Departments</h1>
                <p class="text-slate-500 mb-8">Product categories and top inventory items.</p>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${grids}
                </div>
            </div>
        `;
    } catch (e) {
        showToast('Error loading departments', 'error');
    }
}

// 4. Payments
async function renderPayments() {
    try {
        const res = await fetch(`${API_BASE}/payments`);
        const data = await res.json();
        
        let rows = '';
        data.forEach(p => {
            const date = new Date(p.timestamp * 1000).toLocaleString();
            rows += `
                <tr class="border-b border-slate-200 hover:bg-slate-50">
                    <td class="py-3 px-4 text-sm font-medium text-slate-900">${p.order_id}</td>
                    <td class="py-3 px-4 text-sm text-slate-700">${date}</td>
                    <td class="py-3 px-4 text-sm font-bold text-slate-900">${formatCurrency(p.amount)}</td>
                    <td class="py-3 px-4 text-sm">
                        <span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"><i class="fas fa-check-circle mr-1"></i>${p.status}</span>
                    </td>
                </tr>
            `;
        });

        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="fade-in">
                <h1 class="text-3xl font-bold text-slate-900 mb-2">Payments Ledger</h1>
                <p class="text-slate-500 mb-6">Chronological log of all cleared transactions.</p>
                
                <div class="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
                    <div class="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table class="w-full text-left border-collapse relative">
                            <thead class="sticky top-0 bg-slate-800 text-white shadow z-10">
                                <tr class="text-sm uppercase">
                                    <th class="py-3 px-4 font-semibold">Transaction ID</th>
                                    <th class="py-3 px-4 font-semibold">Date / Time</th>
                                    <th class="py-3 px-4 font-semibold">Amount</th>
                                    <th class="py-3 px-4 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows || '<tr><td colspan="4" class="text-center py-8 text-slate-500">No transactions found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        showToast('Error loading payments', 'error');
    }
}

// 5. Support
function renderSupport() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
        <div class="fade-in max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold text-slate-900 mb-2">Help & Support</h1>
            <p class="text-slate-500 mb-8">Find answers to common questions or contact the admin team.</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h3 class="text-xl font-bold text-slate-800 mb-4">Frequently Asked Questions</h3>
                    <div class="space-y-4">
                        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                            <h4 class="font-bold text-slate-900 text-sm">How do I process a sale?</h4>
                            <p class="text-sm text-slate-600 mt-1">Navigate to the Inventory tab, find your product, and click the 'Sell' button to initiate a transaction.</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                            <h4 class="font-bold text-slate-900 text-sm">How is low stock calculated?</h4>
                            <p class="text-sm text-slate-600 mt-1">Any item with an inventory count of less than 10 units is flagged automatically across the dashboard.</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                            <h4 class="font-bold text-slate-900 text-sm">Are transactions secure?</h4>
                            <p class="text-sm text-slate-600 mt-1">Yes, all sales utilize MongoDB ACID transactions to ensure data integrity before updating UI components.</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white p-6 rounded-lg shadow border border-slate-200">
                    <h3 class="text-xl font-bold text-slate-800 mb-4">Contact Admin</h3>
                    <form id="support-form" onsubmit="handleSupportSubmit(event)">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                            <input type="text" class="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-slate-900 focus:outline-none" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-slate-700 mb-1">Message</label>
                            <textarea rows="4" class="w-full border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-slate-900 focus:outline-none" required></textarea>
                        </div>
                        <button type="submit" class="w-full bg-slate-900 text-white font-bold py-2 px-4 rounded hover:bg-slate-800 transition-colors shadow">Send Message</button>
                    </form>
                </div>
            </div>
        </div>
    `;
}

window.handleSupportSubmit = function(e) {
    e.preventDefault();
    showToast('Message sent to administration (Simulated)', 'success');
    e.target.reset();
}

// --- MODALS & FORMS ---

const productModal = document.getElementById('product-modal');
const productModalContent = document.getElementById('product-modal-content');
const productForm = document.getElementById('product-form');

const posModal = document.getElementById('pos-modal');
const posModalContent = document.getElementById('pos-modal-content');
const posForm = document.getElementById('pos-form');

// Product Modal
window.openProductModal = function(item = null) {
    const formMode = document.getElementById('form-mode');
    const idInput = document.getElementById('prod-id');
    const title = document.getElementById('modal-title');
    
    if (item) {
        formMode.value = 'edit';
        title.innerText = 'Edit Product';
        idInput.value = item._id;
        idInput.disabled = true; // Cannot edit ID
        document.getElementById('prod-name').value = item.name;
        document.getElementById('prod-category').value = item.category;
        document.getElementById('prod-price').value = item.price;
        document.getElementById('prod-stock').value = item.stock;
    } else {
        formMode.value = 'add';
        title.innerText = 'Add New Product';
        productForm.reset();
        idInput.disabled = false;
    }
    
    productModal.classList.remove('hidden');
    productModal.classList.add('flex');
    setTimeout(() => {
        productModal.classList.remove('opacity-0');
        productModalContent.classList.remove('scale-95');
    }, 10);
}

function closeProductModal() {
    productModal.classList.add('opacity-0');
    productModalContent.classList.add('scale-95');
    setTimeout(() => {
        productModal.classList.add('hidden');
        productModal.classList.remove('flex');
    }, 300);
}

document.getElementById('close-modal').addEventListener('click', closeProductModal);

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const mode = document.getElementById('form-mode').value;
    const data = {
        _id: document.getElementById('prod-id').value,
        name: document.getElementById('prod-name').value,
        category: document.getElementById('prod-category').value,
        price: parseFloat(document.getElementById('prod-price').value),
        stock: parseInt(document.getElementById('prod-stock').value)
    };
    
    try {
        const url = mode === 'add' ? `${API_BASE}/inventory/add` : `${API_BASE}/inventory/edit/${data._id}`;
        const method = mode === 'add' ? 'POST' : 'PUT';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
            showToast(mode === 'add' ? 'Product added successfully!' : 'Product updated successfully!');
            closeProductModal();
            if(currentView === 'inventory') renderInventory();
        } else {
            showToast(result.error || 'Failed to save product', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
});

// POS Modal
let currentPOSItem = null;

window.openPOSModal = function(item) {
    currentPOSItem = item;
    document.getElementById('pos-prod-id').value = item._id;
    document.getElementById('pos-prod-name').innerText = item.name;
    document.getElementById('pos-available').innerText = item.stock;
    document.getElementById('pos-qty').value = 1;
    document.getElementById('pos-qty').max = item.stock;
    
    updatePOSTotal();
    
    posModal.classList.remove('hidden');
    posModal.classList.add('flex');
    setTimeout(() => {
        posModal.classList.remove('opacity-0');
        posModalContent.classList.remove('scale-95');
    }, 10);
}

function closePOSModal() {
    posModal.classList.add('opacity-0');
    posModalContent.classList.add('scale-95');
    setTimeout(() => {
        posModal.classList.add('hidden');
        posModal.classList.remove('flex');
    }, 300);
}

document.getElementById('close-pos-modal').addEventListener('click', closePOSModal);

document.getElementById('pos-qty').addEventListener('input', updatePOSTotal);

function updatePOSTotal() {
    if (!currentPOSItem) return;
    const qty = parseInt(document.getElementById('pos-qty').value) || 0;
    const total = qty * currentPOSItem.price;
    document.getElementById('pos-price').innerText = formatCurrency(currentPOSItem.price);
    document.getElementById('pos-total').innerText = formatCurrency(total);
}

posForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const qty = parseInt(document.getElementById('pos-qty').value);
    
    if (qty > currentPOSItem.stock) {
        showToast('Quantity exceeds available stock!', 'error');
        return;
    }
    
    closePOSModal();
    showLoading('Processing Transaction securely via MongoDB...');
    
    try {
        const res = await fetch(`${API_BASE}/sales/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: currentPOSItem._id, qty: qty })
        });
        
        const result = await res.json();
        
        // Add artificial delay to simulate backend processing time (for ACID perception)
        setTimeout(() => {
            hideLoading();
            if (res.ok) {
                showToast(result.message, 'success');
                if(currentView === 'inventory') renderInventory();
            } else {
                showToast(result.error || 'Transaction failed', 'error');
            }
        }, 1500);
        
    } catch (err) {
        hideLoading();
        showToast('Network error during transaction', 'error');
    }
});

// Init
navigate('dashboard');
