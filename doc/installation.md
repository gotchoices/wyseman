# Installing Wyseman

[Prev](introduction.md) | [TOC](README.md) | [Next](concepts.md)

## Prerequisites

Before installing Wyseman, ensure your system meets the following requirements:

- **Node.js**: Version 12.x or higher
- **PostgreSQL**: Version 10.x or higher
- **TCL**: Required for schema parsing (includes pgtcl for PostgreSQL connectivity)

### Installing Required Dependencies

#### PostgreSQL

On Fedora/RHEL-based systems:
```bash
# Install PostgreSQL
dnf install postgresql postgresql-server

# Initialize database (as postgres user)
su -l postgres -c 'initdb'

# Start and enable PostgreSQL service
systemctl start postgresql
systemctl enable postgresql

# Create database admin user
su -l postgres -c 'createuser -d -s -r <username>'
```

On Debian/Ubuntu-based systems:
```bash
# Install PostgreSQL
apt-get install postgresql postgresql-contrib

# PostgreSQL service should start automatically
# If not:
systemctl start postgresql
systemctl enable postgresql

# Create database admin user (as postgres user)
sudo -u postgres createuser --superuser <username>
```

If postgres is on a separate server:
- Edit pg_hba.conf as needed to allow remote connections
- Edit pg_ident.conf if connecting with various usernames

#### TCL

On Fedora/RHEL-based systems:
```bash
# Install TCL with PostgreSQL support
dnf install tcl tcl-pgtcl
```

On Debian/Ubuntu-based systems:
```bash
# Install TCL with PostgreSQL support
apt-get install tcl tcl-dev tcl-pgtcl
```

#### Node.js

Ensure you have Node.js 12.x or higher installed. You can use nvm (Node Version Manager) for easy installation and version management:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js
nvm install 12
nvm use 12
```

### Optional Dependencies

- **Ruby**: Only needed if using the legacy Ruby API
  ```bash
  # On Fedora/RHEL-based systems
  dnf install postgresql-devel redhat-rpm-config ruby-devel
  gem install json
  gem install pg
  gem install tk  # For TCL support in Ruby
  
  # On Debian/Ubuntu-based systems
  apt-get install ruby ruby-dev libpq-dev
  gem install json
  gem install pg
  gem install tk  # For TCL support in Ruby
  ```

## Installation Methods

### From NPM

The simplest way to install Wyseman is via NPM:

```bash
npm install -g wyseman
```

This will install the command-line utility globally, making it available in your PATH.

### From Source

For development or to use the latest features:

```bash
git clone https://github.com/gotchoices/wyseman.git
cd wyseman
npm install
npm link  # Creates a global symlink
```

### Using Makefile

Wyseman also provides a legacy Makefile installation method for system-wide installation.
For JavaScript users, a more modern approach is to install wyseman in a common workspace with
your project (or under node_modules) and invoke wyseman using npx.

```bash
git clone https://github.com/gotchoices/wyseman.git
cd wyseman
make install  # Installs in /usr/local/bin by default
```

You can customize the installation paths with environment variables:
- `WYBIN`: Sets the executable installation path (defaults to /usr/local/bin)
- `WYLIB`: Sets the Tcl library installation path (defaults to /usr/lib)

#### Using NPX

If you have installed Wyseman locally (without `-g`), you can run it using npx:

```bash
# Install locally
npm install wyseman

# Run using npx
npx wyseman [options]
```

This approach is recommended for projects where you want to ensure a specific version of Wyseman is used.

## Configuration

### Basic Configuration

Create a `Wyseman.conf` file in your project directory. The configuration file can contain database connection parameters and define which files to include for different build targets.

#### Simple Example

```
# Database connection
host = localhost
port = 5432
database = myapp
user = mydbuser
password = mydbpassword

# Schema options
schema = public
```

#### Advanced Example with Build Targets

For more complex projects, you can define build targets that specify which files to process. Modern Wyseman projects often use JavaScript-based configuration:

```javascript
const Path = require('path')
const Glob = require('glob').sync

module.exports = {
  // Database connection
  dbname: 'myproject',
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'myuser',
  port: process.env.PGPORT || 5432,
  
  // Project configuration
  dir: __dirname,
  module: 'myproject',
  
  // Build targets
  objects: [                          // Schema object definitions
    'schema/*.wms',                   // Tables, views, functions, etc.
    'schema/base/*.wms'
  ],
  
  text: [                             // Language text definitions
    'schema/*.wmt',
    'schema/base/*.wmt'
  ],
  
  defs: [                             // Dictionary definitions
    'schema/*.wmd',
    'schema/base/*.wmd'
  ],
  
  init: [                             // Initialization scripts
    'schema/base/*.wmi'
  ]
}
```

This configuration specifies the database connection parameters and defines which files should be processed for each build target (objects, text, defs, init). When you run `wyseman -b objects`, it will process all files matching the patterns in the `objects` array.

### Environment Variables

Wyseman respects the following environment variables:

- `PGHOST`: PostgreSQL host
- `PGPORT`: PostgreSQL port
- `PGDATABASE`: PostgreSQL database name
- `PGUSER`: PostgreSQL user
- `PGPASSWORD`: PostgreSQL password

## Verifying Installation

To verify that Wyseman is properly installed:

```bash
npx wyseman-info
```

This should display the current version of Wyseman.

You can also test basic functionality by creating a sample schema and building it:

```bash
# Create a simple test schema file
mkdir -p test/schema
echo 'table test_table {pkey {id int}} -primary id' > test/schema/test.wms

# Create a basic configuration file
cat > Wyseman.conf << EOT
host = localhost
port = 5432
database = test_wyseman
user = $(whoami)
schema = public
EOT

# Create the database
createdb test_wyseman

# Build the schema
wyseman -d -b objects test/schema

# Verify the table was created
psql -d test_wyseman -c "\\dt public.test_table"
```

If everything is working correctly, you should see the test_table in the PostgreSQL database.

## Troubleshooting

### Common Issues

1. **Missing TCL**: If you see errors about missing tcl packages, ensure tcl and tcl-pgtcl are properly installed.

2. **Database Connection**: If you can't connect to PostgreSQL, check:
   - PostgreSQL service is running
   - Your user has proper permissions
   - pg_hba.conf allows your connection method

3. **Library Path Issues**: If TCL libraries can't be found, you may need to set TCLLIBPATH:
   ```bash
   export TCLLIBPATH="/usr/lib /usr/local/lib"
   ```

[Prev](introduction.md) | [TOC](README.md) | [Next](concepts.md)