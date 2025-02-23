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
        if (s.question_id) {
            s.question = await db.getQuestion(s.question_id);
        }
    }
    res.render('review/suggestions', {qs});
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});