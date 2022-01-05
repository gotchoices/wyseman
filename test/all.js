//Run all tests in order
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const Fs = require('fs')
const Path = require('path')
const Child = require('child_process')
const { TestDB, SchemaDir, DBAdmin, SchemaFile } = require('./settings')

require('./schema.js')
require('./versions.js')
require('./orphan.js')

require('./checkdb.js')
require('./metadata.js')

after('Delete history, delta, schema files', function() {
  Fs.rmSync(Path.join(SchemaDir, 'Wyseman.delta'))
  Fs.rmSync(Path.join(SchemaDir, 'Wyseman.hist'))
  Fs.rmSync(SchemaFile('4'))
})

after('Delete sample database', function(done) {
  Child.exec(`dropdb -U ${DBAdmin} ${TestDB}`, done)
})
