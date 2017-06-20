module.exports = {
  root: true,
  parser: "babel-eslint",
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 7
  },
  // https://github.com/feross/standard/blob/master/RULES.md
  extends: 'standard',
  // required to lint *.vue files
  plugins: [
    'html',
    'promise'
  ],
  // add your custom rules here
  rules: {
    'brace-style': 'off',
    // allow paren-less arrow functions
    'arrow-parens': 'off',
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0
  },
  env: {
    es6: true,
    node: true
  }
}
