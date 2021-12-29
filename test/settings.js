//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const Path = require('path')
const SchemaDir = Path.resolve(Path.join(__dirname, 'schema'))

var schemaFile = function(release, extension = '.json') {
  return Path.join(SchemaDir, 'schema-' + release + extension)
}

module.exports={
  TestDB: "wysemanTestDB",
  DBAdmin: "admin",
  SchemaDir: SchemaDir,
  Log: require(require.resolve('wyclif/lib/log.js')),
  DbClient: require("../lib/dbclient.js"),
  SchemaFile: schemaFile,
  WmItems: 176
}
