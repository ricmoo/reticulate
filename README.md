Reticulate
==========

A simple package manager designed originally for ethers.js.

**Features**
- Quite opinionated; this package manager is not for everyone `;)`
- Configuration is stored securely, with a memory-hard key derivation and an optional disclosure canary
- Uses NPM to determine changes and updated package versions
- Manage npm publishing, GitHub releases and monorepos
- Simple

**Monorepo Restrictions**
- The root package.json MUST NOT use the `"dependencies"` (reticulate manages this); `"devDependencies"` are fine though
- All sub-package immediate dependency **versions** MUST match each other


How does the Monorepo work?
---------------------------

The `preinstall` step (`hoist` command) will search all sub-packages
and move their dependencies to the root package.json. This is why all
sub-package versions MUST match each other.

Then the `npm install` can then proceed as normal, blissfully unaware
this is a monorepo.

The `postinstall` step (`ratsnest` command) will create a folder
called `.package_node_modules` with a sub-folder for each sub-pacakge. Each
of these folders will contain symlinks for that package's dependencies to
the root `node_modules`. Then within each sub-package, a symlink to this
sub-folder will be made.

**Example:** (`subPackage1` depends on `dep1` and `dep2`; `subPackage2` depends on `dep1`)

- `/package.json` (`"dependencies"` has been set to `dep1` and `dep2`)
- `/node_modules/`
- `/node_modules/dep1`
- `/node_modules/dep2`
- `/.package_node_modules/`
- `/.package_node_modules/subPackage1/`
- `/.package_node_modules/subPackage1/dep1 => /node_modules/dep1`
- `/.package_node_modules/subPackage1/dep2 => /node_modules/dep2
- `/.package_node_modules/subPackage2/`
- `/.package_node_modules/subPackage2/dep1 => /node_modules/dep1`
- `/packages/subPackage1/` (depends on dep1 and dep2)
- `/packages/subPackage1/node_modules => /.package_node_modules/subPackage1`
- `/packages/subPackage2/` (depends on dep1)
- `/packages/subPackage2/node_modules => /.package_node_modules/subPackage2`


Command-Line Interface
----------------------

**Configuration**

```
/home/ricmoo> reticulate list-keys
/home/ricmoo> reticulate set-key foo bar
/home/ricmoo> reticulate get-key foo
```

**Login Sessions**

```
/home/ricmoo> reticulate npm-login
/home/ricmoo> reticulate npm-logins
/home/ricmoo> reticulate npm-logout [ TOKEN ... ]
```

**Publishing**

```
/home/ricmoo> reticulate publish FOLDER [ FOLDER ... ]
```


Disclosure Canary
-----------------

**TL;DR:** Add an Ethereum mnemonic with some ether, set up an e-mail alert for that account and rotate all keys if that alert is triggered

The configuration (which includes your NPM session keys, GitHub API
keys, AWS keys, etc.) contains an encrypted portion (where all the
mentioned data goes) and an unencrypted, plain text section.

Anyone will access to the file can see this. If you are on a shared
machine, and the file permissions are incorrect they can see it. If
you check it into a repository, they can see it. If someone hax0rs
you compute, they can see it. It has become public.

You should use this to place a string, such as a URL to claim a
bounty, or preferrably a 12-word mnemonic, which contains some tempting
amount Bitcoin or Ethereum. You should also set up an e-mail (or SMS)
alert if that account ever sends any asset out.

This is a bounty you are putting up for grabs, so that anyone that
has access to file will steal it immediately, bribing them to notify
you your encrypted configuration is out in the wild.

Upon receiving an e-mail, you should logout of the NPM session, and
disable all the keys stored in that file. If possible, double check
they were not used recently for unauthorized purposes.

Once you fix the source of the leak (this could be quite complicated
and is out of scope of this blurb), setup new credentials for all
the services and **change the canary** (the last person still has
that mnemonic) and place a new bounty there.

Since there is a memory-hard key derivation process, breaking into
the config will take considerable time and/or energy and money. You
want the bounty to be worth more to any attacker than the effort
and value of gaining access to your credentials.

In general, it is always good practice to occasionally rotate
credentials, in which case rotating the canary makes sense too.


License
-------

MIT License.
