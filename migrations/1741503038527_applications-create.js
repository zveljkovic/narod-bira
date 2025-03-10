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
    pgm.createTable('applications', {
        session_id: { type: 'uuid', notNull: true, primaryKey: true },
        position_id: {type: 'uuid', notNull: true, primaryKey: true },
        ip: { type: 'text', notNull: true },
        applicant_name: { type: 'text', notNull: true },
        applicant_why: { type: 'text', notNull: true },
        applicant_bio_url: { type: 'text', notNull: true },
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
    pgm.dropTable('applications');
};
