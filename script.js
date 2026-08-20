console.log("MovieMatch запущен!");
const button = document.getElementById("recommendButton");

button.addEventListener("click", function () {
    const movie1 = document.getElementById("movie1").value;
    const movie2 = document.getElementById("movie2").value;
    const movie3 = document.getElementById("movie3").value;

    const results = document.getElementById("results");

    results.innerHTML = `
        <h2>Твои фильмы:</h2>
        <p>1. ${movie1}</p>
        <p>2. ${movie2}</p>
        <p>3. ${movie3}</p>
    `;
});