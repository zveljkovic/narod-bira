function createUUID() {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");
    return uuid;
}

setInterval(function() {
    const classes = ['bg1', 'bg2', 'bg3', 'bg4'];
    const body = document.body;
    let currentClassIndex = classes.findIndex(c => body.classList.contains(c));
    body.classList.remove(classes[currentClassIndex]);
    let nextClassIndex = (currentClassIndex + 1) % classes.length;
    body.classList.add(classes[nextClassIndex]);
}, 10000)

function getSessionId() {
    return localStorage.getItem('sessionId');
}

function setSessionId(sessionId) {
    localStorage.setItem('sessionId', sessionId);
}

document.addEventListener("DOMContentLoaded", function() {
    // Init random session id
    if (!getSessionId()) {
        setSessionId(createUUID());
    }
    document.getElementById('session-id').innerText = getSessionId();
})

function showSection(section) {
    const duration = 0.5;
    gsap.to("#main", { opacity: section === 'main' ? 1 : 0, visibility: section === 'main' ? 'visible' : 'hidden', duration });
    gsap.to("#vote", { opacity: section === 'vote' ? 1 : 0, visibility: section === 'vote' ? 'visible' : 'hidden', duration });
    gsap.to("#question-list", { opacity: section === 'question-list' ? 1 : 0, visibility: section === 'question-list' ? 'visible' : 'hidden', duration });
}
