window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="width:36px;height:36px;background:#f39c12;border-radius:6px;animation:shake 0.5s infinite;"></div>
    </div>
    <style>
      @keyframes shake {
        0% { transform: translateX(0);}
        25% { transform: translateX(-10px);}
        50% { transform: translateX(10px);}
        75% { transform: translateX(-10px);}
        100% { transform: translateX(0);}
      }
    </style>
    <div>Shake Widget Example</div>
  `;
};
