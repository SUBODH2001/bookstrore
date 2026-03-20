window.onload = function() {
    const token = localStorage.getItem("session_token");
    if (!token) { window.location.href = "index.html"; return; }
    
    if (typeof recordAction === "function") recordAction('VIEW_PROFILE');
    
    fetchUserProfile(token);
    fetchMyOrders(token);
    fetchMyWishlist(token); // <--- NEW ADDITION
};

function fetchUserProfile(token) {
    fetch('http://127.0.0.1:5000/my-profile', {
        headers: { 'Authorization': token }
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("profileName").innerText = data.username;
        
        // If they have a picture in the database, load it from our Flask uploads folder!
        if (data.profile_pic) {
            document.getElementById("profileImage").src = `http://127.0.0.1:5000/uploads/${data.profile_pic}`;
        }
    });
}

function fetchMyOrders(token) {
    const tbody = document.getElementById('myOrdersTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading your purchase history...</td></tr>';

    fetch('http://127.0.0.1:5000/my-orders', {
        headers: { 'Authorization': token } 
    })
    .then(res => {
        if (!res.ok) throw new Error("Session expired");
        return res.json();
    })
    .then(orders => {
        tbody.innerHTML = '';
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #888;">You haven\'t bought any books yet! Time to start reading. 📖</td></tr>';
            return;
        }

        orders.forEach(order => {
            tbody.innerHTML += `
                <tr>
                    <td style="color: #666;">#${order.order_id}</td>
                    <td style="font-weight: 500;">${order.book_name}</td>
                    <td>$${parseFloat(order.price).toFixed(2)}</td>
                    <td style="color: #888;">${order.date}</td>
                </tr>
            `;
        });
    })
    .catch(err => {
        alert("Session expired. Please log in again.");
        logout();
    });
}

function logout() {
    // 🚀 LOG: Logout
    recordAction('LOGOUT');

    localStorage.removeItem("session_token");
    localStorage.removeItem("username");
    window.location.href = "index.html";
}

let cropper = null;

function prepareCrop(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const image = document.getElementById('imageToCrop');
            
            // 1. Set the source
            image.src = e.target.result;
            
            // 2. Show the modal first so the image has dimensions
            document.getElementById('cropModal').style.display = 'flex';
            
            // 3. WAIT for the image to finish loading before starting Cropper
            image.onload = () => {
                if (cropper) cropper.destroy();
                
                cropper = new Cropper(image, {
                    aspectRatio: 1, // Perfect square
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.8,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                });
            };
        };
        reader.readAsDataURL(files[0]);
    }
}

function closeCropModal() {
    document.getElementById('cropModal').style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById('fileInput').value = ""; // Clear the input
}

function executeCrop() {
    if (!cropper) return;

    // Get a high-quality 300x300 square
    const canvas = cropper.getCroppedCanvas({
        width: 300,
        height: 300,
    });

    canvas.toBlob((blob) => {
        const token = localStorage.getItem("session_token");
        const formData = new FormData();
        formData.append('file', blob, 'profile.jpg');

        // Show a "Loading" state on the button
        const saveBtn = document.querySelector('.crop-box .buy-btn');
        const originalText = saveBtn.innerText;
        saveBtn.innerText = "Uploading...";
        saveBtn.disabled = true;

        fetch('http://127.0.0.1:5000/upload-avatar', {
            method: 'POST',
            headers: { 'Authorization': token },
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.filename) {
                // Update the main profile image
                document.getElementById("profileImage").src = `http://127.0.0.1:5000/uploads/${data.filename}?t=${new Date().getTime()}`;
                
                // 🚀 LOG: Profile Picture Uploaded
                recordAction('UPLOAD_PROFILE_PIC');
                
                closeCropModal();
            }
        })
        .catch(err => alert("Upload failed."))
        .finally(() => {
            saveBtn.innerText = originalText;
            saveBtn.disabled = false;
        });
    }, 'image/jpeg', 0.9); // 0.9 = 90% quality
}

function fetchMyWishlist(token) {
    const tbody = document.getElementById('myWishlistTableBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading your wishlist...</td></tr>';

    fetch('http://127.0.0.1:5000/my-wishlist', {
        headers: { 'Authorization': token } 
    })
    .then(res => res.json())
    .then(items => {
        tbody.innerHTML = '';
        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #888;">Your wishlist is empty. Go find some great books! 📚</td></tr>';
            return;
        }

        items.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: bold;"><a href="book.html?id=${item.id}" style="color: #0070ba; text-decoration: none;">${item.name}</a></td>
                    <td style="color: #666;">${item.author}</td>
                    <td>$${parseFloat(item.price).toFixed(2)}</td>
                    <td>
                        <button class="buy-btn" style="padding: 5px 10px; font-size: 0.8rem;" onclick="addToCartFromWishlist(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.price})">Add to Cart</button>
                    </td>
                </tr>
            `;
        });
    })
    .catch(err => {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">Failed to load wishlist.</td></tr>';
    });
}

function addToCartFromWishlist(id, name, price) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.push({ id: id, name: name, price: price });
    localStorage.setItem('cart', JSON.stringify(cart));
    
    if (typeof recordAction === "function") recordAction('ADD_TO_CART_FROM_WISHLIST', { book_id: id, book_name: name });
    
    alert(`"${name}" added to cart!`);
}