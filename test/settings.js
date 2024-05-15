//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const Path = require('path')
const SchemaDir = Path.resolve(Path.join(__dirname, 'schema'))

var schemaFile = function(release, extension = '.json') {
  return Path.join(SchemaDir, 'schema-' + release + extension)
}

module.exports = {
  TestDB: "wysemanTestDB",
  Module: "wmtest",
  DBHost: process.env.WYSEMAN_DBHOST || "localhost",
  DBPort: process.env.WYSEMAN_DBPORT || 5432,
  DBAdmin: process.env.WYSEMAN_DBUSER || "admin",
  SchemaDir: SchemaDir,
  Log: require(require.resolve('wyclif/lib/log.js')),
  DbClient: require("../lib/dbclient.js"),
  SchemaFile: schemaFile
}
