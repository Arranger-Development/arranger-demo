import test from 'node:test';
import assert from 'node:assert/strict';
import {insertLiveColumn} from '../src/app/liveInteraction.js';

test('column insertion respects either edge, stable snapshots, and no-op drops',()=>{
  const columns=['a','b','c','d'].map(id=>({id,snapshot:{id}}));
  const moved=insertLiveColumn(columns,'a','c','after');
  assert.deepEqual(moved.map(c=>c.id),['b','c','a','d']); assert.equal(moved[2],columns[0]);
  assert.deepEqual(insertLiveColumn(moved,'a','b','before'),columns);
  assert.equal(insertLiveColumn(columns,'b','b'),columns);
  assert.deepEqual(insertLiveColumn(columns,'b','a','after'),columns);
});

