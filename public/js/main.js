var mainStartQuestionsButton = document.getElementById('start-questions');
var mainSection = document.getElementById('main');
var questionsSection = document.getElementById('questions');

function getSessionId() {
    return localStorage.getItem('sessionId');
}

function setSessionId(sessionId) {
    localStorage.setItem('sessionId', sessionId);
}

document.addEventListener("DOMContentLoaded", function() {
    // Init random session id
    if (getSessionId() === null) {
        setSessionId(crypto.randomUUID());
    }
    document.getElementById('session-id').innerText = getSessionId();
})

function showSection(section) {
    const duration = 0.5;
    gsap.to("#main", { opacity: section === 'main' ? 1 : 0, visibility: section === 'main' ? 'visible' : 'hidden', duration });
    gsap.to("#vote", { opacity: section === 'vote' ? 1 : 0, visibility: section === 'vote' ? 'visible' : 'hidden', duration });
    gsap.to("#question-list", { opacity: section === 'question-list' ? 1 : 0, visibility: section === 'question-list' ? 'visible' : 'hidden', duration });
}
