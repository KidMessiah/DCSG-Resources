window.renderWidget = function(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:120px;">
      <div style="width:60px;height:60px;border:8px solid #ccc;border-top:8px solid #222e3c;border-radius:50%;animation:spin 1s linear infinite;"></div>
    </div>
    <style>
      @keyframes spin { 100% { transform: rotate(360deg); } }
    </style>
    <div>Spinning Widget Example</div>
  `;
};
