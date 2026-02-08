const styleHeader = document.createElement("style");
styleHeader.innerHTML = `header { display: flex;
  align-items: center;
  gap: 0.4em;
  :nth-child(3) {
    margin-inline-end: -0.35em;
  }
 }`;

const headerSpeackerAside = document.querySelector("p-deck");
headerSpeackerAside.shadowRoot.appendChild(styleHeader);
