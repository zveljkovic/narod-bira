/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    pgm.createTable('question_suggestions', {
        id: {
            type: 'uuid',
            default: pgm.func('uuid_generate_v4()'),
            notNull: true,
            primaryKey: true
        },
        question_id: {type: 'uuid', notNull: false },
        session_id: 'uuid',
        ip: { type: 'text', notNull: true },
        title: { type: 'text', notNull: true },
        description: { type: 'text', notNull: true },
        resolution: { type: 'text', notNull: false },
        added: { type: 'boolean', default: false },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('question_suggestions');
};
