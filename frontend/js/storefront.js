// --- 1. STATE VARIABLES ---
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentPage = 1;
let currentCategory = 'All';
let searchTimeout = null;
let userWishlist = new Set();

// --- 2. INITIALIZATION ---
window.onload = function() {
    const savedUser = localStorage.getItem("username");
    if (savedUser) {
        showLoggedInState(savedUser);
        // Wait to fetch their wishlist BEFORE drawing the books so the hearts are accurate!
        fetchWishlistState().then(() => initStore());
    } else {
        initStore();
    }
    updateCartUI(); 
};

// --- 3. TOAST NOTIFICATIONS ---
function showToast(message, isError = false) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.className = isError ? "error show" : "success show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// --- 4. AUTHENTICATION ---
function showLoggedInState(username) {
    const userArea = document.getElementById('userArea');
    userArea.innerHTML = `
        <a href="profile.html" style="font-weight: bold; margin-right: 15px; color: white; text-decoration: none; background: #3a4b60; padding: 8px 15px; border-radius: 20px;">👤 Profile: ${username}</a>
        <button class="auth-btn" onclick="logout()">Logout</button>
        <button class="cart-btn" onclick="toggleCart()">🛒 Cart (<span id="cartCount">${cart.length}</span>)</button>
    `;
}

function register() {
    const u = document.getElementById('usernameInput').value;
    const p = document.getElementById('passwordInput').value;
    fetch('http://127.0.0.1:5000/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
    })
    .then(res => res.json())
    .then(data => {
        if(data.message.includes("created")) showToast(data.message, false);
        else showToast(data.message, true);
    });
}

function login() {
    const u = document.getElementById('usernameInput').value;
    const p = document.getElementById('passwordInput').value;
    fetch('http://127.0.0.1:5000/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
    })
    .then(res => {
        if(!res.ok) throw new Error("Invalid username or password");
        return res.json();
    })
    .then(data => {
        localStorage.setItem("session_token", data.token);
        localStorage.setItem("username", data.username);
        showLoggedInState(data.username);
        showToast(`Welcome back, ${data.username}!`, false);
        // 🚀 LOG: Login success
        recordAction('LOGIN_SUCCESS', { user: data.username });
    })
    .catch(err => showToast(err.message, true));
}

function logout() {
    // 🚀 LOG: Logout (Record this BEFORE clearing the token!)
    recordAction('LOGOUT');

    localStorage.removeItem("session_token");
    localStorage.removeItem("username");
    location.reload(); 
}

// --- 5. CART & CHECKOUT ---
function updateCartUI() {
    const countEl = document.getElementById('cartCount');
    if(countEl) countEl.innerText = cart.length;
    
    const list = document.getElementById('cartItemsList');
    let total = 0;
    list.innerHTML = '';
    
    if (cart.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#888;">Your cart is empty.</p>';
    }

    cart.forEach((item, index) => {
        total += item.price;
        list.innerHTML += `
            <div class="cart-item">
                <span>${item.name}</span>
                <span>$${item.price.toFixed(2)} 
                    <span style="color:red; cursor:pointer; margin-left:10px;" onclick="removeFromCart(${index})">🗑️</span>
                </span>
            </div>
        `;
    });
    
    document.getElementById('cartTotal').innerText = total.toFixed(2);
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(id, name, price) {
    cart.push({ id: id, name: name, price: price });
    updateCartUI();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();

    // 🚀 LOG: Item added to cart
    recordAction('ADD_TO_CART', { book_id: id, book_name: name });
}

function clearCart() {
    cart = [];
    updateCartUI();
}

function toggleCart() {
    const overlay = document.getElementById('cartOverlay');
    overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';

    // 🚀 LOG: Opened/Closed Cart
    if (overlay.style.display === 'flex') recordAction('VIEW_CART');
}

// --- NEW CHECKOUT & PAYMENT FLOW ---

function checkout() {
    const token = localStorage.getItem("session_token");
    if (!token) { showToast("Please log in to checkout!", true); return; }
    if (cart.length === 0) { showToast("Your cart is empty!", true); return; }

    // 1. Get the total from the cart
    const total = document.getElementById('cartTotal').innerText;
    
    // 2. Pass the total to the payment modal
    document.getElementById('paymentTotal').innerText = total;
    document.getElementById('btnPaymentTotal').innerText = total;
    
    // 3. Hide the cart, show the payment gateway
    document.getElementById('cartOverlay').style.display = 'none';
    document.getElementById('paymentOverlay').style.display = 'flex';
    
    // 🚀 LOG: Reached the checkout screen
    recordAction('INITIATE_CHECKOUT', { cart_total: total });
}

function closePaymentModal() {
    document.getElementById('paymentOverlay').style.display = 'none';
    document.getElementById('cartOverlay').style.display = 'flex'; // Go back to cart
}

// Auto-adds spaces every 4 digits for a realistic feel!
function formatCardNumber(input) {
    let val = input.value.replace(/\D/g, ''); // Strip non-digits
    val = val.replace(/(.{4})/g, '$1 ').trim(); // Add space every 4 chars
    input.value = val;
}

function processPayment() {
    // Basic frontend validation
    const name = document.getElementById('cardName').value;
    const num = document.getElementById('cardNumber').value.replace(/\s/g, '');
    const exp = document.getElementById('cardExpiry').value;
    const cvc = document.getElementById('cardCVC').value;

    if(!name || num.length < 16 || exp.length < 5 || cvc.length < 3) { 
        showToast("Please fill out all card details correctly.", true); 
        return; 
    }

    // Change button state to simulate processing
    const payBtn = document.getElementById('payButton');
    payBtn.innerText = "Processing Payment... 🔄";
    payBtn.disabled = true;

    // Simulate 2 seconds of bank network latency
    setTimeout(() => {
        executeActualBackendCheckout();
    }, 2000);
}

function executeActualBackendCheckout() {
    const token = localStorage.getItem("session_token");

    fetch('http://127.0.0.1:5000/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ cart: cart })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message.includes("successful")) {
            showToast("✅ Payment Approved! " + data.message, false);
            
            // 🚀 LOG: Successful Purchase
            recordAction('PURCHASE_COMPLETE', { item_count: cart.length });

            cart = [];
            updateCartUI();
            applyFilters(); 
            
            // Close the modal and reset it
            document.getElementById('paymentOverlay').style.display = 'none';
            resetPaymentForm();
        } else {
            showToast("❌ " + data.message, true); 
            resetPaymentForm();
        }
    })
    .catch(err => {
        showToast("Checkout Error. Bank servers down.", true);
        resetPaymentForm();
    });
}

