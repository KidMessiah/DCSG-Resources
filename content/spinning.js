window.renderHomepageWidget = function(container) {
  container.innerHTML = `
    <style>
      .spin-emoji {
        display: inline-block;
        font-size: 3rem;
        animation: spin-emoji-anim 1.2s linear infinite;
      }
      @keyframes spin-emoji-anim {
        100% { transform: rotate(360deg); }
      }
    </style>
    <div style="text-align:center;margin:1em 0;">
      <span class="spin-emoji">🌀</span>
      <div>Spinning Emoji Widget</div>
    </div>
  `;
};
