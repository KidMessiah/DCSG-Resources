window.renderWidget = function(container) {
  container.innerHTML = `
    <p>
      When choosing your character's race, you may
      choose to swap their pre-determined ability scores.
      For example, the Aarakocra has a <b>+2 to Dexterity</b>
      and a <b>+1 to Wisdom</b>.
      Should you believe your Aarakocra was raised differently, in a less physically adverse environment,
      they could instead have a <b>+1 to Dexterity</b> and a
      <b>+2 to Wisdom</b>, to represent a more keen-minded
      individual.
    </p>
  `;
};
