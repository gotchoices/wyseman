const Path = require('path')

module.exports={
  TestDB: "wysemanTestDB",
  DBAdmin: "admin",
  SchemaDir: Path.resolve(Path.join(__dirname, 'schema'))
}
