window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="width:50px;height:50px;background:#16a085;border-radius:8px;animation:fade 1.2s infinite;"></div>
    </div>
    <style>
      @keyframes fade {
        0% { opacity: 1; }
        50% { opacity: 0.2; }
        100% { opacity: 1; }
      }
    </style>
    <div>Fade Widget Example</div>
  `;
};
