window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="width:50px;height:50px;background:#8e44ad;border-radius:8px;animation:slide 1.2s infinite alternate;"></div>
    </div>
    <style>
      @keyframes slide {
        0% { transform: translateX(0); }
        100% { transform: translateX(60px); }
      }
    </style>
    <div>Slide Widget Example</div>
  `;
};
