window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="height:16px;width:40px;background:#27ae60;border-radius:8px;animation:expand-bar 1.1s infinite alternate;"></div>
    </div>
    <style>
      @keyframes expand-bar {
        0% { width:40px;}
        100% { width:100px;}
      }
    </style>
    <div>Expand Bar Widget Example</div>
  `;
};