function resetPaymentForm() {
    const payBtn = document.getElementById('payButton');
    payBtn.innerHTML = `Pay $<span id="btnPaymentTotal">${document.getElementById('paymentTotal').innerText}</span>`;
    payBtn.disabled = false;
    document.getElementById('cardName').value = '';
    document.getElementById('cardNumber').value = '';
    document.getElementById('cardExpiry').value = '';
    document.getElementById('cardCVC').value = '';
}

// --- 6. STORE DISPLAY & PAGINATION ---
function createBookCard(book) {
    const stockClass = book.stock < 5 ? 'stock low' : 'stock';
    const stockText = book.stock > 0 ? `In Stock: ${book.stock}` : 'Out of Stock';
    const salesBadge = book.sales !== undefined ? `<p style="font-size:0.8rem; color:#666; margin: 2px 0;">📈 ${book.sales} copies sold</p>` : '';
    const starHtml = generateStars(book.rating);

    // NEW: Check if this book is in their wishlist Set to pick the right emoji
    const isWishlisted = userWishlist.has(book.id);
    const heartSymbol = isWishlisted ? '❤️' : '🤍';

    return `
        <div class="book-card" data-category="${book.category || 'Uncategorized'}">
            <span class="book-category-tag">${book.category || 'Uncategorized'}</span>
            <a href="book.html?id=${book.id}" style="text-decoration: none; color: inherit;">
                <h3 style="margin-bottom: 5px; cursor: pointer;">${book.name}</h3>
            </a>
            <div style="margin-bottom: 10px;">
                ${starHtml} <span style="font-size:0.8rem; color:#888;">(${book.reviews} reviews)</span>
            </div>
            <p class="price" style="margin: 5px 0;">$${parseFloat(book.price).toFixed(2)}</p>
            <p class="${stockClass}" style="margin: 5px 0;">${stockText}</p>
            ${salesBadge}
            
            <div style="display: flex; gap: 8px; margin-top: 15px; align-items: stretch;">
                <button class="buy-btn" onclick="addToCart(${book.id}, '${book.name.replace(/'/g, "\\'")}', ${book.price})" ${book.stock === 0 ? 'disabled style="opacity: 0.5;"' : ''}>
                    ${book.stock === 0 ? 'Unavailable' : 'Add to Cart'}
                </button>
                <button class="rate-btn" onclick="leaveReview(${book.id})" title="Leave a Review">
                    ⭐ Rate
                </button>
                
                <button class="wishlist-btn" onclick="toggleWishlist(${book.id}, '${book.name.replace(/'/g, "\\'")}', this)" title="Save to Wishlist">
                    ${heartSymbol}
                </button>
            </div>
        </div>
    `;
}

function initStore() {
    // 1. Trending Books (Runs on Home and Best Sellers page)
    const trendingFront = document.getElementById('trending-front');
    if (trendingFront) {
        fetch('http://127.0.0.1:5000/trending').then(res => res.json()).then(books => {
            trendingFront.innerHTML = ''; 
            books.forEach(book => trendingFront.innerHTML += createBookCard(book));
        });
    }

    // 2. Categories (Only runs if the Category Menu exists)
    const menu = document.getElementById('categoryMenu');
    if (menu) {
        fetch('http://127.0.0.1:5000/categories').then(res => res.json()).then(cats => {
            menu.innerHTML = `<button class="cat-btn active" onclick="setCategory('All')">All</button>`;
            cats.forEach(cat => {
                menu.innerHTML += `<button class="cat-btn" onclick="setCategory('${cat}')">${cat}</button>`;
            });
        });
    }

    // 3. Main Store Inventory (Only runs if the store-front grid exists)
    const storeFront = document.getElementById('store-front');
    if (storeFront) {
        fetchPaginatedBooks(true); 
    }
}
function setCategory(categoryName) {
    currentCategory = categoryName;
    document.querySelectorAll('.cat-btn').forEach(btn => {
        if (btn.innerText === categoryName) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    applyFilters();
}

function debounceSearch() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { applyFilters(); }, 300); 
}

