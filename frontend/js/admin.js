// --- INITIALIZATION & AUTH ---
window.onload = function() {
    const adminToken = localStorage.getItem("admin_token");
    if (adminToken) {
        document.getElementById('adminLoginOverlay').style.display = 'none';
        fetchAnalytics(adminToken);
        fetchInventory();
    } else {
        document.getElementById('adminLoginOverlay').style.display = 'flex';
    }
};

function adminLogin() {
    const u = document.getElementById('adminUsername').value;
    const p = document.getElementById('adminPass').value;
    
    fetch('http://127.0.0.1:5000/admin-login', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username: u, password: p})
    })
    .then(res => res.json())
    .then(data => {
        if (data.token) {
            localStorage.setItem("admin_token", data.token);
            document.getElementById('adminLoginOverlay').style.display = 'none';
            fetchAnalytics(data.token);
            fetchInventory();
            showToast("Welcome to the Admin Dashboard!", false);
        } else {
            showToast(data.message, true);
        }
    })
    .catch(err => showToast("Server error.", true));
}

// --- TAB SWITCHING (Bulletproof Version) ---
function switchTab(tabId) {
    // 1. Hide all tabs and remove 'active' styling from all buttons
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // 2. Show the selected tab
    document.getElementById(tabId).classList.add('active');
    
    // 3. Manually highlight the correct button so it never crashes
    if (tabId === 'analytics') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else if (tabId === 'inventory') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
}
function showToast(message, isError = false) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.className = isError ? "error show" : "success show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// --- ANALYTICS ---
function fetchAnalytics(token) {
    fetch('http://127.0.0.1:5000/api/analytics', { headers: { 'Authorization': token } })
    .then(res => res.json())
    .then(data => {
        if(data.message === "Unauthorized") { localStorage.removeItem("admin_token"); location.reload(); return; }
        
        document.getElementById('statRevenue').innerText = '$' + data.total_revenue.toFixed(2);
        document.getElementById('statOrders').innerText = data.total_orders;
        document.getElementById('statUsers').innerText = data.total_users;

        new Chart(document.getElementById('barChart').getContext('2d'), {
            type: 'bar', data: {
                labels: data.top_books.map(b => b.name.substring(0, 15) + '...'),
                datasets: [{ label: 'Copies Sold', data: data.top_books.map(b => b.sales), backgroundColor: '#0070ba', borderRadius: 4 }]
            }
        });

        new Chart(document.getElementById('doughnutChart').getContext('2d'), {
            type: 'doughnut', data: {
                labels: data.category_sales.map(c => c.category),
                datasets: [{ data: data.category_sales.map(c => c.sales), backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0'] }]
            }
        });
    });
}
// --- INVENTORY LOGIC ---
function fetchInventory() {
    fetch('http://127.0.0.1:5000/books')
    .then(res => res.json())
    .then(books => {
        const tbody = document.getElementById('inventoryTableBody');
        tbody.innerHTML = '';
        
        books.forEach(b => {
            // THE FIX: Convert the price string back into a math number!
            const safePrice = parseFloat(b.price) || 0;
            
            tbody.innerHTML += `
                <tr>
                    <td>#${b.id}</td>
                    <td style="font-weight: bold;">${b.name}</td>
                    <td>$${safePrice.toFixed(2)}</td>
                    <td>${b.stock}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="populateEditForm(${b.id}, '${b.name.replace(/'/g, "\\'")}', ${safePrice}, ${b.stock})">✏️ Edit</button>
                        <button class="action-btn delete-btn" onclick="deleteBook(${b.id})">🗑️ Delete</button>
                    </td>
                </tr>
            `;
        });
    })
    .catch(err => console.error("Error drawing the inventory table:", err));
}

// --- NEW INLINE FORM LOGIC ---

// 1. Fills the top form when "Edit" is clicked in the table
function populateEditForm(id, name, price, stock) {
    document.getElementById('formTitle').innerText = `✏️ Editing Book #${id}`;
    document.getElementById('editBookId').value = id; 
    document.getElementById('editName').value = name;
    document.getElementById('editPrice').value = price;
    document.getElementById('editStock').value = stock;
    
    // Switch buttons to Edit Mode
    document.getElementById('saveBtn').innerText = "Update Book";
    document.getElementById('cancelBtn').style.display = "inline-block";

    // Scroll up so the admin can see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 2. Clears the form back to "Add New Book" mode
function resetForm() {
    document.getElementById('formTitle').innerText = "➕ Add New Book";
    document.getElementById('editBookId').value = ""; 
    document.getElementById('editName').value = "";
    document.getElementById('editPrice').value = "";
    document.getElementById('editStock').value = "";
    
    // Switch buttons back to Add Mode
    document.getElementById('saveBtn').innerText = "Save Book";
    document.getElementById('cancelBtn').style.display = "none";
}

// 3. Smart Save (POST for new, PUT for edits)
function saveBook() {
    const token = localStorage.getItem("admin_token");
    const id = document.getElementById('editBookId').value;
    const name = document.getElementById('editName').value;
    const price = document.getElementById('editPrice').value;
    const stock = document.getElementById('editStock').value;

    if (!name || !price || !stock) {
        showToast("Please fill in all fields.", true);
        return;
    }

    const payload = {
        name: name,
        price: parseFloat(price),
        stock: parseInt(stock)
    };

    let url = 'http://127.0.0.1:5000/add-book';
    let method = 'POST';

    // If we have an ID, we are editing!
    if (id) {
        url = `http://127.0.0.1:5000/update-book/${id}`;
        method = 'PUT';
    }

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        const isError = data.message.includes("Failed") || data.message.includes("Unauthorized");
        showToast(data.message, isError);
        
        if (!isError) {
            resetForm(); // Clear the form
            fetchInventory(); // Refresh the table
        }
    })
    .catch(err => showToast("Server error.", true));
}

// 4. Delete Book
function deleteBook(id) {
    if (!confirm("Are you sure you want to permanently delete this book?")) return;
    
    const token = localStorage.getItem("admin_token");
    fetch(`http://127.0.0.1:5000/delete-book/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': token }
    })
    .then(res => res.json())
    .then(data => {
        showToast(data.message, data.message.includes("Cannot"));
        fetchInventory(); 
    });
}