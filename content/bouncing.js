window.renderHomepageWidget = function(container) {
  container.innerHTML = `
    <style>
      .bounce-emoji {
        display: inline-block;
        font-size: 3rem;
        animation: bounce-emoji-anim 1s infinite cubic-bezier(.28,.84,.42,1);
      }
      @keyframes bounce-emoji-anim {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-40px); }
      }
    </style>
    <div style="text-align:center;margin:1em 0;">
      <span class="bounce-emoji">🏀</span>
      <div>Bouncing Emoji Widget</div>
    </div>
  `;
};
