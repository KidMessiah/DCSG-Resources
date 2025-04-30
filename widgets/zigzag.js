window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="width:24px;height:24px;background:#c0392b;border-radius:50%;animation:zigzag 1.2s infinite;"></div>
    </div>
    <style>
      @keyframes zigzag {
        0% { transform: translate(0,0);}
        25% { transform: translate(30px,-20px);}
        50% { transform: translate(0,-40px);}
        75% { transform: translate(-30px,-20px);}
        100% { transform: translate(0,0);}
      }
    </style>
    <div>Zigzag Widget Example</div>
  `;
};
