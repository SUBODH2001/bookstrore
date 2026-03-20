// NEW: Keep track of wishlist state globally on this page
let userWishlist = new Set();

window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('id');

    if (!bookId) {
        document.getElementById('bookDetailsArea').innerHTML = "<h2>Book not found!</h2>";
        return;
    }

    if (typeof recordAction === "function") recordAction('VIEW_BOOK_DETAILS', { book_id: bookId });

    // NEW: Fetch the wishlist first so we know what heart to draw, THEN load the book!
    fetchWishlistState().then(() => {
        loadBookDetails(bookId);
        loadBookReviews(bookId);
    });
};

function fetchWishlistState() {
    const token = localStorage.getItem("session_token");
    if (!token) return Promise.resolve(); 
    
    return fetch('http://127.0.0.1:5000/my-wishlist', {
        headers: { 'Authorization': token } 
    })
    .then(res => res.json())
    .then(items => {
        if (Array.isArray(items)) {
            items.forEach(item => userWishlist.add(item.id));
        }
    })
    .catch(err => console.log("Could not load wishlist state."));
}

// Support for toast popups on the book page
function showToast(message, isError = false) {
    const toast = document.getElementById("toast");
    if (!toast) { alert(message); return; } // Fallback just in case
    toast.innerText = message;
    toast.className = isError ? "error show" : "success show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

function loadBookDetails(bookId) {
    fetch(`http://127.0.0.1:5000/books/${bookId}`)
    .then(res => {
        if (!res.ok) throw new Error("Book not found");
        return res.json();
    })
    .then(book => {
        const detailsArea = document.getElementById('bookDetailsArea');
        const stockText = book.stock > 0 ? `<span style="color: green;">In Stock (${book.stock} available)</span>` : `<span style="color: red;">Out of Stock</span>`;
        
        const fullStars = Math.floor(book.rating);
        const starHtml = `<span style="color:#ffc107; font-size:1.2rem;">${'★'.repeat(fullStars)}${'☆'.repeat(5 - fullStars)}</span> <span style="font-size:1rem; color:#0070ba;">${book.rating} out of 5 (${book.reviews} global ratings)</span>`;

        // NEW: Check if it's wishlisted and pick the right heart
        const isWishlisted = userWishlist.has(book.id);
        const heartSymbol = isWishlisted ? '❤️' : '🤍';

        detailsArea.innerHTML = `
            <div class="book-cover-large">📖</div>
            <div class="book-info">
                <span class="book-category-tag">${book.category || 'Uncategorized'}</span>
                <h1 class="book-title">${book.name}</h1>
                <p class="book-author">by ${book.author} | Published: ${book.year}</p>
                <div style="margin-bottom: 15px;">${starHtml}</div>
                <hr style="border: 0; height: 1px; background: #eee; margin: 15px 0;">
                <div class="book-price-large">$${parseFloat(book.price).toFixed(2)}</div>
                <p style="font-weight: bold; margin-bottom: 20px;">${stockText}</p>
                
                <p class="synopsis">${book.synopsis}</p>
                <p style="font-size: 0.8rem; color: #888; margin-bottom: 20px;">ISBN: ${book.isbn}</p>
                
                <div style="display: flex; gap: 10px; align-items: stretch;">
                    <button class="buy-btn" style="flex: 1; padding: 15px; font-size: 1.1rem; border-radius: 25px;" 
                            onclick="addToCartFromDetails(${book.id}, '${book.name.replace(/'/g, "\\'")}', ${book.price})" 
                            ${book.stock === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                        ${book.stock === 0 ? 'Currently Unavailable' : 'Add to Cart 🛒'}
                    </button>
                    
                    <button class="wishlist-btn" style="padding: 0 15px; font-size: 1.8rem;" onclick="toggleWishlist(${book.id}, '${book.name.replace(/'/g, "\\'")}', this)" title="Save to Wishlist">
                        ${heartSymbol}
                    </button>
                </div>
            </div>
        `;
    })
    .catch(err => {
        document.getElementById('bookDetailsArea').innerHTML = "<h2 style='color:red;'>Could not load book details.</h2>";
    });
}

// NEW: Toggle logic perfectly synced with the storefront
function toggleWishlist(productId, bookName, btnElement) {
    const token = localStorage.getItem("session_token");
    if (!token) {
        showToast("You must log in to save books!", true);
        return;
    }

    const isCurrentlyWishlisted = userWishlist.has(productId);
    
    // Optimistic UI Update
    if (isCurrentlyWishlisted) {
        userWishlist.delete(productId);
        btnElement.innerText = '🤍';
    } else {
        userWishlist.add(productId);
        btnElement.innerText = '❤️';
    }

    // Trigger Animation
    btnElement.classList.remove('animating');
    void btnElement.offsetWidth; 
    btnElement.classList.add('animating');

    // Talk to the database
    fetch('http://127.0.0.1:5000/wishlist/toggle', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': token 
        },
        body: JSON.stringify({ product_id: productId })
    })
    .then(res => res.json())
    .then(data => {
        showToast(data.message, false);
        if (typeof recordAction === "function") recordAction('TOGGLE_WISHLIST', { book_id: productId, book_name: bookName, action: data.action });
    })
    .catch(err => {
        showToast("Error connecting to server.", true);
        if (isCurrentlyWishlisted) {
            userWishlist.add(productId);
            btnElement.innerText = '❤️';
        } else {
            userWishlist.delete(productId);
            btnElement.innerText = '🤍';
        }
    });
}

function loadBookReviews(bookId) {
    fetch(`http://127.0.0.1:5000/books/${bookId}/reviews`)
    .then(res => res.json())
    .then(reviews => {
        const reviewsArea = document.getElementById('reviewsList');
        
        if (reviews.length === 0) {
            reviewsArea.innerHTML = `<p style="color: #666; font-style: italic;">No written reviews yet. Be the first to review this book!</p>`;
            return;
        }

        reviewsArea.innerHTML = '';
        reviews.forEach(r => {
            const stars = `<span style="color:#ffc107;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>`;
            reviewsArea.innerHTML += `
                <div class="review-card">
                    <div class="review-header">
                        <div class="reviewer-name">👤 ${r.username}</div>
                        <div class="review-date">${r.date}</div>
                    </div>
                    <div style="margin-bottom: 10px;">${stars}</div>
                    <p style="color: #333; line-height: 1.5; margin: 0;">${r.comment || '<i>(No text comment provided)</i>'}</p>
                </div>
            `;
        });
    });
}

function addToCartFromDetails(id, name, price) {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    cart.push({ id: id, name: name, price: price });
    localStorage.setItem('cart', JSON.stringify(cart));
    
    if (typeof recordAction === "function") recordAction('ADD_TO_CART', { book_id: id, book_name: name });
    
    // Replaced standard alert with a smoother toast popup
    showToast(`"${name}" added to cart! Returning to store...`, false);
    setTimeout(() => { window.location.href = "index.html"; }, 1500);
}