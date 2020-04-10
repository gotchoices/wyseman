#!/usr/bin/env node
//Return information about the currently installed wylib package
//Copyright WyattERP.org; See license in root of this package
// -----------------------------------------------------------------------------
const Path = require("path")
var package = require('../package.json')
var self = Path.normalize(Path.join(__dirname, '..'))
var parent = Path.normalize(Path.join(__dirname, '../..'))

//console.log('argv:', process.argv)
if (process.argv[2] == 'path')
  console.log(self)
else if (process.argv[2] == 'name')
  console.log(package.name)
else if (process.argv[2] == 'version')
  console.log(package.version)
else
  console.log(parent, package.name, package.version)
