import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';

import { handleNotes } from '../src/notes.js';

const notes = [{ body: 'Note de départ', createdAt: new Date('2026-11-18T10:00:00Z') }];
const store = {
  count: async () => notes.length,
  lastNote: async () => notes[notes.length - 1] || null,
  add: async (body) => notes.push({ body, createdAt: new Date() }),
};
let server;
let base;

before(async () => {
  server = createServer((request, response) =>
    handleNotes(request, response, (content) => `<main>${content}</main>`, async () => store),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test('shows the count of notes and a form', async () => {
  const html = await (await fetch(`${base}/notes`)).text();
  assert.match(html, /<strong id="count">1<\/strong>/);
  assert.match(html, /id="last-date"/);
  assert.match(html, /<form method="post" action="\/notes">/);
});

test('adds a note and redirects with 303', async () => {
  const response = await fetch(`${base}/notes`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'body=Bonjour',
  });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/notes');
  assert.match(await (await fetch(`${base}/notes`)).text(), /id="count">2</);
});

test('refuses an empty note', async () => {
  const response = await fetch(`${base}/notes`, { method: 'POST', body: 'body=' });
  assert.equal(response.status, 400);
});
