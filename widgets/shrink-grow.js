window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="width:40px;height:40px;background:#16a085;border-radius:50%;animation:shrink-grow 1s infinite alternate;"></div>
    </div>
    <style>
      @keyframes shrink-grow {
        0% { transform: scale(1); }
        100% { transform: scale(1.5); }
      }
    </style>
    <div>Shrink & Grow Widget Example</div>
  `;
};
