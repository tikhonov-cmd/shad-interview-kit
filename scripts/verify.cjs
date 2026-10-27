const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const context = {window: {}};
vm.createContext(context);
vm.runInContext(read('dist/assets/data.js'), context);
vm.runInContext(read('dist/assets/app.js'), context);
const {KIT: kit, SHAD: app} = context.window;
for (const route of kit.routes) {
  const html = app.guide(route.group, route);
  assert(!html.includes('undefined'));
  assert.equal((html.match(/data-probe-group=/g) || []).length, 2);
  assert.equal((html.match(new RegExp(`data-probe-group="${route.group}"`, 'g')) || []).length, 2);
  assert.equal((html.match(/class="material-heading"/g) || []).length, 2);
  assert(html.includes(kit.publicUrl + '?items=' + route.first + ',' + route.second));
}
for (const group of ['G1', 'G2', 'G3', 'G4']) {
  for (const render of ['pairs', 'materialLibrary', 'researchOverview']) {
    assert(!app[render](group).includes('undefined'));
  }
}

async function updateScenario(latest, failure = false) {
  const nodes = [];
  const navigations = [];
  const documentEvents = {};
  const doc = {
    hidden: false,
    querySelector: () => ({content: 'current'}),
    createElement: tag => ({tag, children: [], events: {}, setAttribute() {}, remove() {this.removed = true;},
      append(...children) { this.children.push(...children); },
      addEventListener(event, handler) { this.events[event] = handler; }}),
    body: {append: node => nodes.push(node)},
    addEventListener: (event, handler) => { documentEvents[event] = handler; }
  };
  const globals = {
    document: doc, URL, Date,
    location: {protocol: 'https:', href: 'https://example.test/kit/index.html?route=G2-01#block-5', assign: url => navigations.push(url)},
    fetch: async () => { if (failure) throw Error('offline'); return {ok: true, json: async () => ({version: latest})}; },
    setInterval() {}, addEventListener() {}
  };
  vm.runInNewContext(read('site/assets/updates.js'), globals);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(navigations.length, 0, 'Updates must not interrupt the interview');
  return {nodes, navigations, documentEvents};
}

(async () => {
  assert.equal((await updateScenario('current')).nodes.length, 0);
  assert.equal((await updateScenario('next', true)).nodes.length, 0);
  const changed = await updateScenario('next');
  assert.equal(changed.nodes.length, 1);
  await changed.documentEvents.visibilitychange();
  assert.equal(changed.nodes.length, 1, 'Only one update notice is shown');
  changed.nodes[0].children[1].events.click();
  const destination = new URL(changed.navigations[0]);
  assert.equal(destination.searchParams.get('route'), 'G2-01');
  assert.equal(destination.searchParams.get('revision'), 'next');
  assert.equal(destination.hash, '#block-5');
  const deferred = await updateScenario('next');
  deferred.nodes[0].children[2].events.click();
  assert.equal(deferred.nodes[0].removed, true);
  assert.equal(deferred.navigations.length, 0);
  console.log('32 routes, 4 groups and non-interrupting update notifications verified.');
})().catch(error => {console.error(error.message); process.exitCode = 1;});
