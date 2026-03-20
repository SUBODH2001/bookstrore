// Fetch orders as soon as the page loads
window.onload = fetchOrders;

function fetchOrders() {
    const tbody = document.getElementById('ordersTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px;">Fetching latest data...</td></tr>';

    fetch('http://127.0.0.1:5000/all-orders')
    .then(res => {
        if (!res.ok) throw new Error("Failed to connect to server");
        return res.json();
    })
    .then(orders => {
        tbody.innerHTML = '';
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 30px; color: #888;">No orders have been placed yet!</td></tr>';
            return;
        }

        orders.forEach(order => {
            // Check if it's a guest or a logged in user to apply the right CSS color
            const userStyle = order.username === "Guest / Unknown" ? "color: #888; font-style: italic;" : "class='user-badge'";

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight: bold; color: #555;">#${order.order_id}</td>
                    <td style="color: #666;">${order.date}</td>
                    <td><span ${userStyle}>${order.username}</span></td>
                    <td style="font-weight: 500;">${order.book_name}</td>
                    <td><span class="price-badge">$${parseFloat(order.price).toFixed(2)}</span></td>
                </tr>
            `;
        });
    })
    .catch(err => {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px; color: red;">❌ Error: ${err.message}</td></tr>`;
    });
}