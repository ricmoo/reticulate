Reticulate
==========

A simple package manager designed originally for ethers.js.

**Features**
- All configuration is stored securely, with a memory-hardened key derivation and optional disclosure canary
- Manage npm publishing, GitHub releases and monorepos
- Simple


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


License
-------

MIT License.