function applyFilters() {
    currentPage = 1; // Reset to page 1 whenever search or category changes

    // 🚀 LOG: Searched or Filtered
    const searchVal = document.getElementById('searchBar').value;
    recordAction('SEARCH_OR_FILTER', { query: searchVal, category: currentCategory });

    fetchPaginatedBooks(true); 
}

function loadMoreBooks() {
    currentPage++;

    // 🚀 LOG: Clicked Load More
    recordAction('LOAD_MORE_CLICKED', { new_page: currentPage });

    fetchPaginatedBooks(false); 
}

function fetchPaginatedBooks(clearGridFirst) {
    const storeFront = document.getElementById('store-front');
    if (!storeFront) return; // Stop immediately if we are not on the main store page!

    const searchInput = document.getElementById('searchBar');
    const searchVal = searchInput ? searchInput.value : '';
    const loadBtn = document.getElementById('loadMoreBtn');
    
    if (clearGridFirst) storeFront.innerHTML = '';

    const url = `http://127.0.0.1:5000/books?page=${currentPage}&search=${encodeURIComponent(searchVal)}&category=${encodeURIComponent(currentCategory)}`;

    fetch(url).then(res => res.json()).then(books => {
        if (clearGridFirst && books.length === 0) {
            storeFront.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #666;">No books found matching your criteria!</p>';
        }

        books.forEach(book => storeFront.innerHTML += createBookCard(book));

        if (loadBtn) {
            if (books.length < 20) loadBtn.style.display = 'none';
            else loadBtn.style.display = 'inline-block';
        }
    });
}

// Creates a visual star rating string (e.g., ⭐⭐⭐⭐☆)
function generateStars(rating) {
    if (rating === 0) return "<span style='color:#ccc; font-size: 0.9rem;'>No reviews yet</span>";
    
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;
    return `<span style="color:#ffc107; font-size:1.1rem;">${'★'.repeat(fullStars)}${'☆'.repeat(emptyStars)}</span> <span style="font-size:0.8rem; color:#666;">(${rating})</span>`;
}

// --- NEW: Submit Review Logic ---
function leaveReview(productId) {
    const token = localStorage.getItem("session_token");
    if (!token) {
        showToast("You must log in to leave a review!", true);
        return;
    }

    // Using simple prompts for the MVP review system
    const ratingInput = prompt("Rate this book from 1 to 5:");
    if (!ratingInput) return; // User cancelled
    
    const rating = parseInt(ratingInput);
    if (isNaN(rating) || rating < 1 || rating > 5) {
        alert("Please enter a valid number between 1 and 5.");
        return;
    }

    const comment = prompt("Optional: Leave a short comment about the book:");

    fetch('http://127.0.0.1:5000/submit-review', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': token 
        },
        body: JSON.stringify({ product_id: productId, rating: rating, comment: comment })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message.includes("Thank you")) {
            showToast("✅ " + data.message, false);

            // 🚀 LOG: Review Submitted
            recordAction('REVIEW_SUBMITTED', { book_id: productId, rating: rating });

            applyFilters(); // Instantly re-fetch the books so the stars update!
        } else {
            showToast("❌ " + data.message, true); // E.g., "You already reviewed this!"
        }
    })
    .catch(err => showToast("Error connecting to server.", true));
}

// --- NEW & IMPROVED WISHLIST TOGGLE ---
function toggleWishlist(productId, bookName, btnElement) {
    const token = localStorage.getItem("session_token");
    if (!token) {
        showToast("You must log in to save books!", true);
        return;
    }

    // 1. OPTIMISTIC UI UPDATE (Instant Feedback!)
    const isCurrentlyWishlisted = userWishlist.has(productId);
    
    if (isCurrentlyWishlisted) {
        userWishlist.delete(productId);
        btnElement.innerText = '🤍';
    } else {
        userWishlist.add(productId);
        btnElement.innerText = '❤️';
    }

    // 2. TRIGGER THE POP ANIMATION
    btnElement.classList.remove('animating');
    void btnElement.offsetWidth; // This forces the browser to restart the animation
    btnElement.classList.add('animating');

    // 3. TALK TO THE DATABASE
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
        
        if (typeof recordAction === "function") {
            recordAction('TOGGLE_WISHLIST', { book_id: productId, book_name: bookName, action: data.action });
        }
    })
    .catch(err => {
        // If the server fails, revert the heart back to what it was
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
