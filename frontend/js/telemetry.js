function recordAction(actionName, extraDetails = {}) {
    const token = localStorage.getItem("session_token");
    if (!token) return; // Don't log if not logged in

    fetch('http://127.0.0.1:5000/log-activity', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': token 
        },
        body: JSON.stringify({
            action: actionName,
            details: {
                ...extraDetails,
                url: window.location.pathname,
                screen_size: `${window.innerWidth}x${window.innerHeight}`
            }
        })
    }).catch(err => console.log("Telemetry failed, ignoring..."));
}