require('dotenv').config();

const express = require('express');
const path = require('path');
const app = express();
const db = require('./db');
const publicDir = path.join(__dirname, '..', 'public');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(publicDir));
app.use(express.json());


app.get('/vote/question', async (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        res.render('vote/invalid/session');
        return;
    }

    const q = await db.getQuestionForVote(sessionId)
    if (q === null) {
        res.render('vote/empty');
    }

    res.render('vote/question', {question: q, sessionId, generalError: null});
});

app.post('/vote/:type', async (req, res) => {
    const sessionId = req.body.sessionId;
    const questionId = req.body.id;
    const q = await db.getQuestion(questionId);
    try {
        const hasVote = await db.hasVote(sessionId, questionId);
        if (hasVote) {
            const generalError = "Već ste glasali na ovo pitanje. Molim vas osvežite stranicu.";
            res.render('vote/question', {question: q, sessionId, generalError});
        }
        const ip = req.headers['x-forwarded-for'] || req.ip;

        let vote = null;
        if (req.params.type === 'support') {
            vote = 1;
        } else if (req.params.type === 'sustained') {
            vote = 0;
        } else if (req.params.type === 'against') {
            vote = 2;
        }
        await db.insertVote(sessionId, questionId, ip, vote);
    } catch (e) {
        generalError = "Desila se sistemska greška: " + e.message;
    }
    res.render('vote/success', {question: q, sessionId});
});



app.get('/question/list', async (req, res) => {
    const sessionId = req.query.sessionId;
    const questions = await db.getQuestions();
    const voteSum =  await db.getVoteSum();
    const votesPerQuestion = voteSum.reduce((acc, cur) => {
        if (!acc[cur.question_id]) {
            acc[cur.question_id] = {support: 0, against: 0, sustained: 0};
        }
        if (cur.vote === 1) {
            acc[cur.question_id].support += cur.count;
        } else if (cur.vote === 2) {
            acc[cur.question_id].against += cur.count;
        } else if (cur.vote === 0) {
            acc[cur.question_id].sustained += cur.count;
        }
        return acc;
    }, {})
    const votes = await db.getVotesForSessionId(sessionId);
    const userVotes = votes.reduce((acc, cur) => {
        if (cur.vote === 1) {
            acc[cur.question_id] = 'za';
        } else if (cur.vote === 2) {
            acc[cur.question_id] = 'protiv';
        } else {
            acc[cur.question_id] = 'uzdržan';
        }
        return acc;
    }, {})
    res.render('question/list', {sessionId, questions, votesPerQuestion, userVotes});
});

app.get('/question/add-form', (req, res) => {
    const sessionId = req.query.sessionId;
    const title = '';
    const titleError = '';
    const description = '';
    const descriptionError = '';
    const generalError = '';
    res.render('question/add-form', {sessionId, title, titleError, description, descriptionError, generalError});
});

app.post('/question/add', async (req, res) => {
    const sessionId = req.body.sessionId;
    const title = req.body.title;
    const description = req.body.description;
    let titleError = '';
    if (title.trim().length === 0) {
        titleError = 'Naslov ne sme biti prazan';
    }
    let descriptionError = '';
    if (description.trim().length === 0) {
        descriptionError = 'Opis ne sme biti prazan';
    }
    let generalError = '';
    try {
        const ip = req.headers['x-forwarded-for'] || req.ip;
        await db.insertQuestionSuggestion(sessionId, ip, title, description);
    } catch (e) {
        generalError = "Desila se sistemska greška: " + e.message;
    }
    if (titleError !== '' || descriptionError !== '' || generalError !== '') {
        res.render('question/add-form', {sessionId, title, titleError, description, descriptionError, generalError});
    } else {
        res.render('question/add-success');
    }
});

app.get('/question/edit-form', async (req, res) => {
    const sessionId = req.query.sessionId;
    const questionId = req.query.id;

    let question = null;
    try {
        question = await db.getQuestion(questionId);
    } catch (e) {
        return res.status(404).render('error', {error: e.message});
    }

    const title = question.title;
    const titleError = '';
    const description = question.description;
    const descriptionError = '';
    const generalError = '';
    res.render('question/edit-form', {sessionId, questionId, title, titleError, description, descriptionError, generalError});
});

app.post('/question/edit', async (req, res) => {
    const sessionId = req.body.sessionId;
    const questionId = req.body.id;
    const title = req.body.title;
    const description = req.body.description;
    let titleError = '';
    if (title.trim().length === 0) {
        titleError = 'Naslov ne sme biti prazan';
    }
    let descriptionError = '';
    if (description.trim().length === 0) {
        descriptionError = 'Opis ne sme biti prazan';
    }
    let generalError = '';
    try {
        const ip = req.headers['x-forwarded-for'] || req.ip;
        await db.insertQuestionSuggestionForQuestion(sessionId, ip, questionId, title, description);
    } catch (e) {
        generalError = e.message;
    }
    if (titleError !== '' || descriptionError !== '' || generalError !== '') {
        res.render('question/edit-form', {sessionId, questionId, title, titleError, description, descriptionError, generalError});
    } else {
        res.render('question/edit-success');
    }
});

