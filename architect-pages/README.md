# architect-pages — empty on purpose

This is where this service's own pages will live: the presentation page a buyer sees before
installing, and the build pages that let the architect of a node reshape the service — its design,
its providers, its words — without touching the node.

**It is empty today, and that is the state the owner asked for:** the pages are a separate step. The
folder exists now so that adding them later does not mean reopening the repository and changing its
shape for everyone who already installed it.

## The rule that decides what may go here

Pages in this folder are **data**, not Next routes. The node mounts them; it does not scan for them.

The reason is the node's own guarantee: its pages are prerendered, and a route that appears and
disappears together with an install would break that quietly — the kind of failure nobody notices
until search traffic drops. So a page here describes itself in the node's collection format and is
mounted by the node, rather than compiled from this folder directly.

## The border that must survive

Build pages may change what is **inside** this service — design, providers, texts. They may never
change what is **outside** it: addresses, response shapes, the kinds of entry it hands out. That
outside is the contract by which this service can be replaced with someone else's, and replaceability
is the whole point of a microservice.
