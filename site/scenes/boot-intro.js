// STUB — to be replaced by the boot-intro builder.
export default {
  id: 'boot-intro',
  enter(ctx) {
    ctx.root.innerHTML = '<div style="position:absolute;inset:0;display:grid;place-items:center;' +
      'font-family:var(--font-mono);color:var(--bone);opacity:.5;letter-spacing:.3em;font-size:11px">' +
      'UNBUILT SCENE: boot-intro</div>';
  },
};
