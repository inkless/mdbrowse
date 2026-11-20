const response = await fetch("./data.json");
const data = await response.json();
document.querySelector("#result").textContent = data.result;
