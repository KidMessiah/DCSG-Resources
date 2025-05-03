window.renderWidget = function(container) {
  container.innerHTML = `
    <div>
      <p>
        These rules were written by Matthew Mercer and posted on Twitter some time ago. 
        I prefer death to be a bit more likely in my games, so this is a modified version of his rule.
        <br><br>
        If a character is dead, and a resurrection is attempted by a spell or spell effect, a <strong>Resurrection Challenge</strong> is initiated. 
        Up to <strong>3 members</strong> of the adventuring party can offer to contribute to the ritual via a <strong>Contribution Skill Check</strong>. 
        The DM asks them each to make a skill check based on their form of contribution, with the <strong>DC</strong> of the check adjusting 
        to how helpful/impactful the DM feels the contribution would be.
        <br><br>
        For example, praying to the god of the devout, fallen character may require an <strong>Intelligence (Religion)</strong> check at an 
        <strong>easy to medium difficulty</strong>, whereas loudly demanding the soul of the fallen to return from the aether may require a 
        <strong>Charisma (Intimidation)</strong> check at a <strong>very hard or nearly impossible difficulty</strong>. 
        <strong>Advantage</strong> and <strong>disadvantage</strong> can apply here based on how perfect, or off base, the contribution offered is.
        <br><br>
        After all contributions are completed, the DM then rolls a single, final <strong>Resurrection success check</strong> with <strong>no modifier</strong>. 
        The base <strong>DC</strong> for the final resurrection check is <strong>10</strong>, increasing by <strong>1</strong> for each previous successful resurrection the 
        character has undergone (signifying the slow erosion of the soul’s connection to this world). For each successful 
        contribution skill check, this <strong>DC</strong> is <strong>decreased by 2</strong>, whereas each failed contribution skill check <strong>increases the DC by 1</strong>.
        <br><br>
        Assuming a resurrection fails, you are unable to use a spell of the same or lower level than the one you attempted last. 
        For instance, if you attempt to use <a href="https://5e.tools/spells.html#revivify_xphb" target="_blank"><em>revivify</em></a> 
        (a 3rd level spell), you must then attempt the resurrection using either 
        <a href="https://5e.tools/spells.html#raise%20dead_xphb" target="_blank"><em>raise dead</em></a> or 
        <a href="https://5e.tools/spells.html#reincarnate_xphb" target="_blank"><em>reincarnate</em></a> (both 5th level spells). 
        But if you use either of those, you must then escalate to 
        <a href="https://5e.tools/spells.html#resurrection_xphb" target="_blank"><em>resurrection</em></a> (a 7th level spell), 
        and then <a href="https://5e.tools/spells.html#true%20resurrection_xphb" target="_blank"><em>true resurrection</em></a> 
        (a 9th level spell).
      </p>
    </div>
  `;
};