app.post('/question-suggestion/resolve', async (req, res) => {
    const {sessionId, questionSuggestionId, add, resolution} = req.body;
    if (sessionId !== process.env.ADMIN_SESSION_ID) {
        return res.json({error: 'Niste administrator'});
    }
    const currentQS = await db.getQuestionSuggestion(questionSuggestionId);
    if (currentQS.resolution !== null) {
        return res.json({error: 'Sugestija je već ' + (currentQS.added ? 'odobrena' : 'odbijena') + ' uz napomenu: ' + currentQS.resolution});
    }
    const qs = await db.updateQuestionSuggestion(questionSuggestionId, resolution, add);
    if (!add) {
        return res.json( {status: 'ok'});
    }

    if (!qs.question_id) {
        const q = await db.insertQuestion(qs.title, qs.description);
        return res.json({status: 'ok', question: q});
    }

    const q = await db.updateQuestion(qs.title, qs.description);
    return res.json({status: 'ok', question: q});
});


app.get('/review', async (req, res) => {
    const qs = await db.getQuestionSuggestions();
    for (const s of qs) {
        if (s.session_id === process.env.ADMIN_SESSION_ID) {
            s.session_id = 'Administrator';
        }
        if (s.question_id) {
            s.question = await db.getQuestion(s.question_id);
        }
    }
    res.render('review/suggestions', {qs});
});


app.get('/position/admin', async (req, res) => {
    const sessionId = req.query.sessionId;
    const positions = await db.getPositions();
    res.render('position/index', {sessionId, positions});
});

app.post('/position/add', async (req, res) => {
    const sessionId = req.body.sessionId;
    const name = req.body.name;
    const path = req.body.path;
    let nameError = '';
    if (name.trim().length === 0) {
        nameError = 'Naziv ne sme biti prazan';
    }
    let pathError = '';
    if (path.trim().length === 0) {
        pathError = 'Putanja ne sme biti prazna';
    }
    if (!path.trim().startsWith('/')) {
        nameError = 'Putanja mora početi sa /';
    }
    let generalError = '';
    try {
        const ip = req.headers['x-forwarded-for'] || req.ip;
        await db.insertPosition(name.trim(), path.trim());
    } catch (e) {
        generalError = "Desila se sistemska greška: " + e.message;
    }
    if (nameError !== '' || pathError !== '' || generalError !== '') {
        res.render('position/add-form', {sessionId, name, nameError, path, pathError, generalError});
    } else {
        res.render('position/add-success', {sessionId});
    }
});

app.get('/applications/add', async (req, res) => {
    const sessionId = req.query.sessionId;
    const positionId = req.query.positionId;
    res.render('application/add-form', {
        sessionId, positionId, generalError: null,
        applicantName: null, applicantNameError: '',
        applicantWhy: null, applicantWhyError: '',
        applicantBioUrl: null, applicantBioUrlError: ''
    });
});


app.post('/applications/add', async (req, res) => {
    const sessionId = req.body.sessionId;
    const positionId = req.body.positionId;
    const applicantName = req.body.applicantName;
    const applicantWhy = req.body.applicantWhy;
    const applicantBioUrl = req.body.applicantBioUrl;
    let applicantNameError = '';
    if (applicantName.trim().length === 0) {
        applicantNameError = 'Ime i prezime ne sme biti prazno';
    }
    let applicantWhyError = '';
    if (applicantWhy.trim().length === 0) {
        applicantWhyError = 'Obrazloženje ne sme biti prazno'
    } else if (applicantWhy.trim().length < 100) {
        applicantWhyError = 'Obrazloženje mora biti duže od 100 slova'
    }

    let applicantBioUrlError = '';
    if (applicantBioUrl.trim().length === 0) {
        applicantBioUrlError = 'URL biografije ne sme biti prazan';
    } else if (!applicantBioUrl.trim().startsWith('http://') && !applicantBioUrl.trim().startsWith('https://')) {
        applicantBioUrlError = 'URL biografije mora početi sa http:// ili https://';
    }

    let generalError = '';
    try {
        const ip = req.headers['x-forwarded-for'] || req.ip;
        await db.insertApplication(sessionId, positionId, ip, applicantName.trim(), applicantWhy.trim(), applicantBioUrl.trim());
    } catch (e) {
        if (e.message === 'duplicate key value violates unique constraint "applications_pkey"') {
            generalError = "Već ste predložili nekog za ovu poziciju";
        } else {
            generalError = "Desila se sistemska greška: " + e.message;
        }
    }
    if (applicantNameError !== '' || applicantWhyError !== '' || applicantBioUrlError !== '' || generalError !== '') {
        res.render('application/add-form', {
            sessionId, positionId, generalError,
            applicantName, applicantNameError,
            applicantWhy, applicantWhyError,
            applicantBioUrl, applicantBioUrlError,
        });
    } else {
        res.render('application/add-success', {sessionId});
    }


});

app.post('/applications/list', async (req, res) => {
    const sessionId = req.body.sessionId;
    const path = req.body.path;
    const positions = await db.getPositionsForPath(path);
    const tempApplications = await db.getApplicationsForPositions(positions.map(p => p.id));
    const applications = tempApplications.reduce((acc, app) => {
        if (!acc[app.position_id]) {
            acc[app.position_id] = [];
        }
        acc[app.position_id].push(app);
        return acc;
    }, {});

    res.render('application/application-list', {sessionId, positions, applications});
});

app.get('/applications', async (req, res) => {
    console.log("applications");const sessionId = req.query.sessionId;
    const positions = await db.getPositions();
    // Remove duplicates
    const paths = positions.map(p => p.path)
        .reduce((acc, p) => {
            if (acc.includes(p)) return acc;
            acc.push(p);
            return acc;
        }, []);
    res.render('application/index', {sessionId, paths});
});


// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});