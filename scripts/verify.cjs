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

// Participant navigation must preserve the assigned order and never reveal other materials.
function participantScenario(query) {
  const events = {}, documentEvents = {}, nodes = {};
  for (const id of ['material','progress','prev','next','solo','last','material-code','entry','session','error','code','open']) {
    nodes[id] = {style:{}, events:{}, hidden:false, value:'',
      addEventListener(name, handler) {this.events[name] = handler;},
      setAttribute(name, value) {this[name] = value;},
      removeAttribute(name) {delete this[name];}, focus() {this.focused = true;}};
  }
  const messages = [];
  nodes.material.contentWindow = {postMessage: data => messages.push(data)};
  vm.runInNewContext(read('site/student/assets/viewer.js'), {
    URLSearchParams, innerHeight:850, location:{search:query}, scrollTo() {},
    document:{documentElement:{dataset:{theme:'dark'}}, getElementById:id => nodes[id],
      addEventListener:(name, handler) => documentEvents[name] = handler},
    addEventListener:(name, handler) => events[name] = handler
  });
  return {nodes, events, documentEvents, messages};
}
for (const route of kit.routes) {
  const {nodes, events, documentEvents, messages} = participantScenario('?items=' + route.first + ',' + route.second);
  assert.equal(nodes.material.src, 'materials/' + route.first + '.html');
  assert.equal(nodes.prev.disabled, true);
  nodes.next.onclick();
  assert.equal(nodes.material.src, 'materials/' + route.second + '.html');
  assert.equal(nodes.next.disabled, true);
  assert.equal(nodes.last.hidden, false);
  nodes.prev.onclick();
  assert.equal(nodes.material.src, 'materials/' + route.first + '.html');
  assert.equal(nodes.last.hidden, true);
  events.message({source:{}, data:{type:'shad-height',height:9000}});
  assert.equal(nodes.material.style.height, '');
  events.message({source:nodes.material.contentWindow,data:{type:'shad-height',height:1600}});
  assert.equal(nodes.material.style.height, '1602px');
  events.message({source:nodes.material.contentWindow,data:{type:'shad-height',height:300}});
  assert.equal(nodes.material.style.height, '302px');
  documentEvents['shad-theme-change']();
  assert.equal(messages.at(-1).theme, 'dark');
}
for (const material of kit.materials) {
  const {nodes} = participantScenario('?items=' + material.id);
  assert(nodes.prev.disabled && nodes.next.disabled);
}
for (const query of ['?items=m99','?items=m01,m01','?items=m01,m02,m03']) {
  const {nodes} = participantScenario(query);
  assert.equal(nodes.session.hidden, true);
  assert.equal(nodes.code['aria-invalid'], 'true');
  assert(!nodes.material.src);
}
// Standalone materials receive the shared shell without loading interviewer data.
for (const file of fs.readdirSync(path.join(root, 'dist/student/materials'))) {
  const html = read('dist/student/materials/' + file);
  assert(html.includes('../../assets/theme.js?v='));
  assert(html.includes('class="student-page material-page"'));
  assert(!html.includes('data.js'));
}
console.log('Participant order, single materials, invalid links, resizing and theme forwarding verified.');
