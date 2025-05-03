window.renderWidget = function(container) {
  container.innerHTML = `
    <p>
      In addition to your class, background and racial
      skill proficiencies, your intelligence also affects
      how many skills you are proficient in. Each modifier of intelligence above 0 grants you an additional
      proficiency of your choice, and likewise, each modifier of intelligence below 0, removes a proficiency.
    </p>
  `;
};
