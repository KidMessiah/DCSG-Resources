window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="width:40px;height:40px;background:#e67e22;border-radius:6px;animation:flip 1s infinite alternate;"></div>
    </div>
    <style>
      @keyframes flip {
        0% { transform: rotateY(0deg);}
        100% { transform: rotateY(180deg);}
      }
    </style>
    <div>Flip Widget Example</div>
  `;
};
