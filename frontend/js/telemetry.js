function recordAction(action, details = {}) {
    const token = localStorage.getItem("session_token");
    
    // If they aren't logged in, don't bother tracking for now
    if (!token) return; 

    const payload = { 
        action: action, 
        details: details 
    };

    // 🔥 POINTING STRICTLY TO THE GO MICROSERVICE ON PORT 8080
    fetch('http://127.0.0.1:8080/log-activity', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (!res.ok) throw new Error("Go server rejected the log");
    })
    .catch(err => {
        // We log it quietly in the console, but we DO NOT alert the user.
        // Telemetry should never ruin the user experience!
        console.log("Telemetry beacon failed (silent fail).", err.message);
    });
}