window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="width:40px;height:40px;background:#2980b9;border-radius:6px;animation:rotate-cube 1.2s linear infinite;"></div>
    </div>
    <style>
      @keyframes rotate-cube {
        100% { transform: rotate(360deg); }
      }
    </style>
    <div>Rotate Cube Widget Example</div>
  `;
};
