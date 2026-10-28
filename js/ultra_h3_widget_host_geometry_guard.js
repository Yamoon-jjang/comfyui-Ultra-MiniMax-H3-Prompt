// Ultra MiniMax H3 - graph widget host-width isolation.
//
// Current ComfyUI frontend has an upstream LiteGraph/Properties-panel regression:
// WidgetLegacy.vue writes its narrow host width onto the *shared* legacy widget
// object. The graph canvas then reads widget.width before node.size[0], so merely
// selecting a node can redraw every row at the Properties-panel width. Switching
// workflows rebuilds the graph view and temporarily hides the symptom.
//
// H3 rows are intentionally node-width rows. Never fight the Vue Properties host
// from an onDraw hook: frontend 1.53 can write the width reactively, and deleting
// it every frame creates a write/delete render loop that stalls the whole graph.
// Cleanup is event-driven only (initialisation and selection).

const INSTALLED = new WeakSet();
const MARKER = Symbol.for("ultraH3.graphWidgetHostWidthGuard");

function widgetsOf(node) {
  return Array.isArray(node?.widgets) ? node.widgets : [];
}

function restoreGraphWidthOwnership(node) {
  for (const widget of widgetsOf(node)) {
    if (!widget) continue;
    try {
      // All canvas rows in these two H3 nodes are auto-width. A finite own width
      // on the shared widget is therefore host-local state leaked by the current
      // Properties/App legacy renderer, not authoritative graph geometry.
      if (Object.prototype.hasOwnProperty.call(widget, "width")) delete widget.width;
    } catch (_) {
      // Fallback for a non-configurable data property. `undefined` makes
      // LiteGraph use node.size[0] through its normal `widget.width || width` path.
      try { widget.width = undefined; } catch (_) {}
    }
  }
}

function scheduleWidthCleanup(node) {
  const run = () => restoreGraphWidthOwnership(node);
  try {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(run);
      return;
    }
  } catch (_) {}
  queueMicrotask(run);
}

export function installGraphWidgetHostGeometryGuard(node) {
  if (!node || INSTALLED.has(node)) return false;
  INSTALLED.add(node);

  const previousMouseDown = node.onMouseDown;
  node.onMouseDown = function (...args) {
    const result = typeof previousMouseDown === "function"
      ? previousMouseDown.apply(this, args)
      : undefined;
    scheduleWidthCleanup(this);
    return result;
  };

  const previousSelected = node.onSelected;
  node.onSelected = function (...args) {
    const result = typeof previousSelected === "function"
      ? previousSelected.apply(this, args)
      : undefined;
    scheduleWidthCleanup(this);
    return result;
  };

  // Fresh / workflow-loaded nodes should start graph-owned as well.
  restoreGraphWidthOwnership(node);
  try { node[MARKER] = true; } catch (_) {}
  return true;
}
