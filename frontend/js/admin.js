window.onload = loadInventory;

function loadInventory() {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Fetching data...</td></tr>';

    fetch('http://127.0.0.1:5000/books')
    .then(res => {
        if (!res.ok) throw new Error("Server returned status " + res.status);
        return res.json();
    })
    .then(books => {
        tbody.innerHTML = ''; 
        
        if (!books || books.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No books found in the database. Use the form on the left to add one!</td></tr>';
            return;
        }
        
        books.forEach(book => {
            const safeName = book.name ? book.name.replace(/'/g, "\\'") : "Unknown Title";
            const safePrice = book.price ? parseFloat(book.price).toFixed(2) : "0.00";
            const safeStock = book.stock !== null ? book.stock : 0;
            const safeCategory = book.category ? book.category.replace(/'/g, "\\'") : "Uncategorized";

            tbody.innerHTML += `
                <tr>
                    <td>${book.id}</td>
                    <td>${book.name || "Unknown"}</td>
                    <td><span style="background:#eee; padding:3px 8px; border-radius:10px; font-size:0.85rem;">${book.category || 'Uncategorized'}</span></td>
                    <td>$${safePrice}</td>
                    <td>${safeStock}</td>
                    <td>
                        <button class="action-btn edit-btn" onclick="startEdit(${book.id}, '${safeName}', ${safePrice}, ${safeStock}, '${safeCategory}')">Edit</button>
                        <button class="action-btn del-btn" onclick="deleteBook(${book.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    })
    .catch(err => {
        tbody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center; padding: 20px;">❌ Error loading inventory: ${err.message}. Check your Python server terminal!</td></tr>`;
    });
}

// --- EDIT MODE LOGIC ---
function startEdit(id, name, price, stock, category) {
    document.getElementById('formTitle').innerText = "Edit Book #" + id;
    document.getElementById('bookName').value = name;
    document.getElementById('bookPrice').value = price;
    document.getElementById('bookStock').value = stock;
    document.getElementById('editBookId').value = id;
    
    document.getElementById('bookCategory').value = category;
    
    const btn = document.getElementById('submitBtn');
    btn.innerText = "Update Database";
    btn.classList.add('update-mode');
    
    document.getElementById('cancelBtn').style.display = "block";
    document.getElementById('statusMessage').innerText = "Ready to update...";
    document.getElementById('statusMessage').style.color = "orange";
}

function cancelEdit() {
    document.getElementById('formTitle').innerText = "Add New Book";
    document.getElementById('bookName').value = '';
    document.getElementById('bookPrice').value = '';
    document.getElementById('bookStock').value = '';
    document.getElementById('editBookId').value = '';
    
    document.getElementById('bookCategory').value = 'Uncategorized';
    
    const btn = document.getElementById('submitBtn');
    btn.innerText = "Add to Database";
    btn.classList.remove('update-mode');
    
    document.getElementById('cancelBtn').style.display = "none";
    document.getElementById('statusMessage').innerText = "";
}

// --- SAVE (ADD OR UPDATE) LOGIC ---
function saveBook() {
    const password = document.getElementById('adminPassword').value;
    const name = document.getElementById('bookName').value;
    const price = document.getElementById('bookPrice').value;
    const stock = document.getElementById('bookStock').value;
    const category = document.getElementById('bookCategory').value; 
    const editId = document.getElementById('editBookId').value;
    const statusBox = document.getElementById('statusMessage');

    if(!password || !name || !price || !stock) {
        statusBox.style.color = 'red'; statusBox.innerText = "Fill out all fields!"; return;
    }

    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `http://127.0.0.1:5000/update-book/${editId}` : 'http://127.0.0.1:5000/add-book';

    const bookData = { 
        password: password, 
        name: name, 
        price: parseFloat(price), 
        stock: parseInt(stock),
        category: category 
    };

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookData)
    })
    .then(res => res.json().then(data => ({status: res.status, body: data})))
    .then(res => {
        if(res.status === 200 || res.status === 201) {
            statusBox.style.color = 'green';
            statusBox.innerText = "✅ " + res.body.message;
            cancelEdit(); 
            loadInventory(); 
        } else {
            statusBox.style.color = 'red';
            statusBox.innerText = "❌ " + res.body.message;
        }
    })
    .catch(err => { statusBox.innerText = "Network Error."; });
}

// --- DELETE LOGIC ---
function deleteBook(id) {
    const password = document.getElementById('adminPassword').value;
    if(!password) {
        alert("You must enter the Admin Password in the form to delete a book!");
        return;
    }
    
    if(!confirm("Are you sure you want to delete Book #" + id + "?")) return;

    fetch(`http://127.0.0.1:5000/delete-book/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password })
    })
    .then(res => res.json().then(data => ({status: res.status, body: data})))
    .then(res => {
        if(res.status === 200) {
            alert("✅ " + res.body.message);
            loadInventory();
        } else {
            alert("❌ " + res.body.message); 
        }
    });
}