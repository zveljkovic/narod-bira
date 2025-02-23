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
    pgm.addExtension('uuid-ossp');
    pgm.createTable('questions', {
        id: {
            type: 'uuid',
            default: pgm.func('uuid_generate_v4()'),
            notNull: true,
            primaryKey: true
        },
        title: { type: 'text', notNull: true },
        description: { type: 'text', notNull: true },
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
    pgm.dropTable('questions');
    pgm.dropExtension('uuid-ossp');
};
