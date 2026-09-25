const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRuntime, appRoot } = require('../tests/helpers/runtime');
const root = path.resolve(__dirname, '..');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.name === '.git' || entry.name === 'node_modules' ? [] :
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
const errors = [];
let js = 0, json = 0, bindings = 0;
for (const file of walk(root)) {
  const source = fs.readFileSync(file, 'utf8');
  try {
    if (file.endsWith('.js')) {
      new vm.Script(source, { filename: file }); js++;
      for (const match of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
        const target = path.resolve(path.dirname(file), match[1]);
        if (![target, target + '.js', target + '.json', path.join(target, 'index.js')].some(candidate => fs.existsSync(candidate))) {
          errors.push('Missing module: ' + file + ' -> ' + match[1]);
        }
      }
    } else if (file.endsWith('.json')) { JSON.parse(source); json++; }
  } catch (error) { errors.push(file + ': ' + error.message); }
}
const app = JSON.parse(fs.readFileSync(path.join(appRoot, 'app.json'), 'utf8'));
for (const route of app.pages) {
  for (const ext of ['js', 'json', 'wxml']) {
    if (!fs.existsSync(path.join(appRoot, route + '.' + ext))) errors.push('Missing page file: ' + route + '.' + ext);
  }
  const r = createRuntime(), page = r.page(route);
  const template = fs.readFileSync(path.join(appRoot, route + '.wxml'), 'utf8');
  for (const match of template.matchAll(/(?:bind|catch):?[a-zA-Z]+\s*=\s*["']([\w]+)["']/g)) {
    if (typeof page[match[1]] !== 'function') errors.push('Missing handler: ' + route + ' -> ' + match[1]);
    bindings++;
  }
  const stack = [];
  for (const tag of template.matchAll(/<\/?[\w-]+\b(?:[^"'<>]|"[^"]*"|'[^']*')*\/?>/g)) {
    const value = tag[0], name = value.match(/^<\/?([\w-]+)/)[1];
    if (value.startsWith('</')) {
      if (stack.pop() !== name) errors.push('Unbalanced template: ' + route + ' -> ' + name);
    } else if (!value.endsWith('/>')) stack.push(name);
  }
  if (stack.length) errors.push('Unclosed tags: ' + route + ' -> ' + stack.join(', '));
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('Checked ' + js + ' JavaScript files, ' + json + ' JSON files, ' + app.pages.length + ' pages and ' + bindings + ' event bindings. No static errors.');
