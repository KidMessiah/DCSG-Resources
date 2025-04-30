window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="width:50px;height:50px;background:#e67e22;border-radius:50%;animation:pulse 1s infinite;"></div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.6; }
        100% { transform: scale(1); opacity: 1; }
      }
    </style>
    <div>Pulse Widget Example</div>
  `;
};
