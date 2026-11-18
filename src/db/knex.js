const knexFactory = require('knex');
const { development } = require('../../knexfile');

module.exports = knexFactory(development);
