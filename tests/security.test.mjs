import test from 'node:test';
import assert from 'node:assert/strict';
import {win32} from 'node:path';
import {csvCell} from '../src/export.mjs';
import {sanitize,parseScenario,parseSharedHash} from '../src/scenario.mjs';
import {isPublicPath} from '../scripts/static-path.mjs';

test('CSV formulas cannot hide behind whitespace or control characters',()=>{
  for(const value of ['=1+2','+SUM(1,2)','-1+1','@SUM(1,2)','\t=1+2','\r\n@SUM(1,2)',' \t=HYPERLINK("https://example.com")','\0=1+2'])assert.ok(csvCell(value).startsWith('"\''),JSON.stringify(value));
  assert.equal(csvCell('A "quoted" name'),'"A ""quoted"" name"');assert.equal(csvCell(-2),'"-2"');
});

test('Scenario names cannot resolve prototype properties; imported keys and sizes are bounded',()=>{
  for(const name of ['__proto__','constructor','toString','<img src=x onerror=alert(1)>'])assert.equal(sanitize({a:{name}}).a.name,name);
  const polluted=parseScenario('{"__proto__":{"polluted":true},"a":{"name":"safe","__proto__":{"polluted":true}}}');
  assert.equal({}.polluted,undefined);assert.equal(Object.hasOwn(polluted,'__proto__'),false);
  assert.throws(()=>parseScenario(' '.repeat(16385)),/too large/);
  assert.throws(()=>parseSharedHash('#s='+'%20'.repeat(20000)),/too large/);
  assert.equal(parseSharedHash('#main'),null);
  assert.equal(parseSharedHash('#s='+encodeURIComponent('{"a":{"name":"shared"}}')).a.name,'shared');
  assert.equal(sanitize({a:{attack:Infinity}}).a.attack,3);
});

test('Preview rejects encoded Windows traversal and private repository files',()=>{
  const attack=decodeURIComponent('/assets/%5c..%5c.git/config');
  assert.equal(win32.resolve('C:\\repo','.'+attack),'C:\\repo\\.git\\config');
  for(const path of [attack,'/.git/config','/assets/../.env','/src/.env','/assets/%00','.env','/assets/sub/file.png','/assets/\0x.svg'])assert.equal(isPublicPath(path),false,path);
  for(const path of ['/','/app.mjs','/src/engine.mjs','/assets/icon-192.png'])assert.equal(isPublicPath(path),true,path);
});
