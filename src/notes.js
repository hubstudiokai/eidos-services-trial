/**
 * The notes page, kept in PostgreSQL through Prisma:
 * - `GET /notes` shows how many notes exist and a form to add one;
 * - `POST /notes` adds a note and answers `303` to `/notes`, so a reload writes nothing.
 * The store is a parameter, so a test can give a stand-in and need no database.
 */

let client;

/** Returns the process's one store, a PrismaClient made on first use. */
async function defaultStore() {
  if (!client) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
      client = {
        count: () => prisma.note.count(),
        list: (search) => prisma.note.findMany({
          where: search ? { body: { contains: search } } : {},
          orderBy: { createdAt: 'desc' }
        }),
        lastNote: () => prisma.note.findFirst({ orderBy: { createdAt: 'desc' } }),
        add: (body) => prisma.note.create({ data: { body } }),
        toggleFavorite: (id) => prisma.note.update({ where: { id }, data: { isFavorite: { toggle: true } } }),
        delete: (id) => prisma.note.delete({ where: { id } }),
      };
  }
  return client;
}

/** Reads a request's whole body as text, at most 10 kB. */
async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 10_000) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Answers `/notes`: `render` wraps the content in the page layout. */
export async function handleNotes(request, response, render, getStore = defaultStore) {
  try {
    const store = await getStore();
    if (request.method === 'GET') {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const search = url.searchParams.get('search') || '';
      const notes = await store.list(search);
      const count = notes.length;
      const content = `
      <section class="card">
        <h1>Notes</h1>
        <form method="get" action="/notes">
          <input name="search" value="${search}" placeholder="Rechercher..." />
          <button type="submit">Rechercher</button>
        </form>
        <p>Notes trouvées : <strong id="count">${count}</strong></p>
        <ul>
          ${notes.map(n => `<li>${n.body} ${n.isFavorite ? '⭐' : ''}</li>`).join('')}
        </ul>
        <form method="post" action="/notes">
          <input name="body" required maxlength="200" aria-label="Note" />
          <button type="submit" class="btn-add">Ajouter</button>
        </form>
      </section>
  `;
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(render(content, '/notes'));
    } else if (request.method === 'POST') {
      const params = new URLSearchParams(await readBody(request));
      const action = params.get('action');
      if (action === 'delete') {
        await store.delete(Number(params.get('id')));
      } else if (action === 'favorite') {
        await store.toggleFavorite(Number(params.get('id')));
      } else {
        const body = params.get('body')?.trim();
        if (!body) {
          response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
          response.end('A note needs a body');
          return;
        }
        await store.add(body.slice(0, 200));
      }
      response.writeHead(303, { Location: '/notes' });
      response.end();
    } else {
      response.writeHead(405, { Allow: 'GET, POST', 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
    }
  } catch (error) {
    console.error(error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Notes are unavailable');
  }
}
