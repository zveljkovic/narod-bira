const {Pool} = require('pg');

const pool = new Pool({
    max: 10,
    connectionString: process.env.DATABASE_URL,
});


async function insertQuestionSuggestionForQuestion(session_id, ip, question_id, title, description) {
    return pool.query('INSERT INTO question_suggestions(session_id, ip, question_id, title, description) VALUES ($1::uuid, $2::text, $3::uuid, $4::text, $5::text)', [session_id, ip, question_id, title, description])
}

async function insertQuestionSuggestion(session_id, ip, title, description) {
    return pool.query('INSERT INTO question_suggestions(session_id, ip, title, description) VALUES ($1::uuid, $2::text, $3::text, $4::text)', [session_id, ip, title, description])
}

async function getQuestionSuggestion(id) {
    const result = await pool.query('SELECT id, session_id, ip, question_id, title, description, resolution, added, created_at FROM question_suggestions WHERE id = $1::uuid', [id]);
    if (result.rows.length === 0) {
        throw new Error('Sugestija za pitanje nije nađena');
    }
    return result.rows[0];
}


async function getQuestionSuggestions() {
    const result = await pool.query('SELECT id, session_id, question_id, title, description, resolution, added, created_at FROM question_suggestions ORDER BY created_at DESC');
    return result.rows;
}

async function updateQuestionSuggestion(id, resolution, added) {
    const result = await pool.query(
        'UPDATE question_suggestions SET resolution = $2, added = $3 WHERE id = $1::uuid RETURNING id, session_id, ip, title, description, resolution, added, created_at',
        [id, resolution, added]
    );
    if (result.rows.length === 0) {
        throw new Error('Sugestija za pitanje nije nađena');
    }
    return result.rows[0];
}

async function insertQuestion(title, description) {
    const result = await pool.query('INSERT INTO questions(title, description) VALUES ($1::text, $2::text) RETURNING id, title, description, created_at', [title, description])
    if (result.rows.length === 0) {
        throw new Error('Neuspešno dodavanje pitanja');
    }
    return result.rows[0];
}

async function updateQuestion(id, title, description) {
    const result = await pool.query('UPDATE questions SET title = $2::text, description = $3::text WHERE id = $3::uuid RETURNING id, title, description, created_at', [id, title, description])
    if (result.rows.length === 0) {
        throw new Error('Neuspešna izmena pitanja');
    }
    return result.rows[0];
}

async function getQuestions() {
    const result = await pool.query('SELECT id, title, description, created_at FROM questions');
    return result.rows;
}


async function getQuestion(id) {
    const result = await pool.query('SELECT id, title, description, created_at FROM questions WHERE id = $1::uuid', [id]);
    if (result.rows.length === 0) {
        throw new Error('Neuspesno nalazenje pitanja');
    }
    return result.rows[0];
}

async function getQuestionForVote(session_id) {
    const sql = `
SELECT q.id FROM questions q
WHERE q.id NOT IN (
    SELECT v.question_id
    FROM votes v
    WHERE v.session_id = $1::uuid
)`;
    const availableIds = await pool.query(sql, [session_id]);
    if (availableIds.rows.length === 0) {
        return null;
    }
    const l = availableIds.rows.length;
    const randomIndex = Math.floor(Math.random() * l);
    return getQuestion(availableIds.rows[randomIndex].id);
}

/**
 * @param {string} session_id
 * @param {string} question_id
 * @returns {Promise<boolean>}
 */
async function hasVote(session_id, question_id) {
    const result = await pool.query(
        'SELECT EXISTS(SELECT 1 FROM votes WHERE session_id = $1::uuid AND question_id = $2::uuid) AS vote_exists',
        [session_id, question_id]
    );
    return result.rows[0].vote_exists;
}


/**
 * Inserts a vote record into the database.
 *
 * @param {string} session_id - The ID of the session casting the vote.
 * @param {string} question_id - The ID of the question being voted on.
 * @param {string} ip - Record IP address of vote.
 * @param {int} vote - 1 support, 0 sustained, 2 against
 * @returns {Promise<void>}
 */
async function insertVote(session_id, question_id, ip, vote) {
    await pool.query(
        'INSERT INTO votes(session_id, question_id, ip, vote) VALUES ($1::uuid, $2::uuid, $3::text, $4::smallint)',
        [session_id, question_id, ip, vote]
    );
}

/**
 * Gets sum of all votes.
 *
 * @returns {Promise<Array<{question_id: string, id: string, vote: number, count: number}>>}
 */
async function getVoteSum() {
    const sql = `SELECT v.question_id, q.id, v.vote, COUNT(*)::int as count
                 FROM questions q
                          LEFT JOIN public.votes v on q.id = v.question_id
                 GROUP BY v.question_id, q.id, v.vote`;
    const result = await pool.query(sql);
    return result.rows;
}

/**
 * Gets sum of all votes.
 *
 * @returns {Promise<Array<{question_id: string, vote: number}>>}
 */
async function getVotesForSessionId(session_id) {
    const sql = `SELECT question_id, vote
FROM votes WHERE votes.session_id = $1::uuid`;
    const result = await pool.query(sql, [session_id]);
    return result.rows;
}


/**
 * Gets all positions
 *
 * @returns {Promise<Array<{id: string, name: string, path: string}>>}
 */
async function getPositions() {
    const result = await pool.query('SELECT id, name, path FROM positions ORDER BY path');
    return result.rows;
}


/**
 * Inserts a position record into the database.
 *
 * @param {string} name - Name of position.
 * @param {string} path - Path of position.
 * @returns {Promise<void>}
 */
async function insertPosition(name, path) {
    await pool.query(
        'INSERT INTO positions(name, path) VALUES ($1::text, $2::text)',
        [name, path]
    );
}

/**
 * Gets positions for path
 *
 * @param {string} path - Path of position.
 * @returns {Promise<Array<{id: string, name: string, path: string}>>}
 */
async function getPositionsForPath(path) {
    const result = await pool.query('SELECT id, name, path FROM positions WHERE path = $1::text', [path]);
    return result.rows;
}

/**
 * Gets positions for path
 *
 * @param {string[]} positionIds - Path of position.
 * @returns {Promise<Array<{
 * session_id: string,
 * position_id: string,
 * applicant_name: string,
 * applicant_why: string,
 * applicant_bio_url: string,
 * created_at: string,
 * }>>}
 */
async function getApplicationsForPositions(positionIds) {
    const sql = `
        SELECT a.session_id, a.position_id, a.applicant_name, a.applicant_why, a.applicant_bio_url, a.created_at
        FROM applications a
        WHERE a.position_id = ANY($1::uuid[])
    `;
    const result = await pool.query(sql, [positionIds]);
    return result.rows;
}


async function insertApplication(session_id, position_id, ip, applicant_name, applicant_why, applicant_bio_url) {
    await pool.query(
        `INSERT INTO applications(session_id, position_id, ip, applicant_name, applicant_why, applicant_bio_url) 
         VALUES ($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text)`,
        [session_id, position_id, ip, applicant_name, applicant_why, applicant_bio_url]
    );
}


module.exports = {
    insertQuestionSuggestion,
    insertQuestionSuggestionForQuestion,
    getQuestionSuggestion,
    getQuestionSuggestions,
    updateQuestionSuggestion,
    insertQuestion,
    updateQuestion,
    getQuestion,
    getQuestions,
    getQuestionForVote,
    hasVote,
    insertVote,
    getVoteSum,
    getVotesForSessionId,
    getPositions,
    insertPosition,
    getPositionsForPath,
    getApplicationsForPositions,
    insertApplication,
}