[npm:latest]: https://www.npmjs.com/package/ansi-html-string/v/latest
[npm:latest:badge]: https://img.shields.io/npm/v/ansi-html-string/latest?style=flat-square

# `ansi-html-string` [![Latest Version][npm:latest:badge]][npm:latest]

Convert ANSI escape sequences to html strings

# Installation

```sh
npm install ansi-html-string
```

# Usage

```js
var { toHtml } = require('ansi-html-string');
var str = toHtml('\x1b[35mhelloworld\x1b[0m');
```

# Options

```js
var str = toHtml('\x1b[35mhelloworld\x1b[0m', {
  minimumContrastRatio: 4.5,
  theme: {
    background: "#23272e", // default bg
    foreground: "#abb2bf", // default fg
    red: "#000000", // hex only
    ...
  },
});
```

# Generate simple html template

```js
var str = toDemo('\x1b[31;1;3;4;7;9mhelloworld\x1b[0m');
```
